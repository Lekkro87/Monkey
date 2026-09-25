import type { TrendTag } from '../core/types';

export const LEVEL_NAMES = [
  'Rookie Hunter', 'Garage Hunter', 'Local Dealer', 'Storage Pro', 'Auction Shark', 'Collector', 'Storage King', 'Legend',
];

export interface Unlock {
  level: number;
  text: string;
}

export const LEVEL_UNLOCKS: Unlock[] = [
  { level: 1, text: 'Pawn shop and SwapBay online listings' },
  { level: 1, text: '5x5 to 10x10 units at Lucky Lock' },
  { level: 2, text: 'Hollister & Crane auction house' },
  { level: 2, text: '10x15 units and Collector\'s Storage events' },
  { level: 2, text: 'Van roof rack' },
  { level: 3, text: '10x20 units' },
  { level: 3, text: 'Collector requests board' },
  { level: 3, text: 'Precision tool kit and electronics bench' },
  { level: 4, text: 'Trailer hitch and double garage' },
  { level: 5, text: 'Rival bidders start to fear you' },
  { level: 6, text: 'Warehouse bay' },
  { level: 8, text: 'Your own storage auction (next expansion)' },
];

export interface VehicleDef {
  id: string;
  name: string;
  capacity: number;
  payload: number;
  tripCost: number;
  color: string;
}

export const VEHICLES: Record<string, VehicleDef> = {
  van: { id: 'van', name: '1998 Econo Van', capacity: 5.5, payload: 1100, tripCost: 35, color: '#e8e1d0' },
};

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  level: number;
  kind: 'vehicle' | 'garage' | 'workbench';
  capacity?: number;
  payload?: number;
  tripCost?: number;
  requires?: string;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'roof_rack', name: 'Roof Rack', description: '+0.8 m³ cargo space on the van.', cost: 450, level: 2, kind: 'vehicle', capacity: 0.8 },
  { id: 'tune_up', name: 'Engine Tune-Up', description: 'Trips cost 30% less fuel.', cost: 600, level: 2, kind: 'vehicle', tripCost: -0.3 },
  { id: 'trailer', name: 'Trailer Hitch & Trailer', description: '+3.5 m³ cargo and +500 kg payload. Trips cost $15 more.', cost: 1600, level: 4, kind: 'vehicle', capacity: 3.5, payload: 500, tripCost: 15 },
  { id: 'shelving', name: 'Steel Shelving', description: '+6 m³ of garage storage.', cost: 500, level: 1, kind: 'garage', capacity: 6 },
  { id: 'double_garage', name: 'Double Garage', description: '+20 m³ of garage storage.', cost: 4000, level: 4, kind: 'garage', capacity: 20, requires: 'shelving' },
  { id: 'warehouse', name: 'Warehouse Bay', description: '+60 m³ of storage. The first step to an empire.', cost: 18000, level: 6, kind: 'garage', capacity: 60, requires: 'double_garage' },
  { id: 'cleaning_station', name: 'Cleaning Station', description: 'Cleaning costs 40% less.', cost: 300, level: 1, kind: 'workbench' },
  { id: 'precision_tools', name: 'Precision Tool Kit', description: 'Open watch backs and camera bodies yourself. DIY repairs succeed more often.', cost: 350, level: 3, kind: 'workbench' },
  { id: 'electronics_bench', name: 'Electronics Bench', description: 'Test electronics yourself. DIY electronics repairs succeed more often.', cost: 600, level: 3, kind: 'workbench' },
  { id: 'uv_lamp', name: 'UV Lamp & Loupe', description: 'Spot retouched paint, forged ink and fake stones at your own bench.', cost: 450, level: 2, kind: 'workbench' },
  { id: 'computer', name: 'Computer & Photo Setup', description: 'SwapBay listings get 30% more views.', cost: 800, level: 2, kind: 'workbench' },
  { id: 'display_case', name: 'Display Case', description: '+3 display slots for your best finds.', cost: 700, level: 1, kind: 'garage' },
];

export const UPGRADE_MAP: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export const GARAGE_BASE_CAPACITY = 14;
export const DISPLAY_BASE_SLOTS = 3;

export interface CosmeticDef {
  id: string;
  name: string;
  slot: 'wall' | 'floor' | 'light' | 'neon';
  value: string;
  cost: number;
}

