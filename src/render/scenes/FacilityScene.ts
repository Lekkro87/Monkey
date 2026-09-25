import * as THREE from 'three';
import { RNG } from '../../core/rng';
import type { NpcId, PlacedItem, Tarp, UnitData } from '../../core/types';
import { NPC_MAP } from '../../data/npcs';
import type { FacilityDef } from '../../data/facilities';
import { ROW_SLOTS, doorNumber } from '../../systems/auctionSystem';
import { CameraRig } from '../camera';
import { Figure } from '../figure';
import { M, Materials } from '../materials';
import { buildItem } from '../models';
import { Tex, stencilNumber } from '../textures';
import { buildCar, buildVan } from '../vehicles';

/**
 * The storage facility: two facing rows of drive-up units, an asphalt aisle,
 * dusk lighting, the unit on the block (interior + items) and the crowd.
 */

export const SLOT = 3.2;
const SLOTS = ROW_SLOTS;
const DOOR_H = 2.35;
const WALL_H = 2.95;
const DEPTH = 6.4;
const AISLE = 12.5;
const INTERIOR_H = 2.4;

export type Mood = 'dusk' | 'golden' | 'night';

interface Door {
  group: THREE.Group;
  slats: THREE.Mesh[];
  width: number;
  open: number;
  target: number;
  speed: number;
  x: number;
  onDone: (() => void) | null;
}

export interface LotSlot {
  unitId: string;
  x: number;
  half: boolean;
}

