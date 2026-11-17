// The city of Solmar: a seeded grid of avenues, blocks, buildings, parks, the
// beach and the pier. Everything is data — boxes with a colour, a height and a
// roof — so the renderer can paint it and the minimap can draw it from the
// same list. No real-world map is copied; the layout is invented here.

import { BLOCK, CITY_EDGE, PALETTE, PLACES, ROAD_LINES, ROAD_WIDTH } from './config.js';

export function createCity(random) {
  const buildings = [];
  const parks = [];
  const palms = [];

  // One building (sometimes two) per block, taller near the plaza, shorter by
  // the beach. A few blocks stay open as parks and plazas.
  for (let ix = 0; ix < ROAD_LINES.length - 1; ix += 1) {
    for (let iz = 0; iz < ROAD_LINES.length - 1; iz += 1) {
      const x0 = ROAD_LINES[ix] + ROAD_WIDTH / 2;
      const z0 = ROAD_LINES[iz] + ROAD_WIDTH / 2;
      // The block between two roads is BLOCK - ROAD_WIDTH wide; its centre is
      // half that from the road edge, so no building ever leans into a road.
      const cx = x0 + (BLOCK - ROAD_WIDTH) / 2;
      const cz = z0 + (BLOCK - ROAD_WIDTH) / 2;
      const centreDist = Math.sqrt(cx * cx + cz * cz);
      if (random.chance(0.12)) {
        parks.push({ x: cx, z: cz, w: BLOCK - 8, d: BLOCK - 8 });
        continue;
      }
      const tall = centreDist < 70 ? random.range(22, 46) : random.range(7, 20);
      const count = random.chance(0.35) ? 2 : 1;
      for (let b = 0; b < count; b += 1) {
        const w = count === 2 ? random.range(9, 13) : random.range(16, 26);
        const d = count === 2 ? random.range(9, 13) : random.range(16, 26);
        const ox = count === 2 ? (b === 0 ? -7 : 7) : 0;
        const oz = count === 2 ? (b === 0 ? -7 : 7) : 0;
        buildings.push({
          x: cx + ox,
          z: cz + oz,
          w,
          d,
          h: tall * random.range(0.7, 1.15),
          wall: random.pick(PALETTE.wall),
          roof: random.pick(PALETTE.roof),
          floors: Math.max(2, Math.round(tall / 4)),
        });
      }
    }
  }

  // Palm trees along the beach and the pier road.
  for (let z = -160; z <= 160; z += 20) {
    palms.push({ x: 176, z: z + random.range(-4, 4) });
    if (random.chance(0.5)) palms.push({ x: -176, z: z + random.range(-4, 4) });
  }

  // The pier: a wooden walkway reaching east into the sea.
  const pier = { x0: 184, x1: 232, z0: -6, z1: 6 };

  function nearestRoad(value) {
    let best = ROAD_LINES[0];
    for (const line of ROAD_LINES) {
      if (Math.abs(line - value) < Math.abs(best - value)) best = line;
    }
    return best;
  }

  // True when the point is on a road (drivable) rather than inside a block.
  function isRoad(x, z) {
    if (x > CITY_EDGE) return true; // beach and pier are open ground
    for (const line of ROAD_LINES) {
      if (Math.abs(x - line) <= ROAD_WIDTH / 2 + 1) return true;
      if (Math.abs(z - line) <= ROAD_WIDTH / 2 + 1) return true;
    }
    return false;
  }

  // Push a walking/driving circle out of every building it overlaps.
  function collideCircle(x, z, radius) {
    let nx = x;
    let nz = z;
    for (const b of buildings) {
      const hw = b.w / 2 + radius;
      const hd = b.d / 2 + radius;
      if (Math.abs(nx - b.x) < hw && Math.abs(nz - b.z) < hd) {
        const pushX = hw - Math.abs(nx - b.x);
        const pushZ = hd - Math.abs(nz - b.z);
        if (pushX < pushZ) nx = b.x + (nx >= b.x ? hw : -hw);
        else nz = b.z + (nz >= b.z ? hd : -hd);
      }
    }
    nx = Math.max(-182, Math.min(232, nx));
    nz = Math.max(-182, Math.min(182, nz));
    return { x: nx, z: nz };
  }

  function randomRoadPoint() {
    const vertical = random.chance(0.5);
    const line = random.pick(ROAD_LINES);
    const along = random.range(-160, 160);
    return vertical ? { x: line + random.range(-2, 2), z: along } : { x: along, z: line + random.range(-2, 2) };
  }

  return { buildings, parks, palms, pier, places: PLACES, isRoad, collideCircle, nearestRoad, randomRoadPoint };
}
