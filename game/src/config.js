// SOLMAR HEAT — config: the city of Solmar, its people, its missions.
// Nova Vega returns to her home city to take it back, one job at a time.
export const GAME_NAME = 'SOLMAR HEAT';
export const ENTRY_NAME = 'Patient Nova';
export const HERO_NAME = 'Nova Vega';

export const CITY = {
  blocks: 9,          // blocks per side
  blockSize: 40,      // metres of buildings per block
  roadWidth: 14,      // metres of road between blocks
  pitch: 54,          // block + road
  maxSpeed: 38,       // player car top speed (m/s)
  pedSpeed: 1.6,
};

// Time of day presets: [hour, sun elevation, sun azimuth, sky top, sky horizon, fog]
export const TIMES = {
  sunset: { hour: 18.2, sunEl: 0.16, sunAz: 4.4, skyTop: [0.16, 0.10, 0.38], skyMid: [0.98, 0.42, 0.30], skyBot: [1.0, 0.62, 0.38], fog: [0.85, 0.45, 0.38], sun: [1.0, 0.55, 0.25], amb: 0.42, night: 0.15 },
  night:  { hour: 22.4, sunEl: -0.2, sunAz: 4.4, skyTop: [0.02, 0.02, 0.10], skyMid: [0.10, 0.06, 0.24], skyBot: [0.28, 0.10, 0.34], fog: [0.08, 0.06, 0.16], sun: [0.28, 0.34, 0.60], amb: 0.30, night: 1.0 },
  day:    { hour: 15.0, sunEl: 0.9,  sunAz: 3.6, skyTop: [0.25, 0.55, 0.95], skyMid: [0.55, 0.80, 1.0], skyBot: [0.95, 0.85, 0.65], fog: [0.70, 0.80, 0.90], sun: [1.0, 0.95, 0.8], amb: 0.62, night: 0.0 },
};

export const RADIO = [
  { name: 'SOLMAR FM', track: 'Neon Palms — "Sunset Drive"' },
  { name: 'PALM WAVE 98.5', track: 'Velvet Static — "Coconut Radio"' },
  { name: 'BAY CITY TALK', track: 'The Marisol Hour — call-in show' },
  { name: 'NEON NIGHTS', track: 'DJ Kestrel — "Midnight Marina"' },
];

export const MISSIONS = [
  { id: 1, title: 'First Job', giver: 'Rico', pay: 500,
    brief: 'Rico needs a driver. Get to the docks and meet him before the harbour crew clocks off.',
    objective: 'Drive to the docks marker', target: { x: -108, z: 108 }, kind: 'goto' },
  { id: 2, title: 'Hot Wheels', giver: 'Rico', pay: 900,
    brief: 'A mint Comet GT is parked uptown with the keys in it. Take it. Deliver it to the garage.',
    objective: 'Steal the Comet GT, then deliver it', target: { x: 108, z: -54 }, kind: 'steal' },
  { id: 3, title: 'Heat Rising', giver: 'Marisol', pay: 1200,
    brief: 'The Solmar PD is onto you. Lose the heat — shake the cruisers, then lay low at the safehouse.',
    objective: 'Lose the cops, reach the safehouse', target: { x: -54, z: -108 }, kind: 'escape', wanted: 3 },
  { id: 4, title: 'Neon Run', giver: 'Kestrel', pay: 1800,
    brief: 'A package for the Neon District, and the clock is ticking. Midnight deadline. No stops.',
    objective: 'Deliver the package before midnight', target: { x: 108, z: 108 }, kind: 'timed', timeLimit: 75 },
  { id: 5, title: 'Patient Nova', giver: 'Nova Vega', pay: 2500,
    brief: 'One last run. The yacht at the marina, the whole crew waiting. Solmar is yours after this.',
    objective: 'Reach the marina yacht', target: { x: 0, z: 216 }, kind: 'goto' },
];

export const SHOPS = [
  { name: 'SOLMAR ARMS', x: 54, z: -108, kind: 'arms', text: 'Ammo $50 — press E to buy 24 rounds' },
  { name: 'PALM BURGER', x: -108, z: 0, kind: 'food', text: 'Meal $15 — press E to heal +40' },
  { name: 'SAFEHOUSE', x: -54, z: -108, kind: 'safe', text: 'Safehouse — press E to save + heal' },
  { name: 'SPRAY SHOP', x: 108, z: 54, kind: 'spray', text: 'Respray $100 — press E to lose the cops' },
];

export const CAR_COLORS = [
  [0.85, 0.15, 0.12], [0.12, 0.35, 0.85], [0.95, 0.75, 0.10], [0.15, 0.75, 0.35],
  [0.75, 0.25, 0.75], [0.90, 0.90, 0.90], [0.10, 0.10, 0.12], [0.20, 0.65, 0.70],
];
// Police cruiser livery and the helicopter that joins the chase at 3 stars.
export const POLICE_BODY = [0.92, 0.92, 0.94];
export const POLICE_TRIM = [0.05, 0.08, 0.16];
export const HELI_BODY = [0.10, 0.12, 0.18];
export const PLAYER_CAR_COLOR = [0.95, 0.35, 0.08]; // Nova's orange Comet
export const PED_SHIRTS = [
  [0.9, 0.3, 0.3], [0.3, 0.6, 0.9], [0.9, 0.8, 0.2], [0.4, 0.8, 0.4],
  [0.8, 0.4, 0.8], [0.95, 0.95, 0.95], [0.2, 0.2, 0.25], [0.95, 0.55, 0.2],
];
