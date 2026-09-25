import { CONFIG } from '../core/config';
import { RNG, clamp, lerp } from '../core/rng';
import type {
  Category, ItemDef, ItemInstance, MarketState, PlacedItem, Rarity, Tarp, UnitBlueprint, UnitData,
  UnitHiddenStats, UnitSizeId, Vec3,
} from '../core/types';
import { ITEMS, ITEM_LIST, itemDef, volumeOf } from '../data/items';
import type { FacilityDef } from '../data/facilities';
import { TENANT_FIRST, TENANT_LAST } from '../data/units';
import { apparentValue, createInstance, marketValue } from './items';

/**
 * Procedural storage-unit generator.
 * Produces contents, container loot, secret compartments, a physical layout
 * and a line-of-sight visibility value per item as seen from the doorway.
 */

export interface GenerateOpts {
  facility: FacilityDef;
  blueprint: UnitBlueprint;
  seed: number;
  day: number;
  level: number;
  number: string;
  slot?: number;
  uid: () => string;
  market?: Pick<MarketState, 'trends' | 'events'> | null;
  storyItem?: string | null;
  size?: UnitSizeId;
  tutorial?: boolean;
}

/** Items that never come out of the regular loot tables. */
const SPECIAL_SPAWN = new Set(['safe', 'jewelry_box', 'toolbox', 'suitcase', 'tote', 'box_s', 'box_m', 'box_l']);

const LOOT_POOL: ItemDef[] = ITEM_LIST.filter(
  (d) => !d.special && d.category !== 'trash' && d.category !== 'container' && !SPECIAL_SPAWN.has(d.id),
);

const TRASH_TABLE: [string, number][] = [
  ['trash_bag', 5], ['junk_electronics', 3], ['paint_cans', 3], ['magazines', 3], ['broken_chair', 2], ['tire', 2], ['mattress', 1.6],
];

const SECRET_TABLE: [string, number][] = [
  ['cash', 5], ['savings_bonds', 2], ['old_papers', 2], ['gold_ring', 1.5], ['gold_coin', 1.2], ['pw_gold', 1],
  ['watch_vintage', 0.6], ['deco_brooch', 0.35], ['watch_jackpot', 0.015],
];

const SAFE_TABLE: [string, number][] = [
  ['cash', 5], ['savings_bonds', 2], ['old_papers', 2.5], ['gold_coin', 2], ['gold_ring', 1.5], ['silver_necklace', 1.5],
  ['pw_gold', 1], ['watch_luxury', 1], ['deco_brooch', 0.4], ['watch_jackpot', 0.02],
];

const LABEL_BY_CATEGORY: Partial<Record<Category, string[]>> = {
  household: ['KITCHEN', 'BATHROOM', 'LIVING ROOM', 'XMAS'],
  electronics: ['ELECTRONICS', 'CABLES', 'GAMES', 'OFFICE'],
  tools: ['TOOLS', 'GARAGE', 'SHOP'],
  collectibles: ['COLLECTION', 'COMICS', 'CARDS', 'COINS'],
  jewelry: ['JEWELRY', 'MOM', 'VALUABLES'],
  art: ['PICTURES', 'FRAGILE', 'ART'],
  music: ['RECORDS', 'MUSIC'],
  sports: ['SPORTS', 'GYM'],
  fashion: ['CLOTHES', 'SHOES', 'WINTER'],
  media: ['BOOKS', 'RECORDS', 'DVDS'],
  toys: ['TOYS', 'KIDS ROOM'],
  documents: ['PAPERS', 'TAXES', 'PHOTOS', 'LETTERS'],
};

// ─── Loot rolling ────────────────────────────────────────────────────────────

export function rollRarity(rng: RNG, boost: number): Rarity {
  const w = CONFIG.loot.rarityWeights;
  const up = Math.max(0.2, boost);
  return rng.weighted<Rarity>([
    ['common', w.common],
    ['uncommon', w.uncommon * Math.sqrt(up)],
    ['rare', w.rare * up],
    ['epic', w.epic * Math.pow(up, 1.2)],
    ['legendary', w.legendary * up * up],
  ]);
}

const DOWNGRADE: Record<Rarity, Rarity | null> = {
  unique: 'mythic', mythic: 'legendary', legendary: 'epic', epic: 'rare', rare: 'uncommon', uncommon: 'common', common: null,
};

