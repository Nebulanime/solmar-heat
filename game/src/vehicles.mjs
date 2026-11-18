// SOLMAR HEAT — vehicles.mjs
// Cars: spawning parked cars around the city, stealing them, driving
// physics (acceleration, steering, drift) and exiting. A car is a
// plain object so traffic and police can share the same shape.
import { CAR, COLORS, WORLD_W, WORLD_H, ROAD_STEP } from './config.mjs';
import { hitBuilding, onRoad } from './city.mjs';

let nextId = 1;

export function makeCar(x, y, angle, color, kind = 'civilian') {
  return {
    id: nextId++, x, y, angle,
    speed: 0, color: color || '#e33b3b',
    kind, // civilian | player | police | traffic
    driver: null,
    wrecked: false,
    honkTimer: 0,
  };
}

export function spawnParkedCars(rng, city, count) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard++ < count * 40) {
    const gx = rng.int(0, 14) * ROAD_STEP + 40;
    const gy = rng.int(0, 11) * ROAD_STEP + 40;
    if (gx > 2850) continue;
    const car = makeCar(gx, gy, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), rng.pick(COLORS.car));
    if (!hitBuilding(city, car.x, car.y, CAR.radius + 4)) cars.push(car);
  }
  return cars;
}

// Nearest car within reach of the player, for the "press E to steal" prompt.
export function nearestCar(cars, x, y, maxDist = 52) {
  let best = null, bestD = maxDist;
  for (const c of cars) {
    if (c.wrecked) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}

export function enterCar(player, car) {
  car.driver = player;
  player.inCar = car;
  car.kind = 'player';
}

export function exitCar(player) {
  const car = player.inCar;
  if (!car) return null;
  car.driver = null;
  car.kind = 'civilian';
  car.speed = 0;
  player.inCar = null;
  player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  return car;
}

export function updateDriving(car, input, city, dt) {
  const axis = input.axis();
  const forward = axis.y < 0 ? 1 : axis.y > 0 ? -0.55 : 0;
  if (forward > 0) car.speed = Math.min(CAR.maxSpeed, car.speed + CAR.accel * dt);
  else if (forward < 0) {
    // Hard brake when moving forward, reverse when already stopped.
    car.speed = car.speed > 30
      ? Math.max(0, car.speed - CAR.brake * dt)
      : Math.max(-CAR.reverseSpeed, car.speed - CAR.brake * 0.6 * dt);
  }
  else car.speed *= Math.pow(0.4, dt); // rolling drag
  if (axis.x !== 0 && Math.abs(car.speed) > 12) {
    car.angle += axis.x * CAR.turnRate * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 160);
  }
  let nx = car.x + Math.cos(car.angle) * car.speed * dt;
  let ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = hitBuilding(city, nx, ny, CAR.radius);
  if (hit) {
    car.speed *= -0.25; // bounce off the wall
    nx = car.x; ny = car.y;
    car.crashed = true;
  } else {
    car.crashed = false;
  }
  car.x = Math.max(CAR.radius, Math.min(WORLD_W - CAR.radius, nx));
  car.y = Math.max(CAR.radius, Math.min(WORLD_H - CAR.radius, ny));
  car.honkTimer = Math.max(0, car.honkTimer - dt);
  if (input.actionPressed('punch') && car.honkTimer <= 0) car.honkTimer = 0.5;
  return car.crashed;
}
