// The city's other road users: traffic cars that follow the street grid, parked
// cars waiting to be stolen, and pedestrians on the sidewalks who scatter when
// shots are fired. Traffic drives on the right, turns at intersections, and
// slows for the car ahead; nobody here is scripted to a path.
import { CAR, CITY, PEDS, TRAFFIC } from './config.js';
import { nearestStreet, onStreet, randomStreetPoint } from './city.js';

// Headings: 0 = south (+z), PI/2 = east (+x), PI = north (-z), -PI/2 = west (-x).
const DIRS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

function laneOffset(dir) {
  // Right-hand traffic: the lane sits 7 units to the right of the direction of travel.
  if (dir === 0) return { x: -7, z: 0 }; // southbound: west side
  if (dir === 2) return { x: 7, z: 0 }; // northbound: east side
  if (dir === 1) return { x: 0, z: 7 }; // eastbound: south side
  return { x: 0, z: -7 }; // westbound: north side
}

function placeOnStreet(car, dir, street, along) {
  const off = laneOffset(dir);
  if (dir === 0 || dir === 2) {
    car.x = street + off.x;
    car.z = along;
  } else {
    car.x = along;
    car.z = street + off.z;
  }
  car.heading = DIRS[dir];
}

function makeTrafficCar(rng, city, id, near) {
  const dir = rng.int(0, 3);
  const street = rng.pick(city.streets);
  const along = rng.range(-CITY.half + 60, CITY.half - 60);
  const car = {
    id,
    kind: rng.pick(['sedan', 'sedan', 'taxi', 'van', 'sport']),
    color: rng.int(0, 7),
    driver: 'traffic',
    parked: false,
    hp: CAR.hp,
    speed: rng.range(7, 12),
    targetSpeed: TRAFFIC.cruise + rng.range(-TRAFFIC.cruiseJitter, TRAFFIC.cruiseJitter),
    dir,
    street,
    lastTurn: 0,
    x: 0,
    z: 0,
  };
  placeOnStreet(car, dir, street, along);
  if (near) {
    car.x = near.x + rng.range(-30, 30);
    car.z = near.z + rng.range(-30, 30);
  }
  return car;
}

function makeParkedCar(rng, city, id) {
  const dir = rng.int(0, 3);
  const street = rng.pick(city.streets);
  const along = rng.range(-CITY.half + 60, CITY.half - 60);
  const side = rng.chance(0.5) ? 15 : -15;
  const car = {
    id,
    kind: rng.pick(['sedan', 'sedan', 'van', 'sport']),
    color: rng.int(0, 7),
    driver: 'none',
    parked: true,
    hp: CAR.hp,
    speed: 0,
    targetSpeed: 0,
    dir,
    street,
    lastTurn: 0,
    x: 0,
    z: 0,
  };
  if (dir === 0 || dir === 2) {
    car.x = street + side;
    car.z = along;
  } else {
    car.x = along;
    car.z = street + side;
  }
  car.heading = DIRS[dir];
  return car;
}

function makePed(rng, city) {
  const street = rng.pick(city.streets);
  const along = rng.range(-CITY.half + 40, CITY.half - 40);
  const side = rng.chance(0.5) ? 26 : -26;
  const onX = rng.chance(0.5);
  return {
    x: onX ? along : street + side,
    z: onX ? street + side : along,
    heading: rng.range(0, Math.PI * 2),
    speed: 0,
    color: rng.int(0, 6),
    mood: 'walk',
    moodT: rng.range(2, 8),
  };
}

/** Fill the streets with traffic, parked cars and pedestrians. */
export function createTraffic(state) {
  const rng = state.rng;
  let id = 1;
  for (let i = 0; i < TRAFFIC.count; i += 1) state.cars.push(makeTrafficCar(rng, state.city, id++, null));
  for (let i = 0; i < 10; i += 1) state.cars.push(makeParkedCar(rng, state.city, id++));
  for (let i = 0; i < PEDS.count; i += 1) state.peds.push(makePed(rng, state.city));
  state.nextCarId = id;
}

