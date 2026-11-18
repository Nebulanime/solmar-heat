// SOLMAR HEAT — pedestrians: Solmar locals strolling the sidewalks, pausing at
// corners, crossing avenues, and scattering when gunfire or a speeding car gets
// close. They give the city its life and the traffic something to brake for.
import { CFG, clamp } from './config.mjs';
import { randomSidewalkPoint, clampToCity } from './city.mjs';
import { resolveCollision } from './player.mjs';

export function spawnPeds(city, rng, count) {
  const colors = ['#e05a4e', '#4e7de0', '#e0c24e', '#4ee07a', '#d04ee0', '#e08a4e', '#4ed0e0', '#f0f0f0', '#30343a', '#a0d04e'];
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const p = randomSidewalkPoint(rng);
    peds.push({
      x: p.x, z: p.z,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(9, 20),
      color: rng.pick(colors),
      state: 'walk', // 'walk' | 'idle' | 'flee'
      stateTime: rng.range(0, 6),
      targetX: p.x,
      targetZ: p.z,
      panic: 0,
    });
  }
  return peds;
}

export function stepPeds(S, dt) {
  const rng = S.rng;
  const px = S.player.x;
  const pz = S.player.z;
  const danger = S.bullets.length > 0 || (!S.player.onFoot && S.player.car && Math.abs(S.player.car.speed) > 120);
  for (const ped of S.peds) {
    ped.stateTime -= dt;
    const dx = ped.x - px;
    const dz = ped.z - pz;
    const d2 = dx * dx + dz * dz;
    if (ped.state !== 'flee' && d2 < 70 * 70 && (danger || S.heat > 40)) {
      ped.state = 'flee';
      ped.stateTime = rng.range(2, 4);
      ped.panic = 1;
      // A fleeing local sometimes drops a few dollars in the panic.
      if (rng.chance(0.25)) S.looseCash.push({ x: ped.x, z: ped.z, amount: 10, life: 20 });
    }
    if (ped.state === 'flee') {
      const d = Math.sqrt(d2) || 1;
      ped.heading = Math.atan2(dx / d, dz / d);
      const sp = 46;
      ped.x += Math.sin(ped.heading) * sp * dt;
      ped.z += Math.cos(ped.heading) * sp * dt;
      if (ped.stateTime <= 0) { ped.state = 'walk'; ped.panic = 0; }
    } else if (ped.state === 'idle') {
      if (ped.stateTime <= 0) {
        ped.state = 'walk';
        const t = randomSidewalkPoint(rng);
        ped.targetX = t.x;
        ped.targetZ = t.z;
        ped.stateTime = rng.range(6, 14);
      }
    } else {
      const tx = ped.targetX - ped.x;
      const tz = ped.targetZ - ped.z;
      const d = Math.hypot(tx, tz);
      if (d < 4 || ped.stateTime <= 0) {
        if (rng.chance(0.3)) {
          ped.state = 'idle';
          ped.stateTime = rng.range(2, 7);
        } else {
          const t = randomSidewalkPoint(rng);
          ped.targetX = t.x;
          ped.targetZ = t.z;
          ped.stateTime = rng.range(6, 14);
        }
      } else {
        ped.heading = Math.atan2(tx / d, tz / d);
        ped.x += Math.sin(ped.heading) * ped.speed * dt;
        ped.z += Math.cos(ped.heading) * ped.speed * dt;
      }
    }
    const clamped = clampToCity(ped.x, ped.z);
    const fixed = resolveCollision(S.city, clamped.x, clamped.z, 4);
    ped.x = clamp(fixed.x, -CFG.halfWorld + 8, CFG.halfWorld - 8);
    ped.z = clamp(fixed.z, -CFG.halfWorld + 8, CFG.halfWorld - 8);
  }
}
