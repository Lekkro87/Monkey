import { CONFIG, incrementFor } from '../core/config';
import { RNG, clamp, lerp } from '../core/rng';
import type { BarkKey, MarketState, NpcId, NpcProfile, UnitData } from '../core/types';
import { itemDef, volumeOf } from '../data/items';
import { NPCS, NPC_MAP } from '../data/npcs';
import { BOX_LABEL_HINTS } from '../data/progression';
import { apparentValue, marketValue } from './items';

/**
 * Rival bidder AI. NPCs only "see" what is visible from the doorway, judge it
 * through their own expertise and taste, guess the unseen part, and turn that
 * into a private maximum bid. They also watch what the player stares at.
 */

export const NPC_TUNING = {
  priorDensity: 800,
  densityBlend: 0.45,
  eventMood: { estate: 1.2, collector: 1.35, mystery: 1.2, trash: 0.55, flood: 0.72 } as Record<string, number>,
  boxGuess: { box_s: 28, box_m: 70, box_l: 100, tote: 95, suitcase: 60 } as Record<string, number>,
  interest: { shark: 0.62, collector: 0.9, dealer: 0.85, rookie: 0.8, millionaire: 0.9, bluffer: 0.9 } as Record<string, number>,
};

export interface Bidder {
  id: NpcId;
  profile: NpcProfile;
  estimate: number;
  max: number;
  baseMax: number;
  budget: number;
  dropped: boolean;
  nextBidAt: number | null;
  outAt: number | null;
  noticed: { uid: string; defId: string; value: number } | null;
  readPlayer: boolean;
  bluffing: boolean;
}

export function pickAttendees(rng: RNG, tutorial: boolean): NpcId[] {
  if (tutorial) return ['rookie', 'dealer', 'bluffer'];
  let list = NPCS.filter((n) => rng.chance(n.attendChance)).map((n) => n.id);
  // Always a crowd of at least three, never more than five.
  const pool = NPCS.map((n) => n.id).filter((id) => !list.includes(id) && id !== 'millionaire');
  while (list.length < 3 && pool.length) list.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  if (list.length > 5) list = rng.shuffle(list).slice(0, 5);
  return list;
}

export function dailyBudgets(rng: RNG, attendees: NpcId[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of attendees) out[id] = Math.round(NPC_MAP[id].budget * rng.range(0.7, 1.25));
  return out;
}

export interface NpcEstimate {
  estimate: number;
  noticed: { uid: string; defId: string; value: number } | null;
}

/** How much one NPC thinks a unit is worth. */
export function estimateUnit(
  npc: NpcProfile,
  unit: UnitData,
  rng: RNG,
  market: Pick<MarketState, 'trends' | 'events'> | null,
  stare: Record<string, number> = {},
): NpcEstimate {
  let visibleSum = 0;
  let visibleVol = 0;
  let totalVol = 0;
  let noticed: NpcEstimate['noticed'] = null;

  for (const p of unit.items) {
    const def = itemDef(p.inst.defId);
    const vol = volumeOf(def);
    totalVol += vol;
    if (p.visibility < CONFIG.inspection.visibleThreshold) continue;
    const exp = clamp(npc.expertiseBy[def.category] ?? npc.expertise, 0, 1);
    const recog = p.visibility >= CONFIG.inspection.recognizeThreshold ? 1 : 0.55;
    let known: number;
    if (def.container && (def.container.kind === 'box' || def.container.kind === 'tote' || def.id === 'suitcase')) {
      const mood = BOX_LABEL_HINTS[p.label ?? '']?.mood ?? 1;
      known = (NPC_TUNING.boxGuess[def.id] ?? 30) * mood + (def.id === 'suitcase' ? apparentValue(p.inst, market) : 0);
    } else {
      const trueV = marketValue(p.inst, market);
      const glance = apparentValue(p.inst, market);
      known = lerp(glance, trueV, exp * recog);
      if (def.container) known += 30;
    }
    const noise = rng.lognorm(0.45 * (1 - exp) + 0.12);
    const aff = npc.affinity[def.category] ?? 1;
    let val = known * noise * aff;
    const stared = stare[p.inst.uid] ?? 0;
    if (stared > 1.5 && npc.observant > 0) {
      val *= 1 + Math.min(CONFIG.auction.stareSignal, stared / 15) * npc.observant;
    }
    visibleSum += val;
    visibleVol += vol;
    if (!noticed || val > noticed.value) noticed = { uid: p.inst.uid, defId: def.id, value: val };
  }

  totalVol *= rng.lognorm(0.15);
  const unseen = Math.max(0, totalVol - visibleVol);
  const seenDensity = visibleVol > 0.05 ? visibleSum / visibleVol : NPC_TUNING.priorDensity;
  const density = clamp(
    NPC_TUNING.densityBlend * seenDensity + (1 - NPC_TUNING.densityBlend) * NPC_TUNING.priorDensity,
    60,
    2600,
  );
  const optimism = npc.id === 'rookie' ? rng.range(0.6, 1.6) : npc.id === 'dealer' ? 0.85 : rng.range(0.85, 1.1);
  const hidden = unseen * density * optimism;
  const mood = unit.event ? NPC_TUNING.eventMood[unit.event] ?? 1 : 1;
  return { estimate: Math.max(0, (visibleSum + hidden) * mood), noticed };
}

