import { CONFIG } from '../core/config';
import { RNG, clamp } from '../core/rng';
import type {
  ClueNote, Condition, ItemDef, ItemInstance, ItemKnowledge, MarketState, TrendTag,
} from '../core/types';
import { FAMILIES, ITEMS, familyMembers, itemDef, volumeOf } from '../data/items';
import { EXPERT_MAP } from '../data/people';

// ─── Creation ────────────────────────────────────────────────────────────────

export function isObvious(def: ItemDef): boolean {
  return !def.family;
}

export function initialKnowledge(def: ItemDef): ItemKnowledge {
  return {
    idLevel: isObvious(def) ? 2 : 0,
    conditionKnown: false,
    workingKnown: !def.brokenChance,
    authKnown: !def.fakeChance,
    bonusKnown: !def.bonus,
    steps: [],
    clues: [],
  };
}

export interface CreateOpts {
  uid: string;
  unitId: string | null;
  day: number;
  dirt?: number;
  damage?: number;
  forceAuthentic?: boolean;
}

export function rollCondition(def: ItemDef, rng: RNG): Condition {
  const weights = def.conditionWeights ?? CONFIG.loot.conditionWeights;
  return rng.weightedIndex(weights) as Condition;
}

export function createInstance(def: ItemDef, rng: RNG, opts: CreateOpts): ItemInstance {
  let condition = rollCondition(def, rng);
  if (opts.damage && opts.damage > 0) condition = Math.max(0, condition - opts.damage) as Condition;
  const authentic = opts.forceAuthentic || !def.fakeChance ? true : !rng.chance(def.fakeChance);
  let broken = def.brokenChance ? rng.chance(def.brokenChance) : false;
  if (opts.damage && def.brokenChance && opts.damage >= 2) broken = true;
  const bonus = def.bonus && authentic && rng.chance(def.bonus.chance) ? def.bonus.kind : null;
  const roll = def.variance > 0 ? clamp(1 + rng.gauss(0, def.variance / 2), 1 - def.variance, 1 + def.variance) : 1;
  const dirt = def.category === 'trash' ? 1 : clamp(opts.dirt ?? rng.range(0.1, 0.6), 0, 1);
  return {
    uid: opts.uid,
    defId: def.id,
    condition,
    authentic,
    roll,
    dirt: Math.round(dirt * 100) / 100,
    broken,
    bonus,
    knowledge: initialKnowledge(def),
    location: 'unit',
    unitId: opts.unitId,
    costBasis: 0,
    foundDay: opts.day,
  };
}

// ─── Valuation ───────────────────────────────────────────────────────────────

export function conditionMult(def: ItemDef, c: Condition): number {
  const base = CONFIG.value.condition[c];
  const s = def.conditionSensitivity ?? 1;
  return Math.pow(base, s);
}

export function trendMult(def: ItemDef, market?: Pick<MarketState, 'trends' | 'events'> | null): number {
  if (!market || def.tags.length === 0) return 1;
  let sum = 0;
  for (const tag of def.tags) sum += tagMult(tag, market);
  return sum / def.tags.length;
}

export function tagMult(tag: TrendTag, market: Pick<MarketState, 'trends' | 'events'>): number {
  let m = market.trends[tag] ?? 1;
  for (const e of market.events) if (e.tag === tag) m *= e.mult;
  return m;
}

function bonusMult(def: ItemDef, inst: ItemInstance): number {
  if (!inst.bonus) return 1;
  return def.bonus?.kind === inst.bonus ? def.bonus.mult : CONFIG.value.bonusFallback;
}

/** Raw value with explicit overrides; the building block for every price in the game. */
export function valueWith(
  inst: ItemInstance,
  over: Partial<Pick<ItemInstance, 'condition' | 'authentic' | 'dirt' | 'broken' | 'bonus'>> = {},
  market?: Pick<MarketState, 'trends' | 'events'> | null,
): number {
  const def = itemDef(inst.defId);
  if (def.category === 'trash' || def.baseValue <= 0) return def.baseValue > 0 ? def.baseValue * inst.roll : 0;
  const s = { ...inst, ...over };
  if (def.id === 'cash') return Math.round(def.baseValue * inst.roll);
  let v = def.baseValue * s.roll * conditionMult(def, s.condition);
  if (!s.authentic) v *= def.fakeValue ?? 0.05;
  v *= 1 - CONFIG.value.dirtPenalty * s.dirt;
  if (s.broken) v *= CONFIG.value.brokenMult;
  v *= bonusMult(def, s);
  v *= trendMult(def, market);
  return Math.max(0, v);
}