export function pickDef(
  rng: RNG,
  rarity: Rarity,
  weights: Partial<Record<Category, number>>,
  filter: (d: ItemDef) => boolean,
): ItemDef | null {
  let r: Rarity | null = rarity;
  while (r) {
    const candidates = LOOT_POOL.filter((d) => d.rarity === r && (weights[d.category] ?? 0) > 0 && filter(d));
    if (candidates.length > 0) {
      const perCat = new Map<Category, number>();
      for (const c of candidates) perCat.set(c.category, (perCat.get(c.category) ?? 0) + 1);
      return rng.weighted(candidates.map((d) => [d, (weights[d.category] ?? 0) / perCat.get(d.category)!] as [ItemDef, number]));
    }
    r = DOWNGRADE[r];
  }
  return null;
}

function mergeWeights(
  base: Partial<Record<Category, number>>,
  bias?: Partial<Record<Category, number>>,
): Partial<Record<Category, number>> {
  if (!bias) return base;
  const out: Partial<Record<Category, number>> = {};
  for (const [k, v] of Object.entries(base)) out[k as Category] = (v ?? 0) * 0.3;
  for (const [k, v] of Object.entries(bias)) out[k as Category] = (out[k as Category] ?? 0) + (v ?? 0);
  return out;
}

// ─── Generation ─────────────────────────────────────────────────────────────

interface Draft {
  inst: ItemInstance;
  def: ItemDef;
  label?: string;
  contents?: ItemInstance[];
}

