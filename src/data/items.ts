import type { Category, Family, ItemDef, Rarity } from '../core/types';

/**
 * Item families: items in one family look alike until inspected
 * ("UNKNOWN WATCH" could be a $25 quartz or a $95,000 chronograph).
 */
export const FAMILIES: Record<string, Family> = {
  watch: { id: 'watch', unknownName: 'Wristwatch', hint: 'Could be a cheap quartz or something special.' },
  pocket_watch: { id: 'pocket_watch', unknownName: 'Pocket Watch', hint: 'Surprisingly heavy for its size.' },
  jewelry: { id: 'jewelry', unknownName: 'Piece of Jewelry', hint: 'Gold? Brass? Hard to tell under the grime.' },
  camera: { id: 'camera', unknownName: 'Old Camera', hint: 'Film cameras range from junk to collector gold.' },
  console: { id: 'console', unknownName: 'Video Game Console', hint: 'Retro gaming is a serious collector market.' },
  guitar: { id: 'guitar', unknownName: 'Guitar Case', hint: 'Whatever is inside, it is a guitar.' },
  keyboard: { id: 'keyboard', unknownName: 'Electronic Keyboard', hint: 'Toy keyboard or studio gear?' },
  radio: { id: 'radio', unknownName: 'Old Radio', hint: 'It might not even turn on.' },
  vinyl: { id: 'vinyl', unknownName: 'Crate of Records', hint: 'Most records are worth a dollar. Some are not.' },
  comics: { id: 'comics', unknownName: 'Box of Comics', hint: 'Bagged and boarded. Somebody cared.' },
  comic_single: { id: 'comic_single', unknownName: 'Old Comic Book', hint: 'Fragile paper in a plastic sleeve.' },
  cards: { id: 'cards', unknownName: 'Trading Card Binder', hint: 'Somebody organised these carefully.' },
  coins: { id: 'coins', unknownName: 'Coin Collection', hint: 'Coins sell on rarity and condition.' },
  gold_coin: { id: 'gold_coin', unknownName: 'Coin in a Capsule', hint: 'Someone went out of their way to protect this coin.' },
  poster: { id: 'poster', unknownName: 'Framed Poster', hint: 'Is that ink a signature?' },
  toy: { id: 'toy', unknownName: 'Old Toy Robot', hint: 'Tin or plastic?' },
  baseball: { id: 'baseball', unknownName: 'Baseball in a Case', hint: 'Why keep a ball in a display case?' },
  painting: { id: 'painting', unknownName: 'Framed Painting', hint: 'A print, an amateur, or the real thing?' },
  vase: { id: 'vase', unknownName: 'Porcelain Vase', hint: 'Home-decor store or dynasty?' },
  armchair: { id: 'armchair', unknownName: 'Armchair', hint: 'The shape looks deliberate.' },
  dresser: { id: 'dresser', unknownName: 'Chest of Drawers', hint: 'Solid wood or particle board?' },
  handbag: { id: 'handbag', unknownName: 'Leather Handbag', hint: 'Luxury bags are the most counterfeited goods on earth.' },
  sneakers: { id: 'sneakers', unknownName: 'Shoebox', hint: 'Sneakerheads pay crazy money for the right pair.' },
  rug: { id: 'rug', unknownName: 'Rolled Rug', hint: 'Hand-knotted rugs can be worth thousands.' },
  books: { id: 'books', unknownName: 'Stack of Old Books', hint: 'Usually worthless. Usually.' },
};

