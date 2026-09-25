import * as THREE from 'three';
import { M, Materials } from './materials';
import { cylGeo, rboxGeo, boxGeo } from './models/kit';
import { labelTexture } from './art';

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function wheel(parent: THREE.Object3D, x: number, z: number, r = 0.34) {
  const t = add(parent, cylGeo(r, r, 0.22, 18), M.rubber(1), x, r, z);
  t.rotation.z = Math.PI / 2;
  const hub = add(parent, cylGeo(r * 0.55, r * 0.55, 0.23, 14), M.steel(1), x, r, z);
  hub.rotation.z = Math.PI / 2;
}

/** The player's old van. Front faces -z. */
export function buildVan(color = '#e8e1d0', withRack = false): THREE.Group {
  const g = new THREE.Group();
  const paint = Materials.get({ color, rough: 0.45, metal: 0.25 }, 1);
  const glass = Materials.get({ color: '#1f2a30', rough: 0.08, metal: 0.6 });
  add(g, rboxGeo(1.95, 1.75, 3.6, 0.12), paint, 0, 0.35 + 0.87, 0.55);
  add(g, rboxGeo(1.95, 1.25, 1.3, 0.14), paint, 0, 0.35 + 0.62, -1.7);
  const ws = add(g, boxGeo(1.75, 0.6, 0.04), glass, 0, 1.45, -2.05);
  ws.rotation.x = -0.35;
  for (const x of [-0.99, 0.99]) add(g, boxGeo(0.03, 0.5, 0.9), glass, x, 1.48, -1.55);
  add(g, boxGeo(1.9, 0.25, 0.08), M.chrome(1), 0, 0.55, -2.36);
  for (const x of [-0.72, 0.72]) add(g, boxGeo(0.28, 0.16, 0.04), M.emissive('#fff6d8', 0.6), x, 0.85, -2.37);
  for (const x of [-0.8, 0.8]) add(g, boxGeo(0.14, 0.26, 0.04), M.emissive('#ff2a1a', 0.5), x, 1.1, 2.37);
  add(g, boxGeo(0.02, 1.4, 0.02), Materials.color('#555', 0.6), 0, 1.25, 2.36);
  for (const [x, z] of [[-0.9, -1.55], [0.9, -1.55], [-0.9, 1.5], [0.9, 1.5]]) wheel(g, x, z);
  const sign = add(g, boxGeo(0.02, 0.5, 1.6), Materials.get({ map: labelTexture('HUNTER HAULING', '#1b1b1b', '#f2a900', 512, 96), rough: 0.5 }), 0.99, 1.4, 0.6);
  sign.rotation.y = Math.PI;
  add(g, boxGeo(0.02, 0.5, 1.6), Materials.get({ map: labelTexture('HUNTER HAULING', '#1b1b1b', '#f2a900', 512, 96), rough: 0.5 }), -0.99, 1.4, 0.6).rotation.y = 0;
  const rust = Materials.get({ surface: 'rust' });
  add(g, boxGeo(0.4, 0.2, 0.02), rust, 0.5, 0.6, 2.37);
  if (withRack) {
    for (const x of [-0.8, 0.8]) add(g, boxGeo(0.05, 0.05, 3.2), M.darkMetal(), x, 2.18, 0.55);
    for (const z of [-0.8, 0.4, 1.6]) add(g, boxGeo(1.7, 0.04, 0.05), M.darkMetal(), 0, 2.18, z);
  }
  return g;
}

/** Generic parked car for the rivals. Front faces -z. */
export function buildCar(color: string, kind: 'sedan' | 'pickup' | 'luxury' = 'sedan'): THREE.Group {
  const g = new THREE.Group();
  const paint = Materials.get({ color, rough: kind === 'luxury' ? 0.15 : 0.4, metal: 0.5 }, kind === 'luxury' ? 0 : 1);
  const glass = Materials.get({ color: '#1a2228', rough: 0.08, metal: 0.6 });
  const len = kind === 'luxury' ? 4.9 : 4.4;
  add(g, rboxGeo(1.8, 0.7, len, 0.18), paint, 0, 0.62, 0);
  if (kind === 'pickup') {
    add(g, rboxGeo(1.7, 0.65, 1.6, 0.14), paint, 0, 1.25, -0.5);
    add(g, boxGeo(1.55, 0.5, 0.05), glass, 0, 1.3, -1.32);
    add(g, boxGeo(1.7, 0.35, 1.8), Materials.color('#1a1a1a', 0.8), 0, 1.1, 1.2);
  } else {
    add(g, rboxGeo(1.6, 0.6, len * 0.48, 0.2), paint, 0, 1.2, 0.15);
    add(g, boxGeo(1.5, 0.45, 0.05), glass, 0, 1.22, -len * 0.24 + 0.12).rotation.x = -0.5;
    for (const x of [-0.81, 0.81]) add(g, boxGeo(0.02, 0.4, len * 0.42), glass, x, 1.24, 0.15);
  }
  for (const x of [-0.6, 0.6]) add(g, boxGeo(0.3, 0.12, 0.04), M.emissive('#fff6d8', 0.3), x, 0.7, -len / 2 - 0.01);
  for (const [x, z] of [[-0.85, -len * 0.32], [0.85, -len * 0.32], [-0.85, len * 0.32], [0.85, len * 0.32]]) wheel(g, x, z, 0.33);
  return g;
}
