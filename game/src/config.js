// SOLMAR HEAT — shared tuning and city constants.
// Every number that shapes the city, the cars and the chase lives here so the
// rest of the game reads like a recipe instead of a pile of magic numbers.

export const GAME_TITLE = 'SOLMAR HEAT';
export const CITY_NAME = 'Solmar';
export const SAVE_KEY = 'solmar-heat-save-v1';
export const BEST_KEY = 'solmar-heat-best-v1';

// Fixed-step simulation: the world advances in 1/60 s slices.
export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;

// The city is a grid of avenues. Roads sit on these lines; blocks sit between them.
export const ROAD_LINES = [-160, -120, -80, -40, 0, 40, 80, 120, 160];
export const ROAD_WIDTH = 10;
export const BLOCK = 40;
export const CITY_EDGE = 185;

// Sun-soaked palette: warm sky, pale sand, teal sea, pastel walls.
export const PALETTE = {
  skyTop: '#2f7fd0',
  skyMid: '#7ec3ee',
  skyLow: '#ffe3b3',
  sun: '#fff3c4',
  sea: '#1e7fa8',
  seaDeep: '#14607f',
  sand: '#ecd9a4',
  grass: '#7fae62',
  road: '#3d4148',
  roadLine: '#e8d44d',
  sidewalk: '#b9b3a4',
  plaza: '#c9c2b2',
  wall: ['#f2c14e', '#e8876b', '#7fb3d5', '#f4ead8', '#c98bb0', '#8fc7a3', '#e8a13c', '#a8b8d8'],
  glass: '#9fd4e8',
  roof: ['#8a4b3a', '#5d6b7a', '#7a6a55', '#4f5d6b'],
};

// Named places the story and the missions point at. All original Solmar spots.
export const PLACES = {
  plaza: { x: 0, z: 0, label: 'Solmar Plaza' },
  garage: { x: -140, z: -140, label: "Rico's Garage" },
  pier: { x: 178, z: 0, label: 'Sunset Pier' },
  marina: { x: 120, z: 140, label: 'Marina Solmar' },
  hideout: { x: -120, z: 120, label: 'Hideout' },
  market: { x: -40, z: 80, label: 'Mercado Verde' },
  vault: { x: 140, z: -120, label: 'Marina Vault' },
  lookout: { x: 60, z: -140, label: 'Cliff Lookout' },
};

// Player tuning.
export const PLAYER = {
  walkSpeed: 7,
  runSpeed: 11.5,
  accel: 40,
  radius: 0.9,
  maxHealth: 100,
  punchDamage: 25,
  punchRange: 2.4,
  punchCooldown: 0.45,
  pistolDamage: 34,
  pistolRange: 55,
  pistolCooldown: 0.32,
  startCash: 120,
};

// Car tuning.
export const CAR = {
  length: 4.6,
  width: 2.0,
  maxSpeed: 34,
  copMaxSpeed: 36,
  accel: 16,
  brake: 30,
  steer: 2.1,
  reverseSpeed: 10,
};

// Wanted level tuning.
export const WANTED = {
  maxStars: 5,
  stealCar: 1,
  hitPed: 1,
  punchCop: 2,
  shoot: 1,
  killCop: 2,
  decayDelay: 9,
  decayStep: 14,
};

// Mission rewards, in Solmar dollars.
export const REWARDS = { m1: 400, m2: 650, m3: 900, m4: 2500 };

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function formatCash(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function formatClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
