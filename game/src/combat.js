// Combat on foot: a punch for close quarters and a pistol once the player
// picks one up. Hits are resolved against pedestrians, officers and cop cars
// in front of the player; every violent act feeds the wanted level.

import { PLAYER, WANTED } from './config.js';
import { dist2D } from './config.js';
import { knockPed } from './pedestrians.js';
import { addWanted } from './police.js';

export function createCombat() {
  return {
    punchTimer: 0,
    pistolTimer: 0,
    pistolAmmo: 24,
    hasPistol: false,
    muzzle: 0,
    swing: 0,
  };
}

function inFront(px, pz, heading, tx, tz, range, halfAngle) {
  const dx = tx - px;
  const dz = tz - pz;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d > range || d < 0.01) return d < range ? 1 : 0;
  const dot = (dx * Math.sin(heading) + dz * Math.cos(heading)) / d;
  return dot > Math.cos(halfAngle) ? d : 0;
}

export function punch(combat, player, peds, police, now) {
  if (combat.punchTimer > 0 || player.inCar) return false;
  combat.punchTimer = PLAYER.punchCooldown;
  combat.swing = 0.25;
  let hitSomething = false;
  for (const ped of peds) {
    if (!ped.alive || ped.down) continue;
    const d = inFront(player.x, player.z, player.heading, ped.x, ped.z, PLAYER.punchRange, 0.9);
    if (d) {
      knockPed(ped, player.x, player.z);
      addWanted(police, WANTED.hitPed, now);
      hitSomething = true;
      break;
    }
  }
  for (const off of police.officers) {
    if (!off.alive) continue;
    const d = inFront(player.x, player.z, player.heading, off.x, off.z, PLAYER.punchRange, 0.9);
    if (d) {
      off.alive = false;
      addWanted(police, WANTED.punchCop, now);
      hitSomething = true;
      break;
    }
  }
  return hitSomething;
}

export function shoot(combat, player, peds, police, now) {
  if (combat.pistolTimer > 0 || !combat.hasPistol || combat.pistolAmmo <= 0 || player.inCar) return false;
  combat.pistolTimer = PLAYER.pistolCooldown;
  combat.pistolAmmo -= 1;
  combat.muzzle = 0.09;
  addWanted(police, WANTED.shoot, now);
  let best = null;
  let bestD = PLAYER.pistolRange;
  const consider = (target, x, z, kind) => {
    const d = inFront(player.x, player.z, player.heading, x, z, PLAYER.pistolRange, 0.32);
    if (d && d < bestD) {
      bestD = d;
      best = { target, kind };
    }
  };
  for (const ped of peds) if (ped.alive && !ped.down) consider(ped, ped.x, ped.z, 'ped');
  for (const off of police.officers) if (off.alive) consider(off, off.x, off.z, 'officer');
  for (const cop of police.cops) consider(cop, cop.x, cop.z, 'copcar');
  if (!best) return true; // shot fired, nothing hit
  if (best.kind === 'ped') knockPed(best.target, player.x, player.z);
  else if (best.kind === 'officer') {
    best.target.alive = false;
    addWanted(police, WANTED.killCop, now);
  } else {
    best.target.speed *= 0.4; // a hit slows a cruiser down
  }
  return true;
}

export function stepCombat(combat, dt) {
  if (combat.punchTimer > 0) combat.punchTimer -= dt;
  if (combat.pistolTimer > 0) combat.pistolTimer -= dt;
  if (combat.muzzle > 0) combat.muzzle -= dt;
  if (combat.swing > 0) combat.swing -= dt;
}

// A player car ramming a pedestrian or a cop car at speed is a crime too.
export function carHitCheck(playerCar, peds, police, now, audio) {
  for (const ped of peds) {
    if (!ped.alive || ped.down) continue;
    if (dist2D(playerCar.x, playerCar.z, ped.x, ped.z) < 2.2 && Math.abs(playerCar.speed) > 6) {
      knockPed(ped, playerCar.x, playerCar.z);
      addWanted(police, WANTED.hitPed, now);
      if (audio) audio.crash();
    }
  }
  for (const cop of police.cops) {
    if (dist2D(playerCar.x, playerCar.z, cop.x, cop.z) < 3.4 && Math.abs(playerCar.speed) > 8) {
      cop.speed *= 0.3;
      playerCar.speed *= 0.55;
      addWanted(police, 1, now);
      if (audio) audio.crash();
    }
  }
}
