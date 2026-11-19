// Solmar Heat — the city of Solmar. A road grid with dark asphalt, light
// sidewalks, textured buildings with setbacks and towers, palms, street
// lamps, billboards, a marina and the sea to the west. Deterministic from a
// seed so every screenshot run looks the same.
import { rng, CITY } from './logic.js';
import { createMesh, box, cylinder, quad, V, merge, hexRgb, sphere } from './mesh.js';

export function buildCity(seed = 7) {
  const R = rng(seed);
  const half = CITY.half, block = CITY.block, road = CITY.road;
  const pitch = block + road;
  const buildings = []; // {x,z,w,d,h,tex,setback,cyl}
  const palms = [], lamps = [], billboards = [];
  const roads = []; // {x,z,w,d} road quads
  const walks = []; // sidewalk quads
  // Roads: grid lines every pitch, plus a coastal avenue along the west edge.
  const lines = [];
  for (let v = -half; v <= half; v += pitch) lines.push(v);
  for (const v of lines) {
    roads.push({ x: 0, z: v, w: half * 2 + road, d: road });
    roads.push({ x: v, z: 0, w: road, d: half * 2 + road });
  }
  // Buildings fill the blocks between roads.
  let bi = 0;
  for (let gx = 0; gx < lines.length - 1; gx++) {
    for (let gz = 0; gz < lines.length - 1; gz++) {
      const bx = lines[gx] + road / 2, bz = lines[gz] + road / 2;
      const cx = bx + block / 2, cz = bz + block / 2;
      // Marina block (west edge): open plaza + water, no buildings.
      if (cx < -half + pitch * 0.9) continue;
      const downtown = Math.hypot(cx, cz) < 150;
      const h = downtown ? 26 + R() * 58 : 10 + R() * 22;
      const w = block * (0.55 + R() * 0.3), d = block * (0.55 + R() * 0.3);
      buildings.push({ x: cx, z: cz, w, d, h, tex: bi % 8, setback: R() < 0.45, cyl: R() < 0.12, seed: bi });
      bi++;
      // Palms along block corners (one per block — more reads as clutter).
      palms.push({ x: bx + (R() < 0.5 ? 4 : block - 4), z: bz + 4 + R() * (block - 8), h: 7 + R() * 4, lean: (R() - 0.5) * 0.3 });
      if (R() < 0.5) billboards.push({ x: cx, z: bz + 2, w: 18 + R() * 8, h: 6 + R() * 3, col: ['#ff5e8a', '#7ee7ff', '#ffd166', '#9dff6e'][bi % 4], text: ['SOLMAR', 'VELA', 'NEON ROW', 'PALM COURT'][bi % 4] });
    }
  }
  // Street lamps along every road, one side, every ~92 m (fewer, still reads).
  for (const v of lines) {
    for (let t = -half + 30; t < half; t += 92) {
      lamps.push({ x: v + road / 2 + 2, z: t, on: true });
    }
  }
  return { buildings, palms, lamps, billboards, roads, walks, half, block, road, pitch, lines };
}
// --- static geometry -------------------------------------------------------
const ASPHALT = [0.13, 0.13, 0.15];
const WALK = [0.42, 0.4, 0.38];
const GRASS = [0.16, 0.32, 0.2];
export function buildStaticMesh(city, texCount) {
  const m = createMesh();
  const half = city.half;
  // Ground base (dark earth / plaza) then road quads slightly above it.
  box(m, 0, -0.4, 0, half * 2 + 120, 0.8, half * 2 + 120, [0.1, 0.1, 0.12]);
  // Sea to the west: a big blue plane beyond the coastal avenue.
  const sea = createMesh();
  box(sea, -half - 130, -0.2, 0, 240, 0.4, half * 2 + 300, [0.05, 0.22, 0.38], { top: [0.08, 0.3, 0.48] });
  merge(m, sea);
  // Beach strip.
  box(m, -half - 8, 0.05, 0, 14, 0.3, half * 2 + 120, [0.76, 0.68, 0.5]);
  for (const r of city.roads) {
    // Dark asphalt with a subtle wet sheen colour; markings added as quads.
    box(m, r.x, 0.12, r.z, r.w, 0.24, r.d, ASPHALT, { top: [0.2, 0.2, 0.23] });
  }
  // Sidewalk strips along roads + block aprons.
  for (const v of city.lines) {
    box(m, 0, 0.28, v - city.road / 2 - 2.4, half * 2, 0.3, 4.8, WALK);
    box(m, 0, 0.28, v + city.road / 2 + 2.4, half * 2, 0.3, 4.8, WALK);
    box(m, v - city.road / 2 - 2.4, 0.28, 0, 4.8, 0.3, half * 2, WALK);
    box(m, v + city.road / 2 + 2.4, 0.28, 0, 4.8, 0.3, half * 2, WALK);
  }
  // Lane markings: flat dashed centre lines (quads, not boxes — 2 tris each).
  for (const v of city.lines) {
    for (let t = -half; t < half; t += 20) {
      quad(m, V(t - 2.5, 0.3, v + 0.25, [0.85, 0.78, 0.5]), V(t + 2.5, 0.3, v + 0.25, [0.85, 0.78, 0.5]),
        V(t + 2.5, 0.3, v - 0.25, [0.85, 0.78, 0.5]), V(t - 2.5, 0.3, v - 0.25, [0.85, 0.78, 0.5]));
      quad(m, V(v + 0.25, 0.3, t - 2.5, [0.85, 0.78, 0.5]), V(v + 0.25, 0.3, t + 2.5, [0.85, 0.78, 0.5]),
        V(v - 0.25, 0.3, t + 2.5, [0.85, 0.78, 0.5]), V(v - 0.25, 0.3, t - 2.5, [0.85, 0.78, 0.5]));
    }
  }
  // Crosswalks at a few downtown intersections (flat quads).
  for (const v of [-80, 0, 80]) for (const u of [-80, 0, 80]) {
    for (let k = -3; k <= 3; k++) {
      quad(m, V(u + k * 2.2 - 0.6, 0.32, v - 7.3, [0.9, 0.9, 0.88]), V(u + k * 2.2 + 0.6, 0.32, v - 7.3, [0.9, 0.9, 0.88]),
        V(u + k * 2.2 + 0.6, 0.32, v - 10.7, [0.9, 0.9, 0.88]), V(u + k * 2.2 - 0.6, 0.32, v - 10.7, [0.9, 0.9, 0.88]));
      quad(m, V(u + k * 2.2 - 0.6, 0.32, v + 10.7, [0.9, 0.9, 0.88]), V(u + k * 2.2 + 0.6, 0.32, v + 10.7, [0.9, 0.9, 0.88]),
        V(u + k * 2.2 + 0.6, 0.32, v + 7.3, [0.9, 0.9, 0.88]), V(u + k * 2.2 - 0.6, 0.32, v + 7.3, [0.9, 0.9, 0.88]));
    }
  }
  return m;
}

