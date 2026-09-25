import type { BuyerPersonality, Category, ExpertId, TrendTag } from '../core/types';

export interface ExpertDef {
  id: ExpertId;
  name: string;
  title: string;
  categories: Category[];
  families: string[];
  feeMult: number;
  quote: string;
}

export const EXPERTS: ExpertDef[] = [
  {
    id: 'watchmaker', name: 'Otto Brandt', title: 'Watchmaker & Jeweler', categories: ['jewelry'],
    families: ['watch', 'pocket_watch', 'jewelry'], feeMult: 1.2,
    quote: 'Show me the movement and I will tell you its whole life.',
  },
  {
    id: 'antiques', name: 'Beatrice Holloway', title: 'Antiques & Fine Art', categories: ['furniture', 'art', 'household'],
    families: ['painting', 'vase', 'armchair', 'dresser', 'rug', 'poster'], feeMult: 1.1,
    quote: 'Patina cannot be faked, darling. Well, it can. But not on me.',
  },
  {
    id: 'electronics', name: 'Kenji "Chip" Nakamura', title: 'Electronics, Cameras & Games', categories: ['electronics'],
    families: ['camera', 'console', 'radio'], feeMult: 0.9,
    quote: 'If it has a circuit or a shutter, I have seen it.',
  },
  {
    id: 'collectibles', name: 'Dana "Mint" Reyes', title: 'Collectibles & Memorabilia', categories: ['collectibles', 'toys', 'media', 'fashion'],
    families: ['comics', 'comic_single', 'cards', 'coins', 'gold_coin', 'toy', 'baseball', 'handbag', 'sneakers', 'books'], feeMult: 1,
    quote: 'Condition is everything. Everything.',
  },
  {
    id: 'music', name: 'Sal "Frets" Romano', title: 'Vintage Instruments & Records', categories: ['music'],
    families: ['guitar', 'keyboard', 'vinyl'], feeMult: 1,
    quote: 'Serial number, pot codes, neck date. Guitars always tell the truth.',
  },
];

export const EXPERT_MAP: Record<ExpertId, ExpertDef> = Object.fromEntries(EXPERTS.map((e) => [e.id, e])) as Record<ExpertId, ExpertDef>;

export interface BuyerPersonalityDef {
  id: BuyerPersonality;
  label: string;
  opening: [number, number];
  max: [number, number];
  patience: [number, number];
  bluff: number;
  lines: {
    open: string[];
    counter: string[];
    final: string[];
    accept: string[];
    annoyed: string[];
    leave: string[];
  };
}

