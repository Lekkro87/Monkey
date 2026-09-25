import { CONFIG } from '../core/config';
import type { ItemInstance, PlacedItem, UnitData } from '../core/types';
import { itemDef, volumeOf } from '../data/items';
import type { Game } from './game';
import { apparentValue } from './items';

export interface SearchEntry {
  inst: ItemInstance;
  placed: PlacedItem | null;
  parent: string | null;
  source: 'top' | 'content' | 'secret';
}

export interface TakeResult {
  ok: boolean;
  reason?: 'volume' | 'weight' | 'gone' | 'locked';
  cash?: number;
  opened?: ItemInstance[];
}

export interface FinishReport {
  taken: number;
  left: number;
  disposalFee: number;
  tripCost: number;
  cleanSweep: boolean;
}

/** The won unit: open containers, find hidden compartments, load the van, haul it home. */
export class SearchSystem {
  constructor(private readonly game: Game) {}

  get active(): boolean {
    return !!this.game.state.search && !!this.game.state.searchUnit;
  }

  get unit(): UnitData | null {
    return this.game.state.searchUnit;
  }

  private get s() {
    return this.game.state.search!;
  }

  begin(unit: UnitData, price: number): void {
    const st = this.game.state;
    st.searchUnit = unit;
    st.search = { unitId: unit.id, taken: [], opened: [], tossed: [], tarpsPulled: [], trips: 0, transportCost: 0 };
    st.flags[`secretSeen:${unit.id}`] = false;
    st.units[unit.id] = {
      id: unit.id, number: unit.number, blueprintId: unit.blueprintId, event: unit.event, size: unit.size, day: st.day,
      price, trueValue: unit.hidden.hiddenValue, status: 'searching', itemUids: [], disposed: 0,
    };
    this.game.touch();
  }

  isOpen(uid: string): boolean {
    return !!this.game.state.search?.opened.includes(uid);
  }

  isTaken(uid: string): boolean {
    return !!this.game.state.search?.taken.includes(uid);
  }

  isTossed(uid: string): boolean {
    return !!this.game.state.search?.tossed.includes(uid);
  }

  isGone(uid: string): boolean {
    return this.isTaken(uid) || this.isTossed(uid);
  }

  /** Everything currently lying around in the unit. */
  entries(): SearchEntry[] {
    const unit = this.unit;
    if (!unit || !this.game.state.search) return [];
    const out: SearchEntry[] = [];
    for (const p of unit.items) {
      if (!this.isGone(p.inst.uid)) out.push({ inst: p.inst, placed: p, parent: null, source: 'top' });
      if (this.isOpen(p.inst.uid)) {
        for (const c of p.contents ?? []) if (!this.isGone(c.uid)) out.push({ inst: c, placed: null, parent: p.inst.uid, source: 'content' });
      }
      this.pushSecrets(p.inst, out);
      for (const c of p.contents ?? []) this.pushSecrets(c, out);
    }
    return out;
  }

  private pushSecrets(inst: ItemInstance, out: SearchEntry[]) {
    if (!inst.secret || !inst.secretChecked) return;
    if (!this.game.state.flags[`secretIn:${this.s.unitId}:${inst.uid}`]) return;
    for (const c of inst.secret) if (!this.isGone(c.uid)) out.push({ inst: c, placed: null, parent: inst.uid, source: 'secret' });
  }

  find(uid: string): SearchEntry | null {
    return this.entries().find((e) => e.inst.uid === uid) ?? null;
  }

  placedFor(uid: string): PlacedItem | null {
    return this.unit?.items.find((p) => p.inst.uid === uid) ?? null;
  }

  /** Open a box, drawers, a suitcase… Returns what falls out. */
  open(uid: string): { ok: boolean; contents: ItemInstance[]; reason?: string } {
    const e = this.find(uid);
    if (!e) return { ok: false, contents: [], reason: 'gone' };
    const def = itemDef(e.inst.defId);
    if (!def.container) return { ok: false, contents: [], reason: 'not a container' };
    if (def.container.locked) return { ok: false, contents: [], reason: 'locked' };
    if (this.isOpen(uid)) return { ok: true, contents: [] };
    this.s.opened.push(uid);
    this.game.touch();
    return { ok: true, contents: e.placed?.contents ?? [] };
  }

  canCheckSecret(uid: string): boolean {
    const e = this.find(uid);
    if (!e) return false;
    const spec = itemDef(e.inst.defId).container;
    return !!spec?.secretChance && this.isOpen(uid) && !e.inst.secretChecked;
  }

  /** Knock on the panels. Only a curious hunter finds the hidden compartment. */
  checkSecret(uid: string): ItemInstance[] {
    const e = this.find(uid);
    if (!e || !this.canCheckSecret(uid)) return [];
    const found = this.game.revealSecret(e.inst, 'unit');
    if (found.length) this.game.state.flags[`secretIn:${this.s.unitId}:${uid}`] = true;
    this.game.touch();
    return found;
  }

  pullTarp(index: number): void {
    if (!this.s.tarpsPulled.includes(index)) this.s.tarpsPulled.push(index);
    this.game.touch();
  }

  canLoad(uid: string) {
    const e = this.find(uid);
    return e ? this.game.vehicle.canLoad(e.inst) : { ok: false };
  }

