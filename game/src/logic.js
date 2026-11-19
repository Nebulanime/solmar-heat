// SOLMAR HEAT — logic.js
// Pure game rules with no DOM, WebGL or timers, so they can be unit
// tested in Node (tests/logic.test.mjs) and reused verbatim by game.js.
// Everything here is deterministic: same inputs, same outputs.

import { MISSIONS, TUNING } from './config.js';
import { clamp, dist2 } from './random.js';

// ---- Wanted level -------------------------------------------------------
// Stars 0..5. Crimes raise it; laying low lowers it after a quiet period.

export function addWanted(level, amount) {
  return clamp(level + amount, 0, 5);
}

// How many police units the wanted level fields.
export function copsForWanted(level) {
  if (level <= 0) return 0;
  return level + 1; // 2..6 cruisers
}

// Helicopter joins the hunt at 3 stars and above.
export function heliForWanted(level) {
  return level >= 3;
}

// Seconds of quiet (no cop within 60 m) before one star decays.
export const WANTED_DECAY_SECONDS = TUNING.wantedDecaySeconds;

// ---- Missions -----------------------------------------------------------
// A mission runtime is { index, step, done }. stepIsComplete checks one
// step against a snapshot of the world the caller supplies.

export function missionCount() {
  return MISSIONS.length;
}

export function missionAt(index) {
  return MISSIONS[index] ?? null;
}

// snapshot: { x, z, inCar, wanted, nearTalkTarget }
export function stepIsComplete(step, snapshot) {
  if (!step) return false;
  switch (step.type) {
    case 'goto':
      return dist2(snapshot.x, snapshot.z, step.x, step.z) <= (step.radius ?? 10);
    case 'enterCar':
      return snapshot.inCar === true;
    case 'talk':
      return snapshot.nearTalkTarget === true &&
        dist2(snapshot.x, snapshot.z, step.x, step.z) <= (step.radius ?? 6);
    case 'wanted':
      return snapshot.wanted >= (step.level ?? 2);
    default:
      return false;
  }
}

// Advance a mission runtime by one step; returns { runtime, completedMission }
// where completedMission is the finished mission object or null.
export function advanceStep(runtime) {
  const mission = MISSIONS[runtime.index];
  if (!mission) return { runtime, completedMission: null };
  const next = { index: runtime.index, step: runtime.step + 1, done: false };
  if (next.step >= mission.steps.length) {
    return { runtime: { index: runtime.index + 1, step: 0, done: false }, completedMission: mission };
  }
  return { runtime: next, completedMission: null };
}

export function currentStep(runtime) {
  const mission = MISSIONS[runtime.index];
  if (!mission) return null;
  return mission.steps[runtime.step] ?? null;
}

export function allMissionsDone(runtime) {
  return runtime.index >= MISSIONS.length;
}

// ---- Money & progress ----------------------------------------------------

export function formatMoney(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

// ---- Save data ----------------------------------------------------------
// Versioned save blob stored in localStorage under SAVE_KEY.

export const SAVE_KEY = 'solmar-heat-save-v1';

export function makeSave({ money, missionIndex, missionStep, x, z, health, ammo }) {
  return {
    version: 1,
    money: Math.max(0, Math.floor(money)),
    missionIndex,
    missionStep,
    x: Math.round(x * 10) / 10,
    z: Math.round(z * 10) / 10,
    health: clamp(Math.round(health), 0, 100),
    ammo: Math.max(0, Math.floor(ammo)),
    savedAt: Date.now(),
  };
}

export function parseSave(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    if (data.missionIndex < 0 || data.missionIndex > MISSIONS.length) return null;
    return data;
  } catch {
    return null;
  }
}

// ---- Collision helpers (second pass) ------------------------------------
// Axis-aligned building colliders are { x0, z0, x1, z1 }. resolveCircle
// pushes a circle (player / car) out of a box and reports whether it hit.

export function circleHitsBox(x, z, r, box) {
  const cx = clamp(x, box.x0, box.x1);
  const cz = clamp(z, box.z0, box.z1);
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

export function resolveCircleBox(x, z, r, box) {
  const cx = clamp(x, box.x0, box.x1);
  const cz = clamp(z, box.z0, box.z1);
  let dx = x - cx;
  let dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return { x, z, hit: false };
  if (d2 < 1e-8) {
    // Centre inside the box: push out along the smallest penetration axis.
    const pl = x - box.x0;
    const pr = box.x1 - x;
    const pt = z - box.z0;
    const pb = box.z1 - z;
    const m = Math.min(pl, pr, pt, pb);
    if (m === pl) return { x: box.x0 - r, z, hit: true };
    if (m === pr) return { x: box.x1 + r, z, hit: true };
    if (m === pt) return { x, z: box.z0 - r, hit: true };
    return { x, z: box.z1 + r, hit: true };
  }
  const d = Math.sqrt(d2);
  const push = (r - d) / d;
  return { x: x + dx * push, z: z + dz * push, hit: true };
}

// Is a point on a road (within the street grid), used by traffic AI and
// by the "speeding near a cop" check.
export function onRoad(x, z, world) {
  const half = world.road / 2;
  const px = x + 320;
  const pz = z + 240;
  const rx = px % world.pitch;
  const rz = pz % world.pitch;
  const nearV = rx < half || rx > world.pitch - half;
  const nearH = rz < half || rz > world.pitch - half;
  const inGrid = px >= -world.road / 2 && px <= world.cols * world.pitch + world.road / 2 &&
    pz >= -world.road / 2 && pz <= world.rows * world.pitch + world.road / 2;
  return inGrid && (nearV || nearH);
}
