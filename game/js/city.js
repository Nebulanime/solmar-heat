// city.js — Solmar City layout: a grid of named avenues and streets, blocks of
// buildings with varied heights, setbacks, towers and cylinders, parks, a beach
// and marina on the west edge, plus the named places missions use.
import { mulberry32, pick } from './util.js';

export const CITY_SIZE = 480; // world units, -240..240

const AVENUE_NAMES = [
  'MARINA BOULEVARD', 'PALM ROW', 'CORAL AVENUE', 'NEON STRIP',
  'SOLMAR DRIVE', 'HARBOUR ROAD', 'SUNSET LANE',
];
const STREET_NAMES = [
  'VEGA STREET', 'OCEAN VIEW', 'FLAMINGO WAY', 'BAYVIEW TERRACE',
  'DEL MAR', 'CIPTA LANE', 'TIDEWATER ROW',
];
const TONES = ['glass', 'brick', 'sand', 'concrete', 'coral', 'teal'];

export function buildCity(seed = 1337) {
  const rnd = mulberry32(seed);
  const half = CITY_SIZE / 2;
  const roadW = 13;
  const avenues = [], streets = [];
  // 7 vertical avenues, 7 horizontal streets, spacing ~64
  for (let i = 0; i < 7; i++) {
    const x = -half + 48 + i * 64;
    avenues.push({ x, name: AVENUE_NAMES[i] });
    const z = -half + 48 + i * 64;
    streets.push({ z, name: STREET_NAMES[i] });
  }
  const buildings = [];
  let id = 0;
  for (let ai = 0; ai < 6; ai++) {
    for (let si = 0; si < 6; si++) {
      const x0 = avenues[ai].x + roadW / 2 + 3;
      const x1 = avenues[ai + 1].x - roadW / 2 - 3;
      const z0 = streets[si].z + roadW / 2 + 3;
      const z1 = streets[si + 1].z - roadW / 2 - 3;
      const bw = x1 - x0, bd = z1 - z0;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      // downtown core (center blocks) gets towers
      const downtown = Math.abs(cx) < 110 && Math.abs(cz) < 110;
      const n = downtown ? (rnd() < 0.5 ? 1 : 2) : 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const w = bw * (n === 1 ? 0.72 : 0.34 + rnd() * 0.12);
        const d = bd * (n === 1 ? 0.72 : 0.34 + rnd() * 0.12);
        const bx = cx + (rnd() - 0.5) * (bw - w) * 0.7;
        const bz = cz + (rnd() - 0.5) * (bd - d) * 0.7;
        let h;
        if (downtown) h = 42 + rnd() * 78;
        else if (Math.abs(cx) < 180 && Math.abs(cz) < 180) h = 18 + rnd() * 30;
        else h = 8 + rnd() * 14;
        const shape = rnd();
        const kind = shape < 0.14 ? 'cylinder' : shape < 0.3 ? 'tower' : 'block';
        const setback = kind === 'tower' ? 0.62 + rnd() * 0.2 : 1;
        buildings.push({
          id: id++, x: bx, z: bz, w, d, h, kind, setback,
          tone: pick(TONES, rnd),
          seed: Math.floor(rnd() * 1e9),
          helipad: kind === 'tower' && rnd() < 0.35,
          rot: rnd() < 0.2 ? (rnd() - 0.5) * 0.3 : 0,
        });
      }
    }
  }
  // parks in two blocks
  const parks = [
    { x: avenues[1].x + 32, z: streets[4].z + 32, w: 44, d: 44, name: 'VEGA PARK' },
    { x: avenues[4].x + 32, z: streets[1].z + 32, w: 44, d: 44, name: 'PALM GARDENS' },
  ];
  // named places (mission + shop anchors) — all on roadside curbs, reachable
  // on foot and by car (never inside a building footprint)
  const places = {
    safehouse: { x: avenues[0].x - 3.2, z: streets[5].z + 26, name: "NOVA'S LOFT" },
    garage: { x: avenues[1].x + 3.2, z: streets[5].z - 26, name: 'SOLMAR GARAGE' },
    arms: { x: avenues[5].x + 3.2, z: streets[2].z + 26, name: 'SOLMAR ARMS' },
    diner: { x: avenues[3].x - 3.2, z: streets[3].z + 26, name: 'NEON DINER' },
    tower: { x: avenues[3].x - 3.2, z: streets[3].z - 3.2, name: 'SOLMAR SPIRE' },
    marina: { x: -half + 14, z: streets[3].z, name: 'MARINA PIER' },
    club: { x: avenues[3].x + 3.2, z: streets[5].z - 26, name: 'CLUB MIRAGE' },
  };
  // the central tower: tallest building at the middle block
  buildings.push({
    id: id++, x: 0, z: 0, w: 34, d: 34, h: 128, kind: 'tower', setback: 0.55,
    tone: 'glass', seed: 777, helipad: true, rot: 0,
  });
  return {
    min: -half, max: half, roadW, avenues, streets, buildings, parks, places,
    beachX: -half + 30,
    spawn: { x: avenues[0].x - 3.2, z: streets[5].z + 26, heading: Math.PI / 2 },
  };
}

// Is a point on a road (within road width of an avenue or street)?
export function onRoad(city, x, z) {
  for (const a of city.avenues) if (Math.abs(x - a.x) < city.roadW / 2) return true;
  for (const s of city.streets) if (Math.abs(z - s.z) < city.roadW / 2) return true;
  return false;
}
// Snap a point to the nearest road centerline.
export function nearestRoadPoint(city, x, z) {
  let bx = x, bz = z, bd = 1e9;
  for (const a of city.avenues) { const d = Math.abs(x - a.x); if (d < bd) { bd = d; bx = a.x; bz = z; } }
  for (const s of city.streets) { const d = Math.abs(z - s.z); if (d < bd) { bd = d; bx = x; bz = s.z; } }
  return { x: bx, z: bz };
}
// Nearest building (for collision): returns building or null within margin.
export function buildingAt(city, x, z, margin = 0.6) {
  for (const b of city.buildings) {
    const r = b.kind === 'cylinder' ? Math.max(b.w, b.d) / 2 + margin : 0;
    if (b.kind === 'cylinder') {
      const dx = x - b.x, dz = z - b.z;
      if (dx * dx + dz * dz < r * r) return b;
    } else if (Math.abs(x - b.x) < b.w / 2 + margin && Math.abs(z - b.z) < b.d / 2 + margin) {
      return b;
    }
  }
  return null;
}

// ---- traffic helpers: pick random road points / lanes ----
export function randomRoadPoint(city, rnd) {
  if (rnd() < 0.5) {
    const a = city.avenues[Math.floor(rnd() * city.avenues.length)];
    const z = city.min + rnd() * (city.max - city.min);
    return { x: a.x + (rnd() < 0.5 ? -3.2 : 3.2), z, along: 'z', dir: rnd() < 0.5 ? 1 : -1 };
  }
  const s = city.streets[Math.floor(rnd() * city.streets.length)];
  const x = city.min + rnd() * (city.max - city.min);
  return { x, z: s.z + (rnd() < 0.5 ? -3.2 : 3.2), along: 'x', dir: rnd() < 0.5 ? 1 : -1 };
}
export function randomSidewalkPoint(city, rnd) {
  const a = city.avenues[Math.floor(rnd() * city.avenues.length)];
  const z = city.min + rnd() * (city.max - city.min);
  return { x: a.x + (rnd() < 0.5 ? -8.5 : 8.5), z };
}
