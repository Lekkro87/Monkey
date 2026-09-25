import * as THREE from 'three';
import { CONFIG } from '../../core/config';
import { decimal, money, N_, t, tDeep } from '../../core/i18n';
import type { ItemInstance } from '../../core/types';
import { itemDef } from '../../data/items';
import { COSMETICS, QUEST_MAP, UPGRADES, type CosmeticDef } from '../../data/progression';
import type { SortKey } from '../../systems/inventory';
import { isUnknown, itemCard, itemName } from '../../ui/common';
import { h, replace } from '../../ui/dom';
import { icon } from '../../ui/icons';
import type { App, Controller } from '../App';
import { itemHeader, notebook } from '../screens/itemPanel';

type Tab = 'stock' | 'bench' | 'upgrades' | 'style' | 'van';
type Filter = 'all' | 'unknown' | 'work' | 'listed';

/** The home base: stock, workbench, upgrades and customisation. */
export class GarageController implements Controller {
  readonly name = 'garage';
  private tab: Tab;
  private selected: string | null = null;
  private sort: SortKey = 'recent';
  private filter: Filter = 'all';
  private panel = h('div', { class: 'panel bracketed hub-panel', style: { width: 'min(460px, 100%)' } });
  private raycaster = new THREE.Raycaster();

  constructor(private readonly app: App, tab: Tab = 'stock', selected: string | null = null) {
    this.tab = tab;
    this.selected = selected;
  }

  enter() {
    const { app } = this;
    app.setHudVisible(true);
    const g = app.garage;
    g.applyCosmetics(app.game.state.garage);
    g.setVan(app.game.state.vehicle.upgrades);
    this.refreshScene();
    app.showGarage();
    g.view(this.tab === 'bench' ? 'bench' : 'overview', 0);
    app.audio.ambience('garage');
    app.audio.music('garage');
    app.ui.setScreen(h('div', { class: 'screen' }, this.panel));
    if (this.tab === 'bench' && !this.selected) this.selected = this.stock()[0]?.uid ?? null;
    this.render();
    if (app.game.quests.canResolve('photographer')) this.questPrompt();
  }

  private stock(): ItemInstance[] {
    return this.app.game.inventory.all().filter((i) => ['garage', 'display', 'listed', 'consigned'].includes(i.location));
  }

  private refreshScene() {
    const game = this.app.game;
    const g = this.app.garage;
    g.setStock(game.inventory.all().filter((i) => i.location === 'garage' || i.location === 'listed'));
    const slots = game.inventory.displaySlots();
    const disp = game.state.garage.display.slice(0, slots).map((uid) => (uid ? game.state.items[uid] ?? null : null));
    g.setDisplay(disp);
    g.showOnBench(this.tab === 'bench' && this.selected ? game.state.items[this.selected] ?? null : null);
  }

  private setTab(tab: Tab) {
    this.tab = tab;
    const g = this.app.garage;
    if (tab === 'bench') {
      if (!this.selected) this.selected = this.stock()[0]?.uid ?? null;
      g.showOnBench(this.selected ? this.app.game.state.items[this.selected] ?? null : null);
      g.view('bench');
    } else {
      g.showOnBench(null);
      g.view(tab === 'van' ? 'van' : tab === 'style' ? 'overview' : tab === 'upgrades' ? 'shelves' : 'overview');
    }
    this.render();
  }