  take(uid: string): TakeResult {
    const e = this.find(uid);
    if (!e) return { ok: false, reason: 'gone' };
    const def = itemDef(e.inst.defId);
    const res: TakeResult = { ok: true };
    if (def.container && !def.container.locked && !this.isOpen(uid)) {
      res.opened = this.open(uid).contents;
    }
    if (def.id === 'cash') {
      const cash = Math.round(e.inst.roll * def.baseValue);
      this.s.taken.push(uid);
      e.inst.location = 'sold';
      e.inst.soldFor = cash;
      e.inst.soldDay = this.game.state.day;
      this.game.state.items[uid] = e.inst;
      this.game.state.units[this.s.unitId]?.itemUids.push(uid);
      this.game.economy.earn(cash, 'reward', { unitId: this.s.unitId, itemUid: uid, note: 'cash' });
      this.game.bus.emit('item:found', { item: e.inst, rarity: def.rarity, secret: e.source === 'secret' });
      this.game.touch();
      return { ...res, cash };
    }
    const check = this.game.vehicle.canLoad(e.inst);
    if (!check.ok) {
      this.game.bus.emit('vehicle:full', {});
      return { ok: false, reason: check.reason };
    }
    this.s.taken.push(uid);
    if (e.source === 'secret') {
      e.inst.fromSecret = true;
      // Detach from the hidden compartment so the item exists exactly once.
      const parents = [
        this.unit?.items.find((p) => p.inst.uid === e.parent)?.inst,
        ...(this.unit?.items.flatMap((p) => p.contents ?? []).filter((c) => c.uid === e.parent) ?? []),
        e.parent ? this.game.state.items[e.parent] : undefined,
      ];
      for (const parent of parents) if (parent?.secret) parent.secret = parent.secret.filter((c) => c.uid !== uid);
    }
    this.game.acquire(e.inst, 'van', true);
    this.game.state.units[this.s.unitId]?.itemUids.push(uid);
    if (this.game.vehicle.fillRatio() >= 0.95) this.game.bus.emit('vehicle:full', {});
    this.game.touch();
    return res;
  }

  toss(uid: string): boolean {
    const e = this.find(uid);
    if (!e) return false;
    this.s.tossed.push(uid);
    this.game.touch();
    return true;
  }

  /** Drive what is in the van back to the garage and come back. */
  driveLoad(): { ok: boolean; cost: number } {
    if (this.game.vehicle.cargo().length === 0) return { ok: false, cost: 0 };
    const cost = this.game.vehicle.tripCost();
    this.game.economy.spend(cost, 'transport', { unitId: this.s.unitId, note: 'trip' }, true);
    this.s.trips++;
    this.s.transportCost += cost;
    this.game.vehicle.unload();
    this.game.flushSave();
    return { ok: true, cost };
  }

  leftBehind(): { items: ItemInstance[]; volume: number; fee: number } {
    const items: ItemInstance[] = [];
    let volume = 0;
    for (const e of this.entries()) {
      items.push(e.inst);
      if (e.source === 'top' || e.source === 'content' || e.source === 'secret') volume += volumeOf(itemDef(e.inst.defId));
    }
    // Contents of containers nobody opened go to the dumpster with the container.
    const unit = this.unit;
    if (unit) {
      for (const p of unit.items) {
        if (!this.isOpen(p.inst.uid)) for (const c of p.contents ?? []) items.push(c);
      }
    }
    const fee = volume > 0 ? Math.max(CONFIG.disposal.minimum, Math.round(volume * CONFIG.disposal.perM3)) : 0;
    return { items, volume, fee };
  }

  finish(): FinishReport {
    const st = this.game.state;
    const unit = this.unit!;
    const rec = st.units[unit.id];
    const left = this.leftBehind();
    if (left.fee > 0) this.game.economy.spend(left.fee, 'disposal', { unitId: unit.id, note: 'dumpster' }, true);
    let tripCost = 0;
    if (this.game.vehicle.cargo().length > 0) {
      tripCost = this.game.vehicle.tripCost();
      this.game.economy.spend(tripCost, 'transport', { unitId: unit.id, note: 'trip' }, true);
      this.s.trips++;
      this.s.transportCost += tripCost;
      this.game.vehicle.unload();
    }

    // Clean sweep: every non-junk thing was taken and every container opened.
    let cleanSweep = true;
    for (const p of unit.items) {
      const def = itemDef(p.inst.defId);
      if (def.container && !def.container.locked && !this.isOpen(p.inst.uid)) cleanSweep = false;
      if (def.category !== 'trash' && def.category !== 'container' && !this.isTaken(p.inst.uid)) cleanSweep = false;
    }
    for (const it of left.items) {
      const def = itemDef(it.defId);
      if (def.category !== 'trash' && def.category !== 'container') cleanSweep = false;
    }
    if (cleanSweep) {
      st.stats.cleanSweeps++;
      this.game.progression.unlock('clean_sweep');
    }

    // Spread the unit's cost over what was kept, weighted by what each piece looks worth.
    const kept = rec.itemUids.map((u) => st.items[u]).filter((i) => i && i.location !== 'sold');
    const total = rec.price + this.s.transportCost + left.fee;
    const weights = kept.map((i) => Math.max(1, apparentValue(i, st.market)));
    const wsum = weights.reduce((a, b) => a + b, 0);
    kept.forEach((i, idx) => { i.costBasis = Math.round((total * weights[idx]) / wsum); });

    rec.status = 'cleared';
    rec.disposed = left.items.length;
    const report: FinishReport = { taken: rec.itemUids.length, left: left.items.length, disposalFee: left.fee, tripCost, cleanSweep };
    st.search = null;
    st.searchUnit = null;
    this.game.bus.emit('unit:cleared', { unitId: unit.id });
    this.game.flushSave();
    return report;
  }
}