export function generateUnit(opts: GenerateOpts): UnitData {
  const rng = new RNG(opts.seed);
  const bp = opts.blueprint;
  const boost = bp.rarityBoost * opts.facility.rarityMult;
  const sizes = bp.sizes.filter((s) => CONFIG.unitSizes[s].minLevel <= opts.level);
  const size: UnitSizeId = opts.size ?? (opts.tutorial ? '5x10' : rng.pick(sizes.length ? sizes : bp.sizes));
  const sz = CONFIG.unitSizes[size];
  const unitId = `${opts.facility.id}-${opts.number}-d${opts.day}`;

  const dirtRoll = () => clamp(rng.range(bp.dirt[0], bp.dirt[1]) + rng.gauss(0, 0.08), 0, 1);
  const damageRoll = () => (rng.chance(bp.damageChance) ? rng.int(1, bp.event === 'flood' ? 3 : 2) : 0);

  const make = (def: ItemDef, extra: Partial<{ forceAuthentic: boolean; damage: number }> = {}): ItemInstance => {
    let damage = extra.damage ?? damageRoll();
    if (bp.event === 'flood' && damage > 0 && ['media', 'collectibles', 'art', 'documents'].includes(def.category)) damage += 1;
    const inst = createInstance(def, rng, {
      uid: opts.uid(), unitId, day: opts.day, dirt: dirtRoll(), damage, forceAuthentic: extra.forceAuthentic,
    });
    if (def.id === 'cash') inst.roll = Math.round(rng.range(0.25, 2.2) * 100) / 100;
    return inst;
  };

  const lootItem = (weights: Partial<Record<Category, number>>, filter: (d: ItemDef) => boolean): ItemInstance | null => {
    const def = pickDef(rng, rollRarity(rng, boost), weights, filter);
    return def ? make(def) : null;
  };

  const fillContainer = (draft: Draft) => {
    const spec = draft.def.container!;
    if (spec.kind === 'safe') {
      const n = rng.chance(0.2) ? 0 : rng.int(1, 3);
      draft.contents = [];
      for (let i = 0; i < n; i++) {
        const inst = make(itemDef(rng.weighted(SAFE_TABLE)), { damage: 0 });
        if (inst.defId === 'cash') inst.roll *= 1.6;
        draft.contents.push(inst);
      }
      draft.inst.lockedContents = draft.contents;
      draft.contents = [];
      return;
    }
    const n = rng.int(spec.slots[0], spec.slots[1]);
    const weights = mergeWeights(bp.categoryWeights, spec.lootBias);
    const contents: ItemInstance[] = [];
    for (let i = 0; i < n; i++) {
      if (spec.kind === 'box' || spec.kind === 'tote') {
        if (rng.chance(bp.trashRatio[0] * 0.8)) {
          const small = TRASH_TABLE.filter(([id]) => volumeOf(ITEMS[id]) <= spec.maxItemVolume);
          if (small.length) { contents.push(make(itemDef(rng.weighted(small)))); continue; }
        }
      }
      const inst = lootItem(weights, (d) => volumeOf(d) <= spec.maxItemVolume && !d.container);
      if (inst) contents.push(inst);
    }
    draft.contents = contents;
    const secretChance = (spec.secretChance ?? 0) * bp.secretChance;
    if (secretChance > 0 && rng.chance(secretChance)) {
      const s = rng.int(1, 2);
      draft.inst.secret = [];
      for (let i = 0; i < s; i++) draft.inst.secret.push(make(itemDef(rng.weighted(SECRET_TABLE)), { damage: 0 }));
    }
    if (spec.kind === 'box' || spec.kind === 'tote') draft.label = boxLabel(rng, bp, contents);
  };

  // How many things are in here?
  const fill = rng.range(bp.fill[0], bp.fill[1]);
  const count = Math.round(lerp(sz.items[0], sz.items[1], fill) * bp.density * (opts.tutorial ? 0.8 : 1));
  const trashCount = Math.round(count * rng.range(bp.trashRatio[0], bp.trashRatio[1]));
  const boxCount = Math.round((count - trashCount) * bp.boxShare);
  const looseCount = Math.max(1, count - trashCount - boxCount);

  const drafts: Draft[] = [];
  const bigUnit = sz.w >= 3 || sz.d >= 3;

  for (let i = 0; i < trashCount; i++) {
    const table = bigUnit ? TRASH_TABLE : TRASH_TABLE.filter(([id]) => id !== 'mattress');
    const def = itemDef(rng.weighted(table));
    drafts.push({ inst: make(def), def });
  }

  const boxTable: [string, number][] = [['box_s', 3], ['box_m', 4], ['box_l', 2.4], ['tote', 1.4], ['suitcase', 0.5]];
  for (let i = 0; i < boxCount; i++) {
    const def = itemDef(rng.weighted(boxTable));
    const draft: Draft = { inst: make(def, { damage: 0 }), def };
    fillContainer(draft);
    drafts.push(draft);
  }

  const looseFilter = (d: ItemDef) => volumeOf(d) >= 0.004 && (bigUnit || (d.dims[0] <= 1.3 && d.dims[2] <= 1.3));
  for (let i = 0; i < looseCount; i++) {
    const inst = lootItem(bp.categoryWeights, looseFilter);
    if (!inst) continue;
    const def = itemDef(inst.defId);
    const draft: Draft = { inst, def };
    if (def.container) fillContainer(draft);
    drafts.push(draft);
  }

  // Special spawns.
  const specials: [string, number][] = [
    ['jewelry_box', bp.id === 'estate' ? 0.4 : bp.id === 'household' ? 0.16 : 0.07],
    ['toolbox', bp.id === 'contractor' ? 0.7 : 0.08],
    ['safe', bp.id === 'estate' ? 0.08 : bp.id === 'mystery' ? 0.07 : bp.id === 'hoarder' ? 0.05 : 0.025],
  ];
  for (const [id, p] of specials) {
    if (!rng.chance(p)) continue;
    const def = itemDef(id);
    const draft: Draft = { inst: make(def, { damage: 0 }), def };
    fillContainer(draft);
    drafts.push(draft);
  }

  // A jackpot hidden in the trash.
  if (bp.event === 'trash') {
    if (rng.chance(CONFIG.loot.trashJackpotChance)) {
      const legend = rng.pick(ITEM_LIST.filter((d) => d.jackpot));
      injectIntoContainer(rng, drafts, make(legend, { forceAuthentic: true, damage: 0 }));
    } else if (rng.chance(CONFIG.loot.trashEpicChance)) {
      const epic = rng.pick(LOOT_POOL.filter((d) => d.rarity === 'epic' && volumeOf(d) <= 0.05));
      injectIntoContainer(rng, drafts, make(epic, { damage: 0 }));
    }
  }

  // Tutorial: a guaranteed decent find so the first unit feels good.
  if (opts.tutorial) {
    drafts.push({ inst: make(itemDef('radio_tube'), { damage: 0 }), def: itemDef('radio_tube') });
    injectIntoContainer(rng, drafts, make(itemDef('camera_slr'), { damage: 0 }));
  }

  if (opts.storyItem && ITEMS[opts.storyItem]) {
    injectIntoContainer(rng, drafts, make(itemDef(opts.storyItem), { damage: 0 }));
  }

  // Physical layout.
  const placed = layoutUnit(rng, drafts, sz.w, sz.d, sz.h, bp.fill[1] > 0.85 ? 0.05 : rng.range(0.1, 0.55), fill);
  const doorOpen = rng.range(CONFIG.inspection.doorOpen[0], CONFIG.inspection.doorOpen[1]);

  const tarps: Tarp[] = [];
  if (bp.event === 'mystery') coverWithTarps(rng, placed, tarps, sz.w, sz.d);

  computeVisibility(placed, { w: sz.w, d: sz.d, h: sz.h, doorW: sz.doorW, doorOpen });

  const unit: UnitData = {
    id: unitId,
    number: opts.number,
    slot: opts.slot ?? 6,
    facilityId: opts.facility.id,
    blueprintId: bp.id,
    event: bp.event,
    size,
    dims: { w: sz.w, d: sz.d, h: sz.h },
    doorOpen,
    seed: opts.seed,
    tenant: `${rng.pick(TENANT_FIRST)} ${rng.pick(TENANT_LAST)}`,
    monthsUnpaid: rng.int(3, 14),
    items: placed,
    tarps,
    hidden: null as unknown as UnitHiddenStats,
    rumor: null,
  };
  unit.hidden = computeHiddenStats(unit, bp, boost, opts.market ?? null);
  unit.rumor = makeRumor(rng, unit);
  return unit;
}

