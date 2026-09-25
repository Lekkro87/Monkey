import { RNG } from '../core/rng';
import type { BuyerOffer } from '../core/types';
import { BUYER_TYPES } from '../data/people';

/**
 * Haggling. The buyer has a hidden maximum, limited patience and a personality;
 * some of them bluff about their "final offer".
 */

export type NegotiationOutcome = 'open' | 'accepted' | 'left';

export interface Negotiation {
  offer: BuyerOffer;
  start: number;
  current: number;
  patience: number;
  finalSaid: boolean;
  outcome: NegotiationOutcome;
  price: number;
  line: string;
  lineParams: Record<string, string | number>;
  mood: 'keen' | 'neutral' | 'annoyed';
  calledBack: boolean;
}

export function startNegotiation(offer: BuyerOffer, rng: RNG): Negotiation {
  const type = BUYER_TYPES[offer.personality];
  return {
    offer,
    start: offer.offer,
    current: offer.offer,
    patience: offer.patience,
    finalSaid: false,
    outcome: 'open',
    price: 0,
    line: rng.pick(type.lines.open),
    lineParams: { offer: offer.offer },
    mood: offer.personality === 'enthusiast' ? 'keen' : 'neutral',
    calledBack: false,
  };
}

function roundOffer(v: number): number {
  if (v < 100) return Math.round(v / 5) * 5;
  if (v < 1000) return Math.round(v / 10) * 10;
  return Math.round(v / 50) * 50;
}

export function accept(n: Negotiation): Negotiation {
  n.outcome = 'accepted';
  n.price = n.current;
  return n;
}

/** The player names a price. */
export function counter(n: Negotiation, ask: number, rng: RNG): Negotiation {
  if (n.outcome !== 'open') return n;
  const type = BUYER_TYPES[n.offer.personality];
  const max = n.offer.maxPay;
  ask = Math.round(ask);

  if (ask <= n.current) {
    n.outcome = 'accepted';
    n.price = ask;
    n.line = rng.pick(type.lines.accept);
    return n;
  }

  // After an honest final offer, any further push ends it.
  if (n.finalSaid && !rng.chance(type.bluff * 0.8)) {
    n.outcome = 'left';
    n.line = rng.pick(type.lines.leave);
    return n;
  }

  if (ask <= max) {
    const room = Math.max(1, max - n.current);
    const acceptP = 0.25 + 0.7 * ((max - ask) / room);
    if (rng.chance(acceptP)) {
      n.outcome = 'accepted';
      n.price = ask;
      n.line = rng.pick(type.lines.accept);
      return n;
    }
    n.patience -= 1;
    n.mood = 'neutral';
  } else {
    const greedy = ask > max * 1.35;
    n.patience -= greedy ? 2 : 1;
    n.mood = 'annoyed';
    if (n.patience <= 0) {
      n.outcome = 'left';
      n.line = rng.pick(type.lines.leave);
      return n;
    }
  }

  if (n.patience <= 0) {
    n.outcome = 'left';
    n.line = rng.pick(type.lines.leave);
    return n;
  }

  const target = Math.min(max, ask);
  const next = roundOffer(Math.min(max, n.current + (target - n.current) * rng.range(0.35, 0.7)));
  n.current = Math.max(n.current, next);
  if (n.patience <= 1) {
    n.finalSaid = true;
    n.line = rng.pick(type.lines.final);
  } else {
    n.line = n.mood === 'annoyed' && rng.chance(0.5) ? rng.pick(type.lines.annoyed) + ' ' + rng.pick(type.lines.counter) : rng.pick(type.lines.counter);
  }
  n.lineParams = { offer: n.current };
  return n;
}

/** The player walks away. Some buyers chase the deal with a better number. */
export function walkAway(n: Negotiation, rng: RNG): Negotiation {
  if (n.outcome !== 'open') return n;
  const type = BUYER_TYPES[n.offer.personality];
  const room = n.offer.maxPay - n.current;
  if (!n.calledBack && room > n.offer.maxPay * 0.06 && rng.chance(0.25 + type.bluff * 0.4)) {
    n.calledBack = true;
    n.current = roundOffer(n.current + room * rng.range(0.4, 0.75));
    n.finalSaid = true;
    n.patience = 1;
    n.line = 'Wait, wait! Okay… {offer}. Final.';
    n.lineParams = { offer: n.current };
    return n;
  }
  n.outcome = 'left';
  n.line = rng.pick(type.lines.leave);
  return n;
}

export function suggestedCounters(n: Negotiation): number[] {
  const c = n.current;
  return [1.15, 1.3, 1.5].map((m) => roundOffer(c * m));
}
