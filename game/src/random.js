// SOLMAR HEAT — random.js
// A tiny seeded RNG (mulberry32) plus the small helpers the whole game
// shares, so the city, traffic and pedestrians are identical on every
// load with the same seed — and the screenshots stay reproducible.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer in [min, max] inclusive.
export function int(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Float in [min, max).
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// Pick one element of an array.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Deterministic 2D hash -> [0, 1), used for per-building variation that
// must not depend on call order (stable even if buildings are re-ordered).
export function hash2(x, z, seed = 1337) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed, 974634211)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Shortest signed angle difference, in radians, in [-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// ---- Extra helpers appended by the author (second pass) ----

// Smoothstep 0..1, for fades and day/night blends.
export function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

// A colour as [r, g, b] 0..1 lerped between two colours.
export function mixColor(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// Fisher-Yates shuffle that consumes the seeded rng, so shuffles are
// reproducible too.
export function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
