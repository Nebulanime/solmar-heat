// The Solmar PD: a wanted level that rises with every crime and falls when the
// player goes quiet, police cars that hunt the player down and ram them, and
// foot cops who make the arrest when they catch Jax standing still. Busted is
// a foot cop holding on; wasted is health hitting zero (see combat.js).
import { CAR, CITY, POLICE, WANTED } from './config.js';
import { collideBuildings, randomStreetPoint } from './city.js';

export const EVENT_BUSTED = 1;

function nearestCopDistance(state) {
  let best = Infinity;
  for (const cop of state.cops) {
    const dx = cop.x - state.player.x;
    const dz = cop.z - state.player.z;
    best = Math.min(best, dx * dx + dz * dz);
  }
  return Math.sqrt(best);
}

function spawnPoliceCar(state) {
  const spot = randomStreetPoint(state.rng, state.city, state.player.x, state.player.z, 90);
  const car = {
    id: state.nextCarId++,
    kind: 'police',
    color: 0,
    driver: 'police',
    parked: false,
    hp: CAR.hp * 2,
    speed: 0,
    targetSpeed: POLICE.carSpeed,
    dir: 0,
    street: 0,
    lastTurn: 0,
    x: spot.x,
    z: spot.z,
    heading: Math.atan2(state.player.x - spot.x, state.player.z - spot.z),
  };
  state.cars.push(car);
  state.cops.push({ kind: 'car', x: car.x, z: car.z, heading: car.heading, speed: 0, car, bust: 0 });
}

function spawnFootCop(state) {
  const spot = randomStreetPoint(state.rng, state.city, state.player.x, state.player.z, 40);
  state.cops.push({ kind: 'foot', x: spot.x, z: spot.z, heading: 0, speed: 0, car: null, bust: 0 });
}

function steerToward(cop, tx, tz, dt, maxTurn) {
  const want = Math.atan2(tx - cop.x, tz - cop.z);
  let diff = want - cop.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = Math.max(-maxTurn * dt, Math.min(maxTurn * dt, diff));
  cop.heading += turn;
}

/** How many cars and foot cops the current wanted level puts on the street. */
function desiredForce(state) {
  const cars = Math.min(state.wanted, POLICE.maxCars);
  const foot = state.wanted >= 2 && state.player.onFoot ? 1 : 0;
  return { cars, foot };
}

function stepPoliceCar(state, cop, dt) {
  const car = cop.car;
  const p = state.player;
  steerToward(cop, p.x, p.z, dt, 2.6);
  car.heading = cop.heading;
  car.speed = Math.min(POLICE.carSpeed, car.speed + 14 * dt);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  collideBuildings(state.city, car, 2.4);
  car.x = Math.max(-CITY.half - 10, Math.min(CITY.half + 10, car.x));
  car.z = Math.max(-CITY.half - 10, Math.min(CITY.half + 6, car.z));
  cop.x = car.x;
  cop.z = car.z;
  cop.speed = car.speed;
  // A ram at speed hurts the player and their car.
  const dx = p.x - car.x;
  const dz = p.z - car.z;
  const d = Math.hypot(dx, dz);
  if (d < 4.6) {
    const push = (4.6 - d) / 2;
    const nx = dx / (d || 1);
    const nz = dz / (d || 1);
    if (p.onFoot) {
      p.x += nx * push * 2;
      p.z += nz * push * 2;
      p.health = Math.max(0, p.health - POLICE.ramDamage * dt * 4);
    } else if (p.car) {
      p.car.hp -= POLICE.ramDamage * dt * 2;
      p.car.x -= nx * push;
      p.car.z -= nz * push;
      car.speed *= 0.85;
    }
  }
}

function stepFootCop(state, cop, dt) {
  const p = state.player;
  steerToward(cop, p.x, p.z, dt, 4);
  const speed = p.onFoot ? POLICE.footSpeed : POLICE.footSpeed + 1;
  cop.speed = speed;
  cop.x += Math.sin(cop.heading) * speed * dt;
  cop.z += Math.cos(cop.heading) * speed * dt;
  collideBuildings(state.city, cop, 1);
  const dx = p.x - cop.x;
  const dz = p.z - cop.z;
  const d = Math.hypot(dx, dz);
  if (d < 2.4 && p.onFoot) {
    cop.bust += dt;
    return cop.bust >= POLICE.bustTime ? EVENT_BUSTED : 0;
  }
  cop.bust = Math.max(0, cop.bust - dt);
  return 0;
}

/** One fixed step of the wanted level and the police. Returns EVENT_* flags. */
export function stepPolice(state, dt) {
  const p = state.player;
  // The heat cools when the player goes quiet, faster when no cop is near.
  const near = nearestCopDistance(state);
  const cooling = near > WANTED.seenRange ? WANTED.decayHidden : WANTED.decay;
  if (state.heat > 0 && state.time - (state.lastCrime || 0) > 4) {
    state.heat = Math.max(0, state.heat - cooling * dt);
  }
  state.wanted = Math.min(5, Math.floor(state.heat / WANTED.perStar));

  // The force on the street matches the stars.
  const want = desiredForce(state);
  let cars = 0;
  let foot = 0;
  for (const cop of state.cops) {
    if (cop.kind === 'car') cars += 1;
    else foot += 1;
  }
  if (state.wanted > 0) {
    if (cars < want.cars) spawnPoliceCar(state);
    if (foot < want.foot) spawnFootCop(state);
  }

  let events = 0;
  for (let i = state.cops.length - 1; i >= 0; i -= 1) {
    const cop = state.cops[i];
    // Stood down: the cops leave when the heat is gone.
    if (state.wanted === 0) {
      if (cop.kind === 'car' && cop.car) {
        cop.car.driver = 'none';
        cop.car.parked = true;
        const idx = state.cars.indexOf(cop.car);
        if (idx !== -1) state.cars.splice(idx, 1);
      }
      state.cops.splice(i, 1);
      continue;
    }
    if (cop.kind === 'car') stepPoliceCar(state, cop, dt);
    else events |= stepFootCop(state, cop, dt);
  }
  return events;
}

/** A crime the city saw: raise the heat and stamp the time. */
export function commitCrime(state, heat) {
  state.heat = Math.min(100, state.heat + heat);
  state.lastCrime = state.time;
}
