// SOLMAR HEAT — pedestrians.mjs
// Pedestrians: walkers on the sidewalks who stroll, panic and run when
// they hear gunshots or see a car speeding at them, and occasionally
// drop a little cash when scared off. They make the sidewalks alive.
import { COLORS } from './config.mjs';
import { hitBuilding } from './city.mjs';

export function spawnPedestrians(rng, city, count) {
  const peds = [];
  let guard = 0;
  while (peds.length < count && guard++ < count * 30) {
    const x = rng.range(80, 2800);
    const y = rng.range(80, 2300);
    if (hitBuilding(city, x, y, 16)) continue;
    peds.push({
      x, y, angle: rng.range(0, Math.PI * 2),
      speed: rng.range(28, 55),
      color: rng.pick(COLORS.ped),
      state: 'walk', // walk | panic | down
      panicTimer: 0,
      changeTimer: rng.range(2, 6),
      wallet: rng.int(5, 40),
    });
  }
  return peds;
}

export function updatePedestrians(peds, city, player, dt, onScared) {
  for (const p of peds) {
    if (p.state === 'down') continue;
    p.changeTimer -= dt;
    p.panicTimer = Math.max(0, p.panicTimer - dt);
    if (p.panicTimer <= 0 && p.state === 'panic') p.state = 'walk';
    if (p.changeTimer <= 0) {
      p.changeTimer = p.state === 'panic' ? 0.8 : 2 + Math.random() * 4;
      p.angle = Math.random() * Math.PI * 2;
    }
    const speed = p.state === 'panic' ? p.speed * 3.2 : p.speed;
    let nx = p.x + Math.cos(p.angle) * speed * dt;
    let ny = p.y + Math.sin(p.angle) * speed * dt;
    if (hitBuilding(city, nx, ny, 10)) { p.angle += Math.PI / 2; nx = p.x; ny = p.y; }
    p.x = Math.max(20, Math.min(2860, nx));
    p.y = Math.max(20, Math.min(2380, ny));
    // Panic when the player (or their car) charges at them.
    if (player && !p.scared) {
      const px = player.inCar ? player.inCar.x : player.x;
      const py = player.inCar ? player.inCar.y : player.y;
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < 90) {
        p.state = 'panic';
        p.panicTimer = 2.5;
        p.angle = Math.atan2(p.y - py, p.x - px);
        p.scared = true;
        if (onScared) onScared(p);
      }
    }
  }
}

// Scare every pedestrian within radius r of (x, y) — gunshots do this.
export function scareNearby(peds, x, y, r) {
  let n = 0;
  for (const p of peds) {
    if (p.state === 'down') continue;
    if (Math.hypot(p.x - x, p.y - y) < r) {
      p.state = 'panic';
      p.panicTimer = 3;
      p.angle = Math.atan2(p.y - y, p.x - x);
      n++;
    }
  }
  return n;
}

// Knock a pedestrian down; returns the cash they dropped (0 if none).
export function knockDown(ped) {
  if (ped.state === 'down') return 0;
  ped.state = 'down';
  const cash = ped.wallet;
  ped.wallet = 0;
  return cash;
}

// Help a downed pedestrian back up (they walk off, shaken, no cash left).
export function revivePed(ped) {
  if (ped.state !== 'down') return;
  ped.state = 'walk';
  ped.panicTimer = 2;
  ped.angle = Math.random() * Math.PI * 2;
}