export interface BidderContext {
  playerLevel: number;
  rivalry: Record<string, number>;
}

export function createBidders(
  unit: UnitData,
  attendees: NpcId[],
  budgets: Record<string, number>,
  rng: RNG,
  market: Pick<MarketState, 'trends' | 'events'> | null,
  stare: Record<string, number>,
  ctx: BidderContext,
): Bidder[] {
  return attendees.map((id) => {
    const profile = NPC_MAP[id];
    const { estimate, noticed } = estimateUnit(profile, unit, rng, market, stare);
    let ratio = rng.range(profile.bidRatio[0], profile.bidRatio[1]);
    // Nobody wants every unit: some lots simply do not interest a bidder today.
    if (!rng.chance(NPC_TUNING.interest[id] ?? 0.85)) ratio *= rng.range(0.3, 0.6);
    if (id === 'rookie') ratio *= rng.lognorm(0.3);
    if (id === 'millionaire' && !rng.chance(0.4)) ratio *= 0.3;
    if (id === 'collector') {
      const likes = unit.items.some((p) => p.visibility >= CONFIG.inspection.visibleThreshold && (profile.affinity[itemDef(p.inst.defId).category] ?? 0) > 1);
      if (!likes) ratio *= 0.45;
    }
    if (id === 'shark') ratio *= 1 + 0.04 * Math.min(5, ctx.rivalry.shark ?? 0);
    const budget = budgets[id] ?? profile.budget;
    const max = Math.min(budget, estimate * ratio);
    return {
      id,
      profile,
      estimate,
      max,
      baseMax: max,
      budget,
      dropped: false,
      nextBidAt: null,
      outAt: null,
      noticed,
      readPlayer: false,
      bluffing: profile.bluff > 0.5,
    };
  });
}

export function openingAsk(bidders: Bidder[]): number {
  const est = bidders.map((b) => b.estimate).sort((a, b) => a - b);
  const median = est.length ? est[Math.floor(est.length / 2)] : 100;
  const raw = Math.max(CONFIG.auction.minOpening, median * 0.25);
  const inc = incrementFor(raw);
  return Math.max(CONFIG.auction.minOpening, Math.round(raw / inc) * inc);
}

/** Pick a line for an NPC, or null when they have nothing to say. */
export function bark(rng: RNG, npc: NpcProfile, key: BarkKey): string | null {
  const lines = npc.barks[key];
  if (!lines || lines.length === 0) return null;
  return rng.pick(lines);
}

/** What an NPC mutters while looking into the unit. */
export function inspectionBark(rng: RNG, b: Bidder, unitScale: number): { key: BarkKey; item?: string } {
  if (b.bluffing) return { key: rng.chance(0.5) ? 'bluff' : rng.chance(0.5) ? 'inspect_good' : 'inspect_bad' };
  const good = b.estimate > unitScale;
  if (b.noticed && rng.chance(0.45) && b.noticed.value > 120) return { key: 'inspect_item', item: b.noticed.defId };
  return { key: good ? 'inspect_good' : 'inspect_bad' };
}
