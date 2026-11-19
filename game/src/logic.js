// Solmar Heat — pure game logic (no DOM, no WebGL): missions, wanted level,
// driving physics helpers and save data. Imported by the browser game and by
// the Node logic tests, so every rule here is unit-tested, not eyeballed.
// City: Solmar. Hero: Nova Vega, a getaway driver back in her hometown.
export const CITY = { half: 340, block: 64, road: 16, name: 'Solmar' };
export const PLAYER_NAME = 'Nova Vega';
export const GAME_TITLE = 'SOLMAR HEAT';

// Five story missions. Rewards sum to $4,700 — stated on the mission board.
export const MISSIONS = [
  { id: 1, name: 'Homecoming', giver: 'Mara Voss', place: 'Vela Marina',
    brief: 'Nova is back in Solmar. Pick up Mara at the marina and lose the tail.',
    objective: 'Drive to the marina marker, then reach the safehouse.',
    reward: 400, wanted: 1 },
  { id: 2, name: 'Neon Errand', giver: 'Dario Sol', place: 'Calle Rosa',
    brief: 'Dario needs a package moved across town before the Solmar PD sweep.',
    objective: 'Collect the package on Calle Rosa, deliver it to the Neon Row club.',
    reward: 650, wanted: 2 },
  { id: 3, name: 'The Long Way Home', giver: 'Mara Voss', place: 'Solmar Bridge',
    brief: 'A rival crew set up on the bridge. Escort Mara across, no stopping.',
    objective: 'Escort Mara across the bridge while police close in.',
    reward: 900, wanted: 3 },
  { id: 4, name: 'Storm Surge', giver: 'Captain Reyes', place: 'Port Solmar',
    brief: 'A storm is rolling in off the bay. Steal the courier van at the port.',
    objective: 'Steal the courier van and bring it to the garage on Palm Court.',
    reward: 1200, wanted: 3 },
  { id: 5, name: 'Heatwave', giver: 'Mara Voss', place: 'Solmar Tower',
    brief: 'One last job: the tower vault. Five stars of heat, one way out.',
    objective: 'Reach Solmar Tower, grab the vault case, escape to the marina.',
    reward: 1550, wanted: 5 },
];
export const TOTAL_REWARD = MISSIONS.reduce((s, m) => s + m.reward, 0);
export const SHOPS = [
  { name: 'Palm Court Garage', kind: 'garage', x: 96, z: 96 },
  { name: 'Neon Row Club', kind: 'club', x: -96, z: 160 },
  { name: 'Vela Marina Diner', kind: 'diner', x: 224, z: -224 },
  { name: 'Solmar Ammo & Pawn', kind: 'ammo', x: -224, z: -96 },
  { name: 'Calle Rosa Tacos', kind: 'food', x: 160, z: -32 },
  { name: 'Bayview Motel', kind: 'safehouse', x: -160, z: 224 },
];
export const SAFEHOUSE = { x: -160, z: 224, name: 'Bayview Motel' };

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz;
}
// Deterministic pseudo-random from an integer seed (mulberry32).
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Angle helpers: headings in radians, 0 = facing -Z (north on the map).
export function angDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function moveTowardAngle(a, b, maxStep) {
  const d = angDiff(b, a);
  return a + clamp(d, -maxStep, maxStep);
}
// --- driving ---------------------------------------------------------------
export const CAR = { accel: 26, brake: 42, maxSpeed: 46, maxReverse: 12, turn: 2.1, drag: 0.55 };
export function driveStep(car, input, dt) {
  // car: {x,z,heading,speed}; input: {up,down,left,right}. Returns nothing, mutates.
  const c = CAR;
  if (input.up) car.speed += c.accel * dt;
  if (input.down) car.speed -= (car.speed > 0.5 ? c.brake : c.accel * 0.55) * dt;
  if (!input.up && !input.down) {
    const s = Math.abs(car.speed) - c.drag * 6 * dt;
    car.speed = s <= 0 ? 0 : Math.sign(car.speed) * s;
  }
  car.speed = clamp(car.speed, -c.maxReverse, c.maxSpeed);
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  car.heading += steer * c.turn * clamp(Math.abs(car.speed) / 14, 0, 1) * dir * dt;
  // Heading 0 faces -Z; forward vector is (sin h, 0, -cos h).
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += -Math.cos(car.heading) * car.speed * dt;
  return car;
}

