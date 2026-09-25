import { describe, expect, it } from 'vitest';
import { RNG } from '../src/core/rng';
import type { ItemInstance } from '../src/core/types';
import { itemDef } from '../src/data/items';
import { AuctionRun } from '../src/systems/auction';
import { Game } from '../src/systems/game';
import { appraise, createInstance, displayName, estimateRange, marketValue, performStep, publicValue } from '../src/systems/items';
import { counter, startNegotiation, suggestedCounters, walkAway } from '../src/systems/negotiation';
import type { Bidder } from '../src/systems/npc';
import { NPC_MAP } from '../src/data/npcs';
import { MemoryBackend } from '../src/systems/save';

function inst(defId: string, seed = 1, over: Partial<ItemInstance> = {}): ItemInstance {
  const i = createInstance(itemDef(defId), new RNG(seed), { uid: `t${seed}`, unitId: null, day: 1 });
  return Object.assign(i, over);
}

function bidder(id: keyof typeof NPC_MAP, max: number): Bidder {
  return {
    id, profile: NPC_MAP[id], estimate: max * 1.5, max, baseMax: max, budget: 1e9, dropped: false, nextBidAt: null, outAt: null,
    noticed: null, readPlayer: false, bluffing: false,
  };
}

describe('item identification', () => {
  it('starts unknown and becomes identified through inspection', () => {
    const w = inst('watch_luxury', 3, { authentic: false });
    expect(displayName(w)).toBe('Wristwatch');
    performStep(w, 'look', new RNG(1));
    expect(displayName(w)).toBe('Possible Luxury Diver');
    performStep(w, 'markings', new RNG(1));
    expect(w.knowledge.idLevel).toBe(2);
    appraise(w);
    expect(w.knowledge.authKnown).toBe(true);
    expect(displayName(w)).toBe('Fake "Kronhaus" Diver');
  });

  it('narrows the value estimate as knowledge grows', () => {
    const w = inst('watch_vintage', 4);
    const [lo0, hi0] = estimateRange(w);
    performStep(w, 'look', new RNG(2));
    performStep(w, 'markings', new RNG(2));
    const [lo1, hi1] = estimateRange(w);
    expect(hi1 - lo1).toBeLessThan(hi0 - lo0);
    appraise(w);
    const [lo2, hi2] = estimateRange(w);
    const v = marketValue(w);
    expect(lo2).toBeLessThanOrEqual(v * 1.01);
    expect(hi2).toBeGreaterThanOrEqual(v * 0.99);
  });

  it('prices unverified items between fake and genuine', () => {
    const g = inst('handbag_designer', 9, { authentic: true, condition: 3, dirt: 0 });
    const genuine = marketValue(g);
    const p = publicValue(g);
    expect(p).toBeLessThan(genuine);
    g.knowledge.authKnown = true;
    expect(publicValue(g)).toBeCloseTo(genuine, 3);
  });

  it('condition changes value massively', () => {
    const poor = inst('camera_slr', 1, { condition: 1, dirt: 0, broken: false, roll: 1 });
    const mint = inst('camera_slr', 1, { condition: 6, dirt: 0, broken: false, roll: 1 });
    expect(marketValue(mint) / marketValue(poor)).toBeGreaterThan(10);
  });
});

describe('auction', () => {
  it('sells to the highest valuation and walks through the calls', () => {
    const run = new AuctionRun([bidder('dealer', 600), bidder('shark', 900)], 100, new RNG(7), {
      playerLevel: 1, playerMoney: () => 0, rivalry: {},
    });
    const calls: string[] = [];
    let t = 0;
    while (!run.finished && t < 300) {
      run.update(0.05);
      t += 0.05;
      for (const e of run.drain()) if (e.type === 'call') calls.push(e.call);
    }
    expect(run.phase).toBe('sold');
    expect(run.leader).toBe('shark');
    expect(run.current).toBeGreaterThan(550);
    expect(run.current).toBeLessThanOrEqual(900 * 1.5);
    expect(calls).toContain('final');
  });

  it('never lets the player bid more than they have', () => {
    const run = new AuctionRun([bidder('dealer', 50)], 100, new RNG(1), { playerLevel: 1, playerMoney: () => 80, rivalry: {} });
    expect(run.playerBid().ok).toBe(false);
  });

  it('lets the player win with auto bid', () => {
    let money = 5000;
    const run = new AuctionRun([bidder('rookie', 400)], 50, new RNG(3), { playerLevel: 1, playerMoney: () => money, rivalry: {} });
    run.setAuto(1000);
    run.runToEnd();
    expect(run.leader).toBe('player');
    expect(run.current).toBeLessThanOrEqual(1000);
    money -= run.current;
    expect(money).toBeGreaterThan(0);
  });

  it('drops the price when nobody opens', () => {
    const run = new AuctionRun([bidder('dealer', 40)], 100, new RNG(3), { playerLevel: 1, playerMoney: () => 0, rivalry: {} });
    const drops: number[] = [];
    let t = 0;
    while (!run.finished && t < 120) {
      run.update(0.05);
      t += 0.05;
      for (const e of run.drain()) if (e.type === 'drop') drops.push(e.amount);
    }
    expect(drops.length).toBeGreaterThan(0);
    expect(drops[0]).toBeLessThan(100);
  });
});