  private select(uid: string) {
    this.selected = uid;
    this.app.audio.play('click');
    this.setTab('bench');
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  private render() {
    const game = this.app.game;
    const cap = game.inventory.garageCapacity();
    const used = game.inventory.garageUsed();
    const tabBtn = (id: Tab, label: string, count?: number) => h('button', { class: ['tab', this.tab === id ? 'active' : ''], onClick: () => this.setTab(id) }, t(label), count ? h('span', { class: 'count' }, String(count)) : null);
    const body = h('div', { class: 'scroll', style: { flex: '1', minHeight: '0' } });
    switch (this.tab) {
      case 'stock': replace(body, this.renderStock()); break;
      case 'bench': replace(body, this.renderBench()); break;
      case 'upgrades': replace(body, this.renderUpgrades()); break;
      case 'style': replace(body, this.renderStyle()); break;
      case 'van': replace(body, this.renderVan()); break;
    }
    replace(this.panel,
      h('div', { class: 'hazard-strip' }),
      h('div', { class: 'panel-head' },
        h('div', { class: 'grow' },
          h('div', { class: 'eyebrow' }, t('Home base')),
          h('h2', { class: 'panel-title' }, t('Your garage')),
          h('div', { class: 'row', style: { marginTop: '6px' } },
            h('div', { class: ['meter', 'grow', used > cap ? 'warn' : ''] }, h('i', { style: { width: `${Math.min(100, (used / cap) * 100)}%` } })),
            h('span', { class: 'num faint', style: { fontSize: '13px' } }, `${decimal(used, 1)} / ${decimal(cap, 0)} m³`),
          ),
        ),
      ),
      h('div', { class: 'tabs' },
        tabBtn('stock', N_('Stock'), this.stock().length),
        tabBtn('bench', N_('Workbench')),
        tabBtn('upgrades', N_('Upgrades')),
        tabBtn('style', N_('Style')),
        tabBtn('van', N_('Van')),
      ),
      body,
      h('div', { class: 'panel-body grid-2', style: { borderTop: '1px solid var(--line)' } },
        h('button', { class: 'btn', onClick: () => this.app.route('market') }, icon('store', 16), t('Market')),
        h('button', { class: 'btn primary', onClick: () => this.app.route(game.search.active ? 'search' : 'hub') }, icon('van', 16), game.search.active ? t('Back to the unit') : t('Drive to Lucky Lock')),
      ),
    );
  }

  private renderStock() {
    const game = this.app.game;
    let items = this.stock();
    if (this.filter === 'unknown') items = items.filter((i) => isUnknown(i) || !i.knowledge.conditionKnown);
    if (this.filter === 'work') items = items.filter((i) => (i.broken && i.knowledge.workingKnown) || i.dirt > 0.45 || !!i.lockedContents);
    if (this.filter === 'listed') items = items.filter((i) => i.location === 'listed' || i.location === 'consigned');
    items = game.inventory.sort(items, this.sort);
    const sortSel = h('select', { class: 'select', id: 'stock-sort', onChange: (e) => { this.sort = (e.target as HTMLSelectElement).value as SortKey; this.render(); } },
      (['recent', 'value', 'rarity', 'category', 'condition', 'weight'] as SortKey[]).map((k) => {
        const o = h('option', { value: k }, t({ recent: 'Newest', value: 'Value', rarity: 'Rarity', category: 'Category', condition: 'Condition', weight: 'Weight' }[k]));
        if (k === this.sort) o.selected = true;
        return o;
      }));
    const filterSel = h('select', { class: 'select', id: 'stock-filter', onChange: (e) => { this.filter = (e.target as HTMLSelectElement).value as Filter; this.render(); } },
      (['all', 'unknown', 'work', 'listed'] as Filter[]).map((k) => {
        const o = h('option', { value: k }, t({ all: 'All items', unknown: 'Needs inspection', work: 'Needs work', listed: 'For sale' }[k]));
        if (k === this.filter) o.selected = true;
        return o;
      }));
    return [
      h('div', { class: 'toolbar' }, icon('search', 16), sortSel, filterSel),
      items.length === 0
        ? h('div', { class: 'panel-body' }, h('p', { class: 'note' }, this.stock().length === 0 ? t('Your garage is empty. Win a storage unit and haul something home.') : t('No items match this filter.')))
        : h('div', { class: 'item-grid' }, items.map((it) => itemCard(it, game.state.market, {
          onClick: () => this.select(it.uid),
          extra: it.location === 'listed' ? h('span', { class: 'chip', style: { color: 'var(--cool)' } }, t('Listed')) : it.location === 'consigned' ? h('span', { class: 'chip', style: { color: 'var(--r-epic)' } }, t('At auction house')) : it.location === 'display' ? h('span', { class: 'chip r-legendary' }, t('On display')) : null,
        }))),
    ];
  }

  private renderBench() {
    const game = this.app.game;
    const inst = this.selected ? game.state.items[this.selected] : null;
    const all = game.inventory.sort(this.stock(), this.sort);
    if (!inst || !['garage', 'display', 'listed', 'consigned'].includes(inst.location)) {
      return h('div', { class: 'panel-body' }, h('p', { class: 'note' }, t('Pick an item from your stock to work on it.')));
    }
    const idx = all.findIndex((i) => i.uid === inst.uid);
    const nav = h('div', { class: 'row between', style: { padding: '8px 16px 0' } },
      h('button', { class: 'btn ghost small', disabled: idx <= 0, onClick: () => this.select(all[idx - 1].uid) }, icon('left', 14), t('Previous')),
      h('span', { class: 'faint num', style: { fontSize: '12px' } }, `${idx + 1} / ${all.length}`),
      h('button', { class: 'btn ghost small', disabled: idx >= all.length - 1, onClick: () => this.select(all[idx + 1].uid) }, t('Next'), icon('right', 14)),
    );
    const w = game.workshop;
    const def = itemDef(inst.defId);
    const atBench = inst.location !== 'consigned';
    const rows: HTMLElement[] = [];
    const row = (ico: string, title: string, sub: string, cost: string, onClick: () => void, opts: { disabled?: boolean; done?: boolean } = {}) =>
      h('button', { class: ['action-row', opts.done ? 'done' : ''], disabled: opts.disabled || !atBench, onClick },
        icon(opts.done ? 'check' : ico, 18), h('div', null, h('b', null, title), sub ? h('span', { style: { display: 'block' } }, sub) : null), h('span', { class: 'cost num' }, cost));
    for (const s of w.steps(inst.uid)) {
      const need = s.requires ? UPGRADES.find((u) => u.id === s.requires) : null;
      rows.push(row('search', t(s.label), !s.available && need ? t('Needs: {u}', { u: t(need.name) }) : s.done ? t('Done') : '', s.cost ? money(s.cost) : t('Free'), () => this.doStep(s.id), { disabled: !s.available, done: s.done && s.id !== 'develop' }));
    }
    if (w.canClean(inst.uid)) {
      const hurts = def.cleaningHurts && inst.knowledge.idLevel >= 2;
      rows.push(row('sparkle', t('Clean it'), hurts ? t('Careful: cleaning can damage this kind of item.') : t('Removes dirt and grime.'), money(w.cleaningCost(inst.uid)), () => this.clean()));
    }
    if (w.canRepair(inst.uid) && (inst.knowledge.workingKnown || !def.brokenChance)) {
      const o = w.repairOptions(inst.uid)!;
      rows.push(row('wrench', t('Repair it yourself'), t('{p}% chance of success. Failure makes it worse.', { p: Math.round(o.diyChance * 100) }), money(o.diyCost), () => this.repair('diy')));
      rows.push(row('hammer', t('Professional repair'), t('Guaranteed, and one condition step better.'), money(o.proCost), () => this.repair('pro')));
    }
    if (w.canCheckSecret(inst.uid)) rows.push(row('search', t('Knock for a hidden compartment'), t('Old cabinetmakers loved secret drawers.'), t('Free'), () => this.secret()));
    if (w.canCrack(inst.uid)) rows.push(row('key', t('Call a locksmith'), t('Whatever is inside, it is yours.'), money(CONFIG.workshop.locksmith), () => this.locksmith()));
    const expert = w.expert(inst.uid);
    if (expert && inst.knowledge.idLevel < 3) rows.push(row('user', t('Call {name}', { name: expert.name }), t(expert.title), money(w.expertFee(inst.uid)), () => this.appraise()));
    const displaySlots = game.inventory.displaySlots();
    const onDisplay = inst.location === 'display';
    const freeSlot = game.state.garage.display.slice(0, displaySlots).findIndex((x) => !x);
    return [
      nav,
      h('div', { class: 'panel-body col' },
        itemHeader(this.app, inst),
        h('span', { class: 'eyebrow' }, t('Notes')),
        notebook(inst),
        h('span', { class: 'eyebrow' }, t('Work on it')),
        h('div', { class: 'action-list' }, rows.length ? rows : h('p', { class: 'note' }, t('Nothing left to do on the bench.'))),
        !atBench ? h('p', { class: 'note' }, t('This item is at the auction house right now.')) : null,
        h('div', { class: 'grid-2' },
          h('button', { class: 'btn', disabled: inst.location === 'consigned' || inst.location === 'listed' || (!onDisplay && freeSlot < 0), onClick: () => this.toggleDisplay(inst) }, icon('star', 16), onDisplay ? t('Take off display') : t('Put on display')),
          h('button', { class: 'btn primary', disabled: inst.location === 'consigned', onClick: () => this.app.route('market', { item: inst.uid }) }, icon('tag', 16), t('Sell…')),
        ),
      ),
    ];
  }

  private renderUpgrades() {
    const game = this.app.game;
    const groups: ['garage' | 'workbench' | 'vehicle', string][] = [['workbench', N_('Workbench')], ['garage', N_('Garage')], ['vehicle', N_('Van')]];
    return h('div', { class: 'panel-body col' }, groups.map(([kind, label]) => [
      h('span', { class: 'eyebrow' }, t(label)),
      h('div', { class: 'action-list' }, UPGRADES.filter((u) => u.kind === kind).map((u) => {
        const owned = game.hasUpgrade(u.id);
        const can = game.canBuyUpgrade(u.id);
        return h('button', { class: ['action-row', owned ? 'done' : ''], disabled: owned || !can.ok, onClick: () => this.buy(u.id) },
          icon(owned ? 'check' : 'bolt', 18),
          h('div', null, h('b', null, t(u.name)), h('span', { style: { display: 'block' } }, t(u.description)), !owned && !can.ok && can.reason ? h('span', { style: { display: 'block', color: 'var(--orange)' } }, tDeep(can.reason, can.params)) : null),
          h('span', { class: 'cost num' }, owned ? t('Owned') : money(u.cost)));
      })),
    ]));
  }

  private renderStyle() {
    const game = this.app.game;
    const slots: [CosmeticDef['slot'], string][] = [['wall', N_('Wall paint')], ['floor', N_('Floor')], ['light', N_('Lighting')], ['neon', N_('Neon sign')]];
    return h('div', { class: 'panel-body col' }, slots.map(([slot, label]) => [
      h('span', { class: 'eyebrow' }, t(label)),
      h('div', { class: 'action-list' }, COSMETICS.filter((c) => c.slot === slot).map((c) => {
        const active = game.state.garage[slot] === c.id;
        const owned = game.ownsCosmetic(c.id);
        const swatch = h('span', { style: { width: '18px', height: '18px', borderRadius: '3px', background: c.value && c.value.startsWith('#') ? c.value : c.value.includes('#') ? `#${c.value.split('#')[1]}` : c.value === 'checker' ? 'repeating-conic-gradient(#111 0 25%, #eee 0 50%) 0 0/8px 8px' : '#555', border: '1px solid var(--line-strong)' } });
        return h('button', { class: ['action-row', active ? 'done' : ''], disabled: active || (!owned && !game.economy.canAfford(c.cost)), onClick: () => this.cosmetic(c.id) },
          swatch, h('div', null, h('b', null, t(c.name))), h('span', { class: 'cost num' }, active ? t('Active') : owned ? t('Apply') : money(c.cost)));
      })),
    ]));
  }

  private renderVan() {
    const game = this.app.game;
    const v = game.vehicle;
    return h('div', { class: 'panel-body col' },
      h('h3', { class: 'panel-title', style: { fontSize: '20px' } }, t(v.def.name)),
      h('dl', { class: 'kv' },
        h('dt', null, t('Cargo space')), h('dd', null, `${decimal(v.capacity(), 1)} m³`),
        h('dt', null, t('Payload')), h('dd', null, `${v.payload()} kg`),
        h('dt', null, t('Cost per trip')), h('dd', null, money(v.tripCost())),
        h('dt', null, t('Upgrades')), h('dd', null, game.state.vehicle.upgrades.length ? game.state.vehicle.upgrades.map((u) => t(UPGRADES.find((x) => x.id === u)!.name)).join(', ') : '—'),
      ),
      h('p', { class: 'note' }, t('Bigger units often need two trips. Every trip costs fuel and counts against the unit\'s profit.')),
      h('p', { class: 'note faint' }, t('Pickup trucks, box trucks and a luxury van come with the next expansion.')),
    );
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  private afterWork(msg?: string, kind: 'good' | 'bad' | 'info' = 'info') {
    if (msg) this.app.ui.toast(msg, kind, 3200);
    const inst = this.selected ? this.app.game.state.items[this.selected] : null;
    this.app.garage.showOnBench(inst ?? null);
    this.render();
  }

  private doStep(stepId: string) {
    const game = this.app.game;
    const uid = this.selected!;
    const before = itemName(game.state.items[uid]);
    const res = game.workshop.inspect(uid, stepId);
    if (!res.ok) { this.app.audio.play('error'); this.app.ui.toast(t(res.reason ?? 'Not possible.'), 'bad'); return; }
    this.app.audio.play(stepId === 'power' || stepId === 'wind' || stepId === 'shutter' || stepId === 'play' ? 'click' : 'paper');
    const after = itemName(game.state.items[uid]);
    if (res.step?.identified || before !== after) {
      this.app.garage.flourish();
      this.app.audio.play('sparkle', 0.8);
      this.afterWork(t('Identified: {name}', { name: after }), 'good');
      return;
    }
    this.afterWork();
  }

  private clean() {
    const res = this.app.game.workshop.clean(this.selected!);
    if (!res.ok) { this.app.ui.toast(t(res.reason ?? 'Not possible.'), 'bad'); return; }
    this.app.audio.play('spray');
    this.app.garage.flourish();
    this.afterWork(res.hurt ? t('Oops. The cleaning scratched it. Collectors will pay less.') : t('Much better. Clean items sell for more.'), res.hurt ? 'bad' : 'good');
  }

  private repair(mode: 'diy' | 'pro') {
    const res = this.app.game.workshop.repair(this.selected!, mode);
    if (!res.ok) { this.app.ui.toast(t(res.reason ?? 'Not possible.'), 'bad'); return; }
    this.app.audio.play('ratchet');
    if (res.success) this.app.garage.flourish();
    else this.app.audio.play('fail');
    this.afterWork(res.success ? t('Repaired! It works again.') : t('The repair failed and made it worse.'), res.success ? 'good' : 'bad');
  }

  private appraise() {
    const game = this.app.game;
    const uid = this.selected!;
    const res = game.workshop.appraise(uid);
    if (!res.ok) { this.app.ui.toast(t(res.reason ?? 'Not possible.'), 'bad'); return; }
    const inst = game.state.items[uid];
    this.app.audio.play('notify');
    if (inst.authentic) {
      this.app.garage.flourish();
      this.app.audio.play('sparkle');
    } else this.app.audio.play('fail');
    this.afterWork(t('Appraised: {name}, about {value}', { name: itemName(inst), value: money(res.valueAfter ?? 0) }), inst.authentic ? 'good' : 'bad');
  }

  private secret() {
    const res = this.app.game.workshop.checkSecret(this.selected!);
    if (!res.ok) return;
    if (res.revealed?.length) {
      this.app.audio.play('secret');
      this.app.ui.banner(t('SECRET COMPARTMENT!'), '', 2000);
      this.refreshScene();
      this.afterWork(t('Hidden inside: {list}', { list: res.revealed.map((r) => itemName(r)).join(', ') }), 'good');
    } else {
      this.app.audio.play('drawer');
      this.afterWork(t('You knock on every panel. Nothing hidden.'));
    }
  }

  private locksmith() {
    const res = this.app.game.workshop.locksmith(this.selected!);
    if (!res.ok) { this.app.ui.toast(t(res.reason ?? 'Not possible.'), 'bad'); return; }
    this.app.audio.play('bolt');
    this.app.audio.play('door_clank');
    const list = res.revealed ?? [];
    this.refreshScene();
    this.afterWork(list.length ? t('The safe swings open: {list}', { list: list.map((r) => (r.defId === 'cash' ? `${t('Cash')} ${money(r.soldFor ?? 0)}` : itemName(r))).join(', ') }) : t('The safe was empty. Of course it was.'), list.length ? 'good' : 'bad');
  }

  private toggleDisplay(inst: ItemInstance) {
    const game = this.app.game;
    const g = game.state.garage;
    if (inst.location === 'display') {
      const slot = g.display.indexOf(inst.uid);
      game.inventory.setDisplay(slot, null);
    } else {
      const slot = g.display.slice(0, game.inventory.displaySlots()).findIndex((x) => !x);
      if (slot < 0) return;
      game.inventory.setDisplay(slot, inst.uid);
      this.app.audio.play('sparkle', 0.5);
    }
    game.progression.checkThresholds();
    game.touch();
    this.refreshScene();
    this.render();
  }

  private buy(id: string) {
    if (!this.app.game.buyUpgrade(id)) return;
    this.app.audio.play('cash');
    this.app.ui.toast(t('Upgrade installed: {name}', { name: t(UPGRADES.find((u) => u.id === id)!.name) }), 'good');
    this.app.garage.applyCosmetics(this.app.game.state.garage);
    this.app.garage.setVan(this.app.game.state.vehicle.upgrades);
    this.refreshScene();
    this.render();
  }

  private cosmetic(id: string) {
    if (!this.app.game.applyCosmetic(id)) { this.app.audio.play('error'); return; }
    this.app.audio.play('click');
    this.app.garage.applyCosmetics(this.app.game.state.garage);
    this.render();
  }

  private questPrompt() {
    const q = QUEST_MAP.photographer;
    const app = this.app;
    app.ui.modal({
      title: t(q.name),
      sub: t(q.stages[3].title),
      body: h('div', { class: 'col' }, h('p', { class: 'note' }, t(q.stages[3].text)), q.choices.map((c) => h('div', { class: 'action-row', style: { cursor: 'default' } }, icon('book', 18), h('div', null, h('b', null, t(c.label)), h('span', { style: { display: 'block' } }, t(c.text))), h('span')))),
      actions: q.choices.map((c) => ({
        label: t(c.label),
        kind: c.id === 'return' ? 'primary' as const : undefined,
        onClick: () => {
          app.game.quests.resolve(q.id, c.id, app.game.rng);
          app.audio.play('achievement');
          app.ui.toast(t(c.text), 'achievement', 6000, 'book');
          this.refreshScene();
          this.render();
          return true;
        },
      })),
      wide: true,
    });
  }

  // ── Loop ───────────────────────────────────────────────────────────────────

  update(dt: number) {
    const g = this.app.garage;
    const input = this.app.input;
    if (this.tab === 'bench' && g.benchObject) {
      if (input.dragging) {
        g.benchSpin = 0;
        g.benchYaw += input.dx * 0.01;
        g.benchPitch = THREE.MathUtils.clamp(g.benchPitch + input.dy * 0.006, -0.9, 0.9);
      } else if (!input.down) g.benchSpin += (0.35 - g.benchSpin) * Math.min(1, dt);
    }
    if (input.click && this.tab !== 'bench') {
      const ndc = input.ndc(input.click.x, input.click.y);
      this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), g.camera);
      const hits = this.raycaster.intersectObjects([...g.clickables.keys()], true);
      if (hits.length) {
        let o: THREE.Object3D | null = hits[0].object;
        while (o && !g.clickables.has(o)) o = o.parent;
        const uid = o ? g.clickables.get(o) : undefined;
        if (uid) this.select(uid);
      }
    }
    g.update(dt);
  }

  exit() {
    this.app.garage.showOnBench(null);
  }
}