// --- wanted / police -------------------------------------------------------
export function wantedFromHeat(heat) { return clamp(Math.round(heat), 0, 5); }
// Heat cools while the player hides (slow speed, no crimes, out of sight).
// Returns new heat. dt seconds, hiding true when slow + far from police.
export function coolHeat(heat, dt, hiding) {
  if (heat <= 0) return 0;
  const rate = hiding ? 0.55 : 0.12;
  return Math.max(0, heat - rate * dt);
}
export function heatForCrime(kind) {
  return { steal: 1.2, speed: 0.4, hit: 0.8, shoot: 1.5, mission: 1.0 }[kind] ?? 0.5;
}
export function policeCount(wanted) { return [0, 1, 2, 3, 4, 6][clamp(wanted, 0, 5)]; }
export function heliActive(wanted) { return wanted >= 3; }
// --- on-foot movement ------------------------------------------------------
export const WALK = { speed: 6, run: 10 };
export function walkStep(p, input, dt) {
  const sp = input.run ? WALK.run : WALK.speed;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let mz = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, mz);
  if (len > 0) { mx /= len; mz /= len; p.x += mx * sp * dt; p.z += mz * sp * dt; p.heading = Math.atan2(mx, -mz); }
  p.x = clamp(p.x, -CITY.half, CITY.half);
  p.z = clamp(p.z, -CITY.half, CITY.half);
  return p;
}
// --- missions --------------------------------------------------------------
// Mission waypoints: two stops per mission. Pure data + progression rule so
// the Node tests can drive a whole mission without a browser.
export const MISSION_SPOTS = {
  1: [{ x: 224, z: -224, label: 'Vela Marina' }, { x: -160, z: 224, label: 'Bayview Motel' }],
  2: [{ x: 160, z: -32, label: 'Calle Rosa' }, { x: -96, z: 160, label: 'Neon Row Club' }],
  3: [{ x: -280, z: 0, label: 'Solmar Bridge' }, { x: 280, z: 0, label: 'East Gate' }],
  4: [{ x: -224, z: -96, label: 'Port Solmar' }, { x: 96, z: 96, label: 'Palm Court Garage' }],
  5: [{ x: 0, z: 0, label: 'Solmar Tower' }, { x: 224, z: -224, label: 'Vela Marina' }],
};
// Advance a mission when the player reaches the current marker (within 9 m).
// Returns { stage, done } — stage is the next stop index, done true on completion.
export function missionAdvance(missionId, stage, x, z) {
  const spots = MISSION_SPOTS[missionId];
  if (!spots || stage >= spots.length) return { stage, done: false };
  const s = spots[stage];
  if (Math.hypot(s.x - x, s.z - z) < 9) {
    const next = stage + 1;
    return { stage: next, done: next >= spots.length };
  }
  return { stage, done: false };
}
export function missionById(id) { return MISSIONS.find((m) => m.id === id) ?? null; }
export function nextMission(doneIds) {
  return MISSIONS.find((m) => !doneIds.includes(m.id)) ?? null;
}
export function applyMissionReward(state, mission) {
  state.money += mission.reward;
  state.done.push(mission.id);
  state.heat = Math.max(0, state.heat - 1);
  return state;
}
export function newGameState() {
  return { money: 250, health: 100, armor: 0, heat: 0, done: [], mission: null,
    weapon: 'Pistol', ammo: 24, timeMin: 18 * 60 + 24, day: 1 };
}
export function clockString(timeMin) {
  const h = Math.floor(timeMin / 60) % 24, m = Math.floor(timeMin) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export function isNight(timeMin) { const h = (timeMin / 60) % 24; return h >= 19 || h < 6; }
export function saveData(state) {
  return JSON.stringify({ money: state.money, done: state.done, timeMin: state.timeMin, day: state.day });
}
export function loadData(json) {
  try {
    const d = JSON.parse(json);
    if (typeof d.money !== 'number' || !Array.isArray(d.done)) return null;
    return d;
  } catch { return null; }
}
// Busted when health hits 0 while wanted > 0; wasted when health hits 0 alone.
export function deathResult(health, wanted) {
  if (health > 0) return null;
  return wanted > 0 ? 'BUSTED' : 'WASTED';
}
export function formatMoney(n) { return '$' + n.toLocaleString('en-US'); }
