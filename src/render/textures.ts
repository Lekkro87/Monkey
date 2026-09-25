import * as THREE from 'three';
import { RNG } from '../core/rng';

/**
 * Procedural texture factory. Every surface in the game is painted on a canvas at
 * startup: no external image assets. Noise is periodic so textures tile seamlessly.
 */

export function makeCanvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  return [c, ctx];
}

/** Tileable value noise, fbm'd. Returns values in [0, 1]. */
export function noiseField(size: number, opts: { octaves?: number; period?: number; seed?: number; stretchX?: number; stretchY?: number } = {}): Float32Array {
  const octaves = opts.octaves ?? 4;
  const basePeriod = opts.period ?? 8;
  const rng = new RNG(opts.seed ?? 1);
  const out = new Float32Array(size * size);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const px = Math.max(1, Math.round(basePeriod * (1 << o) / (opts.stretchX ?? 1)));
    const py = Math.max(1, Math.round(basePeriod * (1 << o) / (opts.stretchY ?? 1)));
    const lattice = new Float32Array(px * py);
    for (let i = 0; i < lattice.length; i++) lattice[i] = rng.next();
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * py;
      const y0 = Math.floor(fy);
      const ty = smooth(fy - y0);
      const y1 = (y0 + 1) % py;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * px;
        const x0 = Math.floor(fx);
        const tx = smooth(fx - x0);
        const x1 = (x0 + 1) % px;
        const a = lattice[y0 * px + x0];
        const b = lattice[y0 * px + x1];
        const c = lattice[y1 * px + x0];
        const d = lattice[y1 * px + x1];
        out[y * size + x] += amp * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty);
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

function hexToRgb(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
}

