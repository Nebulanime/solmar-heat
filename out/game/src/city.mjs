// SOLMAR HEAT — the city of Solmar: a seeded grid of avenues, blocks, buildings,
// a beach and a harbour, plus the named landmarks the missions drive to.
// Everything is placed from the seed, so the same seed always builds the same city.
import { CFG, BUILDING_COLORS } from './config.mjs';
import { makeRng } from './rng.mjs';

const ROAD_LINES = [-400, -300, -200, -100, 0, 100, 200, 300, 400];

export function isRoadPoint(x, z) {
  const half = CFG.roadWidth / 2;
  for (const line of ROAD_LINES) {
    if (Math.abs(x - line) <= half) return true;
    if (Math.abs(z - line) <= half) return true;
  }
  return false;
}

export function nearestRoadPoint(x, z) {
  let bestX = ROAD_LINES[0];
  let bestZ = ROAD_LINES[0];
  for (const line of ROAD_LINES) {
    if (Math.abs(line - x) < Math.abs(bestX - x)) bestX = line;
    if (Math.abs(line - z) < Math.abs(bestZ - z)) bestZ = line;
  }
  if (Math.abs(bestX - x) <= Math.abs(bestZ - z)) return { x: bestX, z };
  return { x, z: bestZ };
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const landmarks = {
    garage: { x: -350, z: 350, label: "Rico's Garage" },
    marina: { x: -50, z: 445, label: 'Solmar Marina' },
    plaza: { x: 0, z: 0, label: 'Solmar Plaza' },
    warehouse: { x: 380, z: 250, label: 'Dockside Warehouse' },
    lighthouse: { x: 420, z: 445, label: 'Solmar Lighthouse' },
    hospital: { x: -350, z: -350, label: 'Solmar General' },
    policeHQ: { x: 350, z: -350, label: 'Solmar PD HQ' },
    beach: { x: 150, z: 460, label: 'Solmar Beach' },
  };
  const reserved = Object.values(landmarks).map((p) => ({ x: p.x, z: p.z, r: 62 }));

  const buildings = [];
  for (let ix = 0; ix < ROAD_LINES.length - 1; ix += 1) {
    for (let iz = 0; iz < ROAD_LINES.length - 1; iz += 1) {
      const x0 = ROAD_LINES[ix] + CFG.roadWidth / 2 + 4;
      const z0 = ROAD_LINES[iz] + CFG.roadWidth / 2 + 4;
      const x1 = ROAD_LINES[ix + 1] - CFG.roadWidth / 2 - 4;
      const z1 = ROAD_LINES[iz + 1] - CFG.roadWidth / 2 - 4;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (cz > 420) continue; // beach strip stays open
      if (reserved.some((r) => {
        const dx = cx - r.x;
        const dz = cz - r.z;
        return dx * dx + dz * dz < r.r * r.r;
      })) continue;
      const downtown = Math.abs(cx) < 180 && Math.abs(cz) < 180;
      const count = rng.int(1, downtown ? 2 : 3);
      for (let b = 0; b < count; b += 1) {
        const w = rng.range(22, 44);
        const d = rng.range(22, 44);
        const bx = rng.range(x0 + w / 2, x1 - w / 2);
        const bz = rng.range(z0 + d / 2, z1 - d / 2);
        const h = downtown
          ? rng.range(34, 86)
          : rng.range(12, 40);
        buildings.push({
          x: bx, z: bz, w, d, h,
          color: rng.pick(BUILDING_COLORS),
          roof: rng.pick(['#e8e0d0', '#d8c8a8', '#c8d8c8', '#e0b8a8']),
        });
      }
    }
  }

  const palms = [];
  for (let i = 0; i < 40; i += 1) {
    palms.push({ x: rng.range(-460, 460), z: rng.range(428, 492) });
  }
  // A row of palms lines the plaza so the cover shot reads "sun-soaked" at once.
  for (let i = 0; i < 8; i += 1) {
    palms.push({ x: -56 + i * 16, z: -58 });
    palms.push({ x: -56 + i * 16, z: 58 });
  }

  return {
    seed,
    roads: ROAD_LINES.slice(),
    roadWidth: CFG.roadWidth,
    buildings,
    palms,
    landmarks,
    bounds: CFG.halfWorld,
    beachZ: 425,
    seaZ: 500,
  };
}

export function randomRoadPoint(rng) {
  const vertical = rng.chance(0.5);
  const line = rng.pick(ROAD_LINES);
  const along = rng.range(-400, 400);
  return vertical ? { x: line, z: along } : { x: along, z: line };
}

export function randomSidewalkPoint(rng) {
  const p = randomRoadPoint(rng);
  const off = CFG.roadWidth / 2 + rng.range(3, 9);
  if (rng.chance(0.5)) p.x += rng.sign() * off;
  else p.z += rng.sign() * off;
  return p;
}

export function clampToCity(x, z) {
  const b = CFG.halfWorld - 8;
  return {
    x: Math.max(-b, Math.min(b, x)),
    z: Math.max(-b, Math.min(b, z)),
  };
}