export class FacilityScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.05, 400);
  readonly rig = new CameraRig(this.camera);
  readonly unitRoot = new THREE.Group();
  readonly itemObjects = new Map<string, THREE.Object3D>();
  readonly figures = new Map<NpcId | 'auctioneer', Figure>();
  readonly flashlight: THREE.SpotLight;
  readonly lots = new Map<string, LotSlot>();
  unit: UnitData | null = null;
  lotX = 0;
  tarpMeshes: THREE.Mesh[] = [];
  private rowGroup = new THREE.Group();
  private doors: Door[] = [];
  private activeDoor: Door | null = null;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private bulb: THREE.PointLight | null = null;
  private bulbMesh: THREE.Mesh | null = null;
  private wallLights: THREE.SpotLight[] = [];
  private lampMats: THREE.MeshStandardMaterial[] = [];
  private dust: THREE.Points | null = null;
  private sky: THREE.Mesh;
  private t = 0;
  private flicker = 0;
  mood: Mood = 'golden';

  constructor(readonly facility: FacilityDef, envTexture: THREE.Texture) {
    this.scene.environment = envTexture;
    this.scene.environmentIntensity = 0.35;

    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(180, 32, 16),
      new THREE.MeshBasicMaterial({ map: Tex.sky('#2b3f66', '#d98a52', '#f2b36b'), side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    this.scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight('#ffd9b0', '#3a3530', 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffc98a', 3.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    Object.assign(this.sun.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, near: 1, far: 90 });
    this.scene.add(this.sun, this.sun.target);

    this.flashlight = new THREE.SpotLight('#fff1d6', 0, 14, 0.42, 0.55, 1.6);
    this.flashlight.map = Tex.flashlightCookie();
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(1024, 1024);
    this.flashlight.shadow.bias = -0.0006;
    this.flashlight.shadow.camera.near = 0.1;
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);
    this.flashlight.position.set(0.18, -0.22, 0.05);
    this.flashlight.target.position.set(0, -0.05, -3);
    this.scene.add(this.camera);

    this.buildGround();
    this.scene.add(this.rowGroup);
    this.scene.add(this.unitRoot);
    this.buildOppositeRow();
    this.buildSurroundings();
    this.setMood('golden');
  }

  // ─── Static environment ────────────────────────────────────────────────────

  private buildGround() {
    const asphalt = Tex.asphalt();
    const mat = new THREE.MeshStandardMaterial({ map: asphalt.map.clone(), normalMap: asphalt.normalMap?.clone(), roughness: 0.9, color: '#e4e1da' });
    mat.map!.repeat.set(24, 10);
    mat.normalMap!.repeat.set(24, 10);
    mat.map!.needsUpdate = true;
    mat.normalMap!.needsUpdate = true;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 50), mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -AISLE / 2);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Painted lines and wet patches.
    const paint = Materials.get({ color: '#d9b83a', rough: 0.7 }, 1);
    for (const z of [-1.1, -AISLE + 1.1]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(SLOTS * SLOT + 4, 0.1), paint);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.004, z);
      this.scene.add(line);
    }
    const rng = new RNG(7);
    const puddle = new THREE.MeshStandardMaterial({ color: '#0d0e10', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 9; i++) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(1, 24), puddle);
      p.rotation.x = -Math.PI / 2;
      p.scale.set(rng.range(0.4, 1.6), rng.range(0.3, 0.9), 1);
      p.position.set(rng.range(-20, 20), 0.005, rng.range(-AISLE + 2, -2.5));
      this.scene.add(p);
    }
    // Soft contact line where the walls meet the ground.
    const grime = new THREE.MeshBasicMaterial({ map: Tex.blob(), transparent: true, opacity: 0.55, depthWrite: false });
    for (const z of [-0.15, -AISLE + 0.15]) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(SLOTS * SLOT + 2, 0.7), grime);
      g.rotation.x = -Math.PI / 2;
      g.position.set(0, 0.006, z);
      this.scene.add(g);
    }
  }

  private facadeMaterials() {
    const wallTex = Tex.corrugated(this.facility.wallColor, 0.5);
    const facade = new THREE.MeshStandardMaterial({ map: wallTex.map.clone(), normalMap: wallTex.normalMap?.clone(), roughness: 0.62, metalness: 0.35, color: '#ffffff' });
    facade.map!.repeat.set(SLOTS * 2, 1);
    facade.normalMap!.repeat.set(SLOTS * 2, 1);
    const block = Tex.cinderBlock('#a8a194');
    const pil = new THREE.MeshStandardMaterial({ map: block.map, normalMap: block.normalMap, roughness: 0.9 });
    const roof = Materials.get({ color: '#3b3d40', rough: 0.6, metal: 0.6 }, 1);
    return { facade, pil, roof };
  }

  /** The row of doors that faces the camera side of the aisle; rebuilt per day. */
  buildRow(lots: UnitData[], doorColor = this.facility.doorColor) {
    this.clearGroup(this.rowGroup);
    this.doors = [];
    this.lots.clear();
    this.wallLights = [];
    this.lampMats = this.lampMats.filter((m) => m.userData.static);
    const { facade, pil, roof } = this.facadeMaterials();
    const rowW = SLOTS * SLOT;
    // Header band above the doors and roof slab.
    const header = new THREE.Mesh(new THREE.BoxGeometry(rowW + 0.4, WALL_H - DOOR_H, 0.2), facade);
    header.position.set(0, DOOR_H + (WALL_H - DOOR_H) / 2, -0.1);
    header.castShadow = header.receiveShadow = true;
    this.rowGroup.add(header);
    const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(rowW + 1.2, 0.18, DEPTH + 1), roof);
    roofSlab.position.set(0, WALL_H + 0.09, DEPTH / 2 - 0.5);
    roofSlab.castShadow = roofSlab.receiveShadow = true;
    this.rowGroup.add(roofSlab);
    const gutter = new THREE.Mesh(new THREE.BoxGeometry(rowW + 1.2, 0.12, 0.14), M.steel(1));
    gutter.position.set(0, WALL_H + 0.04, -1.05);
    this.rowGroup.add(gutter);
    const back = new THREE.Mesh(new THREE.BoxGeometry(rowW + 0.4, WALL_H, 0.2), facade);
    back.position.set(0, WALL_H / 2, DEPTH);
    this.rowGroup.add(back);
    for (const x of [-rowW / 2 - 0.1, rowW / 2 + 0.1]) {
      const end = new THREE.Mesh(new THREE.BoxGeometry(0.2, WALL_H, DEPTH), facade);
      end.position.set(x, WALL_H / 2, DEPTH / 2);
      end.castShadow = true;
      this.rowGroup.add(end);
    }

    // Today's lots sit at the slots the auction system assigned.
    const rng = new RNG(lots.length ? lots[0].seed : 1);
    const lotAt = new Map<number, UnitData>();
    lots.forEach((u) => lotAt.set(u.slot, u));
    const rowLetter = lots[0]?.number.split('-')[0] ?? 'B';

    for (let i = 0; i < SLOTS; i++) {
      const cx = (i - (SLOTS - 1) / 2) * SLOT;
      const lot = lotAt.get(i);
      const half = lot ? lot.dims.w <= 1.6 : rng.chance(0.25);
      const pilW = 0.2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(pilW, DOOR_H, 0.26), pil);
      p.position.set(cx - SLOT / 2, DOOR_H / 2, -0.08);
      p.castShadow = p.receiveShadow = true;
      this.rowGroup.add(p);
      const doorDefs = half ? [cx - SLOT / 4, cx + SLOT / 4] : [cx];
      if (half) {
        const mid = new THREE.Mesh(new THREE.BoxGeometry(0.16, DOOR_H, 0.24), pil);
        mid.position.set(cx, DOOR_H / 2, -0.08);
        this.rowGroup.add(mid);
      }
      doorDefs.forEach((dx, j) => {
        const width = half ? SLOT / 2 - 0.26 : SLOT - 0.3;
        const isLot = lot && j === 0;
        const door = this.makeDoor(dx, width, isLot ? doorColor : doorColor, isLot);
        this.doors.push(door);
        const num = isLot ? lot!.number : doorNumber(rowLetter, i, half, j === 1);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.23), new THREE.MeshStandardMaterial({ map: stencilNumber(num), transparent: true, roughness: 0.8 }));
        sign.position.set(dx, DOOR_H + 0.3, -0.205);
        sign.rotation.y = Math.PI;
        this.rowGroup.add(sign);
        if (isLot) {
          this.lots.set(lot!.id, { unitId: lot!.id, x: dx, half });
          // Red auction tag on the latch.
          const tag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.005), Materials.color('#c0262d', 0.6));
          tag.position.set(width / 2 - 0.12, 0.3, -0.035);
          tag.name = 'lock';
          door.group.add(tag);
        }
      });
      // Wall-pack lights over every other slot.
      if (i % 2 === 0) {
        const lampMat = Materials.get({ color: '#222', emissive: '#ffcf8a', emissiveIntensity: 2.2, rough: 0.4 });
        this.lampMats.push(lampMat);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.18), Materials.color('#2c2e30', 0.5, 0.5));
        lamp.position.set(cx, DOOR_H + 0.46, -0.3);
        const lens = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.12), lampMat);
        lens.position.set(0, -0.075, -0.01);
        lamp.add(lens);
        this.rowGroup.add(lamp);
        const pool = new THREE.Mesh(new THREE.CircleGeometry(1.8, 24), new THREE.MeshBasicMaterial({ map: Tex.glow('#ffb870'), transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(cx, 0.008, -1.2);
        this.rowGroup.add(pool);
      }
    }
    const last = new THREE.Mesh(new THREE.BoxGeometry(0.2, DOOR_H, 0.26), pil);
    last.position.set(rowW / 2, DOOR_H / 2, -0.08);
    this.rowGroup.add(last);

    // Two real lights follow the active lot.
    for (let i = 0; i < 2; i++) {
      const s = new THREE.SpotLight('#ffcf8a', 0, 9, 0.9, 0.7, 1.5);
      this.rowGroup.add(s, s.target);
      this.wallLights.push(s);
    }
  }

  private makeDoor(x: number, width: number, color: string, animated: boolean | undefined): Door {
    const group = new THREE.Group();
    group.position.set(x, 0, -0.02);
    this.rowGroup.add(group);
    const tex = Tex.doorSlats(color, 0.6);
    const n = 20;
    const slatH = DOOR_H / n;
    const slats: THREE.Mesh[] = [];
    if (animated) {
      const mat = new THREE.MeshStandardMaterial({ map: tex.map.clone(), normalMap: tex.normalMap?.clone(), roughness: 0.62, metalness: 0.25 });
      mat.map!.repeat.set(width / 1.2, 1 / 8 * 1);
      mat.normalMap!.repeat.set(width / 1.2, 1 / 8);
      for (let i = 0; i < n; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(width, slatH - 0.004, 0.03), mat);
        s.castShadow = s.receiveShadow = true;
        s.position.y = i * slatH + slatH / 2;
        group.add(s);
        slats.push(s);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.05), M.steel(1));
      bar.position.y = 0.025;
      bar.name = 'bottomBar';
      group.add(bar);
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.03), M.brass(1));
      lock.position.set(width / 2 - 0.12, 0.18, -0.04);
      lock.name = 'lock';
      group.add(lock);
    } else {
      const mat = new THREE.MeshStandardMaterial({ map: tex.map.clone(), normalMap: tex.normalMap?.clone(), roughness: 0.62, metalness: 0.25 });
      mat.map!.repeat.set(width / 1.2, DOOR_H / 0.95);
      mat.normalMap!.repeat.set(width / 1.2, DOOR_H / 0.95);
      const plane = new THREE.Mesh(new THREE.BoxGeometry(width, DOOR_H, 0.03), mat);
      plane.position.y = DOOR_H / 2;
      plane.castShadow = plane.receiveShadow = true;
      group.add(plane);
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.03), M.brass(1));
      lock.position.set(width / 2 - 0.12, 0.18, -0.03);
      group.add(lock);
    }
    return { group, slats, width, open: 0, target: 0, speed: 0.35, x, onDone: null };
  }

  private buildOppositeRow() {
    const g = new THREE.Group();
    const { facade, pil, roof } = this.facadeMaterials();
    const rowW = SLOTS * SLOT;
    const header = new THREE.Mesh(new THREE.BoxGeometry(rowW + 0.4, WALL_H - DOOR_H, 0.2), facade);
    header.position.set(0, DOOR_H + (WALL_H - DOOR_H) / 2, 0.1);
    header.receiveShadow = true;
    g.add(header);
    const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(rowW + 1.2, 0.18, DEPTH + 1), roof);
    roofSlab.position.set(0, WALL_H + 0.09, -DEPTH / 2 + 0.5);
    roofSlab.castShadow = true;
    g.add(roofSlab);
    const tex = Tex.doorSlats(this.facility.doorColor, 0.7);
    for (let i = 0; i < SLOTS; i++) {
      const cx = (i - (SLOTS - 1) / 2) * SLOT;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, DOOR_H, 0.26), pil);
      p.position.set(cx - SLOT / 2, DOOR_H / 2, 0.08);
      g.add(p);
      const mat = new THREE.MeshStandardMaterial({ map: tex.map.clone(), normalMap: tex.normalMap?.clone(), roughness: 0.62, metalness: 0.25 });
      mat.map!.repeat.set(2.3, 2.4);
      const d = new THREE.Mesh(new THREE.BoxGeometry(SLOT - 0.3, DOOR_H, 0.03), mat);
      d.position.set(cx, DOOR_H / 2, 0.02);
      d.receiveShadow = true;
      g.add(d);
      if (i % 2 === 1) {
        const lampMat = Materials.get({ color: '#222', emissive: '#ffcf8a', emissiveIntensity: 2.2, rough: 0.4 });
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.18), lampMat);
        lamp.position.set(cx, DOOR_H + 0.46, 0.3);
        g.add(lamp);
      }
    }
    g.position.z = -AISLE;
    this.scene.add(g);
  }

  private buildSurroundings() {
    const rng = new RNG(99);
    // Treeline and hills beyond the fence.
    const treeMat = Materials.get({ color: '#1f2a1c', rough: 1 });
    const trunkMat = Materials.get({ color: '#2a2018', rough: 1 });
    for (let i = 0; i < 70; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * rng.range(26, 60);
      const z = rng.range(-40, 25);
      const h = rng.range(5, 11);
      const tree = new THREE.Mesh(new THREE.ConeGeometry(rng.range(1.6, 2.8), h, 7), treeMat);
      tree.position.set(x, h / 2 + 0.6, z);
      this.scene.add(tree);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 6), trunkMat);
      trunk.position.set(x, 0.6, z);
      this.scene.add(trunk);
    }
    const leafy = Materials.get({ color: '#2c3a24', rough: 1 });
    for (let i = 0; i < 26; i++) {
      const x = rng.range(-80, 80);
      const z = rng.range(34, 75) * (rng.chance(0.5) ? 1 : -1.2);
      const h = rng.range(6, 14);
      const tree = new THREE.Mesh(new THREE.SphereGeometry(rng.range(3, 6), 8, 6), leafy);
      tree.position.set(x, h * 0.5, z);
      this.scene.add(tree);
    }
    // Chain-link fence closing the aisle ends.
    const fenceTex = chainLinkTexture();
    const fenceMat = new THREE.MeshStandardMaterial({ map: fenceTex, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5, color: '#b8bcc0' });
    for (const x of [-(SLOTS * SLOT) / 2 - 3.5, (SLOTS * SLOT) / 2 + 3.5]) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(AISLE + 2, 2.4), fenceMat);
      f.position.set(x, 1.2, -AISLE / 2);
      f.rotation.y = Math.PI / 2;
      this.scene.add(f);
      for (let z = -AISLE - 1; z <= 1; z += 3) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 8), M.steel(1));
        post.position.set(x, 1.25, z);
        this.scene.add(post);
      }
    }
    // Light poles at the aisle ends.
    for (const x of [-(SLOTS * SLOT) / 2 - 1.8, (SLOTS * SLOT) / 2 + 1.8]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 7, 10), M.darkMetal(1));
      pole.position.set(x, 3.5, -AISLE / 2);
      pole.castShadow = true;
      this.scene.add(pole);
      const headMat = Materials.get({ color: '#222', emissive: '#ffb45a', emissiveIntensity: 3, rough: 0.4 });
      headMat.userData.static = true;
      this.lampMats.push(headMat);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.35), headMat);
      head.position.set(x + (x < 0 ? 0.35 : -0.35), 7, -AISLE / 2);
      this.scene.add(head);
      const pl = new THREE.PointLight('#ffb45a', 0, 26, 1.6);
      pl.position.set(head.position.x, 6.7, -AISLE / 2);
      pl.name = 'poleLight';
      this.scene.add(pl);
    }
    // Parked vehicles: the player's van and the rivals' cars.
    const van = buildVan();
    van.position.set(-2.5, 0, -AISLE + 3.6);
    van.rotation.y = Math.PI / 2 + 0.05;
    van.name = 'playerVan';
    this.scene.add(van);
    const cars: [string, 'sedan' | 'pickup' | 'luxury', number, number, number][] = [
      ['#1d2733', 'pickup', 7, -AISLE + 3.4, Math.PI / 2],
      ['#6b2f45', 'sedan', 12.5, -AISLE + 3.2, Math.PI / 2 - 0.08],
      ['#2b2b30', 'luxury', 17.5, -AISLE + 3.3, Math.PI / 2],
      ['#3d5a47', 'pickup', -8.5, -AISLE + 3.5, Math.PI / 2 + 0.1],
    ];
    for (const [c, kind, x, z, r] of cars) {
      const car = buildCar(c, kind);
      car.position.set(x, 0, z);
      car.rotation.y = r;
      this.scene.add(car);
    }
    // A dumpster for the day's junk.
    const dumpster = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.5), Materials.get({ color: '#1f5a3a', rough: 0.6, metal: 0.4 }, 2));
    body.position.y = 0.75;
    body.castShadow = body.receiveShadow = true;
    dumpster.add(body);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.06, 1.55), Materials.color('#1a1a1a', 0.6));
    lid.position.set(0, 1.43, 0.1);
    lid.rotation.x = -0.15;
    dumpster.add(lid);
    dumpster.position.set((SLOTS * SLOT) / 2 + 1.2, 0, -AISLE + 2.2);
    this.scene.add(dumpster);
  }

  setMood(mood: Mood) {
    this.mood = mood;
    const skyMat = this.sky.material as THREE.MeshBasicMaterial;
    if (mood === 'golden') {
      skyMat.map = Tex.sky('#4f74ad', '#eeb07c', '#ffd49c');
      this.sun.color.set('#ffcf94');
      this.sun.intensity = 3.6;
      this.hemi.color.set('#ffe2c0');
      this.hemi.groundColor.set('#6a5a4c');
      this.hemi.intensity = 1.35;
      this.scene.fog = new THREE.Fog('#e3ae80', 45, 170);
      this.setLamps(0.8);
    } else if (mood === 'dusk') {
      skyMat.map = Tex.sky('#1a2340', '#6a4a6a', '#d9784a');
      this.sun.color.set('#ff9a5a');
      this.sun.intensity = 1.3;
      this.hemi.color.set('#8a7aa0');
      this.hemi.groundColor.set('#201a1a');
      this.hemi.intensity = 0.55;
      this.scene.fog = new THREE.Fog('#4a3a4a', 28, 120);
      this.setLamps(2.2);
    } else {
      skyMat.map = Tex.sky('#070a14', '#1a1c2a', '#3a2a2a');
      this.sun.color.set('#8aa0d0');
      this.sun.intensity = 0.25;
      this.hemi.color.set('#40506a');
      this.hemi.groundColor.set('#101010');
      this.hemi.intensity = 0.3;
      this.scene.fog = new THREE.Fog('#10121a', 20, 100);
      this.setLamps(3);
    }
    skyMat.needsUpdate = true;
  }

  private setLamps(k: number) {
    for (const m of this.lampMats) m.emissiveIntensity = 2.4 * k;
    this.scene.traverse((o) => {
      if (o.name === 'poleLight') (o as THREE.PointLight).intensity = 60 * k;
    });
    for (const s of this.wallLights) s.intensity = 22 * k;
  }

  // ─── The unit on the block ─────────────────────────────────────────────────

  lotSlot(unitId: string): LotSlot | null {
    return this.lots.get(unitId) ?? null;
  }

  /** Build the interior and contents of a lot and aim the sun at it. */
  focusLot(unit: UnitData) {
    this.clearUnit();
    this.unit = unit;
    const slot = this.lots.get(unit.id);
    this.lotX = slot?.x ?? 0;
    this.activeDoor = this.doors.find((d) => Math.abs(d.x - this.lotX) < 0.01 && d.slats.length > 0) ?? null;
    if (this.activeDoor) {
      this.activeDoor.open = this.activeDoor.target = 0;
      this.layoutDoor(this.activeDoor);
    }
    this.unitRoot.position.set(this.lotX, 0, 0);
    this.buildInterior(unit);
    for (const p of unit.items) this.addPlaced(p);
    unit.tarps.forEach((t, i) => this.addTarp(t, i, unit));
    // Low sun from down the aisle: long shadows, lit asphalt, light raking into the unit.
    this.sun.position.set(this.lotX - 30, 19, -24);
    this.sun.target.position.set(this.lotX, 0, -2);
    this.wallLights.forEach((s, i) => {
      s.position.set(this.lotX + (i ? 2.2 : -2.2), DOOR_H + 0.4, -0.35);
      s.target.position.set(this.lotX + (i ? 1.6 : -1.6), 0, -1.8);
    });
    this.setLamps(this.mood === 'golden' ? 0.8 : this.mood === 'dusk' ? 2.2 : 3);
  }

  private buildInterior(unit: UnitData) {
    const { w, d } = unit.dims;
    const conc = Tex.concrete('#8a857c', 5);
    const floorMat = new THREE.MeshStandardMaterial({ map: conc.map.clone(), normalMap: conc.normalMap?.clone(), roughness: 0.95, color: '#c8c2b8' });
    floorMat.map!.repeat.set(w / 2, d / 2);
    floorMat.normalMap!.repeat.set(w / 2, d / 2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.002, d / 2);
    floor.receiveShadow = true;
    floor.name = 'unitFloor';
    this.unitRoot.add(floor);
    const wallTex = Tex.corrugated('#9da3a6', 0.7);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex.map.clone(), normalMap: wallTex.normalMap?.clone(), roughness: 0.72, metalness: 0.3, side: THREE.DoubleSide, color: '#c4c4bf' });
    wallMat.map!.repeat.set(d / 1.2, 1);
    wallMat.normalMap!.repeat.set(d / 1.2, 1);
    for (const x of [-w / 2, w / 2]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(d, INTERIOR_H), wallMat);
      wall.position.set(x, INTERIOR_H / 2, d / 2);
      wall.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      wall.receiveShadow = true;
      this.unitRoot.add(wall);
    }
    const backMat = wallMat.clone();
    backMat.map = wallTex.map.clone();
    backMat.map.repeat.set(w / 1.2, 1);
    backMat.map.needsUpdate = true;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, INTERIOR_H), backMat);
    back.position.set(0, INTERIOR_H / 2, d);
    back.rotation.y = Math.PI;
    back.receiveShadow = true;
    this.unitRoot.add(back);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), Materials.get({ color: '#2a2b2d', rough: 0.9, metal: 0.3, side: 'double' }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, INTERIOR_H, d / 2);
    this.unitRoot.add(ceil);
    // Door header inside and the roll drum.
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, w - 0.1, 16), Materials.get({ surface: 'rust' }));
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0, INTERIOR_H - 0.2, 0.2);
    this.unitRoot.add(drum);

    if (unit.event === 'flood') {
      const stain = new THREE.MeshBasicMaterial({ color: '#2a2418', transparent: true, opacity: 0.35, depthWrite: false });
      for (const x of [-w / 2 + 0.005, w / 2 - 0.005]) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(d, 0.42), stain);
        s.position.set(x, 0.21, d / 2);
        s.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
        this.unitRoot.add(s);
      }
      const water = new THREE.MeshStandardMaterial({ color: '#141a1c', roughness: 0.03, metalness: 0.2, transparent: true, opacity: 0.8 });
      const rng = new RNG(unit.seed);
      for (let i = 0; i < 4; i++) {
        const p = new THREE.Mesh(new THREE.CircleGeometry(1, 20), water);
        p.rotation.x = -Math.PI / 2;
        p.scale.set(rng.range(0.2, 0.6), rng.range(0.15, 0.4), 1);
        p.position.set(rng.range(-w / 2 + 0.3, w / 2 - 0.3), 0.004, rng.range(0.3, d - 0.3));
        this.unitRoot.add(p);
      }
    }

    // Bare bulb.
    const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 10), Materials.color('#222', 0.5));
    socket.position.set(0, INTERIOR_H - 0.06, d * 0.55);
    this.unitRoot.add(socket);
    this.bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), Materials.get({ color: '#fff', emissive: '#ffd7a0', emissiveIntensity: 3 }));
    this.bulbMesh.position.set(0, INTERIOR_H - 0.13, d * 0.55);
    this.unitRoot.add(this.bulbMesh);
    this.bulb = new THREE.PointLight('#ffcf94', 2.2, Math.max(4, d + 1), 1.8);
    this.bulb.position.copy(this.bulbMesh.position);
    this.bulb.castShadow = false;
    this.unitRoot.add(this.bulb);

    // Dust motes drifting in the air.
    const count = Math.round(260 * (w * d) / 9);
    const pos = new Float32Array(count * 3);
    const rng = new RNG(unit.seed + 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = rng.range(-w / 2, w / 2);
      pos[i * 3 + 1] = rng.range(0.1, INTERIOR_H - 0.1);
      pos[i * 3 + 2] = rng.range(-0.8, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffe8c0', size: 0.012, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, map: Tex.glow(), alphaTest: 0.01 }));
    this.dust.userData.bounds = { w, d };
    this.unitRoot.add(this.dust);
  }

  addPlaced(p: PlacedItem): THREE.Object3D {
    const obj = buildItem(p.inst, p.label);
    obj.position.set(p.pos[0], p.pos[1], p.pos[2]);
    obj.rotation.y = p.rotY;
    obj.userData.placed = p;
    this.unitRoot.add(obj);
    this.itemObjects.set(p.inst.uid, obj);
    if (p.pos[1] - p.dims[1] / 2 < 0.02) {
      const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: Tex.blob(), transparent: true, opacity: 0.6, depthWrite: false }));
      blob.rotation.x = -Math.PI / 2;
      blob.scale.set(p.dims[0] * 1.35, p.dims[2] * 1.35, 1);
      blob.position.set(p.pos[0], 0.004, p.pos[2]);
      blob.name = `blob:${p.inst.uid}`;
      this.unitRoot.add(blob);
      obj.userData.blob = blob;
    }
    return obj;
  }

  private addTarp(t: Tarp, index: number, unit: UnitData) {
    const [tw, td] = t.size;
    const margin = 0.35;
    const segX = 22;
    const segZ = 22;
    const geo = new THREE.PlaneGeometry(tw + margin * 2, td + margin * 2, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const rng = new RNG(unit.seed + index);
    const covered = unit.items.filter((p) => p.tarp === index);
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const wx = t.center[0] + lx;
      const wz = t.center[2] + lz;
      let h = 0.02;
      for (const p of covered) {
        const dx = Math.max(0, Math.abs(wx - p.pos[0]) - p.dims[0] / 2);
        const dz = Math.max(0, Math.abs(wz - p.pos[2]) - p.dims[2] / 2);
        const dist = Math.hypot(dx, dz);
        const top = p.pos[1] + p.dims[1] / 2 + 0.03;
        h = Math.max(h, top - dist * 1.6);
      }
      h += Math.sin(wx * 9 + rng.next()) * 0.012 + Math.sin(wz * 7) * 0.012;
      pos.setY(i, Math.max(0.01, h));
    }
    geo.computeVertexNormals();
    const tex = Tex.tarp(t.color);
    const mat = new THREE.MeshStandardMaterial({ map: tex.map, roughness: 0.75, side: THREE.DoubleSide, color: '#ffffff' });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(t.center[0], 0, t.center[2]);
    m.castShadow = m.receiveShadow = true;
    m.userData.tarp = index;
    this.unitRoot.add(m);
    this.tarpMeshes.push(m);
  }

  removeTarp(index: number) {
    const m = this.tarpMeshes.find((x) => x.userData.tarp === index);
    if (!m) return;
    const start = performance.now();
    const from = m.position.clone();
    const anim = () => {
      const k = Math.min(1, (performance.now() - start) / 700);
      m.position.set(from.x + k * 0.6, from.y + k * 1.6, from.z - k * 1.8);
      m.rotation.x = -k * 1.2;
      (m.material as THREE.MeshStandardMaterial).opacity = 1 - k;
      (m.material as THREE.MeshStandardMaterial).transparent = true;
      if (k < 1) requestAnimationFrame(anim);
      else {
        m.removeFromParent();
        this.tarpMeshes = this.tarpMeshes.filter((x) => x !== m);
      }
    };
    anim();
  }

  removeItemObject(uid: string) {
    const obj = this.itemObjects.get(uid);
    if (!obj) return;
    (obj.userData.blob as THREE.Object3D | undefined)?.removeFromParent();
    obj.removeFromParent();
    this.itemObjects.delete(uid);
  }

  clearUnit() {
    this.clearGroup(this.unitRoot);
    this.itemObjects.clear();
    this.tarpMeshes = [];
    this.bulb = null;
    this.dust = null;
    this.unit = null;
  }

  private clearGroup(g: THREE.Object3D) {
    for (const child of [...g.children]) {
      child.traverse((o) => {
        const mesh = o as THREE.Mesh;
        // Geometries from the model kit are cached and shared; only dispose unique ones.
        if (mesh.geometry && !mesh.geometry.userData.shared) mesh.geometry.dispose();
      });
      g.remove(child);
    }
  }

  // ─── Door ───────────────────────────────────────────────────────────────────

  openDoor(fraction: number, seconds = 1.6, onDone: (() => void) | null = null) {
    const d = this.activeDoor;
    if (!d) { onDone?.(); return; }
    d.target = fraction;
    d.speed = Math.abs(fraction - d.open) / Math.max(0.05, seconds);
    d.onDone = onDone;
  }

  get doorOpen(): number {
    return this.activeDoor?.open ?? 1;
  }

  private layoutDoor(d: Door) {
    const n = d.slats.length;
    const slatH = DOOR_H / n;
    const lift = d.open * DOOR_H;
    for (let i = 0; i < n; i++) {
      const y = i * slatH + slatH / 2 + lift;
      d.slats[i].position.y = y;
      d.slats[i].visible = y < DOOR_H - slatH * 0.3;
    }
    const bar = d.group.getObjectByName('bottomBar');
    if (bar) bar.position.y = 0.025 + lift;
    const lock = d.group.getObjectByName('lock');
    if (lock) lock.visible = d.open < 0.02;
  }

  // ─── Crowd ─────────────────────────────────────────────────────────────────

  ensureFigures(attendees: NpcId[]) {
    for (const [id, f] of this.figures) {
      if (id !== 'auctioneer' && !attendees.includes(id as NpcId)) {
        f.root.removeFromParent();
        this.figures.delete(id);
      }
    }
    for (const id of attendees) {
      if (this.figures.has(id)) continue;
      const npc = NPC_MAP[id];
      const f = new Figure(npc.look, npc.paddle);
      this.scene.add(f.root);
      this.figures.set(id, f);
    }
    if (!this.figures.has('auctioneer')) {
      const f = new Figure({ skin: '#d9a883', shirt: '#2f4a6a', pants: '#3a3228', hair: '#6a6a6a', hat: 'cap', hatColor: '#a4231b', extra: 'clipboard', build: 1.2, height: 1.8 }, null);
      this.scene.add(f.root);
      this.figures.set('auctioneer', f);
    }
  }

  /** Where everyone stands in front of the current door. */
  crowdSpots(count: number): THREE.Vector3[] {
    const spots: THREE.Vector3[] = [];
    const radius = 2.6;
    for (let i = 0; i < count; i++) {
      const a = -0.95 + (i / Math.max(1, count - 1)) * 1.9;
      spots.push(new THREE.Vector3(this.lotX + Math.sin(a) * radius * 1.15, 0, -1.6 - Math.cos(a) * radius * 0.55 - (i % 2) * 0.35));
    }
    return spots;
  }

  placeCrowd(attendees: NpcId[], instant = false) {
    const spots = this.crowdSpots(attendees.length);
    attendees.forEach((id, i) => {
      const f = this.figures.get(id);
      if (!f) return;
      f.out = false;
      const spot = spots[i];
      const yaw = Math.atan2(-(this.lotX - spot.x), -(1.2 - spot.z));
      if (instant) {
        f.root.position.copy(spot);
        f.face(yaw);
      } else {
        f.walkTo(spot, yaw);
      }
      f.lookAt(new THREE.Vector3(this.lotX, 1.1, 1.5));
    });
    const a = this.figures.get('auctioneer');
    if (a) {
      const spot = new THREE.Vector3(this.lotX - (this.activeDoor?.width ?? 2.7) / 2 - 0.75, 0, -0.75);
      const yaw = yawTo(spot, new THREE.Vector3(this.lotX + 0.4, 0, -2.6));
      if (instant) {
        a.root.position.copy(spot);
        a.face(yaw);
      } else a.walkTo(spot, yaw);
      a.lookAt(new THREE.Vector3(this.lotX, 1.5, -2.4));
    }
  }

  // ─── Loop ───────────────────────────────────────────────────────────────────

  update(dt: number) {
    this.t += dt;
    const d = this.activeDoor;
    if (d && Math.abs(d.open - d.target) > 1e-4) {
      const step = d.speed * dt;
      d.open = d.open < d.target ? Math.min(d.target, d.open + step) : Math.max(d.target, d.open - step);
      this.layoutDoor(d);
      if (Math.abs(d.open - d.target) <= 1e-4 && d.onDone) {
        const cb = d.onDone;
        d.onDone = null;
        cb();
      }
    }
    for (const f of this.figures.values()) f.update(dt);
    // Flickering bulb.
    if (this.bulb && this.bulbMesh) {
      this.flicker -= dt;
      let k = 1;
      if (this.flicker < 0) {
        if (Math.random() < 0.02) this.flicker = 0.12;
      } else k = Math.random() < 0.5 ? 0.2 : 1;
      this.bulb.intensity = 2.2 * k * (0.96 + Math.sin(this.t * 60) * 0.04);
      (this.bulbMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 3 * k;
    }
    if (this.dust) {
      const pos = this.dust.geometry.attributes.position as THREE.BufferAttribute;
      const { w } = this.dust.userData.bounds as { w: number };
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + Math.sin(this.t * 0.3 + i) * 0.0006 - 0.0002;
        let x = pos.getX(i) + Math.cos(this.t * 0.2 + i * 1.3) * 0.0005;
        if (y < 0.05) y = INTERIOR_H - 0.1;
        if (x < -w / 2) x = w / 2;
        if (x > w / 2) x = -w / 2;
        pos.setXYZ(i, x, y, pos.getZ(i));
      }
      pos.needsUpdate = true;
    }
    this.rig.update(dt);
  }

  // ─── Camera poses ──────────────────────────────────────────────────────────

  doorwayEye(lean = 0, crouch = false): THREE.Vector3 {
    return new THREE.Vector3(this.lotX + lean, crouch ? 1.05 : 1.62, -0.7);
  }

  establishingShot(): { pos: THREE.Vector3; look: THREE.Vector3 } {
    // Shoot from the row's centre side so the end-of-aisle light poles stay out of frame.
    const side = this.lotX < 0 ? 1 : -1;
    return { pos: new THREE.Vector3(this.lotX + side * 6.5, 3.1, -9.8), look: new THREE.Vector3(this.lotX - side * 0.6, 1.15, 0.3) };
  }

  crowdShot(): { pos: THREE.Vector3; look: THREE.Vector3 } {
    return { pos: new THREE.Vector3(this.lotX + 3.8, 2.35, -6.2), look: new THREE.Vector3(this.lotX - 0.4, 1.25, 0.2) };
  }
}

export function yawTo(from: THREE.Vector3, to: THREE.Vector3): number {
  return Math.atan2(-(to.x - from.x), -(to.z - from.z));
}

function chainLinkTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(210,214,218,1)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, 32); ctx.lineTo(32, 0); ctx.lineTo(64, 32); ctx.lineTo(32, 64); ctx.closePath();
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(60, 11);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
