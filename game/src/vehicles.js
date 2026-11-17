// Cars: the player's ride, parked cars to steal, traffic that follows the
// avenues, and police cruisers. Traffic drives the road grid — straight along
// an avenue, turning at intersections — and keeps a little distance from the
// car ahead, so the streets feel alive without a physics engine.

import { CAR, ROAD_LINES, ROAD_WIDTH } from './config.js';
import { angleLerp, clamp, dist2D } from './config.js';

const TRAFFIC_COLORS = ['#d94f3d', '#3d7fd9', '#e8c33d', '#7a4fd9', '#e8e8e8', '#2e2e33', '#4fae62', '#d97fb0', '#c97b2e'];
const PARKED_SPOTS = [
  { x: -38, z: 2, heading: Math.PI / 2 },
  { x: 42, z: -2, heading: -Math.PI / 2 },
  { x: -2, z: 82, heading: 0 },
  { x: 82, z: 38, heading: Math.PI },
  { x: -82, z: -38, heading: Math.PI / 2 },
  { x: 118, z: 142, heading: 0 },
  { x: -138, z: -118, heading: Math.PI },
  { x: 2, z: -122, heading: -Math.PI / 2 },
];

export function makeCar(x, z, heading, color, kind) {
  return {
    x, z, heading,
    speed: 0,
    color,
    kind: kind || 'traffic', // traffic | parked | player | cop
    length: CAR.length,
    width: CAR.width,
    steer: 0,
    brakeLight: false,
    siren: false,
    alive: true,
  };
}

export function createVehicles(random, city) {
  const cars = [];
  // Traffic on the avenues.
  for (let i = 0; i < 16; i += 1) {
    const p = city.randomRoadPoint();
    const vertical = Math.abs(p.x - city.nearestRoad(p.x)) < Math.abs(p.z - city.nearestRoad(p.z));
    const heading = vertical ? (random.chance(0.5) ? 0 : Math.PI) : (random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(p.x, p.z, heading, random.pick(TRAFFIC_COLORS), 'traffic');
    car.speed = random.range(7, 12);
    cars.push(car);
  }
  // Parked cars the player can steal.
  for (const spot of PARKED_SPOTS) {
    cars.push(makeCar(spot.x, spot.z, spot.heading, random.pick(TRAFFIC_COLORS), 'parked'));
  }
  return cars;
}

// Snap a traffic car to its lane: the nearest avenue, offset to the right side.
function laneTarget(car, city) {
  const vertical = Math.abs(Math.sin(car.heading)) < Math.abs(Math.cos(car.heading));
  if (vertical) {
    const line = city.nearestRoad(car.x);
    return { x: line + (car.heading > 0 && car.heading < Math.PI ? 2.2 : -2.2), z: car.z, vertical: true };
  }
  const line = city.nearestRoad(car.z);
  return { x: car.x, z: line + (car.heading > -Math.PI / 2 && car.heading < Math.PI / 2 ? 2.2 : -2.2), vertical: false };
}

export function stepTraffic(cars, dt, city, random, playerCar) {
  for (const car of cars) {
    if (car.kind !== 'traffic' || !car.alive) continue;
    const target = laneTarget(car, city);
    // Steer gently toward the lane, and turn at intersections sometimes.
    const wantHeading = target.vertical
      ? (Math.sin(car.heading) >= 0 ? 0 : Math.PI)
      : (Math.cos(car.heading) >= 0 ? Math.PI / 2 : -Math.PI / 2);
    let heading = angleLerp(car.heading, wantHeading, 1.2 * dt);
    const atCrossing = Math.abs(car.x - city.nearestRoad(car.x)) < 1.2 && Math.abs(car.z - city.nearestRoad(car.z)) < 1.2;
    if (atCrossing && random.chance(dt * 0.5)) {
      heading += random.pick([-Math.PI / 2, Math.PI / 2]);
    }
    // Slow down for the car ahead or the player's car.
    let targetSpeed = 10;
    for (const other of cars) {
      if (other === car || !other.alive) continue;
      const d = dist2D(car.x, car.z, other.x, other.z);
      if (d < 9) {
        const ahead = Math.cos(other.heading - car.heading);
        const dx = other.x - car.x;
        const dz = other.z - car.z;
        const forward = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
        if (forward > 0 && ahead > 0.5) targetSpeed = 0;
      }
    }
    if (playerCar && dist2D(car.x, car.z, playerCar.x, playerCar.z) < 8) {
      const dx = playerCar.x - car.x;
      const dz = playerCar.z - car.z;
      if (dx * Math.sin(car.heading) + dz * Math.cos(car.heading) > 0) targetSpeed = 0;
    }
    car.heading = heading;
    car.speed = clamp(car.speed + (targetSpeed - car.speed) * 1.5 * dt, 0, 14);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    const fixed = city.collideCircle(car.x, car.z, 1.6);
    car.x = fixed.x;
    car.z = fixed.z;
  }
}

// Player driving: arcade handling — accelerate, steer harder at low speed,
// brake, reverse, and a handbrake slide.
export function stepPlayerCar(car, input, dt) {
  const axis = input.axis();
  const throttle = axis.y;
  const steerInput = -axis.x;
  const handbrake = input.held('Space');
  if (throttle > 0) car.speed += CAR.accel * dt;
  else if (throttle < 0) {
    if (car.speed > 1) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.6 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 6 * dt;
    if (Math.abs(car.speed) < 0.3) car.speed = 0;
  }
  if (handbrake) car.speed -= Math.sign(car.speed) * 14 * dt;
  car.speed = clamp(car.speed, -CAR.reverseSpeed, CAR.maxSpeed);
  const steerAmount = steerInput * CAR.steer * clamp(Math.abs(car.speed) / 8, 0, 1) * (handbrake ? 1.7 : 1);
  car.heading += steerAmount * dt * Math.sign(car.speed || 1);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.brakeLight = throttle < 0 || handbrake;
  return { speed: car.speed, handbrake };
}

export function nearestCar(cars, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (!car.alive || car.kind === 'traffic' && car.speed > 0.5) continue;
    const d = dist2D(x, z, car.x, car.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