const defs: ItemDef[] = [
  // ── Containers ───────────────────────────────────────────────────────────
  {
    id: 'box_s', name: 'Small Moving Box', category: 'container', rarity: 'common', baseValue: 0, variance: 0,
    dims: [0.4, 0.3, 0.3], weight: 0.4, model: 'box', modelParams: { size: 's' }, tags: [], inspect: 'generic', expert: null,
    container: { kind: 'box', slots: [1, 3], maxItemVolume: 0.022 }, supportsStack: true,
    flavor: 'Cardboard, packing tape, and somebody else\'s memories.',
  },
  {
    id: 'box_m', name: 'Moving Box', category: 'container', rarity: 'common', baseValue: 0, variance: 0,
    dims: [0.5, 0.4, 0.4], weight: 0.6, model: 'box', modelParams: { size: 'm' }, tags: [], inspect: 'generic', expert: null,
    container: { kind: 'box', slots: [2, 4], maxItemVolume: 0.05 }, supportsStack: true,
    flavor: 'Cardboard, packing tape, and somebody else\'s memories.',
  },
  {
    id: 'box_l', name: 'Large Moving Box', category: 'container', rarity: 'common', baseValue: 0, variance: 0,
    dims: [0.6, 0.5, 0.5], weight: 0.9, model: 'box', modelParams: { size: 'l' }, tags: [], inspect: 'generic', expert: null,
    container: { kind: 'box', slots: [2, 5], maxItemVolume: 0.1 }, supportsStack: true,
    flavor: 'The big ones always feel heavier than they should.',
  },
  {
    id: 'tote', name: 'Plastic Storage Tote', category: 'container', rarity: 'common', baseValue: 4, variance: 0.2,
    dims: [0.6, 0.35, 0.4], weight: 1.5, model: 'tote', tags: [], inspect: 'generic', expert: null,
    container: { kind: 'tote', slots: [2, 5], maxItemVolume: 0.05 }, supportsStack: true,
    flavor: 'A see-through lid would have been too convenient.',
  },
  {
    id: 'suitcase', name: 'Vintage Suitcase', category: 'container', rarity: 'common', baseValue: 35, variance: 0.3,
    dims: [0.7, 0.22, 0.45], weight: 4, model: 'suitcase', tags: ['fashion'], inspect: 'fashion', expert: null,
    container: { kind: 'case', slots: [1, 4], maxItemVolume: 0.03, lootBias: { fashion: 6, documents: 4, jewelry: 3 } },
    supportsStack: true,
    flavor: 'Brass latches, scuffed corners, a faded airline tag.',
  },
  {
    id: 'trunk', name: 'Steamer Trunk', category: 'furniture', rarity: 'uncommon', baseValue: 240, variance: 0.35,
    dims: [0.9, 0.55, 0.5], weight: 24, model: 'trunk', tags: ['antiques'], inspect: 'furniture', expert: 'antiques',
    container: { kind: 'trunk', slots: [1, 5], maxItemVolume: 0.06, lootBias: { documents: 5, fashion: 4, collectibles: 3, jewelry: 2 }, secretChance: 0.06 },
    supportsStack: true, conditionSensitivity: 0.8,
    flavor: 'Canvas and oak slats from the age of ocean liners.',
  },
  {
    id: 'jewelry_box', name: 'Jewelry Box', category: 'container', rarity: 'common', baseValue: 25, variance: 0.4,
    dims: [0.25, 0.12, 0.18], weight: 0.8, model: 'jewelry_box', tags: ['jewelry'], inspect: 'generic', expert: null,
    container: { kind: 'jewelrybox', slots: [1, 4], maxItemVolume: 0.0006, lootBias: { jewelry: 30, collectibles: 2 } },
    flavor: 'A tiny ballerina used to spin in here.',
  },
  {
    id: 'toolbox', name: 'Steel Toolbox', category: 'tools', rarity: 'common', baseValue: 35, variance: 0.3,
    dims: [0.5, 0.22, 0.22], weight: 8, model: 'toolbox', tags: ['tools'], inspect: 'tools', expert: null,
    container: { kind: 'toolbox', slots: [1, 3], maxItemVolume: 0.015, lootBias: { tools: 20 } }, supportsStack: true,
    flavor: 'Red paint, rust, and the smell of old oil.',
  },
  {
    id: 'safe', name: 'Old Floor Safe', category: 'furniture', rarity: 'uncommon', baseValue: 160, variance: 0.3,
    dims: [0.5, 0.6, 0.5], weight: 95, model: 'safe', tags: ['antiques'], inspect: 'generic', expert: null,
    container: { kind: 'safe', slots: [0, 3], maxItemVolume: 0.02, locked: true, lootBias: { jewelry: 8, documents: 8, collectibles: 5 } },
    supportsStack: true,
    flavor: 'Locked. Nobody has the combination. Everybody has a theory.',
  },

  // ── Household ────────────────────────────────────────────────────────────
  {
    id: 'toaster', name: 'Chrome Toaster', category: 'household', rarity: 'common', baseValue: 14, variance: 0.3,
    dims: [0.28, 0.2, 0.18], weight: 2, model: 'toaster', tags: ['household'], inspect: 'electronics', expert: null,
    brokenChance: 0.3, repairCost: 15, cleanable: true, conditionSensitivity: 0.6,
    flavor: 'Two slots, one setting: burnt.',
  },
  {
    id: 'table_lamp', name: 'Table Lamp', category: 'household', rarity: 'common', baseValue: 18, variance: 0.4,
    dims: [0.28, 0.5, 0.28], weight: 2, model: 'lamp', tags: ['household'], inspect: 'electronics', expert: null,
    brokenChance: 0.2, repairCost: 12, cleanable: true, conditionSensitivity: 0.6,
    flavor: 'The shade has seen some things.',
  },
  {
    id: 'floor_lamp', name: 'Brass Arc Floor Lamp', category: 'furniture', rarity: 'uncommon', baseValue: 190, variance: 0.35,
    dims: [0.45, 1.6, 0.45], weight: 7, model: 'floor_lamp', tags: ['mid_century'], inspect: 'furniture', expert: 'antiques',
    brokenChance: 0.25, repairCost: 30, cleanable: true, sparse: true,
    flavor: 'Mid-century brass with a marble foot. Very Mad Men.',
  },
  {
    id: 'microwave', name: 'Microwave Oven', category: 'household', rarity: 'common', baseValue: 25, variance: 0.3,
    dims: [0.5, 0.3, 0.38], weight: 12, model: 'microwave', tags: ['household'], inspect: 'electronics', expert: null,
    brokenChance: 0.35, repairCost: 30, cleanable: true, conditionSensitivity: 0.6,
    flavor: 'The turntable still turns. Mostly.',
  },
  {
    id: 'plates', name: 'Set of Dinner Plates', category: 'household', rarity: 'common', baseValue: 18, variance: 0.4,
    dims: [0.3, 0.15, 0.3], weight: 5, model: 'plates', tags: ['household'], inspect: 'generic', expert: null,
    cleanable: true, conditionSensitivity: 0.7,
    flavor: 'Stoneware, service for six. Two are chipped.',
  },
  {
    id: 'china_set', name: 'Fine Bone China Set', category: 'household', rarity: 'uncommon', baseValue: 190, variance: 0.4,
    dims: [0.45, 0.3, 0.35], weight: 8, model: 'china', tags: ['antiques', 'household'], inspect: 'generic', expert: 'antiques',
    cleanable: true,
    flavor: 'Gold rims, hand-painted roses, stamped on the underside.',
  },
  {
    id: 'vacuum', name: 'Upright Vacuum', category: 'household', rarity: 'common', baseValue: 22, variance: 0.3,
    dims: [0.32, 1.1, 0.3], weight: 7, model: 'vacuum', tags: ['household'], inspect: 'electronics', expert: null,
    brokenChance: 0.35, repairCost: 25, cleanable: true, conditionSensitivity: 0.6,
    flavor: 'Loud enough to wake the neighbours.',
  },
  {
    id: 'mini_fridge', name: 'Mini Fridge', category: 'household', rarity: 'common', baseValue: 45, variance: 0.3,
    dims: [0.48, 0.6, 0.5], weight: 18, model: 'mini_fridge', tags: ['household'], inspect: 'electronics', expert: null,
    brokenChance: 0.3, repairCost: 35, cleanable: true, supportsStack: true, conditionSensitivity: 0.6,
    flavor: 'Dorm-room classic. Do not open. Or do.',
  },
  {
    id: 'mirror', name: 'Framed Wall Mirror', category: 'furniture', rarity: 'common', baseValue: 35, variance: 0.4,
    dims: [0.7, 1.0, 0.05], weight: 9, model: 'mirror', tags: ['household'], inspect: 'furniture', expert: null,
    cleanable: true, leans: true,
    flavor: 'Seven years of bad luck, handle with care.',
  },
  {
    id: 'xmas', name: 'Christmas Decorations', category: 'household', rarity: 'common', baseValue: 10, variance: 0.4,
    dims: [0.35, 0.2, 0.3], weight: 2, model: 'xmas', tags: ['household'], inspect: 'generic', expert: null,
    flavor: 'Tangled lights and a single glass bauble that survived.',
  },
  {
    id: 'trophy', name: 'Bowling Trophy', category: 'sports', rarity: 'common', baseValue: 8, variance: 0.4,
    dims: [0.15, 0.35, 0.12], weight: 1, model: 'trophy', tags: ['sports'], inspect: 'generic', expert: null,
    cleanable: true,
    flavor: '"Second Place — Thursday Night League, 1994."',
  },
  {
    id: 'sewing_machine', name: 'Vintage Sewing Machine', category: 'household', rarity: 'uncommon', baseValue: 130, variance: 0.35,
    dims: [0.45, 0.3, 0.22], weight: 11, model: 'sewing_machine', tags: ['antiques', 'household'], inspect: 'electronics', expert: 'antiques',
    brokenChance: 0.35, repairCost: 45, cleanable: true,
    flavor: 'Cast iron and gold decals. Built to outlive everyone.',
  },
  {
    id: 'typewriter', name: 'Portable Typewriter', category: 'household', rarity: 'uncommon', baseValue: 150, variance: 0.35,
    dims: [0.35, 0.15, 0.32], weight: 8, model: 'typewriter', tags: ['mid_century', 'antiques'], inspect: 'electronics', expert: 'antiques',
    brokenChance: 0.3, repairCost: 50, cleanable: true,
    flavor: 'Mint-green enamel. Writers pay good money for these.',
  },

  // ── Box fillers: the everyday stuff most boxes are full of ─────────────
  {
    id: 'kitchen_utensils', name: 'Kitchen Utensils', category: 'household', rarity: 'common', baseValue: 5, variance: 0.4,
    dims: [0.3, 0.1, 0.2], weight: 2, model: 'utensils', tags: ['household'], inspect: 'generic', expert: null,
    cleanable: true, conditionSensitivity: 0.4,
    flavor: 'Whisks, ladles and a garlic press nobody used.',
  },
  {
    id: 'vhs_tapes', name: 'Stack of VHS Tapes', category: 'media', rarity: 'common', baseValue: 4, variance: 0.5,
    dims: [0.3, 0.12, 0.2], weight: 3, model: 'vhs', tags: ['retro_gaming'], inspect: 'paper', expert: null,
    conditionSensitivity: 0.5,
    flavor: 'Home recordings of a wedding and three copies of the same action movie.',
  },
  {
    id: 'knick_knacks', name: 'Knick-Knacks', category: 'household', rarity: 'common', baseValue: 5, variance: 0.5,
    dims: [0.25, 0.15, 0.2], weight: 1.5, model: 'knickknacks', tags: ['household'], inspect: 'generic', expert: null,
    cleanable: true, conditionSensitivity: 0.4,
    flavor: 'Ceramic owls, a snow globe, a souvenir spoon.',
  },
  {
    id: 'picture_frames', name: 'Picture Frames', category: 'household', rarity: 'common', baseValue: 6, variance: 0.4,
    dims: [0.3, 0.25, 0.06], weight: 1.5, model: 'frames', tags: ['household'], inspect: 'generic', expert: null,
    cleanable: true, conditionSensitivity: 0.4,
    flavor: 'Still holding stock photos of strangers.',
  },
  {
    id: 'old_clothes', name: 'Folded Old Clothes', category: 'fashion', rarity: 'common', baseValue: 3, variance: 0.5,
    dims: [0.35, 0.15, 0.3], weight: 2, model: 'clothes', tags: ['fashion'], inspect: 'fashion', expert: null,
    conditionSensitivity: 0.4,
    flavor: 'Sweaters, mostly beige, some with elbow patches.',
  },
  {
    id: 'towels', name: 'Stack of Towels', category: 'household', rarity: 'common', baseValue: 4, variance: 0.4,
    dims: [0.35, 0.15, 0.3], weight: 2.5, model: 'towels', tags: ['household'], inspect: 'generic', expert: null,
    conditionSensitivity: 0.4,
    flavor: 'Soft once. Now they are "garage towels".',
  },
  {
    id: 'dvds', name: 'DVD Collection', category: 'media', rarity: 'common', baseValue: 8, variance: 0.5,
    dims: [0.3, 0.15, 0.15], weight: 3, model: 'dvds', tags: ['electronics'], inspect: 'paper', expert: null,
    conditionSensitivity: 0.5,
    flavor: 'Box sets of shows everyone streams now.',
  },
  {
    id: 'board_games', name: 'Board Games', category: 'toys', rarity: 'common', baseValue: 12, variance: 0.5,
    dims: [0.4, 0.08, 0.28], weight: 2, model: 'board_games', tags: ['comics_cards'], inspect: 'generic', expert: null,
    conditionSensitivity: 0.6,
    flavor: 'Three classics, at least one piece missing from each.',
  },
  {
    id: 'plush', name: 'Stuffed Animals', category: 'toys', rarity: 'common', baseValue: 3, variance: 0.5,
    dims: [0.3, 0.25, 0.25], weight: 1, model: 'plush', tags: [], inspect: 'generic', expert: null,
    cleanable: true, conditionSensitivity: 0.4,
    flavor: 'A bear with one eye watches you judge him.',
  },
  {
    id: 'hand_tools', name: 'Assorted Hand Tools', category: 'tools', rarity: 'common', baseValue: 18, variance: 0.4,
    dims: [0.35, 0.1, 0.25], weight: 5, model: 'hand_tools', tags: ['tools'], inspect: 'tools', expert: null,
    cleanable: true, conditionSensitivity: 0.6,
    flavor: 'Hammers, pliers and screwdrivers of mixed heritage.',
  },
  {
    id: 'office_supplies', name: 'Office Supplies', category: 'documents', rarity: 'common', baseValue: 3, variance: 0.5,
    dims: [0.3, 0.12, 0.22], weight: 2, model: 'office', tags: [], inspect: 'generic', expert: null,
    flavor: 'Staplers, binders, a thousand rubber bands.',
  },
  {
    id: 'sports_gear', name: 'Bag of Sports Gear', category: 'sports', rarity: 'common', baseValue: 14, variance: 0.5,
    dims: [0.4, 0.2, 0.3], weight: 3, model: 'sports_gear', tags: ['sports'], inspect: 'generic', expert: null,
    cleanable: true, conditionSensitivity: 0.6,
    flavor: 'Shin guards, a deflated ball and a whistle.',
  },
  {
    id: 'cassettes', name: 'Box of Cassette Tapes', category: 'media', rarity: 'common', baseValue: 9, variance: 0.5,
    dims: [0.25, 0.1, 0.18], weight: 1.5, model: 'cassettes', tags: ['vinyl', 'retro_gaming'], inspect: 'paper', expert: 'music',
    conditionSensitivity: 0.6,
    flavor: 'Mixtapes with hand-written track lists.',
  },

  // ── Books & paper ───────────────────────────────────────────────────────
  {
    id: 'books_paper', name: 'Stack of Paperbacks', family: 'books', category: 'media', rarity: 'common', baseValue: 10, variance: 0.4,
    dims: [0.3, 0.25, 0.22], weight: 6, model: 'books', tags: ['household'], inspect: 'paper', expert: 'collectibles',
    flavor: 'Airport thrillers and a cookbook with sauce stains.',
  },
  {
    id: 'books_first', name: 'First-Edition Novel', family: 'books', possibleName: 'Possible First Edition', category: 'media', rarity: 'rare', baseValue: 950, variance: 0.5,
    dims: [0.3, 0.25, 0.22], weight: 6, model: 'books', modelParams: { old: true }, tags: ['comics_cards', 'antiques'], inspect: 'paper', expert: 'collectibles',
    conditionSensitivity: 1.3, bonus: { chance: 0.25, kind: 'signed', mult: 3, label: 'Signed by the author' },
    flavor: 'Original dust jacket, first printing line intact.',
  },
  {
    id: 'magazines', name: 'Stack of Old Magazines', category: 'trash', rarity: 'common', baseValue: 1, variance: 0.5,
    dims: [0.3, 0.25, 0.22], weight: 7, model: 'magazines', tags: [], inspect: 'generic', expert: null,
    flavor: 'Nobody needs 40 issues of a golf magazine.',
  },

  // ── Electronics ──────────────────────────────────────────────────────────
  {
    id: 'crt_tv', name: 'CRT Television', category: 'electronics', rarity: 'common', baseValue: 35, variance: 0.4,
    dims: [0.55, 0.45, 0.48], weight: 22, model: 'crt_tv', tags: ['retro_gaming', 'electronics'], inspect: 'electronics', expert: 'electronics',
    brokenChance: 0.25, repairCost: 45, cleanable: true, supportsStack: true, conditionSensitivity: 0.7,
    flavor: 'Heavy as a sin. Retro gamers swear by the picture.',
  },
  {
    id: 'old_pc', name: 'Beige Desktop PC', category: 'electronics', rarity: 'uncommon', baseValue: 110, variance: 0.4,
    dims: [0.2, 0.42, 0.45], weight: 9, model: 'old_pc', tags: ['retro_gaming', 'electronics'], inspect: 'electronics', expert: 'electronics',
    brokenChance: 0.4, repairCost: 50, cleanable: true,
    flavor: 'A turbo button and a 3.5" floppy drive.',
  },
  {
    id: 'radio_transistor', name: 'Transistor Radio', family: 'radio', category: 'electronics', rarity: 'common', baseValue: 28, variance: 0.4,
    dims: [0.2, 0.12, 0.07], weight: 0.6, model: 'radio', modelParams: { style: 'transistor' }, tags: ['electronics'], inspect: 'electronics', expert: 'electronics',
    brokenChance: 0.4, repairCost: 20, cleanable: true,
    flavor: 'Pocket-sized, plastic, pleasant.',
  },
  {
    id: 'radio_tube', name: '1950s Tube Radio', family: 'radio', possibleName: 'Possible Tube Radio', category: 'electronics', rarity: 'uncommon', baseValue: 390, variance: 0.35,
    dims: [0.5, 0.32, 0.26], weight: 7, model: 'radio', modelParams: { style: 'tube' }, tags: ['antiques', 'electronics'], inspect: 'electronics', expert: 'electronics',
    brokenChance: 0.75, repairCost: 120, cleanable: true, conditionSensitivity: 1.2,
    flavor: 'Walnut cabinet, cloth grille, warm glowing tubes.',
  },
  {
    id: 'boombox', name: '80s Boombox', category: 'electronics', rarity: 'uncommon', baseValue: 170, variance: 0.4,
    dims: [0.55, 0.3, 0.15], weight: 5, model: 'boombox', tags: ['retro_gaming', 'music_gear', 'electronics'], inspect: 'electronics', expert: 'electronics',
    brokenChance: 0.4, repairCost: 50, cleanable: true,
    flavor: 'Double tape deck. Built for shoulders.',
  },
  {
    id: 'record_player', name: 'Record Player', category: 'music', rarity: 'uncommon', baseValue: 150, variance: 0.35,
    dims: [0.45, 0.15, 0.36], weight: 6, model: 'record_player', tags: ['vinyl', 'music_gear'], inspect: 'electronics', expert: 'music',
    brokenChance: 0.35, repairCost: 60, cleanable: true,
    flavor: 'Belt drive, dust cover, needle probably shot.',
  },
  {
    id: 'camera_point', name: 'Point-and-Shoot Camera', family: 'camera', category: 'electronics', rarity: 'common', baseValue: 28, variance: 0.4,
    dims: [0.12, 0.07, 0.05], weight: 0.3, model: 'camera', modelParams: { style: 'point' }, tags: ['cameras'], inspect: 'camera', expert: 'electronics',
    brokenChance: 0.3, repairCost: 20, cleanable: true, conditionSensitivity: 1.2,
    flavor: 'Plastic body, fixed lens, a half-used roll inside.',
  },
  {
    id: 'camera_slr', name: '35mm SLR Camera', family: 'camera', possibleName: 'Possible Vintage SLR', category: 'electronics', rarity: 'uncommon', baseValue: 240, variance: 0.35,
    dims: [0.14, 0.1, 0.09], weight: 0.8, model: 'camera', modelParams: { style: 'slr' }, tags: ['cameras'], inspect: 'camera', expert: 'electronics',
    brokenChance: 0.25, repairCost: 70, cleanable: true, conditionSensitivity: 1.5,
    flavor: 'All-metal body, a sharp 50mm prime lens.',
  },
  {
    id: 'camera_rangefinder', name: 'Lumière M3 Rangefinder', family: 'camera', possibleName: 'Possible Collector Camera', category: 'electronics', rarity: 'epic', baseValue: 3400, variance: 0.3,
    dims: [0.14, 0.08, 0.06], weight: 0.6, model: 'camera', modelParams: { style: 'rangefinder' }, tags: ['cameras'], inspect: 'camera', expert: 'electronics',
    brokenChance: 0.15, repairCost: 350, cleanable: true, conditionSensitivity: 1.5, fakeChance: 0.15, fakeValue: 0.08, fakeName: 'Rangefinder Knock-Off',
    flavor: 'German glass, a red dot on the front. Photographers dream about these.',
  },
  {
    id: 'press_camera', name: '1950s Press Camera', family: 'camera', possibleName: 'Possible Press Camera', category: 'electronics', rarity: 'rare', baseValue: 780, variance: 0.35,
    dims: [0.2, 0.25, 0.18], weight: 2.5, model: 'press_camera', tags: ['cameras', 'antiques'], inspect: 'camera', expert: 'electronics',
    brokenChance: 0.2, repairCost: 90, cleanable: true, conditionSensitivity: 1.3,
    flavor: 'Bellows and a flash gun. Pure newsroom noir.',
  },
  {
    id: 'handheld', name: 'Brick Handheld Game System', family: 'console', category: 'electronics', rarity: 'uncommon', baseValue: 95, variance: 0.35,
    dims: [0.09, 0.15, 0.035], weight: 0.4, model: 'handheld', tags: ['retro_gaming'], inspect: 'console', expert: 'electronics',
    brokenChance: 0.3, repairCost: 25, cleanable: true, conditionSensitivity: 1.3,
    flavor: 'Green-tinted screen, four AA batteries, zero regrets.',
  },
  {
    id: 'console_16bit', name: '16-Bit Console Bundle', family: 'console', possibleName: 'Possible Retro Console', category: 'electronics', rarity: 'uncommon', baseValue: 150, variance: 0.35,
    dims: [0.3, 0.08, 0.22], weight: 1.5, model: 'console', tags: ['retro_gaming'], inspect: 'console', expert: 'electronics',
    brokenChance: 0.25, repairCost: 30, cleanable: true, conditionSensitivity: 1.2,
    flavor: 'Two controllers, a tangle of cables, a cartridge still inserted.',
  },
  {
    id: 'console_cib', name: 'Complete-in-Box 8-Bit Console', family: 'console', possibleName: 'Possible Boxed Retro Console', category: 'electronics', rarity: 'rare', baseValue: 980, variance: 0.3,
    dims: [0.38, 0.15, 0.28], weight: 2.5, model: 'console_box', modelParams: { sealed: false }, tags: ['retro_gaming'], inspect: 'console', expert: 'electronics',
    brokenChance: 0.1, repairCost: 40, conditionSensitivity: 1.5,
    flavor: 'Original box, styrofoam, manual and poster. Complete.',
  },
  {
    id: 'console_sealed', name: 'Factory-Sealed 1985 "Famicube" Launch Console', family: 'console', possibleName: 'Possible Sealed Launch Console', category: 'electronics', rarity: 'legendary', baseValue: 32000, variance: 0.2,
    dims: [0.38, 0.15, 0.28], weight: 2.5, model: 'console_box', modelParams: { sealed: true }, tags: ['retro_gaming'], inspect: 'console', expert: 'electronics',
    conditionWeights: [0, 0, 0, 2, 4, 5, 3], conditionSensitivity: 1.6, jackpot: true, collectorValue: 1.3,
    flavor: 'Never opened. Original shrink-wrap, launch-week sticker. A grail of retro gaming.',
  },

  // ── Music ────────────────────────────────────────────────────────────────
  {
    id: 'guitar_student', name: 'Student Acoustic Guitar', family: 'guitar', category: 'music', rarity: 'common', baseValue: 60, variance: 0.35,
    dims: [0.42, 1.05, 0.14], weight: 4, model: 'guitar_case', tags: ['music_gear'], inspect: 'music', expert: 'music',
    cleanable: true, leans: true,
    flavor: 'Nylon strings, a sticker of a band nobody remembers.',
  },
  {
    id: 'guitar_acoustic', name: 'Dreadnought Acoustic Guitar', family: 'guitar', possibleName: 'Possible Quality Acoustic', category: 'music', rarity: 'uncommon', baseValue: 390, variance: 0.35,
    dims: [0.42, 1.05, 0.14], weight: 5, model: 'guitar_case', tags: ['music_gear'], inspect: 'music', expert: 'music',
    cleanable: true, leans: true, conditionSensitivity: 1.1,
    flavor: 'Solid spruce top. It rings like a bell.',
  },
  {
    id: 'guitar_electric70', name: '1970s Electric Guitar', family: 'guitar', possibleName: 'Possible Vintage Electric', category: 'music', rarity: 'rare', baseValue: 1950, variance: 0.35,
    dims: [0.42, 1.05, 0.14], weight: 5, model: 'guitar_case', modelParams: { hard: true }, tags: ['music_gear'], inspect: 'music', expert: 'music',
    cleanable: true, leans: true, conditionSensitivity: 1.2, brokenChance: 0.2, repairCost: 150,
    bonus: { chance: 0.15, kind: 'provenance', mult: 1.8, label: 'Played on a hit record (documented)' },
    flavor: 'Original pickups, worn frets, pure seventies swagger.',
  },
  {
    id: 'guitar_sunburst', name: '1959 Sunburst Electric Guitar', family: 'guitar', possibleName: 'Possible Holy-Grail Guitar', category: 'music', rarity: 'epic', baseValue: 24000, variance: 0.3,
    dims: [0.42, 1.05, 0.14], weight: 5, model: 'guitar_case', modelParams: { hard: true, tweed: true }, tags: ['music_gear'], inspect: 'music', expert: 'music',
    fakeChance: 0.6, fakeValue: 0.04, fakeName: '1990s Sunburst Replica', cleanable: true, leans: true, conditionSensitivity: 1.3,
    flavor: 'Faded cherry sunburst, tweed case. If it is real, it is legendary.',
  },
  {
    id: 'amp', name: 'Guitar Amplifier', category: 'music', rarity: 'uncommon', baseValue: 230, variance: 0.35,
    dims: [0.5, 0.45, 0.26], weight: 14, model: 'amp', tags: ['music_gear'], inspect: 'electronics', expert: 'music',
    brokenChance: 0.25, repairCost: 70, cleanable: true, supportsStack: true,
    flavor: 'Tolex covering, chicken-head knobs, goes to eleven.',
  },
  {
    id: 'keyboard_home', name: 'Home Keyboard', family: 'keyboard', category: 'music', rarity: 'common', baseValue: 40, variance: 0.35,
    dims: [0.85, 0.12, 0.3], weight: 5, model: 'keyboard', modelParams: { style: 'home' }, tags: ['music_gear'], inspect: 'electronics', expert: 'music',
    brokenChance: 0.3, repairCost: 25, cleanable: true,
    flavor: '100 built-in rhythms, all of them bossa nova.',
  },
  {
    id: 'synth', name: '1970s Analog Synthesizer', family: 'keyboard', possibleName: 'Possible Vintage Synth', category: 'music', rarity: 'rare', baseValue: 1700, variance: 0.35,
    dims: [0.85, 0.12, 0.3], weight: 9, model: 'keyboard', modelParams: { style: 'synth' }, tags: ['music_gear', 'electronics'], inspect: 'electronics', expert: 'music',
    brokenChance: 0.35, repairCost: 220, cleanable: true, conditionSensitivity: 1.2,
    flavor: 'Wood cheeks, patch points, the sound of a thousand records.',
  },
  {
    id: 'vinyl_common', name: 'Crate of Easy-Listening LPs', family: 'vinyl', category: 'media', rarity: 'common', baseValue: 30, variance: 0.4,
    dims: [0.35, 0.33, 0.35], weight: 12, model: 'vinyl_crate', tags: ['vinyl'], inspect: 'paper', expert: 'music',
    conditionSensitivity: 1.1,
    flavor: 'Mantovani, Mantovani, and more Mantovani.',
  },
  {
    id: 'vinyl_rock', name: 'Classic Rock LP Collection', family: 'vinyl', possibleName: 'Possible Rock Collection', category: 'media', rarity: 'uncommon', baseValue: 280, variance: 0.4,
    dims: [0.35, 0.33, 0.35], weight: 12, model: 'vinyl_crate', tags: ['vinyl'], inspect: 'paper', expert: 'music',
    conditionSensitivity: 1.3, bonus: { chance: 0.1, kind: 'first_press', mult: 2.5, label: 'Contains original first pressings' },
    flavor: 'Gatefold sleeves and the smell of a teenage bedroom.',
  },
  {
    id: 'vinyl_rare', name: 'Rare Jazz Pressings', family: 'vinyl', possibleName: 'Possible Rare Pressings', category: 'media', rarity: 'rare', baseValue: 1500, variance: 0.4,
    dims: [0.35, 0.33, 0.35], weight: 12, model: 'vinyl_crate', modelParams: { jazz: true }, tags: ['vinyl'], inspect: 'paper', expert: 'music',
    conditionSensitivity: 1.5, bonus: { chance: 0.2, kind: 'first_press', mult: 2.2, label: 'Deep-groove original pressings' },
    flavor: 'Blue labels, deep grooves, collectors weep.',
  },

  // ── Tools ────────────────────────────────────────────────────────────────
  {
    id: 'drill_set', name: 'Cordless Drill Kit', category: 'tools', rarity: 'uncommon', baseValue: 150, variance: 0.3,
    dims: [0.45, 0.12, 0.35], weight: 4, model: 'drill_case', tags: ['tools'], inspect: 'tools', expert: null,
    brokenChance: 0.15, repairCost: 35, cleanable: true, conditionSensitivity: 0.8,
    flavor: 'Two batteries, one charger, a full bit set.',
  },
  {
    id: 'circular_saw', name: 'Circular Saw', category: 'tools', rarity: 'common', baseValue: 55, variance: 0.35,
    dims: [0.35, 0.25, 0.3], weight: 5, model: 'saw', tags: ['tools'], inspect: 'tools', expert: null,
    brokenChance: 0.2, repairCost: 20, cleanable: true, conditionSensitivity: 0.8,
    flavor: 'Blade guard intact. That is a good sign.',
  },
  {
    id: 'tool_chest', name: 'Rolling Tool Chest', category: 'tools', rarity: 'uncommon', baseValue: 340, variance: 0.3,
    dims: [0.7, 1.0, 0.45], weight: 60, model: 'tool_chest', tags: ['tools'], inspect: 'tools', expert: null,
    container: { kind: 'drawers', slots: [1, 4], maxItemVolume: 0.02, lootBias: { tools: 25 } },
    supportsStack: true, cleanable: true, conditionSensitivity: 0.7,
    flavor: 'Ball-bearing drawers. Mechanics would sell a kidney for one.',
  },
  {
    id: 'socket_set', name: 'Pro Mechanic\'s Socket Set', category: 'tools', rarity: 'rare', baseValue: 850, variance: 0.3,
    dims: [0.6, 0.1, 0.3], weight: 12, model: 'socket_set', tags: ['tools'], inspect: 'tools', expert: null,
    cleanable: true, conditionSensitivity: 0.7,
    flavor: 'Chrome-vanadium, lifetime warranty, every size present.',
  },

  // ── Sports ───────────────────────────────────────────────────────────────
  {
    id: 'bike_kid', name: 'Kid\'s Bicycle', category: 'sports', rarity: 'common', baseValue: 30, variance: 0.4,
    dims: [1.2, 0.7, 0.4], weight: 9, model: 'bicycle', modelParams: { kid: true }, tags: ['sports'], inspect: 'generic', expert: null,
    cleanable: true, sparse: true, conditionSensitivity: 0.7,
    flavor: 'Streamers on the handlebars, training wheels in the basket.',
  },
  {
    id: 'bike_mtb', name: 'Mountain Bike', category: 'sports', rarity: 'uncommon', baseValue: 290, variance: 0.35,
    dims: [1.7, 1.0, 0.55], weight: 14, model: 'bicycle', tags: ['sports'], inspect: 'generic', expert: null,
    brokenChance: 0.2, repairCost: 45, cleanable: true, sparse: true, conditionSensitivity: 0.9,
    flavor: 'Front suspension, flat tyres, great bones.',
  },
  {
    id: 'golf_bag', name: 'Golf Club Set', category: 'sports', rarity: 'uncommon', baseValue: 200, variance: 0.35,
    dims: [0.35, 1.1, 0.3], weight: 12, model: 'golf_bag', tags: ['sports'], inspect: 'generic', expert: null,
    cleanable: true, leans: true, conditionSensitivity: 0.8,
    flavor: 'Forged irons, a driver with a sock on it.',
  },
  {
    id: 'skis', name: 'Vintage Wooden Skis', category: 'sports', rarity: 'common', baseValue: 55, variance: 0.4,
    dims: [0.2, 1.8, 0.12], weight: 5, model: 'skis', tags: ['sports', 'antiques'], inspect: 'generic', expert: null,
    cleanable: true, leans: true,
    flavor: 'Cable bindings. Hipster cabin decor gold.',
  },
  {
    id: 'dumbbells', name: 'Dumbbell Set', category: 'sports', rarity: 'common', baseValue: 45, variance: 0.3,
    dims: [0.45, 0.15, 0.2], weight: 30, model: 'dumbbells', tags: ['sports'], inspect: 'generic', expert: null,
    conditionSensitivity: 0.3,
    flavor: 'New Year\'s resolution, abandoned by February.',
  },
  {
    id: 'ball_souvenir', name: 'Souvenir Baseball', family: 'baseball', category: 'collectibles', rarity: 'common', baseValue: 12, variance: 0.4,
    dims: [0.1, 0.1, 0.1], weight: 0.3, model: 'baseball', tags: ['sports'], inspect: 'paper', expert: 'collectibles',
    flavor: 'Gift-shop ball with a printed team logo.',
  },
  {
    id: 'ball_signed', name: 'Signed Home-Run Ball', family: 'baseball', possibleName: 'Possible Signed Ball', category: 'collectibles', rarity: 'rare', baseValue: 2500, variance: 0.4,
    dims: [0.1, 0.1, 0.1], weight: 0.3, model: 'baseball', modelParams: { signed: true }, tags: ['sports', 'comics_cards'], inspect: 'paper', expert: 'collectibles',
    fakeChance: 0.4, fakeValue: 0.01, fakeName: 'Ball with Forged Signature', conditionSensitivity: 1.2,
    flavor: 'Faded ink on the sweet spot, a stadium date written underneath.',
  },

  // ── Fashion ──────────────────────────────────────────────────────────────
  {
    id: 'leather_jacket', name: 'Leather Biker Jacket', category: 'fashion', rarity: 'uncommon', baseValue: 130, variance: 0.4,
    dims: [0.45, 0.1, 0.35], weight: 2, model: 'jacket', tags: ['fashion'], inspect: 'fashion', expert: null,
    cleanable: true, conditionSensitivity: 0.9,
    flavor: 'Broken in exactly right. Smells like highway.',
  },
  {
    id: 'handbag_plain', name: 'Everyday Handbag', family: 'handbag', category: 'fashion', rarity: 'common', baseValue: 25, variance: 0.4,
    dims: [0.35, 0.26, 0.14], weight: 1, model: 'handbag', tags: ['fashion'], inspect: 'fashion', expert: 'collectibles',
    cleanable: true,
    flavor: 'Faux leather, a receipt from 2011 inside.',
  },
  {
    id: 'handbag_designer', name: 'Maison Vélin Handbag', family: 'handbag', possibleName: 'Possible Designer Bag', category: 'fashion', rarity: 'rare', baseValue: 1700, variance: 0.3,
    dims: [0.35, 0.26, 0.14], weight: 1, model: 'handbag', modelParams: { designer: true }, tags: ['fashion'], inspect: 'fashion', expert: 'collectibles',
    fakeChance: 0.6, fakeValue: 0.02, fakeName: 'Counterfeit Maison Vélin Bag', cleanable: true, conditionSensitivity: 1.2,
    flavor: 'Monogram canvas, brass hardware, a heat-stamped date code.',
  },
  {
    id: 'sneakers_used', name: 'Worn-Out Sneakers', family: 'sneakers', category: 'fashion', rarity: 'common', baseValue: 12, variance: 0.4,
    dims: [0.35, 0.13, 0.22], weight: 1, model: 'shoebox', tags: ['fashion'], inspect: 'fashion', expert: 'collectibles',
    cleanable: true,
    flavor: 'They have run their last marathon.',
  },
  {
    id: 'sneakers_limited', name: 'Limited 1985 "Air Dunkers"', family: 'sneakers', possibleName: 'Possible Rare Sneakers', category: 'fashion', rarity: 'rare', baseValue: 1300, variance: 0.35,
    dims: [0.35, 0.13, 0.22], weight: 1, model: 'shoebox', modelParams: { hype: true }, tags: ['fashion'], inspect: 'fashion', expert: 'collectibles',
    fakeChance: 0.35, fakeValue: 0.03, fakeName: 'Replica "Air Dunkers"', cleanable: true, conditionSensitivity: 1.5,
    flavor: 'Original box, original laces, the colourway everyone wanted in 1985.',
  },

  // ── Watches & jewelry ────────────────────────────────────────────────────
  {
    id: 'watch_quartz', name: 'Quartz Fashion Watch', family: 'watch', category: 'jewelry', rarity: 'common', baseValue: 25, variance: 0.4,
    dims: [0.06, 0.03, 0.2], weight: 0.1, model: 'watch', modelParams: { style: 'quartz' }, tags: ['watches'], inspect: 'watch', expert: 'watchmaker',
    brokenChance: 0.4, repairCost: 10, cleanable: true,
    flavor: 'Battery dead, charm intact.',
  },
  {
    id: 'watch_vintage', name: '1960s Mechanical Dress Watch', family: 'watch', possibleName: 'Possible Vintage Watch', category: 'jewelry', rarity: 'rare', baseValue: 1500, variance: 0.35,
    dims: [0.06, 0.03, 0.2], weight: 0.1, model: 'watch', modelParams: { style: 'vintage' }, tags: ['watches', 'antiques'], inspect: 'watch', expert: 'watchmaker',
    brokenChance: 0.3, repairCost: 180, cleanable: true, conditionSensitivity: 1.4,
    flavor: 'Hand-wound, cream dial, crocodile strap. A collector watch.',
  },
  {
    id: 'watch_luxury', name: 'Kronhaus Submariner', family: 'watch', possibleName: 'Possible Luxury Diver', category: 'jewelry', rarity: 'epic', baseValue: 7800, variance: 0.3,
    dims: [0.06, 0.03, 0.2], weight: 0.15, model: 'watch', modelParams: { style: 'diver' }, tags: ['watches'], inspect: 'watch', expert: 'watchmaker',
    fakeChance: 0.55, fakeValue: 0.012, fakeName: 'Fake "Kronhaus" Diver', brokenChance: 0.1, repairCost: 400, cleanable: true, conditionSensitivity: 1.3,
    flavor: 'Black bezel, oyster bracelet, the crown logo everyone knows.',
  },
  {
    id: 'watch_jackpot', name: '1968 Kronhaus "Racing Dial" Chronograph', family: 'watch', possibleName: 'Possible Collector Chronograph', category: 'jewelry', rarity: 'legendary', baseValue: 95000, variance: 0.25,
    dims: [0.06, 0.03, 0.2], weight: 0.15, model: 'watch', modelParams: { style: 'chrono' }, tags: ['watches'], inspect: 'watch', expert: 'watchmaker',
    conditionWeights: [0, 0, 1, 3, 4, 3, 1], conditionSensitivity: 1.3, jackpot: true, collectorValue: 1.25,
    flavor: 'Exotic dial, pump pushers, original bracelet. Auction houses fight over these.',
  },
  {
    id: 'pw_brass', name: 'Brass Pocket Watch', family: 'pocket_watch', category: 'jewelry', rarity: 'uncommon', baseValue: 110, variance: 0.4,
    dims: [0.06, 0.02, 0.07], weight: 0.12, model: 'pocket_watch', modelParams: { gold: false }, tags: ['watches', 'antiques'], inspect: 'watch', expert: 'watchmaker',
    brokenChance: 0.5, repairCost: 60, cleanable: true,
    flavor: 'Railroad style, a chain with a fob.',
  },
  {
    id: 'pw_gold', name: 'Antique Gold Pocket Watch', family: 'pocket_watch', possibleName: 'Possible Gold Pocket Watch', category: 'jewelry', rarity: 'rare', baseValue: 1250, variance: 0.35,
    dims: [0.06, 0.02, 0.07], weight: 0.12, model: 'pocket_watch', modelParams: { gold: true }, tags: ['watches', 'antiques', 'jewelry'], inspect: 'watch', expert: 'watchmaker',
    fakeChance: 0.2, fakeValue: 0.12, fakeName: 'Gold-Plated Pocket Watch', brokenChance: 0.4, repairCost: 150, cleanable: true, conditionSensitivity: 1.2,
    flavor: '14k hunter case with an engraved dedication from 1911.',
  },
  {
    id: 'costume_jewelry', name: 'Costume Jewelry', family: 'jewelry', category: 'jewelry', rarity: 'common', baseValue: 15, variance: 0.5,
    dims: [0.06, 0.03, 0.06], weight: 0.05, model: 'jewelry', modelParams: { style: 'costume' }, tags: ['jewelry'], inspect: 'jewelry', expert: 'watchmaker',
    cleanable: true,
    flavor: 'Glass beads and gold-tone chain.',
  },
  {
    id: 'silver_necklace', name: 'Sterling Silver Necklace', family: 'jewelry', possibleName: 'Possible Silver Necklace', category: 'jewelry', rarity: 'uncommon', baseValue: 150, variance: 0.4,
    dims: [0.06, 0.03, 0.06], weight: 0.05, model: 'jewelry', modelParams: { style: 'necklace' }, tags: ['jewelry'], inspect: 'jewelry', expert: 'watchmaker',
    cleanable: true,
    flavor: 'Hallmarked .925, a little tarnished.',
  },
  {
    id: 'gold_ring', name: 'Gold Ring with Sapphire', family: 'jewelry', possibleName: 'Possible Gold Ring', category: 'jewelry', rarity: 'rare', baseValue: 1350, variance: 0.4,
    dims: [0.06, 0.03, 0.06], weight: 0.05, model: 'jewelry', modelParams: { style: 'ring' }, tags: ['jewelry'], inspect: 'jewelry', expert: 'watchmaker',
    fakeChance: 0.3, fakeValue: 0.03, fakeName: 'Gold-Plated Ring with Glass Stone', cleanable: true,
    flavor: 'Deep blue stone in a heavy yellow-gold setting.',
  },
  {
    id: 'deco_brooch', name: 'Art Deco Diamond Brooch', family: 'jewelry', possibleName: 'Possible Diamond Brooch', category: 'jewelry', rarity: 'epic', baseValue: 5400, variance: 0.35,
    dims: [0.06, 0.03, 0.06], weight: 0.05, model: 'jewelry', modelParams: { style: 'brooch' }, tags: ['jewelry', 'antiques'], inspect: 'jewelry', expert: 'watchmaker',
    fakeChance: 0.4, fakeValue: 0.03, fakeName: 'Brooch with Paste Stones', cleanable: true, conditionSensitivity: 1.1,
    flavor: 'Platinum filigree, old-cut stones that throw fire.',
  },

  // ── Collectibles ─────────────────────────────────────────────────────────
  {
    id: 'comics_modern', name: 'Box of 90s Comics', family: 'comics', category: 'collectibles', rarity: 'common', baseValue: 45, variance: 0.4,
    dims: [0.3, 0.28, 0.7], weight: 12, model: 'comic_box', tags: ['comics_cards'], inspect: 'paper', expert: 'collectibles',
    conditionSensitivity: 1.2,
    flavor: 'Holofoil variant covers. Printed by the million.',
  },
  {
    id: 'comics_silver', name: 'Silver Age Comic Run', family: 'comics', possibleName: 'Possible Silver Age Comics', category: 'collectibles', rarity: 'rare', baseValue: 1900, variance: 0.45,
    dims: [0.3, 0.28, 0.7], weight: 12, model: 'comic_box', modelParams: { old: true }, tags: ['comics_cards'], inspect: 'paper', expert: 'collectibles',
    conditionSensitivity: 1.6, bonus: { chance: 0.12, kind: 'rare_variant', mult: 2.5, label: 'Includes a key first appearance' },
    flavor: '12-cent cover prices and bright, crisp pages.',
  },
  {
    id: 'comic_reprint', name: 'Facsimile Reprint Comic', family: 'comic_single', category: 'collectibles', rarity: 'common', baseValue: 6, variance: 0.3,
    dims: [0.18, 0.012, 0.26], weight: 0.1, model: 'comic', modelParams: { reprint: true }, tags: ['comics_cards'], inspect: 'paper', expert: 'collectibles',
    flavor: 'Modern paper, modern staples. A reprint of a classic.',
  },
  {
    id: 'comic_golden', name: '1940s Golden Age Comic', family: 'comic_single', possibleName: 'Possible Golden Age Comic', category: 'collectibles', rarity: 'rare', baseValue: 900, variance: 0.45,
    dims: [0.18, 0.012, 0.26], weight: 0.1, model: 'comic', tags: ['comics_cards'], inspect: 'paper', expert: 'collectibles',
    conditionSensitivity: 1.7,
    flavor: 'Ten cents, war-time adverts, brittle beautiful pulp.',
  },
  {
    id: 'comic_jackpot', name: '"Astounding Tales" #1 (1938)', family: 'comic_single', possibleName: 'Possible Golden Age Key Issue', category: 'collectibles', rarity: 'legendary', baseValue: 150000, variance: 0.3,
    dims: [0.18, 0.012, 0.26], weight: 0.1, model: 'comic', modelParams: { key: true }, tags: ['comics_cards'], inspect: 'paper', expert: 'collectibles',
    conditionWeights: [0, 1, 3, 4, 2, 1, 0], conditionSensitivity: 1.8, jackpot: true, collectorValue: 1.2,
    flavor: 'The first appearance of the Comet. Fewer than a hundred copies are known.',
  },
  {
    id: 'cards_common', name: 'Binder of Trading Cards', family: 'cards', category: 'collectibles', rarity: 'common', baseValue: 30, variance: 0.4,
    dims: [0.3, 0.06, 0.32], weight: 1.5, model: 'binder', tags: ['comics_cards'], inspect: 'paper', expert: 'collectibles',
    conditionSensitivity: 1.3,
    flavor: 'Commons, doubles and a lot of energy cards.',
  },
  {
    id: 'cards_holo', name: 'First-Edition Holo Card Collection', family: 'cards', possibleName: 'Possible Holo Collection', category: 'collectibles', rarity: 'epic', baseValue: 3800, variance: 0.4,
    dims: [0.3, 0.06, 0.32], weight: 1.5, model: 'binder', modelParams: { holo: true }, tags: ['comics_cards'], inspect: 'paper', expert: 'collectibles',
    fakeChance: 0.3, fakeValue: 0.02, fakeName: 'Counterfeit Holo Cards', conditionSensitivity: 1.8,
    flavor: 'First-edition stamps, shadowless borders, holofoil that still pops.',
  },
  {
    id: 'coin_jar', name: 'Jar of Foreign Coins', family: 'coins', category: 'collectibles', rarity: 'common', baseValue: 25, variance: 0.4,
    dims: [0.14, 0.2, 0.14], weight: 3, model: 'coin_jar', tags: ['coins'], inspect: 'coins', expert: 'collectibles',
    flavor: 'Holiday change from a dozen countries.',
  },
  {
    id: 'coin_album', name: 'Silver Dollar Album', family: 'coins', possibleName: 'Possible Silver Coin Album', category: 'collectibles', rarity: 'rare', baseValue: 1300, variance: 0.4,
    dims: [0.28, 0.04, 0.3], weight: 2, model: 'coin_album', tags: ['coins'], inspect: 'coins', expert: 'collectibles',
    cleaningHurts: true, conditionSensitivity: 1.5,
    flavor: 'Morgan dollars in a blue folder, dates from 1878 on. Never clean old coins.',
  },
  {
    id: 'coin_token', name: 'Casino Token', family: 'gold_coin', category: 'collectibles', rarity: 'common', baseValue: 5, variance: 0.4,
    dims: [0.05, 0.012, 0.05], weight: 0.02, model: 'coin', modelParams: { gold: false }, tags: ['coins'], inspect: 'coins', expert: 'collectibles',
    flavor: 'A souvenir chip from a casino that closed years ago.',
  },
  {
    id: 'gold_coin', name: '1907 Gold Double Eagle', family: 'gold_coin', possibleName: 'Possible Gold Coin', category: 'collectibles', rarity: 'epic', baseValue: 4200, variance: 0.3,
    dims: [0.05, 0.012, 0.05], weight: 0.03, model: 'coin', modelParams: { gold: true }, tags: ['coins', 'jewelry'], inspect: 'coins', expert: 'collectibles',
    fakeChance: 0.25, fakeValue: 0.01, fakeName: 'Gold-Plated Replica Coin', cleaningHurts: true, conditionSensitivity: 1.4,
    flavor: 'Liberty striding across a sunrise. One ounce of history.',
  },
  {
    id: 'toy_plastic', name: 'Plastic Toy Robot', family: 'toy', category: 'toys', rarity: 'common', baseValue: 8, variance: 0.4,
    dims: [0.14, 0.25, 0.1], weight: 0.3, model: 'robot', modelParams: { tin: false }, tags: ['comics_cards'], inspect: 'generic', expert: 'collectibles',
    cleanable: true,
    flavor: 'Batteries not included, arm missing.',
  },
  {
    id: 'toy_tin', name: '1950s Tin Wind-Up Robot', family: 'toy', possibleName: 'Possible Tin Toy', category: 'toys', rarity: 'rare', baseValue: 1050, variance: 0.4,
    dims: [0.14, 0.25, 0.1], weight: 0.5, model: 'robot', modelParams: { tin: true }, tags: ['comics_cards', 'antiques'], inspect: 'generic', expert: 'collectibles',
    brokenChance: 0.4, repairCost: 90, cleanable: true, conditionSensitivity: 1.5,
    flavor: 'Lithographed tin, sparking chest, made in Japan.',
  },
  {
    id: 'poster_print', name: 'Framed Art Print', family: 'poster', category: 'art', rarity: 'common', baseValue: 20, variance: 0.4,
    dims: [0.7, 1.0, 0.04], weight: 4, model: 'poster', modelParams: { kind: 'print' }, tags: ['art'], inspect: 'art', expert: 'antiques',
    cleanable: true, leans: true,
    flavor: 'Water lilies, as seen in every dentist\'s office.',
  },
  {
    id: 'poster_movie', name: 'Vintage Movie Poster', family: 'poster', possibleName: 'Possible Original Poster', category: 'art', rarity: 'uncommon', baseValue: 280, variance: 0.45,
    dims: [0.7, 1.0, 0.04], weight: 4, model: 'poster', modelParams: { kind: 'movie' }, tags: ['art', 'comics_cards'], inspect: 'art', expert: 'collectibles',
    cleanable: true, leans: true, conditionSensitivity: 1.3,
    flavor: 'Linen-backed, a B-movie with a giant ant.',
  },
  {
    id: 'poster_signed', name: 'Signed Concert Poster', family: 'poster', possibleName: 'Possible Signed Poster', category: 'art', rarity: 'rare', baseValue: 1600, variance: 0.45,
    dims: [0.7, 1.0, 0.04], weight: 4, model: 'poster', modelParams: { kind: 'concert' }, tags: ['art', 'music_gear'], inspect: 'art', expert: 'collectibles',
    fakeChance: 0.45, fakeValue: 0.1, fakeName: 'Poster with Fake Autographs', cleanable: true, leans: true, conditionSensitivity: 1.3,
    flavor: 'Four band members, four signatures, one legendary night.',
  },

  // ── Art & antiques ───────────────────────────────────────────────────────
  {
    id: 'painting_hotel', name: 'Hotel-Room Landscape Print', family: 'painting', category: 'art', rarity: 'common', baseValue: 20, variance: 0.4,
    dims: [0.8, 0.65, 0.05], weight: 4, model: 'painting', modelParams: { style: 'landscape_print' }, tags: ['art'], inspect: 'art', expert: 'antiques',
    cleanable: true, leans: true,
    flavor: 'A mountain lake, mass-produced with love.',
  },
  {
    id: 'painting_oil', name: 'Regional Oil Landscape', family: 'painting', possibleName: 'Possible Original Oil', category: 'art', rarity: 'uncommon', baseValue: 480, variance: 0.5,
    dims: [0.8, 0.65, 0.05], weight: 5, model: 'painting', modelParams: { style: 'landscape_oil' }, tags: ['art'], inspect: 'art', expert: 'antiques',
    cleanable: true, leans: true,
    flavor: 'Thick impasto, a signature in the corner, a gallery label on the back.',
  },
  {
    id: 'painting_portrait', name: '19th-Century Oil Portrait', family: 'painting', possibleName: 'Possible Antique Portrait', category: 'art', rarity: 'rare', baseValue: 3400, variance: 0.5,
    dims: [0.8, 0.65, 0.05], weight: 6, model: 'painting', modelParams: { style: 'portrait' }, tags: ['art', 'antiques'], inspect: 'art', expert: 'antiques',
    fakeChance: 0.45, fakeValue: 0.06, fakeName: 'Later Copy of an Old Portrait', cleaningHurts: true, leans: true, conditionSensitivity: 1.1,
    flavor: 'A stern gentleman in a gilt frame, craquelure across the varnish. Amateur cleaning ruins old paintings.',
  },
  {
    id: 'painting_modern', name: 'Abstract Canvas by R. Voss', family: 'painting', possibleName: 'Possible Signed Abstract', category: 'art', rarity: 'epic', baseValue: 9500, variance: 0.5,
    dims: [0.8, 0.65, 0.05], weight: 5, model: 'painting', modelParams: { style: 'abstract' }, tags: ['art', 'mid_century'], inspect: 'art', expert: 'antiques',
    fakeChance: 0.5, fakeValue: 0.02, fakeName: 'Decorator\'s Copy "after R. Voss"', leans: true, conditionSensitivity: 1.1,
    flavor: 'Bold colour fields, signed and dated 1962 on the stretcher.',
  },
  {
    id: 'vase_decor', name: 'Decorative Vase', family: 'vase', category: 'art', rarity: 'common', baseValue: 22, variance: 0.4,
    dims: [0.25, 0.45, 0.25], weight: 3, model: 'vase', modelParams: { style: 'decor' }, tags: ['household'], inspect: 'art', expert: 'antiques',
    cleanable: true,
    flavor: 'Blue and white, made last decade.',
  },
  {
    id: 'vase_qing', name: 'Qing Dynasty Porcelain Vase', family: 'vase', possibleName: 'Possible Antique Porcelain', category: 'art', rarity: 'epic', baseValue: 6800, variance: 0.5,
    dims: [0.25, 0.45, 0.25], weight: 3, model: 'vase', modelParams: { style: 'qing' }, tags: ['art', 'antiques'], inspect: 'art', expert: 'antiques',
    fakeChance: 0.5, fakeValue: 0.01, fakeName: 'Modern Reproduction Vase', cleanable: true, conditionSensitivity: 1.4,
    flavor: 'Cobalt dragons, a six-character reign mark on the base.',
  },
  {
    id: 'rug_synthetic', name: 'Synthetic Area Rug', family: 'rug', category: 'furniture', rarity: 'common', baseValue: 35, variance: 0.4,
    dims: [0.3, 1.8, 0.3], weight: 10, model: 'rug_roll', tags: ['household'], inspect: 'fashion', expert: 'antiques',
    cleanable: true, leans: true,
    flavor: 'Beige. Aggressively beige.',
  },
  {
    id: 'rug_persian', name: 'Hand-Knotted Persian Rug', family: 'rug', possibleName: 'Possible Hand-Knotted Rug', category: 'furniture', rarity: 'rare', baseValue: 2300, variance: 0.45,
    dims: [0.3, 1.8, 0.3], weight: 14, model: 'rug_roll', modelParams: { persian: true }, tags: ['antiques'], inspect: 'fashion', expert: 'antiques',
    fakeChance: 0.35, fakeValue: 0.06, fakeName: 'Machine-Made Copy Rug', cleanable: true, leans: true,
    flavor: 'Wool on cotton, deep madder reds, knots you can count on the back.',
  },

  // ── Furniture ────────────────────────────────────────────────────────────
  {
    id: 'chair_wood', name: 'Old Wooden Chair', category: 'furniture', rarity: 'common', baseValue: 25, variance: 0.4,
    dims: [0.45, 0.9, 0.45], weight: 6, model: 'chair', tags: ['household'], inspect: 'furniture', expert: 'antiques',
    cleanable: true, sparse: true, conditionSensitivity: 0.7,
    flavor: 'A kitchen chair with a wobble.',
  },
  {
    id: 'side_table', name: 'Side Table', category: 'furniture', rarity: 'common', baseValue: 30, variance: 0.4,
    dims: [0.5, 0.55, 0.4], weight: 7, model: 'side_table', tags: ['household'], inspect: 'furniture', expert: 'antiques',
    cleanable: true, supportsStack: true, sparse: true, conditionSensitivity: 0.7,
    flavor: 'Coaster rings on the veneer.',
  },
  {
    id: 'armchair_worn', name: 'Worn Armchair', family: 'armchair', category: 'furniture', rarity: 'common', baseValue: 40, variance: 0.4,
    dims: [0.8, 0.9, 0.8], weight: 20, model: 'armchair', modelParams: { style: 'worn' }, tags: ['household'], inspect: 'furniture', expert: 'antiques',
    cleanable: true, conditionSensitivity: 0.6,
    flavor: 'Floral upholstery and a permanent dent.',
  },
  {
    id: 'lounge_chair', name: 'Mid-Century Lounge Chair', family: 'armchair', possibleName: 'Possible Designer Chair', category: 'furniture', rarity: 'epic', baseValue: 5200, variance: 0.3,
    dims: [0.85, 0.85, 0.85], weight: 30, model: 'armchair', modelParams: { style: 'lounge' }, tags: ['mid_century'], inspect: 'furniture', expert: 'antiques',
    fakeChance: 0.5, fakeValue: 0.12, fakeName: 'Unlicensed Lounge Chair Replica', cleanable: true, conditionSensitivity: 1.0,
    flavor: 'Moulded rosewood plywood and black leather. A design icon.',
  },
  {
    id: 'dresser_plain', name: 'Plain Pine Dresser', family: 'dresser', category: 'furniture', rarity: 'common', baseValue: 80, variance: 0.4,
    dims: [1.0, 1.1, 0.48], weight: 40, model: 'dresser', modelParams: { style: 'plain' }, tags: ['household'], inspect: 'furniture', expert: 'antiques',
    container: { kind: 'drawers', slots: [0, 4], maxItemVolume: 0.02, lootBias: { fashion: 5, documents: 4, jewelry: 2 }, secretChance: 0.03 },
    cleanable: true, supportsStack: true, conditionSensitivity: 0.7,
    flavor: 'Flat-pack era pine with sticky drawers.',
  },
  {
    id: 'dresser_antique', name: 'Victorian Walnut Dresser', family: 'dresser', possibleName: 'Possible Antique Dresser', category: 'furniture', rarity: 'rare', baseValue: 1800, variance: 0.4,
    dims: [1.0, 1.1, 0.48], weight: 55, model: 'dresser', modelParams: { style: 'antique' }, tags: ['antiques'], inspect: 'furniture', expert: 'antiques',
    container: { kind: 'drawers', slots: [0, 4], maxItemVolume: 0.02, lootBias: { documents: 5, jewelry: 5, collectibles: 3 }, secretChance: 0.16 },
    cleanable: true, supportsStack: true, conditionSensitivity: 0.8,
    flavor: 'Burl walnut, carved pulls, dovetailed drawers. Cabinetmakers often hid a compartment.',
  },

  // ── Trash ────────────────────────────────────────────────────────────────
  {
    id: 'trash_bag', name: 'Bag of Old Clothes', category: 'trash', rarity: 'common', baseValue: 0, variance: 0,
    dims: [0.5, 0.5, 0.4], weight: 4, model: 'trash_bag', tags: [], inspect: 'generic', expert: null,
    flavor: 'Mothballs and regret.',
  },
  {
    id: 'mattress', name: 'Stained Mattress', category: 'trash', rarity: 'common', baseValue: 0, variance: 0,
    dims: [1.4, 1.9, 0.22], weight: 20, model: 'mattress', tags: [], inspect: 'generic', expert: null, leans: true,
    flavor: 'Do not think about it. Just do not.',
  },
  {
    id: 'broken_chair', name: 'Broken Chair', category: 'trash', rarity: 'common', baseValue: 0, variance: 0,
    dims: [0.45, 0.6, 0.45], weight: 4, model: 'broken_chair', tags: [], inspect: 'generic', expert: null, sparse: true,
    flavor: 'Three legs and a dream.',
  },
  {
    id: 'paint_cans', name: 'Dried-Out Paint Cans', category: 'trash', rarity: 'common', baseValue: 0, variance: 0,
    dims: [0.35, 0.2, 0.2], weight: 6, model: 'paint_cans', tags: [], inspect: 'generic', expert: null,
    flavor: 'Eggshell white, rock solid.',
  },
  {
    id: 'tire', name: 'Old Tire', category: 'trash', rarity: 'common', baseValue: 0, variance: 0,
    dims: [0.65, 0.2, 0.65], weight: 8, model: 'tire', tags: [], inspect: 'generic', expert: null,
    flavor: 'Bald as a billiard ball.',
  },
  {
    id: 'junk_electronics', name: 'Box of Tangled Cables', category: 'trash', rarity: 'common', baseValue: 1, variance: 0.5,
    dims: [0.4, 0.25, 0.3], weight: 5, model: 'cables', tags: [], inspect: 'generic', expert: null,
    flavor: 'Every charger for every phone that ever existed.',
  },

  // ── Documents, cash & story items ────────────────────────────────────────
  {
    id: 'old_papers', name: 'Bundle of Old Documents', category: 'documents', rarity: 'common', baseValue: 4, variance: 0.5,
    dims: [0.25, 0.05, 0.18], weight: 0.5, model: 'papers', tags: [], inspect: 'document', expert: null,
    flavor: 'Tax returns, warranty cards, a recipe for meatloaf.',
  },
  {
    id: 'savings_bonds', name: 'Matured Savings Bonds', category: 'documents', rarity: 'rare', baseValue: 900, variance: 0.5,
    dims: [0.25, 0.03, 0.18], weight: 0.2, model: 'papers', modelParams: { bonds: true }, tags: [], inspect: 'document', expert: null,
    demand: 1,
    flavor: 'Face value plus forty years of interest. The bank will honour them.',
  },
  {
    id: 'cash', name: 'Bundle of Cash', category: 'documents', rarity: 'rare', baseValue: 600, variance: 0.8,
    dims: [0.16, 0.04, 0.08], weight: 0.2, model: 'cash', tags: [], inspect: 'document', expert: null, special: true,
    flavor: 'Rubber-banded bills. Finders keepers.',
  },
  {
    id: 'film_rolls', name: 'Undeveloped Film Rolls', category: 'documents', rarity: 'unique', baseValue: 15, variance: 0.2,
    dims: [0.12, 0.05, 0.08], weight: 0.2, model: 'film_rolls', tags: ['cameras'], inspect: 'document', expert: null,
    quest: 'photographer', special: true,
    flavor: 'Six canisters labelled "E.M. — do not open in light".',
  },
  {
    id: 'press_pass', name: '1971 Press Pass', category: 'documents', rarity: 'unique', baseValue: 40, variance: 0.2,
    dims: [0.1, 0.012, 0.07], weight: 0.05, model: 'press_pass', tags: [], inspect: 'document', expert: null,
    quest: 'photographer', special: true,
    flavor: '"Daily Courier — Evelyn Marlow, Staff Photographer."',
  },
  {
    id: 'letters', name: 'Bundle of Letters', category: 'documents', rarity: 'unique', baseValue: 20, variance: 0.2,
    dims: [0.18, 0.05, 0.12], weight: 0.3, model: 'letters', tags: [], inspect: 'document', expert: null,
    quest: 'photographer', special: true,
    flavor: 'Tied with red ribbon, all addressed to "Evie".',
  },
  {
    id: 'camera_bag', name: 'Monogrammed Camera Bag', category: 'fashion', rarity: 'unique', baseValue: 60, variance: 0.2,
    dims: [0.3, 0.2, 0.15], weight: 1, model: 'camera_bag', tags: ['cameras'], inspect: 'fashion', expert: null,
    quest: 'photographer', special: true,
    flavor: 'Brown leather, brass initials: E. M.',
  },
  {
    id: 'marlow_camera', name: 'Evelyn Marlow\'s Rangefinder', category: 'electronics', rarity: 'mythic', baseValue: 12000, variance: 0.05,
    dims: [0.14, 0.08, 0.06], weight: 0.6, model: 'camera', modelParams: { style: 'rangefinder', engraved: true }, tags: ['cameras'], inspect: 'camera', expert: 'electronics',
    special: true, conditionWeights: [0, 0, 0, 0, 1, 0, 0],
    flavor: 'The camera behind the most famous photographs of 1971, engraved "E.M." on the top plate.',
  },
  {
    id: 'marlow_archive', name: 'The Marlow Archive', category: 'art', rarity: 'mythic', baseValue: 18000, variance: 0.05,
    dims: [0.45, 0.3, 0.35], weight: 6, model: 'archive_box', tags: ['art', 'cameras'], inspect: 'document', expert: 'antiques',
    special: true, conditionWeights: [0, 0, 0, 1, 0, 0, 0],
    flavor: 'Negatives, contact sheets and letters of a forgotten photojournalist. Museums would kill for it.',
  },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(defs.map((d) => [d.id, d]));
export const ITEM_LIST: ItemDef[] = defs;

export function itemDef(id: string): ItemDef {
  const d = ITEMS[id];
  if (!d) throw new Error(`Unknown item def: ${id}`);
  return d;
}

export function volumeOf(def: ItemDef): number {
  return def.dims[0] * def.dims[1] * def.dims[2];
}

/** Defs that loot tables may produce. */
export function lootable(): ItemDef[] {
  return ITEM_LIST.filter((d) => !d.special && d.category !== 'container' && d.category !== 'trash');
}

export function familyMembers(family: string): ItemDef[] {
  return ITEM_LIST.filter((d) => d.family === family && !d.special);
}

export const CATEGORY_NAMES: Record<Category, string> = {
  furniture: 'Furniture', electronics: 'Electronics', tools: 'Tools', collectibles: 'Collectibles', jewelry: 'Jewelry & Watches',
  art: 'Art', music: 'Music', sports: 'Sports', household: 'Household', fashion: 'Fashion', media: 'Books & Records',
  toys: 'Toys', documents: 'Documents', container: 'Containers', trash: 'Junk',
};

export const RARITY_NAMES: Record<Rarity, string> = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic', unique: 'Unique',
};
