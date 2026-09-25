import { CONFIG } from '../core/config';
import { RNG, hashString } from '../core/rng';
import type { AuctionDayState, LotResult, NpcId, UnitData } from '../core/types';
import { FACILITY_MAP } from '../data/facilities';
import { BLUEPRINT_MAP } from '../data/units';
import { AuctionRun } from './auction';
import type { Game } from './game';
import { generateUnit } from './generator';
import { type Bidder, createBidders, dailyBudgets, openingAsk, pickAttendees } from './npc';

/** Doors per facility row (the 3D scene builds the same row). */
export const ROW_SLOTS = 13;

/** Door label for a slot: full doors are "B-07", half-width doors "B-07A" / "B-07B". */
export function doorNumber(row: string, slot: number, half: boolean, second = false): string {
  const base = `${row}-${String(slot + 1).padStart(2, '0')}`;
  return half ? `${base}${second ? 'B' : 'A'}` : base;
}

/** Spread n lots along the row (left to right), with a little jitter. */
export function pickSlots(n: number, rng: RNG): number[] {
  const first = 1;
  const last = ROW_SLOTS - 2;
  const picks: number[] = [];
  for (let i = 0; i < n; i++) {
    const base = n === 1 ? (first + last) / 2 : first + ((last - first) * i) / (n - 1);
    let s = Math.round(base) + rng.int(-1, 1);
    s = Math.max(first, Math.min(last, s));
    if (picks.length && s <= picks[picks.length - 1]) s = picks[picks.length - 1] + 1;
    picks.push(Math.min(last, s));
  }
  return picks;
}

/** The auction day: today's lineup, running each lot, and settling results. */
export class AuctionSystem {
  constructor(private readonly game: Game) {}

  /** Make sure there is a lineup for the current day. */
  ensureToday(): AuctionDayState {
    const st = this.game.state;
    if (!st.today || st.today.day !== st.day) st.today = this.lineup(st.day);
    return st.today;
  }

  lineup(day: number): AuctionDayState {
    const st = this.game.state;
    const facility = FACILITY_MAP[st.facilityId];
    const rng = new RNG(hashString(`${st.seed}:lineup:${day}`));
    const level = this.game.level();
    const tutorial = day === 1 && !st.flags.tutorialDone;
    const count = tutorial ? 3 : rng.int(CONFIG.day.lotsPerDay[0], CONFIG.day.lotsPerDay[1]);
    const pool = facility.blueprints.map((id) => BLUEPRINT_MAP[id]).filter((b) => b.minLevel <= level);
    const lots: UnitData[] = [];
    const usedEvents = new Set<string>();
    const row = rng.pick(facility.rows);
    const slots = pickSlots(count, rng);
    let storyPlaced = false;
    for (let i = 0; i < count; i++) {
      const choices = pool.filter((b) => !b.event || !usedEvents.has(b.event));
      let bp = rng.weighted(choices.map((b) => [b, b.weight] as [typeof b, number]));
      if (tutorial && i === 0) bp = BLUEPRINT_MAP.household;
      if (bp.event) usedEvents.add(bp.event);
      const story = !storyPlaced ? this.game.quests.storyCandidate(rng, bp) : null;
      if (story) storyPlaced = true;
      const unit = generateUnit({
        facility,
        blueprint: bp,
        seed: hashString(`${st.seed}:${day}:${i}`),
        day,
        level,
        number: doorNumber(row, slots[i], false),
        slot: slots[i],
        uid: () => this.game.nextUid(),
        market: st.market,
        storyItem: story,
        tutorial: tutorial && i === 0,
      });
      unit.number = doorNumber(row, slots[i], unit.dims.w <= 1.6);
      lots.push(unit);
    }
    const attendees = pickAttendees(rng, tutorial);
    return {
      day, facilityId: facility.id, lots, results: [], index: 0, attendees, budgets: dailyBudgets(rng, attendees),
      started: false, finished: false,
    };
  }

  currentLot(): UnitData | null {
    const t = this.game.state.today;
    if (!t || t.finished) return null;
    return t.lots[t.index] ?? null;
  }

  isDayOver(): boolean {
    const t = this.game.state.today;
    return !t || t.finished || t.index >= t.lots.length;
  }

