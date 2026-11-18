// SOLMAR HEAT — rng.mjs
// Deterministic seeded randomness. The whole city, traffic palette and
// pedestrian placement derive from one seed, so seed 7 always builds the
// same Solmar and the logic tests can assert exact values.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // Float in [min, max).
    range(min, max) { return min + next() * (max - min); },
    // Integer in [min, max] inclusive.
    int(min, max) { return Math.floor(min + next() * (max - min + 1)); },
    // Pick one element of an array.
    pick(list) { return list[Math.floor(next() * list.length)]; },
    // True with probability p.
    chance(p) { return next() < p; },
    // Shuffle a copy of an array (Fisher-Yates).
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

// Roll a value with a bell-ish curve (average of two uniforms) — useful
// for pedestrian speeds and building sizes that should cluster mid-range.
export function bell(rngFn, min, max) {
  return min + ((rngFn() + rngFn()) / 2) * (max - min);
}

// Cheap string hash, used to seed per-entity variation from a stable id.
export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
