// Pure game logic for SOLMAR HEAT: no DOM, no WebGL, so Node can test it.
// The browser world.js owns the same rules at runtime; this module is the
// single source of truth for the numbers both sides agree on.
import { clamp, dist2 } from './rng.js';

export const WANTED_MAX = 5;
// Wanted decays after this many quiet seconds per star.
export const WANTED_DECAY_SECONDS = 14;
// Cops stop spawning above this distance; the helicopter joins at 3 stars.
export const POLICE_SPAWN_DIST = 70;
export const HELI_MIN_WANTED = 3;
// How close the player must be to a marker to complete an objective.
export const MARKER_RADIUS = 9;

export function wantedForCrime(wanted, crime) {
  // crime: 'steal' | 'hit' | 'shoot' | 'speed'
  const add = { steal: 1, hit: 1, shoot: 2, speed: 0 }[crime] ?? 1;
  return clamp(wanted + add, 0, WANTED_MAX);
}

export function policeCount(wanted) {
  return wanted === 0 ? 0 : Math.min(1 + Math.floor(wanted / 2), 3);
}

export function heliActive(wanted) { return wanted >= HELI_MIN_WANTED; }

// Wanted cools down while the player stays out of trouble and out of sight.
export function wantedAfterQuiet(wanted, quietSeconds) {
  const drop = Math.floor(quietSeconds / WANTED_DECAY_SECONDS);
  return clamp(wanted - drop, 0, WANTED_MAX);
}

// A mission objective completes when the player (or their car) reaches its marker.
export function atMarker(px, pz, tx, tz, radius = MARKER_RADIUS) {
  return dist2(px, pz, tx, tz) <= radius * radius;
}

// How long a timed mission gives, in seconds (mission 4 is the only timed one).
export function missionTimeLimit(mission) {
  return mission.timeLimit ?? 0;
}

// Stars the HUD shows for a wanted level: filled vs empty.
export function wantedStars(wanted) {
  return '★'.repeat(wanted) + '☆'.repeat(WANTED_MAX - wanted);
}
export function speedKmh(v) { return Math.round(Math.abs(v) * 3.6); }

// Circle vs building-box collision: push the circle out, return the corrected pos.
export function collideBuildings(x, z, r, buildings) {
  let nx = x, nz = z;
  for (const b of buildings) {
    const hw = b.w / 2 + r, hd = b.d / 2 + r;
    const dx = nx - b.x, dz = nz - b.z;
    if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
      const px = hw - Math.abs(dx), pz = hd - Math.abs(dz);
      if (px < pz) nx = b.x + Math.sign(dx || 1) * hw;
      else nz = b.z + Math.sign(dz || 1) * hd;
    }
  }
  return { x: nx, z: nz };
}

// Keep an entity inside the playable city (plus the marina strip to the south).
export function clampToCity(x, z, half = 252) {
  return { x: clamp(x, -half, half), z: clamp(z, -half, half + 34) };
}

// Mission pay totals, for the save file and the HUD.
export function totalMissionPay(missions) {
  return missions.reduce((s, m) => s + m.pay, 0);
}

// A save snapshot: money, completed missions, health, position, radio station.
export function makeSave(state) {
  return {
    version: 1, money: state.money, done: state.done.slice(),
    mission: state.mission, health: state.health, ammo: state.ammo,
    radio: state.radio, x: state.x, z: state.z,
  };
}

export function validSave(s) {
  return !!(s && s.version === 1 && typeof s.money === 'number'
    && Array.isArray(s.done) && typeof s.mission === 'number');
}