function injectIntoContainer(rng: RNG, drafts: Draft[], inst: ItemInstance) {
  const def = itemDef(inst.defId);
  const hosts = drafts.filter((d) => d.def.container && d.def.container.kind !== 'safe' && volumeOf(def) <= d.def.container.maxItemVolume);
  if (hosts.length) {
    const host = rng.pick(hosts);
    host.contents = host.contents ?? [];
    host.contents.push(inst);
  } else {
    drafts.push({ inst, def });
  }
}

function boxLabel(rng: RNG, bp: UnitBlueprint, contents: ItemInstance[]): string {
  const roll = rng.next();
  if (roll < 0.14) return '';
  if (roll < 0.32 || contents.length === 0) return rng.pick(bp.labels);
  const counts = new Map<Category, number>();
  for (const c of contents) {
    const cat = itemDef(c.defId).category;
    counts.set(cat, (counts.get(cat) ?? 0) + (itemDef(c.defId).rarity === 'common' ? 1 : 2));
  }
  let best: Category = 'household';
  let n = -1;
  for (const [cat, v] of counts) if (v > n) { best = cat; n = v; }
  const options = LABEL_BY_CATEGORY[best];
  return options ? rng.pick(options) : rng.pick(bp.labels);
}

// ─── Layout ─────────────────────────────────────────────────────────────────

const CELL = 0.1;
const GAP = 0.012;

class FloorGrid {
  readonly nx: number;
  readonly nz: number;
  readonly top: Float32Array;
  readonly owner: Int16Array;

  constructor(readonly w: number, readonly d: number) {
    this.nx = Math.round(w / CELL);
    this.nz = Math.round(d / CELL);
    this.top = new Float32Array(this.nx * this.nz);
    this.owner = new Int16Array(this.nx * this.nz).fill(-1);
  }

  /** Cell span for a footprint whose min corner is at cell (ix, iz). */
  span(dx: number, dz: number): [number, number] {
    return [Math.max(1, Math.ceil((dx + GAP) / CELL - 1e-6)), Math.max(1, Math.ceil((dz + GAP) / CELL - 1e-6))];
  }

  probe(ix: number, iz: number, cx: number, cz: number): { min: number; max: number; owners: Set<number> } | null {
    if (ix < 0 || iz < 0 || ix + cx > this.nx || iz + cz > this.nz) return null;
    let min = Infinity;
    let max = -Infinity;
    const owners = new Set<number>();
    for (let z = iz; z < iz + cz; z++) {
      for (let x = ix; x < ix + cx; x++) {
        const i = z * this.nx + x;
        const h = this.top[i];
        if (h < min) min = h;
        if (h > max) max = h;
        owners.add(this.owner[i]);
      }
    }
    return { min, max, owners };
  }

  fill(ix: number, iz: number, cx: number, cz: number, height: number, owner: number) {
    for (let z = iz; z < iz + cz; z++) {
      for (let x = ix; x < ix + cx; x++) {
        const i = z * this.nx + x;
        this.top[i] = height;
        this.owner[i] = owner;
      }
    }
  }
}

