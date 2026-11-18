// SOLMAR HEAT — traffic.mjs
// Ambient traffic: cars that follow the road grid, stop at nothing,
// honk when blocked and keep the city feeling alive. They use the
// same car shape as the player's vehicles.
import { makeCar, updateDriving } from './vehicles.mjs';
import { ROAD_STEP, WORLD_W, WORLD_H } from './config.mjs';

export function spawnTraffic(rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng.chance(0.5);
    const x = vertical ? rng.int(0, 15) * ROAD_STEP + 28 : rng.range(60, WORLD_W - 200);
    const y = vertical ? rng.range(60, WORLD_H - 60) : rng.int(0, 11) * ROAD_STEP + 28;
    const angle = vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    const car = makeCar(x, y, angle, rng.pick(['#e33b3b', '#3b7fe3', '#e3c93b', '#3be37f', '#e3e3e3', '#e37f3b']), 'traffic');
    car.speed = rng.range(90, 170);
    car.vertical = vertical;
    cars.push(car);
  }
  return cars;
}

// Traffic cars cruise along their lane and wrap around the city edge.
export function updateTraffic(cars, dt) {
  for (const c of cars) {
    if (c.wrecked) continue;
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    if (c.x < -60) c.x = WORLD_W + 40;
    if (c.x > WORLD_W + 60) c.x = -40;
    if (c.y < -60) c.y = WORLD_H + 40;
    if (c.y > WORLD_H + 60) c.y = -40;
  }
}

// A traffic car the player rams hard becomes a wreck that slows down.
export function checkTrafficCrash(traffic, playerCar, onCrash) {
  if (!playerCar) return;
  for (const c of traffic) {
    if (c.wrecked) continue;
    const d = Math.hypot(c.x - playerCar.x, c.y - playerCar.y);
    if (d < 38 && Math.abs(playerCar.speed) > 140) {
      c.wrecked = true;
      c.speed = 0;
      playerCar.speed *= 0.45;
      if (onCrash) onCrash(c);
    }
  }
}

// Count how many traffic cars are still driving (for the HUD/debug).
export function drivingCount(traffic) {
  return traffic.filter((c) => !c.wrecked).length;
}
