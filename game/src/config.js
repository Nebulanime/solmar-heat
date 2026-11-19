// SOLMAR HEAT — config.js
// Static data for the city of Solmar: streets, districts, shops, missions,
// radio stations, dialogue and tuning. No code in here reads the DOM or
// WebGL; game.js and world.js consume these tables. Every value is hand
// picked for this entry, nothing is copied from another game.

export const WORLD = {
  // City grid: blocks of BLOCK metres separated by ROAD-wide streets.
  block: 64,
  road: 16,
  pitch: 80, // block + road
  cols: 8, // vertical streets 0..8
  rows: 6, // horizontal streets 0..6
  // Sea starts east of the last street; the beach strip sits between.
  beachX: 332,
  seaX: 366,
  // World bounds the player may roam in (metres, x east, z south).
  minX: -352,
  maxX: 560,
  minZ: -272,
  maxZ: 272,
};

export const STREETS_NS = [
  'Solmar Blvd', 'Palma St', 'Coral Way', 'Neon Ave',
  'Vega Ln', 'Harbor Rd', 'Sunset Dr', 'Marina Pkwy', 'Ocean View',
];
export const STREETS_EW = [
  'Northgate Ave', 'Flamingo Row', 'Crown St',
  'Bayside Ave', 'Jacaranda St', 'Dolphin Way', 'South Pier',
];

export const DISTRICTS = [
  { name: 'Downtown Solmar', x0: -352, z0: -272, x1: 20, z1: -40, tall: true },
  { name: 'Neon Row', x0: -352, z0: -40, x1: 60, z1: 120, tall: false },
  { name: 'Old Marina', x0: 60, z0: 120, x1: 332, z1: 272, tall: false },
  { name: 'Palma Heights', x0: 20, z0: -272, x1: 332, z1: -40, tall: true },
  { name: 'Solmar Beach', x0: 332, z0: -272, x1: 560, z1: 272, tall: false },
];

// Named shops the player can walk up to. Positions sit on sidewalk
// corners (block corners stay clear of building footprints), so the
// player can always reach them. kind drives the bonus:
// 'heal' restores health, 'ammo' refills the pistol, 'clothes' is flavour
// with a cash sink, 'food' restores a little health.
export const SHOPS = [
  { id: 'vice-burger', name: 'Vice Burger', kind: 'food', x: -310, z: -230, price: 12 },
  { id: 'neon-nails', name: 'Neon Nails', kind: 'clothes', x: -171, z: 11, price: 80 },
  { id: 'solmar-guns', name: 'Solmar Guns', kind: 'ammo', x: -91, z: -91, price: 150 },
  { id: 'palma-pharmacy', name: 'Palma Pharmacy', kind: 'heal', x: 69, z: -171, price: 40 },
  { id: 'coral-cafe', name: 'Coral Cafe', kind: 'food', x: 149, z: 11, price: 18 },
  { id: 'marina-bait', name: 'Marina Bait & Tackle', kind: 'food', x: 309, z: 171, price: 25 },
  { id: 'sunset-tattoo', name: 'Sunset Tattoo', kind: 'clothes', x: -11, z: 91, price: 120 },
  { id: 'jacaranda-donuts', name: 'Jacaranda Donuts', kind: 'food', x: 229, z: -91, price: 9 },
];

export const SAFEHOUSE = { name: 'Nova Safehouse', x: -251, z: 229 };

