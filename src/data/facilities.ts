export interface FacilityDef {
  id: string;
  name: string;
  tagline: string;
  description: string;
  rows: string[];
  valueMult: number;
  rarityMult: number;
  travelCost: number;
  blueprints: string[];
  doorColor: string;
  wallColor: string;
  ambience: 'suburban' | 'industrial' | 'harbor' | 'luxury';
  minLevel: number;
  playable: boolean;
}

/**
 * Facilities are pure data. The vertical slice ships one playable facility;
 * the rest document the planned expansion and show up as locked on the map.
 */
export const FACILITIES: FacilityDef[] = [
  {
    id: 'lucky_lock',
    name: 'Lucky Lock Self Storage',
    tagline: 'Suburban, cheap, honest junk. And the occasional surprise.',
    description: 'Drive-up units behind a strip mall on Route 9. Low entry prices make it the classic starting ground for new hunters.',
    rows: ['A', 'B', 'C', 'D', 'E'],
    valueMult: 1,
    rarityMult: 1,
    travelCost: 20,
    blueprints: ['household', 'bachelor', 'contractor', 'musician', 'hoarder', 'estate', 'collector', 'flood', 'mystery', 'trash'],
    doorColor: '#5a88a3',
    wallColor: '#b9b2a4',
    ambience: 'suburban',
    minLevel: 1,
    playable: true,
  },
  {
    id: 'dockside', name: 'Dockside Container Yard', tagline: 'Shipping containers, customs seizures, salt air.',
    description: 'Expansion: container lots from the harbor.', rows: ['K'], valueMult: 2.2, rarityMult: 1.3, travelCost: 45,
    blueprints: [], doorColor: '#2f6e8c', wallColor: '#6d7a80', ambience: 'harbor', minLevel: 3, playable: false,
  },
  {
    id: 'old_mill', name: 'Old Mill Warehouses', tagline: 'Brick, rust and forgotten businesses.',
    description: 'Expansion: industrial units with bankrupt-business stock.', rows: ['M'], valueMult: 3, rarityMult: 1.2, travelCost: 60,
    blueprints: [], doorColor: '#8c2f2f', wallColor: '#7a5a48', ambience: 'industrial', minLevel: 4, playable: false,
  },
  {
    id: 'platinum', name: 'Platinum Vaults', tagline: 'Climate-controlled. Old money. Big bids.',
    description: 'Expansion: luxury storage for the wealthy.', rows: ['P'], valueMult: 8, rarityMult: 1.8, travelCost: 90,
    blueprints: [], doorColor: '#2b2b30', wallColor: '#cfc9bd', ambience: 'luxury', minLevel: 6, playable: false,
  },
];

export const FACILITY_MAP: Record<string, FacilityDef> = Object.fromEntries(FACILITIES.map((f) => [f.id, f]));
