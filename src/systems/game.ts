import { CONFIG } from '../core/config';
import { EventBus, type GameEvents } from '../core/events';
import { RNG } from '../core/rng';
import type { GameState, ItemInstance, ItemLocation, NewsItem } from '../core/types';
import { itemDef, volumeOf } from '../data/items';
import { COSMETICS, UPGRADE_MAP } from '../data/progression';
import { AuctionSystem } from './auctionSystem';
import { EconomySystem } from './economy';
import { InventorySystem } from './inventory';
import { MarketSystem, type MarketDayReport } from './market';
import { ProgressionSystem, emptyStats } from './progression';
import { QuestSystem } from './quests';
import { MemoryBackend, SaveSystem, type StorageBackend } from './save';
import { SearchSystem } from './search';
import { VehicleSystem } from './vehicle';
import { WorkshopSystem } from './workshop';

export interface DayReport {
  day: number;
  bills: number;
  overflowFee: number;
  market: MarketDayReport;
}

export interface GameOptions {
  backend?: StorageBackend;
  seed?: number;
  state?: GameState;
}

/**
 * Composition root of the simulation. Owns the state and wires the systems.
 * Everything here is headless; rendering and UI observe it through the event bus.
 */
export class Game {
  state: GameState;
  readonly bus = new EventBus<GameEvents>();
  rng: RNG;
  readonly save: SaveSystem;
  readonly economy: EconomySystem;
  readonly inventory: InventorySystem;
  readonly vehicle: VehicleSystem;
  readonly market: MarketSystem;
  readonly progression: ProgressionSystem;
  readonly quests: QuestSystem;
  readonly workshop: WorkshopSystem;
  readonly auctions: AuctionSystem;
  readonly search: SearchSystem;

  private dirty = false;
  private lastAutosave = 0;

  constructor(opts: GameOptions = {}) {
    this.save = new SaveSystem(opts.backend ?? new MemoryBackend());
    this.state = opts.state ?? Game.newState(opts.seed ?? (Date.now() & 0x7fffffff));
    this.rng = new RNG(this.state.seed ^ Date.now());
    this.economy = new EconomySystem(this);
    this.inventory = new InventorySystem(this);
    this.vehicle = new VehicleSystem(this);
    this.market = new MarketSystem(this);
    this.progression = new ProgressionSystem(this);
    this.quests = new QuestSystem(this);
    this.workshop = new WorkshopSystem(this);
    this.auctions = new AuctionSystem(this);
    this.search = new SearchSystem(this);
    this.bus.on('item:found', ({ item }) => this.quests.onFound(item));
  }

  static newState(seed: number): GameState {
    const rng = new RNG(seed);
    return {
      version: CONFIG.saveVersion,
      createdAt: Date.now(),
      savedAt: 0,
      seed,
      day: 1,
      money: CONFIG.startMoney,
      xp: 0,
      facilityId: 'lucky_lock',
      items: {},
      garage: { upgrades: [], wall: 'wall_concrete', floor: 'floor_concrete', light: 'light_warm', neon: 'neon_none', display: [null, null, null] },
      vehicle: { id: 'van', upgrades: [] },
      market: MarketSystem.initialState(rng),
      today: null,
      search: null,
      searchUnit: null,
      units: {},
      ledger: [],
      stats: emptyStats(),
      achievements: {},
      quests: {},
      discovered: {},
      rivalry: {},
      news: [],
      flags: {},
      uid: 1,
      loan: null,
    };
  }

  /** Start over (keeps the storage backend). */
  newGame(seed?: number): void {
    this.state = Game.newState(seed ?? (Date.now() & 0x7fffffff));
    this.rng = new RNG(this.state.seed ^ Date.now());
    this.news('Welcome to Lucky Lock Self Storage. You have {money} and a rusty van. Make it count.', { money: `$${CONFIG.startMoney}` }, 'info');
    this.auctions.ensureToday();
    this.flushSave();
  }

  /** Load the latest good save. Returns false when there is none. */
  load(): boolean {
    const st = this.save.load();
    if (!st) return false;
    this.state = st;
    this.rng = new RNG(this.state.seed ^ Date.now());
    this.auctions.ensureToday();
    return true;
  }

  level(): number {
    return this.progression.level();
  }

  nextUid(): string {
    const id = this.state.uid++;
    return `i${id.toString(36)}`;
  }

  news(text: string, p?: Record<string, string | number>, kind: NewsItem['kind'] = 'info'): void {
    this.state.news.unshift({ day: this.state.day, text, p, kind });
    if (this.state.news.length > 60) this.state.news.length = 60;
    this.bus.emit('news', { text, p });
  }

  /** Mark state as changed; the render loop autosaves shortly after. */
  touch(): void {
    this.dirty = true;
  }

  autosave(now = Date.now()): void {
    if (!this.dirty || now - this.lastAutosave < 1500) return;
    this.flushSave();
  }

  flushSave(): void {
    this.dirty = false;
    this.lastAutosave = Date.now();
    this.save.save(this.state);
    this.bus.emit('save', {});
  }