interface Candidate {
  ix: number;
  iz: number;
  rot: 0 | 1;
  base: number;
  score: number;
}

export function layoutUnit(rng: RNG, drafts: Draft[], W: number, D: number, H: number, frontGap: number, fill = 0.6): PlacedItem[] {
  const grid = new FloorGrid(W, D);
  const placed: PlacedItem[] = [];
  const supports: boolean[] = [];
  const maxTop = H - 0.18;
  const gapCells = Math.floor(frontGap / CELL);

  // Order: leaners → big furniture → box stacks → medium → small.
  const volume = (d: Draft) => volumeOf(d.def);
  const isBox = (d: Draft) => d.def.category === 'container' && (d.def.container?.kind === 'box' || d.def.container?.kind === 'tote');
  const leaners = drafts.filter((d) => d.def.leans);
  const boxes = drafts.filter((d) => !d.def.leans && isBox(d));
  const rest = drafts.filter((d) => !d.def.leans && !isBox(d)).sort((a, b) => volume(b) - volume(a));
  const big = rest.filter((d) => volume(d) > 0.12 || d.def.dims[1] > 0.85);
  const small = rest.filter((d) => !big.includes(d));

  const commit = (d: Draft, c: Candidate) => {
    const [w, h, dd] = d.def.dims;
    const dx = c.rot ? dd : w;
    const dz = c.rot ? w : dd;
    const [cx, cz] = grid.span(dx, dz);
    const x0 = -W / 2 + c.ix * CELL;
    const z0 = c.iz * CELL;
    const px = x0 + (cx * CELL) / 2;
    const pz = z0 + (cz * CELL) / 2;
    const probe = grid.probe(c.ix, c.iz, cx, cz)!;
    const onTop = [...probe.owners].find((o) => o >= 0);
    const idx = placed.length;
    const baseRot = c.rot ? Math.PI / 2 : 0;
    const flip = !d.def.leans && !isBox(d) && rng.chance(0.15) ? Math.PI : 0;
    placed.push({
      inst: d.inst,
      pos: [round3(px), round3(c.base + h / 2 + (c.base > 0 ? 0.002 : 0)), round3(pz)],
      rotY: round3(baseRot + flip + (d.def.leans ? 0 : rng.range(-0.06, 0.06))),
      dims: [round3(dx), h, round3(dz)],
      label: d.label,
      contents: d.contents,
      visibility: 0,
      onTopOf: onTop !== undefined ? placed[onTop].inst.uid : undefined,
    });
    supports.push(!!d.def.supportsStack);
    grid.fill(c.ix, c.iz, cx, cz, c.base + h + 0.004, idx);
  };

  const findSpot = (
    d: Draft,
    mode: 'floor' | 'any' | 'top' | 'wall',
    prefer: (c: Candidate, cx: number, cz: number) => number,
    tries = 90,
  ): Candidate | null => {
    const [w, h, dd] = d.def.dims;
    let best: Candidate | null = null;
    for (let t = 0; t < tries; t++) {
      const rot: 0 | 1 = mode === 'wall' ? (rng.chance(0.5) ? 1 : 0) : w > W - 0.1 ? 1 : rng.chance(0.3) ? 1 : 0;
      const dx = rot ? dd : w;
      const dz = rot ? w : dd;
      const [cx, cz] = grid.span(dx, dz);
      if (cx > grid.nx || cz > grid.nz) continue;
      let ix: number;
      let iz: number;
      if (mode === 'wall') {
        // Thin side against a wall.
        if (rot === 0) { ix = rng.int(0, grid.nx - cx); iz = grid.nz - cz; }
        else { ix = rng.chance(0.5) ? 0 : grid.nx - cx; iz = rng.int(Math.max(gapCells, 0), grid.nz - cz); }
      } else {
        ix = rng.int(0, grid.nx - cx);
        iz = rng.int(Math.min(gapCells, Math.max(0, grid.nz - cz)), grid.nz - cz);
      }
      const probe = grid.probe(ix, iz, cx, cz);
      if (!probe) continue;
      if (probe.max - probe.min > 0.015) continue;
      const base = probe.max;
      const onFloor = base < 0.001;
      if ((mode === 'floor' || mode === 'wall') && !onFloor) continue;
      if (mode === 'top' && onFloor) continue;
      if (!onFloor) {
        let ok = true;
        for (const o of probe.owners) if (o < 0 || !supports[o]) ok = false;
        if (!ok) continue;
      }
      if (base + h > maxTop) continue;
      const c: Candidate = { ix, iz, rot, base, score: 0 };
      c.score = prefer(c, cx, cz) + rng.next() * 0.35;
      if (!best || c.score > best.score) best = c;
    }
    return best;
  };

  for (const d of leaners) {
    const c = findSpot(d, 'wall', (c) => c.iz / grid.nz);
    if (c) commit(d, c);
    else {
      const f = findSpot(d, 'floor', (c) => c.iz / grid.nz);
      if (f) commit(d, f);
    }
  }

  for (const d of big) {
    const c = findSpot(d, 'floor', (c, cx, cz) => {
      const back = (c.iz + cz / 2) / grid.nz;
      const wall = c.ix === 0 || c.ix + cx === grid.nx ? 0.25 : 0;
      return back * 1.2 + wall;
    });
    if (c) commit(d, c);
    else {
      const s = findSpot(d, 'top', (c) => -c.base);
      if (s) commit(d, s);
    }
  }

  // Box stacks: sort largest first so stacks taper upwards.
  const boxQueue = [...boxes].sort((a, b) => volume(b) - volume(a));
  while (boxQueue.length) {
    const baseBox = boxQueue.shift()!;
    const c = findSpot(baseBox, 'floor', (c, _cx, cz) => ((c.iz + cz / 2) / grid.nz) * 0.8) ?? findSpot(baseBox, 'top', (c) => -c.base * 0.5);
    if (!c) continue;
    commit(baseBox, c);
    let topIdx = placed.length - 1;
    const maxStack = fill > 0.8 ? 5 : fill > 0.6 ? 4 : 3;
    const height = rng.int(Math.ceil(maxStack / 2), maxStack);
    for (let level = 1; level < height && boxQueue.length; level++) {
      const below = placed[topIdx];
      const nextI = boxQueue.findIndex((b) => b.def.dims[0] <= below.dims[0] + 0.001 && b.def.dims[2] <= below.dims[2] + 0.001);
      if (nextI < 0) break;
      const nb = boxQueue[nextI];
      const [bw, bh] = [nb.def.dims[0], nb.def.dims[1]];
      if (below.pos[1] + below.dims[1] / 2 + bh > maxTop) break;
      // Place centred on the box below.
      const [cx, cz] = grid.span(bw, nb.def.dims[2]);
      const [bcx, bcz] = grid.span(below.dims[0], below.dims[2]);
      const bix = Math.round((below.pos[0] - below.dims[0] / 2 + W / 2) / CELL);
      const biz = Math.round((below.pos[2] - below.dims[2] / 2) / CELL);
      const ix = bix + Math.floor((bcx - cx) / 2);
      const iz = biz + Math.floor((bcz - cz) / 2);
      const probe = grid.probe(ix, iz, cx, cz);
      if (!probe || probe.max - probe.min > 0.015 || [...probe.owners].some((o) => o < 0 || !supports[o])) break;
      boxQueue.splice(nextI, 1);
      commit(nb, { ix, iz, rot: 0, base: probe.max, score: 0 });
      topIdx = placed.length - 1;
    }
  }

  for (const d of small) {
    const preferTop = volume(d) < 0.03 && rng.chance(0.55);
    const c = findSpot(d, preferTop ? 'top' : 'any', (c) => (preferTop ? c.base : 0) + (c.iz / grid.nz) * 0.3) ??
      findSpot(d, 'any', () => 0, 140);
    if (c) commit(d, c);
  }
  return placed;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function coverWithTarps(rng: RNG, placed: PlacedItem[], tarps: Tarp[], W: number, D: number) {
  const n = rng.int(1, W >= 3 ? 3 : 2);
  const colors = ['#3f5f8a', '#6b6f3a', '#8a4b3f', '#5a5f66'];
  for (let t = 0; t < n; t++) {
    const tw = Math.min(W - 0.1, rng.range(1.0, 2.2));
    const td = Math.min(D - 0.3, rng.range(1.0, 2.4));
    const cx = rng.range(-W / 2 + tw / 2, W / 2 - tw / 2);
    const cz = rng.range(Math.min(D - td / 2, td / 2 + 0.4), D - td / 2);
    let height = 0.3;
    const idx = tarps.length;
    for (const p of placed) {
      if (Math.abs(p.pos[0] - cx) < tw / 2 && Math.abs(p.pos[2] - cz) < td / 2 && p.tarp === undefined) {
        p.tarp = idx;
        height = Math.max(height, p.pos[1] + p.dims[1] / 2);
      }
    }
    tarps.push({ center: [cx, 0, cz], size: [tw, td], height: height + 0.04, color: rng.pick(colors) });
  }
}

// ─── Visibility ─────────────────────────────────────────────────────────────

export interface ViewGeometry {
  w: number;
  d: number;
  h: number;
  doorW: number;
  doorOpen: number;
}

/**
 * Voxelise the unit and cast rays from standing and crouching eye points
 * outside the door to sample points on each item's front and top faces.
 */
export function computeVisibility(placed: PlacedItem[], g: ViewGeometry): void {
  const vc = 0.1;
  const nx = Math.ceil(g.w / vc);
  const ny = Math.ceil(g.h / vc);
  const nz = Math.ceil(g.d / vc);
  const vox = new Int16Array(nx * ny * nz);
  const vi = (x: number, y: number, z: number) => (z * ny + y) * nx + x;

  placed.forEach((p, idx) => {
    const sparse = itemDef(p.inst.defId).sparse;
    const x0 = Math.max(0, Math.floor((p.pos[0] - p.dims[0] / 2 + g.w / 2) / vc + 0.15));
    const x1 = Math.min(nx - 1, Math.ceil((p.pos[0] + p.dims[0] / 2 + g.w / 2) / vc - 0.15) - 1);
    const y0 = Math.max(0, Math.floor((p.pos[1] - p.dims[1] / 2) / vc + 0.15));
    const y1 = Math.min(ny - 1, Math.ceil((p.pos[1] + p.dims[1] / 2) / vc - 0.15) - 1);
    const z0 = Math.max(0, Math.floor((p.pos[2] - p.dims[2] / 2) / vc + 0.15));
    const z1 = Math.min(nz - 1, Math.ceil((p.pos[2] + p.dims[2] / 2) / vc - 0.15) - 1);
    for (let z = z0; z <= z1; z++) {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (sparse && (x + y + z) % 2 === 0) continue;
          vox[vi(x, y, z)] = idx + 1;
        }
      }
    }
  });

  const doorTop = g.h * g.doorOpen;
  // Bidders crowd the doorway: a little lean left/right and a crouch is all they get.
  const lean = Math.min(0.45, g.doorW / 2 - 0.2);
  const eyes: Vec3[] = [
    [-lean, 1.62, -0.7],
    [0, 1.62, -0.7],
    [lean, 1.62, -0.7],
    [0, 1.05, -0.45],
  ];

  placed.forEach((p, idx) => {
    if (p.tarp !== undefined) { p.visibility = 0; return; }
    const samples: Vec3[] = [];
    const [px, py, pz] = p.pos;
    const [dx, dy, dz] = p.dims;
    for (const fx of [-0.35, 0, 0.35]) {
      for (const fy of [-0.35, 0, 0.35]) samples.push([px + fx * dx, py + fy * dy, Math.max(0.01, pz - dz / 2 - 0.02)]);
      for (const fz of [-0.35, 0, 0.35]) samples.push([px + fx * dx, py + dy / 2 + 0.02, pz + fz * dz]);
    }
    let seen = 0;
    for (const s of samples) {
      if (s[1] > g.h - 0.05) continue;
      for (const e of eyes) {
        if (rayClear(e, s, idx + 1)) { seen++; break; }
      }
    }
    p.visibility = Math.round((seen / samples.length) * 100) / 100;
  });

  function rayClear(from: Vec3, to: Vec3, self: number): boolean {
    const dxr = to[0] - from[0];
    const dyr = to[1] - from[1];
    const dzr = to[2] - from[2];
    const len = Math.hypot(dxr, dyr, dzr);
    const steps = Math.ceil(len / 0.04);
    // Door plane crossing.
    if (from[2] < 0 && to[2] > 0) {
      const t = -from[2] / dzr;
      const cx = from[0] + dxr * t;
      const cy = from[1] + dyr * t;
      if (Math.abs(cx) > g.doorW / 2 || cy > doorTop) return false;
    }
    for (let i = 1; i < steps - 1; i++) {
      const t = i / steps;
      const x = from[0] + dxr * t;
      const y = from[1] + dyr * t;
      const z = from[2] + dzr * t;
      if (z < 0) continue;
      const ix = Math.floor((x + g.w / 2) / vc);
      const iy = Math.floor(y / vc);
      const iz = Math.floor(z / vc);
      if (ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz) continue;
      const v = vox[vi(ix, iy, iz)];
      if (v !== 0 && v !== self) return false;
    }
    return true;
  }
}

