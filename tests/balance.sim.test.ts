import { describe, expect, it } from 'vitest';
import { RNG, hashString } from '../src/core/rng';
import { FACILITY_MAP } from '../src/data/facilities';
import { BLUEPRINTS } from '../src/data/units';
import { itemDef } from '../src/data/items';
import { AuctionRun } from '../src/systems/auction';
import { generateUnit } from '../src/systems/generator';
import { createBidders, dailyBudgets, openingAsk, pickAttendees } from '../src/systems/npc';
import { MarketSystem } from '../src/systems/market';

/**
 * Economy sanity simulation: NPC-only auctions across all blueprints.
 * Prints clearing price vs. true value so balancing changes can be judged.
 */
describe('balance simulation', () => {
  it('NPC clearing prices sit below true value on average, with wide spread', () => {
    const market = MarketSystem.initialState(new RNG(1));
    const rows: { bp: string; price: number; value: number; winner: string | null }[] = [];
    let seed = 1;
    for (let day = 0; day < 120; day++) {
      const rng = new RNG(hashString(`sim:${day}`));
      const attendees = pickAttendees(rng, false);
      const budgets = dailyBudgets(rng, attendees);
      for (const bp of BLUEPRINTS) {
        let n = 0;
        const unit = generateUnit({ facility: FACILITY_MAP.lucky_lock, blueprint: bp, seed: seed++, day, level: 3, number: 'A-01', uid: () => `u${n++}`, market });
        const bidders = createBidders(unit, attendees, budgets, rng, market, {}, { playerLevel: 1, rivalry: {} });
        const run = new AuctionRun(bidders, openingAsk(bidders), rng, { playerLevel: 1, playerMoney: () => 0, rivalry: {} });
        run.runToEnd();
        rows.push({ bp: bp.id, price: run.phase === 'sold' ? run.current : 0, value: unit.hidden.hiddenValue, winner: run.phase === 'sold' ? run.leader : null });
      }
    }
    const lines: string[] = [];
    let totalPrice = 0;
    let totalValue = 0;
    for (const bp of BLUEPRINTS) {
      const r = rows.filter((x) => x.bp === bp.id && x.winner);
      const price = r.reduce((s, x) => s + x.price, 0) / Math.max(1, r.length);
      const value = r.reduce((s, x) => s + x.value, 0) / Math.max(1, r.length);
      const med = r.map((x) => x.value).sort((a, b) => a - b)[Math.floor(r.length / 2)] ?? 0;
      const sold = r.length / rows.filter((x) => x.bp === bp.id).length;
      totalPrice += price;
      totalValue += value;
      const winners = new Map<string, number>();
      for (const x of r) winners.set(x.winner!, (winners.get(x.winner!) ?? 0) + 1);
      lines.push(`${bp.id.padEnd(11)} sold ${(sold * 100).toFixed(0).padStart(3)}%  avg price $${price.toFixed(0).padStart(6)}  avg value $${value.toFixed(0).padStart(6)}  median value $${med.toFixed(0).padStart(6)}  price/value ${(price / Math.max(1, value)).toFixed(2)}  winners ${[...winners].map(([k, v]) => `${k}:${v}`).join(' ')}`);
    }
    console.log(lines.join('\n'));
    const ratio = totalPrice / totalValue;
    console.log('overall price/value', ratio.toFixed(2));
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(1.2);
  });

  it('item value distribution per unit', { timeout: 120000 }, () => {
    const buckets = new Map<string, number>();
    let n = 0;
    for (let s = 0; s < 80; s++) {
      for (const bp of BLUEPRINTS) {
        let k = 0;
        const unit = generateUnit({ facility: FACILITY_MAP.lucky_lock, blueprint: bp, seed: 90000 + s * 13 + bp.id.length, day: 1, level: 3, number: 'A-01', uid: () => `u${k++}` });
        for (const p of unit.items) {
          const r = itemDef(p.inst.defId).rarity;
          buckets.set(r, (buckets.get(r) ?? 0) + 1);
          n++;
          for (const c of p.contents ?? []) { const rr = itemDef(c.defId).rarity; buckets.set(rr, (buckets.get(rr) ?? 0) + 1); n++; }
        }
      }
    }
    console.log([...buckets].map(([k, v]) => `${k}: ${(v / n * 100).toFixed(2)}%`).join('  '));
    expect(buckets.get('legendary') ?? 0).toBeLessThan(n * 0.005);
  });
});