/** True current market value (hidden from the player). */
export function marketValue(inst: ItemInstance, market?: Pick<MarketState, 'trends' | 'events'> | null): number {
  return valueWith(inst, {}, market);
}

/**
 * What the market pays for the item given what is *publicly* known.
 * Unverified items that could be fake sell at a prior-weighted price.
 */
export function publicValue(inst: ItemInstance, market?: Pick<MarketState, 'trends' | 'events'> | null): number {
  const def = itemDef(inst.defId);
  if (def.fakeChance && !inst.knowledge.authKnown) {
    const genuine = valueWith(inst, { authentic: true }, market);
    const fake = valueWith(inst, { authentic: false }, market);
    const p = def.fakeChance;
    return (1 - p) * genuine * CONFIG.value.unverifiedDiscount + p * fake;
  }
  const v = marketValue(inst, market);
  // Unknown bonuses are not priced in until someone notices them.
  if (inst.bonus && !inst.knowledge.bonusKnown) return v / bonusMult(def, inst);
  return v;
}

/** Expected value of a family as it looks at a glance (used by NPCs and net worth). */
const familyMeanCache = new Map<string, number>();
export function familyMean(family: string): number {
  const cached = familyMeanCache.get(family);
  if (cached !== undefined) return cached;
  const members = familyMembers(family);
  const w = { common: 60, uncommon: 26, rare: 9, epic: 2.5, legendary: 0.08, mythic: 0, unique: 0 } as const;
  let total = 0;
  let sum = 0;
  for (const m of members) {
    const weight = w[m.rarity];
    const p = m.fakeChance ?? 0;
    const v = m.baseValue * ((1 - p) + p * (m.fakeValue ?? 0.05));
    total += weight;
    sum += weight * v;
  }
  const mean = total > 0 ? sum / total : 0;
  familyMeanCache.set(family, mean);
  return mean;
}

/** What an item appears to be worth to someone who only glanced at it. */
export function apparentValue(inst: ItemInstance, market?: Pick<MarketState, 'trends' | 'events'> | null): number {
  const def = itemDef(inst.defId);
  if (def.category === 'container' && def.baseValue <= 5) return 0;
  if (def.family && inst.knowledge.idLevel < 2) {
    if (inst.knowledge.idLevel === 1) {
      const lo = valueWith(inst, { authentic: false, condition: inst.condition }, market);
      const hi = valueWith(inst, { authentic: true }, market);
      const p = def.fakeChance ?? 0;
      return p * lo + (1 - p) * hi * 0.9;
    }
    return familyMean(def.family) * trendMult(def, market) * (1 - 0.25 * inst.dirt);
  }
  return publicValue(inst, market);
}

// ─── Player-facing identity & estimates ─────────────────────────────────────

export function displayName(inst: ItemInstance): string {
  const def = itemDef(inst.defId);
  const k = inst.knowledge;
  if (def.family && k.idLevel === 0) return FAMILIES[def.family].unknownName;
  if (def.family && k.idLevel === 1) return def.possibleName ?? def.name;
  if (k.authKnown && !inst.authentic && def.fakeName) return def.fakeName;
  return def.name;
}

export function isFakeKnown(inst: ItemInstance): boolean {
  return inst.knowledge.authKnown && !inst.authentic;
}

export function visibleRarity(inst: ItemInstance): ItemDef['rarity'] | null {
  const def = itemDef(inst.defId);
  if (def.family && inst.knowledge.idLevel < 2) return null;
  if (isFakeKnown(inst)) return 'common';
  return def.rarity;
}

