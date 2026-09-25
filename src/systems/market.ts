import { CONFIG, RARITY_ORDER } from '../core/config';
import { RNG, clamp } from '../core/rng';
import type {
  BuyerOffer, BuyerPersonality, Category, CollectorRequest, Condition, ItemInstance, MarketState, SaleChannel, TrendTag,
} from '../core/types';
import { itemDef } from '../data/items';
import { BUYER_NAMES, BUYER_TYPES, COLLECTORS } from '../data/people';
import { TREND_BOOMS, TREND_NAMES, TREND_SLUMPS, TREND_TAGS } from '../data/progression';
import type { Game } from './game';
import { displayName, marketValue, publicValue, roundNice, tagMult } from './items';
import type { Negotiation } from './negotiation';
import { startNegotiation } from './negotiation';

const CATEGORY_DEMAND: Record<Category, number> = {
  furniture: 0.55, electronics: 0.8, tools: 0.85, collectibles: 0.7, jewelry: 0.75, art: 0.5, music: 0.75, sports: 0.7,
  household: 0.65, fashion: 0.75, media: 0.6, toys: 0.65, documents: 0.9, container: 0.4, trash: 0.1,
};

export interface SaleResult {
  ok: boolean;
  price: number;
  fee: number;
  profit: number;
  reason?: string;
}

export interface MarketDayReport {
  sold: { uid: string; name: string; price: number; channel: SaleChannel }[];
  unsold: { uid: string; name: string }[];
  news: string[];
}

/** Sale channels, dynamic trends, listings, consignments, collector requests and buyer offers. */
export class MarketSystem {
  constructor(private readonly game: Game) {}

  static initialState(rng: RNG): MarketState {
    const trends = {} as Record<TrendTag, number>;
    const history = {} as Record<TrendTag, number[]>;
    for (const tag of TREND_TAGS) {
      trends[tag] = Math.round(clamp(1 + rng.gauss(0, 0.08), 0.8, 1.25) * 1000) / 1000;
      history[tag] = [trends[tag]];
    }
    return { trends, history, events: [], listings: [], consignments: [], requests: [], offers: [] };
  }

  private get m(): MarketState {
    return this.game.state.market;
  }

  trend(tag: TrendTag): number {
    return tagMult(tag, this.m);
  }

  hottestTag(inst: ItemInstance): number {
    const def = itemDef(inst.defId);
    return def.tags.reduce((mx, t) => Math.max(mx, this.trend(t)), 0);
  }

  // ── Quotes ────────────────────────────────────────────────────────────────

  /** Gus checks everything himself and pays a cut of the real value. */
  pawnOffer(inst: ItemInstance): number {
    const def = itemDef(inst.defId);
    if (def.category === 'trash') return 0;
    const rates = CONFIG.market.pawnRate;
    const rate = rates[def.category] ?? rates.base;
    const v = marketValue(inst, this.m) * rate;
    return v < 3 ? 0 : roundNice(v);
  }

  suggestedPrice(inst: ItemInstance): number {
    return roundNice(publicValue(inst, this.m) * 1.05);
  }

  onlineDailyChance(inst: ItemInstance, price: number): number {
    const def = itemDef(inst.defId);
    const value = Math.max(1, publicValue(inst, this.m));
    const r = price / value;
    const demand = def.demand ?? CATEGORY_DEMAND[def.category];
    let p = clamp(0.9 * Math.exp(-3.2 * (r - 0.7)), 0.01, 0.85) * demand;
    if (this.game.state.garage.upgrades.includes('computer')) p *= 1.3;
    if (def.weight > 25) p *= 0.7;
    return clamp(p, 0.005, 0.9);
  }

  expectedDays(inst: ItemInstance, price: number): number {
    return Math.max(1, Math.round(1 / this.onlineDailyChance(inst, price)));
  }

  auctionEstimate(inst: ItemInstance): [number, number] {
    const v = this.auctionBase(inst);
    return [roundNice(v * 0.7), roundNice(v * 1.5)];
  }