  /** Pay for fuel once when heading out to the facility. */
  begin(): boolean {
    const t = this.ensureToday();
    if (t.started) return true;
    const cost = FACILITY_MAP[t.facilityId].travelCost;
    this.game.economy.spend(cost, 'travel', { note: 'fuel' }, true);
    t.started = true;
    this.game.touch();
    return true;
  }

  /** Create today's bidders for a lot (their estimates drive the inspection chatter too). */
  bidders(unit: UnitData, stare: Record<string, number> = {}): Bidder[] {
    const t = this.ensureToday();
    const rng = new RNG(hashString(`${unit.seed}:bidders:${this.game.state.seed}`));
    return createBidders(unit, t.attendees, t.budgets, rng, this.game.state.market, stare, {
      playerLevel: this.game.level(),
      rivalry: this.game.state.rivalry,
    });
  }

  startRun(unit: UnitData, stare: Record<string, number> = {}): AuctionRun {
    const bidders = this.bidders(unit, stare);
    const rng = new RNG(hashString(`${unit.seed}:run:${Date.now()}`));
    return new AuctionRun(bidders, openingAsk(bidders), rng, {
      playerLevel: this.game.level(),
      playerMoney: () => this.game.state.money,
      rivalry: this.game.state.rivalry,
    });
  }

  /** Settle a finished run. Starts the search phase when the player won. */
  settle(run: AuctionRun, unit: UnitData): LotResult {
    const st = this.game.state;
    const t = this.ensureToday();
    const winner = run.phase === 'sold' ? run.leader : null;
    const result: LotResult = {
      unitId: unit.id, winner, price: winner ? run.current : 0, playerBid: run.playerTopBid, trueValue: unit.hidden.hiddenValue,
    };
    if (t.results.some((r) => r.unitId === unit.id)) return t.results.find((r) => r.unitId === unit.id)!;
    t.results.push(result);
    st.stats.auctionsAttended++;

    if (winner === 'player') {
      this.game.economy.spend(run.current, 'auction', { unitId: unit.id }, true);
      st.stats.unitsWon++;
      this.game.progression.unlock('first_blood');
      this.game.progression.addXp(CONFIG.xp.unitWon, 'unit');
      if (run.outbidShark) {
        st.rivalry.shark = (st.rivalry.shark ?? 0) + 1;
        st.stats.sharkBeaten++;
        this.game.progression.unlock('shark_bait');
      }
      if (run.winningPhase === 'final' || run.winningPhase === 'twice') {
        st.stats.finalCallWins++;
        if (run.winningPhase === 'final') this.game.progression.unlock('sniper');
      }
      this.game.search.begin(unit, run.current);
    } else {
      if (winner) t.budgets[winner] = Math.max(0, (t.budgets[winner] ?? 0) - run.current);
      if (run.playerBids > 0) st.stats.unitsLost++;
    }
    this.game.bus.emit('auction:sold', { unit, winner: winner as NpcId | 'player' | null, price: result.price });
    this.game.flushSave();
    return result;
  }

  /** The player sits this one out: the NPCs settle it among themselves. */
  skip(unit: UnitData): LotResult {
    const run = this.startRun(unit);
    run.pass();
    run.runToEnd();
    return this.settle(run, unit);
  }

  nextLot(): UnitData | null {
    const t = this.ensureToday();
    t.index++;
    if (t.index >= t.lots.length) t.finished = true;
    if (t.index > 0) this.game.state.flags.tutorialDone = true;
    this.game.touch();
    return this.currentLot();
  }

  /** Leave early: remaining lots are auctioned without the player. */
  leave(): void {
    const t = this.ensureToday();
    while (!t.finished) {
      const unit = this.currentLot();
      if (!unit) break;
      if (!t.results.some((r) => r.unitId === unit.id)) this.skip(unit);
      this.nextLot();
    }
  }

  summary() {
    const t = this.game.state.today;
    if (!t) return [];
    return t.results.map((r) => {
      const unit = t.lots.find((u) => u.id === r.unitId)!;
      return { unit, result: r, margin: r.winner ? r.trueValue - r.price : 0 };
    });
  }
}
