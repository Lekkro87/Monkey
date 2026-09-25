import { CONFIG, incrementFor } from '../core/config';
import { RNG } from '../core/rng';
import type { BarkKey, NpcId } from '../core/types';
import type { Bidder } from './npc';

/**
 * Live auction state machine. Driven by update(dt); emits events for the UI,
 * audio and camera. The auctioneer escalates "going once → twice → FINAL CALL
 * → SOLD" whenever nobody bids for a while; every bid resets the clock.
 */

export type AuctionPhase = 'opening' | 'live' | 'once' | 'twice' | 'final' | 'sold' | 'nosale';
export type Bidderish = NpcId | 'player';

export type AuctionEvent =
  | { type: 'open'; amount: number }
  | { type: 'drop'; amount: number }
  | { type: 'bid'; bidder: Bidderish; amount: number; jump: boolean }
  | { type: 'ask'; current: number; next: number }
  | { type: 'call'; call: 'once' | 'twice' | 'final'; amount: number }
  | { type: 'out'; npc: NpcId }
  | { type: 'bark'; npc: NpcId; key: BarkKey; params?: Record<string, string | number> }
  | { type: 'autoStop'; reason: 'limit' | 'funds' }
  | { type: 'sold'; winner: Bidderish; price: number }
  | { type: 'nosale' };

export interface AuctionOptions {
  playerLevel: number;
  playerMoney: () => number;
  rivalry: Record<string, number>;
}

export class AuctionRun {
  phase: AuctionPhase = 'opening';
  current = 0;
  ask: number;
  leader: Bidderish | null = null;
  since = 0;
  time = 0;
  drops = 0;
  auto: number | null = null;
  passed = false;
  playerBids = 0;
  playerTopBid = 0;
  winningPhase: AuctionPhase | null = null;
  outbidShark = false;
  history: { bidder: Bidderish; amount: number; t: number }[] = [];
  private queue: AuctionEvent[] = [];
  private playerAutoAt: number | null = null;
  private lastPhaseBeforeBid: AuctionPhase = 'opening';

  constructor(
    readonly bidders: Bidder[],
    opening: number,
    private readonly rng: RNG,
    private readonly opts: AuctionOptions,
  ) {
    this.ask = opening;
    this.emit({ type: 'open', amount: opening });
    this.reschedule();
  }

  get finished(): boolean {
    return this.phase === 'sold' || this.phase === 'nosale';
  }

  get increment(): number {
    return incrementFor(this.current || this.ask);
  }

  /** Seconds until the next auctioneer escalation, for the HUD timer bar. */
  get callProgress(): number {
    const c = CONFIG.auction.calls;
    if (this.phase === 'opening') return Math.min(1, this.since / CONFIG.auction.openingWait);
    return Math.min(1, this.since / c.sold);
  }

  activeBidders(): Bidder[] {
    return this.bidders.filter((b) => !b.dropped);
  }

  drain(): AuctionEvent[] {
    const out = this.queue;
    this.queue = [];
    return out;
  }

  private emit(e: AuctionEvent) {
    this.queue.push(e);
  }

  canPlayerBid(amount = this.ask): { ok: boolean; reason?: 'funds' | 'leader' | 'closed' | 'passed' } {
    if (this.finished) return { ok: false, reason: 'closed' };
    if (this.passed) return { ok: false, reason: 'passed' };
    if (this.leader === 'player') return { ok: false, reason: 'leader' };
    if (amount > this.opts.playerMoney()) return { ok: false, reason: 'funds' };
    return { ok: true };
  }

  playerBid(amount = this.ask): ReturnType<AuctionRun['canPlayerBid']> {
    const check = this.canPlayerBid(amount);
    if (!check.ok) return check;
    const fast = this.since < 1.0 && this.phase !== 'opening';
    this.placeBid('player', Math.max(amount, this.ask), amount > this.ask);
    if (fast) {
      for (const b of this.bidders) {
        if (!b.readPlayer && b.profile.observant > 0.3 && !b.dropped) {
          b.readPlayer = true;
          b.max = Math.min(b.budget, b.max * (1 + CONFIG.auction.playerSignal * b.profile.observant));
          if (this.rng.chance(0.35)) this.emit({ type: 'bark', npc: b.id, key: 'watching_player' });
        }
      }
      this.reschedule();
    }
    return check;
  }

