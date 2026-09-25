import * as THREE from 'three';
import { RARITY_ORDER } from '../../core/config';
import { decimal, money, moneyRange, t, volume } from '../../core/i18n';
import type { ItemInstance, UnitData } from '../../core/types';
import { itemDef, volumeOf } from '../../data/items';
import { partsOf, buildItem } from '../../render/models';
import { PhysicsWorld } from '../../render/physics';
import { Tex } from '../../render/textures';
import { itemWeight } from '../../systems/vehicle';
import { estimateRange } from '../../systems/items';
import { isUnknown, itemName, thumb } from '../../ui/common';
import { h, replace } from '../../ui/dom';
import { icon } from '../../ui/icons';
import type { App, Controller } from '../App';
import { glance, pickTarget } from '../glance';

interface Hover {
  uid?: string;
  tarp?: number;
  obj: THREE.Object3D;
  point: THREE.Vector3;
}

/**
 * Clearing a won unit: walk in, open boxes and drawers, knock for hidden
 * compartments, drag things around, load the van, drive loads home.
 */
export class SearchController implements Controller {
  readonly name = 'search';
  private unit!: UnitData;
  private physics!: PhysicsWorld;
  private pos = new THREE.Vector3(0, 0, -0.6);
  private yaw = 0;
  private pitch = -0.25;
  private eyeY = 1.6;
  private raycaster = new THREE.Raycaster();
  private hover: Hover | null = null;
  private helper = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color('#f5b300'));
  private menuEl: HTMLElement | null = null;
  private grab: { uid: string; dist: number; last: THREE.Vector3; vel: THREE.Vector3 } | null = null;
  private haulEl = h('div', { class: 'haul-list scroll' });
  private cargoEl = h('div', { class: 'panel cargo' });
  private glints: { obj: THREE.Sprite; target: THREE.Object3D; uid: string }[] = [];
  private slowmo = 0;
  private flying: { obj: THREE.Object3D; t: number; from: THREE.Vector3; to: THREE.Vector3; dur: number; arc: number; done: () => void }[] = [];
  private pad = { f: false, b: false, l: false, r: false };
  private busy = false;
  private tStep = 0;

  constructor(private readonly app: App) {}

  enter() {
    const { app } = this;
    const game = app.game;
    const unit = game.search.unit;
    if (!unit) { app.route('hub'); return; }
    this.unit = unit;
    app.setHudVisible(false);
    const fs = app.facility;
    fs.setMood('golden');
    const today = game.state.today;
    if (!fs.lotSlot(unit.id)) fs.buildRow(today && today.lots.some((l) => l.id === unit.id) ? today.lots : [unit]);
    if (fs.unit?.id !== unit.id) fs.focusLot(unit);
    fs.openDoor(1, 0.01);
    fs.flashlight.intensity = 22;
    for (const [id, f] of fs.figures) if (id !== 'auctioneer' && f.root.position.z > -6) f.root.visible = false;
    app.showFacility();
    this.restoreState();
    this.physics = new PhysicsWorld(unit.dims.w, unit.dims.d, unit.dims.h);
    for (const [uid, obj] of fs.itemObjects) {
      const inst = this.findInst(uid);
      if (!inst) continue;
      this.physics.add(uid, obj, itemDef(inst.defId).dims, itemWeight(inst), true);
    }
    this.helper.visible = false;
    fs.scene.add(this.helper);
    this.pos.set(0, 0, -0.6);
    this.yaw = 0;
    this.pitch = -0.22;
    const eye = this.eye();
    fs.rig.goTo(eye, this.lookTarget(eye), 0.8, 64);
    app.audio.ambience('unit');
    app.audio.music('search');
    this.buildHud();
    if (!game.state.flags.searchTip) {
      game.state.flags.searchTip = true;
      app.ui.toast(t('Click things to open or take them. Drag an object to move it.'), 'info', 6000, 'hand');
    }
  }

  private findInst(uid: string): ItemInstance | null {
    return this.app.game.search.find(uid)?.inst ?? null;
  }

  /** Rebuild the unit exactly as the saved search state left it. */
  private restoreState() {
    const fs = this.app.facility;
    const s = this.app.game.state.search!;
    for (const uid of [...s.taken, ...s.tossed]) fs.removeItemObject(uid);
    for (const i of s.tarpsPulled) {
      const m = fs.tarpMeshes.find((x) => x.userData.tarp === i);
      m?.removeFromParent();
      fs.tarpMeshes = fs.tarpMeshes.filter((x) => x !== m);
    }
    for (const uid of s.opened) {
      const obj = fs.itemObjects.get(uid);
      if (obj) this.animateOpen(obj, true);
    }
    for (const e of this.app.game.search.entries()) {
      if (e.source === 'top' || fs.itemObjects.has(e.inst.uid)) continue;
      const parent = e.parent ? fs.itemObjects.get(e.parent) : null;
      this.spawn(e.inst, parent ?? null, false);
    }
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  private buildHud() {
    const touch = this.app.input.touch || matchMedia('(pointer: coarse)').matches;
    const padBtn = (label: string, key: keyof SearchController['pad']) => h('button', {
      on: {
        pointerdown: () => { this.pad[key] = true; },
        pointerup: () => { this.pad[key] = false; },
        pointerleave: () => { this.pad[key] = false; },
      },
    }, label);
    this.app.ui.setScreen(
      h('div', { class: 'crosshair' }),
      h('div', { class: 'panel haul bracketed' },
        h('div', { class: 'panel-head' }, icon('van', 18), h('div', { class: 'grow' }, h('h2', { class: 'panel-title', style: { fontSize: '18px' } }, t('Unit {n}', { n: this.unit.number })), h('div', { class: 'panel-sub' }, t('Your haul')))),
        this.haulEl,
      ),
      this.cargoEl,
      touch
        ? h('div', { class: 'touch-pad interactive' },
          h('span'), padBtn('▲', 'f'), h('span'),
          padBtn('◀', 'l'), padBtn('▼', 'b'), padBtn('▶', 'r'))
        : h('div', { class: 'hints' },
          h('span', null, h('span', { class: 'kbd' }, 'W'), h('span', { class: 'kbd' }, 'A'), h('span', { class: 'kbd' }, 'S'), h('span', { class: 'kbd' }, 'D'), t('Walk')),
          h('span', null, icon('hand', 14), t('Drag empty space to look')),
          h('span', null, h('span', { class: 'kbd' }, 'E'), t('Use')),
          h('span', null, h('span', { class: 'kbd' }, 'X'), t('Toss')),
          h('span', null, h('span', { class: 'kbd' }, 'R'), t('Rotate held item')),
        ),
    );
    this.renderHaul();
    this.renderCargo();
  }

  private renderHaul() {
    const game = this.app.game;
    const rec = game.state.units[this.unit.id];
    const items = (rec?.itemUids ?? []).map((u) => game.state.items[u]).filter(Boolean).reverse();
    replace(this.haulEl, items.length === 0
      ? h('div', { class: 'faint', style: { padding: '6px', fontSize: '13px' } }, t('Nothing taken yet.'))
      : items.slice(0, 40).map((it) => {
        const def = itemDef(it.defId);
        const isCash = def.id === 'cash';
        return h('div', { class: 'haul-item', style: { borderLeftColor: isUnknown(it) ? 'var(--text-faint)' : `var(--r-${def.rarity})` } },
          thumb(it),
          h('div', null, h('b', null, isCash ? `${t('Cash')} ${money(it.soldFor ?? 0)}` : itemName(it)), h('span', null, isCash ? t('Straight into your pocket') : `${decimal(itemWeight(it), 1)} kg · ${volume(volumeOf(def))}`)),
        );
      }));
  }

  private renderCargo() {
    const game = this.app.game;
    const v = game.vehicle;
    const used = v.usedVolume();
    const cap = v.capacity();
    const kg = v.usedWeight();
    const pay = v.payload();
    const full = v.fillRatio() > 0.85;
    const left = game.search.leftBehind();
    replace(this.cargoEl,
      h('div', { class: 'row between' }, h('span', { class: 'label' }, t('Van · space')), h('b', { class: 'num' }, `${decimal(used, 1)} / ${decimal(cap, 1)} m³`)),
      h('div', { class: ['meter', 'segmented', full ? 'warn' : ''] }, h('i', { style: { width: `${Math.min(100, (used / cap) * 100)}%` } })),
      h('div', { class: 'row between' }, h('span', { class: 'label' }, t('Payload')), h('b', { class: 'num' }, `${Math.round(kg)} / ${pay} kg`)),
      h('div', { class: ['meter', kg / pay > 0.85 ? 'warn' : ''] }, h('i', { style: { width: `${Math.min(100, (kg / pay) * 100)}%` } })),
      h('div', { class: 'grid-2', style: { marginTop: '4px' } },
        h('button', { class: 'btn', disabled: v.cargo().length === 0, onClick: () => this.driveLoad() }, icon('van', 16), t('Drive load ({cost})', { cost: money(v.tripCost()) })),
        h('button', { class: 'btn primary', onClick: () => this.finish() }, icon('check', 16), t('Finish unit')),
      ),
      h('div', { class: 'faint', style: { fontSize: '12px' } }, t('Left behind so far: {n} things · dumpster fee {fee}', { n: left.items.length, fee: money(left.fee) })),
    );
  }

  // ── Camera & movement ─────────────────────────────────────────────────────

  private eye(): THREE.Vector3 {
    return new THREE.Vector3(this.app.facility.lotX + this.pos.x, this.eyeY, this.pos.z);
  }

  private lookTarget(eye: THREE.Vector3): THREE.Vector3 {
    const dir = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    return eye.clone().add(dir.multiplyScalar(3));
  }

  private move(dt: number) {
    const input = this.app.input;
    let f = 0;
    let s = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp') || this.pad.f) f += 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown') || this.pad.b) f -= 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft') || this.pad.l) s -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight') || this.pad.r) s += 1;
    if (!f && !s) return;
    const speed = 1.7;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const step = fwd.multiplyScalar(f).add(right.multiplyScalar(s)).normalize().multiplyScalar(speed * dt);
    const next = this.pos.clone().add(step);
    const { w, d } = this.unit.dims;
    const r = 0.24;
    next.x = THREE.MathUtils.clamp(next.x, -w / 2 + r, w / 2 - r);
    next.z = THREE.MathUtils.clamp(next.z, -2.6, d - r);
    if (next.z < 0.1) next.x = THREE.MathUtils.clamp(next.x, -w / 2 + r, w / 2 - r);
    for (const o of this.physics.obstacles()) {
      const dx = next.x - o.x;
      const dz = next.z - o.z;
      const px = o.hx + r - Math.abs(dx);
      const pz = o.hz + r - Math.abs(dz);
      if (px > 0 && pz > 0) {
        if (px < pz) next.x += Math.sign(dx || 1) * px;
        else next.z += Math.sign(dz || 1) * pz;
      }
    }
    this.pos.copy(next);
    this.tStep += dt;
    if (this.tStep > 0.42) {
      this.tStep = 0;
      this.app.audio.play('step', 0.7);
    }
  }

  // ── Picking ────────────────────────────────────────────────────────────────

  private pick(ndcX: number, ndcY: number): Hover | null {
    const fs = this.app.facility;
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), fs.camera);
    this.raycaster.far = 8;
    for (const hit of this.raycaster.intersectObjects(fs.unitRoot.children, true)) {
      const tgt = pickTarget(hit.object);
      if (tgt) return { ...tgt, point: hit.point };
      if (hit.object.name === 'unitFloor') return null;
    }
    return null;
  }

  private primary(uid: string): string | null {
    const e = this.app.game.search.find(uid);
    if (!e) return null;
    const def = itemDef(e.inst.defId);
    if (def.container && !def.container.locked && !this.app.game.search.isOpen(uid)) return 'open';
    if (def.container?.kind === 'box') return 'toss';
    return 'take';
  }

  private closeMenu() {
    this.menuEl?.remove();
    this.menuEl = null;
  }

  private openMenu(target: Hover, x: number, y: number) {
    this.closeMenu();
    const game = this.app.game;
    const actions: HTMLElement[] = [];
    const act = (label: string, ico: string, fn: () => void, kind = '', key?: string, disabled = false) =>
      h('button', { class: ['btn', 'small', kind], disabled, onClick: () => { this.closeMenu(); fn(); } }, icon(ico, 15), label, key ? h('span', { class: 'kbd' }, key) : null);
    let head: HTMLElement;
    if (target.tarp !== undefined) {
      head = h('div', { class: 'head' }, h('b', null, t('Tarp')), h('span', null, t('Something bulky underneath')));
      actions.push(act(t('Pull the tarp'), 'hand', () => this.pullTarp(target.tarp!), 'primary', 'E'));
    } else {
      const uid = target.uid!;
      const e = game.search.find(uid);
      if (!e) return;
      const def = itemDef(e.inst.defId);
      const g = e.placed ? glance(e.placed) : { title: itemName(e.inst) };
      const open = game.search.isOpen(uid);
      head = h('div', { class: 'head' },
        h('b', null, g.title, (g as { marker?: string }).marker ? h('span', { style: { fontFamily: 'var(--font-hand)', fontWeight: '400', color: '#ffe2a8' } }, ` ${(g as { marker?: string }).marker}`) : null),
        h('span', null, `${decimal(itemWeight(e.inst), 1)} kg · ${volume(volumeOf(def))}`),
      );
      if (def.container && !def.container.locked && !open) {
        const label = def.container.kind === 'drawers' ? t('Search the drawers') : def.container.kind === 'box' || def.container.kind === 'tote' ? t('Open the box') : t('Open it');
        actions.push(act(label, 'box', () => this.openContainer(uid), 'primary', 'E'));
      }
      if (open && game.search.canCheckSecret(uid)) actions.push(act(t('Knock for a hidden compartment'), 'search', () => this.checkSecret(uid)));
      if (def.container?.locked) actions.push(h('div', { class: 'faint', style: { fontSize: '12px', padding: '2px 6px' } }, t('Locked. Take it home and call a locksmith.')));
      const canTake = !(def.container?.kind === 'box') && (!def.container || def.container.locked || open);
      if (canTake) {
        const fits = game.vehicle.canLoad(e.inst).ok || def.id === 'cash';
        actions.push(act(fits ? t('Take it') : t('Take it (van full)'), 'van', () => this.take(uid), open || !def.container ? 'primary' : '', 'E'));
      }
      actions.push(act(def.category === 'trash' || def.container?.kind === 'box' ? t('Toss in the dumpster') : t('Leave it (dumpster)'), 'trash', () => this.toss(uid), 'ghost', 'X'));
    }
    const el = h('div', { class: 'panel context-menu interactive' }, head, actions);
    el.style.left = `${Math.min(x + 12, window.innerWidth - 240)}px`;
    el.style.top = `${Math.min(y + 12, window.innerHeight - 260)}px`;
    this.app.ui.screen.appendChild(el);
    this.menuEl = el;
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  private animateOpen(obj: THREE.Object3D, instant = false) {
    const parts = partsOf(obj);
    const dur = instant ? 0.001 : 0.45;
    const start = performance.now();
    const drawers = parts.drawers ?? [];
    const drawerStart = drawers.map((d) => d.position.z);
    const tick = () => {
      const k = Math.min(1, (performance.now() - start) / (dur * 1000));
      const e = 1 - Math.pow(1 - k, 3);
      parts.flaps?.forEach((f, i) => { f.rotation.z = (i === 0 ? 1 : -1) * 2.3 * e; });
      if (parts.lid) parts.lid.rotation.x = 1.75 * e;
      if (parts.door) parts.door.rotation.y = 1.6 * e;
      drawers.forEach((d, i) => { d.position.z = drawerStart[i] - (i % 2 === 0 ? 0.22 : 0.12) * e; });
      if (k < 1) requestAnimationFrame(tick);
    };
    tick();
    obj.userData.opened = true;
  }

  /** Put an item into the scene next to (or popping out of) its container. */
  private spawn(inst: ItemInstance, parent: THREE.Object3D | null, pop: boolean): THREE.Object3D {
    const fs = this.app.facility;
    const obj = buildItem(inst);
    const def = itemDef(inst.defId);
    const base = parent ? parent.position.clone() : new THREE.Vector3(0, 0.5, this.unit.dims.d / 2);
    const parentDims = parent ? (parent.userData.placed?.dims as [number, number, number] | undefined) ?? [0.4, 0.4, 0.4] : [0.4, 0.4, 0.4];
    const { w, d } = this.unit.dims;
    const px = THREE.MathUtils.clamp(base.x + (Math.random() - 0.5) * parentDims[0] * 0.6, -w / 2 + 0.15, w / 2 - 0.15);
    const pz = THREE.MathUtils.clamp(base.z - parentDims[2] / 2 - 0.08 + (Math.random() - 0.5) * 0.15, 0.1, d - 0.15);
    obj.position.set(px, base.y + parentDims[1] / 2 + def.dims[1] / 2 + 0.05 + Math.random() * 0.1, pz);
    obj.rotation.y = Math.random() * Math.PI * 2;
    fs.unitRoot.add(obj);
    fs.itemObjects.set(inst.uid, obj);
    if (this.physics) {
      this.physics.add(inst.uid, obj, def.dims, itemWeight(inst), false);
      if (pop) this.physics.impulse(inst.uid, new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.6 + Math.random(), -0.8 - Math.random() * 0.6));
    }
    // Precious things catch the light.
    if (inst.authentic && RARITY_ORDER[def.rarity] >= 2 && def.rarity !== 'unique') this.addGlint(inst.uid, obj, RARITY_ORDER[def.rarity]);
    return obj;
  }

  private addGlint(uid: string, obj: THREE.Object3D, tier: number) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: Tex.sparkle(), color: tier >= 4 ? '#ffd27a' : '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    sprite.scale.setScalar(0.12 + tier * 0.03);
    this.app.facility.unitRoot.add(sprite);
    this.glints.push({ obj: sprite, target: obj, uid });
  }

  private removeGlint(uid: string) {
    for (const g of this.glints.filter((x) => x.uid === uid)) g.obj.removeFromParent();
    this.glints = this.glints.filter((x) => x.uid !== uid);
  }

  private openContainer(uid: string) {
    const game = this.app.game;
    const fs = this.app.facility;
    const e = game.search.find(uid);
    if (!e) return;
    const def = itemDef(e.inst.defId);
    const res = game.search.open(uid);
    if (!res.ok) return;
    const obj = fs.itemObjects.get(uid);
    if (obj) this.animateOpen(obj);
    this.app.audio.play(def.container?.kind === 'drawers' ? 'drawer' : 'box_open');
    this.physics.wakeAll();
    if (res.contents.length === 0) {
      this.app.ui.toast(t('Empty.'), 'info', 1800, 'box');
    }
    let jackpot: ItemInstance | null = null;
    res.contents.forEach((c, i) => {
      setTimeout(() => {
        if (this.app.controller !== this) return;
        const o = this.spawn(c, obj ?? null, true);
        this.app.audio.play('thud', 0.35);
        const cdef = itemDef(c.defId);
        this.app.ui.bubble(`found:${c.uid}`, () => o.parent ? o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.18, 0)) : null, isUnknown(c) ? itemName(c) : t(cdef.name), '', '', 2600);
        if (c.authentic && RARITY_ORDER[cdef.rarity] >= 2 && cdef.rarity !== 'unique') this.app.audio.play('sparkle', 0.6 + RARITY_ORDER[cdef.rarity] * 0.1);
        if (cdef.jackpot && !jackpot) {
          jackpot = c;
          this.jackpotMoment(c, o);
        }
        if (cdef.quest) this.app.ui.toast(t('This looks personal… Initials E.M.'), 'info', 3500, 'book');
      }, 180 + i * 260);
    });
    this.renderCargo();
  }

  private jackpotMoment(inst: ItemInstance, obj: THREE.Object3D) {
    const fs = this.app.facility;
    inst.knowledge.idLevel = Math.max(inst.knowledge.idLevel, 1) as 0 | 1 | 2 | 3;
    const [lo, hi] = estimateRange(inst, this.app.game.state.market);
    this.slowmo = 3.2;
    this.app.audio.play('jackpot');
    this.app.ui.jackpot(t('JACKPOT!'), `${t('Estimated value')}: ${moneyRange(lo, hi)}`, itemName(inst), 4600);
    const target = obj.getWorldPosition(new THREE.Vector3());
    const eye = fs.camera.position.clone();
    const dir = target.clone().sub(eye).normalize();
    fs.rig.goTo(target.clone().sub(dir.multiplyScalar(0.9)).setY(target.y + 0.45), target, 1.2, 40, () => {
      setTimeout(() => {
        if (this.app.controller !== this) return;
        const e = this.eye();
        fs.rig.goTo(e, this.lookTarget(e), 1, 64);
      }, 2600);
    });
    fs.rig.shake(0.02, 0.8);
  }

  private checkSecret(uid: string) {
    const found = this.app.game.search.checkSecret(uid);
    const fs = this.app.facility;
    this.app.audio.play('drawer', 0.6);
    if (!found.length) {
      this.app.ui.toast(t('You knock on every panel. Nothing hidden.'), 'info', 2400, 'search');
      return;
    }
    this.app.audio.play('secret');
    this.app.ui.banner(t('SECRET COMPARTMENT!'), '', 2200);
    const parent = fs.itemObjects.get(uid) ?? null;
    found.forEach((c, i) => setTimeout(() => {
      if (this.app.controller !== this) return;
      const o = this.spawn(c, parent, true);
      this.app.ui.bubble(`found:${c.uid}`, () => o.parent ? o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.18, 0)) : null, itemName(c), '', '', 2600);
    }, 400 + i * 300));
  }

  private pullTarp(i: number) {
    this.app.game.search.pullTarp(i);
    this.app.facility.removeTarp(i);
    this.app.audio.play('tarp');
  }

  private flyAway(obj: THREE.Object3D, to: THREE.Vector3, dur: number, arc: number, done: () => void) {
    this.flying.push({ obj, t: 0, from: obj.position.clone(), to, dur, arc, done });
  }

  private async take(uid: string) {
    if (this.busy) return;
    const game = this.app.game;
    const fs = this.app.facility;
    const e = game.search.find(uid);
    if (!e) return;
    const def = itemDef(e.inst.defId);
    if (def.container && !def.container.locked && !game.search.isOpen(uid)) {
      this.openContainer(uid);
      return;
    }
    const res = game.search.take(uid);
    if (!res.ok) {
      if (res.reason === 'volume' || res.reason === 'weight') {
        this.app.audio.play('error');
        this.busy = true;
        const go = await this.app.ui.confirm(
          t('Your vehicle is full.'),
          res.reason === 'weight' ? t('The van cannot carry more weight. Drive this load to your garage and come back?') : t('There is no room left in the van. Drive this load to your garage and come back?'),
          t('Drive load ({cost})', { cost: money(game.vehicle.tripCost()) }),
          t('Not now'),
        );
        this.busy = false;
        if (go) {
          this.driveLoad();
          this.take(uid);
        }
      }
      return;
    }
    this.physics.remove(uid);
    this.removeGlint(uid);
    const obj = fs.itemObjects.get(uid);
    if (obj) {
      fs.itemObjects.delete(uid);
      (obj.userData.blob as THREE.Object3D | undefined)?.removeFromParent();
      const camLocal = fs.camera.position.clone().sub(fs.unitRoot.position).add(new THREE.Vector3(0, -0.6, 0));
      this.flyAway(obj, camLocal, 0.35, 0.15, () => obj.removeFromParent());
    }
    if (res.cash) {
      this.app.audio.play('coin');
      this.app.ui.toast(t('Cash! +{amount}', { amount: money(res.cash) }), 'good', 2600, 'cash');
    } else {
      this.app.audio.play('pickup');
      if (def.quest) this.app.ui.toast(t('Story item found: {name}', { name: t(def.name) }), 'achievement', 3600, 'book');
    }
    this.renderHaul();
    this.renderCargo();
  }

  private toss(uid: string) {
    const game = this.app.game;
    const fs = this.app.facility;
    if (!game.search.toss(uid)) return;
    this.physics.remove(uid);
    this.removeGlint(uid);
    const obj = fs.itemObjects.get(uid);
    if (obj) {
      fs.itemObjects.delete(uid);
      (obj.userData.blob as THREE.Object3D | undefined)?.removeFromParent();
      this.flyAway(obj, new THREE.Vector3(obj.position.x * 0.3, 0.3, -4.2), 0.55, 0.9, () => obj.removeFromParent());
    }
    this.app.audio.play('toss');
    this.renderCargo();
  }

  private driveLoad() {
    const game = this.app.game;
    const n = game.vehicle.cargo().length;
    const res = game.search.driveLoad();
    if (!res.ok) return;
    this.app.audio.play('truck');
    this.app.ui.toast(t('You drove {n} items to your garage and came back (−{cost}).', { n, cost: money(res.cost) }), 'info', 3600, 'van');
    this.renderCargo();
  }

  private async finish() {
    if (this.busy) return;
    const game = this.app.game;
    const left = game.search.leftBehind();
    const cargo = game.vehicle.cargo().length;
    this.busy = true;
    const ok = await this.app.ui.confirm(
      t('Finish unit {n}?', { n: this.unit.number }),
      [
        left.items.length ? t('{n} things stay behind and go to the dumpster (fee {fee}).', { n: left.items.length, fee: money(left.fee) }) : t('The unit is empty. Nice and clean.'),
        cargo ? t('Your van drives the last load home ({cost}).', { cost: money(game.vehicle.tripCost()) }) : '',
      ].filter(Boolean).join(' '),
      t('Finish'),
      t('Keep searching'),
    );
    this.busy = false;
    if (!ok) return;
    const rep = game.search.finish();
    this.app.audio.play(cargo ? 'truck' : 'door_clank');
    const pnl = game.economy.unitPnL(this.unit.id);
    const next = () => {
      const lot = game.auctions.nextLot();
      this.app.route(lot ? 'auction' : 'summary');
    };
    this.app.ui.modal({
      title: t('Unit {n} cleared', { n: this.unit.number }),
      sub: rep.cleanSweep ? t('Clean sweep: nothing valuable left behind') : undefined,
      body: h('div', { class: 'col' },
        h('table', { class: 'ledger' },
          h('tr', null, h('td', null, t('Items kept')), h('td', null, String(rep.taken))),
          h('tr', null, h('td', null, t('Purchase')), h('td', { class: 'neg' }, money(pnl.purchase))),
          h('tr', null, h('td', null, t('Transport')), h('td', { class: pnl.transport < 0 ? 'neg' : '' }, money(pnl.transport))),
          h('tr', null, h('td', null, t('Dumpster')), h('td', { class: pnl.disposal < 0 ? 'neg' : '' }, money(pnl.disposal))),
          pnl.sales ? h('tr', null, h('td', null, t('Cash found')), h('td', { class: 'pos' }, money(pnl.sales))) : null,
          h('tr', { class: 'total' }, h('td', null, t('Estimated value of your haul')), h('td', null, money(pnl.unsoldEstimate))),
        ),
        h('p', { class: 'note' }, t('Identify, clean and repair your finds in the garage, then sell them. The unit report tracks every dollar.')),
      ),
      actions: [
        { label: t('Go to garage'), kind: 'ghost', icon: 'garage', onClick: () => { game.auctions.nextLot(); this.app.route('garage'); } },
        { label: game.auctions.isDayOver() || !game.state.today || game.state.today.index >= game.state.today.lots.length - 1 ? t('Review the day') : t('Next unit'), kind: 'primary', icon: 'right', onClick: () => { next(); } },
      ],
      dismissable: false,
    });
  }

  // ── Loop ───────────────────────────────────────────────────────────────────

  update(rawDt: number) {
    const fs = this.app.facility;
    const input = this.app.input;
    let dt = rawDt;
    if (this.slowmo > 0) {
      this.slowmo -= rawDt;
      dt = rawDt * 0.25;
      this.physics.timeScale = 0.25;
      this.app.renderer.focus = Math.min(1, this.slowmo);
    } else {
      this.physics.timeScale = 1;
      this.app.renderer.focus = 0;
    }
    this.physics.step(dt);
    fs.update(dt);

    // Items flying into the van or the dumpster.
    for (const f of [...this.flying]) {
      f.t += rawDt / f.dur;
      const k = Math.min(1, f.t);
      f.obj.position.lerpVectors(f.from, f.to, k);
      f.obj.position.y += Math.sin(k * Math.PI) * f.arc;
      f.obj.scale.setScalar(1 - k * 0.7);
      if (k >= 1) {
        f.done();
        this.flying.splice(this.flying.indexOf(f), 1);
      }
    }
    for (const g of this.glints) {
      g.obj.position.copy(g.target.position).add(new THREE.Vector3(0, 0.05, 0));
      (g.obj.material as THREE.SpriteMaterial).opacity = 0.35 + 0.65 * Math.max(0, Math.sin(performance.now() / 260 + g.target.id));
      g.obj.material.rotation += rawDt * 0.8;
    }

    const blocked = this.app.ui.modalOpen || this.busy;
    if (!blocked && !fs.rig.moving) {
      this.move(rawDt);
      // Grabbing and dragging objects.
      if (this.grab) {
        const ndc = input.ndc();
        this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), fs.camera);
        this.grab.dist = THREE.MathUtils.clamp(this.grab.dist - input.wheel * 0.15, 0.6, 3.5);
        const p = this.raycaster.ray.at(this.grab.dist, new THREE.Vector3()).sub(fs.unitRoot.position);
        this.grab.vel.copy(p).sub(this.grab.last).divideScalar(Math.max(1e-3, rawDt));
        this.grab.last.copy(p);
        this.physics.moveHand(p);
        if (input.pressedKey('KeyR')) this.physics.rotateGrabbed();
        if (!input.down) {
          this.physics.release(this.grab.vel.clampLength(0, 4));
          this.grab = null;
          this.app.audio.play('thud', 0.3);
        }
      } else if (input.dragging && input.dragStart) {
        const start = input.dragStart;
        if (!this.hover || this.hover.tarp !== undefined || input.touch || input.button === 2) {
          const sens = 0.0042 * this.app.settings.sensitivity;
          this.yaw += input.dx * sens;
          this.pitch += (this.app.settings.invertY ? 1 : -1) * input.dy * sens;
          this.pitch = THREE.MathUtils.clamp(this.pitch, -1.2, 0.9);
        } else if (this.hover.uid && this.physics.has(this.hover.uid)) {
          const ndc = input.ndc(start.x, start.y);
          const hit = this.pick(ndc.x, ndc.y);
          if (hit?.uid === this.hover.uid) {
            this.closeMenu();
            const local = hit.point.clone().sub(fs.unitRoot.position);
            this.physics.grab(hit.uid, local);
            this.grab = { uid: hit.uid, dist: fs.camera.position.distanceTo(hit.point), last: local.clone(), vel: new THREE.Vector3() };
          }
        }
      }
      const eye = this.eye();
      fs.camera.position.copy(eye);
      fs.rig.look.copy(this.lookTarget(eye));

      // Hover + click.
      if (!this.grab) {
        const usePointer = input.onCanvas && !input.touch;
        const ndc = usePointer ? input.ndc() : { x: 0, y: 0 };
        this.hover = input.dragging ? this.hover : this.pick(ndc.x, ndc.y);
      }
      if (this.hover && !this.grab) {
        this.helper.box.setFromObject(this.hover.obj);
        this.helper.visible = true;
      } else this.helper.visible = false;
      if (input.click && !this.grab) {
        const ndc = input.ndc(input.click.x, input.click.y);
        const hit = this.pick(input.touch ? 0 : ndc.x, input.touch ? 0 : ndc.y) ?? (input.touch ? this.pick(ndc.x, ndc.y) : null);
        if (hit) {
          this.app.audio.play('click', 0.6);
          this.openMenu(hit, input.click.x, input.click.y);
        } else this.closeMenu();
      }
      if (this.hover && input.pressedKey('KeyE')) {
        this.closeMenu();
        if (this.hover.tarp !== undefined) this.pullTarp(this.hover.tarp);
        else if (this.hover.uid) {
          const p = this.primary(this.hover.uid);
          if (p === 'open') this.openContainer(this.hover.uid);
          else if (p === 'take') this.take(this.hover.uid);
          else if (p === 'toss') this.toss(this.hover.uid);
        }
      }
      if (this.hover?.uid && input.pressedKey('KeyX')) {
        this.closeMenu();
        this.toss(this.hover.uid);
      }
    }
    if (input.pressedKey('Escape')) this.closeMenu();
  }

  exit() {
    this.closeMenu();
    this.helper.removeFromParent();
    for (const g of this.glints) g.obj.removeFromParent();
    this.glints = [];
    this.app.renderer.focus = 0;
    this.app.facility.flashlight.intensity = 0;
    for (const f of this.app.facility.figures.values()) f.root.visible = true;
  }
}
