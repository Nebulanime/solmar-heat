// Pedestrians: Solmar locals strolling the sidewalks. They walk a sidewalk
// line, turn at corners, and flee from gunfire or a speeding car. Hitting one
// is a crime the police notice.

import { ROAD_LINES, ROAD_WIDTH } from './config.js';
import { dist2D } from './config.js';

const SHIRTS = ['#e8e8e8', '#3d7fd9', '#e8876b', '#f2c14e', '#7a4fd9', '#4fae62', '#d97fb0', '#2e2e33'];
const PANTS = ['#2e3a4a', '#5d4a33', '#3a3a3a', '#7a2e2e'];

export function createPedestrians(random, city) {
  const peds = [];
  for (let i = 0; i < 26; i += 1) {
    const line = random.pick(ROAD_LINES);
    const vertical = random.chance(0.5);
    const along = random.range(-160, 160);
    const side = random.pick([-1, 1]) * (ROAD_WIDTH / 2 + 2.5);
    peds.push({
      x: vertical ? line + side : along,
      z: vertical ? along : line + side,
      heading: random.range(0, Math.PI * 2),
      speed: random.range(1.2, 2.2),
      shirt: random.pick(SHIRTS),
      pants: random.pick(PANTS),
      walkPhase: random.range(0, Math.PI * 2),
      fleeing: 0,
      alive: true,
      down: false,
      downTimer: 0,
    });
  }
  return peds;
}

export function stepPedestrians(peds, dt, city, random, danger) {
  for (const ped of peds) {
    if (!ped.alive) continue;
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.down = false;
        ped.alive = true;
      }
      continue;
    }
    ped.walkPhase += dt * (ped.fleeing > 0 ? 9 : 5);
    let speed = ped.speed * (ped.fleeing > 0 ? 2.6 : 1);
    if (danger && dist2D(ped.x, ped.z, danger.x, danger.z) < 14) {
      ped.fleeing = 2.5;
      const dx = ped.x - danger.x;
      const dz = ped.z - danger.z;
      ped.heading = Math.atan2(dx, dz);
    }
    if (ped.fleeing > 0) ped.fleeing -= dt;
    ped.x += Math.sin(ped.heading) * speed * dt;
    ped.z += Math.cos(ped.heading) * speed * dt;
    // Stay on a sidewalk: if they wandered into a block, snap back to a road edge.
    if (!city.isRoad(ped.x, ped.z)) {
      const fixed = city.collideCircle(ped.x, ped.z, 0.6);
      ped.x = fixed.x;
      ped.z = fixed.z;
      if (random.chance(dt * 2)) ped.heading += Math.PI / 2;
    }
    if (Math.abs(ped.x) > 180 || Math.abs(ped.z) > 180) ped.heading += Math.PI;
    if (random.chance(dt * 0.08)) ped.heading += random.pick([-Math.PI / 2, Math.PI / 2]);
  }
}

// Knock a pedestrian down (they get back up later, shaken, not dead).
export function knockPed(ped, fromX, fromZ) {
  ped.down = true;
  ped.downTimer = 6;
  const dx = ped.x - fromX;
  const dz = ped.z - fromZ;
  const d = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
  ped.x += (dx / d) * 2;
  ped.z += (dz / d) * 2;
}