  setAuto(max: number | null) {
    this.auto = max;
    this.playerAutoAt = null;
    if (max !== null) this.scheduleAuto();
  }

  pass() {
    this.passed = true;
    this.auto = null;
    this.playerAutoAt = null;
  }

  update(dt: number) {
    if (this.finished) return;
    this.time += dt;
    this.since += dt;

    // Scheduled drop-outs.
    for (const b of this.bidders) {
      if (b.outAt !== null && this.since >= b.outAt) {
        b.outAt = null;
        this.emit({ type: 'out', npc: b.id });
        if (this.rng.chance(0.55)) this.emit({ type: 'bark', npc: b.id, key: 'drop' });
      }
    }

    // Who bids next?
    let who: Bidder | 'player' | null = null;
    let at = Infinity;
    for (const b of this.bidders) {
      if (b.nextBidAt !== null && b.nextBidAt <= this.since && b.nextBidAt < at) {
        who = b;
        at = b.nextBidAt;
      }
    }
    if (this.playerAutoAt !== null && this.playerAutoAt <= this.since && this.playerAutoAt < at) who = 'player';

    if (who === 'player') {
      this.playerAutoAt = null;
      if (this.canPlayerBid().ok) this.placeBid('player', this.ask, false);
      return;
    }
    if (who) {
      this.npcBid(who);
      return;
    }

    const c = CONFIG.auction.calls;
    if (this.phase === 'opening') {
      if (this.since >= CONFIG.auction.openingWait) {
        if (this.drops < 2 && this.ask > CONFIG.auction.minOpening) {
          this.drops++;
          const inc = incrementFor(this.ask);
          this.ask = Math.max(CONFIG.auction.minOpening, Math.floor((this.ask * CONFIG.auction.openingDrop) / inc) * inc);
          this.since = 0;
          // A cheaper ask brings bidders who had given up back into the room.
          for (const b of this.bidders) {
            if (b.dropped && this.ask <= b.max) {
              b.dropped = false;
              b.outAt = null;
            }
          }
          this.emit({ type: 'drop', amount: this.ask });
          this.reschedule();
        } else {
          this.phase = 'nosale';
          this.emit({ type: 'nosale' });
        }
      }
      return;
    }

    if (this.phase === 'live' && this.since >= c.once) {
      this.phase = 'once';
      this.emit({ type: 'call', call: 'once', amount: this.current });
    } else if (this.phase === 'once' && this.since >= c.twice) {
      this.phase = 'twice';
      this.emit({ type: 'call', call: 'twice', amount: this.current });
    } else if (this.phase === 'twice' && this.since >= c.final) {
      this.phase = 'final';
      this.emit({ type: 'call', call: 'final', amount: this.current });
    } else if (this.phase === 'final' && this.since >= c.sold) {
      this.phase = 'sold';
      this.winningPhase = this.lastPhaseBeforeBid;
      this.emit({ type: 'sold', winner: this.leader!, price: this.current });
    }
  }

  private npcBid(b: Bidder) {
    const inc = incrementFor(this.ask);
    let amount = this.ask;
    let jump = false;
    if (this.rng.chance(b.profile.jumpChance)) {
      const k = this.rng.int(2, 4);
      const target = this.ask + k * inc;
      if (target <= b.max) {
        amount = target;
        jump = true;
      }
    }
    const prev = this.leader;
    this.placeBid(b.id, amount, jump);
    if (jump) this.emit({ type: 'bark', npc: b.id, key: 'jump', params: { amount } });
    else if (prev === 'player' && this.rng.chance(0.4)) this.emit({ type: 'bark', npc: b.id, key: 'outbid_player' });
    else if (this.rng.chance(0.3)) this.emit({ type: 'bark', npc: b.id, key: 'bid' });
  }