export function conditionRange(inst: ItemInstance): [Condition, Condition] {
  if (inst.knowledge.conditionKnown) return [inst.condition, inst.condition];
  return [Math.max(0, inst.condition - 1) as Condition, Math.min(6, inst.condition + 1) as Condition];
}

/** Value range as the player currently understands it. */
export function estimateRange(inst: ItemInstance, market?: Pick<MarketState, 'trends' | 'events'> | null): [number, number] {
  const def = itemDef(inst.defId);
  const k = inst.knowledge;
  if (def.category === 'trash') return [0, Math.max(1, def.baseValue)];
  if (def.id === 'cash') { const v = marketValue(inst); return [v, v]; }
  if (def.family && k.idLevel === 0) {
    const members = familyMembers(def.family);
    let lo = Infinity;
    let hi = 0;
    for (const m of members) {
      const fake = m.fakeChance ? m.fakeValue ?? 0.05 : 1;
      lo = Math.min(lo, m.baseValue * conditionMultRaw(m, 1) * fake * (m.brokenChance ? CONFIG.value.brokenMult : 1));
      hi = Math.max(hi, m.baseValue * (1 + m.variance) * conditionMultRaw(m, 5));
    }
    const tm = trendMult(def, market);
    return [roundNice(lo * tm), roundNice(hi * tm)];
  }
  if (k.idLevel === 3) {
    const v = marketValue(inst, market);
    return [roundNice(v * 0.95), roundNice(v * 1.05)];
  }
  const [cLo, cHi] = conditionRange(inst);
  const authOptions = k.authKnown ? [inst.authentic] : [true, false];
  const brokenOptions = k.workingKnown ? [inst.broken] : [false, true];
  let lo = Infinity;
  let hi = 0;
  for (const authentic of authOptions) {
    for (const broken of brokenOptions) {
      const a = valueWith(inst, { condition: cLo, authentic, broken, bonus: k.bonusKnown ? inst.bonus : null }, market);
      const b = valueWith(inst, { condition: cHi, authentic, broken, bonus: k.bonusKnown ? inst.bonus : null }, market);
      lo = Math.min(lo, a, b);
      hi = Math.max(hi, a, b);
    }
  }
  const spread = k.idLevel === 1 ? 0.35 : 0.15;
  return [roundNice(lo * (1 - spread / 2)), roundNice(hi * (1 + spread / 2))];
}

function conditionMultRaw(def: ItemDef, c: number): number {
  return Math.pow(CONFIG.value.condition[c], def.conditionSensitivity ?? 1);
}

export function estimateMid(inst: ItemInstance, market?: Pick<MarketState, 'trends' | 'events'> | null): number {
  const def = itemDef(inst.defId);
  if (def.family && inst.knowledge.idLevel === 0) return apparentValue(inst, market);
  const [lo, hi] = estimateRange(inst, market);
  return Math.sqrt(Math.max(1, lo) * Math.max(1, hi));
}

export function roundNice(v: number): number {
  if (v < 10) return Math.max(0, Math.round(v));
  if (v < 100) return Math.round(v / 5) * 5;
  if (v < 1000) return Math.round(v / 10) * 10;
  if (v < 10000) return Math.round(v / 50) * 50;
  if (v < 100000) return Math.round(v / 500) * 500;
  return Math.round(v / 1000) * 1000;
}

// ─── Inspection ──────────────────────────────────────────────────────────────

export interface InspectStep {
  id: string;
  label: string;
  cost: number;
  requires?: string;
  available: boolean;
  done: boolean;
  note?: string;
}

type StepSpec = { id: string; label: string; cost?: number; requires?: string; when?: (def: ItemDef) => boolean };

const LOOK: StepSpec = { id: 'look', label: 'Look it over' };

