// SOLMAR HEAT — every tuning number and colour in one place.
//
// The shared state every module works on (built by main.js):
//   state = { seed, rng, time, city, player, cars, peds, cops, bullets,
//             particles, pickups, wanted, heat, mission, cash, health,
//             camera, screen, overReason, messages, stats }
//   city = { pitch, streets[], blocks[], buildings[], landmarks, seaZ }
//   player = { x, z, heading, speed, onFoot, car, health, cash, invuln }
//   a car = { id, x, z, heading, speed, color, kind, driver, hp, parked }
//   a ped = { x, z, heading, speed, color, mood }
//   a cop = { kind: 'car'|'foot', x, z, heading, speed, car?, bust }
//   mission = { index, step, label, target, timer, done }
// The renderer projects world (x east, z south, y up) with a chase camera.

export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-heat.save.v1';
// Bump this when the save shape changes; old saves are then ignored.
export const SAVE_VERSION = 1;

// The city is a grid of blocks. Streets run at these coordinates; blocks sit between them.
export const CITY = {
  pitch: 160, // block (120) + street (40)
  block: 120,
  street: 40,
  half: 400, // city spans -400..400; the sea starts at seaZ
  seaZ: 420, // water south of here
  streets: [-320, -160, 0, 160, 320],
};

export const PLAYER = {
  radius: 1.1,
  walkSpeed: 7,
  runSpeed: 11,
  accel: 40,
  health: 100,
  enterRange: 5,
  punch: 0, // on-foot attack is the gun, not fists
};

export const CAR = {
  length: 4.6,
  width: 2.1,
  accel: 16,
  brake: 30,
  reverseMax: 9,
  maxSpeed: 34, // ~122 km/h, the sport car
  steer: 1.9, // rad/s at full lock, scaled by speed
  grip: 6, // how fast heading follows steering
  hp: 100,
};

export const TRAFFIC = {
  count: 14,
  cruise: 11,
  cruiseJitter: 3,
  spawnGap: 26, // min distance from the player when spawning
};

export const PEDS = { count: 22, walk: 1.6, flee: 4.5 };

export const POLICE = {
  carSpeed: 26,
  footSpeed: 8,
  bustTime: 1.6, // seconds a foot cop must touch the player to bust them
  ramDamage: 8,
  maxCars: 5,
};

// Heat 0..100; stars = floor(heat / 20), capped at 5.
export const WANTED = {
  perStar: 20,
  stealCar: 16,
  shotFired: 6,
  hitPed: 26,
  hitCop: 40,
  decay: 2.2, // per second while unseen
  decayHidden: 7, // per second while no cop is near
  seenRange: 70,
};

export const COMBAT = {
  bulletSpeed: 70,
  bulletLife: 1.1,
  damage: 34,
  fireRate: 0.22, // seconds between shots
  carBulletDamage: 25,
};

// Four chained story missions: Rico and Mara's arc, starring Jax Rook.
export const MISSIONS = [
  {
    name: 'First Wheels',
    giver: 'Rico',
    intro: 'Rico needs wheels. Steal any car and bring it to the garage.',
    reward: 300,
  },
  {
    name: 'Solmar Run',
    giver: 'Mara',
    intro: 'Mara hid a package at the marina. Grab it, then run it to Plaza del Sol in 90 seconds. The cops will notice.',
    reward: 600,
  },
  {
    name: 'Heat Wave',
    giver: 'Rico',
    intro: 'Three stars and every cop in Solmar on your tail. Lose them. Get the heat to zero before the clock runs out.',
    reward: 900,
  },
  {
    name: 'The Big Score',
    giver: 'Mara',
    intro: 'The marina vault. Crack it, grab the take, and vanish to the safehouse with four stars on you. No second chances.',
    reward: 2000,
  },
];

/** Total reward across the whole story arc. */
export const TOTAL_REWARD = MISSIONS.reduce((sum, m) => sum + m.reward, 0);

export const PALETTE = {
  skyTop: '#5aa9e6',
  skyMid: '#a8d4f0',
  horizon: '#ffe0ae',
  sun: '#fff3c4',
  sea: '#2f7fc8',
  seaDeep: '#1d5a94',
  sand: '#e8d5a8',
  asphalt: '#3d4450',
  asphaltLine: '#d8c94c',
  sidewalk: '#b3a894',
  blockTop: '#9a8f78',
  grass: '#7da05c',
  plaza: '#cbb98f',
  building: ['#f2e3c6', '#e8b4a0', '#a8c8e0', '#d8a0b0', '#c8d8a0', '#f0d080', '#e0c8f0', '#b8d0c0'],
  roof: ['#8a6f5c', '#6f7f8a', '#a08a6a', '#7a6a72'],
  car: ['#c0392b', '#2980b9', '#f1c40f', '#7f8c8d', '#16a085', '#8e44ad', '#e67e22', '#ecf0f1'],
  taxi: '#f7c948',
  police: '#eef2f5',
  policeDark: '#1c2733',
  ped: ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#fd79a8'],
  player: '#ffd23f',
  playerDark: '#2c3e50',
  hudPanel: 'rgba(12, 18, 28, 0.72)',
  hudText: '#f2f4f6',
  hudMuted: '#9aa5b1',
  gold: '#ffd23f',
  danger: '#ff5252',
  ok: '#69f0ae',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_DISPLAY = '"Trebuchet MS", system-ui, sans-serif';

/** Where the best run is kept between visits (this browser only). */
export const BEST_KEY = 'solmar-heat.best';
