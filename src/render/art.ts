import * as THREE from 'three';
import { RNG } from '../core/rng';
import { FONT_MARKER, FONT_STENCIL, FONT_UI, makeCanvas } from './textures';

/**
 * Procedural artwork: paintings, posters, comic covers, box art.
 * Drawn once per style/seed and cached.
 */

const cache = new Map<string, THREE.CanvasTexture>();

function tex(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, rng: RNG) => void, seed = 1): THREE.CanvasTexture {
  const k = `${key}:${seed}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const [c, ctx] = makeCanvas(w, h);
  draw(ctx, new RNG(seed * 97 + key.length));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(k, t);
  return t;
}

export function paintingTexture(style: string, seed: number): THREE.CanvasTexture {
  return tex(`painting:${style}`, 512, 416, (ctx, rng) => {
    const W = 512;
    const H = 416;
    if (style === 'portrait') {
      const bg = ctx.createRadialGradient(W / 2, H * 0.4, 20, W / 2, H / 2, W * 0.7);
      bg.addColorStop(0, '#4a3a26');
      bg.addColorStop(1, '#120d08');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1a140e';
      ctx.beginPath();
      ctx.ellipse(W / 2, H * 0.95, W * 0.34, H * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8e0d0';
      ctx.fillRect(W / 2 - 34, H * 0.56, 68, 40);
      ctx.fillStyle = '#c99a7a';
      ctx.beginPath();
      ctx.ellipse(W / 2, H * 0.38, 62, 82, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6d6560';
      ctx.beginPath();
      ctx.ellipse(W / 2, H * 0.26, 70, 40, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3b2a20';
      ctx.fillRect(W / 2 - 30, H * 0.35, 18, 6);
      ctx.fillRect(W / 2 + 12, H * 0.35, 18, 6);
      ctx.fillRect(W / 2 - 22, H * 0.49, 44, 5);
    } else if (style === 'abstract') {
      const cols = ['#d9482b', '#1f3f7a', '#e8c547', '#1a1a1a', '#e9e4d8', '#2f7a5a'];
      ctx.fillStyle = rng.pick(cols);
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = rng.pick(cols);
        ctx.globalAlpha = rng.range(0.75, 0.95);
        ctx.fillRect(rng.range(-40, W * 0.6), rng.range(-40, H * 0.6), rng.range(W * 0.3, W * 0.8), rng.range(H * 0.2, H * 0.6));
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#111';
      ctx.font = `28px ${FONT_MARKER}`;
      ctx.fillText('R. Voss 62', W - 170, H - 24);
    } else {
      // Landscapes: print or oil.
      const oil = style === 'landscape_oil';
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.6);
      sky.addColorStop(0, oil ? '#5c7fa8' : '#8fb4d8');
      sky.addColorStop(1, oil ? '#e8c89a' : '#dfe8ee');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      for (let layer = 0; layer < 3; layer++) {
        ctx.fillStyle = ['#6c7a8a', '#4f6a5a', '#35503a'][layer];
        ctx.beginPath();
        ctx.moveTo(0, H);
        const base = H * (0.45 + layer * 0.1);
        for (let x = 0; x <= W; x += 16) ctx.lineTo(x, base - Math.abs(Math.sin(x * 0.01 * (layer + 1) + seed)) * rng.range(40, 110));
        ctx.lineTo(W, H);
        ctx.fill();
      }
      ctx.fillStyle = oil ? '#3e6f8a' : '#7fb0cc';
      ctx.fillRect(0, H * 0.72, W, H * 0.12);
      if (oil) {
        for (let i = 0; i < 900; i++) {
          ctx.fillStyle = `rgba(${rng.int(40, 230)},${rng.int(40, 210)},${rng.int(40, 180)},0.18)`;
          ctx.fillRect(rng.range(0, W), rng.range(0, H), rng.range(3, 9), rng.range(2, 5));
        }
        ctx.fillStyle = '#2a1a10';
        ctx.font = `22px ${FONT_MARKER}`;
        ctx.fillText('H. Lindgren', W - 150, H - 20);
      }
    }
    // Varnish craquelure.
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      let x = rng.range(0, W);
      let y = rng.range(0, H);
      ctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) { x += rng.range(-14, 14); y += rng.range(-14, 14); ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }, seed);
}

export function posterTexture(kind: string, seed: number): THREE.CanvasTexture {
  return tex(`poster:${kind}`, 360, 512, (ctx, rng) => {
    const W = 360;
    const H = 512;
    if (kind === 'movie') {
      ctx.fillStyle = '#e8d9a8';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#b3261e';
      ctx.font = `900 64px ${FONT_STENCIL}`;
      ctx.textAlign = 'center';
      ctx.fillText('THEM', W / 2, 90);
      ctx.fillText('ANTS!', W / 2, 150);
      ctx.fillStyle = '#1b1b1b';
      ctx.beginPath();
      ctx.ellipse(W / 2, 320, 110, 60, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(W / 2 + 120, 290, 50, 36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#1b1b1b';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(W / 2 - 60 + i * 24, 340);
        ctx.lineTo(W / 2 - 90 + i * 30, 440);
        ctx.stroke();
      }
      ctx.font = `600 22px ${FONT_UI}`;
      ctx.fillText('A MONSTER-SIZED THRILLER', W / 2, 490);
    } else if (kind === 'concert') {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#1d0f3a');
      g.addColorStop(1, '#b0305a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f7d23e';
      ctx.font = `900 58px ${FONT_STENCIL}`;
      ctx.textAlign = 'center';
      ctx.fillText('THE', W / 2, 110);
      ctx.fillText('VELVET', W / 2, 175);
      ctx.fillText('ENGINES', W / 2, 240);
      ctx.font = `600 26px ${FONT_UI}`;
      ctx.fillStyle = '#fff';
      ctx.fillText('LIVE · MAY 14 1977', W / 2, 300);
      ctx.strokeStyle = 'rgba(20,20,60,0.9)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        const x = 60 + i * 70;
        const y = 380 + rng.range(-20, 30);
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + 20, y - 30, x + 30, y + 20, x + 55, y - 10);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#dfe6e0';
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = `hsl(${rng.range(80, 140)},40%,${rng.range(30, 60)}%)`;
        ctx.beginPath();
        ctx.ellipse(rng.range(0, W), rng.range(H * 0.3, H), rng.range(20, 50), rng.range(10, 20), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = `hsl(${rng.range(300, 350)},60%,75%)`;
        ctx.beginPath();
        ctx.arc(rng.range(0, W), rng.range(H * 0.3, H), rng.range(6, 12), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, seed);
}

export function comicCover(kind: 'key' | 'golden' | 'reprint' | 'modern', seed: number): THREE.CanvasTexture {
  return tex(`comic:${kind}`, 256, 370, (ctx, rng) => {
    const W = 256;
    const H = 370;
    const bgs = { key: '#f2c14e', golden: '#5a9bd5', reprint: '#f2c14e', modern: '#7a2ab5' };
    ctx.fillStyle = bgs[kind];
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#c0262d';
    ctx.fillRect(0, 0, W, 70);
    ctx.fillStyle = '#fff';
    ctx.font = `900 34px ${FONT_STENCIL}`;
    ctx.textAlign = 'center';
    ctx.fillText(kind === 'modern' ? 'X-TREME' : 'ASTOUNDING', W / 2, 40);
    ctx.font = `700 20px ${FONT_UI}`;
    ctx.fillText(kind === 'modern' ? 'VARIANT COVER' : 'TALES', W / 2, 62);
    ctx.fillStyle = '#1b2a6b';
    ctx.beginPath();
    ctx.moveTo(W / 2, 120);
    ctx.lineTo(W / 2 + 30, 250);
    ctx.lineTo(W / 2 - 30, 250);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8412a';
    ctx.beginPath();
    ctx.moveTo(W / 2 - 18, 250);
    ctx.lineTo(W / 2, 300 + rng.range(0, 20));
    ctx.lineTo(W / 2 + 18, 250);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = `700 18px ${FONT_UI}`;
    ctx.fillText(kind === 'key' || kind === 'reprint' ? '10¢  No. 1' : kind === 'golden' ? '10¢  No. 17' : '$2.99  #1', W / 2, H - 20);
    if (kind === 'reprint') {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(0, H - 60, W, 18);
      ctx.fillStyle = '#333';
      ctx.font = `600 12px ${FONT_UI}`;
      ctx.fillText('FACSIMILE EDITION', W / 2, H - 47);
    }
    if (kind !== 'modern') {
      ctx.fillStyle = 'rgba(120,90,40,0.25)';
      for (let i = 0; i < 300; i++) ctx.fillRect(rng.range(0, W), rng.range(0, H), 2, 2);
    }
  }, seed);
}

export function consoleBoxArt(sealed: boolean, seed: number): THREE.CanvasTexture {
  return tex(`console:${sealed}`, 512, 360, (ctx) => {
    const W = 512;
    const H = 360;
    ctx.fillStyle = '#101014';
    ctx.fillRect(0, 0, W, H);
    const cols = ['#e53b2f', '#f2a81d', '#2f9be5', '#3bbf5a'];
    cols.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, 40 + i * 22, W, 14);
    });
    ctx.fillStyle = '#fff';
    ctx.font = `900 64px ${FONT_STENCIL}`;
    ctx.textAlign = 'center';
    ctx.fillText('FAMICUBE', W / 2, 230);
    ctx.font = `600 22px ${FONT_UI}`;
    ctx.fillText('ENTERTAINMENT SYSTEM', W / 2, 262);
    ctx.fillStyle = '#c8c8cc';
    ctx.fillRect(W / 2 - 90, 280, 180, 50);
    ctx.fillStyle = '#e53b2f';
    ctx.fillRect(W / 2 - 60, 295, 20, 20);
    ctx.fillRect(W / 2 + 40, 295, 20, 20);
    if (sealed) {
      ctx.fillStyle = '#f7d23e';
      ctx.beginPath();
      ctx.arc(W - 60, 60, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = `800 16px ${FONT_UI}`;
      ctx.fillText('LAUNCH', W - 60, 56);
      ctx.fillText('EDITION', W - 60, 74);
    }
  }, seed);
}

export function recordSleeves(jazz: boolean, seed: number): THREE.CanvasTexture {
  return tex(`sleeves:${jazz}`, 256, 256, (ctx, rng) => {
    for (let i = 0; i < 16; i++) {
      const x = (i % 4) * 64;
      const y = Math.floor(i / 4) * 64;
      ctx.fillStyle = jazz ? rng.pick(['#1b4b8a', '#0e2a4f', '#d9d2c0', '#1a1a1a']) : `hsl(${rng.range(0, 360)},45%,${rng.range(30, 60)}%)`;
      ctx.fillRect(x, y, 64, 64);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(x + 8, y + 8, rng.range(20, 48), 6);
    }
  }, seed);
}

export function cardGrid(holo: boolean, seed: number): THREE.CanvasTexture {
  return tex(`cards:${holo}`, 256, 256, (ctx, rng) => {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9; i++) {
      const x = 8 + (i % 3) * 82;
      const y = 8 + Math.floor(i / 3) * 82;
      ctx.fillStyle = '#f2d34a';
      ctx.fillRect(x, y, 76, 76);
      const g = ctx.createLinearGradient(x, y, x + 76, y + 76);
      if (holo) {
        g.addColorStop(0, '#ff6ad5');
        g.addColorStop(0.5, '#6ae8ff');
        g.addColorStop(1, '#fff36a');
      } else {
        const hue = rng.range(0, 360);
        g.addColorStop(0, `hsl(${hue},55%,55%)`);
        g.addColorStop(1, `hsl(${hue + 40},55%,35%)`);
      }
      ctx.fillStyle = g;
      ctx.fillRect(x + 6, y + 6, 64, 40);
    }
  }, seed);
}

export function handheldScreen(): THREE.CanvasTexture {
  return tex('handheld', 64, 64, (ctx) => {
    ctx.fillStyle = '#8b9c4a';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#2e3d1a';
    ctx.fillRect(10, 40, 14, 14);
    ctx.fillRect(34, 20, 8, 34);
  });
}

export function labelTexture(text: string, bg: string, fg: string, w = 256, h = 64): THREE.CanvasTexture {
  return tex(`label:${text}:${bg}:${fg}`, w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.font = `800 ${Math.floor(h * 0.6)}px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

export function monogram(dial: string, ink: string, text: string): THREE.CanvasTexture {
  return tex(`dial:${dial}:${ink}:${text}`, 128, 128, (ctx) => {
    ctx.fillStyle = dial;
    ctx.beginPath();
    ctx.arc(64, 64, 64, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50);
      ctx.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58);
      ctx.stroke();
    }
    ctx.fillStyle = ink;
    ctx.font = `700 14px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.fillText(text, 64, 44);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(64, 64);
    ctx.lineTo(64 + 30, 64 - 18);
    ctx.moveTo(64, 64);
    ctx.lineTo(64 - 8, 64 + 38);
    ctx.stroke();
  });
}