  private auctionBase(inst: ItemInstance): number {
    const def = itemDef(inst.defId);
    // The auction house authenticates anything that could be fake.
    return def.fakeChance ? marketValue(inst, this.m) : publicValue(inst, this.m);
  }

  auctionHouseEligible(inst: ItemInstance): { ok: boolean; reason?: string } {
    if (this.game.level() < 2) return { ok: false, reason: 'Unlocks at level 2.' };
    if (publicValue(inst, this.m) < CONFIG.market.auctionHouseMin && inst.knowledge.idLevel >= 2) {
      return { ok: false, reason: 'Hollister & Crane only take items worth $150 or more.' };
    }
    return { ok: true };
  }

  // ── Selling ───────────────────────────────────────────────────────────────

  private owned(uid: string): ItemInstance | null {
    const it = this.game.state.items[uid];
    if (!it || !['garage', 'display', 'listed', 'van'].includes(it.location)) return null;
    return it;
  }

  recordSale(inst: ItemInstance, price: number, channel: SaleChannel, fee = 0): SaleResult {
    const st = this.game.state;
    price = Math.round(price);
    fee = Math.round(fee);
    this.game.economy.earn(price, 'sale', { unitId: inst.unitId, itemUid: inst.uid, note: channel });
    if (fee > 0) this.game.economy.spend(fee, 'fee', { unitId: inst.unitId, itemUid: inst.uid, note: channel }, true);
    this.removeFromMarket(inst.uid);
    const slot = st.garage.display.indexOf(inst.uid);
    if (slot >= 0) st.garage.display[slot] = null;
    inst.location = 'sold';
    inst.soldFor = price - fee;
    inst.soldDay = st.day;
    inst.soldChannel = channel;
    const profit = price - fee - inst.costBasis;
    const s = st.stats;
    s.itemsSold++;
    if (!s.highestSale || price > s.highestSale.value) s.highestSale = { name: itemDef(inst.defId).name, value: price };
    this.game.bus.emit('item:sold', { item: inst, price: price - fee, channel, profit });
    if (this.hottestTag(inst) >= 1.4) this.game.progression.unlock('trendsetter');
    return { ok: true, price, fee, profit };
  }

  private removeFromMarket(uid: string) {
    this.m.listings = this.m.listings.filter((l) => l.itemUid !== uid);
    this.m.offers = this.m.offers.filter((o) => o.itemUid !== uid);
    this.m.consignments = this.m.consignments.filter((c) => c.itemUid !== uid);
  }

  sellPawn(uid: string, price?: number): SaleResult {
    const inst = this.owned(uid);
    if (!inst) return { ok: false, price: 0, fee: 0, profit: 0, reason: 'Item not available.' };
    const offer = price ?? this.pawnOffer(inst);
    if (offer <= 0) return { ok: false, price: 0, fee: 0, profit: 0, reason: 'Gus does not buy junk.' };
    return this.recordSale(inst, offer, 'pawn');
  }

  pawnNegotiation(uid: string, rng: RNG): Negotiation | null {
    const inst = this.owned(uid);
    if (!inst) return null;
    const offer = this.pawnOffer(inst);
    if (offer <= 0) return null;
    const bo: BuyerOffer = {
      id: `pawn-${uid}`, itemUid: uid, buyer: 'Gus Petrakis', personality: 'hardball', offer,
      maxPay: roundNice(offer * rng.range(1.08, 1.25)), patience: 2, expires: this.game.state.day,
    };
    return startNegotiation(bo, rng);
  }

  listOnline(uid: string, price: number): boolean {
    const inst = this.owned(uid);
    if (!inst || price <= 0) return false;
    if (!this.game.economy.spend(CONFIG.market.onlineListingFee, 'fee', { unitId: inst.unitId, itemUid: uid, note: 'listing' })) return false;
    this.m.listings = this.m.listings.filter((l) => l.itemUid !== uid);
    this.m.listings.push({ itemUid: uid, price: Math.round(price), listedDay: this.game.state.day, views: 0, watchers: 0 });
    const slot = this.game.state.garage.display.indexOf(uid);
    if (slot >= 0) this.game.state.garage.display[slot] = null;
    inst.location = 'listed';
    return true;
  }

