// SOLMAR HEAT — traffic AI: cars cruise the avenue grid, pick a new direction at
// intersections, slow for the car ahead, and wrap back into the city when they
// drift too far from the player. No pathfinding graph — the grid is the graph.
import { CFG, clamp, angleLerp } from './config.mjs';
import { isRoadPoint, randomRoadPoint } from './city.mjs';
import { alignToRoad } from './vehicles.mjs';

function onIntersection(car) {
  const rx = Math.round(car.x / 100) * 100;
  const rz = Math.round(car.z / 100) * 100;
  return Math.abs(car.x - rx) < 8 && Math.abs(car.z - rz) < 8;
}

export function stepTraffic(S, dt) {
  const rng = S.rng;
  const px = S.player.x;
  const pz = S.player.z;
  for (const car of S.cars) {
    if (car.kind !== 'traffic' || car.wrecked) continue;
    // Recycle cars that wandered far from the action: respawn near the player.
    const dx = car.x - px;
    const dz = car.z - pz;
    if (dx * dx + dz * dz > 700 * 700) {
      const near = {
        x: px + (rng.chance(0.5) ? -1 : 1) * rng.range(220, 380),
        z: pz + (rng.chance(0.5) ? -1 : 1) * rng.range(220, 380),
      };
      const snapped = nearestRoadSnap(near);
      car.x = snapped.x;
      car.z = snapped.z;
      car.speed = rng.range(30, CFG.trafficSpeed);
      continue;
    }
    // At an intersection, sometimes turn left, right or straight on.
    if (onIntersection(car) && rng.chance(dt * 0.9)) {
      const turn = rng.pick([-Math.PI / 2, 0, Math.PI / 2]);
      car.targetHeading = car.heading + turn;
    }
    car.heading = angleLerp(car.heading, car.targetHeading, Math.min(1, dt * 2.2));
    // Slow for the car ahead.
    let targetSpeed = CFG.trafficSpeed;
    for (const other of S.cars) {
      if (other === car || other.wrecked) continue;
      const ox = other.x - car.x;
      const oz = other.z - car.z;
      const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
      const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
      if (ahead > 0 && ahead < 42 && side < 12) {
        targetSpeed = Math.min(targetSpeed, Math.max(0, other.speed - 6));
        break;
      }
    }
    // And slow for pedestrians crossing ahead.
    for (const ped of S.peds) {
      const ox = ped.x - car.x;
      const oz = ped.z - car.z;
      const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
      const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
      if (ahead > 0 && ahead < 30 && side < 10) { targetSpeed = 0; break; }
    }
    car.speed += clamp(targetSpeed - car.speed, -90 * dt, 60 * dt);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    // Stay inside the city and on the grid; if pushed off-road, steer back.
    if (!isRoadPoint(car.x, car.z)) alignToRoad(car, dt * 2);
    const b = CFG.halfWorld - 6;
    car.x = clamp(car.x, -b, b);
    car.z = clamp(car.z, -b, b);
  }
}

function nearestRoadSnap(p) {
  const lines = [-400, -300, -200, -100, 0, 100, 200, 300, 400];
  let bx = lines[0];
  let bz = lines[0];
  for (const line of lines) {
    if (Math.abs(line - p.x) < Math.abs(bx - p.x)) bx = line;
    if (Math.abs(line - p.z) < Math.abs(bz - p.z)) bz = line;
  }
  if (Math.abs(bx - p.x) <= Math.abs(bz - p.z)) return { x: bx, z: p.z };
  return { x: p.x, z: bz };
}
