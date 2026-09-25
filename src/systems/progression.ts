import { CONFIG, RARITY_ORDER } from '../core/config';
import type { ItemInstance, Stats } from '../core/types';
import { itemDef } from '../data/items';
import { ACHIEVEMENTS, LEVEL_NAMES } from '../data/progression';
import type { Game } from './game';
import { marketValue } from './items';

export function emptyStats(): Stats {
  return {
    unitsWon: 0, unitsLost: 0, auctionsAttended: 0, totalSpent: 0, totalEarned: 0,
    bestFind: null, worstPurchase: null, bestPurchase: null, rarestItem: null, highestSale: null,
    itemsDiscovered: 0, rareItemsFound: 0, fakesFound: 0, secretsFound: 0, itemsSold: 0, itemsRepaired: 0, itemsCleaned: 0,
    unitsProfitable: 0, unitsLosing: 0, jackpots: 0, negotiationsWon: 0, bestNegotiation: 0, vanFills: 0,
    finalCallWins: 0, sharkBeaten: 0, cleanSweeps: 0,
  };
}

/** XP, levels, statistics and achievements. Listens to domain events. */
export class ProgressionSystem {
  constructor(private readonly game: Game) {
    const bus = game.bus;
    bus.on('item:found', ({ item }) => this.onFound(item));
    bus.on('item:identified', ({ item }) => this.onIdentified(item));
    bus.on('item:fake', ({ item }) => {
      if (item.location !== 'sold') this.unlock('eagle_eye');
    });
    bus.on('item:sold', ({ item, profit, price }) => {
      this.addXp(CONFIG.xp.sale + Math.max(0, Math.floor(profit / CONFIG.xp.perProfitDollars)), 'sale');
      if (profit > 0) this.unlock('first_score');
      this.noteValue(item, price);
      this.checkUnit(item.unitId);
    });
    bus.on('item:repaired', ({ success }) => {
      if (!success) return;
      this.game.state.stats.itemsRepaired++;
      if (this.game.state.stats.itemsRepaired >= 10) this.unlock('restorer');
    });
    bus.on('item:cleaned', () => { this.game.state.stats.itemsCleaned++; });
    bus.on('negotiation:won', ({ gain }) => {
      this.addXp(10, 'negotiation');
      if (gain >= 0.5) this.unlock('hard_bargain');
    });
    bus.on('vehicle:full', () => {
      this.game.state.stats.vanFills++;
      this.unlock('full_load');
    });
    bus.on('day:started', () => this.checkThresholds());
    bus.on('money:changed', ({ kind }) => {
      if (kind === 'auction') this.checkThresholds();
    });
  }

  level(): number {
    const xp = this.game.state.xp;
    let lvl = 1;
    CONFIG.levels.forEach((need, i) => { if (xp >= need) lvl = i + 1; });
    return Math.min(lvl, LEVEL_NAMES.length);
  }

  levelName(level = this.level()): string {
    return LEVEL_NAMES[level - 1];
  }

  progress(): { level: number; xp: number; from: number; to: number | null; frac: number } {
    const level = this.level();
    const xp = this.game.state.xp;
    const from = CONFIG.levels[level - 1];
    const to = level < CONFIG.levels.length ? CONFIG.levels[level] : null;
    return { level, xp, from, to, frac: to ? (xp - from) / (to - from) : 1 };
  }

  addXp(amount: number, reason: string): void {
    if (amount <= 0) return;
    const before = this.level();
    this.game.state.xp += Math.round(amount);
    this.game.bus.emit('xp:gained', { amount: Math.round(amount), reason });
    const after = this.level();
    for (let l = before + 1; l <= after; l++) {
      this.game.bus.emit('level:up', { level: l });
      this.game.news('Level up! You are now a {title}.', { title: LEVEL_NAMES[l - 1] }, 'info');
    }
  }

  unlock(id: string): boolean {
    const st = this.game.state;
    if (st.achievements[id] !== undefined || !ACHIEVEMENTS.some((a) => a.id === id)) return false;
    st.achievements[id] = st.day;
    this.game.bus.emit('achievement', { id });
    this.addXp(CONFIG.xp.achievement, 'achievement');
    return true;
  }