  delist(uid: string): void {
    const inst = this.game.state.items[uid];
    this.m.listings = this.m.listings.filter((l) => l.itemUid !== uid);
    if (inst && inst.location === 'listed') inst.location = 'garage';
  }

  consign(uid: string, reserve: number): { ok: boolean; reason?: string; authFee?: number } {
    const inst = this.owned(uid);
    if (!inst) return { ok: false, reason: 'Item not available.' };
    const el = this.auctionHouseEligible(inst);
    if (!el.ok) return { ok: false, reason: el.reason };
    const def = itemDef(inst.defId);
    let authFee = 0;
    if (def.fakeChance && !inst.knowledge.authKnown) {
      authFee = CONFIG.market.auctionHouseAuthFee;
      if (!this.game.economy.spend(authFee, 'fee', { unitId: inst.unitId, itemUid: uid, note: 'authentication' })) {
        return { ok: false, reason: 'Not enough money for the authentication fee.' };
      }
      inst.knowledge.authKnown = true;
      inst.knowledge.clues.push({ k: 'Hollister & Crane authenticated it: {verdict}', p: { verdict: inst.authentic ? 'genuine' : 'FAKE' }, tone: inst.authentic ? 1 : -1 });
      if (!inst.authentic) {
        this.game.state.stats.fakesFound++;
        this.game.bus.emit('item:fake', { item: inst });
        return { ok: false, reason: 'The auction house says it is a fake and refuses it.', authFee };
      }
    }
    this.delist(uid);
    const slot = this.game.state.garage.display.indexOf(uid);
    if (slot >= 0) this.game.state.garage.display[slot] = null;
    this.m.consignments.push({ itemUid: uid, consignedDay: this.game.state.day, saleDay: this.game.state.day + CONFIG.market.auctionHouseDays, reserve: Math.round(reserve) });
    inst.location = 'consigned';
    return { ok: true, authFee };
  }

  requestMatches(req: CollectorRequest, inst: ItemInstance): { ok: boolean; reason?: string } {
    const def = itemDef(inst.defId);
    if (req.tag && !def.tags.includes(req.tag)) return { ok: false, reason: 'Wrong kind of item.' };
    if (req.category && def.category !== req.category) return { ok: false, reason: 'Wrong kind of item.' };
    if (inst.knowledge.idLevel < 2) return { ok: false, reason: 'Identify it first.' };
    if (!inst.knowledge.conditionKnown) return { ok: false, reason: 'Check its condition first.' };
    if (RARITY_ORDER[def.rarity] < RARITY_ORDER[req.minRarity]) return { ok: false, reason: 'Not rare enough.' };
    if (inst.condition < req.minCondition) return { ok: false, reason: 'Condition too poor.' };
    if (def.fakeChance && !inst.knowledge.authKnown) return { ok: false, reason: 'They want it authenticated first.' };
    if (!inst.authentic) return { ok: false, reason: 'It is a fake.' };
    return { ok: true };
  }

  requestPayout(req: CollectorRequest, inst: ItemInstance): number {
    const def = itemDef(inst.defId);
    return roundNice(publicValue(inst, this.m) * req.premium * (def.collectorValue ?? 1));
  }

  fulfillRequest(reqId: string, uid: string): SaleResult {
    const req = this.m.requests.find((r) => r.id === reqId);
    const inst = this.owned(uid);
    if (!req || !inst) return { ok: false, price: 0, fee: 0, profit: 0, reason: 'Not available.' };
    const match = this.requestMatches(req, inst);
    if (!match.ok) return { ok: false, price: 0, fee: 0, profit: 0, reason: match.reason };
    const price = this.requestPayout(req, inst);
    this.m.requests = this.m.requests.filter((r) => r.id !== reqId);
    return this.recordSale(inst, price, 'collector');
  }

  offerNegotiation(offerId: string, rng: RNG): Negotiation | null {
    const offer = this.m.offers.find((o) => o.id === offerId);
    if (!offer || !this.owned(offer.itemUid)) return null;
    return startNegotiation(offer, rng);
  }

