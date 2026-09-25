import type { ItemInstance } from '../core/types';
import { itemDef, volumeOf } from '../data/items';
import { UPGRADE_MAP, VEHICLES } from '../data/progression';
import type { Game } from './game';

export interface LoadCheck {
  ok: boolean;
  reason?: 'volume' | 'weight';
}

/** Cargo space, payload and the cost of every trip between a unit and the garage. */
export class VehicleSystem {
  constructor(private readonly game: Game) {}

  get def() {
    return VEHICLES[this.game.state.vehicle.id] ?? VEHICLES.van;
  }

  private upgrades() {
    return this.game.state.vehicle.upgrades.map((id) => UPGRADE_MAP[id]).filter(Boolean);
  }

  capacity(): number {
    return this.def.capacity + this.upgrades().reduce((s, u) => s + (u.capacity ?? 0), 0);
  }

  payload(): number {
    return this.def.payload + this.upgrades().reduce((s, u) => s + (u.payload ?? 0), 0);
  }

  tripCost(): number {
    let cost = this.def.tripCost;
    for (const u of this.upgrades()) {
      if (u.tripCost === undefined) continue;
      cost = u.tripCost < 0 && u.tripCost > -1 ? cost * (1 + u.tripCost) : cost + u.tripCost;
    }
    return Math.round(cost);
  }

  cargo(): ItemInstance[] {
    return Object.values(this.game.state.items).filter((i) => i.location === 'van');
  }

  usedVolume(): number {
    return this.cargo().reduce((s, i) => s + volumeOf(itemDef(i.defId)), 0);
  }

  usedWeight(): number {
    return this.cargo().reduce((s, i) => s + itemWeight(i), 0);
  }

  canLoad(inst: ItemInstance): LoadCheck {
    const def = itemDef(inst.defId);
    if (this.usedVolume() + volumeOf(def) > this.capacity() + 1e-6) return { ok: false, reason: 'volume' };
    if (this.usedWeight() + itemWeight(inst) > this.payload() + 1e-6) return { ok: false, reason: 'weight' };
    return { ok: true };
  }

  fillRatio(): number {
    return Math.max(this.usedVolume() / this.capacity(), this.usedWeight() / this.payload());
  }

  /** Move everything from the van into the garage. */
  unload(): number {
    const cargo = this.cargo();
    for (const it of cargo) it.location = 'garage';
    return cargo.length;
  }
}

export function itemWeight(inst: ItemInstance): number {
  const def = itemDef(inst.defId);
  let w = def.weight;
  if (inst.lockedContents) for (const c of inst.lockedContents) w += itemDef(c.defId).weight;
  return w;
}
