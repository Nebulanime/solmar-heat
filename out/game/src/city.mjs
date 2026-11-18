// SOLMAR HEAT — city.mjs
// Procedural generation of Solmar: a road grid, city blocks full of
// buildings, a park, a beach and the sea on the east edge, plus the
// landmarks the missions point at. Everything is derived from the seed.
import { WORLD_W, WORLD_H, ROAD_STEP, ROAD_W, BEACH_X, COLORS } from './config.mjs';

export function generateCity(rng) {
  const buildings = [];
  const parks = [];
  const landmarks = {
    plaza: { x: 1050, y: 1050, name: 'Coral Plaza' },
    boardwalk: { x: 2760, y: 620, name: 'Boardwalk' },
    harbor: { x: 620, y: 1980, name: 'Old Harbor' },
    tower: { x: 1500, y: 1500, name: 'Solmar Tower' },
  };
  // One park block in the north-west quarter.
  parks.push({ x: 400, y: 400, w: 160, h: 160, name: 'Palm Park' });

  for (let gx = 0; gx < WORLD_W / ROAD_STEP; gx++) {
    for (let gy = 0; gy < WORLD_H / ROAD_STEP; gy++) {
      const bx = gx * ROAD_STEP + ROAD_W / 2 + 12;
      const by = gy * ROAD_STEP + ROAD_W / 2 + 12;
      const bw = ROAD_STEP - ROAD_W - 24;
      const bh = ROAD_STEP - ROAD_W - 24;
      if (bx + bw > BEACH_X) continue; // beach blocks hold no buildings
      if (gx === 2 && gy === 2) continue; // Palm Park block
      if (gx === 5 && gy === 5) continue; // Coral Plaza block
      if (gx === 7 && gy === 7) continue; // Solmar Tower block
      const count = rng.int(1, 3);
      for (let i = 0; i < count; i++) {
        const w = rng.range(34, Math.max(40, bw - 8));
        const h = rng.range(34, Math.max(40, bh - 8));
        const x = bx + rng.range(0, Math.max(1, bw - w));
        const y = by + rng.range(0, Math.max(1, bh - h));
        const ci = rng.int(0, COLORS.building.length - 1);
        buildings.push({
          x, y, w, h,
          color: COLORS.building[ci],
          roof: COLORS.roof[ci],
          height: rng.int(1, 4),
        });
      }
    }
  }
  // Solmar Tower: one tall landmark at the city centre.
  buildings.push({
    x: 1450, y: 1450, w: 100, h: 100,
    color: '#4a7fc9', roof: '#2f4a7a', height: 8, landmark: true,
  });
  // Old Harbor warehouses along the south edge.
  buildings.push({ x: 560, y: 1920, w: 120, h: 70, color: '#8a6a4a', roof: '#5a4630', height: 2 });
  buildings.push({ x: 720, y: 2040, w: 90, h: 60, color: '#6a7a8a', roof: '#46525a', height: 2 });
  return { buildings, parks, landmarks, roads: roadList() };
}

function roadList() {
  const roads = [];
  for (let x = 0; x <= WORLD_W; x += ROAD_STEP) roads.push({ x, vertical: true });
  for (let y = 0; y <= WORLD_H; y += ROAD_STEP) roads.push({ y, vertical: false });
  return roads;
}

// True when point (x, y) is on a road (drivable surface).
export function onRoad(x, y) {
  const mx = ((x % ROAD_STEP) + ROAD_STEP) % ROAD_STEP;
  const my = ((y % ROAD_STEP) + ROAD_STEP) % ROAD_STEP;
  return mx < ROAD_W || my < ROAD_W || mx > ROAD_STEP - 2 || my > ROAD_STEP - 2;
}

// True when point (x, y) is on the sand / in the sea.
export function onBeach(x, y) { return x >= BEACH_X; }
export function inSea(x, y) { return x >= WORLD_W - 120; }

// Circle-vs-building collision: returns the building hit, or null.
export function hitBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

// Clamp a point inside the playable world (sea edge blocks walking).
export function clampWorld(x, y, r) {
  return {
    x: Math.max(r, Math.min(WORLD_W - 130, x)),
    y: Math.max(r, Math.min(WORLD_H - r, y)),
  };
}