  /** Settle a finished negotiation. */
  closeNegotiation(n: Negotiation, channel: SaleChannel): SaleResult | null {
    this.m.offers = this.m.offers.filter((o) => o.id !== n.offer.id);
    if (n.outcome !== 'accepted') return null;
    const inst = this.owned(n.offer.itemUid);
    if (!inst) return null;
    const gain = n.price / Math.max(1, n.start) - 1;
    if (gain > 0.001) {
      this.game.state.stats.negotiationsWon++;
      this.game.state.stats.bestNegotiation = Math.max(this.game.state.stats.bestNegotiation, gain);
      this.game.bus.emit('negotiation:won', { gain });
    }
    return this.recordSale(inst, n.price, channel);
  }

  // ── Daily simulation ──────────────────────────────────────────────────────

  advanceDay(rng: RNG): MarketDayReport {
    const st = this.game.state;
    const report: MarketDayReport = { sold: [], unsold: [], news: [] };
    const cfg = CONFIG.market;

    // Trends drift and mean-revert.
    for (const tag of TREND_TAGS) {
      let v = this.m.trends[tag];
      v += cfg.trendMeanReversion * (1 - v) + rng.gauss(0, cfg.trendNoise);
      v = clamp(v, cfg.trendMin, cfg.trendMax);
      this.m.trends[tag] = Math.round(v * 1000) / 1000;
      const h = this.m.history[tag] ?? (this.m.history[tag] = []);
      h.push(Math.round(this.trend(tag) * 1000) / 1000);
      if (h.length > cfg.historyDays) h.splice(0, h.length - cfg.historyDays);
    }
    this.m.events = this.m.events.filter((e) => e.until >= st.day);
    if (rng.chance(cfg.eventChance)) {
      const tag = rng.pick(TREND_TAGS.filter((t) => !this.m.events.some((e) => e.tag === t)));
      const boom = rng.chance(0.62);
      const mult = boom ? rng.range(1.3, 1.85) : rng.range(0.6, 0.8);
      const headline = boom ? TREND_BOOMS[tag] : TREND_SLUMPS[tag];
      this.m.events.push({ tag, mult: Math.round(mult * 100) / 100, until: st.day + rng.int(3, 7), headline });
      report.news.push(headline);
      this.game.news(headline, undefined, 'market');
      // Re-stamp today's history point with the event applied.
      const h = this.m.history[tag];
      h[h.length - 1] = Math.round(this.trend(tag) * 1000) / 1000;
    }

    // SwapBay listings.
    for (const l of [...this.m.listings]) {
      const inst = st.items[l.itemUid];
      if (!inst || inst.location !== 'listed') { this.m.listings = this.m.listings.filter((x) => x !== l); continue; }
      l.views += Math.round(rng.range(4, 30) * (st.garage.upgrades.includes('computer') ? 1.3 : 1));
      if (rng.chance(0.3)) l.watchers++;
      if (rng.chance(this.onlineDailyChance(inst, l.price))) {
        const fee = l.price * cfg.onlineFee;
        this.recordSale(inst, l.price, 'online', fee);
        report.sold.push({ uid: inst.uid, name: displayName(inst), price: l.price - Math.round(fee), channel: 'online' });
        this.game.news('SwapBay: your {item} sold for {price}.', { item: displayName(inst), price: l.price }, 'sale');
      }
    }

    // Hollister & Crane sale day.
    for (const c of [...this.m.consignments]) {
      if (c.saleDay > st.day) continue;
      const inst = st.items[c.itemUid];
      this.m.consignments = this.m.consignments.filter((x) => x !== c);
      if (!inst) continue;
      const def = itemDef(inst.defId);
      const rareish = RARITY_ORDER[def.rarity] >= 2;
      const sigma = rareish ? 0.42 : RARITY_ORDER[def.rarity] === 1 ? 0.33 : 0.26;
      const result = roundNice(this.auctionBase(inst) * rng.lognorm(sigma, rareish ? 0.06 : -0.03));
      if (result >= c.reserve && result > 0) {
        const fee = result * cfg.auctionHouseFee;
        this.recordSale(inst, result, 'auction_house', fee);
        report.sold.push({ uid: inst.uid, name: displayName(inst), price: result - Math.round(fee), channel: 'auction_house' });
        this.game.news('Hollister & Crane: your {item} hammered for {price}!', { item: displayName(inst), price: result }, 'sale');
      } else {
        inst.location = 'garage';
        this.game.economy.spend(cfg.unsoldFee, 'fee', { unitId: inst.unitId, itemUid: inst.uid, note: 'unsold' }, true);
        report.unsold.push({ uid: inst.uid, name: displayName(inst) });
        this.game.news('Hollister & Crane: your {item} did not meet its reserve ({price} top bid).', { item: displayName(inst), price: result }, 'warning');
      }
    }

    // Private buyer offers.
    this.m.offers = this.m.offers.filter((o) => o.expires >= st.day && st.items[o.itemUid] && ['garage', 'display', 'listed'].includes(st.items[o.itemUid].location));
    const candidates = Object.values(st.items).filter((i) =>
      ['garage', 'display', 'listed'].includes(i.location) && publicValue(i, this.m) >= 40 && !this.m.offers.some((o) => o.itemUid === i.uid));
    const n = rng.int(cfg.offersPerDay[0], cfg.offersPerDay[1]) + (this.game.level() >= 3 ? 1 : 0);
    for (let i = 0; i < n && candidates.length; i++) {
      const inst = rng.weighted(candidates.map((c) => [c, Math.sqrt(publicValue(c, this.m))] as [ItemInstance, number]));
      candidates.splice(candidates.indexOf(inst), 1);
      const offer = this.makeOffer(inst, rng);
      this.m.offers.push(offer);
      this.game.news('{buyer} wants to buy your {item}.', { buyer: offer.buyer, item: displayName(inst) }, 'sale');
    }

    // Collector requests board.
    this.m.requests = this.m.requests.filter((r) => r.expires >= st.day);
    if (this.game.level() >= 3) {
      while (this.m.requests.length < cfg.requestsActive) this.m.requests.push(this.makeRequest(rng));
    }
    return report;
  }

