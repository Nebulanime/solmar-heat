// SOLMAR HEAT — central tuning: every number the rest of the game agrees on.
// One place to balance speeds, money, heat and the size of the city of Solmar.
export const CFG = {
  worldSize: 1000,
  halfWorld: 500,
  blockSize: 100,
  roadWidth: 22,
  // Player on foot.
  walkSpeed: 62,
  runSpeed: 118,
  playerRadius: 5,
  playerHealth: 100,
  // Driving.
  carAccel: 150,
  carBrake: 220,
  carMaxSpeed: 260,
  carReverseMax: 70,
  carTurnRate: 2.6,
  carDrag: 0.55,
  trafficSpeed: 52,
  copSpeed: 285,
  // Wanted / heat: 0..100, stars = floor(heat / 20), capped at 5.
  heatMax: 100,
  heatStealCar: 24,
  heatShotFired: 9,
  heatCopKilled: 30,
  heatDecayPerSec: 1.6,
  heatQuietDelay: 8,
  // Combat.
  bulletSpeed: 620,
  bulletLife: 0.9,
  bulletDamage: 34,
  gunCooldown: 0.22,
  copShotDamage: 7,
  copShotRange: 190,
  copShotCooldown: 0.9,
  // Missions.
  missionRadius: 34,
  missionGrabRadius: 26,
  // Crowd.
  trafficCount: 16,
  pedCount: 26,
  maxCops: 4,
  // Camera.
  camScale: 2.1,
  camTilt: 0.52,
  camHeight: 0,
  // Save slot.
  saveKey: 'solmar-heat-save-v1',
};

export const MONEY = {
  mission1: 300,
  mission2: 600,
  mission3: 900,
  mission4: 1500,
  bustedFine: 200,
};

export const PALETTE = {
  skyTop: '#7ec8f2',
  skyBottom: '#ffe9b8',
  sea: '#2e9fc4',
  seaDeep: '#1e7ba6',
  sand: '#f2ddab',
  grass: '#8fce6e',
  ground: '#b9c4a3',
  road: '#3c3f46',
  roadEdge: '#2e3138',
  sidewalk: '#cfc8b8',
  laneMark: '#f7e05a',
  buildingRoof: '#e8e0d0',
  plaza: '#d9c9a8',
};

export const BUILDING_COLORS = [
  '#f6e3c2', '#f2c9a0', '#e8a87c', '#a8d8c8', '#f2e6b8',
  '#d8b4a0', '#c8d8e8', '#e8c8d8', '#f6d8a8', '#b8d8a8',
];

export const CAR_COLORS = [
  '#d83a34', '#2e6fd8', '#f2c230', '#38b24a', '#e8e8e8',
  '#22242a', '#8a4fd0', '#e07a2e', '#3aa8a0', '#c8d42e',
];

export const PED_COLORS = [
  '#e05a4e', '#4e7de0', '#e0c24e', '#4ee07a', '#d04ee0',
  '#e08a4e', '#4ed0e0', '#f0f0f0', '#30343a', '#a0d04e',
];

export const STARS = ['☆☆☆☆☆', '★☆☆☆☆', '★★☆☆☆', '★★★☆☆', '★★★★☆', '★★★★★'];

export function missionPay(index) {
  if (index === 1) return MONEY.mission1;
  if (index === 2) return MONEY.mission2;
  if (index === 3) return MONEY.mission3;
  return MONEY.mission4;
}

export function wantedStars(heat) {
  if (heat <= 0) return 0;
  return Math.min(5, Math.floor(heat / 20) + 1);
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