// Buildings, palms, lamps and billboards as geometry. Buildings use the
// procedural facade texture (tex channel 1..8); everything else is coloured.
export function buildBuildingsMesh(city) {
  const m = createMesh();
  for (const b of city.buildings) {
    const tex = 1 + (b.tex % 8);
    const signCol = hexRgb(['#ffd166', '#7ee7ff', '#ff5e8a', '#9dff6e', '#ffb45e', '#c9b8ff', '#ff8a5e', '#7ee7ff'][b.tex % 8]);
    if (b.cyl) {
      cylinder(m, b.x, b.h / 2, b.z, Math.min(b.w, b.d) / 2, b.h, [0.6, 0.6, 0.62], { tex, seg: 16 });
      cylinder(m, b.x, b.h + 1.5, b.z, Math.min(b.w, b.d) / 4, 3, [0.3, 0.3, 0.34], { seg: 10 });
      box(m, b.x, b.h + 0.2, b.z, Math.min(b.w, b.d) * 0.9, 0.4, Math.min(b.w, b.d) * 0.9, [0.2, 0.2, 0.22]);
      continue;
    }
    const h1 = b.h * (b.setback ? 0.62 : 1);
    const vRep = Math.max(1, Math.round(h1 / 12));
    const uv = [[0, 0], [1, 0], [1, vRep], [0, vRep]];
    box(m, b.x, h1 / 2, b.z, b.w, h1, b.d, [0.75, 0.75, 0.78], { tex, uv });
    // Roof cap hides the textured top face.
    box(m, b.x, h1 + 0.15, b.z, b.w + 0.4, 0.3, b.d + 0.4, [0.22, 0.22, 0.24]);
    // Ground-floor shop: dark glass band + a compact glowing sign strip.
    box(m, b.x, 2.2, b.z + b.d / 2 + 0.15, b.w * 0.9, 4.4, 0.3, [0.1, 0.12, 0.16]);
    box(m, b.x, 4.0, b.z + b.d / 2 + 0.35, b.w * 0.45, 0.7, 0.15, signCol, { emis: 0.9 });
    if (b.setback) {
      const w2 = b.w * 0.62, d2 = b.d * 0.62, h2 = b.h - h1;
      const vRep2 = Math.max(1, Math.round(h2 / 12));
      const uv2 = [[0, 0], [1, 0], [1, vRep2], [0, vRep2]];
      box(m, b.x, h1 + h2 / 2, b.z, w2, h2, d2, [0.7, 0.7, 0.74], { tex, uv: uv2 });
      box(m, b.x, b.h + 0.15, b.z, w2 + 0.4, 0.3, d2 + 0.4, [0.22, 0.22, 0.24]);
      box(m, b.x - w2 / 4, b.h + 0.7, b.z, 3, 1.4, 2.4, [0.45, 0.45, 0.48]);
      box(m, b.x + w2 / 4, b.h + 0.5, b.z + d2 / 5, 2, 1, 2, [0.4, 0.42, 0.45]);
      cylinder(m, b.x + w2 / 3, b.h + 4, b.z - d2 / 4, 0.25, 8, [0.3, 0.3, 0.32], { seg: 6 });
      if (b.h > 55) {
        cylinder(m, b.x, b.h + 0.3, b.z, w2 * 0.32, 0.5, [0.2, 0.22, 0.24], { seg: 16 });
      }
    } else {
      box(m, b.x - b.w / 4, b.h + 0.6, b.z, 3, 1.2, 2.4, [0.45, 0.45, 0.48]);
      cylinder(m, b.x + b.w / 4, b.h + 3, b.z, 0.22, 6, [0.3, 0.3, 0.32], { seg: 6 });
    }
  }
  return m;
}
export function buildPalmsMesh(city) {
  const m = createMesh();
  const leaf = [0.12, 0.5, 0.2], leaf2 = [0.16, 0.58, 0.24], trunk = [0.42, 0.32, 0.22];
  for (const p of city.palms) {
    const topX = p.x + p.lean * p.h, topZ = p.z;
    // Slightly leaning trunk, built from 2 stacked cylinders.
    for (let s = 0; s < 2; s++) {
      const f = s / 2, y = (f + 1 / 4) * p.h;
      cylinder(m, p.x + p.lean * p.h * f, y, p.z, 0.42 - f * 0.12, p.h / 2 + 0.2, trunk, { seg: 6 });
    }
    // Fronds: 5 long drooping quads radiating from the crown.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const dx = Math.cos(a), dz = Math.sin(a), L = 3.4;
      const x1 = topX + dx * L, z1 = topZ + dz * L;
      const col = i % 2 ? leaf : leaf2;
      quad(m, V(topX, p.h + 0.4, topZ, col), V(x1, p.h - 1.4, z1, col),
        V(x1 + dz * 0.7, p.h - 1.4, z1 - dx * 0.7, col), V(topX + dz * 0.7, p.h + 0.4, topZ - dx * 0.7, col));
    }
    sphere(m, topX, p.h + 0.6, topZ, 0.7, [0.35, 0.24, 0.12], { seg: 6, rings: 3 });
  }
  return m;
}
export function buildLampsMesh(city, night) {
  const m = createMesh();
  for (const l of city.lamps) {
    cylinder(m, l.x, 3, l.z, 0.14, 6, [0.25, 0.25, 0.28], { seg: 6 });
    box(m, l.x, 6.1, l.z, 1.6, 0.18, 0.18, [0.25, 0.25, 0.28]);
    sphere(m, l.x + 0.7, 6.0, l.z, 0.32, [1, 0.85, 0.55], { seg: 8, rings: 4, emis: night ? 1.6 : 0.7 });
    // Pool of light on the ground at night.
    if (night) box(m, l.x + 0.7, 0.36, l.z, 7, 0.05, 7, [0.55, 0.45, 0.25], { emis: 0.35 });
  }
  return m;
}
// Billboard: pole + panel (coloured face, emissive at night).
export function buildBillboardsMesh(city, night) {
  const m = createMesh();
  for (const b of city.billboards) {
    const col = hexRgb(b.col);
    box(m, b.x, 4, b.z, 0.8, 8, 0.8, [0.3, 0.3, 0.32]);
    box(m, b.x, 11, b.z, b.w, b.h, 0.5, col, { top: col, side: col, emis: night ? 0.9 : 0.25 });
    box(m, b.x, 11, b.z + 0.3, b.w - 1, b.h - 1.2, 0.1, col.map((v) => Math.min(1, v * 1.4 + 0.25)), { emis: night ? 0.7 : 0.15 });
  }
  return m;
}