// ─── Hidden stats & rumors ──────────────────────────────────────────────────

export function allUnitItems(unit: UnitData): ItemInstance[] {
  const out: ItemInstance[] = [];
  for (const p of unit.items) {
    out.push(p.inst);
    if (p.inst.secret) out.push(...p.inst.secret);
    if (p.inst.lockedContents) out.push(...p.inst.lockedContents);
    for (const c of p.contents ?? []) {
      out.push(c);
      if (c.secret) out.push(...c.secret);
      if (c.lockedContents) out.push(...c.lockedContents);
    }
  }
  return out;
}

export function computeHiddenStats(
  unit: UnitData, bp: UnitBlueprint, boost: number, market: Pick<MarketState, 'trends' | 'events'> | null,
): UnitHiddenStats {
  const all = allUnitItems(unit);
  let hiddenValue = 0;
  let best: ItemInstance | null = null;
  let bestV = -1;
  for (const inst of all) {
    const v = marketValue(inst, market);
    hiddenValue += v;
    if (v > bestV) { bestV = v; best = inst; }
  }
  let visibleValue = 0;
  for (const p of unit.items) if (p.visibility >= CONFIG.inspection.visibleThreshold) visibleValue += apparentValue(p.inst, market);
  const trash = unit.items.filter((p) => itemDef(p.inst.defId).category === 'trash').length;
  const counted = all.filter((i) => itemDef(i.defId).category !== 'container' || itemDef(i.defId).baseValue > 5);
  const w = CONFIG.loot.rarityWeights;
  const total = w.common + w.uncommon + w.rare + w.epic + w.legendary;
  const rareChance = ((w.rare * boost + w.epic * boost + w.legendary * boost * boost) / total);
  const risk = bp.event === 'mystery' || bp.event === 'trash' || bp.id === 'hoarder' ? 'high'
    : bp.event === 'estate' || bp.event === 'flood' || unit.size === '10x20' ? 'medium' : 'low';
  return {
    hiddenValue: Math.round(hiddenValue),
    visibleValue: Math.round(visibleValue),
    itemCount: counted.length,
    rareChance: Math.round(rareChance * 1000) / 10,
    damageChance: Math.round(bp.damageChance * 100),
    trashRatio: unit.items.length ? Math.round((trash / unit.items.length) * 100) : 0,
    secretChance: Math.round(bp.secretChance * 3 * 10) / 10,
    risk,
    bestItem: best ? best.defId : null,
  };
}

