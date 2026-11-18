// SOLMAR HEAT — Solmar PD: the wanted system. Heat 0..100 becomes 1..5 stars;
// stars decide how many cruisers hunt Jax, how fast they are and how hard they
// hit. Cruisers ram the player's car, or corner Jax on foot for a bust. Lie low
// and the heat bleeds away.
import { CFG, MONEY, wantedStars, clamp, angleLerp } from './config.mjs';
import { makeCar } from './vehicles.mjs';
import { randomRoadPoint } from './city.mjs';

export function addHeat(S, amount) {
  S.heat = clamp(S.heat + amount, 0, CFG.heatMax);
  S.lastCrime = S.time;
}

export function copsWanted(S) {
  const stars = wantedStars(S.heat);
  if (stars === 0) return 0;
  return Math.min(CFG.maxCops, stars);
}

export function stepPolice(S, dt) {
  // Heat decays only after a quiet spell with no fresh crime.
  if (S.time - S.lastCrime > CFG.heatQuietDelay && S.heat > 0) {
    S.heat = Math.max(0, S.heat - CFG.heatDecayPerSec * dt);
  }
  const want = copsWanted(S);
  // Spawn cruisers near the player until the roster matches the stars.
  while (S.cops.length < want) {
    const p = randomRoadPoint(S.rng);
    const near = {
      x: S.player.x + (S.rng.chance(0.5) ? -1 : 1) * S.rng.range(140, 260),
      z: S.player.z + (S.rng.chance(0.5) ? -1 : 1) * S.rng.range(140, 260),
    };
    const car = makeCar(near.x, near.z, 0, 'cop', '#1c2f4a');
    car.speed = CFG.copSpeed * 0.6;
    car.shotCooldown = 1;
    S.cops.push(car);
    S.cars.push(car);
  }
  // Stand down cruisers when the heat is gone.
  if (want === 0 && S.cops.length > 0) {
    for (const cop of S.cops) {
      const i = S.cars.indexOf(cop);
      if (i >= 0) S.cars.splice(i, 1);
    }
    S.cops.length = 0;
    if (S.audio) S.audio.siren(false);
    return;
  }
  if (S.cops.length > 0 && S.audio) S.audio.siren(true);

  const p = S.player;
  for (const cop of S.cops) {
    const dx = p.x - cop.x;
    const dz = p.z - cop.z;
    const d = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx / d, dz / d);
    cop.heading = angleLerp(cop.heading, wantHeading, Math.min(1, dt * 2.4));
    const stars = wantedStars(S.heat);
    const targetSpeed = CFG.copSpeed * (0.72 + stars * 0.07);
    cop.speed += clamp(targetSpeed - cop.speed, -160 * dt, 130 * dt);
    cop.x += Math.sin(cop.heading) * cop.speed * dt;
    cop.z += Math.cos(cop.heading) * cop.speed * dt;
    const b = CFG.halfWorld - 6;
    cop.x = clamp(cop.x, -b, b);
    cop.z = clamp(cop.z, -b, b);

    // Ram: a cruiser touching the player's car shoves it and scuffs Jax a little.
    // Kept gentle on purpose: a chase should threaten the run, not end it in seconds.
    if (!p.onFoot && p.car && d < 16) {
      p.car.speed *= 0.94;
      p.car.x += (dx / d) * 1.5;
      p.car.z += (dz / d) * 1.5;
      damagePlayer(S, 6 * dt);
      if (S.audio) S.audio.crash();
    }
    // On foot, a close cruiser busts Jax.
    if (p.onFoot && d < 13 && Math.abs(cop.speed) > 20) {
      bustPlayer(S);
      return;
    }
    // Cops shoot when close and Jax is on foot.
    cop.shotCooldown -= dt;
    if (p.onFoot && d < CFG.copShotRange && cop.shotCooldown <= 0) {
      cop.shotCooldown = CFG.copShotCooldown;
      damagePlayer(S, CFG.copShotDamage);
      S.tracer = { x1: cop.x, z1: cop.z, x2: p.x, z2: p.z, life: 0.12 };
      if (S.audio) S.audio.shot();
    }
  }
  // Extra cruisers beyond the wanted count peel off.
  while (S.cops.length > want) {
    const cop = S.cops.pop();
    const i = S.cars.indexOf(cop);
    if (i >= 0) S.cars.splice(i, 1);
  }
}

export function damagePlayer(S, amount) {
  const p = S.player;
  p.health -= amount;
  if (p.health <= 0) {
    p.health = 0;
    S.screen = 'wasted';
    S.deathAt = S.time;
    if (S.audio) S.audio.busted();
  }
}

export function bustPlayer(S) {
  const p = S.player;
  const fine = Math.min(p.cash, MONEY.bustedFine);
  p.cash -= fine;
  S.heat = Math.floor(S.heat / 2);
  S.screen = 'busted';
  S.deathAt = S.time;
  if (S.audio) S.audio.busted();
  S.message = `Busted! Solmar PD fined you $${fine}.`;
  S.messageUntil = S.time + 4;
}

export function respawnAfterEnd(S) {
  const p = S.player;
  const hospital = S.city.landmarks.hospital;
  p.x = hospital.x;
  p.z = hospital.z;
  p.health = CFG.playerHealth;
  p.onFoot = true;
  p.car = null;
  for (const cop of S.cops) {
    const i = S.cars.indexOf(cop);
    if (i >= 0) S.cars.splice(i, 1);
  }
  S.cops.length = 0;
  S.heat = Math.max(0, S.heat - 20);
  S.bullets.length = 0;
  if (S.audio) S.audio.siren(false);
  S.screen = 'play';
}