export const COSMETICS: CosmeticDef[] = [
  { id: 'wall_concrete', name: 'Bare Concrete', slot: 'wall', value: '#8d8a84', cost: 0 },
  { id: 'wall_teal', name: 'Workshop Teal', slot: 'wall', value: '#2f5d5a', cost: 120 },
  { id: 'wall_brick', name: 'Red Brick', slot: 'wall', value: '#7a3a2c', cost: 180 },
  { id: 'wall_navy', name: 'Midnight Navy', slot: 'wall', value: '#1f2a44', cost: 150 },
  { id: 'wall_cream', name: 'Diner Cream', slot: 'wall', value: '#d9cfb4', cost: 120 },
  { id: 'floor_concrete', name: 'Oil-Stained Concrete', slot: 'floor', value: 'concrete', cost: 0 },
  { id: 'floor_checker', name: 'Checkerboard Tiles', slot: 'floor', value: 'checker', cost: 350 },
  { id: 'floor_epoxy', name: 'Grey Epoxy', slot: 'floor', value: 'epoxy', cost: 500 },
  { id: 'light_warm', name: 'Warm Bulbs', slot: 'light', value: '#ffd9a0', cost: 0 },
  { id: 'light_cool', name: 'Shop Fluorescents', slot: 'light', value: '#dfeeff', cost: 90 },
  { id: 'light_amber', name: 'Amber Glow', slot: 'light', value: '#ffb060', cost: 90 },
  { id: 'neon_none', name: 'No Sign', slot: 'neon', value: '', cost: 0 },
  { id: 'neon_hunter', name: '"HUNTER" Neon', slot: 'neon', value: 'HUNTER#ff3b6b', cost: 400 },
  { id: 'neon_open', name: '"OPEN" Neon', slot: 'neon', value: 'OPEN#39d2ff', cost: 250 },
  { id: 'neon_cash', name: '"CASH ONLY" Neon', slot: 'neon', value: 'CASH ONLY#7dff6b', cost: 300 },
];

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  goal?: number;
  hidden?: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_blood', name: 'FIRST BLOOD', description: 'Win your first storage unit.' },
  { id: 'first_score', name: 'FIRST SCORE', description: 'Sell your first item at a profit.' },
  { id: 'big_spender', name: 'BIG SPENDER', description: 'Spend $10,000 at auctions.', goal: 10000 },
  { id: 'jackpot', name: 'JACKPOT', description: 'Find an item worth more than $10,000.' },
  { id: 'treasure_hunter', name: 'TREASURE HUNTER', description: 'Discover 100 rare items.', goal: 100 },
  { id: 'bad_decision', name: 'BAD DECISION', description: 'Lose money on 10 units.', goal: 10 },
  { id: 'storage_legend', name: 'STORAGE LEGEND', description: 'Reach $1,000,000 net worth.', goal: 1000000 },
  { id: 'eagle_eye', name: 'EAGLE EYE', description: 'Expose a fake before selling it.' },
  { id: 'secret_keeper', name: 'SECRET KEEPER', description: 'Find a secret compartment.' },
  { id: 'hard_bargain', name: 'HARD BARGAIN', description: 'Talk a buyer up by 50% or more.' },
  { id: 'full_load', name: 'FULL LOAD', description: 'Fill your van to the roof.' },
  { id: 'sniper', name: 'SNIPER', description: 'Win a unit on the final call.' },
  { id: 'shark_bait', name: 'SHARK BAIT', description: 'Beat The Shark in a bidding war.' },
  { id: 'clean_sweep', name: 'CLEAN SWEEP', description: 'Clear a unit and leave nothing behind.' },
  { id: 'restorer', name: 'RESTORER', description: 'Repair 10 items.', goal: 10 },
  { id: 'safecracker', name: 'SAFECRACKER', description: 'Get a locked safe opened.' },
  { id: 'home_run', name: 'HOME RUN', description: 'Make $5,000 profit on a single unit.' },
  { id: 'trendsetter', name: 'TRENDSETTER', description: 'Sell an item while its market is booming (+40%).' },
  { id: 'curator', name: 'CURATOR', description: 'Fill every slot of your display case.' },
  { id: 'full_circle', name: 'FULL CIRCLE', description: 'Resolve the story of the lost photographer.', hidden: true },
];

export const TREND_TAGS: TrendTag[] = [
  'retro_gaming', 'vinyl', 'cameras', 'watches', 'jewelry', 'mid_century', 'antiques', 'tools',
  'sports', 'comics_cards', 'art', 'fashion', 'music_gear', 'coins', 'household', 'electronics',
];

export const TREND_NAMES: Record<TrendTag, string> = {
  retro_gaming: 'Retro Gaming', vinyl: 'Vinyl', cameras: 'Cameras', watches: 'Watches', jewelry: 'Jewelry & Gold',
  mid_century: 'Mid-Century Design', antiques: 'Antiques', tools: 'Tools', sports: 'Sports', comics_cards: 'Comics & Cards',
  art: 'Art', fashion: 'Fashion', music_gear: 'Music Gear', coins: 'Coins', household: 'Household', electronics: 'Electronics',
};