function makeRumor(rng: RNG, unit: UnitData): string | null {
  if (!rng.chance(0.3)) return null;
  const best = unit.hidden.bestItem ? itemDef(unit.hidden.bestItem) : null;
  const truthful = rng.chance(0.72);
  const cats: Category[] = ['jewelry', 'music', 'electronics', 'collectibles', 'art', 'tools', 'furniture', 'sports'];
  const cat = truthful && best && best.category !== 'trash' ? best.category : rng.pick(cats);
  const lines: Partial<Record<Category, string>> = {
    jewelry: 'The office says the tenant used to work at a jewelry store.',
    music: 'Word is the tenant played in a band back in the day.',
    electronics: 'A neighbour says the tenant was a gadget nut.',
    collectibles: 'Rumor has it the tenant collected something.',
    art: 'Somebody saw the tenant carrying framed pictures in here.',
    tools: 'The tenant was a mechanic, apparently.',
    furniture: 'The manager remembers an antique dealer renting this one.',
    sports: 'The tenant coached Little League, they say.',
    media: 'The tenant ran a used-record stall on weekends.',
    household: 'The tenant moved out of a big family house.',
    fashion: 'The tenant ran a vintage clothing stall.',
    toys: 'The tenant ran a toy stall at the flea market.',
    documents: 'The tenant was an accountant. Lots of paper, probably.',
  };
  return lines[cat] ?? null;
}

export { ITEMS };
