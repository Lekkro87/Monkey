/**
 * Small seeded PRNG (sfc32) with the helpers the generators need.
 * Every procedural result (units, NPC moods, market drift) is reproducible from a seed.
 */
export class RNG {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number | string = Date.now()) {
    const s = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    this.a = 0x9e3779b9;
    this.b = 0x243f6a88;
    this.c = 0xb7e15162;
    this.d = s ^ 0xdeadbeef;
    for (let i = 0; i < 15; i++) this.next();
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.a >>>= 0; this.b >>>= 0; this.c >>>= 0; this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)];
  }

  weighted<T>(entries: readonly [T, number][]): T {
    let total = 0;
    for (const [, w] of entries) total += Math.max(0, w);
    if (total <= 0) return entries[0][0];
    let r = this.next() * total;
    for (const [v, w] of entries) {
      r -= Math.max(0, w);
      if (r < 0) return v;
    }
    return entries[entries.length - 1][0];
  }

  weightedIndex(weights: readonly number[]): number {
    return this.weighted(weights.map((w, i) => [i, w] as [number, number]));
  }

  /** Standard normal via Box–Muller. */
  gauss(mean = 0, sd = 1): number {
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Log-normal multiplier centred on 1. */
  lognorm(sigma: number, mu = 0): number {
    return Math.exp(this.gauss(mu, sigma));
  }

  shuffle<T>(list: T[]): T[] {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  /** Derive an independent child generator. */
  fork(salt: number | string): RNG {
    return new RNG(hashString(`${this.int(0, 2 ** 31)}:${salt}`));
  }
}

export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return h >>> 0;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