function carAhead(state, car) {
  // The nearest car in the same lane ahead of this one.
  let best = Infinity;
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  for (const other of state.cars) {
    if (other === car || other.parked) continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (along > 0 && along < best && side < 3.5) best = along;
  }
  return best;
}

function maybeTurn(state, car, dt) {
  // At an intersection (a crossing street), pick a new direction.
  const along = (car.dir === 0 || car.dir === 2) ? car.z : car.x;
  let crossing = null;
  for (const s of state.city.streets) {
    if (Math.abs(along - s) < 10 && Math.abs(along - car.lastTurn) > 40) {
      crossing = s;
      break;
    }
  }
  if (crossing === null) return;
  const rng = state.rng;
  const roll = rng.next();
  let next = car.dir;
  if (roll < 0.6) next = car.dir; // straight on
  else if (roll < 0.8) next = (car.dir + 1) % 4; // right
  else next = (car.dir + 3) % 4; // left
  if (next === car.dir) return;
  car.lastTurn = crossing;
  car.dir = next;
  car.heading = DIRS[next];
  // Re-seat the car on its new street, in the right lane.
  const off = laneOffset(next);
  if (next === 0 || next === 2) {
    car.street = nearestStreet(state.city, car.x);
    car.x = car.street + off.x;
  } else {
    car.street = nearestStreet(state.city, car.z);
    car.z = car.street + off.z;
  }
}

function stepTrafficCar(state, car, dt) {
  if (car.parked || car.driver === 'player' || car.driver === 'police') return;
  const gap = carAhead(state, car);
  const want = gap < 14 ? 0 : car.targetSpeed;
  car.speed += Math.max(-20 * dt, Math.min(8 * dt, want - car.speed));
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  car.x += fx * car.speed * dt;
  car.z += fz * car.speed * dt;
  maybeTurn(state, car, dt);
  // Off the map: come back on another street, far from the player.
  if (Math.abs(car.x) > CITY.half + 30 || Math.abs(car.z) > CITY.half + 30) {
    const spot = randomStreetPoint(state.rng, state.city, state.player.x, state.player.z, 120);
    const fresh = makeTrafficCar(state.rng, state.city, car.id, spot);
    Object.assign(car, fresh);
  }
}

function stepPed(state, ped, dt) {
  const rng = state.rng;
  ped.moodT -= dt;
  if (ped.mood === 'flee') {
    // Run away from the player.
    const dx = ped.x - state.player.x;
    const dz = ped.z - state.player.z;
    const d = Math.hypot(dx, dz) || 1;
    ped.heading = Math.atan2(dx / d, dz / d);
    ped.speed = PEDS.flee;
    if (ped.moodT <= 0) ped.mood = 'walk';
  } else {
    ped.speed = PEDS.walk;
    if (ped.moodT <= 0) {
      // At an intersection, turn; otherwise keep walking.
      if (onStreet(state.city, ped.x, ped.z)) {
        ped.heading += rng.pick([-Math.PI / 2, Math.PI / 2, 0, 0]);
      }
      ped.moodT = rng.range(2, 8);
    }
  }
  ped.x += Math.sin(ped.heading) * ped.speed * dt;
  ped.z += Math.cos(ped.heading) * ped.speed * dt;
  // Stay in the city and out of the sea.
  ped.x = Math.max(-CITY.half - 10, Math.min(CITY.half + 10, ped.x));
  ped.z = Math.max(-CITY.half - 10, Math.min(CITY.half + 6, ped.z));
}

/** One fixed step of traffic and pedestrians. */
export function stepTraffic(state, dt) {
  for (const car of state.cars) stepTrafficCar(state, car, dt);
  for (const ped of state.peds) stepPed(state, ped, dt);
  // The dead are replaced: a wrecked traffic car comes back as a fresh one.
  for (let i = state.cars.length - 1; i >= 0; i -= 1) {
    const car = state.cars[i];
    if (car.hp <= 0 && car.driver !== 'player') {
      state.cars.splice(i, 1);
      const fresh = makeTrafficCar(state.rng, state.city, state.nextCarId++, null);
      state.cars.push(fresh);
    }
  }
}
