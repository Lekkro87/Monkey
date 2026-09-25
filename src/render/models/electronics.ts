import * as THREE from 'three';
import { consoleBoxArt, handheldScreen, labelTexture, recordSleeves } from '../art';
import { M, Materials } from '../materials';
import type { Kit } from './kit';

/** Electronics, music gear, tools and sports equipment. */
export const ELECTRONICS: Record<string, (k: Kit) => void> = {
  toaster(k) {
    const { w, h, d, dirt } = k;
    k.rbox(w, h * 0.9, d, 0.04, M.chrome(dirt), 0, h * 0.47, 0);
    for (const z of [-d * 0.18, d * 0.18]) k.box(w * 0.7, 0.01, 0.03, Materials.color('#111', 0.9), 0, h * 0.92, z);
    k.box(0.02, 0.05, 0.03, M.plastic('#111', dirt), w / 2 + 0.01, h * 0.55, 0);
    for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) k.box(0.02, 0.02, d * 0.8, M.plastic('#222', dirt), x, 0.01, 0);
  },

  microwave(k) {
    const { w, h, d, dirt } = k;
    k.box(w, h, d, M.plastic('#e8e4da', dirt), 0, h / 2, 0);
    k.box(w * 0.66, h * 0.8, 0.01, Materials.get({ color: '#1b1f22', rough: 0.15, metal: 0.3 }, dirt), -w * 0.14, h / 2, -d / 2 - 0.005);
    k.box(w * 0.22, h * 0.8, 0.01, M.plastic('#cfcac0', dirt), w * 0.36, h / 2, -d / 2 - 0.004);
    for (let i = 0; i < 6; i++) k.box(0.025, 0.018, 0.006, M.plastic('#555', dirt), w * 0.33 + (i % 2) * 0.04, h * 0.3 + Math.floor(i / 2) * 0.05, -d / 2 - 0.01);
    k.box(w * 0.12, 0.02, 0.006, M.emissive('#58ff8a', 0.6), w * 0.36, h * 0.75, -d / 2 - 0.01);
  },

  plates(k) {
    const { w, h, dirt, rng } = k;
    const n = Math.max(3, Math.floor(h / 0.022));
    const rim = rng.pick(['#2f4a8a', '#8a2f3b', '#3b6a4a']);
    for (let i = 0; i < n; i++) {
      k.cyl(w / 2 - 0.01, w / 2 - 0.04, 0.018, Materials.color('#f2efe8', 0.3, 0, dirt), rng.range(-0.005, 0.005), 0.01 + i * 0.022, rng.range(-0.005, 0.005), 'y', 24);
      k.torus(w / 2 - 0.012, 0.004, Materials.color(rim, 0.4), 0, 0.019 + i * 0.022, 0, 'y');
    }
  },

  china(k) {
    const { w, d, dirt } = k;
    const porcelain = Materials.color('#f4f1ea', 0.25, 0, dirt);
    for (let i = 0; i < 5; i++) k.cyl(0.11, 0.08, 0.016, porcelain, -w * 0.22, 0.01 + i * 0.02, 0, 'y', 24);
    k.lathe([[0, 0], [0.06, 0], [0.09, 0.05], [0.1, 0.1], [0.08, 0.15], [0.03, 0.17], [0.035, 0.19], [0, 0.2]], porcelain, w * 0.2, 0, 0);
    k.torus(0.03, 0.008, porcelain, w * 0.2 + 0.1, 0.1, 0, 'z');
    k.cyl(0.012, 0.02, 0.09, porcelain, w * 0.2 - 0.11, 0.1, 0).rotation.z = 0.8;
    k.torus(0.1, 0.003, M.gold(dirt), w * 0.2, 0.1, 0, 'y');
    for (const x of [-w * 0.3, w * 0.02]) {
      k.cyl(0.04, 0.03, 0.06, porcelain, x, 0.14, -d * 0.3);
    }
  },

  vacuum(k) {
    const { w, h, d, dirt } = k;
    const shell = M.plastic('#8a2f5a', dirt);
    k.rbox(w, 0.1, d, 0.03, shell, 0, 0.07, 0);
    for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) k.cyl(0.035, 0.035, 0.03, M.rubber(dirt), x, 0.035, d / 2 - 0.05, 'x');
    k.cyl(0.08, 0.09, h * 0.5, M.fabric('#6a6a6a', 'weave', dirt), 0, h * 0.4, d * 0.1, 'y', 14);
    k.cyl(0.012, 0.012, h * 0.4, M.chrome(dirt), 0, h * 0.78, d * 0.1);
    k.box(0.12, 0.03, 0.03, M.plastic('#222', dirt), 0, h - 0.02, d * 0.1);
  },

  mini_fridge(k) {
    const { w, h, d, dirt } = k;
    k.rbox(w, h, d, 0.02, M.plastic('#eeeae2', dirt), 0, h / 2, 0);
    k.box(w - 0.02, 0.004, 0.004, M.plastic('#999', dirt), 0, h * 0.72, -d / 2 - 0.002);
    k.box(0.02, h * 0.3, 0.02, M.chrome(dirt), w / 2 - 0.05, h * 0.45, -d / 2 - 0.012);
  },

  xmas(k) {
    const { w, h, d, rng } = k;
    for (let i = 0; i < 5; i++) {
      const t = k.torus(rng.range(0.06, 0.1), 0.02, Materials.get({ color: '#1f6a3a', rough: 0.9 }), rng.range(-w * 0.3, w * 0.3), rng.range(0.04, h * 0.6), rng.range(-d * 0.3, d * 0.3), 'y');
      t.rotation.set(rng.range(0, 3), rng.range(0, 3), 0);
    }
    for (let i = 0; i < 7; i++) {
      k.sphere(rng.range(0.025, 0.04), Materials.get({ color: rng.pick(['#c0262d', '#e0b04a', '#2f6ab0', '#c0c4c8']), rough: 0.15, metal: 0.6 }), rng.range(-w * 0.35, w * 0.35), rng.range(0.03, h * 0.8), rng.range(-d * 0.35, d * 0.35), 12);
    }
  },

  trophy(k) {
    const { w, h, dirt } = k;
    k.box(w, h * 0.2, w * 0.8, Materials.color('#e8e4dc', 0.3, 0, dirt), 0, h * 0.1, 0);
    k.cyl(0.02, 0.03, h * 0.35, M.gold(dirt), 0, h * 0.38, 0);
    k.lathe([[0, 0], [0.02, 0], [0.05, 0.08], [0.06, 0.16], [0, 0.16]], M.gold(dirt), 0, h * 0.55, 0);
    k.sphere(0.035, M.gold(dirt), 0, h * 0.2 + 0.035, 0.03, 10);
  },

  sewing_machine(k) {
    const { w, h, d, dirt } = k;
    const iron = Materials.get({ color: '#141414', rough: 0.35, metal: 0.4 }, dirt);
    k.box(w, 0.05, d, M.wood('walnut', dirt), 0, 0.025, 0);
    k.box(w * 0.2, h * 0.7, d * 0.5, iron, w * 0.3, 0.05 + h * 0.35, 0);
    k.box(w * 0.85, h * 0.2, d * 0.45, iron, 0, h * 0.8, 0);
    k.box(w * 0.14, h * 0.45, d * 0.35, iron, -w * 0.35, h * 0.6, 0);
    k.cyl(0.07, 0.07, 0.02, M.chrome(dirt), w * 0.44, h * 0.72, 0, 'x', 20);
    k.box(w * 0.7, 0.012, 0.002, M.gold(dirt), 0, h * 0.85, -d * 0.23);
    k.cyl(0.004, 0.004, 0.08, M.chrome(dirt), -w * 0.35, h * 0.34, 0);
  },

  typewriter(k) {
    const { w, h, d, dirt } = k;
    const paint = Materials.get({ color: '#8fc4a8', rough: 0.35, metal: 0.15 }, dirt);
    k.rbox(w, h * 0.55, d, 0.03, paint, 0, h * 0.28, 0);
    const deck = k.rbox(w * 0.9, 0.04, d * 0.45, 0.01, paint, 0, h * 0.5, -d * 0.2);
    deck.rotation.x = -0.2;
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 9; i++) k.cyl(0.011, 0.011, 0.01, Materials.color('#1a1a1a', 0.4), -w * 0.32 + i * w * 0.08 + row * 0.01, h * 0.52 + row * 0.02, -d * 0.36 + row * 0.05, 'y', 10);
    }
    k.cyl(0.03, 0.03, w * 1.02, M.rubber(dirt), 0, h * 0.72, d * 0.22, 'x', 14);
    k.box(w * 0.6, h * 0.25, 0.004, M.paper('#f2eee4'), 0, h * 0.85, d * 0.26);
  },

  books(k) {
    const { w, h, d, dirt, rng, p } = k;
    const old = !!p.old;
    let y = 0;
    while (y < h - 0.035) {
      const bh = Math.min(h - y, rng.range(0.03, 0.06));
      const bw = w * rng.range(0.82, 1);
      const bd = d * rng.range(0.82, 1);
      const color = old ? rng.pick(['#4a2a1a', '#2a3a2a', '#3a1a1a', '#5a4a2a']) : rng.pick(['#b8322a', '#2a5a8a', '#e0b030', '#3a8a5a', '#8a3a8a', '#e8e0d0']);
      const b = k.box(bw, bh, bd, Materials.get({ color, rough: old ? 0.6 : 0.5 }, dirt), rng.range(-0.01, 0.01), y + bh / 2, rng.range(-0.01, 0.01));
      b.rotation.y = rng.range(-0.12, 0.12);
      k.box(bw * 0.96, bh * 0.8, bd * 0.98, M.paper('#e8dfc8', dirt), b.position.x + 0.006, y + bh / 2, b.position.z).rotation.y = b.rotation.y;
      if (old) k.box(0.004, bh * 0.9, bd * 0.2, M.gold(), b.position.x - bw / 2 - 0.001, y + bh / 2, b.position.z);
      y += bh;
    }
  },

  magazines(k) {
    const { w, h, d, dirt, rng } = k;
    let y = 0;
    while (y < h - 0.01) {
      const mh = 0.008;
      const m = k.box(w * rng.range(0.9, 1), mh, d * rng.range(0.9, 1), Materials.get({ color: `hsl(${rng.int(0, 360)},40%,55%)`, rough: 0.35 }, dirt), 0, y + mh / 2, 0);
      m.rotation.y = rng.range(-0.15, 0.15);
      y += mh + 0.001;
    }
  },

  crt_tv(k) {
    const { w, h, d, dirt } = k;
    const shell = Materials.get({ surface: 'walnut' }, dirt);
    k.rbox(w, h, d * 0.62, 0.03, shell, 0, h / 2, -d * 0.19);
    k.rbox(w * 0.7, h * 0.8, d * 0.4, 0.08, M.plastic('#2a2a2a', dirt), 0, h * 0.48, d * 0.26);
    const screen = k.rbox(w * 0.66, h * 0.7, 0.04, 0.03, Materials.get({ color: '#20282c', rough: 0.08, metal: 0.4 }, dirt), -w * 0.08, h * 0.5, -d / 2 + 0.005);
    screen.scale.z = 1.2;
    for (let i = 0; i < 2; i++) k.cyl(0.022, 0.022, 0.03, M.plastic('#ccc', dirt), w * 0.37, h * (0.65 - i * 0.2), -d / 2 - 0.005, 'z', 12);
    for (const s of [-1, 1]) k.tube(new THREE.Vector3(s * 0.03, h, 0), new THREE.Vector3(s * 0.2, h + 0.25, 0.05), 0.004, M.chrome(dirt));
  },

  old_pc(k) {
    const { w, h, d, dirt } = k;
    k.box(w, h, d, M.plastic('#d9d0b8', dirt), 0, h / 2, 0);
    k.box(w * 0.7, 0.03, 0.006, Materials.color('#333', 0.4), 0, h * 0.8, -d / 2 - 0.003);
    k.box(w * 0.7, 0.03, 0.006, Materials.color('#333', 0.4), 0, h * 0.7, -d / 2 - 0.003);
    k.cyl(0.012, 0.012, 0.01, M.plastic('#b33', dirt), 0, h * 0.25, -d / 2 - 0.004, 'z', 10);
    k.box(0.02, 0.01, 0.004, M.emissive('#58ff8a', 0.3), w * 0.25, h * 0.25, -d / 2 - 0.003);
  },

  radio(k) {
    const { w, h, d, dirt, p } = k;
    if (p.style === 'transistor') {
      k.rbox(w, h, d, 0.015, M.plastic('#c43d2f', dirt), 0, h / 2, 0);
      k.box(w * 0.55, h * 0.7, 0.004, Materials.get({ color: '#d8d0c0', rough: 0.4, metal: 0.5 }, dirt), -w * 0.15, h / 2, -d / 2 - 0.002);
      k.cyl(0.02, 0.02, 0.01, M.chrome(dirt), w * 0.3, h * 0.6, -d / 2 - 0.004, 'z', 16);
      return;
    }
    const wood = Materials.get({ surface: 'walnut', rough: 0.4 }, dirt);
    k.box(w, h * 0.7, d, wood, 0, h * 0.35, 0);
    const top = k.cyl(d / 2, d / 2, w, wood, 0, h * 0.7, 0, 'x', 20);
    top.scale.set(1, (h * 0.3) / (d / 2), 1);
    k.box(w * 0.55, h * 0.45, 0.004, M.fabric('#b8a070', 'weave', dirt), -w * 0.12, h * 0.42, -d / 2 - 0.002);
    k.box(w * 0.28, 0.06, 0.004, M.emissive('#ffcf7a', 0.35), w * 0.28, h * 0.62, -d / 2 - 0.003);
    for (const x of [w * 0.2, w * 0.36]) k.cyl(0.025, 0.025, 0.025, Materials.get({ color: '#e8dcc0', rough: 0.3 }, dirt), x, h * 0.28, -d / 2 - 0.012, 'z', 14);
  },

  boombox(k) {
    const { w, h, d, dirt } = k;
    k.rbox(w, h * 0.78, d, 0.02, Materials.get({ color: '#b8bcc0', rough: 0.35, metal: 0.6 }, dirt), 0, h * 0.39, 0);
    for (const x of [-w * 0.32, w * 0.32]) {
      k.cyl(h * 0.28, h * 0.28, 0.01, Materials.color('#222', 0.8), x, h * 0.38, -d / 2 - 0.005, 'z', 24);
      k.cyl(h * 0.08, h * 0.08, 0.02, M.chrome(dirt), x, h * 0.38, -d / 2 - 0.01, 'z', 16);
    }
    for (const x of [-w * 0.07, w * 0.07]) k.box(w * 0.12, h * 0.3, 0.008, Materials.color('#1a1a1a', 0.3), x, h * 0.35, -d / 2 - 0.004);
    k.tube(new THREE.Vector3(-w * 0.35, h * 0.78, 0), new THREE.Vector3(-w * 0.3, h, 0), 0.01, M.chrome(dirt));
    k.tube(new THREE.Vector3(w * 0.35, h * 0.78, 0), new THREE.Vector3(w * 0.3, h, 0), 0.01, M.chrome(dirt));
    k.tube(new THREE.Vector3(-w * 0.3, h - 0.01, 0), new THREE.Vector3(w * 0.3, h - 0.01, 0), 0.012, M.chrome(dirt));
  },

  record_player(k) {
    const { w, h, d, dirt } = k;
    k.box(w, h * 0.55, d, M.wood('teak', dirt), 0, h * 0.28, 0);
    k.cyl(w * 0.34, w * 0.34, 0.015, Materials.color('#1a1a1a', 0.5, 0.3), -w * 0.08, h * 0.58, 0, 'y', 32);
    k.cyl(w * 0.1, w * 0.1, 0.017, M.plastic('#c43d2f', dirt), -w * 0.08, h * 0.59, 0, 'y', 20);
    k.tube(new THREE.Vector3(w * 0.38, h * 0.62, d * 0.3), new THREE.Vector3(w * 0.12, h * 0.6, -d * 0.1), 0.004, M.chrome(dirt));
    k.box(w, h * 0.42, d, M.glass(), 0, h * 0.55 + h * 0.21, 0);
  },

  vinyl_crate(k) {
    const { w, h, d, dirt, p } = k;
    const wood = M.wood('plywood', dirt);
    const t = 0.015;
    k.box(w, t, d, wood, 0, t / 2, 0);
    k.box(t, h, d, wood, -w / 2 + t / 2, h / 2, 0);
    k.box(t, h, d, wood, w / 2 - t / 2, h / 2, 0);
    k.box(w, h, t, wood, 0, h / 2, -d / 2 + t / 2);
    k.box(w, h, t, wood, 0, h / 2, d / 2 - t / 2);
    const sleeve = Materials.get({ map: recordSleeves(!!p.jazz, 1), rough: 0.6 }, dirt);
    const n = 14;
    for (let i = 0; i < n; i++) {
      const s = k.box(0.31, 0.31, 0.012, sleeve, 0, 0.17, -d / 2 + 0.03 + i * ((d - 0.06) / n));
      s.rotation.x = 0.12;
    }
  },

  camera(k) {
    const { w, h, d, dirt, p } = k;
    const style = p.style as string;
    if (style === 'point') {
      k.rbox(w, h, d * 0.7, 0.02, M.plastic('#2a2a2c', dirt), 0, h / 2, d * 0.1);
      k.cyl(0.022, 0.024, d * 0.3, M.plastic('#111', dirt), -w * 0.1, h / 2, -d * 0.3, 'z', 16);
      k.box(0.03, 0.02, 0.004, M.glass(), w * 0.3, h * 0.7, -d * 0.25);
      return;
    }
    const body = Materials.get({ color: '#161616', rough: 0.6 }, dirt);
    const top = M.chrome(dirt);
    const bodyH = style === 'slr' ? h * 0.62 : h * 0.8;
    k.rbox(w, bodyH, d * 0.45, 0.01, body, 0, bodyH / 2, d * 0.2);
    k.box(w, bodyH * 0.22, d * 0.46, top, 0, bodyH - bodyH * 0.11, d * 0.2);
    if (style === 'slr') {
      k.box(w * 0.3, h * 0.35, d * 0.35, top, 0, bodyH + h * 0.15, d * 0.22).scale.set(1, 1, 1);
    } else {
      for (const x of [-w * 0.35, w * 0.1]) k.box(0.018, 0.012, 0.003, M.glass(), x, bodyH * 0.8, -d * 0.03);
      if (!p.engraved) k.cyl(0.006, 0.006, 0.003, Materials.color('#d11', 0.4), w * 0.3, bodyH * 0.62, -d * 0.03, 'z', 10);
    }
    k.cyl(h * 0.28, h * 0.3, d * 0.55, Materials.color('#111', 0.3, 0.5), style === 'slr' ? 0 : -w * 0.05, bodyH * 0.48, -d * 0.2, 'z', 20);
    k.cyl(h * 0.22, h * 0.22, 0.004, M.glass(), style === 'slr' ? 0 : -w * 0.05, bodyH * 0.48, -d * 0.48, 'z', 20);
    k.cyl(0.008, 0.008, 0.012, top, w * 0.35, bodyH + 0.006, d * 0.2);
    k.parts.glint = new THREE.Vector3(0, bodyH * 0.48, -d * 0.48);
  },

  press_camera(k) {
    const { w, h, d, dirt } = k;
    const body = Materials.get({ color: '#1c1c1c', rough: 0.5 }, dirt);
    k.box(w * 0.7, h * 0.7, d * 0.4, body, 0, h * 0.35, d * 0.3);
    for (let i = 0; i < 5; i++) k.box(w * (0.6 - i * 0.04), h * (0.6 - i * 0.04), 0.02, Materials.color('#2a2a2a', 0.9), 0, h * 0.35, d * 0.08 - i * 0.03);
    k.cyl(0.045, 0.05, 0.05, Materials.color('#111', 0.3, 0.5), 0, h * 0.35, -d * 0.12, 'z', 20);
    k.cyl(0.018, 0.018, h * 0.4, M.chrome(dirt), w * 0.42, h * 0.45, d * 0.2);
    k.cyl(0.07, 0.02, 0.05, M.chrome(dirt), w * 0.42, h * 0.72, d * 0.15, 'z', 20);
  },

  handheld(k) {
    const { w, h, d, dirt } = k;
    k.rbox(w, h, d, 0.01, M.plastic('#c8c4bc', dirt), 0, h / 2, 0);
    k.box(w * 0.7, h * 0.36, 0.003, Materials.get({ map: handheldScreen(), rough: 0.3 }), 0, h * 0.7, -d / 2 - 0.002);
    k.box(0.02, 0.006, 0.004, Materials.color('#222', 0.5), -w * 0.22, h * 0.3, -d / 2 - 0.002);
    k.box(0.006, 0.02, 0.004, Materials.color('#222', 0.5), -w * 0.22, h * 0.3, -d / 2 - 0.002);
    for (const x of [w * 0.15, w * 0.3]) k.cyl(0.008, 0.008, 0.005, M.plastic('#8a1f4a', dirt), x, h * 0.32, -d / 2 - 0.002, 'z', 10);
  },

  console(k) {
    const { w, h, d, dirt } = k;
    k.rbox(w * 0.65, h * 0.7, d * 0.7, 0.01, M.plastic('#8a8c90', dirt), -w * 0.15, h * 0.35, 0);
    k.box(w * 0.3, 0.012, d * 0.2, Materials.color('#222', 0.5), -w * 0.15, h * 0.7, 0);
    k.box(w * 0.1, h * 0.35, d * 0.14, M.plastic('#4a4a4a', dirt), -w * 0.15, h * 0.8, 0);
    for (const z of [-d * 0.22, d * 0.22]) k.rbox(w * 0.28, h * 0.35, d * 0.2, 0.01, M.plastic('#2a2a2c', dirt), w * 0.33, h * 0.18, z);
  },

  console_box(k) {
    const { w, h, d, dirt, p } = k;
    const art = Materials.get({ map: consoleBoxArt(!!p.sealed, 1), rough: p.sealed ? 0.15 : 0.6 }, dirt);
    const side = Materials.get({ color: '#15151a', rough: 0.6 }, dirt);
    const mats = [side, side, side, side, art, art];
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    box.position.y = h / 2;
    box.castShadow = box.receiveShadow = true;
    k.root.add(box);
    const topArt = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.98, d * 0.98), art);
    topArt.rotation.x = -Math.PI / 2;
    topArt.position.y = h + 0.0015;
    k.root.add(topArt);
    if (p.sealed) {
      const wrap = Materials.get({ color: '#ffffff', rough: 0.05, metal: 0.2, opacity: 0.18 });
      k.box(w + 0.004, h + 0.004, d + 0.004, wrap, 0, h / 2, 0);
      k.parts.glint = new THREE.Vector3(w * 0.3, h, -d * 0.2);
    }
  },

  guitar_case(k) {
    const { w, h, d, dirt, p } = k;
    const shape = new THREE.Shape();
    const bw = w / 2;
    const lower = h * 0.42;
    shape.moveTo(0, 0);
    shape.bezierCurveTo(bw * 1.05, 0, bw * 1.05, lower * 0.9, bw * 0.72, lower * 1.08);
    shape.bezierCurveTo(bw * 0.85, lower * 1.35, bw * 0.85, lower * 1.55, bw * 0.4, lower * 1.62);
    shape.lineTo(bw * 0.3, h);
    shape.lineTo(-bw * 0.3, h);
    shape.lineTo(-bw * 0.4, lower * 1.62);
    shape.bezierCurveTo(-bw * 0.85, lower * 1.55, -bw * 0.85, lower * 1.35, -bw * 0.72, lower * 1.08);
    shape.bezierCurveTo(-bw * 1.05, lower * 0.9, -bw * 1.05, 0, 0, 0);
    const skin = p.tweed ? M.fabric('#b8a070', 'check', dirt) : p.hard ? M.leather('leather_black', dirt) : Materials.get({ color: '#232326', rough: 0.85 }, dirt);
    const m = k.extrude(shape, d - 0.02, skin, 0.01);
    m.position.z = -(d - 0.02) / 2;
    for (const y of [h * 0.2, h * 0.55]) k.box(0.03, 0.02, 0.012, M.chrome(dirt), bw * 0.8, y, 0);
    k.torus(0.04, 0.008, M.leather('leather_black', dirt), bw * 0.72 + 0.02, h * 0.48, 0, 'x', Math.PI).rotation.z = -Math.PI / 2;
  },

  amp(k) {
    const { w, h, d, dirt } = k;
    k.rbox(w, h, d, 0.015, M.leather('leather_black', dirt), 0, h / 2, 0);
    k.box(w * 0.88, h * 0.62, 0.006, M.fabric('#8a7a5a', 'weave', dirt), 0, h * 0.4, -d / 2 - 0.003);
    k.box(w * 0.9, h * 0.14, 0.008, M.chrome(dirt), 0, h * 0.84, -d / 2 - 0.004);
    for (let i = 0; i < 6; i++) k.cyl(0.012, 0.012, 0.015, M.plastic('#111', dirt), -w * 0.35 + i * w * 0.14, h * 0.84, -d / 2 - 0.012, 'z', 10);
    k.box(0.12, 0.03, 0.004, Materials.get({ map: labelTexture('TWIN', '#d9c9a0', '#222'), rough: 0.4 }), -w * 0.25, h * 0.66, -d / 2 - 0.008);
    k.tube(new THREE.Vector3(-w * 0.2, h, 0), new THREE.Vector3(w * 0.2, h, 0), 0.012, M.leather('leather_black', dirt));
  },

  keyboard(k) {
    const { w, h, d, dirt, p } = k;
    const synth = p.style === 'synth';
    k.box(w, h * 0.6, d, synth ? Materials.color('#222', 0.5, 0.2, dirt) : M.plastic('#1d1d1f', dirt), 0, h * 0.3, 0);
    const keyW = (w * 0.8) / 24;
    for (let i = 0; i < 24; i++) k.box(keyW * 0.92, 0.02, d * 0.45, M.plastic('#f2efe8', dirt), -w * 0.4 + keyW / 2 + i * keyW, h * 0.6 + 0.01, -d * 0.22);
    // Black keys sit after C, D, F, G and A of every octave.
    for (let i = 0; i < 23; i++) {
      if (![0, 1, 3, 4, 5].includes(i % 7)) continue;
      k.box(keyW * 0.55, 0.02, d * 0.28, M.plastic('#111', dirt), -w * 0.4 + (i + 1) * keyW, h * 0.6 + 0.022, -d * 0.12);
    }
    if (synth) {
      for (const x of [-w / 2, w / 2]) k.box(0.03, h * 1.1, d, M.wood('walnut', dirt), x, h * 0.55, 0);
      for (let i = 0; i < 10; i++) k.cyl(0.012, 0.012, 0.02, M.plastic('#111', dirt), -w * 0.35 + i * w * 0.075, h * 0.72, d * 0.25, 'y', 10);
    }
  },

  drill_case(k) {
    const { w, h, d, dirt } = k;
    k.rbox(w, h, d, 0.02, M.plastic('#e8b020', dirt), 0, h / 2, 0);
    k.box(w * 0.98, h * 0.15, d * 0.98, M.plastic('#1d1d1f', dirt), 0, h * 0.5, 0);
    for (const x of [-w * 0.3, w * 0.3]) k.box(0.04, 0.03, 0.01, M.plastic('#1d1d1f', dirt), x, h * 0.5, -d / 2 - 0.005);
    k.tube(new THREE.Vector3(-w * 0.15, h * 0.5, -d / 2 - 0.02), new THREE.Vector3(w * 0.15, h * 0.5, -d / 2 - 0.02), 0.012, M.plastic('#1d1d1f', dirt));
  },

  saw(k) {
    const { w, h, d, dirt } = k;
    k.cyl(h * 0.4, h * 0.4, 0.02, Materials.get({ color: '#aeb2b6', rough: 0.3, metal: 0.9 }, dirt), -w * 0.1, h * 0.42, 0, 'x', 28);
    const guard = k.cyl(h * 0.44, h * 0.44, 0.05, M.plastic('#e8b020', dirt), -w * 0.1, h * 0.5, 0.03, 'x', 28, undefined, false);
    guard.scale.set(1, 0.7, 1);
    k.cyl(0.07, 0.07, w * 0.4, M.plastic('#1d1d1f', dirt), w * 0.1, h * 0.5, d * 0.25, 'x', 16);
    k.box(w * 0.3, 0.04, 0.04, M.plastic('#1d1d1f', dirt), w * 0.2, h * 0.85, d * 0.1);
    k.box(w, 0.01, d, M.steel(dirt), 0, 0.005, 0);
  },

  socket_set(k) {
    const { w, h, d, dirt } = k;
    k.rbox(w, h, d, 0.01, M.plastic('#b3261e', dirt), 0, h / 2, 0);
    k.box(w * 0.3, 0.03, 0.004, M.chrome(dirt), 0, h * 0.5, -d / 2 - 0.002);
    for (let i = 0; i < 12; i++) k.cyl(0.012, 0.012, 0.02, M.chrome(dirt), -w * 0.4 + i * w * 0.07, h + 0.01, -d * 0.2, 'y', 10);
  },

  bicycle(k) {
    const { w, h, dirt, p } = k;
    const kid = !!p.kid;
    const r = h * (kid ? 0.3 : 0.34);
    const frame = M.paint(kid ? '#d9302f' : '#2f5a9a', dirt);
    const tyre = M.rubber(dirt);
    const wx = w / 2 - r - 0.02;
    for (const x of [-wx, wx]) {
      k.torus(r, kid ? 0.018 : 0.028, tyre, x, r + 0.02, 0, 'z');
      k.torus(r - 0.03, 0.006, M.chrome(dirt), x, r + 0.02, 0, 'z');
      for (let s = 0; s < 6; s++) {
        const a = (s / 6) * Math.PI;
        k.tube(new THREE.Vector3(x + Math.cos(a) * (r - 0.03), r + 0.02 + Math.sin(a) * (r - 0.03), 0), new THREE.Vector3(x - Math.cos(a) * (r - 0.03), r + 0.02 - Math.sin(a) * (r - 0.03), 0), 0.002, M.chrome(dirt), undefined, 4);
      }
    }
    const hub = new THREE.Vector3(-wx, r + 0.02, 0);
    const front = new THREE.Vector3(wx, r + 0.02, 0);
    const crank = new THREE.Vector3(-wx * 0.05, r + 0.04, 0);
    const seat = new THREE.Vector3(-wx * 0.35, h * 0.82, 0);
    const head = new THREE.Vector3(wx * 0.7, h * 0.8, 0);
    k.tube(hub, crank, 0.014, frame);
    k.tube(hub, seat, 0.012, frame);
    k.tube(crank, seat, 0.018, frame);
    k.tube(crank, head, 0.02, frame);
    k.tube(seat, head, 0.018, frame);
    k.tube(head, front, 0.016, frame);
    k.box(0.22, 0.04, 0.1, M.leather('leather_black', dirt), seat.x, seat.y + 0.04, 0);
    k.tube(new THREE.Vector3(head.x, head.y, 0), new THREE.Vector3(head.x - 0.02, head.y + 0.1, 0), 0.012, M.chrome(dirt));
    k.tube(new THREE.Vector3(head.x - 0.02, head.y + 0.1, -0.24), new THREE.Vector3(head.x - 0.02, head.y + 0.1, 0.24), 0.011, M.chrome(dirt));
    if (kid) for (const z of [-0.14, 0.14]) k.torus(0.07, 0.012, tyre, -wx - 0.08, 0.08, z, 'z');
  },

  golf_bag(k) {
    const { w, h, dirt } = k;
    k.cyl(w * 0.42, w * 0.45, h * 0.78, M.leather('leather_tan', dirt), 0, h * 0.39, 0, 'y', 18);
    k.torus(w * 0.43, 0.012, M.leather('leather_black', dirt), 0, h * 0.78, 0, 'y');
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const x = Math.cos(a) * w * 0.22;
      const z = Math.sin(a) * w * 0.22;
      k.cyl(0.006, 0.006, h * 0.3, M.chrome(dirt), x, h * 0.9, z);
      k.box(0.06, 0.03, 0.02, i % 2 ? M.chrome(dirt) : M.plastic('#1d1d1f', dirt), x + 0.02, h - 0.02, z);
    }
  },

  skis(k) {
    const { w, h, d, dirt } = k;
    for (const x of [-w * 0.22, w * 0.22]) {
      k.rbox(0.07, h, d * 0.3, 0.02, M.wood('oak', dirt), x, h / 2, 0);
      k.box(0.075, 0.08, d * 0.5, M.darkMetal(dirt), x, h * 0.45, -d * 0.1);
    }
  },

  dumbbells(k) {
    const { w, h, d, dirt } = k;
    for (const z of [-d * 0.25, d * 0.25]) {
      k.cyl(0.015, 0.015, w * 0.9, M.chrome(dirt), 0, h / 2, z, 'x', 10);
      for (const x of [-w * 0.35, w * 0.35]) k.cyl(h / 2, h / 2, 0.06, Materials.color('#1a1a1a', 0.6, 0.3, dirt), x, h / 2, z, 'x', 16);
    }
  },
};
