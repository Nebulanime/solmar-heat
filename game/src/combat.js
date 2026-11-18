// Gunfire and its consequences. Jax shoots on foot (F, aimed with the mouse);
// bullets fly straight, spark off walls, wound cars, pedestrians and cops, and
// a car shot to pieces goes up in flames. Every shot and every body raises the
// heat. Health hitting zero is WASTED; the cops never shoot back — they ram
// and they arrest.
import { COMBAT, PLAYER, WANTED } from './config.js';
import { insideBuilding } from './city.js';
import { commitCrime } from './police.js';

export const EVENT_WASTED = 1;
export const EVENT_SHOT = 2;
export const EVENT_EXPLOSION = 4;

function burst(state, x, z, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = state.rng.range(0, Math.PI * 2);
    const v = state.rng.range(speed * 0.3, speed);
    state.particles.push({
      x, z, y: 1,
      vx: Math.sin(a) * v, vy: state.rng.range(2, 7), vz: Math.cos(a) * v,
      life: state.rng.range(0.3, 0.8), max: 0.8, color, size: state.rng.range(0.4, 0.9),
    });
  }
}

function explodeCar(state, car) {
  burst(state, car.x, car.z, '#ff7b2f', 26, 12);
  burst(state, car.x, car.z, '#3a3a3a', 18, 7);
  burst(state, car.x, car.z, '#ffd23f', 12, 16);
  const idx = state.cars.indexOf(car);
  if (idx !== -1) state.cars.splice(idx, 1);
  // A burning police car takes its cop off the street.
  for (let i = state.cops.length - 1; i >= 0; i -= 1) {
    if (state.cops[i].car === car) state.cops.splice(i, 1);
  }
  if (state.player.car === car) {
    state.player.car = null;
    state.player.onFoot = true;
    state.player.health = Math.max(0, state.player.health - 30);
    state.messages.push({ text: 'Your car went up in flames!', t: state.time });
  }
}

function hitCar(state, car, damage) {
  car.hp -= damage;
  burst(state, car.x, car.z, '#ffd23f', 4, 6);
  if (car.hp <= 0) {
    explodeCar(state, car);
    return EVENT_EXPLOSION;
  }
  return 0;
}

/** One fixed step of shooting, bullets and particles. Returns EVENT_* flags. */
export function stepCombat(state, wantFire, aimX, aimZ, dt) {
  const p = state.player;
  let events = 0;
  if (p.fireCooldown > 0) p.fireCooldown -= dt;
  if (wantFire && p.onFoot && p.fireCooldown <= 0) {
    const heading = Math.atan2(aimX - p.x, aimZ - p.z);
    p.heading = heading;
    const muzzleX = p.x + Math.sin(heading) * 1.6;
    const muzzleZ = p.z + Math.cos(heading) * 1.6;
    state.bullets.push({
      x: muzzleX, z: muzzleZ,
      heading, speed: COMBAT.bulletSpeed, life: COMBAT.bulletLife,
    });
    // A brief muzzle flash at the barrel.
    burst(state, muzzleX, muzzleZ, '#ffe9a8', 3, 3);
    p.fireCooldown = COMBAT.fireRate;
    commitCrime(state, WANTED.shotFired);
    // The shot rings out: nearby pedestrians scatter.
    for (const ped of state.peds) {
      const dx = ped.x - p.x;
      const dz = ped.z - p.z;
      if (dx * dx + dz * dz < 900) {
        ped.mood = 'flee';
        ped.moodT = 4;
      }
    }
    events |= EVENT_SHOT;
  }

  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += Math.sin(b.heading) * b.speed * dt;
    b.z += Math.cos(b.heading) * b.speed * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && insideBuilding(state.city, b.x, b.z, 0)) {
      burst(state, b.x, b.z, '#ffd23f', 3, 5);
      dead = true;
    }
    if (!dead) {
      for (const car of [...state.cars]) {
        const dx = car.x - b.x;
        const dz = car.z - b.z;
        if (dx * dx + dz * dz < 7) {
          events |= hitCar(state, car, COMBAT.carBulletDamage);
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (let j = state.peds.length - 1; j >= 0; j -= 1) {
        const ped = state.peds[j];
        const dx = ped.x - b.x;
        const dz = ped.z - b.z;
        if (dx * dx + dz * dz < 1.6) {
          state.peds.splice(j, 1);
          state.pickups.push({ x: ped.x, z: ped.z, kind: 'cash', amount: 25 });
          commitCrime(state, WANTED.hitPed);
          state.messages.push({ text: 'Pedestrian down! The city saw that.', t: state.time });
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (let j = state.cops.length - 1; j >= 0; j -= 1) {
        const cop = state.cops[j];
        if (cop.kind !== 'foot') continue;
        const dx = cop.x - b.x;
        const dz = cop.z - b.z;
        if (dx * dx + dz * dz < 1.6) {
          state.cops.splice(j, 1);
          commitCrime(state, WANTED.hitCop);
          state.messages.push({ text: 'Cop down! Every unit in Solmar is coming.', t: state.time });
          dead = true;
          break;
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }

  // Particles fall and fade.
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const pt = state.particles[i];
    pt.x += pt.vx * dt;
    pt.z += pt.vz * dt;
    pt.y += pt.vy * dt;
    pt.vy -= 18 * dt;
    if (pt.y < 0) {
      pt.y = 0;
      pt.vy = 0;
    }
    pt.life -= dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }

  // Slow recovery when nothing has hurt Jax lately.
  if (p.health > 0 && p.health < PLAYER.health && state.time - (state.lastHurt || 0) > 6) {
    p.health = Math.min(PLAYER.health, p.health + 2 * dt);
  }
  if (p.health <= 0) events |= EVENT_WASTED;
  return events;
}
