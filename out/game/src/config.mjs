// SOLMAR HEAT — config.mjs
// Single source of truth for every tunable number, name and label in the game.
// Solmar is an original fictional coastal city invented for this entry: no
// Rockstar names, maps, characters or art are used anywhere in the game.
export const GAME_TITLE = 'SOLMAR HEAT';
export const CITY_NAME = 'Solmar';
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_STEP = 200;
export const ROAD_W = 56;
export const BEACH_X = 2880;
export const SEED_DEFAULT = 7;

export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 290,
  radius: 13,
  maxHealth: 100,
  punchDamage: 12,
  punchRange: 34,
  punchCooldown: 0.35,
};

export const CAR = {
  accel: 420,
  brake: 620,
  maxSpeed: 520,
  reverseSpeed: 180,
  turnRate: 2.6,
  radius: 20,
};

// Wanted stars 0..5 and how many police units each star level fields.
export const WANTED = {
  max: 5,
  decayDelay: 9,
  decayRate: 0.12,
  copsPerStar: [0, 1, 2, 3, 4, 6],
  copSpeed: [0, 210, 240, 270, 300, 330],
};

export const COLORS = {
  sky: '#ffd9a0',
  grass: '#7fae62',
  road: '#3c3f46',
  roadLine: '#e8d44d',
  sidewalk: '#b9b3a4',
  sand: '#ecd9a0',
  sea: '#2f7fb8',
  building: ['#c96f4a', '#4a7fc9', '#c9a44a', '#7a4ac9', '#4ac9a0', '#c94a6a'],
  roof: ['#8a4a30', '#2f4a7a', '#8a7a30', '#4a2f7a', '#2f7a5a', '#7a2f4a'],
  car: ['#e33b3b', '#3b7fe3', '#e3c93b', '#3be37f', '#e3e3e3', '#222222', '#e37f3b'],
  copCar: '#2244aa',
  player: '#ff5fa2',
  ped: ['#f2c14e', '#4ec9f2', '#f27f4e', '#9ef24e', '#c94ef2'],
  cop: '#2b3a8f',
};

// Mission chain: five story beats, each with a target and a payout.
export const MISSIONS = [
  { id: 'wheels', name: 'First Wheels', pay: 150,
    brief: 'Nova needs wheels. Steal any parked car and drive to the blue marker at Coral Plaza.',
    target: { x: 1050, y: 1050 }, kind: 'drive' },
  { id: 'courier', name: 'Courier Run', pay: 300,
    brief: 'A package for the beach crew. Drive it to the boardwalk marker before the cops notice.',
    target: { x: 2760, y: 620 }, kind: 'drive' },
  { id: 'heat', name: 'Heat Rising', pay: 250,
    brief: 'The heat is on. Lose the cops and drop your wanted level back to zero.',
    target: null, kind: 'loseheat' },
  { id: 'harbor', name: 'Harbor Deal', pay: 500,
    brief: 'Meet the fixer at the old harbor. Expect trouble — bring a fast car and watch the alley.',
    target: { x: 620, y: 1980 }, kind: 'reach' },
  { id: 'king', name: 'King of Solmar', pay: 1000,
    brief: 'One last run: reach the Solmar Tower penthouse garage and claim the city.',
    target: { x: 1500, y: 1500 }, kind: 'reach' },
];

export const STORY = {
  intro: 'Solmar, noon. Nova Vega just got out — broke, wanted, and one hot car away from owning this city.',
  outro: 'The whole coast is yours now. SOLMAR HEAT — story complete.',
};

// How often the game autosaves while playing (seconds of game time).
export const AUTOSAVE_EVERY_SEC = 20;
// Distance at which a pedestrian notices a speeding car and panics.
export const PED_PANIC_RADIUS = 90;
// Cash a scared pedestrian drops when punched down (range, per ped).
export const PED_WALLET_MIN = 5;
export const PED_WALLET_MAX = 40;

// Key bindings, kept in one place so input.mjs and the HUD never disagree.
export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  enterCar: ['KeyE'],
  punch: ['Space'],
  shoot: ['KeyF'],
  pause: ['KeyP', 'Escape'],
  mission: ['KeyM'],
  mute: ['KeyN'],
};
