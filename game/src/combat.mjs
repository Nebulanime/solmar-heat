// SOLMAR HEAT — combat.mjs
// Fist fights and gunfire. Punching hits the nearest pedestrian or cop
// in front of the player; shooting fires a hitscan bullet toward the
// aim direction and can hit peds, cops and traffic cars.
import { PLAYER } from './config.mjs';
import { knockDown } from './pedestrians.mjs';

export function createCombat() {
  return { bullets: [], flashes: [] };
}

// Punch: damage the closest living target in range in front of the player.
export function doPunch(combat, player, peds, police, onHit) {
  const px = player.x, py = player.y;
  let best = null, bestD = PLAYER.punchRange, bestKind = null;
  for (const p of peds) {
    if (p.state === 'down') continue;
    const d = Math.hypot(p.x - px, p.y - py);
    if (d < bestD) { best = p; bestD = d; bestKind = 'ped'; }
  }
  for (const u of police.units) {
    const d = Math.hypot(u.car.x - px, u.car.y - py);
    if (d < bestD) { best = u; bestD = d; bestKind = 'cop'; }
  }
  if (!best) return null;
  combat.flashes.push({ x: px + Math.cos(player.angle) * 24, y: py + Math.sin(player.angle) * 24, t: 0.15 });
  if (bestKind === 'ped') {
    const cash = knockDown(best);
    if (onHit) onHit('ped', cash);
    return { kind: 'ped', cash };
  }
  // Punching a cop: shove their car back and raise the heat.
  best.car.x -= Math.cos(player.angle) * 26;
  best.car.y -= Math.sin(player.angle) * 26;
  if (onHit) onHit('cop', 0);
  return { kind: 'cop', cash: 0 };
}

// Shoot: a fast tracer toward (tx, ty); first target in the line takes damage.
export function doShoot(combat, player, tx, ty, peds, police, traffic, onHit) {
  const angle = Math.atan2(ty - player.y, tx - player.x);
  const range = 460;
  const ex = player.x + Math.cos(angle) * range;
  const ey = player.y + Math.sin(angle) * range;
  combat.bullets.push({ x: player.x, y: player.y, ex, ey, t: 0.12 });
  let best = null, bestD = range, bestKind = null;
  const scan = (x, y) => {
    const dx = x - player.x, dy = y - player.y;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (along < 0 || along > range) return;
    const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
    if (perp < 18 && along < bestD) { bestD = along; best = { x, y }; bestKind = 'target'; }
  };
  for (const p of peds) if (p.state !== 'down') scan(p.x, p.y);
  for (const u of police.units) scan(u.car.x, u.car.y);
  for (const c of traffic) if (!c.wrecked) scan(c.x, c.y);
  if (!best) return null;
  // Find which list the hit point belongs to, for the cash / heat effect.
  for (const p of peds) {
    if (Math.hypot(p.x - best.x, p.y - best.y) < 1) {
      const cash = knockDown(p);
      if (onHit) onHit('ped', cash);
      return { kind: 'ped', cash };
    }
  }
  for (const u of police.units) {
    if (Math.hypot(u.car.x - best.x, u.car.y - best.y) < 1) {
      u.car.speed = 0;
      if (onHit) onHit('cop', 0);
      return { kind: 'cop', cash: 0 };
    }
  }
  if (onHit) onHit('car', 0);
  return { kind: 'car', cash: 0 };
}

// A bullet that only scares: firing into the air still panics the street.
export function warningShot(combat, player) {
  combat.bullets.push({
    x: player.x, y: player.y,
    ex: player.x + Math.cos(player.angle) * 300,
    ey: player.y + Math.sin(player.angle) * 300,
    t: 0.1,
  });
}

export function updateCombat(combat, dt) {
  for (const b of combat.bullets) b.t -= dt;
  combat.bullets = combat.bullets.filter((b) => b.t > 0);
  for (const f of combat.flashes) f.t -= dt;
  combat.flashes = combat.flashes.filter((f) => f.t > 0);
}
