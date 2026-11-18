// SOLMAR HEAT — cars: the factory, player driving physics (accelerate, brake,
// reverse, steering that bites harder at speed) and the traffic fleet's spawn.
// Traffic AI steering lives in traffic.mjs; this module owns how a car moves.
import { CFG, clamp, angleLerp } from './config.mjs';
import { clampToCity, randomRoadPoint, nearestRoadPoint } from './city.mjs';
import { resolveCollision } from './player.mjs';

let nextCarId = 1;

export function makeCar(x, z, heading, kind, color) {
  return {
    id: nextCarId += 1,
    x, z,
    heading,
    speed: 0,
    color,
    kind, // 'traffic' | 'player' | 'cop'
    driver: kind !== 'traffic',
    wrecked: false,
    // Traffic AI state.
    targetHeading: heading,
    stuckTime: 0,
    wobble: 0,
  };
}

export function spawnTrafficCars(city, rng, count) {
  const cars = [];
  const colors = ['#d83a34', '#2e6fd8', '#f2c230', '#38b24a', '#e8e8e8', '#22242a', '#8a4fd0', '#e07a2e', '#3aa8a0'];
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(rng);
    const vertical = Math.abs(p.x % 100) < 1;
    const heading = vertical ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(p.x, p.z, heading, 'traffic', rng.pick(colors));
    car.speed = rng.range(30, CFG.trafficSpeed);
    cars.push(car);
  }
  return cars;
}

export function stepDrive(S, input, dt) {
  const p = S.player;
  const car = p.car;
  if (!car) return;
  const fwd = input.forward();
  const strafe = input.strafe();
  const accel = fwd > 0 ? CFG.carAccel : fwd < 0 ? CFG.carBrake : 0;
  if (fwd > 0) car.speed += CFG.carAccel * dt;
  else if (fwd < 0) {
    if (car.speed > 2) car.speed -= CFG.carBrake * dt;
    else car.speed -= CFG.carAccel * 0.55 * dt;
  } else {
    car.speed -= car.speed * CFG.carDrag * dt * 2;
    if (Math.abs(car.speed) < 1.5) car.speed = 0;
  }
  car.speed = clamp(car.speed, -CFG.carReverseMax, CFG.carMaxSpeed);
  // Steering: sharper at low speed, steadier at full speed.
  const steer = strafe * CFG.carTurnRate * clamp(1 - Math.abs(car.speed) / (CFG.carMaxSpeed * 1.6), 0.35, 1);
  car.heading += steer * dt * (car.speed >= 0 ? 1 : -1) * clamp(Math.abs(car.speed) / 40, 0.2, 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const clamped = clampToCity(nx, nz);
  const fixed = resolveCollision(S.city, clamped.x, clamped.z, 9);
  if ((fixed.x !== clamped.x || fixed.z !== clamped.z) && Math.abs(car.speed) > 60) {
    if (S.audio) S.audio.crash();
    car.speed *= 0.4;
    S.heat = Math.min(CFG.heatMax, S.heat + 2);
    S.lastCrime = S.time;
  }
  car.x = fixed.x;
  car.z = fixed.z;
  p.x = car.x;
  p.z = car.z;
  p.heading = car.heading;
  if (S.audio) S.audio.engine(Math.abs(car.speed) / CFG.carMaxSpeed);
}

export function stepCarCoast(car, dt) {
  car.speed -= car.speed * CFG.carDrag * dt;
  if (Math.abs(car.speed) < 0.5) car.speed = 0;
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
}

// Distance from a car to the nearest road centre line, for AI lane keeping.
export function roadOffset(car) {
  const p = nearestRoadPoint(car.x, car.z);
  return Math.hypot(p.x - car.x, p.z - car.z);
}

// Keep a car on the road grid: nudge its heading toward the nearest road line.
export function alignToRoad(car, dt) {
  const p = nearestRoadPoint(car.x, car.z);
  const dx = p.x - car.x;
  const dz = p.z - car.z;
  if (Math.abs(dx) > 2 || Math.abs(dz) > 2) {
    const want = Math.atan2(dx, dz);
    car.heading = angleLerp(car.heading, want, Math.min(1, dt * 0.8));
  }
}
