import type { LedgerEntry, LedgerKind } from '../core/types';
import type { Game } from './game';
import { estimateMid, marketValue } from './items';

export interface UnitPnL {
  purchase: number;
  transport: number;
  disposal: number;
  cleaning: number;
  repair: number;
  experts: number;
  fees: number;
  other: number;
  sales: number;
  profit: number;
  roi: number;
  /** ROI if the unsold stock sells at its current estimate. */
  projectedRoi: number;
  sold: number;
  total: number;
  unsoldEstimate: number;
  complete: boolean;
}

/** Money, the ledger, per-unit profit & loss and net worth. */
export class EconomySystem {
  constructor(private readonly game: Game) {}

  get money(): number {
    return this.game.state.money;
  }

  canAfford(amount: number): boolean {
    return this.game.state.money >= amount - 1e-6;
  }

  /** Spend money. Returns false (and changes nothing) when funds are insufficient unless forced. */
  spend(amount: number, kind: LedgerKind, meta: Omit<LedgerEntry, 'day' | 'amount' | 'kind'> = {}, force = false): boolean {
    amount = Math.round(amount);
    if (amount <= 0) return true;
    if (!force && !this.canAfford(amount)) return false;
    this.apply(-amount, kind, meta);
    const s = this.game.state.stats;
    if (kind === 'auction') s.totalSpent += amount;
    return true;
  }

  earn(amount: number, kind: LedgerKind, meta: Omit<LedgerEntry, 'day' | 'amount' | 'kind'> = {}): void {
    amount = Math.round(amount);
    if (amount <= 0) return;
    this.apply(amount, kind, meta);
    if (kind === 'sale' || kind === 'reward') this.game.state.stats.totalEarned += amount;
  }

  private apply(delta: number, kind: LedgerKind, meta: Omit<LedgerEntry, 'day' | 'amount' | 'kind'>) {
    const st = this.game.state;
    st.money = Math.round(st.money + delta);
    st.ledger.push({ day: st.day, amount: delta, kind, ...meta });
    if (st.ledger.length > 4000) st.ledger.splice(0, st.ledger.length - 4000);
    this.game.bus.emit('money:changed', { money: st.money, delta, kind });
  }

  unitPnL(unitId: string): UnitPnL {
    const st = this.game.state;
    const p: UnitPnL = {
      purchase: 0, transport: 0, disposal: 0, cleaning: 0, repair: 0, experts: 0, fees: 0, other: 0, sales: 0,
      profit: 0, roi: 0, projectedRoi: 0, sold: 0, total: 0, unsoldEstimate: 0, complete: false,
    };
    for (const e of st.ledger) {
      if (e.unitId !== unitId) continue;
      switch (e.kind) {
        case 'auction': p.purchase += e.amount; break;
        case 'transport': p.transport += e.amount; break;
        case 'disposal': p.disposal += e.amount; break;
        case 'cleaning': p.cleaning += e.amount; break;
        case 'repair': p.repair += e.amount; break;
        case 'expert': case 'locksmith': case 'lab': p.experts += e.amount; break;
        case 'fee': p.fees += e.amount; break;
        case 'sale': case 'reward': p.sales += e.amount; break;
        default: p.other += e.amount;
      }
    }
    const rec = st.units[unitId];
    if (rec) {
      for (const uid of rec.itemUids) {
        const it = st.items[uid];
        if (!it) continue;
        p.total++;
        if (it.location === 'sold' || it.location === 'disposed' || it.location === 'gifted') p.sold++;
        else p.unsoldEstimate += estimateMid(it, st.market);
      }
      p.complete = rec.status === 'cleared' && p.sold === p.total;
    }
    p.profit = p.purchase + p.transport + p.disposal + p.cleaning + p.repair + p.experts + p.fees + p.other + p.sales;
    const invested = -(p.purchase + p.transport + p.disposal + p.cleaning + p.repair + p.experts + p.fees + Math.min(0, p.other));
    p.roi = invested > 0 ? p.profit / invested : 0;
    p.projectedRoi = invested > 0 ? (p.profit + p.unsoldEstimate) / invested : 0;
    return p;
  }

  /** Cash plus what the player can reasonably expect for their stock. */
  netWorth(): number {
    const st = this.game.state;
    let v = st.money;
    for (const it of Object.values(st.items)) {
      if (it.location === 'garage' || it.location === 'display' || it.location === 'van' || it.location === 'listed' || it.location === 'consigned') {
        v += estimateMid(it, st.market);
      }
    }
    if (st.loan) v -= st.loan.principal;
    return Math.round(v);
  }

  /** Hidden truth, used for achievements that must not be gamed by estimates. */
  trueNetWorth(): number {
    const st = this.game.state;
    let v = st.money;
    for (const it of Object.values(st.items)) {
      if (['garage', 'display', 'van', 'listed', 'consigned'].includes(it.location)) v += marketValue(it, st.market);
    }
    if (st.loan) v -= st.loan.principal;
    return Math.round(v);
  }
}