export const TREND_BOOMS: Record<TrendTag, string> = {
  retro_gaming: 'A retro-gaming video went viral. Old consoles are flying off the shelves!',
  vinyl: 'Vinyl sales hit a 30-year high.',
  cameras: 'Film photography is trending with teenagers.',
  watches: 'A vintage watch sold for millions. Collectors are hungry.',
  jewelry: 'Gold prices jump after market jitters.',
  mid_century: 'A hit design show sparks a mid-century furniture craze.',
  antiques: 'Antique fair season: dealers are buying.',
  tools: 'Construction boom: contractors need tools.',
  sports: 'Summer is coming. Sporting goods are in demand.',
  comics_cards: 'A superhero blockbuster breaks records. Comics and cards spike!',
  art: 'Art market rally at the big fall auctions.',
  fashion: 'Vintage streetwear is the look of the season.',
  music_gear: 'A famous guitarist auctions her collection. Gear prices surge.',
  coins: 'Silver hits a multi-year high.',
  household: 'Spring cleaning season: household goods move fast.',
  electronics: 'Retro-tech nostalgia is everywhere.',
};

export const TREND_SLUMPS: Record<TrendTag, string> = {
  retro_gaming: 'A flood of reproduction cartridges spooks retro-game buyers.',
  vinyl: 'Record stores are overstocked. Vinyl demand cools.',
  cameras: 'Camera buyers go quiet after a price spike.',
  watches: 'Watch market correction: grey-market prices tumble.',
  jewelry: 'Gold slips as markets calm down.',
  mid_century: 'Mid-century furniture is everywhere. Prices soften.',
  antiques: 'Antique dealers are sitting on unsold stock.',
  tools: 'Hardware stores run big tool sales. Used tools slump.',
  sports: 'Off-season: nobody is buying sporting goods.',
  comics_cards: 'A grading scandal rattles the card market.',
  art: 'Auction houses report weak art sales.',
  fashion: 'Fast-fashion flood hits vintage clothing prices.',
  music_gear: 'Gear prices dip as musicians sell off.',
  coins: 'Silver drops after a strong run.',
  household: 'Flea markets are flooded with household goods.',
  electronics: 'Old electronics are piling up at recyclers.',
};

export interface QuestStage {
  title: string;
  text: string;
}

export interface QuestDef {
  id: string;
  name: string;
  items: string[];
  needed: number;
  stages: QuestStage[];
  choices: { id: string; label: string; text: string }[];
}

export const QUESTS: QuestDef[] = [
  {
    id: 'photographer',
    name: 'The Lost Photographer',
    items: ['film_rolls', 'press_pass', 'letters', 'camera_bag'],
    needed: 3,
    stages: [
      { title: 'Initials E.M.', text: 'You found something marked with the initials E.M. Someone cared about these things. Maybe more of them turn up in other units.' },
      { title: 'A photographer', text: 'More belongings of E.M. surfaced: photography gear and paperwork. If you find her film, develop it at your workbench.' },
      { title: 'Evelyn Marlow', text: 'The pieces fit together: Evelyn Marlow, staff photographer at the Daily Courier in the seventies. Her things ended up scattered across storage units after she died.' },
      { title: 'Her granddaughter', text: 'Her letters lead you to Nora Marlow, Evelyn\'s granddaughter. She never knew the archive existed. What will you do with it?' },
    ],
    choices: [
      { id: 'return', label: 'Return it to the family', text: 'Nora is overwhelmed. She pays a $3,000 finder\'s reward and insists you keep Evelyn\'s camera.' },
      { id: 'sell', label: 'Sell it to the museum', text: 'The City Museum of Photography buys the collection for $14,000.' },
      { id: 'keep', label: 'Keep the archive', text: 'The Marlow Archive becomes the centerpiece of your collection.' },
    ],
  },
];

export const QUEST_MAP: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

export const BOX_LABEL_HINTS: Record<string, { mood: number }> = {
  'COLLECTION': { mood: 1.8 }, 'MINT!!': { mood: 1.8 }, 'SILVER': { mood: 1.6 }, 'DAD\'S THINGS': { mood: 1.3 },
  'DON\'T TOUCH': { mood: 1.4 }, 'IMPORTANT!!': { mood: 1.2 }, 'KEEP — FAMILY': { mood: 1.3 }, 'COINS': { mood: 1.7 },
  'JUNK': { mood: 0.4 }, 'TRASH': { mood: 0.3 }, 'DUMP': { mood: 0.4 }, 'XMAS': { mood: 0.5 }, 'KITCHEN': { mood: 0.7 },
  'CABLES': { mood: 0.5 }, 'CLOTHES': { mood: 0.6 }, 'BOOKS': { mood: 0.6 },
};
