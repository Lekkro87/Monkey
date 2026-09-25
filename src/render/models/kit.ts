import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RNG } from '../../core/rng';
import type { DirtLevel } from '../materials';

/**
 * Modelling kit for procedural item models. Builders work in "bottom-based"
 * coordinates (y = 0 is the floor under the item) and the kit re-centres the
 * finished model on its bounding box so it matches the simulation's AABB.
 */

const geoCache = new Map<string, THREE.BufferGeometry>();
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Cached geometries are shared between many meshes and must never be disposed. */
function cachedGeo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    g.userData.shared = true;
    geoCache.set(key, g);
  }
  return g;
}

export function boxGeo(w: number, h: number, d: number): THREE.BufferGeometry {
  return cachedGeo(`b:${r3(w)}:${r3(h)}:${r3(d)}`, () => new THREE.BoxGeometry(w, h, d));
}

export function rboxGeo(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  return cachedGeo(`rb:${r3(w)}:${r3(h)}:${r3(d)}:${r3(rr)}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.max(0.001, rr)));
}

export function cylGeo(rt: number, rb: number, h: number, seg = 16, open = false): THREE.BufferGeometry {
  return cachedGeo(`c:${r3(rt)}:${r3(rb)}:${r3(h)}:${seg}:${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
}

export function sphereGeo(r: number, seg = 16): THREE.BufferGeometry {
  return cachedGeo(`s:${r3(r)}:${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7))));
}

export function torusGeo(r: number, tube: number, seg = 24, arc = Math.PI * 2): THREE.BufferGeometry {
  return cachedGeo(`t:${r3(r)}:${r3(tube)}:${seg}:${r3(arc)}`, () => new THREE.TorusGeometry(r, tube, 8, seg, arc));
}

export function planeGeo(w: number, h: number): THREE.BufferGeometry {
  return cachedGeo(`p:${r3(w)}:${r3(h)}`, () => new THREE.PlaneGeometry(w, h));
}

export type Axis = 'x' | 'y' | 'z';

export interface Parts {
  lid?: THREE.Object3D;
  flaps?: THREE.Object3D[];
  drawers?: THREE.Object3D[];
  door?: THREE.Object3D;
  glint?: THREE.Vector3;
}

export class Kit {
  readonly root = new THREE.Group();
  readonly parts: Parts = {};
  readonly rng: RNG;

  constructor(
    readonly w: number,
    readonly h: number,
    readonly d: number,
    readonly p: Record<string, string | number | boolean>,
    readonly dirt: DirtLevel,
    seed: number,
    readonly detail = 1,
  ) {
    this.rng = new RNG(seed);
  }

  private add(mesh: THREE.Mesh, parent?: THREE.Object3D): THREE.Mesh {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    (parent ?? this.root).add(mesh);
    return mesh;
  }

  box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = h / 2, z = 0, parent?: THREE.Object3D): THREE.Mesh {
    const m = new THREE.Mesh(boxGeo(w, h, d), mat);
    m.position.set(x, y, z);
    return this.add(m, parent);
  }

  rbox(w: number, h: number, d: number, r: number, mat: THREE.Material, x = 0, y = h / 2, z = 0, parent?: THREE.Object3D): THREE.Mesh {
    const m = new THREE.Mesh(rboxGeo(w, h, d, r), mat);
    m.position.set(x, y, z);
    return this.add(m, parent);
  }

  cyl(rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = h / 2, z = 0, axis: Axis = 'y', seg = 16, parent?: THREE.Object3D, open = false): THREE.Mesh {
    const m = new THREE.Mesh(cylGeo(rt, rb, h, seg, open), mat);
    m.position.set(x, y, z);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    return this.add(m, parent);
  }

  sphere(r: number, mat: THREE.Material, x = 0, y = r, z = 0, seg = 16, parent?: THREE.Object3D): THREE.Mesh {
    const m = new THREE.Mesh(sphereGeo(r, seg), mat);
    m.position.set(x, y, z);
    return this.add(m, parent);
  }

  torus(r: number, tube: number, mat: THREE.Material, x = 0, y = 0, z = 0, axis: Axis = 'y', arc = Math.PI * 2, parent?: THREE.Object3D): THREE.Mesh {
    const m = new THREE.Mesh(torusGeo(r, tube, 24, arc), mat);
    m.position.set(x, y, z);
    if (axis === 'y') m.rotation.x = Math.PI / 2;
    if (axis === 'x') m.rotation.y = Math.PI / 2;
    return this.add(m, parent);
  }

  /** Flat decal facing -z (towards the door when the item is unrotated). */
  decal(w: number, h: number, mat: THREE.Material, x: number, y: number, z: number, rotY = Math.PI, parent?: THREE.Object3D): THREE.Mesh {
    const m = new THREE.Mesh(planeGeo(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.castShadow = false;
    m.receiveShadow = true;
    (parent ?? this.root).add(m);
    return m;
  }

  /** A cylinder between two points (tubes, legs, frames). */
  tube(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, parent?: THREE.Object3D, seg = 8): THREE.Mesh {
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(cylGeo(r, r, len, seg), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return this.add(m, parent);
  }

  lathe(points: [number, number][], mat: THREE.Material, x = 0, y = 0, z = 0, seg = 24, parent?: THREE.Object3D): THREE.Mesh {
    const g = new THREE.LatheGeometry(points.map(([px, py]) => new THREE.Vector2(px, py)), seg);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    return this.add(m, parent);
  }

  extrude(shape: THREE.Shape, depth: number, mat: THREE.Material, bevel = 0.01, parent?: THREE.Object3D): THREE.Mesh {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 16 });
    const m = new THREE.Mesh(g, mat);
    return this.add(m, parent);
  }

  /** A pivot group, e.g. a lid hinged along its back edge. */
  pivot(x: number, y: number, z: number, parent?: THREE.Object3D): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    (parent ?? this.root).add(g);
    return g;
  }

  /** Finish: centre on the bounding box the simulation uses. */
  finish(): THREE.Group {
    const outer = new THREE.Group();
    this.root.position.y = -this.h / 2;
    outer.add(this.root);
    outer.userData.parts = this.parts;
    return outer;
  }
}
