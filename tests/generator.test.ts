import { describe, expect, it } from 'vitest';
import { RNG } from '../src/core/rng';
import { CONFIG } from '../src/core/config';
import { ITEM_LIST, itemDef, volumeOf } from '../src/data/items';
import { FACILITY_MAP } from '../src/data/facilities';
import { BLUEPRINTS, BLUEPRINT_MAP } from '../src/data/units';
import { allUnitItems, generateUnit } from '../src/systems/generator';
import { marketValue } from '../src/systems/items';

function unit(bp: string, seed: number, level = 3) {
  let n = 0;
  return generateUnit({
    facility: FACILITY_MAP.lucky_lock,
    blueprint: BLUEPRINT_MAP[bp],
    seed,
    day: 1,
    level,
    number: 'A-01',
    uid: () => `u${n++}`,
  });
}

describe('item catalogue', () => {
  it('has at least 30 items, 3 jackpots and valid data', () => {
    expect(ITEM_LIST.length).toBeGreaterThanOrEqual(30);
    expect(ITEM_LIST.filter((d) => d.jackpot).length).toBeGreaterThanOrEqual(3);
    for (const d of ITEM_LIST) {
      expect(d.dims.every((x) => x > 0), d.id).toBe(true);
      expect(d.baseValue, d.id).toBeGreaterThanOrEqual(0);
      if (d.fakeChance) expect(d.fakeValue, d.id).toBeDefined();
      if (d.possibleName) expect(d.family, d.id).toBeDefined();
    }
  });
});

describe('storage generator', () => {
  it('ships ten unit blueprints', () => {
    expect(BLUEPRINTS.length).toBe(10);
  });

  it('is deterministic for a seed', () => {
    const a = unit('household', 42);
    const b = unit('household', 42);
    expect(a.items.map((p) => p.inst.defId)).toEqual(b.items.map((p) => p.inst.defId));
    expect(a.hidden.hiddenValue).toBe(b.hidden.hiddenValue);
  });

  it('places every item inside the unit without overlaps', () => {
    for (const bp of BLUEPRINTS) {
      for (let s = 0; s < 6; s++) {
        const u = unit(bp.id, 1000 + s * 17);
        const { w, d, h } = u.dims;
        for (const p of u.items) {
          const [x, y, z] = p.pos;
          const [dx, dy, dz] = p.dims;
          expect(x - dx / 2).toBeGreaterThanOrEqual(-w / 2 - 1e-3);
          expect(x + dx / 2).toBeLessThanOrEqual(w / 2 + 1e-3);
          expect(z - dz / 2).toBeGreaterThanOrEqual(-1e-3);
          expect(z + dz / 2).toBeLessThanOrEqual(d + 1e-3);
          expect(y - dy / 2).toBeGreaterThanOrEqual(-1e-3);
          expect(y + dy / 2).toBeLessThanOrEqual(h);
        }
        for (let i = 0; i < u.items.length; i++) {
          for (let j = i + 1; j < u.items.length; j++) {
            const a = u.items[i];
            const b = u.items[j];
            const ox = Math.min(a.pos[0] + a.dims[0] / 2, b.pos[0] + b.dims[0] / 2) - Math.max(a.pos[0] - a.dims[0] / 2, b.pos[0] - b.dims[0] / 2);
            const oy = Math.min(a.pos[1] + a.dims[1] / 2, b.pos[1] + b.dims[1] / 2) - Math.max(a.pos[1] - a.dims[1] / 2, b.pos[1] - b.dims[1] / 2);
            const oz = Math.min(a.pos[2] + a.dims[2] / 2, b.pos[2] + b.dims[2] / 2) - Math.max(a.pos[2] - a.dims[2] / 2, b.pos[2] - b.dims[2] / 2);
            expect(ox > 0.002 && oy > 0.002 && oz > 0.002, `${bp.id} overlap ${a.inst.defId}/${b.inst.defId}`).toBe(false);
          }
        }
      }
    }
  });

  it('hides part of the contents from the doorway', () => {
    let hiddenCount = 0;
    let total = 0;
    for (let s = 0; s < 20; s++) {
      const u = unit('hoarder', 500 + s);
      total += u.items.length;
      hiddenCount += u.items.filter((p) => p.visibility < CONFIG.inspection.visibleThreshold).length;
      expect(u.items.some((p) => p.visibility > 0.3)).toBe(true);
    }
    expect(hiddenCount / total).toBeGreaterThan(0.12);
  });

  it('fills containers with items that fit', () => {
    for (let s = 0; s < 30; s++) {
      const u = unit('estate', 900 + s);
      for (const p of u.items) {
        const spec = itemDef(p.inst.defId).container;
        for (const c of p.contents ?? []) {
          expect(spec).toBeDefined();
          expect(volumeOf(itemDef(c.defId))).toBeLessThanOrEqual(spec!.maxItemVolume + 1e-9);
        }
      }
    }
  });

  it('hidden value equals the sum of everything inside', () => {
    const u = unit('collector', 77);
    const sum = allUnitItems(u).reduce((s, i) => s + marketValue(i), 0);
    expect(Math.abs(sum - u.hidden.hiddenValue)).toBeLessThan(2);
  });

  it('keeps legendary jackpots very rare', () => {
    let legend = 0;
    const n = 400;
    for (let s = 0; s < n; s++) {
      const u = unit('household', 20000 + s);
      if (allUnitItems(u).some((i) => itemDef(i.defId).rarity === 'legendary')) legend++;
    }
    expect(legend / n).toBeLessThan(0.05);
  });

  it('rolls fakes for counterfeit-prone items', () => {
    const rng = new RNG(5);
    let fakes = 0;
    const n = 2000;
    const def = itemDef('watch_luxury');
    for (let i = 0; i < n; i++) if (rng.chance(def.fakeChance!)) fakes++;
    expect(fakes / n).toBeGreaterThan(0.45);
    expect(fakes / n).toBeLessThan(0.65);
  });
});