  /** An item enters the player's possession. */
  acquire(inst: ItemInstance, location: ItemLocation, emitFound = true): void {
    this.inventory.add(inst, location);
    if (emitFound) this.bus.emit('item:found', { item: inst, rarity: itemDef(inst.defId).rarity, secret: !!inst.fromSecret });
  }

  /** Check a piece of furniture for a hidden compartment. */
  revealSecret(inst: ItemInstance, where: 'unit' | 'garage'): ItemInstance[] {
    inst.secretChecked = true;
    const found = inst.secret ?? [];
    if (found.length === 0) return [];
    this.state.stats.secretsFound++;
    this.progression.unlock('secret_keeper');
    if (where === 'garage') {
      delete inst.secret;
      for (const f of found) {
        f.unitId = inst.unitId;
        f.fromSecret = true;
        if (f.defId === 'cash') {
          const cash = Math.round(f.roll * itemDef('cash').baseValue);
          f.location = 'sold';
          f.soldFor = cash;
          this.state.items[f.uid] = f;
          this.economy.earn(cash, 'reward', { unitId: inst.unitId, itemUid: f.uid, note: 'cash' });
          this.bus.emit('item:found', { item: f, rarity: 'rare', secret: true });
        } else {
          this.acquire(f, 'garage', true);
        }
        if (inst.unitId && this.state.units[inst.unitId]) this.state.units[inst.unitId].itemUids.push(f.uid);
      }
    }
    return found;
  }

  // ── Day cycle ─────────────────────────────────────────────────────────────

  /** Close the day and move to the next one. */
  advanceDay(): DayReport {
    const st = this.state;
    if (this.search.active) this.search.finish();
    this.bus.emit('day:ended', { day: st.day });
    st.day++;
    st.today = null;
    let bills = 0;
    if ((st.day - 1) % CONFIG.day.weekLength === 0) {
      bills = CONFIG.day.weeklyBills;
      this.economy.spend(bills, 'bills', { note: 'garage rent & insurance' }, true);
      this.news('Weekly bills paid: {amount} for garage rent and van insurance.', { amount: `$${bills}` }, 'warning');
    }
    let overflowFee = 0;
    const over = this.inventory.garageUsed() - this.inventory.garageCapacity();
    if (over > 0.05) {
      overflowFee = Math.round(over * CONFIG.garage.overflowFeePerM3);
      this.economy.spend(overflowFee, 'fee', { note: 'overflow storage' }, true);
      this.news('Your garage is overflowing. Extra storage cost {amount}.', { amount: `$${overflowFee}` }, 'warning');
    }
    const market = this.market.advanceDay(this.rng);
    this.auctions.ensureToday();
    this.bus.emit('day:started', { day: st.day });
    this.flushSave();
    return { day: st.day, bills, overflowFee, market };
  }

  /** Broke and nothing to sell? Work a shift at the hardware store. */
  canDayJob(): boolean {
    return this.state.money < 400;
  }

  dayJob(): DayReport {
    this.economy.earn(CONFIG.day.dayJobPay, 'job', { note: 'hardware store shift' });
    return this.advanceDay();
  }

  // ── Garage & vehicle ─────────────────────────────────────────────────────

  hasUpgrade(id: string): boolean {
    return this.state.garage.upgrades.includes(id) || this.state.vehicle.upgrades.includes(id);
  }

  canBuyUpgrade(id: string): { ok: boolean; reason?: string } {
    const u = UPGRADE_MAP[id];
    if (!u) return { ok: false, reason: 'Unknown upgrade.' };
    if (this.hasUpgrade(id)) return { ok: false, reason: 'Already owned.' };
    if (this.level() < u.level) return { ok: false, reason: `Requires level ${u.level}.` };
    if (u.requires && !this.hasUpgrade(u.requires)) return { ok: false, reason: `Requires ${UPGRADE_MAP[u.requires].name}.` };
    if (!this.economy.canAfford(u.cost)) return { ok: false, reason: 'Not enough money.' };
    return { ok: true };
  }

  buyUpgrade(id: string): boolean {
    const u = UPGRADE_MAP[id];
    if (!this.canBuyUpgrade(id).ok) return false;
    this.economy.spend(u.cost, 'upgrade', { note: id });
    if (u.kind === 'vehicle') this.state.vehicle.upgrades.push(id);
    else this.state.garage.upgrades.push(id);
    if (id === 'display_case') {
      while (this.state.garage.display.length < this.inventory.displaySlots()) this.state.garage.display.push(null);
    }
    this.flushSave();
    return true;
  }

  ownsCosmetic(id: string): boolean {
    const c = COSMETICS.find((x) => x.id === id);
    return !!c && (c.cost === 0 || !!this.state.flags[`cos:${id}`]);
  }

  applyCosmetic(id: string): boolean {
    const c = COSMETICS.find((x) => x.id === id);
    if (!c) return false;
    if (!this.ownsCosmetic(id)) {
      if (!this.economy.spend(c.cost, 'upgrade', { note: id })) return false;
      this.state.flags[`cos:${id}`] = true;
    }
    this.state.garage[c.slot] = id;
    this.flushSave();
    return true;
  }

  garageFill(): number {
    return this.inventory.garageUsed() / this.inventory.garageCapacity();
  }

  itemVolume(inst: ItemInstance): number {
    return volumeOf(itemDef(inst.defId));
  }
}