  makeOffer(inst: ItemInstance, rng: RNG): BuyerOffer {
    const st = this.game.state;
    const personality = rng.weighted<BuyerPersonality>([
      ['lowballer', 3], ['fair', 3], ['enthusiast', this.hottestTag(inst) > 1.2 ? 3 : 1.2], ['impatient', 1.5], ['hardball', 2],
    ]);
    const type = BUYER_TYPES[personality];
    const v = publicValue(inst, this.m);
    const maxPay = roundNice(v * rng.range(type.max[0], type.max[1]));
    const offer = Math.min(maxPay, roundNice(v * rng.range(type.opening[0], type.opening[1])));
    return {
      id: `offer-${st.day}-${inst.uid}-${rng.int(0, 9999)}`,
      itemUid: inst.uid,
      buyer: rng.pick(BUYER_NAMES),
      personality,
      offer: Math.max(5, offer),
      maxPay: Math.max(offer, maxPay),
      patience: rng.int(type.patience[0], type.patience[1]),
      expires: st.day + 2,
    };
  }

  makeRequest(rng: RNG): CollectorRequest {
    const st = this.game.state;
    const taken = new Set(this.m.requests.map((r) => r.collector));
    const pool = COLLECTORS.filter((c) => !taken.has(c.name));
    const col = rng.pick(pool.length ? pool : COLLECTORS);
    return {
      id: `req-${st.day}-${rng.int(0, 99999)}`,
      collector: col.name,
      tag: col.tag,
      category: null,
      family: null,
      minRarity: rng.chance(0.3) ? 'rare' : 'uncommon',
      minCondition: (rng.chance(0.4) ? 4 : 3) as Condition,
      premium: Math.round(rng.range(1.25, 1.6) * 100) / 100,
      expires: st.day + rng.int(6, 10),
    };
  }

  trendName(tag: TrendTag): string {
    return TREND_NAMES[tag];
  }
}