const PROFILE_STEPS: Record<ItemDef['inspect'], StepSpec[]> = {
  watch: [
    { id: 'look', label: 'Turn it over' },
    { id: 'markings', label: 'Check dial & logo' },
    { id: 'serial', label: 'Read the serial number' },
    { id: 'wind', label: 'Wind it up', when: (d) => !!d.brokenChance },
    { id: 'open_case', label: 'Open the case back', requires: 'precision_tools', when: (d) => !!d.fakeChance },
  ],
  jewelry: [
    LOOK,
    { id: 'hallmark', label: 'Look for hallmarks' },
    { id: 'weigh', label: 'Weigh it' },
    { id: 'loupe', label: 'Examine under loupe & UV', requires: 'uv_lamp', when: (d) => !!d.fakeChance },
  ],
  camera: [
    LOOK,
    { id: 'markings', label: 'Read the name plate' },
    { id: 'shutter', label: 'Fire the shutter', when: (d) => !!d.brokenChance },
    { id: 'open_body', label: 'Check serial & internals', requires: 'precision_tools', when: (d) => !!d.fakeChance },
  ],
  electronics: [
    LOOK,
    { id: 'label', label: 'Read the type label', when: (d) => !!d.family },
    { id: 'power', label: 'Plug it in', when: (d) => !!d.brokenChance },
  ],
  console: [
    LOOK,
    { id: 'label', label: 'Check box & labels' },
    { id: 'power', label: 'Hook it up and test', when: (d) => !!d.brokenChance },
  ],
  music: [
    { id: 'look', label: 'Open the case' },
    { id: 'serial', label: 'Check headstock & serial' },
    { id: 'play', label: 'Plug in and play', when: (d) => !!d.brokenChance },
    { id: 'neck', label: 'Remove the neck, check dates', requires: 'precision_tools', when: (d) => !!d.fakeChance },
  ],
  art: [
    LOOK,
    { id: 'back', label: 'Check back & signature' },
    { id: 'uv', label: 'Inspect under UV light', requires: 'uv_lamp', when: (d) => !!d.fakeChance },
  ],
  paper: [
    LOOK,
    { id: 'details', label: 'Check issue & edition details' },
    { id: 'uv', label: 'Inspect under UV light', requires: 'uv_lamp', when: (d) => !!d.fakeChance },
  ],
  coins: [
    LOOK,
    { id: 'dates', label: 'Read dates & mint marks' },
    { id: 'weigh', label: 'Weigh on the scale', when: (d) => !!d.fakeChance },
  ],
  furniture: [
    LOOK,
    { id: 'joints', label: 'Check joints & wood', when: (d) => !!d.family },
    { id: 'maker', label: 'Look for maker\'s labels', when: (d) => !!d.fakeChance },
  ],
  fashion: [
    LOOK,
    { id: 'stitching', label: 'Check stitching & materials', when: (d) => !!d.family },
    { id: 'datecode', label: 'Verify date code under UV', requires: 'uv_lamp', when: (d) => !!d.fakeChance },
  ],
  tools: [LOOK, { id: 'power', label: 'Test it', when: (d) => !!d.brokenChance }],
  generic: [LOOK, { id: 'power', label: 'Test it', when: (d) => !!d.brokenChance }],
  document: [{ id: 'read', label: 'Read it' }],
};

export function inspectionSteps(inst: ItemInstance, upgrades: string[]): InspectStep[] {
  const def = itemDef(inst.defId);
  const specs = PROFILE_STEPS[def.inspect].filter((s) => !s.when || s.when(def));
  const steps: InspectStep[] = specs.map((s) => ({
    id: s.id,
    label: s.label,
    cost: s.cost ?? 0,
    requires: s.requires,
    available: !s.requires || upgrades.includes(s.requires),
    done: inst.knowledge.steps.includes(s.id),
  }));
  if (def.id === 'film_rolls') {
    steps.push({ id: 'develop', label: 'Develop at the photo lab', cost: CONFIG.workshop.photoLab, available: true, done: inst.knowledge.steps.includes('develop') });
  }
  return steps;
}

/** A red or green flag for authenticity, noisy on purpose so experts stay useful. */
function authFlag(inst: ItemInstance, rng: RNG, redText: string, greenText: string, neutralText: string): ClueNote {
  if (!inst.authentic) {
    if (rng.chance(0.7)) return { k: redText, tone: -1 };
    if (rng.chance(0.4)) return { k: greenText, tone: 1 };
    return { k: neutralText, tone: 0 };
  }
  if (rng.chance(0.6)) return { k: greenText, tone: 1 };
  if (rng.chance(0.2)) return { k: redText, tone: -1 };
  return { k: neutralText, tone: 0 };
}

