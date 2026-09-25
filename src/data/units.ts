import type { UnitBlueprint, UnitEventId } from '../core/types';

/** The ten unit archetypes of the vertical slice. Five regular themes, five event units. */
export const BLUEPRINTS: UnitBlueprint[] = [
  {
    id: 'household', name: 'Family Household', description: 'A family\'s overflow: furniture, kitchen stuff, kids\' toys.',
    sizes: ['5x10', '10x10', '10x15', '10x20'],
    categoryWeights: { furniture: 6, household: 10, electronics: 5, media: 4, toys: 3, sports: 3, fashion: 3, jewelry: 1.5, art: 2, collectibles: 1.5, tools: 2, music: 1.5, documents: 1 },
    rarityBoost: 1, trashRatio: [0.2, 0.35], fill: [0.45, 0.7], density: 1.0, boxShare: 0.35, damageChance: 0.12, secretChance: 1,
    dirt: [0.2, 0.6], event: null, minLevel: 1, weight: 22, storyChance: 0.05,
    labels: ['KITCHEN', 'KIDS ROOM', 'XMAS', 'BATHROOM', 'LIVING ROOM', 'MISC', 'MOM', 'GARAGE', 'BOOKS', 'CLOTHES'],
  },
  {
    id: 'bachelor', name: 'Bachelor Pad', description: 'Game consoles, gym gear and a suspicious number of neon beer signs.',
    sizes: ['5x5', '5x10', '10x10'],
    categoryWeights: { electronics: 10, sports: 6, music: 4, media: 4, fashion: 3, collectibles: 3, furniture: 3, household: 3, tools: 2, toys: 2, jewelry: 1 },
    rarityBoost: 1, trashRatio: [0.2, 0.4], fill: [0.4, 0.65], density: 0.9, boxShare: 0.3, damageChance: 0.15, secretChance: 0.8,
    dirt: [0.3, 0.7], event: null, minLevel: 1, weight: 18, storyChance: 0.01,
    labels: ['GAMES', 'STUFF', 'CABLES', 'GYM', 'DVDS', 'MISC', 'DON\'T TOUCH', 'XBOX??'],
  },
  {
    id: 'contractor', name: 'Contractor\'s Unit', description: 'Power tools, tool chests and the smell of sawdust.',
    sizes: ['5x10', '10x10', '10x15'],
    categoryWeights: { tools: 14, household: 2, electronics: 3, sports: 2, furniture: 2, collectibles: 1, jewelry: 0.5, documents: 0.5 },
    rarityBoost: 0.9, trashRatio: [0.2, 0.35], fill: [0.45, 0.7], density: 1.0, boxShare: 0.25, damageChance: 0.2, secretChance: 0.6,
    dirt: [0.4, 0.8], event: null, minLevel: 1, weight: 14, storyChance: 0.01,
    labels: ['TOOLS', 'JOBSITE', 'BITS & BLADES', 'ELECTRIC', 'PLUMBING', 'SCREWS', 'SHOP'],
  },
  {
    id: 'musician', name: 'Band Storage', description: 'Amps, instruments, records and gig posters from a band that almost made it.',
    sizes: ['5x10', '10x10', '10x15'],
    categoryWeights: { music: 12, media: 7, electronics: 5, art: 3, fashion: 2, furniture: 2, collectibles: 2, household: 2 },
    rarityBoost: 1.1, trashRatio: [0.15, 0.3], fill: [0.4, 0.65], density: 0.95, boxShare: 0.3, damageChance: 0.12, secretChance: 0.7,
    dirt: [0.2, 0.6], event: null, minLevel: 1, weight: 12, storyChance: 0.02,
    labels: ['RECORDS', 'MERCH', 'CABLES', 'TOUR 88', 'DEMOS', 'GEAR', 'FRAGILE'],
  },
  {
    id: 'hoarder', name: 'The Hoarder', description: 'Packed floor to ceiling. Mostly junk. Mostly.',
    sizes: ['10x10', '10x15', '10x20'],
    categoryWeights: { furniture: 4, household: 6, electronics: 5, media: 5, collectibles: 4, toys: 3, sports: 3, fashion: 4, jewelry: 2, art: 3, tools: 3, music: 2, documents: 2 },
    rarityBoost: 1.15, trashRatio: [0.35, 0.55], fill: [0.7, 0.92], density: 1.55, boxShare: 0.5, damageChance: 0.25, secretChance: 1.4,
    dirt: [0.5, 0.95], event: null, minLevel: 1, weight: 12, storyChance: 0.05,
    labels: ['STUFF', 'MORE STUFF', 'KEEP', 'MISC', 'SORT LATER', 'IMPORTANT!!', 'PAPERS', '???', 'MISC 2'],
  },
  {
    id: 'estate', name: 'Estate Storage', description: 'The complete belongings of someone who passed away. Anything can be in here.',
    sizes: ['10x10', '10x15', '10x20'],
    categoryWeights: { furniture: 7, household: 6, art: 5, jewelry: 4, collectibles: 3, media: 3, documents: 3, electronics: 2, fashion: 3, music: 2, tools: 2 },
    rarityBoost: 1.45, trashRatio: [0.12, 0.25], fill: [0.55, 0.8], density: 1.2, boxShare: 0.35, damageChance: 0.1, secretChance: 2,
    dirt: [0.3, 0.7], event: 'estate', minLevel: 1, weight: 7, storyChance: 0.12,
    labels: ['DAD\'S THINGS', 'MOTHER\'S CHINA', 'PHOTOS', 'ATTIC', 'LETTERS', 'SILVER', 'KEEP — FAMILY', 'STUDY'],
  },
  {
    id: 'collector', name: 'Collector\'s Storage', description: 'Somebody collected things seriously. Bins, sleeves, and labels everywhere.',
    sizes: ['5x10', '10x10', '10x15'],
    categoryWeights: { collectibles: 12, toys: 6, media: 5, art: 3, electronics: 4, jewelry: 2, music: 2 },
    rarityBoost: 2.4, trashRatio: [0.1, 0.2], fill: [0.45, 0.7], density: 1.1, boxShare: 0.45, damageChance: 0.08, secretChance: 1,
    dirt: [0.1, 0.4], event: 'collector', minLevel: 2, weight: 5, storyChance: 0.03,
    labels: ['COLLECTION', 'MINT!!', 'CARDS', 'COMICS A–M', 'COMICS N–Z', 'DO NOT BEND', 'COINS', 'TOYS (BOXED)'],
  },
  {
    id: 'flood', name: 'Flood-Damaged Unit', description: 'A burst pipe flooded this unit. Some things survived. Some did not.',
    sizes: ['5x10', '10x10', '10x15'],
    categoryWeights: { furniture: 6, household: 8, electronics: 5, media: 4, toys: 3, sports: 3, fashion: 3, jewelry: 2, art: 2, collectibles: 2, tools: 3, music: 2 },
    rarityBoost: 1.05, trashRatio: [0.3, 0.45], fill: [0.45, 0.7], density: 1.0, boxShare: 0.35, damageChance: 0.65, secretChance: 0.8,
    dirt: [0.6, 1.0], event: 'flood', minLevel: 1, weight: 7, storyChance: 0.03,
    labels: ['KITCHEN', 'BOOKS', 'LIVING ROOM', 'MISC', 'BEDROOM', 'OFFICE'],
  },
  {
    id: 'mystery', name: 'Mystery Unit', description: 'Everything is under tarps. Nobody knows who rented it.',
    sizes: ['5x10', '10x10', '10x15'],
    categoryWeights: { furniture: 4, household: 4, electronics: 5, media: 3, collectibles: 5, toys: 2, sports: 2, fashion: 3, jewelry: 3, art: 4, tools: 3, music: 3, documents: 2 },
    rarityBoost: 1.7, trashRatio: [0.2, 0.4], fill: [0.45, 0.75], density: 1.2, boxShare: 0.35, damageChance: 0.15, secretChance: 1.5,
    dirt: [0.3, 0.8], event: 'mystery', minLevel: 1, weight: 6, storyChance: 0.1,
    labels: ['', '', 'X', '#7', 'PRIVATE', 'DO NOT OPEN'],
  },
  {
    id: 'trash', name: 'Trash Unit', description: 'Garbage bags, broken furniture, a mattress. The worst unit of the day, probably.',
    sizes: ['5x10', '10x10', '10x15'],
    categoryWeights: { household: 6, furniture: 3, electronics: 3, media: 2, fashion: 2, toys: 2, sports: 2, collectibles: 1, jewelry: 1 },
    rarityBoost: 0.7, trashRatio: [0.7, 0.88], fill: [0.5, 0.8], density: 1.15, boxShare: 0.25, damageChance: 0.3, secretChance: 0.8,
    dirt: [0.7, 1.0], event: 'trash', minLevel: 1, weight: 7, storyChance: 0.02,
    labels: ['JUNK', 'TRASH', 'DUMP', 'OLD', 'MISC'],
  },
];