  /** Progress towards counted achievements, for the UI. */
  achievementProgress(id: string): { value: number; goal: number } | null {
    const s = this.game.state.stats;
    switch (id) {
      case 'big_spender': return { value: s.totalSpent, goal: 10000 };
      case 'treasure_hunter': return { value: s.rareItemsFound, goal: 100 };
      case 'bad_decision': return { value: s.unitsLosing, goal: 10 };
      case 'restorer': return { value: s.itemsRepaired, goal: 10 };
      case 'storage_legend': return { value: Math.max(0, this.game.economy.netWorth()), goal: CONFIG.net.legendThreshold };
      default: return null;
    }
  }

  private onFound(item: ItemInstance) {
    const s = this.game.state.stats;
    const def = itemDef(item.defId);
    s.itemsDiscovered++;
    const d = this.game.state.discovered[def.id];
    if (d) d.count++;
    else this.game.state.discovered[def.id] = { count: 1, best: 0, firstDay: this.game.state.day };
    if (RARITY_ORDER[def.rarity] >= 2 && item.authentic && def.rarity !== 'unique') {
      s.rareItemsFound++;
      if (s.rareItemsFound >= 100) this.unlock('treasure_hunter');
    }
    if (item.knowledge.idLevel >= 2) this.onIdentified(item, true);
  }

  private onIdentified(item: ItemInstance, silentName = false) {
    const def = itemDef(item.defId);
    const s = this.game.state.stats;
    const xp = item.authentic ? CONFIG.xp.find[def.rarity] : 2;
    this.addXp((silentName ? 0 : CONFIG.xp.identify) + xp, 'identify');
    if (item.authentic && (!s.rarestItem || RARITY_ORDER[def.rarity] > RARITY_ORDER[s.rarestItem.rarity])) {
      s.rarestItem = { name: def.name, rarity: def.rarity };
    }
    this.valueKnown(item);
  }

  /** Called whenever the true value of an item becomes known to the player. */
  valueKnown(item: ItemInstance) {
    const def = itemDef(item.defId);
    const known = !def.fakeChance || item.knowledge.authKnown;
    if (known && item.knowledge.idLevel >= 2) this.noteValue(item, marketValue(item, this.game.state.market));
  }

  private noteValue(item: ItemInstance, value: number) {
    const s = this.game.state.stats;
    const def = itemDef(item.defId);
    const d = this.game.state.discovered[def.id];
    if (d) d.best = Math.max(d.best, Math.round(value));
    if (!item.authentic) return;
    if (!s.bestFind || value > s.bestFind.value) s.bestFind = { name: def.name, value: Math.round(value) };
    if (value > 10000) {
      if (this.unlock('jackpot')) s.jackpots++;
    }
  }

  /** Re-evaluate a unit's result once its items are sold. */
  checkUnit(unitId: string | null) {
    if (!unitId) return;
    const rec = this.game.state.units[unitId];
    if (!rec) return;
    const p = this.game.economy.unitPnL(unitId);
    const s = this.game.state.stats;
    if (p.profit >= 5000) this.unlock('home_run');
    if (!p.complete || this.game.state.flags[`unitDone:${unitId}`]) return;
    this.game.state.flags[`unitDone:${unitId}`] = true;
    if (p.profit >= 0) s.unitsProfitable++;
    else {
      s.unitsLosing++;
      if (s.unitsLosing >= 10) this.unlock('bad_decision');
    }
    if (!s.bestPurchase || p.profit > s.bestPurchase.profit) s.bestPurchase = { unit: rec.number, profit: Math.round(p.profit) };
    if (!s.worstPurchase || p.profit < s.worstPurchase.profit) s.worstPurchase = { unit: rec.number, profit: Math.round(p.profit) };
  }

  checkThresholds() {
    const s = this.game.state.stats;
    if (s.totalSpent >= 10000) this.unlock('big_spender');
    if (this.game.economy.trueNetWorth() >= CONFIG.net.legendThreshold) this.unlock('storage_legend');
    const g = this.game.state.garage;
    const slots = this.game.inventory.displaySlots();
    if (g.display.slice(0, slots).filter(Boolean).length >= slots && slots >= 6) this.unlock('curator');
  }
}