// The five story missions of Nova Vega. Each mission is a list of steps;
// a step completes when its condition is met, then the next one starts.
// Rewards are paid in dollars when the mission completes.
export const MISSIONS = [
  {
    id: 'm1',
    title: 'First Wheels',
    reward: 400,
    briefing: 'NOVA: Rico says a ride is waiting on Neon Ave. Take it. In Solmar, nobody asks whose car it is — only how fast it goes.',
    steps: [
      { type: 'enterCar', label: 'Steal a car (walk up and press E)', x: -160, z: 8 },
      { type: 'goto', label: 'Drive to the Neon Row garage', x: -128, z: 80, radius: 10 },
    ],
    complete: 'RICO: Not bad for a first night. The garage is yours now — park anything hot there.',
  },
  {
    id: 'm2',
    title: 'Sunset Courier',
    reward: 650,
    briefing: 'MARA: A package for the Coral Cafe, and the sun is already down. Don\'t open it, don\'t stop for anyone, and don\'t scratch the paint.',
    steps: [
      { type: 'goto', label: 'Pick up the package at Palma Pharmacy', x: 69, z: -171, radius: 8 },
      { type: 'goto', label: 'Deliver to Coral Cafe before dawn', x: 149, z: 11, radius: 8 },
    ],
    complete: 'MARA: Delivered clean. The cafe owes us one — and Solmar owes you a reputation.',
  },
  {
    id: 'm3',
    title: 'Marina Meet',
    reward: 900,
    briefing: 'RICO: A buyer waits on the Old Marina docks. Park the car, walk the pier, and look rich. If the yacht lights are on, the deal is on.',
    steps: [
      { type: 'goto', label: 'Drive to the Old Marina', x: 340, z: 196, radius: 12 },
      { type: 'talk', label: 'Meet the buyer on the dock (press E)', x: 352, z: 208, radius: 6 },
    ],
    complete: 'BUYER: Pleasure doing business, Vega. The marina remembers its friends.',
  },
  {
    id: 'm4',
    title: 'Heat Run',
    reward: 1400,
    briefing: 'NOVA: The Solmar PD is on us tonight. Lose them — or at least outrun them — and get home to the safehouse in one piece. The city is watching.',
    steps: [
      { type: 'wanted', label: 'Get the police on your tail (2 stars)', level: 2 },
      { type: 'goto', label: 'Lose the heat — reach the safehouse', x: -251, z: 229, radius: 12 },
    ],
    complete: 'NOVA: Home. The sirens fade, the neon stays. Solmar is still ours.',
  },
  {
    id: 'm5',
    title: 'Solmar Crown',
    reward: 2200,
    briefing: 'MARA: One last run — the Crown penthouse, Downtown. Every cop in Solmar will be between you and that rooftop. Drive like the whole city is yours. Because tonight, it is.',
    steps: [
      { type: 'goto', label: 'Race to the Crown penthouse, Downtown', x: -48, z: -240, radius: 10 },
      { type: 'talk', label: 'Hand over the Crown briefcase (press E)', x: -48, z: -240, radius: 6 },
    ],
    complete: 'MARA: The Crown is yours, Nova Vega. Solmar Heat — complete. The city never forgets a legend.',
  },
];

export const RADIO = [
  { id: 'solmar-887', name: 'SOLMAR 88.7 — Sunset FM', desc: 'synthwave', bpm: 96 },
  { id: 'palma-101', name: 'PALMA 101 — Bayside', desc: 'latin groove', bpm: 104 },
  { id: 'neon-945', name: 'NEON 94.5 — Night Drive', desc: 'lo-fi dusk', bpm: 76 },
];

export const PLAYER = {
  name: 'Nova Vega',
  startX: -160,
  startZ: 8,
  walkSpeed: 5.2,
  runSpeed: 8.6,
  health: 100,
  money: 250,
  pistolAmmo: 24,
};

export const TUNING = {
  carAccel: 14,
  carBrake: 26,
  carMaxSpeed: 38,
  carReverseMax: 10,
  carTurn: 1.9,
  trafficCount: 14,
  pedCount: 22,
  copChaseSpeed: 34,
  wantedDecaySeconds: 18,
  bustedSeconds: 2.0,
  dayLengthSeconds: 240,
};

export const DIALOGUE = {
  intro: 'NOVA: Solmar. Sun, sea, and everybody else\'s money. Time to take what\'s mine.',
  busted: 'SOLMAR PD: You\'re done, Vega. Hands where we can see them.',
  wantedUp: 'DISPATCH: All units — suspect Nova Vega, wanted level rising. Respond.',
  wantedDown: 'DISPATCH: Units standing down. Suspect lost — for now.',
  save: 'Game saved at the safehouse. Solmar waits for you.',
  enterCar: 'You took the car. The city just got louder.',
  shopHeal: 'Patched up. Good as new.',
  shopAmmo: 'Ammo restocked. Stay sharp.',
  shopFood: 'That hit the spot.',
  shopClothes: 'New look, same Nova.',
};

// ---- Derived helpers over the tables above (kept here so world.js and
// hud.js share one definition of "where am I") ----

// District that contains a point, or the beach fallback.
export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return DISTRICTS[DISTRICTS.length - 1];
}

// Nearest named street for a point, used by the HUD street readout.
// Vertical streets sit at x = -320 + i * pitch; horizontal at z = -240 + j * pitch.
export function streetAt(x, z) {
  const ns = Math.round((x + 320) / WORLD.pitch);
  const ew = Math.round((z + 240) / WORLD.pitch);
  const dNS = Math.abs(x - (-320 + ns * WORLD.pitch));
  const dEW = Math.abs(z - (-240 + ew * WORLD.pitch));
  if (ns >= 0 && ns < STREETS_NS.length && dNS <= dEW) return STREETS_NS[ns];
  if (ew >= 0 && ew < STREETS_EW.length) return STREETS_EW[ew];
  return 'Solmar Blvd';
}

export const TOTAL_REWARD = MISSIONS.reduce((sum, m) => sum + m.reward, 0);
