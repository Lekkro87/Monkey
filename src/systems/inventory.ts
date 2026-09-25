import { RARITY_ORDER } from '../core/config';
import type { ItemInstance, ItemLocation } from '../core/types';
import { CATEGORY_NAMES, itemDef, volumeOf } from '../data/items';
import { DISPLAY_BASE_SLOTS, GARAGE_BASE_CAPACITY, UPGRADE_MAP } from '../data/progression';
import type { Game } from './game';
import { estimateMid, visibleRarity } from './items';

export type SortKey = 'value' | 'category' | 'rarity' | 'condition' | 'weight' | 'recent';

const OWNED: ItemLocation[] = ['van', 'garage', 'display', 'listed', 'consigned'];

/** Where every owned item is, garage capacity, display case and sorting. */
export class InventorySystem {
  constructor(private readonly game: Game) {}

  all(): ItemInstance[] {
    return Object.values(this.game.state.items);
  }

  owned(): ItemInstance[] {
    return this.all().filter((i) => OWNED.includes(i.location));
  }

  at(location: ItemLocation): ItemInstance[] {
    return this.all().filter((i) => i.location === location);
  }

  get(uid: string): ItemInstance | undefined {
    return this.game.state.items[uid];
  }

  add(inst: ItemInstance, location: ItemLocation): void {
    inst.location = location;
    this.game.state.items[inst.uid] = inst;
  }

  move(uid: string, location: ItemLocation): void {
    const it = this.game.state.items[uid];
    if (it) it.location = location;
  }

  garageCapacity(): number {
    let cap = GARAGE_BASE_CAPACITY;
    for (const id of this.game.state.garage.upgrades) cap += UPGRADE_MAP[id]?.kind === 'garage' ? UPGRADE_MAP[id].capacity ?? 0 : 0;
    return cap;
  }

  /** Items physically in the garage (displayed items count too; listed items wait in the garage). */
  garageUsed(): number {
    let v = 0;
    for (const it of this.all()) {
      if (it.location === 'garage' || it.location === 'display' || it.location === 'listed') v += volumeOf(itemDef(it.defId));
    }
    return v;
  }

  displaySlots(): number {
    return DISPLAY_BASE_SLOTS + (this.game.state.garage.upgrades.includes('display_case') ? 3 : 0);
  }

  setDisplay(slot: number, uid: string | null): boolean {
    const g = this.game.state.garage;
    const slots = this.displaySlots();
    if (slot < 0 || slot >= slots) return false;
    while (g.display.length < slots) g.display.push(null);
    const prev = g.display[slot];
    if (prev && this.game.state.items[prev]?.location === 'display') this.move(prev, 'garage');
    if (uid) {
      const it = this.game.state.items[uid];
      if (!it || (it.location !== 'garage' && it.location !== 'display')) return false;
      const other = g.display.indexOf(uid);
      if (other >= 0) g.display[other] = null;
      this.move(uid, 'display');
    }
    g.display[slot] = uid;
    return true;
  }

  sort(items: ItemInstance[], key: SortKey): ItemInstance[] {
    const m = this.game.state.market;
    const val = (i: ItemInstance) => estimateMid(i, m);
    const rar = (i: ItemInstance) => {
      const r = visibleRarity(i);
      return r ? RARITY_ORDER[r] : -1;
    };
    const cmp: Record<SortKey, (a: ItemInstance, b: ItemInstance) => number> = {
      value: (a, b) => val(b) - val(a),
      category: (a, b) => CATEGORY_NAMES[itemDef(a.defId).category].localeCompare(CATEGORY_NAMES[itemDef(b.defId).category]) || val(b) - val(a),
      rarity: (a, b) => rar(b) - rar(a) || val(b) - val(a),
      condition: (a, b) => (b.knowledge.conditionKnown ? b.condition : 2.5) - (a.knowledge.conditionKnown ? a.condition : 2.5),
      weight: (a, b) => itemDef(b.defId).weight - itemDef(a.defId).weight,
      recent: (a, b) => b.foundDay - a.foundDay || b.uid.localeCompare(a.uid),
    };
    return [...items].sort(cmp[key]);
  }
}
