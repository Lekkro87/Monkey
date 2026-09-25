import type { Condition, Rarity, UnitSizeId } from './types';

/**
 * Central balancing sheet. Every tunable number of the simulation lives here
 * so balancing never requires touching system code.
 */
export const CONFIG = {
  saveVersion: 1,
  startMoney: 2000,

  day: {
    lotsPerDay: [3, 4] as [number, number],
    travelCost: 20,
    weekLength: 7,
    weeklyBills: 150,
    dayJobPay: 140,
  },

  inspection: {
    seconds: 30,
    doorOpen: [0.72, 0.86] as [number, number],
    visibleThreshold: 0.15,
    recognizeThreshold: 0.4,
  },

  auction: {
    /** Seconds after the last bid at which the auctioneer escalates. */
    calls: { once: 2.6, twice: 4.6, final: 6.4, sold: 8.0 },
    openingWait: 3.2,
    openingDrop: 0.7,
    minOpening: 25,
    increments: [
      [0, 10], [100, 25], [500, 50], [1000, 100], [3000, 250], [10000, 500], [30000, 1000], [100000, 5000],
    ] as [number, number][],
    fastForward: 4,
    autoBidDelay: [0.5, 1.1] as [number, number],
    playerSignal: 0.12,
    stareSignal: 0.35,
  },

  unitSizes: {
    '5x5': { w: 1.5, d: 1.5, h: 2.4, items: [4, 8], doorW: 1.3, minLevel: 1 },
    '5x10': { w: 1.5, d: 3.0, h: 2.4, items: [7, 13], doorW: 1.3, minLevel: 1 },
    '10x10': { w: 3.0, d: 3.0, h: 2.4, items: [13, 22], doorW: 2.7, minLevel: 1 },
    '10x15': { w: 3.0, d: 4.5, h: 2.4, items: [18, 28], doorW: 2.7, minLevel: 2 },
    '10x20': { w: 3.0, d: 6.0, h: 2.4, items: [23, 36], doorW: 2.7, minLevel: 3 },
  } satisfies Record<UnitSizeId, { w: number; d: number; h: number; items: [number, number]; doorW: number; minLevel: number }>,

  loot: {
    /** Per-roll rarity weights before blueprint boosts. */
    rarityWeights: { common: 72, uncommon: 25.7, rare: 2.1, epic: 0.26, legendary: 0.016, mythic: 0, unique: 0 } as Record<Rarity, number>,
    conditionWeights: [2, 10, 30, 30, 16, 9, 3],
    storyPity: 0.03,
    trashJackpotChance: 0.004,
    trashEpicChance: 0.03,
  },

  value: {
    condition: [0.05, 0.3, 0.6, 1.0, 1.35, 1.9, 2.8] as number[],
    dirtPenalty: 0.35,
    brokenMult: 0.25,
    unverifiedDiscount: 0.9,
    bonusFallback: 1.5,
  },

  workshop: {
    cleanBase: 8,
    cleanPerM3: 60,
    diySuccess: 0.6,
    diySuccessTools: 0.82,
    diyCostFactor: 0.2,
    expertBase: 25,
    expertPct: 0.02,
    expertMax: 450,
    locksmith: 140,
    photoLab: 40,
  },

  vehicle: {
    tripCost: 35,
  },

  disposal: {
    perM3: 18,
    minimum: 15,
  },

  garage: {
    overflowFeePerM3: 6,
  },

  market: {
    trendMeanReversion: 0.12,
    trendNoise: 0.045,
    trendMin: 0.55,
    trendMax: 2.4,
    historyDays: 30,
    eventChance: 0.09,
    pawnRate: { base: 0.4, jewelry: 0.6, tools: 0.48, electronics: 0.36, collectibles: 0.3, art: 0.22, music: 0.42 } as Record<string, number>,
    onlineFee: 0.1,
    onlineListingFee: 2,
    auctionHouseFee: 0.15,
    auctionHouseMin: 150,
    auctionHouseDays: 3,
    auctionHouseAuthFee: 75,
    unsoldFee: 25,
    offersPerDay: [0, 2] as [number, number],
    requestsActive: 3,
  },

  xp: {
    perProfitDollars: 10,
    unitWon: 25,
    identify: 8,
    find: { common: 0, uncommon: 4, rare: 25, epic: 80, legendary: 400, mythic: 300, unique: 40 } as Record<Rarity, number>,
    sale: 5,
    achievement: 100,
  },

  levels: [0, 400, 1200, 3000, 6500, 12000, 22000, 40000],

  net: {
    legendThreshold: 1_000_000,
  },
} as const;

export const CONDITION_NAMES = ['Destroyed', 'Poor', 'Used', 'Good', 'Very Good', 'Excellent', 'Mint'] as const;

export function conditionName(c: Condition): string {
  return CONDITION_NAMES[c];
}

export const RARITY_ORDER: Record<Rarity, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, unique: 6,
};

export function incrementFor(price: number): number {
  let inc = 10;
  for (const [threshold, step] of CONFIG.auction.increments) {
    if (price >= threshold) inc = step;
  }
  return inc;
}