export interface StepResult {
  clues: ClueNote[];
  identified: boolean;
  fakeExposed: boolean;
  questProgress?: boolean;
}

/** Perform one inspection action. Mutates the instance's knowledge. */
export function performStep(inst: ItemInstance, stepId: string, rng: RNG): StepResult {
  const def = itemDef(inst.defId);
  const k = inst.knowledge;
  const before = k.idLevel;
  const clues: ClueNote[] = [];
  let fakeExposed = false;
  if (!k.steps.includes(stepId)) k.steps.push(stepId);

  const raiseId = (lvl: 1 | 2) => {
    if (!def.family) return;
    if (lvl === 1 && k.idLevel === 0) k.idLevel = def.possibleName ? 1 : 2;
    else if (lvl === 2 && k.idLevel < 2) k.idLevel = 2;
  };

  switch (stepId) {
    case 'look': {
      k.conditionKnown = true;
      clues.push({ k: 'Condition: {condition}.', p: { condition: conditionLabel(inst.condition) } });
      if (inst.dirt > 0.55) clues.push({ k: 'Filthy. A proper cleaning would help.' });
      raiseId(1);
      if (def.family && k.idLevel >= 1) clues.push({ k: 'Looks like: {name}.', p: { name: displayName(inst) } });
      break;
    }
    case 'markings':
    case 'label':
    case 'details':
    case 'dates':
    case 'hallmark':
    case 'back':
    case 'serial':
    case 'joints':
    case 'stitching': {
      raiseId(1);
      raiseId(2);
      clues.push({ k: 'Identified: {name}.', p: { name: def.name } });
      if (def.fakeChance) {
        const flag = FLAG_TEXT[def.inspect] ?? FLAG_TEXT.generic;
        clues.push(authFlag(inst, rng, flag[0], flag[1], flag[2]));
      }
      if (def.bonus && inst.bonus && rng.chance(0.5)) {
        k.bonusKnown = true;
        clues.push({ k: 'Bonus: {bonus}!', p: { bonus: def.bonus.label }, tone: 1 });
      }
      break;
    }
    case 'wind':
    case 'shutter':
    case 'power':
    case 'play': {
      k.workingKnown = true;
      clues.push(inst.broken
        ? { k: 'It does not work. It needs a repair.', tone: 0 }
        : { k: 'Works perfectly.', tone: 0 });
      break;
    }
    case 'weigh': {
      if (def.fakeChance) {
        clues.push(inst.authentic
          ? { k: 'The weight is exactly right for solid metal.', tone: 1 }
          : { k: 'Too light. Solid gold would weigh more.', tone: -1 });
        if (def.inspect === 'coins') {
          k.authKnown = true;
          fakeExposed = !inst.authentic;
        }
      } else {
        clues.push({ k: 'Nothing unusual about the weight.' });
      }
      break;
    }
    case 'open_case':
    case 'open_body':
    case 'neck':
    case 'loupe':
    case 'uv':
    case 'maker':
    case 'datecode': {
      k.authKnown = true;
      const conclusive = CONCLUSIVE_TEXT[stepId] ?? CONCLUSIVE_TEXT.uv;
      if (inst.authentic) clues.push({ k: conclusive[0], tone: 1 });
      else {
        clues.push({ k: conclusive[1], tone: -1 });
        fakeExposed = true;
      }
      raiseId(2);
      break;
    }
    case 'read': {
      k.idLevel = 2;
      k.conditionKnown = true;
      clues.push({ k: def.flavor });
      break;
    }
    case 'develop': {
      clues.push({ k: 'The prints show protests, concerts and faces from 1971. Every frame is signed "E.M."' });
      return { clues: pushClues(inst, clues), identified: false, fakeExposed: false, questProgress: true };
    }
    default:
      break;
  }
  return { clues: pushClues(inst, clues), identified: before < 2 && k.idLevel >= 2, fakeExposed };
}

