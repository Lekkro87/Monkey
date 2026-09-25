import * as THREE from 'three';
import type { GarageState, ItemInstance } from '../../core/types';
import { itemDef } from '../../data/items';
import { COSMETICS } from '../../data/progression';
import { CameraRig } from '../camera';
import { M, Materials } from '../materials';
import { buildItem } from '../models';
import { Tex, makeCanvas, FONT_STENCIL } from '../textures';
import { buildVan } from '../vehicles';

const W = 6.4;
const D = 7.2;
const H = 3;

export type GarageView = 'overview' | 'bench' | 'display' | 'shelves' | 'van' | 'desk';

/**
 * The player's garage: shelves full of stock, the workbench with a turntable,
 * a display case for trophies, a computer for online sales, the van outside.
 */
export class GarageScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.05, 200);
  readonly rig = new CameraRig(this.camera);
  private wallMat: THREE.MeshStandardMaterial;
  private floorMat: THREE.MeshStandardMaterial;
  private lights: THREE.PointLight[] = [];
  private tubeMat: THREE.MeshStandardMaterial;
  private neon: THREE.Mesh | null = null;
  private stockGroup = new THREE.Group();
  private displayGroup = new THREE.Group();
  private benchGroup = new THREE.Group();
  private shelvesGroup = new THREE.Group();
  private van: THREE.Group | null = null;
  benchObject: THREE.Object3D | null = null;
  private benchUid: string | null = null;
  private benchRadius = 0.3;
  private currentView: GarageView = 'overview';
  benchSpin = 0.35;
  benchYaw = 0;
  benchPitch = 0.2;
  readonly benchPos = new THREE.Vector3(0.9, 1.02, D - 0.62);
  private benchLight: THREE.SpotLight;
  private t = 0;
  private sparkle: THREE.Sprite;
  sparkleT = 0;
  private displaySlots: THREE.Vector3[] = [];
  readonly clickables = new Map<THREE.Object3D, string>();

  constructor(envTexture: THREE.Texture) {
    this.scene.environment = envTexture;
    this.scene.environmentIntensity = 0.3;
    this.scene.background = new THREE.Color('#15171a');
    this.scene.fog = new THREE.Fog('#15171a', 12, 40);

    this.wallMat = new THREE.MeshStandardMaterial({ color: '#8d8a84', roughness: 0.92 });
    const block = Tex.cinderBlock('#b8b2a6');
    this.wallMat.map = block.map.clone();
    this.wallMat.normalMap = block.normalMap?.clone() ?? null;
    this.wallMat.map.repeat.set(3, 1.4);
    this.wallMat.normalMap?.repeat.set(3, 1.4);
    const conc = Tex.concrete('#8a857c', 9);
    this.floorMat = new THREE.MeshStandardMaterial({ map: conc.map.clone(), normalMap: conc.normalMap?.clone(), roughness: 0.8, color: '#d8d2c8' });
    this.floorMat.map!.repeat.set(3, 3);
    this.floorMat.normalMap!.repeat.set(3, 3);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, D / 2);
    floor.receiveShadow = true;
    this.scene.add(floor);
    const walls: [number, number, number, number, number][] = [
      [W, H, 0, H / 2, D],
      [D, H, -W / 2, H / 2, D / 2],
      [D, H, W / 2, H / 2, D / 2],
    ];
    walls.forEach(([w, hgt, x, y, z], i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), this.wallMat);
      m.position.set(x, y, z);
      m.rotation.y = i === 0 ? Math.PI : i === 1 ? Math.PI / 2 : -Math.PI / 2;
      m.receiveShadow = true;
      this.scene.add(m);
    });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), Materials.get({ color: '#26282b', rough: 0.9, side: 'double' }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, H, D / 2);
    this.scene.add(ceil);
    // Front wall with the open garage door.
    const frontMat = this.wallMat;
    for (const x of [-W / 2 + 0.35, W / 2 - 0.35]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, H, 0.2), frontMat);
      p.position.set(x, H / 2, -0.1);
      this.scene.add(p);
    }
    const header = new THREE.Mesh(new THREE.BoxGeometry(W, 0.6, 0.2), frontMat);
    header.position.set(0, H - 0.3, -0.1);
    this.scene.add(header);
    const doorTex = Tex.doorSlats('#d8d2c2', 0.4);
    const doorMat = new THREE.MeshStandardMaterial({ map: doorTex.map.clone(), normalMap: doorTex.normalMap?.clone(), roughness: 0.6, metalness: 0.3 });
    doorMat.map!.repeat.set(3, 1);
    const door = new THREE.Mesh(new THREE.BoxGeometry(W - 1.4, 0.7, 0.05), doorMat);
    door.position.set(0, H - 0.95, 0.1);
    this.scene.add(door);
    // Driveway outside + evening sky glow.
    const drive = new THREE.Mesh(new THREE.PlaneGeometry(30, 16), new THREE.MeshStandardMaterial({ map: Tex.asphalt().map, color: '#6a6a6a', roughness: 0.95 }));
    drive.rotation.x = -Math.PI / 2;
    drive.position.set(0, -0.01, -8);
    drive.receiveShadow = true;
    this.scene.add(drive);
    const skyGlow = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), new THREE.MeshBasicMaterial({ map: Tex.sky('#223355', '#c9825a', '#f2b070'), fog: false }));
    skyGlow.position.set(0, 5, -16);
    this.scene.add(skyGlow);
    const sunset = new THREE.DirectionalLight('#ffb070', 1.4);
    sunset.position.set(-6, 5, -12);
    sunset.target.position.set(0, 0, 3);
    sunset.castShadow = true;
    sunset.shadow.mapSize.set(1024, 1024);
    Object.assign(sunset.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
    this.scene.add(sunset, sunset.target, new THREE.HemisphereLight('#c8d0e0', '#2a2622', 0.55));

    // Ceiling fixtures.
    this.tubeMat = Materials.get({ color: '#fff', emissive: '#ffd9a0', emissiveIntensity: 2.5, rough: 0.3 }) as THREE.MeshStandardMaterial;
    for (const z of [2.2, 5.2]) {
      const tube = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.12), this.tubeMat);
      tube.position.set(0, H - 0.08, z);
      this.scene.add(tube);
      const l = new THREE.PointLight('#ffd9a0', 9, 9, 1.6);
      l.position.set(0, H - 0.3, z);
      l.castShadow = z > 4;
      l.shadow.mapSize.set(512, 512);
      this.scene.add(l);
      this.lights.push(l);
    }

    this.buildWorkbench();
    this.buildDisplayCase();
    this.buildComputer();
    this.scene.add(this.stockGroup, this.displayGroup, this.benchGroup, this.shelvesGroup);
    this.benchLight = new THREE.SpotLight('#fff4e0', 26, 4, 0.5, 0.6, 1.4);
    this.benchLight.position.set(this.benchPos.x - 0.1, 2.1, this.benchPos.z - 0.25);
    this.benchLight.target.position.copy(this.benchPos);
    this.benchLight.castShadow = true;
    this.benchLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.benchLight, this.benchLight.target);
    this.sparkle = new THREE.Sprite(new THREE.SpriteMaterial({ map: Tex.sparkle(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    this.sparkle.scale.setScalar(0.35);
    this.scene.add(this.sparkle);
    this.setShelves(1);
    this.setVan([]);
    this.view('overview', 0);
  }

  private buildWorkbench() {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.07, 0.8), M.wood('oak', 1));
    top.position.set(0.9, 0.93, D - 0.5);
    top.castShadow = top.receiveShadow = true;
    g.add(top);
    for (const x of [-0.25, 2.05]) for (const z of [D - 0.82, D - 0.18]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.07), M.darkMetal(1));
      leg.position.set(x, 0.45, z);
      g.add(leg);
    }
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.04, 0.6), M.wood('plywood', 1));
    shelf.position.set(0.9, 0.25, D - 0.5);
    g.add(shelf);
    // Pegboard with tool silhouettes.
    const peg = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.1), new THREE.MeshStandardMaterial({ map: pegboardTexture(), roughness: 0.9 }));
    peg.position.set(0.9, 1.75, D - 0.02);
    peg.rotation.y = Math.PI;
    g.add(peg);
    // Turntable.
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.05, 32), M.darkMetal(0));
    disk.position.set(this.benchPos.x, 0.985, this.benchPos.z);
    disk.receiveShadow = true;
    g.add(disk);
    // Desk lamp.
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.03, 16), M.darkMetal(0));
    lampBase.position.set(0.1, 0.98, D - 0.3);
    g.add(lampBase);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.8, 8), M.darkMetal(0));
    arm.position.set(0.1, 1.38, D - 0.3);
    g.add(arm);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.16, 16, 1, true), Materials.get({ color: '#1f5a3a', rough: 0.5, side: 'double' }));
    shade.position.set(0.25, 1.78, D - 0.45);
    shade.rotation.z = -0.8;
    g.add(shade);
    this.scene.add(g);
  }

  private buildDisplayCase() {
    const g = new THREE.Group();
    const x = W / 2 - 0.45;
    const z = D - 2.4;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 1.6), M.wood('walnut', 0));
    base.position.set(x, 0.4, z);
    base.castShadow = base.receiveShadow = true;
    g.add(base);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.2, 1.56), Materials.get({ color: '#cfe6ee', rough: 0.02, metal: 0.1, opacity: 0.16 }));
    glass.position.set(x, 1.4, z);
    g.add(glass);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 1.62), M.wood('walnut', 0));
    cap.position.set(x, 2.03, z);
    g.add(cap);
    for (const y of [0.82, 1.4]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.015, 1.52), Materials.get({ color: '#dff0f5', rough: 0.02, opacity: 0.25 }));
      s.position.set(x, y, z);
      g.add(s);
    }
    const l = new THREE.PointLight('#fff2d0', 2.5, 2.2, 1.6);
    l.position.set(x, 1.95, z);
    g.add(l);
    this.displaySlots = [];
    for (const y of [0.83, 1.41]) for (const dz of [-0.5, 0, 0.5]) this.displaySlots.push(new THREE.Vector3(x, y, z + dz));
    this.scene.add(g);
  }

  private buildComputer() {
    const g = new THREE.Group();
    const x = W / 2 - 0.55;
    const z = D - 0.55;
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.7), M.wood('teak', 1));
    desk.position.set(x, 0.76, z);
    desk.castShadow = desk.receiveShadow = true;
    g.add(desk);
    for (const dx of [-0.45, 0.45]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.76, 0.6), M.darkMetal(1));
      leg.position.set(x + dx, 0.38, z);
      g.add(leg);
    }
    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.38, 0.4), M.plastic('#d9d0b8', 1));
    mon.position.set(x, 1.0, z + 0.05);
    g.add(mon);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.27), new THREE.MeshBasicMaterial({ map: screenTexture() }));
    screen.position.set(x, 1.01, z - 0.152);
    screen.rotation.y = Math.PI;
    g.add(screen);
    const glow = new THREE.PointLight('#7fd0ff', 0.8, 1.5, 2);
    glow.position.set(x, 1.0, z - 0.4);
    g.add(glow);
    this.scene.add(g);
  }

  setShelves(units: number) {
    this.shelvesGroup.clear();
    for (let u = 0; u < units; u++) {
      const z0 = 1.2 + u * 1.9;
      for (const y of [0.08, 0.62, 1.16, 1.7]) {
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 1.8), M.steel(1));
        board.position.set(-W / 2 + 0.3, y, z0 + 0.9);
        board.castShadow = board.receiveShadow = true;
        this.shelvesGroup.add(board);
      }
      for (const dz of [0, 1.8]) for (const dx of [0.02, 0.56]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.0, 0.03), M.steel(1));
        post.position.set(-W / 2 + dx, 1.0, z0 + dz);
        this.shelvesGroup.add(post);
      }
    }
  }

  applyCosmetics(g: GarageState) {
    const wall = COSMETICS.find((c) => c.id === g.wall);
    const floor = COSMETICS.find((c) => c.id === g.floor);
    const light = COSMETICS.find((c) => c.id === g.light);
    const neon = COSMETICS.find((c) => c.id === g.neon);
    this.wallMat.color.set(wall?.value ?? '#8d8a84').multiplyScalar(1.25);
    if (floor?.value === 'checker') {
      this.floorMat.map = checkerTexture();
      this.floorMat.roughness = 0.45;
    } else if (floor?.value === 'epoxy') {
      this.floorMat.map = Tex.concrete('#7a7f86', 12).map.clone();
      this.floorMat.map.repeat.set(2, 2);
      this.floorMat.roughness = 0.25;
    } else {
      this.floorMat.map = Tex.concrete('#8a857c', 9).map.clone();
      this.floorMat.map.repeat.set(3, 3);
      this.floorMat.roughness = 0.8;
    }
    this.floorMat.needsUpdate = true;
    const lc = light?.value ?? '#ffd9a0';
    for (const l of this.lights) l.color.set(lc);
    this.tubeMat.emissive.set(lc);
    this.neon?.removeFromParent();
    this.neon = null;
    if (neon && neon.value) {
      const [text, color] = neon.value.split('#');
      const tex = neonTexture(text, `#${color}`);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
      m.position.set(-0.6, 2.45, D - 0.03);
      m.rotation.y = Math.PI;
      this.scene.add(m);
      this.neon = m;
      const nl = new THREE.PointLight(`#${color}`, 3, 3, 1.8);
      nl.position.set(-0.6, 2.3, D - 0.3);
      m.add(nl);
      nl.position.set(0, -0.1, 0.3);
    }
    this.setShelves(1 + (g.upgrades.includes('shelving') ? 1 : 0) + (g.upgrades.includes('double_garage') ? 1 : 0));
  }

  setVan(upgrades: string[]) {
    this.van?.removeFromParent();
    this.van = buildVan('#e8e1d0', upgrades.includes('roof_rack'));
    this.van.position.set(1.2, 0, -4.2);
    this.van.rotation.y = Math.PI / 2 - 0.25;
    this.scene.add(this.van);
  }

  /** Show owned stock on the shelves and the floor. */
  setStock(items: ItemInstance[]) {
    this.stockGroup.clear();
    this.clickables.clear();
    const shelfSpots: THREE.Vector3[] = [];
    const units = Math.max(1, Math.round(this.shelvesGroup.children.length / 8));
    for (let u = 0; u < units; u++) for (const y of [0.095, 0.635, 1.175, 1.715]) for (let k = 0; k < 4; k++) shelfSpots.push(new THREE.Vector3(-W / 2 + 0.3, y, 1.2 + u * 1.9 + 0.22 + k * 0.45));
    const floorSpots: THREE.Vector3[] = [];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) floorSpots.push(new THREE.Vector3(-1.9 + col * 0.95, 0, 1.3 + row * 1.3));
    const sorted = [...items].sort((a, b) => itemDef(a.defId).dims[1] - itemDef(b.defId).dims[1]);
    for (const it of sorted) {
      const def = itemDef(it.defId);
      const [w, hgt, d] = def.dims;
      const fitsShelf = hgt < 0.5 && Math.min(w, d) < 0.52 && Math.max(w, d) < 0.9;
      const spot = fitsShelf ? shelfSpots.shift() : floorSpots.shift();
      if (!spot) continue;
      const obj = buildItem(it);
      obj.position.set(spot.x, spot.y + hgt / 2, spot.z);
      if (fitsShelf) obj.rotation.y = w > d ? Math.PI / 2 : 0;
      else obj.rotation.y = Math.PI + (Math.random() - 0.5) * 0.3;
      obj.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
      this.stockGroup.add(obj);
      this.clickables.set(obj, it.uid);
    }
  }

  setDisplay(items: (ItemInstance | null)[]) {
    this.displayGroup.clear();
    items.slice(0, this.displaySlots.length).forEach((it, i) => {
      if (!it) return;
      const def = itemDef(it.defId);
      const obj = buildItem(it);
      const s = Math.min(1, 0.42 / Math.max(...def.dims));
      obj.scale.setScalar(s);
      const p = this.displaySlots[i];
      obj.position.set(p.x, p.y + (def.dims[1] * s) / 2 + 0.01, p.z);
      obj.rotation.y = -Math.PI / 2;
      this.displayGroup.add(obj);
      this.clickables.set(obj, it.uid);
    });
  }

  showOnBench(inst: ItemInstance | null) {
    this.benchGroup.clear();
    this.benchObject = null;
    const same = !!inst && inst.uid === this.benchUid;
    this.benchUid = inst?.uid ?? null;
    if (!inst) return;
    const def = itemDef(inst.defId);
    const obj = buildItem(inst);
    const maxDim = Math.max(...def.dims);
    const s = maxDim > 0.9 ? 0.9 / maxDim : maxDim < 0.12 ? 0.16 / maxDim : 1;
    obj.scale.setScalar(s);
    const holder = new THREE.Group();
    holder.position.set(this.benchPos.x, 1.01 + (def.dims[1] * s) / 2, this.benchPos.z);
    holder.add(obj);
    this.benchGroup.add(holder);
    this.benchObject = holder;
    this.benchRadius = 0.5 * Math.hypot(def.dims[0], def.dims[1], def.dims[2]) * s;
    if (!same) {
      this.benchYaw = Math.PI - 0.5;
      if (this.currentView === 'bench') this.view('bench', 0.6);
    }
  }

  /** Frames the bench item by its size, leaving room for the work panel on the right. */
  private benchPose(): [THREE.Vector3, THREE.Vector3, number] {
    const fov = 40;
    const center = this.benchObject ? this.benchObject.position.clone() : new THREE.Vector3(this.benchPos.x, 1.25, this.benchPos.z);
    const r = Math.max(0.14, this.benchRadius);
    const dist = Math.max(0.5, (r / Math.sin(THREE.MathUtils.degToRad(fov / 2))) * 1.08);
    const pos = center.clone().addScaledVector(new THREE.Vector3(0.07, 0.32, -0.95).normalize(), dist);
    const look = center.clone();
    const aspect = this.camera.aspect;
    if (aspect > 1.2) {
      // Looking along +z the camera's right is -x: shift the whole view so the item sits left of the panel.
      const shift = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * dist * aspect * 0.34;
      pos.x -= shift;
      look.x -= shift;
    }
    return [pos, look, fov];
  }

  /** Sparkle burst on the bench item (cleaning, repair, identification). */
  flourish() {
    this.sparkleT = 1.2;
  }

  view(v: GarageView, dur = 1.1) {
    this.currentView = v;
    const poses: Record<GarageView, [THREE.Vector3, THREE.Vector3, number]> = {
      overview: [new THREE.Vector3(1.6, 1.75, 0.35), new THREE.Vector3(-0.6, 0.9, D - 1.5), 60],
      bench: this.benchPose(),
      display: [new THREE.Vector3(0.6, 1.6, D - 3.6), new THREE.Vector3(W / 2 - 0.45, 1.25, D - 2.4), 48],
      shelves: [new THREE.Vector3(0.6, 1.5, 2.6), new THREE.Vector3(-W / 2 + 0.3, 0.9, 2.6), 58],
      van: [new THREE.Vector3(-1.5, 1.7, 2.5), new THREE.Vector3(1.2, 1.0, -4.2), 50],
      desk: [new THREE.Vector3(-0.2, 1.55, D - 2.6), new THREE.Vector3(W / 2 - 0.9, 0.95, D - 0.6), 50],
    };
    const [pos, look, fov] = poses[v];
    if (dur <= 0) this.rig.set(pos, look, fov);
    else this.rig.goTo(pos, look, dur, fov);
  }

  update(dt: number) {
    this.t += dt;
    if (this.benchObject) {
      this.benchYaw += this.benchSpin * dt;
      this.benchObject.rotation.set(this.benchPitch * 0.4, this.benchYaw, 0);
    }
    if (this.sparkleT > 0) {
      this.sparkleT -= dt;
      this.sparkle.position.set(this.benchPos.x + Math.sin(this.t * 7) * 0.15, 1.25 + Math.sin(this.t * 3) * 0.1, this.benchPos.z - 0.2);
      (this.sparkle.material as THREE.SpriteMaterial).opacity = Math.max(0, this.sparkleT);
      this.sparkle.material.rotation += dt * 3;
    } else (this.sparkle.material as THREE.SpriteMaterial).opacity = 0;
    this.rig.update(dt);
  }
}

function pegboardTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 256);
  ctx.fillStyle = '#8a6a48';
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = 'rgba(40,28,18,0.8)';
  for (let y = 8; y < 256; y += 16) for (let x = 8; x < 512; x += 16) {
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#2a2d31';
  ctx.fillRect(40, 40, 16, 120);
  ctx.fillRect(28, 40, 40, 22);
  ctx.fillRect(110, 50, 10, 130);
  ctx.beginPath();
  ctx.arc(115, 50, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b3261e';
  ctx.fillRect(170, 60, 14, 90);
  ctx.fillStyle = '#e8b020';
  ctx.fillRect(230, 70, 70, 40);
  ctx.fillStyle = '#2a2d31';
  for (let i = 0; i < 6; i++) ctx.fillRect(330 + i * 22, 50, 8, 60 + i * 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function screenTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 192);
  ctx.fillStyle = '#0d2233';
  ctx.fillRect(0, 0, 256, 192);
  ctx.fillStyle = '#f5b300';
  ctx.fillRect(0, 0, 256, 24);
  ctx.fillStyle = '#111';
  ctx.font = '700 16px sans-serif';
  ctx.fillText('SwapBay', 8, 18);
  ctx.fillStyle = '#7fd0ff';
  for (let i = 0; i < 5; i++) ctx.fillRect(12, 40 + i * 28, 60, 20);
  ctx.fillStyle = '#e8f0f8';
  for (let i = 0; i < 5; i++) ctx.fillRect(84, 44 + i * 28, 120 - i * 10, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function checkerTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    ctx.fillStyle = (x + y) % 2 ? '#1c1c1e' : '#e8e4dc';
    ctx.fillRect(x * 32, y * 32, 32, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function neonTexture(text: string, color: string): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 128);
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = `900 84px ${FONT_STENCIL}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 68);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.7;
  ctx.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
