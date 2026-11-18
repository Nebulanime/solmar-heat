// Jax Rook on foot and behind the wheel. On foot he runs camera-relative and
// slips between the buildings; in a car he drives it arcade-style — throttle,
// brake, steering that bites with speed — and can steal anything parked or
// rolling. Collisions are circles against the city's building boxes.
import { CAR, CITY, PLAYER, WANTED } from './config.js';
import { clampToCity, collideBuildings, insideBuilding } from './city.js';
import { ACTION_ENTER } from './input.js';

export const EVENT_ENTER = 1;
export const EVENT_EXIT = 2;
export const EVENT_CRASH = 4;
export const EVENT_PICKUP = 8;

function forwardOf(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

export function spawnPlayer(state) {
  const g = state.city.landmarks.garage;
  state.player.x = g.x + 30;
  state.player.z = g.z - 46;
  state.player.heading = Math.PI; // facing north, into the city
  state.player.speed = 0;
  state.player.onFoot = true;
  state.player.car = null;
  state.player.vx = 0;
  state.player.vz = 0;
}

/** The nearest car the player could steal, within range, or null. */
export function nearestCar(state, range) {
  let best = null;
  let bestD = range * range;
  for (const car of state.cars) {
    if (car.driver === 'player') continue;
    const dx = car.x - state.player.x;
    const dz = car.z - state.player.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function stepOnFoot(state, input, dt) {
  const p = state.player;
  const cam = state.camera.yaw;
  // Wish direction, camera-relative: W is away from the camera.
  const f = input.forward();
  const s = input.strafe();
  const sin = Math.sin(cam);
  const cos = Math.cos(cam);
  let wx = sin * f + cos * s;
  let wz = cos * f - sin * s;
  const len = Math.hypot(wx, wz);
  if (len > 0) {
    wx /= len;
    wz /= len;
  }
  const top = input.run() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.vx += wx * PLAYER.accel * dt;
  p.vz += wz * PLAYER.accel * dt;
  // Friction when no input; cap the speed.
  const damp = len > 0 ? 0.4 : 6;
  p.vx -= p.vx * Math.min(1, damp * dt);
  p.vz -= p.vz * Math.min(1, damp * dt);
  const sp = Math.hypot(p.vx, p.vz);
  if (sp > top) {
    p.vx = (p.vx / sp) * top;
    p.vz = (p.vz / sp) * top;
  }
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  if (sp > 0.5) p.heading = Math.atan2(p.vx, p.vz);
  p.speed = sp;
  collideBuildings(state.city, p, PLAYER.radius);
  const clamped = clampToCity(p.x, p.z);
  p.x = clamped.x;
  p.z = clamped.z;
}

function stepDriving(state, input, dt) {
  const p = state.player;
  const car = p.car;
  const f = input.forward();
  const s = input.strafe();
  if (f > 0) car.speed += CAR.accel * dt;
  else if (f < 0) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.6 * dt;
  } else {
    car.speed -= car.speed * 0.7 * dt;
  }
  car.speed = Math.max(-CAR.reverseMax, Math.min(CAR.maxSpeed, car.speed));
  // Steering bites only while rolling, and reverses when reversing.
  const grip = Math.min(1, Math.abs(car.speed) / 6);
  car.heading += s * CAR.steer * grip * Math.sign(car.speed || 1) * dt;
  const f2 = forwardOf(car.heading);
  car.x += f2.x * car.speed * dt;
  car.z += f2.z * car.speed * dt;
  const clamped = clampToCity(car.x, car.z);
  car.x = clamped.x;
  car.z = clamped.z;
  // Walls: stop dead and spark when hit hard. collideBuildings already pushed
  // the car out of the wall; the speed reversal is the bounce.
  const hitWall = collideBuildings(state.city, car, 2.4);
  let events = 0;
  if (hitWall) {
    if (Math.abs(car.speed) > 12) {
      events |= EVENT_CRASH;
      car.hp -= Math.abs(car.speed) * 0.7;
      state.player.health = Math.max(0, state.player.health - Math.abs(car.speed) * 0.25);
    }
    car.speed *= -0.25;
    collideBuildings(state.city, car, 2.4);
  }
  // Soft bumps with the traffic.
  for (const other of state.cars) {
    if (other === car || other.driver === 'player') continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const d = Math.hypot(dx, dz);
    if (d < 4.4 && d > 0.01) {
      const push = (4.4 - d) / 2;
      const nx = dx / d;
      const nz = dz / d;
      other.x += nx * push;
      other.z += nz * push;
      car.x -= nx * push;
      car.z -= nz * push;
      other.speed *= 0.7;
      if (Math.abs(car.speed) > 10) {
        events |= EVENT_CRASH;
        car.speed *= 0.8;
      }
    }
  }
  p.x = car.x;
  p.z = car.z;
  p.heading = car.heading;
  p.speed = Math.abs(car.speed);
  return events;
}

function enterCar(state) {
  const car = nearestCar(state, PLAYER.enterRange);
  if (!car) return 0;
  const p = state.player;
  if (car.driver === 'traffic') {
    // The driver bails and runs: that is a carjacking, and the city notices.
    state.peds.push({
      x: car.x + 2, z: car.z + 2, heading: p.heading, speed: 0,
      color: 0, mood: 'flee', moodT: 6,
    });
    state.heat = Math.min(100, state.heat + WANTED.stealCar);
    state.messages.push({ text: 'Carjacked! The driver ran for it.', t: state.time });
  } else {
    state.heat = Math.min(100, state.heat + WANTED.stealCar);
    state.messages.push({ text: 'Car stolen. Keep it quiet.', t: state.time });
  }
  car.driver = 'player';
  car.parked = false;
  p.car = car;
  p.onFoot = false;
  p.vx = 0;
  p.vz = 0;
  return EVENT_ENTER;
}

function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) return 0;
  car.driver = 'none';
  car.parked = true;
  car.speed = 0;
  // Step out on the driver's side.
  p.x = car.x - Math.cos(car.heading) * 2.6;
  p.z = car.z + Math.sin(car.heading) * 2.6;
  if (insideBuilding(state.city, p.x, p.z, PLAYER.radius)) {
    p.x = car.x + Math.cos(car.heading) * 2.6;
    p.z = car.z - Math.sin(car.heading) * 2.6;
  }
  p.car = null;
  p.onFoot = true;
  p.speed = 0;
  return EVENT_EXIT;
}

function collectPickups(state) {
  const p = state.player;
  let events = 0;
  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const item = state.pickups[i];
    const dx = item.x - p.x;
    const dz = item.z - p.z;
    if (dx * dx + dz * dz > 9) continue;
    if (item.kind === 'cash') {
      p.cash += item.amount;
      state.messages.push({ text: `+$${item.amount}`, t: state.time });
    } else {
      p.health = Math.min(PLAYER.health, p.health + 40);
      state.messages.push({ text: 'Patched up. +40 health.', t: state.time });
    }
    state.pickups.splice(i, 1);
    events |= EVENT_PICKUP;
  }
  return events;
}

/** One fixed step of the player. `actions` were taken by the caller. Returns EVENT_* flags. */
export function stepPlayer(state, input, actions, dt) {
  let events = 0;
  // Entering and leaving a car is checked before moving, so E never also confirms a menu.
  if (actions & ACTION_ENTER) {
    events |= state.player.onFoot ? enterCar(state) : exitCar(state);
  }
  if (state.player.onFoot) stepOnFoot(state, input, dt);
  else events |= stepDriving(state, input, dt);
  events |= collectPickups(state);
  if (state.player.invuln > 0) state.player.invuln -= dt;
  return events;
}