describe('negotiation', () => {
  const offer = { id: 'o', itemUid: 'x', buyer: 'Test', personality: 'fair' as const, offer: 500, maxPay: 800, patience: 3, expires: 9 };

  it('accepts a counter within the budget eventually and never pays above max', () => {
    for (let s = 0; s < 50; s++) {
      const rng = new RNG(s);
      const n = startNegotiation({ ...offer }, rng);
      let guard = 0;
      while (n.outcome === 'open' && guard++ < 10) counter(n, 700, rng);
      if (n.outcome === 'accepted') expect(n.price).toBeLessThanOrEqual(800);
    }
  });

  it('greedy counters make buyers leave', () => {
    let left = 0;
    for (let s = 0; s < 50; s++) {
      const rng = new RNG(s);
      const n = startNegotiation({ ...offer, patience: 2 }, rng);
      let guard = 0;
      while (n.outcome === 'open' && guard++ < 10) counter(n, 5000, rng);
      if (n.outcome === 'left') left++;
    }
    expect(left).toBeGreaterThan(40);
  });

  it('walking away sometimes brings a better offer', () => {
    let better = 0;
    for (let s = 0; s < 100; s++) {
      const rng = new RNG(s);
      const n = startNegotiation({ ...offer, personality: 'lowballer' }, rng);
      walkAway(n, rng);
      if (n.outcome === 'open' && n.current > 500) better++;
    }
    expect(better).toBeGreaterThan(10);
  });

  it('suggests distinct, rising counter-offers even for cheap items', () => {
    for (const amount of [3, 5, 12, 40, 95, 480, 2300]) {
      const n = startNegotiation({ ...offer, offer: amount, maxPay: amount * 2 }, new RNG(1));
      const c = suggestedCounters(n);
      expect(c).toHaveLength(3);
      expect(c[0]).toBeGreaterThan(n.current);
      expect(c[1]).toBeGreaterThan(c[0]);
      expect(c[2]).toBeGreaterThan(c[1]);
    }
  });
});

describe('game flow', () => {
  it('runs a full day: auction, search, sell, save and load', () => {
    const backend = new MemoryBackend();
    const game = new Game({ backend, seed: 12345 });
    game.newGame(12345);
    const today = game.auctions.ensureToday();
    expect(today.lots.length).toBeGreaterThanOrEqual(3);
    game.auctions.begin();
    const unit = game.auctions.currentLot()!;
    const run = game.auctions.startRun(unit);
    run.setAuto(game.state.money);
    run.runToEnd();
    const res = game.auctions.settle(run, unit);
    if (res.winner === 'player') {
      expect(game.search.active).toBe(true);
      // Open everything and take what fits.
      for (let pass = 0; pass < 3; pass++) {
        for (const e of game.search.entries()) {
          const def = itemDef(e.inst.defId);
          if (def.container && !def.container.locked) game.search.open(e.inst.uid);
        }
      }
      for (const e of game.search.entries()) {
        if (itemDef(e.inst.defId).category === 'trash') continue;
        const r = game.search.take(e.inst.uid);
        if (!r.ok && (r.reason === 'volume' || r.reason === 'weight')) {
          game.search.driveLoad();
          game.search.take(e.inst.uid);
        }
      }
      const rep = game.search.finish();
      expect(rep.taken).toBeGreaterThan(0);
      const stock = game.inventory.at('garage');
      expect(stock.length).toBeGreaterThan(0);
      const sellable = stock.find((i) => game.market.pawnOffer(i) > 0);
      if (sellable) {
        const before = game.state.money;
        const sale = game.market.sellPawn(sellable.uid);
        expect(sale.ok).toBe(true);
        expect(game.state.money).toBeGreaterThan(before);
      }
      const pnl = game.economy.unitPnL(unit.id);
      expect(pnl.purchase).toBe(-run.current);
    }
    game.auctions.leave();
    game.advanceDay();
    expect(game.state.day).toBe(2);

    const game2 = new Game({ backend });
    expect(game2.load()).toBe(true);
    expect(game2.state.day).toBe(2);
    expect(game2.state.money).toBe(game.state.money);
    expect(Object.keys(game2.state.items).length).toBe(Object.keys(game.state.items).length);
  });

  it('falls back to a backup when the latest save is corrupted', () => {
    const backend = new MemoryBackend();
    const game = new Game({ backend, seed: 1 });
    game.newGame(1);
    game.state.money = 1234;
    game.flushSave();
    game.state.money = 5678;
    game.flushSave();
    backend.set('storageHunter.save', backend.get('storageHunter.save')!.replace('5678', '9999'));
    const game2 = new Game({ backend });
    expect(game2.load()).toBe(true);
    expect(game2.state.money).toBe(1234);
  });

  it('exports and imports a save string', () => {
    const game = new Game({ seed: 3 });
    game.newGame(3);
    game.state.money = 4242;
    const text = game.save.exportString(game.state);
    const back = game.save.importString(text);
    expect(back?.money).toBe(4242);
  });
});
