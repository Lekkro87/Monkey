import * as THREE from 'three';
import { cardGrid, comicCover, labelTexture, monogram, paintingTexture, posterTexture } from '../art';
import { M, Materials } from '../materials';
import type { Kit } from './kit';

/** Small items, collectibles, art, fashion, junk, story items and box fillers. */
export const SMALLS: Record<string, (k: Kit) => void> = {
  watch(k) {
    const { w, h, d, dirt, p } = k;
    const style = p.style as string;
    const caseMat = style === 'quartz' ? Materials.get({ color: '#c9a860', rough: 0.3, metal: 0.8 }, dirt) : M.steel(dirt);
    const r = w * 0.45;
    k.cyl(r, r, h * 0.55, caseMat, 0, h * 0.3, 0, 'y', 28);
    const dial = style === 'vintage' ? '#efe6cf' : style === 'diver' ? '#101418' : style === 'chrono' ? '#e8e4da' : '#f4f1ea';
    const ink = style === 'diver' ? '#e8e8e8' : '#111111';
    const face = new THREE.Mesh(new THREE.CircleGeometry(r * 0.86, 28), Materials.get({ map: monogram(dial, ink, style === 'quartz' ? 'QUARTZ' : 'KRONHAUS'), rough: 0.3 }));
    face.rotation.x = -Math.PI / 2;
    face.position.y = h * 0.58 + 0.001;
    k.root.add(face);
    if (style === 'diver') k.torus(r * 0.92, r * 0.1, Materials.color('#111', 0.3, 0.4), 0, h * 0.58, 0, 'y');
    if (style === 'chrono') {
      for (const x of [-r * 0.35, r * 0.35]) {
        const sub = new THREE.Mesh(new THREE.CircleGeometry(r * 0.2, 16), Materials.color('#1a1a1a', 0.4));
        sub.rotation.x = -Math.PI / 2;
        sub.position.set(x, h * 0.58 + 0.002, r * 0.2);
        k.root.add(sub);
      }
      for (const z of [-r * 0.5, r * 0.5]) k.cyl(0.003, 0.003, 0.008, M.steel(dirt), r + 0.004, h * 0.3, z, 'x', 8);
    }
    k.box(w * 0.08, w * 0.08, w * 0.12, M.steel(dirt), r + 0.004, h * 0.3, 0);
    const strap = style === 'diver' || style === 'chrono' ? M.steel(dirt) : M.leather(style === 'vintage' ? 'leather' : 'leather_black', dirt);
    for (const s of [-1, 1]) k.box(w * 0.58, h * 0.25, d * 0.36, strap, 0, h * 0.13, s * (r + d * 0.18));
    k.parts.glint = new THREE.Vector3(0, h * 0.6, 0);
  },

  pocket_watch(k) {
    const { w, h, dirt, p } = k;
    const metal = p.gold ? M.gold(dirt) : M.brass(dirt);
    const r = w * 0.42;
    k.cyl(r, r, h * 0.7, metal, 0, h * 0.35, -0.004, 'y', 28);
    k.cyl(0.006, 0.006, 0.012, metal, 0, h * 0.35, -r - 0.004, 'z', 10);
    k.torus(0.009, 0.0025, metal, 0, h * 0.35, -r - 0.016, 'x');
    for (let i = 0; i < 6; i++) k.torus(0.005, 0.0015, metal, -0.01 - i * 0.008, h * 0.2, -r - 0.022 - i * 0.004, i % 2 ? 'x' : 'z');
    k.parts.glint = new THREE.Vector3(0, h * 0.7, 0);
  },

  jewelry(k) {
    const { w, h, d, dirt, p } = k;
    const style = p.style as string;
    const box = k.rbox(w, h * 0.65, d, 0.008, M.fabric(style === 'costume' ? '#2a2a6a' : '#5a1025', 'plain', dirt), 0, h * 0.32, 0);
    box.castShadow = true;
    if (style === 'ring') {
      k.torus(0.011, 0.0025, M.gold(dirt), 0, h * 0.72, 0, 'x');
      k.sphere(0.005, Materials.get({ color: '#1f3fb0', rough: 0.05, metal: 0.2 }), 0, h * 0.72 + 0.013, 0, 12);
    } else if (style === 'necklace') {
      k.torus(0.02, 0.0015, M.silver(dirt), 0, h * 0.68, 0, 'y');
      k.sphere(0.004, M.silver(dirt), 0, h * 0.68, -0.02, 8);
    } else if (style === 'brooch') {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        k.sphere(0.004, Materials.get({ color: '#f4fbff', rough: 0.02, metal: 0.1, emissive: '#223344', emissiveIntensity: 0.3 }), Math.cos(a) * 0.012, h * 0.68, Math.sin(a) * 0.012, 8);
      }
      k.torus(0.015, 0.002, M.silver(dirt), 0, h * 0.67, 0, 'y');
    } else {
      for (let i = 0; i < 8; i++) k.sphere(0.004, Materials.get({ color: ['#c43d2f', '#e0b04a', '#2f9be5'][i % 3], rough: 0.2 }), -0.02 + i * 0.006, h * 0.68, Math.sin(i) * 0.008, 8);
    }
    k.parts.glint = new THREE.Vector3(0, h * 0.7, 0);
  },

  handbag(k) {
    const { w, h, d, dirt, p } = k;
    const skin = p.designer ? Materials.get({ fabric: { color: '#6b4a2a', pattern: 'check' } }, dirt) : M.leather('leather_black', dirt);
    const body = k.rbox(w, h * 0.72, d, 0.04, skin, 0, h * 0.36, 0);
    body.scale.x = 1;
    k.torus(w * 0.25, 0.01, M.leather(p.designer ? 'leather_tan' : 'leather_black', dirt), 0, h * 0.72, 0, 'z', Math.PI);
    k.box(0.04, 0.03, 0.01, M.gold(dirt), 0, h * 0.62, -d / 2 - 0.005);
  },

  shoebox(k) {
    const { w, h, d, dirt, p } = k;
    const color = p.hype ? '#e8702a' : '#8a8078';
    k.box(w, h * 0.8, d, Materials.color(color, 0.7, 0, dirt), 0, h * 0.4, 0);
    const lid = k.pivot(0, h * 0.8, d / 2);
    k.box(w + 0.01, h * 0.22, d + 0.01, Materials.color(p.hype ? '#e8702a' : '#6a6058', 0.7, 0, dirt), 0, h * 0.11, -d / 2, lid);
    k.parts.lid = lid;
    k.box(w * 0.4, h * 0.25, 0.003, Materials.get({ map: labelTexture(p.hype ? 'DUNKERS' : 'SIZE 10', '#f2efe6', '#111'), rough: 0.6 }), w * 0.2, h * 0.45, -d / 2 - 0.002);
  },

  jacket(k) {
    const { w, h, d, dirt } = k;
    const leather = M.leather('leather_black', dirt);
    k.rbox(w, h * 0.8, d, 0.03, leather, 0, h * 0.4, 0);
    k.rbox(w * 0.9, h * 0.35, d * 0.25, 0.02, leather, 0, h * 0.8, d * 0.35);
    k.box(0.006, 0.004, d * 0.8, M.chrome(dirt), -w * 0.1, h * 0.81, -0.02);
    for (const x of [-w * 0.3, w * 0.3]) k.box(0.02, 0.005, 0.02, M.chrome(dirt), x, h * 0.81, -d * 0.2);
  },

  comic_box(k) {
    const { w, h, d, dirt, p } = k;
    const board = Materials.color(p.old ? '#e0d6bc' : '#f2efe8', 0.8, 0, dirt);
    k.box(w, h, d, board, 0, h / 2, 0);
    k.box(w + 0.006, 0.05, d + 0.006, board, 0, h - 0.025, 0);
    k.box(w * 0.7, h * 0.3, 0.003, Materials.get({ map: labelTexture(p.old ? 'SILVER AGE' : 'COMICS', '#f2efe8', '#1b2a6b'), rough: 0.8 }), 0, h * 0.5, -d / 2 - 0.002);
  },

  comic(k) {
    const { w, h, d, p } = k;
    const kind = p.key ? 'key' : p.reprint ? 'reprint' : 'golden';
    const cover = Materials.get({ map: comicCover(kind as 'key' | 'golden' | 'reprint', 1), rough: 0.7 });
    k.box(w * 0.94, h * 0.6, d * 0.94, M.paper('#e8dfc8'), 0, h * 0.3, 0);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, d * 0.94), cover);
    top.rotation.x = -Math.PI / 2;
    top.position.y = h * 0.6 + 0.0005;
    k.root.add(top);
    k.box(w, h, d, Materials.get({ color: '#ffffff', rough: 0.1, metal: 0.1, opacity: 0.22 }), 0, h / 2, 0);
    if (p.key) k.parts.glint = new THREE.Vector3(0, h, 0);
  },

  binder(k) {
    const { w, h, d, dirt, p } = k;
    k.rbox(w, h, d, 0.005, M.plastic(p.holo ? '#1d1d6a' : '#b3261e', dirt), 0, h / 2, 0);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, d * 0.8), Materials.get({ map: cardGrid(!!p.holo, 1), rough: 0.35, metal: p.holo ? 0.4 : 0 }));
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.set(0.02, h + 0.001, 0);
    k.root.add(sheet);
    k.box(0.02, h + 0.004, d, M.plastic('#222', dirt), -w / 2 + 0.01, h / 2, 0);
  },

  coin_jar(k) {
    const { w, h, dirt } = k;
    k.cyl(w / 2, w / 2, h * 0.88, M.glass(), 0, h * 0.44, 0, 'y', 20);
    k.cyl(w * 0.45, w * 0.45, h * 0.12, M.brass(dirt), 0, h * 0.94, 0, 'y', 20);
    for (let i = 0; i < 26; i++) {
      const c = k.cyl(0.012, 0.012, 0.003, i % 3 ? M.brass(dirt) : M.silver(dirt), k.rng.range(-w * 0.3, w * 0.3), 0.01 + (i / 26) * h * 0.5, k.rng.range(-w * 0.3, w * 0.3), 'y', 10);
      c.rotation.set(k.rng.range(0, 1.5), 0, k.rng.range(0, 1.5));
    }
  },

  coin_album(k) {
    const { w, h, d, dirt } = k;
    k.box(w, h, d, M.plastic('#1f3a7a', dirt), 0, h / 2, 0);
    for (let i = 0; i < 12; i++) k.cyl(0.018, 0.018, 0.003, M.silver(dirt), -w * 0.3 + (i % 4) * w * 0.2, h + 0.001, -d * 0.25 + Math.floor(i / 4) * d * 0.25, 'y', 16);
    k.box(w * 0.5, 0.002, 0.04, M.gold(), 0, h + 0.001, d * 0.4);
  },

  coin(k) {
    const { w, h, dirt, p } = k;
    k.cyl(w * 0.38, w * 0.38, h * 0.5, p.gold ? M.gold(dirt) : Materials.get({ color: '#8a3a2a', rough: 0.5 }, dirt), 0, h * 0.5, 0, 'y', 24);
    k.cyl(w / 2, w / 2, h, Materials.get({ color: '#ffffff', rough: 0.05, opacity: 0.25 }), 0, h / 2, 0, 'y', 24);
    k.parts.glint = new THREE.Vector3(0, h, 0);
  },

  robot(k) {
    const { w, h, d, dirt, p } = k;
    const tin = !!p.tin;
    const body = tin ? Materials.get({ color: '#b8bcc0', rough: 0.3, metal: 0.8 }, dirt) : M.plastic('#2f6ab0', dirt);
    const accent = tin ? M.paint('#c43d2f', dirt) : M.plastic('#e8b020', dirt);
    k.box(w * 0.55, h * 0.4, d * 0.6, body, 0, h * 0.42, 0);
    k.box(w * 0.4, h * 0.25, d * 0.5, body, 0, h * 0.75, 0);
    for (const x of [-w * 0.12, w * 0.12]) k.sphere(0.012, M.emissive(tin ? '#ffcf5a' : '#5affc8', tin ? 0.8 : 0.3), x, h * 0.78, -d * 0.26, 8);
    k.cyl(0.004, 0.004, h * 0.12, M.chrome(dirt), 0, h * 0.92, 0);
    k.sphere(0.01, accent, 0, h * 0.98, 0, 8);
    for (const x of [-w * 0.36, w * 0.36]) k.box(w * 0.14, h * 0.35, d * 0.25, body, x, h * 0.45, 0);
    for (const x of [-w * 0.14, w * 0.14]) k.box(w * 0.18, h * 0.22, d * 0.4, accent, x, h * 0.11, 0);
    k.box(w * 0.35, h * 0.12, 0.004, accent, 0, h * 0.45, -d * 0.3 - 0.002);
  },

  baseball(k) {
    const { w, h, d, dirt, p } = k;
    k.box(w, 0.015, d, M.wood('walnut', dirt), 0, 0.0075, 0);
    k.box(w * 0.96, h - 0.015, d * 0.96, Materials.get({ color: '#ffffff', rough: 0.05, opacity: 0.2 }), 0, 0.015 + (h - 0.015) / 2, 0);
    const r = Math.min(w, d) * 0.36;
    k.sphere(r, Materials.color('#f2ede0', 0.6, 0, dirt), 0, 0.015 + r + 0.005, 0, 20);
    k.torus(r * 0.98, 0.0015, Materials.color('#b3261e', 0.6), 0, 0.02 + r, 0, 'x');
    if (p.signed) k.box(r * 0.8, 0.002, 0.002, Materials.color('#1b2a6b', 0.5), 0, 0.02 + r * 1.2, -r * 0.62);
  },

  poster(k) {
    const { w, h, d, dirt, p } = k;
    const frame = Materials.color('#1a1a1a', 0.4, 0.3, dirt);
    const t = 0.025;
    k.box(w, t, d, frame, 0, t / 2, 0);
    k.box(w, t, d, frame, 0, h - t / 2, 0);
    k.box(t, h, d, frame, -w / 2 + t / 2, h / 2, 0);
    k.box(t, h, d, frame, w / 2 - t / 2, h / 2, 0);
    k.box(w - 2 * t, h - 2 * t, d * 0.4, Materials.get({ map: posterTexture(p.kind as string, 1), rough: 0.6 }, dirt), 0, h / 2, 0);
    k.box(w - 2 * t, h - 2 * t, 0.002, M.glass(), 0, h / 2, -d / 2 + 0.004);
  },

  painting(k) {
    const { w, h, d, dirt, p } = k;
    const style = p.style as string;
    const frame = style === 'landscape_print' ? M.wood('oak', dirt) : style === 'abstract' ? Materials.color('#e8e4dc', 0.5, 0, dirt) : M.gold(dirt);
    const t = style === 'abstract' ? 0.02 : 0.06;
    for (const [fw, fh, x, y] of [[w, t, 0, t / 2], [w, t, 0, h - t / 2], [t, h, -w / 2 + t / 2, h / 2], [t, h, w / 2 - t / 2, h / 2]] as [number, number, number, number][]) {
      k.box(fw, fh, d, frame, x, y, 0);
    }
    const canvas = Materials.get({ map: paintingTexture(style, k.rng.int(1, 3)), rough: style === 'landscape_print' ? 0.5 : 0.75 }, dirt);
    k.box(w - 2 * t, h - 2 * t, d * 0.5, canvas, 0, h / 2, d * 0.1);
  },

  vase(k) {
    const { w, h, dirt, p } = k;
    const qing = p.style === 'qing';
    const glaze = qing ? Materials.get({ color: '#f6f8fa', rough: 0.12 }, dirt) : Materials.get({ color: '#dfe8f2', rough: 0.2 }, dirt);
    k.lathe([[0, 0], [w * 0.28, 0], [w * 0.34, h * 0.08], [w * 0.5, h * 0.35], [w * 0.46, h * 0.55], [w * 0.2, h * 0.78], [w * 0.16, h * 0.9], [w * 0.22, h], [0.001, h]], glaze, 0, 0, 0, 28);
    for (let i = 0; i < (qing ? 4 : 2); i++) k.torus(w * (0.44 - i * 0.03), 0.003, Materials.color('#1f3f8a', 0.2), 0, h * (0.3 + i * 0.12), 0, 'y');
    if (qing) k.parts.glint = new THREE.Vector3(0, h * 0.5, -w * 0.5);
  },

  trash_bag(k) {
    const { w, h, d, rng } = k;
    // Indexed sphere, displaced by smooth lumps so the plastic stays continuous.
    const g = new THREE.SphereGeometry(0.5, 20, 14);
    const pos = g.attributes.position;
    const lumps = Array.from({ length: 6 }, () => new THREE.Vector3(rng.range(-1, 1), rng.range(-0.4, 1), rng.range(-1, 1)).normalize());
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = v.clone().normalize();
      let bump = 0;
      for (const l of lumps) bump += Math.max(0, n.dot(l) - 0.55) * 0.35;
      v.multiplyScalar(1 + bump + Math.sin(v.x * 23 + v.z * 17) * 0.012);
      if (v.y < -0.32) v.y = -0.32 + (v.y + 0.32) * 0.15;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, Materials.get({ color: '#141416', rough: 0.35, metal: 0.1 }));
    m.scale.set(w, h * 1.18, d);
    m.position.y = h * 0.36 + 0.02;
    m.castShadow = m.receiveShadow = true;
    k.root.add(m);
    k.cyl(0.03, 0.05, 0.08, Materials.get({ color: '#141416', rough: 0.35 }), 0, h - 0.04, 0);
  },

  paint_cans(k) {
    const { w, h, d, dirt, rng } = k;
    for (let i = 0; i < 3; i++) {
      const x = -w * 0.3 + i * w * 0.3;
      const z = rng.range(-d * 0.15, d * 0.15);
      k.cyl(0.08, 0.08, h * 0.9, M.steel(dirt), x, h * 0.45, z, 'y', 18);
      k.cyl(0.081, 0.081, h * 0.4, Materials.color(rng.pick(['#e8e4dc', '#7a9ab8', '#c8b87a']), 0.6), x, h * 0.45, z, 'y', 18);
      k.cyl(0.082, 0.082, 0.01, Materials.color('#f2efe8', 0.7), x, h * 0.9, z, 'y', 18);
    }
  },

  tire(k) {
    const { w, h, dirt } = k;
    k.torus(w * 0.36, h * 0.5, M.rubber(dirt), 0, h / 2, 0, 'y');
    k.cyl(w * 0.22, w * 0.22, h * 0.5, M.steel(dirt), 0, h / 2, 0, 'y', 16);
  },

  cables(k) {
    const { w, h, d, dirt, rng } = k;
    const board = M.cardboard(2, dirt);
    k.box(w, 0.01, d, board, 0, 0.005, 0);
    for (const [x, z, ww, dd] of [[-w / 2, 0, 0.01, d], [w / 2, 0, 0.01, d], [0, -d / 2, w, 0.01], [0, d / 2, w, 0.01]] as [number, number, number, number][]) k.box(ww, h, dd, board, x, h / 2, z);
    for (let i = 0; i < 6; i++) {
      const t = k.torus(rng.range(0.05, 0.09), 0.006, Materials.color(rng.pick(['#111', '#eee', '#555']), 0.5), rng.range(-w * 0.2, w * 0.2), h * 0.7, rng.range(-d * 0.2, d * 0.2), 'y');
      t.rotation.set(rng.range(0, 1), rng.range(0, 3), rng.range(0, 1));
    }
  },

  papers(k) {
    const { w, h, d, dirt, p } = k;
    const n = Math.max(3, Math.floor(h / 0.006));
    for (let i = 0; i < n; i++) {
      const s = k.box(w * 0.95, 0.004, d * 0.95, M.paper(p.bonds ? '#d8e8d0' : '#ece6d4', dirt), 0, 0.002 + i * 0.006, 0);
      s.rotation.y = k.rng.range(-0.06, 0.06);
    }
    k.box(0.006, h + 0.004, d, Materials.color('#8a6a3a', 0.9), 0, h / 2, 0);
  },

  cash(k) {
    const { w, h, d } = k;
    const bill = Materials.get({ color: '#8fa878', rough: 0.8 });
    for (let i = 0; i < 4; i++) k.box(w, h / 4, d, bill, 0, h / 8 + (i * h) / 4, 0).rotation.y = k.rng.range(-0.08, 0.08);
    k.box(0.012, h + 0.002, d + 0.004, Materials.color('#b3261e', 0.6), 0, h / 2, 0);
    k.parts.glint = new THREE.Vector3(0, h, 0);
  },

  film_rolls(k) {
    const { w, h, d } = k;
    for (let i = 0; i < 4; i++) {
      const x = -w * 0.3 + (i % 2) * w * 0.6;
      const z = -d * 0.25 + Math.floor(i / 2) * d * 0.5;
      k.cyl(0.016, 0.016, h * 0.8, Materials.color('#111', 0.4), x, h * 0.4, z, 'y', 14);
      k.cyl(0.017, 0.017, h * 0.2, Materials.color('#7a7a7a', 0.5), x, h * 0.9, z, 'y', 14);
    }
  },

  press_pass(k) {
    const { w, h, d } = k;
    k.box(w, h, d, Materials.get({ map: labelTexture('PRESS · E. MARLOW', '#f2efe6', '#b3261e', 256, 96), rough: 0.25 }), 0, h / 2, 0);
    k.torus(0.03, 0.003, Materials.color('#1b2a6b', 0.7), 0, h, -d / 2 - 0.025, 'y');
  },

  letters(k) {
    const { w, h, d } = k;
    for (let i = 0; i < 6; i++) k.box(w * 0.95, h / 7, d * 0.95, M.paper(i % 2 ? '#f2ecd8' : '#e8dcc0'), k.rng.range(-0.005, 0.005), h / 14 + (i * h) / 7, 0).rotation.y = k.rng.range(-0.1, 0.1);
    k.box(0.01, h + 0.004, d + 0.004, Materials.color('#b3261e', 0.6), 0, h / 2, 0);
    k.box(w + 0.004, h + 0.004, 0.01, Materials.color('#b3261e', 0.6), 0, h / 2, 0);
  },

  camera_bag(k) {
    const { w, h, d, dirt } = k;
    const leather = M.leather('leather', dirt);
    k.rbox(w, h * 0.85, d, 0.03, leather, 0, h * 0.42, 0);
    k.rbox(w * 1.02, h * 0.3, d * 0.2, 0.02, leather, 0, h * 0.72, -d * 0.45);
    k.box(0.05, 0.025, 0.004, M.brass(dirt), 0, h * 0.62, -d / 2 - 0.03);
    k.torus(w * 0.45, 0.01, leather, 0, h * 0.85, 0, 'z', Math.PI);
  },

  archive_box(k) {
    const { w, h, d } = k;
    k.box(w, h, d, Materials.color('#8f959a', 0.8), 0, h / 2, 0);
    k.box(w * 0.5, h * 0.25, 0.003, Materials.get({ map: labelTexture('MARLOW 1965–79', '#f2efe6', '#222'), rough: 0.7 }), 0, h * 0.55, -d / 2 - 0.002);
  },

  // ── Fillers ────────────────────────────────────────────────────────────────
  utensils(k) {
    const { w, h, d, dirt, rng } = k;
    k.box(w, h * 0.3, d, M.plastic('#e8e4dc', dirt), 0, h * 0.15, 0);
    for (let i = 0; i < 8; i++) {
      const u = k.box(w * 0.8, 0.012, 0.018, i % 3 ? M.chrome(dirt) : M.wood('pine', dirt), rng.range(-0.02, 0.02), h * 0.35 + i * 0.008, -d * 0.35 + i * d * 0.1);
      u.rotation.y = rng.range(-0.3, 0.3);
    }
  },

  vhs(k) {
    const { w, h, d, rng } = k;
    let y = 0;
    let i = 0;
    while (y < h - 0.02) {
      const c = k.box(0.19, 0.025, 0.105, Materials.color('#141414', 0.5), rng.range(-0.02, 0.02) - w * 0.2 + (i % 2) * w * 0.4, y + 0.0125, rng.range(-d * 0.1, d * 0.1));
      c.rotation.y = rng.range(-0.2, 0.2);
      k.box(0.12, 0.004, 0.06, Materials.color(rng.pick(['#e8e0c8', '#c43d2f', '#2f6ab0']), 0.6), c.position.x, y + 0.027, c.position.z);
      if (i % 2) y += 0.026;
      i++;
    }
  },

  knickknacks(k) {
    const { w, h, d, dirt, rng } = k;
    k.lathe([[0, 0], [0.03, 0], [0.035, 0.05], [0.02, 0.09], [0, 0.1]], Materials.color('#c8a870', 0.4, 0, dirt), -w * 0.3, 0, 0);
    k.sphere(0.045, Materials.get({ color: '#dfefff', rough: 0.05, opacity: 0.5 }), 0, 0.075, 0, 16);
    k.cyl(0.045, 0.05, 0.03, M.wood('walnut', dirt), 0, 0.015, 0);
    const owl = k.sphere(0.035, Materials.color(rng.pick(['#8a6a4a', '#5a7a8a']), 0.5, 0, dirt), w * 0.28, 0.035, d * 0.1, 12);
    owl.scale.y = 1.4;
    void h;
  },

  frames(k) {
    const { w, h, d, dirt, rng } = k;
    for (let i = 0; i < 3; i++) {
      const f = k.box(w * (1 - i * 0.12), h * (1 - i * 0.15), 0.015, M.wood(rng.pick(['oak', 'walnut', 'painted_white'] as const), dirt), 0, (h * (1 - i * 0.15)) / 2, -d / 2 + 0.01 + i * 0.018);
      f.rotation.y = rng.range(-0.05, 0.05);
    }
  },

  clothes(k) {
    const { w, h, d, dirt, rng } = k;
    let y = 0;
    while (y < h - 0.02) {
      const th = rng.range(0.03, 0.045);
      const c = k.rbox(w * rng.range(0.85, 1), th, d * rng.range(0.8, 1), 0.012, M.fabric(rng.pick(['#c8b89a', '#6a7a8a', '#8a4a4a', '#4a5a4a', '#e8e0d0']), rng.chance(0.3) ? 'check' : 'weave', dirt), 0, y + th / 2, 0);
      c.rotation.y = rng.range(-0.1, 0.1);
      y += th;
    }
  },

  towels(k) {
    const { w, h, d, dirt, rng } = k;
    let y = 0;
    while (y < h - 0.02) {
      const th = 0.035;
      k.rbox(w * 0.95, th, d * 0.9, 0.015, M.fabric(rng.pick(['#e8b8c8', '#b8d8e8', '#f2efe6', '#c8e8b8']), 'weave', dirt), rng.range(-0.01, 0.01), y + th / 2, 0);
      y += th;
    }
  },

  dvds(k) {
    const { w, h, d, rng } = k;
    let y = 0;
    while (y < h - 0.012) {
      const c = k.box(0.135, 0.014, 0.19, Materials.color(rng.pick(['#1a1a1a', '#1f3f8a', '#8a1f2a', '#2a2a2a']), 0.35), 0, y + 0.007, 0);
      c.rotation.y = rng.range(-0.15, 0.15);
      y += 0.015;
    }
    void w;
    void d;
  },

  board_games(k) {
    const { w, h, d, rng } = k;
    let y = 0;
    while (y < h - 0.02) {
      const bh = rng.range(0.04, 0.06);
      const b = k.box(w * rng.range(0.8, 1), bh, d * rng.range(0.8, 1), Materials.color(rng.pick(['#b3261e', '#2f6ab0', '#e0b030', '#3a8a5a']), 0.6), 0, y + bh / 2, 0);
      b.rotation.y = rng.range(-0.1, 0.1);
      y += bh;
    }
  },

  plush(k) {
    const { w, h, d, dirt } = k;
    const fur = M.fabric('#9a6a3a', 'weave', dirt);
    k.sphere(w * 0.32, fur, 0, w * 0.32, 0, 14);
    k.sphere(w * 0.24, fur, 0, h * 0.72, -d * 0.05, 14);
    for (const x of [-w * 0.16, w * 0.16]) k.sphere(w * 0.08, fur, x, h * 0.92, -d * 0.05, 8);
    k.sphere(w * 0.06, Materials.color('#2a1a10', 0.6), 0, h * 0.68, -d * 0.28, 8);
  },

  hand_tools(k) {
    const { w, h, d, dirt } = k;
    k.box(w * 0.2, 0.03, 0.03, M.steel(dirt), -w * 0.1, h * 0.3, -d * 0.2);
    k.box(w * 0.06, 0.02, d * 0.6, M.wood('oak', dirt), -w * 0.1, h * 0.3, d * 0.05);
    k.box(w * 0.8, 0.015, 0.03, M.chrome(dirt), 0, h * 0.2, d * 0.2).rotation.y = 0.3;
    k.cyl(0.012, 0.012, w * 0.35, M.plastic('#e8b020', dirt), w * 0.1, h * 0.5, -d * 0.05, 'x', 10);
    k.cyl(0.003, 0.003, w * 0.3, M.chrome(dirt), w * 0.1 + w * 0.3, h * 0.5, -d * 0.05, 'x', 6);
  },

  office(k) {
    const { w, h, d, dirt } = k;
    k.box(w * 0.3, h * 0.9, d * 0.8, M.plastic('#2f5a9a', dirt), -w * 0.3, h * 0.45, 0);
    k.box(w * 0.3, h * 0.9, d * 0.8, M.plastic('#b3261e', dirt), 0, h * 0.45, 0);
    k.box(w * 0.25, h * 0.35, d * 0.3, M.plastic('#1a1a1a', dirt), w * 0.3, h * 0.18, 0);
  },

  sports_gear(k) {
    const { w, h, d, dirt } = k;
    k.rbox(w, h * 0.6, d, 0.05, M.fabric('#2a2a2a', 'check', dirt), 0, h * 0.3, 0);
    k.sphere(h * 0.4, Materials.color('#f2f2f2', 0.5, 0, dirt), w * 0.15, h * 0.55, 0, 16);
    k.rbox(w * 0.3, h * 0.25, d * 0.5, 0.03, M.plastic('#2f6ab0', dirt), -w * 0.25, h * 0.7, 0);
  },

  cassettes(k) {
    const { w, h, d, rng } = k;
    let y = 0;
    let i = 0;
    while (y < h - 0.012) {
      const c = k.box(0.11, 0.017, 0.07, Materials.get({ color: '#ffffff', rough: 0.2, opacity: 0.6 }), -w * 0.2 + (i % 2) * w * 0.4, y + 0.0085, rng.range(-d * 0.1, d * 0.1));
      k.box(0.09, 0.012, 0.05, Materials.color(rng.pick(['#e8e0c8', '#f2d34a', '#e85a8a']), 0.6), c.position.x, y + 0.0085, c.position.z);
      if (i % 2) y += 0.018;
      i++;
    }
  },
};