export const BLUEPRINT_MAP: Record<string, UnitBlueprint> = Object.fromEntries(BLUEPRINTS.map((b) => [b.id, b]));

export const EVENT_INFO: Record<UnitEventId, { title: string; text: string; color: string }> = {
  flood: { title: 'FLOOD DAMAGE', text: 'Part of this unit was flooded. Some items are ruined, others may still be valuable.', color: '#4aa3df' },
  estate: { title: 'ESTATE STORAGE', text: 'The complete belongings of a deceased person. Very interesting items are possible.', color: '#c9a45c' },
  mystery: { title: 'MYSTERY UNIT', text: 'Nobody knows who this unit belongs to. Everything is covered.', color: '#9b7bd8' },
  collector: { title: 'COLLECTOR\'S STORAGE', text: 'A very high chance of rare collectibles.', color: '#e0584f' },
  trash: { title: 'TRASH UNIT', text: 'Almost everything is worthless. But maybe a hidden jackpot exists.', color: '#8a8f5a' },
};

export const TENANT_FIRST = ['M.', 'R.', 'J.', 'D.', 'A.', 'L.', 'T.', 'S.', 'K.', 'P.', 'H.', 'E.', 'W.', 'G.', 'B.', 'C.'];
export const TENANT_LAST = [
  'Kowalski', 'Dalton', 'Miller', 'Reyes', 'Okonkwo', 'Fischer', 'Brennan', 'Castillo', 'Novak', 'Hughes', 'Tanaka', 'Moreau',
  'Lindqvist', 'Abernathy', 'Petrov', 'Sullivan', 'Whitaker', 'Delgado', 'Hartmann', 'Mercer', 'Vance', 'Holloway', 'Quinn', 'Barrett',
];
