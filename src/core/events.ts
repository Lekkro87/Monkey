import type { ItemInstance, LedgerKind, NpcId, Rarity, SaleChannel, UnitData } from './types';

/** All domain events. Systems publish, UI/audio/progression subscribe. */
export interface GameEvents {
  'money:changed': { money: number; delta: number; kind: LedgerKind };
  'day:started': { day: number };
  'day:ended': { day: number };
  'auction:lot': { unit: UnitData };
  'auction:bid': { bidder: NpcId | 'player'; amount: number };
  'auction:sold': { unit: UnitData; winner: NpcId | 'player' | null; price: number };
  'item:found': { item: ItemInstance; rarity: Rarity; secret: boolean };
  'item:identified': { item: ItemInstance };
  'item:fake': { item: ItemInstance };
  'item:cleaned': { item: ItemInstance };
  'item:repaired': { item: ItemInstance; success: boolean };
  'item:sold': { item: ItemInstance; price: number; channel: SaleChannel; profit: number };
  'unit:cleared': { unitId: string };
  'vehicle:full': Record<string, never>;
  'xp:gained': { amount: number; reason: string };
  'level:up': { level: number };
  'achievement': { id: string };
  'quest:update': { id: string; stage: number };
  'news': { text: string; p?: Record<string, string | number> };
  'negotiation:won': { gain: number };
  'save': Record<string, never>;
}

type Handler<T> = (payload: T) => void;

export class EventBus<E extends object = GameEvents> {
  private handlers = new Map<keyof E, Set<Handler<never>>>();

  on<K extends keyof E>(type: K, fn: Handler<E[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(fn as Handler<never>);
    return () => set!.delete(fn as Handler<never>);
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        (fn as Handler<E[K]>)(payload);
      } catch (err) {
        console.error(`[events] handler for ${String(type)} failed`, err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
