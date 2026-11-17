// The Solmar police: a wanted level from 0 to 5 stars, cruisers that spawn at
// the edge of town and chase the player, and officers who get out and try to
// arrest them on foot. Lose the heat by breaking line of sight and staying
// out of trouble; get caught and it is BUSTED.

import { CAR, WANTED } from './config.js';
import { angleLerp, clamp, dist2D } from './config.js';
import { makeCar } from './vehicles.js';

export function createPolice() {
  return {
    stars: 0,
    lastCrimeAt: -999,
    heatTimer: 0,
    cops: [], // cop cars
    officers: [], // on-foot officers
    spawnTimer: 0,
    arrestTimer: 0,
  };
}

export function addWanted(police, stars, now) {
  police.stars = clamp(police.stars + stars, 0, WANTED.maxStars);
  police.lastCrimeAt = now;
  police.heatTimer = 0;
}

export function stepPolice(police, dt, player, city, random, now) {
  const px = player.x;
  const pz = player.z;
  // Wanted decays only after a quiet stretch with no cop close by.
  if (police.stars > 0) {
    const nearest = police.cops.reduce((m, c) => Math.min(m, dist2D(px, pz, c.x, c.z)), 999);
    if (now - police.lastCrimeAt > WANTED.decayDelay && nearest > 55) {
      police.heatTimer += dt;
      if (police.heatTimer > WANTED.decayStep) {
        police.stars -= 1;
        police.heatTimer = 0;
      }
    } else {
      police.heatTimer = 0;
    }
  }
  // Spawn cruisers up to the wanted level's quota.
  const wantCops = police.stars === 0 ? 0 : police.stars <= 2 ? 2 : police.stars <= 4 ? 3 : 4;
  police.spawnTimer -= dt;
  if (police.cops.length < wantCops && police.spawnTimer <= 0) {
    police.spawnTimer = 2.5;
    const angle = random.range(0, Math.PI * 2);
    const cop = makeCar(px + Math.sin(angle) * 70, pz + Math.cos(angle) * 70, angle, '#20242e', 'cop');
    cop.siren = true;
    cop.speed = 12;
    police.cops.push(cop);
  }
  // Chase: steer toward the player, ram when close, give up far away.
  for (const cop of police.cops) {
    const d = dist2D(px, pz, cop.x, cop.z);
    const targetHeading = Math.atan2(px - cop.x, pz - cop.z);
    cop.heading = angleLerp(cop.heading, targetHeading, 2.2 * dt);
    const top = Math.min(CAR.copMaxSpeed, 20 + police.stars * 3.2);
    cop.speed = clamp(cop.speed + (top - cop.speed) * 0.8 * dt, 0, top);
    cop.x += Math.sin(cop.heading) * cop.speed * dt;
    cop.z += Math.cos(cop.heading) * cop.speed * dt;
    const fixed = city.collideCircle(cop.x, cop.z, 1.6);
    cop.x = fixed.x;
    cop.z = fixed.z;
    // A cop that catches the player on foot gets out and chases them down.
    if (d < 6 && !player.inCar && police.officers.length < 2 && random.chance(dt * 0.4)) {
      police.officers.push({ x: cop.x, z: cop.z, heading: cop.heading, speed: 5.2, alive: true });
    }
    if (d > 160) cop.speed = 0; // lost the trail far away: despawn
  }
  police.cops = police.cops.filter((c) => dist2D(px, pz, c.x, c.z) < 160);
  // Officers on foot.
  for (const off of police.officers) {
    const d = dist2D(px, pz, off.x, off.z);
    off.heading = Math.atan2(px - off.x, pz - off.z);
    off.x += Math.sin(off.heading) * off.speed * dt;
    off.z += Math.cos(off.heading) * off.speed * dt;
    if (d < 2.2) police.arrestTimer += dt;
    else police.arrestTimer = Math.max(0, police.arrestTimer - dt);
  }
  police.officers = police.officers.filter((o) => o.alive && dist2D(px, pz, o.x, o.z) < 120);
  return police.arrestTimer > 2.2; // busted
}

export function clearWanted(police) {
  police.stars = 0;
  police.cops = [];
  police.officers = [];
  police.arrestTimer = 0;
  police.heatTimer = 0;
}
