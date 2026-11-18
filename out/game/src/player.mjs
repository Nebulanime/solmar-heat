// SOLMAR HEAT — Jax Rook on foot: camera-relative WASD movement, sprinting,
// building collision, and stealing cars with E. Driving itself lives in
// vehicles.mjs; this module only decides when Jax is in or out of a car.
import { CFG, clamp, angleLerp } from './config.mjs';
import { clampToCity } from './city.mjs';

export function createPlayer(x, z) {
  return {
    x, z,
    heading: 0,
    speed: 0,
    health: CFG.playerHealth,
    cash: 0,
    onFoot: true,
    car: null,
    gunCooldown: 0,
    color: '#e8b04a',
  };
}

export function resolveCollision(city, x, z, r) {
  for (const b of city.buildings) {
    const hw = b.w / 2;
    const hd = b.d / 2;
    const nx = clamp(x, b.x - hw, b.x + hw);
    const nz = clamp(z, b.z - hd, b.z + hd);
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 < 0.0001) {
        // Dead centre: push out along the smallest penetration axis.
        const px = hw + r - Math.abs(x - b.x);
        const pz = hd + r - Math.abs(z - b.z);
        if (px < pz) x += (x >= b.x ? px : -px);
        else z += (z >= b.z ? pz : -pz);
      } else {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        z = nz + (dz / d) * r;
      }
    }
  }
  return { x, z };
}

export function stepPlayer(S, input, dt) {
  const p = S.player;
  if (p.gunCooldown > 0) p.gunCooldown -= dt;
  if (!p.onFoot) return;
  const fwd = input.forward();
  const strafe = input.strafe();
  if (fwd === 0 && strafe === 0) {
    p.speed = 0;
    return;
  }
  const yaw = S.camera.yaw;
  // Camera-relative movement: W walks away from the camera, D strafes right.
  const mx = Math.sin(yaw) * fwd + Math.cos(yaw) * strafe;
  const mz = Math.cos(yaw) * fwd - Math.sin(yaw) * strafe;
  const len = Math.hypot(mx, mz) || 1;
  const speed = input.run() ? CFG.runSpeed : CFG.walkSpeed;
  const targetHeading = Math.atan2(mx / len, mz / len);
  p.heading = angleLerp(p.heading, targetHeading, Math.min(1, dt * 12));
  p.speed = speed;
  const nx = p.x + (mx / len) * speed * dt;
  const nz = p.z + (mz / len) * speed * dt;
  const clamped = clampToCity(nx, nz);
  const fixed = resolveCollision(S.city, clamped.x, clamped.z, CFG.playerRadius);
  p.x = fixed.x;
  p.z = fixed.z;
}

export function nearestCar(S, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of S.cars) {
    if (car.kind === 'cop' || car.wrecked) continue;
    const dx = car.x - S.player.x;
    const dz = car.z - S.player.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

// True when Jax is close enough to a stealable car for the E prompt to show.
export function canSteal(S) {
  return S.player.onFoot && nearestCar(S, 30) !== null;
}

export function enterCar(S) {
  const p = S.player;
  if (!p.onFoot) return false;
  const car = nearestCar(S, 30);
  if (!car) return false;
  p.onFoot = false;
  p.car = car;
  car.kind = 'player';
  car.driver = true;
  car.speed = 0;
  S.stats.carsStolen += 1;
  S.heat = Math.min(CFG.heatMax, S.heat + CFG.heatStealCar);
  S.lastCrime = S.time;
  S.message = 'Car stolen! Solmar PD is on to you.';
  S.messageUntil = S.time + 3;
  if (S.audio) S.audio.horn();
  return true;
}

export function exitCar(S) {
  const p = S.player;
  if (p.onFoot || !p.car) return false;
  const car = p.car;
  car.kind = 'traffic';
  car.driver = false;
  car.speed = 0;
  p.x = car.x + Math.cos(car.heading + Math.PI / 2) * 10;
  p.z = car.z + Math.sin(car.heading + Math.PI / 2) * 10;
  const fixed = resolveCollision(S.city, p.x, p.z, CFG.playerRadius);
  p.x = fixed.x;
  p.z = fixed.z;
  p.heading = car.heading;
  p.onFoot = true;
  p.car = null;
  return true;
}
