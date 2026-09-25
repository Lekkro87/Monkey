import * as THREE from 'three';
import { markerLabel } from '../textures';
import { M, Materials } from '../materials';
import type { Kit } from './kit';

/** Containers and furniture. */
export const FURNITURE: Record<string, (k: Kit) => void> = {
  box(k) {
    const { w, h, d, dirt, rng } = k;
    const seed = rng.int(0, 3);
    const mat = M.cardboard(seed, dirt);
    const flapT = 0.006;
    const body = k.box(w, h - flapT, d, mat, 0, (h - flapT) / 2, 0);
    body.scale.set(1 + rng.range(-0.01, 0.015), 1, 1 + rng.range(-0.01, 0.015));
    // Two top flaps hinged on the long outer edges.
    const flaps: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const pv = k.pivot((side * w) / 2, h - flapT, 0);
      const f = k.box(w / 2, flapT, d, mat, (-side * w) / 4, flapT / 2, 0, pv);
      f.rotation.z = side * rng.range(0, 0.04);
      flaps.push(pv);
    }
    k.parts.flaps = flaps;
    // Packing tape across the seam and down the front/back.
    if (rng.chance(0.8)) {
      const tape = M.tape();
      k.box(0.05, 0.002, d + 0.004, tape, 0, h + 0.001, 0);
      k.box(0.05, h * 0.3, 0.002, tape, 0, h - h * 0.15, -d / 2 - 0.001);
      k.box(0.05, h * 0.3, 0.002, tape, 0, h - h * 0.15, d / 2 + 0.001);
    }
    const label = k.p.label as string | undefined;
    if (label) {
      const t = markerLabel(label, rng.int(0, 9));
      const lm = Materials.get({ color: '#ffffff', map: t, rough: 0.9, opacity: 0.99 });
      k.decal(Math.min(w * 0.8, 0.34), Math.min(h * 0.45, 0.17), lm, rng.range(-0.03, 0.03), h * 0.52, -d / 2 - 0.002);
    }
    if (rng.chance(0.35)) {
      // "THIS SIDE UP" arrows.
      const arrow = Materials.get({ color: '#2a2320', rough: 0.9 });
      k.box(0.012, 0.07, 0.002, arrow, w / 2 - 0.06, h * 0.72, -d / 2 - 0.0015);
    }
  },

  tote(k) {
    const { w, h, d, dirt, rng } = k;
    const color = rng.pick(['#2f5d8a', '#4a4d52', '#1d1f22', '#8a8f94', '#6a3d7a']);
    const lidColor = rng.pick(['#1d1f22', '#2f5d8a', '#c9a227', '#3c7a4a']);
    k.rbox(w * 0.96, h - 0.03, d * 0.96, 0.03, M.plastic(color, dirt), 0, (h - 0.03) / 2, 0);
    const lid = k.pivot(0, h - 0.03, d / 2);
    k.rbox(w, 0.03, d, 0.012, M.plastic(lidColor, dirt), 0, 0.015, -d / 2, lid);
    k.parts.lid = lid;
    for (const x of [-w / 2 + 0.01, w / 2 - 0.01]) k.box(0.02, 0.04, d * 0.3, M.plastic(lidColor, dirt), x, h - 0.06, 0);
  },

  suitcase(k) {
    const { w, h, d, dirt, rng } = k;
    const skin = rng.chance(0.5) ? M.leather('leather_tan', dirt) : M.fabric(rng.pick(['#3b4a5a', '#5a3b3b', '#4a5a3b']), 'weave', dirt);
    k.rbox(w, h * 0.5, d, 0.03, skin, 0, h * 0.25, 0);
    const lid = k.pivot(0, h * 0.5, d / 2);
    k.rbox(w, h * 0.5, d, 0.03, skin, 0, h * 0.25, -d / 2, lid);
    k.parts.lid = lid;
    for (const x of [-w * 0.3, w * 0.3]) k.box(0.05, 0.035, 0.012, M.brass(dirt), x, h * 0.5, -d / 2 - 0.004);
    k.torus(0.05, 0.01, M.leather('leather_black', dirt), 0, h * 0.5, -d / 2 - 0.02, 'z', Math.PI);
    k.box(w * 0.98, 0.01, 0.004, M.leather('leather_black', dirt), 0, h * 0.5, -d / 2 - 0.002);
  },

  trunk(k) {
    const { w, h, d, dirt } = k;
    const body = M.fabric('#3e4a3a', 'weave', dirt);
    const slat = M.wood('dark_wood', dirt);
    const hLid = h * 0.3;
    k.box(w, h - hLid, d, body, 0, (h - hLid) / 2, 0);
    for (const x of [-w * 0.33, 0, w * 0.33]) k.box(0.05, h - hLid + 0.002, d + 0.01, slat, x, (h - hLid) / 2, 0);
    const lid = k.pivot(0, h - hLid, d / 2);
    k.box(w, hLid, d, body, 0, hLid / 2, -d / 2, lid);
    for (const x of [-w * 0.33, 0, w * 0.33]) k.box(0.05, hLid + 0.004, d + 0.01, slat, x, hLid / 2, -d / 2, lid);
    k.parts.lid = lid;
    for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) for (const y of [0.03, h - 0.03]) k.box(0.07, 0.07, d + 0.02, M.brass(dirt), x, y, 0);
    k.box(0.08, 0.1, 0.02, M.brass(dirt), 0, h - hLid, -d / 2 - 0.01);
    k.torus(0.05, 0.012, M.leather('leather_black', dirt), -w / 2 - 0.012, h * 0.55, 0, 'x', Math.PI);
    k.torus(0.05, 0.012, M.leather('leather_black', dirt), w / 2 + 0.012, h * 0.55, 0, 'x', Math.PI);
  },

  jewelry_box(k) {
    const { w, h, d, dirt } = k;
    const wood = M.wood('walnut', dirt);
    k.box(w, h * 0.62, d, wood, 0, h * 0.31, 0);
    k.box(w - 0.02, 0.01, d - 0.02, M.fabric('#7a1030', 'plain'), 0, h * 0.62 - 0.004, 0);
    const lid = k.pivot(0, h * 0.62, d / 2);
    k.rbox(w + 0.006, h * 0.38, d + 0.006, 0.01, wood, 0, h * 0.19, -d / 2, lid);
    k.parts.lid = lid;
    k.box(0.03, 0.02, 0.006, M.gold(dirt), 0, h * 0.6, -d / 2 - 0.004);
  },

  toolbox(k) {
    const { w, h, d, dirt } = k;
    const red = M.paint('#b3261e', dirt);
    k.box(w, h * 0.7, d, red, 0, h * 0.35, 0);
    const lid = k.pivot(0, h * 0.7, d / 2);
    k.box(w, h * 0.12, d, red, 0, h * 0.06, -d / 2, lid);
    k.parts.lid = lid;
    k.tube(new THREE.Vector3(-w * 0.25, h * 0.82, 0), new THREE.Vector3(-w * 0.25, h, 0), 0.008, M.steel(dirt));
    k.tube(new THREE.Vector3(w * 0.25, h * 0.82, 0), new THREE.Vector3(w * 0.25, h, 0), 0.008, M.steel(dirt));
    k.tube(new THREE.Vector3(-w * 0.25, h - 0.008, 0), new THREE.Vector3(w * 0.25, h - 0.008, 0), 0.01, M.rubber(dirt));
    for (const x of [-w * 0.4, w * 0.4]) k.box(0.03, 0.03, 0.01, M.steel(dirt), x, h * 0.68, -d / 2 - 0.004);
  },

  safe(k) {
    const { w, h, d, dirt } = k;
    const body = M.paint('#1f3a2c', dirt);
    k.rbox(w, h, d, 0.02, body, 0, h / 2, 0);
    const door = k.pivot(-w / 2 + 0.04, h / 2, -d / 2);
    k.box(w - 0.08, h - 0.08, 0.03, M.paint('#23432f', dirt), (w - 0.08) / 2, 0, -0.012, door);
    k.parts.door = door;
    k.cyl(0.055, 0.055, 0.03, M.darkMetal(dirt), w * 0.12, h * 0.6, -d / 2 - 0.03, 'z', 24);
    k.cyl(0.035, 0.035, 0.012, M.silver(dirt), w * 0.12, h * 0.6, -d / 2 - 0.05, 'z', 24);
    k.box(0.12, 0.02, 0.02, M.chrome(dirt), w * 0.12, h * 0.35, -d / 2 - 0.03);
    k.box(w - 0.12, 0.006, 0.002, M.gold(dirt), 0, h - 0.07, -d / 2 - 0.02);
    k.box(w - 0.12, 0.006, 0.002, M.gold(dirt), 0, 0.07, -d / 2 - 0.02);
    for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) for (const z of [-d / 2 + 0.06, d / 2 - 0.06]) k.cyl(0.025, 0.025, 0.03, M.darkMetal(dirt), x, 0.015, z);
  },

  tool_chest(k) {
    const { w, h, d, dirt } = k;
    const red = M.paint('#a4231b', dirt);
    const bodyH = h - 0.1;
    k.box(w, bodyH, d, red, 0, 0.08 + bodyH / 2, 0);
    const drawers: THREE.Object3D[] = [];
    const n = 5;
    for (let i = 0; i < n; i++) {
      const dh = (bodyH - 0.06) / n;
      const y = 0.11 + i * dh + dh / 2;
      const pv = k.pivot(0, y, -d / 2);
      k.box(w - 0.04, dh - 0.012, 0.02, M.paint('#b8291f', dirt), 0, 0, -0.005, pv);
      k.box(w * 0.6, 0.012, 0.02, M.chrome(dirt), 0, dh * 0.2, -0.022, pv);
      drawers.push(pv);
    }
    k.parts.drawers = drawers;
    for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) for (const z of [-d / 2 + 0.06, d / 2 - 0.06]) k.cyl(0.035, 0.035, 0.03, M.rubber(dirt), x, 0.035, z, 'x');
    k.tube(new THREE.Vector3(w / 2 + 0.03, h * 0.75, -d * 0.3), new THREE.Vector3(w / 2 + 0.03, h * 0.75, d * 0.3), 0.012, M.chrome(dirt));
  },

  dresser(k) {
    const { w, h, d, dirt, p } = k;
    const antique = p.style === 'antique';
    const wood = antique ? M.wood('walnut', dirt) : M.wood('pine', dirt);
    const feet = antique ? 0.1 : 0.06;
    k.box(w, h - feet - (antique ? 0.06 : 0), d, wood, 0, feet + (h - feet - (antique ? 0.06 : 0)) / 2, 0);
    if (antique) {
      k.box(w + 0.05, 0.06, d + 0.04, wood, 0, h - 0.03, 0);
      k.box(w * 0.5, 0.08, 0.03, wood, 0, h + 0.0, -d / 2 + 0.02).scale.set(1, 0.8, 1);
      for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) for (const z of [-d / 2 + 0.06, d / 2 - 0.06]) k.sphere(0.05, wood, x, 0.05, z, 10);
    } else {
      for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) for (const z of [-d / 2 + 0.04, d / 2 - 0.04]) k.box(0.05, feet, 0.05, wood, x, feet / 2, z);
    }
    const drawers: THREE.Object3D[] = [];
    const n = 4;
    const top = h - (antique ? 0.08 : 0.03);
    const span = top - feet - 0.04;
    for (let i = 0; i < n; i++) {
      const dh = span / n;
      const y = feet + 0.02 + i * dh + dh / 2;
      const pv = k.pivot(0, y, -d / 2);
      k.box(w - 0.06, dh - 0.02, 0.022, antique ? M.wood('walnut', dirt) : M.wood('pine', dirt), 0, 0, -0.006, pv);
      if (antique) {
        for (const x of [-w * 0.25, w * 0.25]) {
          k.box(0.09, 0.02, 0.01, M.brass(dirt), x, 0, -0.022, pv);
          k.torus(0.022, 0.004, M.brass(dirt), x, -0.018, -0.026, 'z', Math.PI, pv).rotation.z = Math.PI;
        }
      } else {
        for (const x of [-w * 0.25, w * 0.25]) k.sphere(0.018, M.wood('dark_wood', dirt), x, 0, -0.03, 10, pv);
      }
      drawers.push(pv);
    }
    k.parts.drawers = drawers;
  },

  chair(k) {
    const { w, h, d, dirt, rng } = k;
    const wood = M.wood(rng.pick(['oak', 'pine', 'dark_wood'] as const), dirt);
    const seatY = h * 0.5;
    k.box(w, 0.035, d, wood, 0, seatY, 0);
    for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) for (const z of [-d / 2 + 0.03, d / 2 - 0.03]) k.box(0.035, seatY, 0.035, wood, x, seatY / 2, z);
    for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) k.box(0.035, h - seatY, 0.035, wood, x, seatY + (h - seatY) / 2, d / 2 - 0.03);
    k.box(w, 0.07, 0.025, wood, 0, h - 0.05, d / 2 - 0.03);
    for (const x of [-w * 0.15, 0, w * 0.15]) k.box(0.025, h - seatY - 0.12, 0.018, wood, x, seatY + (h - seatY) / 2 - 0.03, d / 2 - 0.03);
    k.box(w - 0.06, 0.02, 0.02, wood, 0, seatY * 0.35, -d / 2 + 0.03);
  },

  broken_chair(k) {
    const { w, h, d, dirt } = k;
    const wood = M.wood('pine', dirt);
    const seatY = h * 0.55;
    const seat = k.box(w, 0.035, d, wood, 0, seatY, 0);
    seat.rotation.z = 0.18;
    for (const [x, z] of [[-w / 2 + 0.03, -d / 2 + 0.03], [w / 2 - 0.03, -d / 2 + 0.03], [-w / 2 + 0.03, d / 2 - 0.03]]) {
      k.box(0.035, seatY, 0.035, wood, x, seatY / 2, z);
    }
    const back = k.box(0.035, h * 0.4, 0.035, wood, -w / 2 + 0.03, seatY + h * 0.2, d / 2 - 0.03);
    back.rotation.x = 0.3;
    k.box(0.035, 0.3, 0.035, wood, w * 0.2, 0.02, 0).rotation.z = Math.PI / 2 - 0.2;
  },

  side_table(k) {
    const { w, h, d, dirt } = k;
    const wood = M.wood('teak', dirt);
    k.box(w, 0.03, d, wood, 0, h - 0.015, 0);
    for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) for (const z of [-d / 2 + 0.03, d / 2 - 0.03]) {
      const leg = k.cyl(0.018, 0.012, h - 0.03, wood, x, (h - 0.03) / 2, z);
      leg.rotation.z = x < 0 ? -0.06 : 0.06;
    }
    k.box(w * 0.8, 0.08, d * 0.85, wood, 0, h - 0.08, 0);
    k.sphere(0.012, M.brass(dirt), 0, h - 0.08, -d * 0.43, 8);
  },

  armchair(k) {
    const { w, h, d, dirt, p } = k;
    if (p.style === 'lounge') {
      const shell = M.wood('teak', dirt);
      const leather = M.leather('leather_black', dirt);
      k.cyl(0.03, 0.03, 0.2, M.darkMetal(dirt), 0, 0.1, 0);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        k.box(0.3, 0.02, 0.035, M.darkMetal(dirt), Math.cos(a) * 0.15, 0.02, Math.sin(a) * 0.15).rotation.y = -a;
      }
      k.rbox(w * 0.92, 0.1, d * 0.75, 0.04, shell, 0, 0.3, -d * 0.05);
      k.rbox(w * 0.86, 0.1, d * 0.7, 0.05, leather, 0, 0.38, -d * 0.05);
      const back = k.rbox(w * 0.92, h * 0.55, 0.08, 0.04, shell, 0, h * 0.62, d * 0.33);
      back.rotation.x = -0.25;
      const cushion = k.rbox(w * 0.84, h * 0.5, 0.1, 0.05, leather, 0, h * 0.62, d * 0.28);
      cushion.rotation.x = -0.25;
      for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) k.rbox(0.1, 0.06, d * 0.55, 0.03, leather, x, 0.52, -d * 0.05);
      k.parts.glint = new THREE.Vector3(0, h * 0.7, 0);
    } else {
      const fab = M.fabric(k.rng.pick(['#8a5a4a', '#5a6a4a', '#7a6a50', '#6a4a5a']), 'floral', dirt);
      k.rbox(w, h * 0.42, d, 0.06, fab, 0, h * 0.21 + 0.06, 0);
      k.rbox(w, h * 0.55, 0.18, 0.06, fab, 0, h * 0.62, d / 2 - 0.09);
      for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) k.rbox(0.16, h * 0.3, d, 0.06, fab, x, h * 0.55, 0);
      k.rbox(w - 0.3, 0.12, d - 0.25, 0.05, fab, 0, h * 0.5, -0.06);
      for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) for (const z of [-d / 2 + 0.06, d / 2 - 0.06]) k.cyl(0.02, 0.015, 0.06, M.wood('dark_wood', dirt), x, 0.03, z);
    }
  },

  mirror(k) {
    const { w, h, d, dirt, rng } = k;
    const frame = rng.chance(0.5) ? M.gold(dirt) : M.wood('walnut', dirt);
    const t = 0.05;
    k.box(w, t, d, frame, 0, t / 2, 0);
    k.box(w, t, d, frame, 0, h - t / 2, 0);
    k.box(t, h, d, frame, -w / 2 + t / 2, h / 2, 0);
    k.box(t, h, d, frame, w / 2 - t / 2, h / 2, 0);
    const glass = Materials.get({ color: '#cfd6da', rough: 0.04, metal: 1 }, dirt);
    k.box(w - 2 * t, h - 2 * t, 0.01, glass, 0, h / 2, 0);
  },

  mattress(k) {
    const { w, h, d, dirt } = k;
    const fab = M.fabric('#d9d2c2', 'check', Math.max(1, dirt) as 1 | 2);
    k.rbox(w, h, d, 0.07, fab, 0, h / 2, 0);
    const stain = Materials.get({ color: '#8a7040', rough: 1, opacity: 0.45 });
    k.decal(w * 0.25, h * 0.18, stain, w * 0.15, h * 0.45, -d / 2 - 0.003);
    k.decal(w * 0.15, h * 0.1, stain, -w * 0.2, h * 0.7, -d / 2 - 0.003);
  },

  rug_roll(k) {
    const { w, h, dirt, p } = k;
    const r = w / 2;
    const persian = !!p.persian;
    const mat = persian ? M.fabric('#8a2230', 'floral', dirt) : M.fabric('#c9b89a', 'weave', dirt);
    k.cyl(r, r, h, mat, 0, h / 2, 0, 'y', 20);
    k.cyl(r * 0.35, r * 0.35, h + 0.004, M.fabric(persian ? '#1f2d5a' : '#9a8a6a', 'plain', dirt), 0, h / 2, 0, 'y', 12);
    for (const y of [h * 0.25, h * 0.75]) k.torus(r + 0.004, 0.006, M.fabric('#c8b890', 'plain'), 0, y, 0, 'y');
    if (persian) for (let i = 0; i < 6; i++) k.box(0.01, 0.06, 0.004, M.fabric('#e8e0c8', 'plain'), -r * 0.8 + i * r * 0.3, h + 0.02, 0);
  },

  floor_lamp(k) {
    const { w, h, dirt } = k;
    k.box(w * 0.5, 0.06, w * 0.5, Materials.get({ color: '#e8e4dc', rough: 0.2 }, dirt), -w * 0.2, 0.03, 0);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-w * 0.2, 0.06, 0), new THREE.Vector3(-w * 0.2, h * 1.05, 0), new THREE.Vector3(w * 0.35, h * 0.82, 0));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.012, 8), M.brass(dirt));
    tube.castShadow = true;
    k.root.add(tube);
    const shade = k.sphere(w * 0.22, M.brass(dirt), w * 0.35, h * 0.78, 0, 16);
    shade.scale.y = 0.6;
    k.sphere(0.03, M.emissive('#ffe7b0', 0.4), w * 0.35, h * 0.72, 0, 8);
  },

  lamp(k) {
    const { w, h, dirt, rng } = k;
    const base = rng.chance(0.5) ? M.brass(dirt) : Materials.get({ color: rng.pick(['#3b6a8a', '#8a3b3b', '#e0d8c8']), rough: 0.3 }, dirt);
    k.lathe([[0, 0], [w * 0.3, 0], [w * 0.28, 0.03], [w * 0.12, 0.06], [w * 0.16, h * 0.25], [0.02, h * 0.45], [0, h * 0.45]], base);
    k.cyl(0.01, 0.01, h * 0.2, M.brass(dirt), 0, h * 0.5, 0);
    const shade = k.cyl(w * 0.3, w * 0.5, h * 0.42, Materials.get({ fabric: { color: rng.pick(['#e8dcc0', '#d8c8a8', '#b8a888']), pattern: 'weave' }, side: 'double' }, dirt), 0, h * 0.78, 0, 'y', 20, undefined, true);
    shade.castShadow = true;
  },
};