export const BUYER_TYPES: Record<BuyerPersonality, BuyerPersonalityDef> = {
  lowballer: {
    id: 'lowballer', label: 'Lowballer', opening: [0.42, 0.55], max: [0.82, 0.98], patience: [3, 4], bluff: 0.6,
    lines: {
      open: ['I\'ll give you {offer}. Cash, today.', '{offer}, and honestly I\'m doing you a favour.'],
      counter: ['{offer}. That\'s more than fair.', 'Okay, okay. {offer}.', 'You drive a hard bargain. {offer}.'],
      final: ['{offer}. Final offer. I mean it this time.', '{offer} and I walk if you say no.'],
      accept: ['Fine. Deal.', 'You\'re killing me. Deal.'],
      annoyed: ['Are you serious right now?', 'That\'s a joke, right?'],
      leave: ['Forget it. I\'m out.', 'Nope. Too rich for me.'],
    },
  },
  fair: {
    id: 'fair', label: 'Fair Trader', opening: [0.68, 0.8], max: [0.95, 1.1], patience: [2, 3], bluff: 0.1,
    lines: {
      open: ['I\'d like to offer {offer} for it.', 'How does {offer} sound?'],
      counter: ['I can meet you at {offer}.', 'Let\'s say {offer}.'],
      final: ['{offer} is really the best I can do.'],
      accept: ['Deal. Pleasure doing business.', 'Sounds fair. Deal.'],
      annoyed: ['That\'s a bit much.', 'Hm. That\'s steep.'],
      leave: ['I\'ll pass, thanks anyway.', 'Too much for me. Good luck with it.'],
    },
  },
  enthusiast: {
    id: 'enthusiast', label: 'Enthusiast', opening: [0.78, 0.95], max: [1.1, 1.4], patience: [2, 3], bluff: 0,
    lines: {
      open: ['I\'ve been looking for one of these for years! {offer}?', 'Oh wow. {offer}, please say yes!'],
      counter: ['Okay, okay, {offer}!', 'I really want it. {offer}.'],
      final: ['{offer}. That\'s everything I\'ve got.'],
      accept: ['Yes! Thank you so much!', 'Deal! Best day ever.'],
      annoyed: ['Oof, that hurts.', 'Ah man, that\'s a lot.'],
      leave: ['I just can\'t afford that. Sorry.'],
    },
  },
  impatient: {
    id: 'impatient', label: 'In a Hurry', opening: [0.65, 0.8], max: [0.9, 1.05], patience: [1, 1], bluff: 0.2,
    lines: {
      open: ['{offer}, yes or no, I\'m double-parked.', 'Quick one: {offer}?'],
      counter: ['{offer}. Last chance.'],
      final: ['{offer}. Yes or no?'],
      accept: ['Done. Gotta go.', 'Fine, fine. Deal.'],
      annoyed: ['I don\'t have time for this.'],
      leave: ['Forget it, I\'m late.'],
    },
  },
  hardball: {
    id: 'hardball', label: 'Hardball Negotiator', opening: [0.48, 0.6], max: [0.8, 0.95], patience: [3, 5], bluff: 0.8,
    lines: {
      open: ['{offer}. Take it before I change my mind.', 'I\'m offering {offer}. Market\'s soft right now.'],
      counter: ['{offer}. Don\'t push it.', 'Fine. {offer}.'],
      final: ['{offer}. That\'s my final number.', 'Walk away or take {offer}.'],
      accept: ['Hmph. Deal.', 'You win this one.'],
      annoyed: ['Now you\'re insulting me.', 'Nice try.'],
      leave: ['We\'re done here.', 'Call me when you\'re serious.'],
    },
  },
};

export const BUYER_NAMES = [
  'Mike R.', 'Sandra K.', 'Luis M.', 'Priya S.', 'Gordon T.', 'Hannah B.', 'Omar F.', 'Betty L.', 'Jake W.', 'Chloe D.',
  'Viktor P.', 'Rosa G.', 'Dwayne H.', 'Mei L.', 'Frank O.', 'Ingrid N.', 'Carlos V.', 'Tamsin E.', 'Earl J.', 'Nadia Z.',
];

export interface CollectorDef {
  name: string;
  tag: TrendTag;
  blurb: string;
}

export const COLLECTORS: CollectorDef[] = [
  { name: 'Retro Ron', tag: 'retro_gaming', blurb: 'Runs a retro-gaming café and pays well for consoles and CRTs.' },
  { name: 'Lotte Achterberg', tag: 'cameras', blurb: 'Film-photography teacher building a camera museum.' },
  { name: 'Mr. Kessler', tag: 'watches', blurb: 'Quiet watch collector. Pays in cash, asks no questions.' },
  { name: 'Aunt Dolores', tag: 'antiques', blurb: 'Antique mall owner with a sweet tooth for Victoriana.' },
  { name: 'Jonah "Wax" Pruitt', tag: 'vinyl', blurb: 'Record store owner hunting original pressings.' },
  { name: 'Coach Mendez', tag: 'sports', blurb: 'Equips a youth club and loves sports memorabilia.' },
  { name: 'Ivy Lambert', tag: 'fashion', blurb: 'Vintage boutique owner with a waiting list.' },
  { name: 'Theo Park', tag: 'comics_cards', blurb: 'Comic shop owner and card grader.' },
  { name: 'Studio Nine', tag: 'music_gear', blurb: 'Recording studio buying vintage gear for its live room.' },
  { name: 'Ada Whitcombe', tag: 'art', blurb: 'Gallery owner looking for undervalued canvases.' },
  { name: 'Hank the Builder', tag: 'tools', blurb: 'Contractor who needs tools yesterday.' },
  { name: 'Silverline Coins', tag: 'coins', blurb: 'Coin dealer paying above melt for the right pieces.' },
  { name: 'Mod Squad Design', tag: 'mid_century', blurb: 'Interior studio furnishing loft apartments.' },
];

export const PAWN = { name: 'Gus\'s Pawn & Gold', owner: 'Gus Petrakis' };
export const ONLINE = { name: 'SwapBay' };
export const AUCTION_HOUSE = { name: 'Hollister & Crane Auctioneers' };