/** Paint a noise field into a canvas as a colour ramp between two colours. */
export function paintNoise(ctx: CanvasRenderingContext2D, size: number, field: Float32Array, dark: string, light: string, contrast = 1) {
  const img = ctx.getImageData(0, 0, size, size);
  const a = hexToRgb(dark);
  const b = hexToRgb(light);
  for (let i = 0; i < field.length; i++) {
    const t = Math.min(1, Math.max(0, 0.5 + (field[i] - 0.5) * contrast));
    img.data[i * 4] = a[0] + (b[0] - a[0]) * t;
    img.data[i * 4 + 1] = a[1] + (b[1] - a[1]) * t;
    img.data[i * 4 + 2] = a[2] + (b[2] - a[2]) * t;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export function heightFromCanvas(ctx: CanvasRenderingContext2D, size: number): Float32Array {
  const d = ctx.getImageData(0, 0, size, size).data;
  const h = new Float32Array(size * size);
  for (let i = 0; i < h.length; i++) h[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / (3 * 255);
  return h;
}

/** Sobel normal map from a (tileable) height field. */
export function normalMapFromHeight(height: Float32Array, size: number, strength = 2): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const nz = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * size + x) * 4;
      img.data[i] = (-dx * nz * 0.5 + 0.5) * 255;
      img.data[i + 1] = (dy * nz * 0.5 + 0.5) * 255;
      img.data[i + 2] = nz * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

export function toTexture(c: HTMLCanvasElement, repeat: [number, number] = [1, 1], srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

const cache = new Map<string, unknown>();
function cached<T>(key: string, make: () => T): T {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key) as T;
}

export interface SurfaceTex {
  map: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
}

// ─── Surfaces ────────────────────────────────────────────────────────────────

export const Tex = {
  asphalt(): SurfaceTex {
    return cached('asphalt', () => {
      const size = 512;
      const [c, ctx] = makeCanvas(size);
      paintNoise(ctx, size, noiseField(size, { octaves: 6, period: 16, seed: 11 }), '#2a2b2e', '#56575b', 1.6);
      const rng = new RNG(4);
      // Aggregate speckles.
      for (let i = 0; i < 9000; i++) {
        ctx.fillStyle = rng.chance(0.5) ? 'rgba(20,20,22,0.55)' : 'rgba(130,128,122,0.35)';
        ctx.fillRect(rng.range(0, size), rng.range(0, size), 1.4, 1.4);
      }
      // Oil stains.
      for (let i = 0; i < 6; i++) {
        const x = rng.range(0, size);
        const y = rng.range(0, size);
        const r = rng.range(20, 60);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(8,8,10,0.45)');
        g.addColorStop(1, 'rgba(8,8,10,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * rng.range(0.5, 1), rng.range(0, 3), 0, Math.PI * 2);
        ctx.fill();
      }
      // Cracks.
      ctx.strokeStyle = 'rgba(12,12,14,0.8)';
      for (let i = 0; i < 7; i++) {
        ctx.lineWidth = rng.range(0.6, 1.6);
        ctx.beginPath();
        let x = rng.range(0, size);
        let y = rng.range(0, size);
        ctx.moveTo(x, y);
        for (let s = 0; s < 30; s++) {
          x += rng.range(-9, 9);
          y += rng.range(-9, 9);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      const height = heightFromCanvas(ctx, size);
      return { map: toTexture(c), normalMap: normalMapFromHeight(height, size, 3) };
    });
  },

  concrete(tint = '#8f8b84', seed = 3): SurfaceTex {
    return cached(`concrete:${tint}:${seed}`, () => {
      const size = 512;
      const [c, ctx] = makeCanvas(size);
      const base = new THREE.Color(tint);
      const dark = base.clone().multiplyScalar(0.72).getStyle();
      const light = base.clone().multiplyScalar(1.12).getStyle();
      paintNoise(ctx, size, noiseField(size, { octaves: 6, period: 6, seed }), dark, light, 1.3);
      const rng = new RNG(seed * 7);
      for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = `rgba(${rng.chance(0.5) ? '40,38,35' : '210,205,195'},${rng.range(0.08, 0.3)})`;
        ctx.fillRect(rng.range(0, size), rng.range(0, size), rng.range(0.6, 2), rng.range(0.6, 2));
      }
      for (let i = 0; i < 5; i++) {
        const x = rng.range(0, size);
        const y = rng.range(0, size);
        const r = rng.range(30, 90);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(60,52,40,0.25)');
        g.addColorStop(1, 'rgba(60,52,40,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const height = heightFromCanvas(ctx, size);
      return { map: toTexture(c), normalMap: normalMapFromHeight(height, size, 1.4) };
    });
  },

  /** Vertical corrugated sheet metal with rust streaks. */
  corrugated(tint = '#9aa0a3', rust = 0.4): SurfaceTex {
    return cached(`corr:${tint}:${rust}`, () => {
      const size = 256;
      const [c, ctx] = makeCanvas(size);
      const base = new THREE.Color(tint);
      paintNoise(ctx, size, noiseField(size, { octaves: 5, period: 4, seed: 21, stretchY: 0.25 }), base.clone().multiplyScalar(0.7).getStyle(), base.clone().multiplyScalar(1.08).getStyle(), 1.2);
      const ridges = 8;
      for (let x = 0; x < size; x++) {
        const t = Math.sin((x / size) * ridges * Math.PI * 2);
        ctx.fillStyle = `rgba(${t > 0 ? '255,255,255' : '0,0,0'},${Math.abs(t) * 0.06})`;
        ctx.fillRect(x, 0, 1, size);
      }
      const rng = new RNG(9);
      for (let i = 0; i < 24 * rust; i++) {
        const x = rng.range(0, size);
        const len = rng.range(30, 180);
        const g = ctx.createLinearGradient(x, 0, x, len);
        g.addColorStop(0, 'rgba(120,58,22,0.55)');
        g.addColorStop(1, 'rgba(120,58,22,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, rng.range(-20, size * 0.5), rng.range(1, 4), len);
      }
      const h = new Float32Array(size * size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = 0.5 + 0.5 * Math.sin((x / size) * ridges * Math.PI * 2);
      return { map: toTexture(c), normalMap: normalMapFromHeight(h, size, 2.4) };
    });
  },

  /** Horizontal roll-up door slats. */
  doorSlats(color = '#d9772b', grime = 0.5): SurfaceTex {
    return cached(`door:${color}:${grime}`, () => {
      const size = 256;
      const [c, ctx] = makeCanvas(size);
      const base = new THREE.Color(color);
      paintNoise(ctx, size, noiseField(size, { octaves: 5, period: 5, seed: 31, stretchX: 0.3 }), base.clone().multiplyScalar(0.72).getStyle(), base.clone().multiplyScalar(1.05).getStyle(), 1.1);
      const slats = 8;
      for (let y = 0; y < size; y++) {
        const f = (y / size) * slats;
        const t = f - Math.floor(f);
        const shade = t < 0.08 ? 0.18 : t > 0.92 ? 0.1 : 0;
        if (shade) {
          ctx.fillStyle = `rgba(0,0,0,${shade})`;
          ctx.fillRect(0, y, size, 1);
        }
      }
      const rng = new RNG(5);
      ctx.globalAlpha = grime;
      for (let i = 0; i < 40; i++) {
        ctx.strokeStyle = `rgba(${rng.chance(0.5) ? '40,30,20' : '230,220,200'},${rng.range(0.1, 0.35)})`;
        ctx.lineWidth = rng.range(0.5, 1.5);
        ctx.beginPath();
        const x = rng.range(0, size);
        const y = rng.range(0, size);
        ctx.moveTo(x, y);
        ctx.lineTo(x + rng.range(-30, 30), y + rng.range(-4, 4));
        ctx.stroke();
      }
      const g = ctx.createLinearGradient(0, size, 0, size * 0.6);
      g.addColorStop(0, 'rgba(50,40,30,0.5)');
      g.addColorStop(1, 'rgba(50,40,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 1;
      const h = new Float32Array(size * size);
      for (let y = 0; y < size; y++) {
        const f = (y / size) * slats;
        const t = f - Math.floor(f);
        for (let x = 0; x < size; x++) h[y * size + x] = Math.sin(t * Math.PI) * 0.8;
      }
      return { map: toTexture(c), normalMap: normalMapFromHeight(h, size, 2.2) };
    });
  },

  cinderBlock(tint = '#b9b2a4'): SurfaceTex {
    return cached(`block:${tint}`, () => {
      const size = 512;
      const [c, ctx] = makeCanvas(size);
      const base = new THREE.Color(tint);
      paintNoise(ctx, size, noiseField(size, { octaves: 5, period: 8, seed: 41 }), base.clone().multiplyScalar(0.8).getStyle(), base.clone().multiplyScalar(1.06).getStyle(), 1.2);
      const bw = size / 2;
      const bh = size / 4;
      const h = new Float32Array(size * size).fill(1);
      ctx.fillStyle = 'rgba(60,55,48,0.45)';
      for (let row = 0; row < 4; row++) {
        const y = row * bh;
        ctx.fillRect(0, y, size, 4);
        const off = row % 2 === 0 ? 0 : bw / 2;
        for (let x = off; x < size + bw; x += bw) ctx.fillRect(x % size, y, 4, bh);
      }
      const d = ctx.getImageData(0, 0, size, size).data;
      for (let i = 0; i < h.length; i++) h[i] = d[i * 4] / 255;
      return { map: toTexture(c), normalMap: normalMapFromHeight(h, size, 2) };
    });
  },

  cardboard(seed = 1): SurfaceTex {
    return cached(`cardboard:${seed % 4}`, () => {
      const size = 256;
      const [c, ctx] = makeCanvas(size);
      const tones = ['#d2ad7c', '#c49e6c', '#dbb888', '#bb935f'];
      const base = new THREE.Color(tones[seed % 4]);
      paintNoise(ctx, size, noiseField(size, { octaves: 5, period: 6, seed: 50 + seed, stretchX: 0.5 }), base.clone().multiplyScalar(0.9).getStyle(), base.clone().multiplyScalar(1.05).getStyle(), 0.9);
      const rng = new RNG(seed + 3);
      for (let i = 0; i < 1600; i++) {
        ctx.fillStyle = `rgba(${rng.chance(0.5) ? '80,55,30' : '220,190,150'},${rng.range(0.05, 0.2)})`;
        ctx.fillRect(rng.range(0, size), rng.range(0, size), rng.range(1, 6), 0.8);
      }
      // Water ring / scuffs.
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(90,60,30,${rng.range(0.1, 0.25)})`;
        ctx.lineWidth = rng.range(1, 3);
        ctx.beginPath();
        ctx.arc(rng.range(0, size), rng.range(0, size), rng.range(10, 40), 0, Math.PI * 2);
        ctx.stroke();
      }
      return { map: toTexture(c) };
    });
  },

  wood(kind: 'pine' | 'walnut' | 'oak' | 'dark' | 'painted_white' | 'teak' | 'plywood' = 'oak'): SurfaceTex {
    return cached(`wood:${kind}`, () => {
      const size = 256;
      const [c, ctx] = makeCanvas(size);
      const palette: Record<string, [string, string]> = {
        pine: ['#b88a52', '#e0bb82'], walnut: ['#3d2618', '#6e4a30'], oak: ['#8a6238', '#bf915c'], dark: ['#2a1a10', '#4d3322'],
        painted_white: ['#cfc8ba', '#eee8dc'], teak: ['#6b3f22', '#a0673c'], plywood: ['#b99a6e', '#dcc39a'],
      };
      const [d, l] = palette[kind];
      const n = noiseField(size, { octaves: 4, period: 3, seed: kind.length * 13, stretchY: 0.12 });
      const img = ctx.createImageData(size, size);
      const a = hexToRgb(d);
      const b = hexToRgb(l);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = y * size + x;
          const grain = 0.5 + 0.5 * Math.sin((x / size) * 60 + n[i] * 14);
          const t = kind === 'painted_white' ? 0.6 + n[i] * 0.4 : Math.min(1, Math.max(0, grain * 0.55 + n[i] * 0.6 - 0.1));
          img.data[i * 4] = a[0] + (b[0] - a[0]) * t;
          img.data[i * 4 + 1] = a[1] + (b[1] - a[1]) * t;
          img.data[i * 4 + 2] = a[2] + (b[2] - a[2]) * t;
          img.data[i * 4 + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      return { map: toTexture(c) };
    });
  },

  fabric(color: string, pattern: 'plain' | 'floral' | 'check' | 'weave' = 'weave'): SurfaceTex {
    return cached(`fabric:${color}:${pattern}`, () => {
      const size = 128;
      const [c, ctx] = makeCanvas(size);
      const base = new THREE.Color(color);
      paintNoise(ctx, size, noiseField(size, { octaves: 4, period: 8, seed: 71 }), base.clone().multiplyScalar(0.82).getStyle(), base.clone().multiplyScalar(1.1).getStyle(), 1);
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#000';
      for (let i = 0; i < size; i += 2) {
        ctx.fillRect(i, 0, 1, size);
        ctx.fillRect(0, i, size, 1);
      }
      ctx.globalAlpha = 1;
      const rng = new RNG(color.length);
      if (pattern === 'floral') {
        for (let i = 0; i < 14; i++) {
          const x = rng.range(0, size);
          const y = rng.range(0, size);
          ctx.fillStyle = rng.pick(['rgba(190,70,90,0.7)', 'rgba(230,200,120,0.7)', 'rgba(80,120,70,0.6)']);
          for (let p = 0; p < 5; p++) {
            ctx.beginPath();
            ctx.arc(x + Math.cos(p * 1.26) * 4, y + Math.sin(p * 1.26) * 4, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (pattern === 'check') {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        for (let i = 0; i < size; i += 16) {
          ctx.fillRect(i, 0, 8, size);
          ctx.fillRect(0, i, size, 8);
        }
      }
      return { map: toTexture(c) };
    });
  },

  leather(color = '#4a2e1c'): SurfaceTex {
    return cached(`leather:${color}`, () => {
      const size = 128;
      const [c, ctx] = makeCanvas(size);
      const base = new THREE.Color(color);
      paintNoise(ctx, size, noiseField(size, { octaves: 6, period: 12, seed: 81 }), base.clone().multiplyScalar(0.75).getStyle(), base.clone().multiplyScalar(1.2).getStyle(), 1.4);
      return { map: toTexture(c) };
    });
  },

  brushed(color = '#a8abad'): SurfaceTex {
    return cached(`brushed:${color}`, () => {
      const size = 128;
      const [c, ctx] = makeCanvas(size);
      const base = new THREE.Color(color);
      paintNoise(ctx, size, noiseField(size, { octaves: 5, period: 32, seed: 91, stretchX: 0.05 }), base.clone().multiplyScalar(0.85).getStyle(), base.clone().multiplyScalar(1.08).getStyle(), 1.2);
      return { map: toTexture(c) };
    });
  },

  rust(): SurfaceTex {
    return cached('rust', () => {
      const size = 256;
      const [c, ctx] = makeCanvas(size);
      paintNoise(ctx, size, noiseField(size, { octaves: 6, period: 6, seed: 99 }), '#4a2412', '#b0602a', 1.5);
      return { map: toTexture(c) };
    });
  },

  tarp(color = '#3f5f8a'): SurfaceTex {
    return cached(`tarp:${color}`, () => {
      const size = 256;
      const [c, ctx] = makeCanvas(size);
      const base = new THREE.Color(color);
      paintNoise(ctx, size, noiseField(size, { octaves: 5, period: 5, seed: 101 }), base.clone().multiplyScalar(0.7).getStyle(), base.clone().multiplyScalar(1.1).getStyle(), 1.2);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      for (let i = 0; i < size; i += 6) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, size);
        ctx.moveTo(0, i);
        ctx.lineTo(size, i);
        ctx.stroke();
      }
      return { map: toTexture(c, [3, 3]) };
    });
  },

  /** Soft radial blob for contact shadows and glows. */
  blob(): THREE.Texture {
    return cached('blob', () => {
      const size = 128;
      const [c, ctx] = makeCanvas(size);
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(0,0,0,0.75)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.35)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
  },

  glow(color = '#ffffff'): THREE.Texture {
    return cached(`glow:${color}`, () => {
      const size = 128;
      const [c, ctx] = makeCanvas(size);
      const col = new THREE.Color(color);
      const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, `rgba(${rgb},1)`);
      g.addColorStop(0.25, `rgba(${rgb},0.55)`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
  },

  /** Four-pointed star sparkle for rare glints. */
  sparkle(): THREE.Texture {
    return cached('sparkle', () => {
      const size = 128;
      const [c, ctx] = makeCanvas(size);
      const m = size / 2;
      const g = ctx.createRadialGradient(m, m, 0, m, m, m * 0.5);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(m, 0); ctx.lineTo(m + 5, m); ctx.lineTo(m, size); ctx.lineTo(m - 5, m); ctx.closePath();
      ctx.moveTo(0, m); ctx.lineTo(m, m - 5); ctx.lineTo(size, m); ctx.lineTo(m, m + 5); ctx.closePath();
      ctx.fill();
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
  },

  /** Flashlight cookie: hot centre, soft falloff and a faint reflector ring. */
  flashlightCookie(): THREE.Texture {
    return cached('cookie', () => {
      const size = 256;
      const [c, ctx] = makeCanvas(size);
      const m = size / 2;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, size, size);
      const g = ctx.createRadialGradient(m, m, 0, m, m, m);
      g.addColorStop(0, 'rgba(255,250,235,1)');
      g.addColorStop(0.18, 'rgba(255,245,225,0.95)');
      g.addColorStop(0.3, 'rgba(230,220,200,0.55)');
      g.addColorStop(0.36, 'rgba(255,245,230,0.7)');
      g.addColorStop(0.42, 'rgba(200,190,170,0.35)');
      g.addColorStop(0.8, 'rgba(120,110,100,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
  },

  sky(top: string, horizon: string, glow: string): THREE.Texture {
    return cached(`sky:${top}:${horizon}:${glow}`, () => {
      const [c, ctx] = makeCanvas(16, 512);
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, top);
      g.addColorStop(0.62, horizon);
      g.addColorStop(0.72, glow);
      g.addColorStop(1, '#1a1512');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 16, 512);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
  },
};

// ─── Text & labels ───────────────────────────────────────────────────────────

export const FONT_MARKER = '"Permanent Marker", "Marker Felt", "Comic Sans MS", cursive';
export const FONT_STENCIL = '"Big Shoulders Stencil Display", "Impact", "Arial Narrow", sans-serif';
export const FONT_UI = '"Barlow Condensed", "Arial Narrow", sans-serif';

/**
 * Canvas text drawn before its web font arrived falls back to a system font.
 * Redraw it once the font is ready so labels end up in the intended typeface.
 */
function redrawWhenFontReady(font: string, tex: THREE.CanvasTexture, draw: () => void) {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts) return;
  try {
    if (fonts.check(font)) return;
    fonts.load(font).then((loaded) => {
      if (!loaded.length) return;
      draw();
      tex.needsUpdate = true;
    }).catch(() => { /* keep the fallback font */ });
  } catch { /* font loading API unavailable */ }
}

/** Hand-written marker label for moving boxes. */
export function markerLabel(text: string, seed = 0): THREE.CanvasTexture {
  return cached(`label:${text}:${seed % 3}`, () => {
    const [c, ctx] = makeCanvas(256, 128);
    const draw = () => {
      ctx.clearRect(0, 0, 256, 128);
      const rng = new RNG(seed + text.length);
      ctx.save();
      ctx.translate(128, 64);
      ctx.rotate(rng.range(-0.08, 0.08));
      let fontSize = 54;
      ctx.font = `${fontSize}px ${FONT_MARKER}`;
      while (ctx.measureText(text).width > 230 && fontSize > 18) {
        fontSize -= 4;
        ctx.font = `${fontSize}px ${FONT_MARKER}`;
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = rng.chance(0.2) ? 'rgba(160,20,20,0.92)' : 'rgba(20,20,26,0.92)';
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };
    draw();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    redrawWhenFontReady(`54px ${FONT_MARKER}`, t, draw);
    return t;
  });
}

/** Stencilled unit number above a door. */
export function stencilNumber(text: string, color = '#f4f1ea'): THREE.CanvasTexture {
  return cached(`stencil:${text}:${color}`, () => {
    const [c, ctx] = makeCanvas(256, 96);
    const draw = () => {
      ctx.clearRect(0, 0, 256, 96);
      ctx.font = `800 72px ${FONT_STENCIL}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(text, 128, 52);
    };
    draw();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    redrawWhenFontReady(`800 72px ${FONT_STENCIL}`, t, draw);
    return t;
  });
}

/** Generic sign/text panel. */
export function textPanel(lines: string[], opts: { w?: number; h?: number; bg?: string; fg?: string; font?: string; size?: number } = {}): THREE.CanvasTexture {
  const key = `panel:${lines.join('|')}:${JSON.stringify(opts)}`;
  return cached(key, () => {
    const w = opts.w ?? 512;
    const h = opts.h ?? 256;
    const [c, ctx] = makeCanvas(w, h);
    const size = opts.size ?? Math.floor(h / (lines.length + 0.8));
    const font = `700 ${size}px ${opts.font ?? FONT_UI}`;
    const draw = () => {
      ctx.fillStyle = opts.bg ?? '#1b3a2b';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = opts.fg ?? '#f2efe6';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = font;
      lines.forEach((l, i) => ctx.fillText(l, w / 2, (h / (lines.length + 1)) * (i + 1)));
    };
    draw();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    redrawWhenFontReady(font, t, draw);
    return t;
  });
}