  private placeBid(bidder: Bidderish, amount: number, jump: boolean) {
    const prev = this.leader;
    this.lastPhaseBeforeBid = this.phase;
    this.current = amount;
    this.leader = bidder;
    this.ask = amount + incrementFor(amount);
    this.since = 0;
    this.phase = 'live';
    this.history.push({ bidder, amount, t: this.time });
    this.emit({ type: 'bid', bidder, amount, jump });
    this.emit({ type: 'ask', current: this.current, next: this.ask });
    if (bidder === 'player') {
      this.playerBids++;
      this.playerTopBid = amount;
      if (prev === 'shark') this.outbidShark = true;
    }

    // Auction fever: whoever just got outbid wants it a little more.
    if (prev && prev !== 'player' && prev !== bidder) {
      const b = this.bidders.find((x) => x.id === prev)!;
      let fever = b.profile.fever;
      if (bidder === 'player') fever *= 1 + 0.25 * Math.min(4, this.opts.rivalry[b.id] ?? 0);
      b.max = Math.min(b.budget, b.baseMax * (1 + 4 * b.profile.fever), b.max * (1 + fever));
    }
    // Fear of a known shark (level 5 perk).
    if (bidder === 'player' && this.opts.playerLevel >= 5) {
      for (const b of this.bidders) if ((b.id === 'rookie' || b.id === 'bluffer') && !b.readPlayer) { b.max *= 0.85; b.readPlayer = true; }
    }
    this.reschedule();
  }

  private timingSample(b: Bidder): number {
    const c = CONFIG.auction.calls;
    const r = this.rng;
    let t: number;
    switch (b.profile.timing) {
      case 'eager': t = r.range(0.35, 1.3); break;
      case 'sniper': t = r.chance(0.55) ? r.range(c.twice - 0.3, c.final + 0.9) : r.range(1.2, 3.2); break;
      case 'random': t = r.range(0.3, 7.2); break;
      default: t = r.range(0.8, 3.0);
    }
    if (this.phase === 'opening') t = Math.min(t, r.range(0.6, 2.8));
    // Hesitate near their limit.
    const ratio = this.ask / Math.max(1, b.max);
    if (ratio > 0.82) t += (ratio - 0.82) * 12 * r.range(0.4, 1);
    return t;
  }

  private reschedule() {
    for (const b of this.bidders) {
      b.nextBidAt = null;
      if (b.dropped || b.id === this.leader) continue;
      if (this.ask > b.max) {
        // Bluffers never *want* to win; everyone else is out once the ask passes their limit.
        b.dropped = true;
        b.outAt = this.since + this.rng.range(0.3, 1.8);
        continue;
      }
      // The rookie sometimes just loses his nerve.
      if (b.id === 'rookie' && this.current > 0 && this.rng.chance(0.06)) {
        b.dropped = true;
        b.outAt = this.since + this.rng.range(0.5, 2);
        continue;
      }
      b.nextBidAt = this.since + this.timingSample(b);
    }
    this.scheduleAuto();
  }

  private scheduleAuto() {
    if (this.auto === null || this.passed || this.leader === 'player' || this.finished) return;
    if (this.ask > this.auto) {
      this.auto = null;
      this.emit({ type: 'autoStop', reason: 'limit' });
      return;
    }
    if (this.ask > this.opts.playerMoney()) {
      this.auto = null;
      this.emit({ type: 'autoStop', reason: 'funds' });
      return;
    }
    this.playerAutoAt = this.since + this.rng.range(CONFIG.auction.autoBidDelay[0], CONFIG.auction.autoBidDelay[1]);
  }

  /** Run the rest of the auction instantly (used by simulations and when the player passes). */
  runToEnd(maxSeconds = 600, step = 0.05) {
    let t = 0;
    while (!this.finished && t < maxSeconds) {
      this.update(step);
      t += step;
    }
    if (!this.finished) {
      this.phase = this.leader ? 'sold' : 'nosale';
      this.emit(this.leader ? { type: 'sold', winner: this.leader, price: this.current } : { type: 'nosale' });
    }
  }
}
