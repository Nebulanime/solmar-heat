// SOLMAR HEAT — combat: Jax's pistol (F or click), bullets that fly, hit cars,
// cruisers and pedestrians, wrecking a cruiser's driver and raising the heat.
// A wrecked cruiser drops its driver; a killed cop is the fastest way to 5 stars.
import { CFG, clamp } from './config.mjs';
import { addHeat } from './police.mjs';

export function aimHeading(S, input) {
  // Aim at the mouse when the pointer is far from the player, else face travel.
  if (input && typeof input.mouse === 'function') {
    const m = input.mouse();
    if (m && typeof m.x === 'number') {
      const aim = S.screenAim;
      if (aim) return Math.atan2(aim.x, aim.y);
    }
  }
  return S.player.heading;
}

export function tryFire(S, input) {
  const p = S.player;
  if (p.gunCooldown > 0) return false;
  p.gunCooldown = CFG.gunCooldown;
  const heading = aimHeading(S, input);
  const ox = p.x + Math.sin(heading) * 10;
  const oz = p.z + Math.cos(heading) * 10;
  S.bullets.push({
    x: ox, z: oz,
    vx: Math.sin(heading) * CFG.bulletSpeed,
    vz: Math.cos(heading) * CFG.bulletSpeed,
    life: CFG.bulletLife,
  });
  S.stats.shotsFired += 1;
  addHeat(S, CFG.heatShotFired);
  if (S.audio) S.audio.shot();
  return true;
}

export function stepBullets(S, dt) {
  for (let i = S.bullets.length - 1; i >= 0; i -= 1) {
    const b = S.bullets[i];
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      // Hit a cruiser: damage it; three hits wreck it and spike the heat.
      for (const cop of S.cops) {
        const dx = b.x - cop.x;
        const dz = b.z - cop.z;
        if (dx * dx + dz * dz < 12 * 12) {
          dead = true;
          cop.hp = (cop.hp ?? 3) - 1;
          if (cop.hp <= 0 && !cop.wrecked) {
            cop.wrecked = true;
            cop.speed = 0;
            addHeat(S, CFG.heatCopKilled);
            S.message = 'Cruiser down! Solmar PD wants you bad now.';
            S.messageUntil = S.time + 3;
            S.stats.copsDown += 1;
          }
          break;
        }
      }
    }
    if (!dead) {
      for (const car of S.cars) {
        if (car.kind === 'player' || car.wrecked) continue;
        const dx = b.x - car.x;
        const dz = b.z - car.z;
        if (dx * dx + dz * dz < 11 * 11) {
          dead = true;
          car.speed *= 0.5;
          break;
        }
      }
    }
    if (!dead) {
      for (const ped of S.peds) {
        const dx = b.x - ped.x;
        const dz = b.z - ped.z;
        if (dx * dx + dz * dz < 7 * 7) {
          dead = true;
          ped.state = 'flee';
          ped.stateTime = 3;
          ped.panic = 1;
          addHeat(S, 6);
          break;
        }
      }
    }
    if (!dead) {
      for (const building of S.city.buildings) {
        const hw = building.w / 2;
        const hd = building.d / 2;
        if (b.x > building.x - hw && b.x < building.x + hw && b.z > building.z - hd && b.z < building.z + hd) {
          dead = true;
          break;
        }
      }
    }
    if (dead) S.bullets.splice(i, 1);
  }
  if (S.tracer) {
    S.tracer.life -= dt;
    if (S.tracer.life <= 0) S.tracer = null;
  }
}

export function stepPickups(S, dt) {
  const p = S.player;
  for (let i = S.looseCash.length - 1; i >= 0; i -= 1) {
    const c = S.looseCash[i];
    c.life -= dt;
    const dx = c.x - p.x;
    const dz = c.z - p.z;
    if (dx * dx + dz * dz < 14 * 14) {
      p.cash += c.amount;
      S.looseCash.splice(i, 1);
      if (S.audio) S.audio.pickup();
      continue;
    }
    if (c.life <= 0) S.looseCash.splice(i, 1);
  }
}