function pushClues(inst: ItemInstance, clues: ClueNote[]): ClueNote[] {
  inst.knowledge.clues.push(...clues);
  if (inst.knowledge.clues.length > 16) inst.knowledge.clues.splice(0, inst.knowledge.clues.length - 16);
  return clues;
}

const FLAG_TEXT: Record<string, [string, string, string]> = {
  watch: ['The crown logo looks slightly off.', 'Crisp dial printing, a perfect logo.', 'The dial is too dirty to judge the printing.'],
  jewelry: ['The stamp reads "GP". Gold plated?', 'Stamped 14K with a maker\'s mark.', 'The hallmark is worn and hard to read.'],
  camera: ['The engraving is shallow and the font is wrong.', 'Deep, clean engravings. Feels like the real thing.', 'The name plate is scratched.'],
  music: ['The serial font does not match that year.', 'The serial number checks out for the year.', 'The serial is partly worn off.'],
  art: ['The canvas is machine-woven. Too modern?', 'Hand-stretched linen, old nails, period stretcher.', 'Hard to tell under the dust.'],
  paper: ['The printing looks flat and too glossy.', 'Paper, ink and printing all look period-correct.', 'Inconclusive at first glance.'],
  coins: ['The strike looks soft and mushy.', 'Sharp strike, correct mint mark.', 'The capsule is scratched. Hard to see.'],
  furniture: ['Screws instead of the original fittings.', 'Original fittings and period construction.', 'Someone reupholstered it. Hard to say.'],
  fashion: ['Uneven stitching and a plastic smell.', 'Perfect stitching, quality leather.', 'Well used. Hard to judge.'],
  generic: ['Something feels off about it.', 'It looks right.', 'Hard to tell.'],
};

const CONCLUSIVE_TEXT: Record<string, [string, string]> = {
  open_case: ['In-house mechanical movement, beautifully finished. It is genuine.', 'A cheap quartz movement inside. It is a fake.'],
  open_body: ['Serial and internals match the factory records. Genuine.', 'Plastic internals and a made-up serial. A knock-off.'],
  neck: ['Neck date, pot codes and wood all match. Genuine!', 'Modern pots and a CNC-cut neck pocket. A replica.'],
  loupe: ['Natural inclusions and a solid-gold stamp. Genuine.', 'Air bubbles in the stones and plating under the loupe. Fake.'],
  uv: ['No modern retouching or fluorescent ink. Genuine.', 'Modern inks glow under UV. It is a fake.'],
  maker: ['Original manufacturer\'s label and shock mounts. Genuine.', 'No labels, cheap veneer. An unlicensed replica.'],
  datecode: ['The date code checks out. Genuine.', 'The date code format never existed. Counterfeit.'],
};

export function conditionLabel(c: Condition): string {
  return ['Destroyed', 'Poor', 'Used', 'Good', 'Very Good', 'Excellent', 'Mint'][c];
}

// ─── Workshop ────────────────────────────────────────────────────────────────

export function canClean(inst: ItemInstance): boolean {
  const def = itemDef(inst.defId);
  return (!!def.cleanable || !!def.cleaningHurts) && inst.dirt > 0.08;
}

export function cleaningCost(inst: ItemInstance, upgrades: string[]): number {
  const def = itemDef(inst.defId);
  const base = CONFIG.workshop.cleanBase + CONFIG.workshop.cleanPerM3 * volumeOf(def) * 10 * inst.dirt;
  const mult = upgrades.includes('cleaning_station') ? 0.6 : 1;
  return Math.max(5, Math.round(base * mult));
}

export function clean(inst: ItemInstance): { valueBefore: number; valueAfter: number; hurt: boolean } {
  const def = itemDef(inst.defId);
  const before = marketValue(inst);
  inst.dirt = 0;
  let hurt = false;
  if (def.cleaningHurts) {
    inst.condition = Math.max(0, inst.condition - 2) as Condition;
    hurt = true;
    inst.knowledge.clues.push({ k: 'Cleaning scratched the surface. Collectors hate that.', tone: 0 });
  }
  inst.cleanedTimes = (inst.cleanedTimes ?? 0) + 1;
  return { valueBefore: before, valueAfter: marketValue(inst), hurt };
}

export interface RepairOptions {
  diyCost: number;
  diyChance: number;
  proCost: number;
}

export function canRepair(inst: ItemInstance): boolean {
  const def = itemDef(inst.defId);
  return !!def.repairCost && (inst.broken || inst.condition <= 2);
}

export function repairOptions(inst: ItemInstance, upgrades: string[]): RepairOptions {
  const def = itemDef(inst.defId);
  const pro = def.repairCost ?? 50;
  const tools = def.category === 'electronics' || def.inspect === 'electronics'
    ? upgrades.includes('electronics_bench')
    : upgrades.includes('precision_tools');
  return {
    diyCost: Math.max(5, Math.round(pro * CONFIG.workshop.diyCostFactor)),
    diyChance: tools ? CONFIG.workshop.diySuccessTools : CONFIG.workshop.diySuccess,
    proCost: pro,
  };
}

export function repair(inst: ItemInstance, mode: 'diy' | 'pro', upgrades: string[], rng: RNG): { success: boolean; valueBefore: number; valueAfter: number } {
  const opts = repairOptions(inst, upgrades);
  const before = marketValue(inst);
  const success = mode === 'pro' ? true : rng.chance(opts.diyChance);
  if (success) {
    inst.broken = false;
    inst.condition = Math.min(5, Math.max(inst.condition + 1, 3)) as Condition;
    inst.knowledge.workingKnown = true;
    inst.knowledge.conditionKnown = true;
    inst.repairedTimes = (inst.repairedTimes ?? 0) + 1;
  } else {
    inst.condition = Math.max(0, inst.condition - 1) as Condition;
    inst.knowledge.conditionKnown = true;
  }
  return { success, valueBefore: before, valueAfter: marketValue(inst) };
}

export function expertFor(inst: ItemInstance) {
  const def = itemDef(inst.defId);
  return def.expert ? EXPERT_MAP[def.expert] : null;
}

export function expertFee(inst: ItemInstance): number {
  const expert = expertFor(inst);
  if (!expert) return 0;
  const [, hi] = estimateRange(inst);
  const fee = (CONFIG.workshop.expertBase + CONFIG.workshop.expertPct * Math.min(hi, 20000)) * expert.feeMult;
  return Math.min(CONFIG.workshop.expertMax, Math.round(fee / 5) * 5);
}

export function appraise(inst: ItemInstance, market?: Pick<MarketState, 'trends' | 'events'> | null): { fakeExposed: boolean; value: number } {
  const def = itemDef(inst.defId);
  const k = inst.knowledge;
  const wasAuthKnown = k.authKnown;
  k.idLevel = 3;
  k.conditionKnown = true;
  k.workingKnown = true;
  k.authKnown = true;
  k.bonusKnown = true;
  if (!k.steps.includes('expert')) k.steps.push('expert');
  const value = marketValue(inst, market);
  const expert = expertFor(inst);
  const verdict = !inst.authentic
    ? 'A fake. Sorry.'
    : def.fakeChance ? 'Authentic, no doubt about it.' : 'Exactly what it looks like.';
  k.clues.push({ k: '{expert}: "{verdict}"', p: { expert: expert?.name ?? 'Expert', verdict }, tone: inst.authentic ? 1 : -1 });
  if (inst.bonus && def.bonus) k.clues.push({ k: 'Bonus: {bonus}!', p: { bonus: def.bonus.label }, tone: 1 });
  return { fakeExposed: !inst.authentic && !wasAuthKnown, value };
}

/** Evidence balance from clues, for the "reads as genuine / suspicious" hint. */
export function authenticityRead(inst: ItemInstance): 'verified' | 'fake' | 'genuine?' | 'suspicious' | 'unknown' | null {
  const def = itemDef(inst.defId);
  if (!def.fakeChance) return null;
  if (inst.knowledge.authKnown) return inst.authentic ? 'verified' : 'fake';
  const score = inst.knowledge.clues.reduce((s, c) => s + (c.tone ?? 0), 0);
  if (score > 0) return 'genuine?';
  if (score < 0) return 'suspicious';
  return 'unknown';
}

export { ITEMS };
