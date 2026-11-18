// SOLMAR HEAT — police.mjs
// The wanted system: stars rise when the player commits crimes, police
// units spawn at the city edge, chase the player, ram their car and try
// to bust them on foot. Stars decay when the player stays out of sight.
import { WANTED, COLORS } from './config.mjs';
import { makeCar } from './vehicles.mjs';

export function createPolice() {
  return {
    wanted: 0,
    heat: 0, // fractional heat feeding the star display
    sinceCrime: 99,
    units: [], // police cars / officers
    sirenTimer: 0,
    busted: false,
  };
}

export function addWanted(police, stars) {
  police.wanted = Math.min(WANTED.max, police.wanted + stars);
  police.heat = police.wanted;
  police.sinceCrime = 0;
  syncUnits(police);
}

export function setWanted(police, stars) {
  police.wanted = Math.max(0, Math.min(WANTED.max, stars));
  police.heat = police.wanted;
  syncUnits(police);
}

// Keep the number of active units in line with the wanted level.
function syncUnits(police) {
  const want = WANTED.copsPerStar[police.wanted];
  while (police.units.length < want) {
    police.units.push(spawnUnit(police.units.length));
  }
  while (police.units.length > want) police.units.pop();
}

function spawnUnit(i) {
  const edge = [
    { x: 120, y: 120 }, { x: 3080, y: 120 },
    { x: 120, y: 2280 }, { x: 3080, y: 2280 },
    { x: 1600, y: 100 }, { x: 1600, y: 2300 },
  ][i % 6];
  const car = makeCar(edge.x, edge.y, 0, COLORS.copCar, 'police');
  car.speed = 0;
  return { car, state: 'chase', bustTimer: 0 };
}

export function updatePolice(police, player, dt, onBusted) {
  police.sinceCrime += dt;
  police.sirenTimer -= dt;
  if (police.wanted > 0 && police.sirenTimer <= 0) {
    police.sirenTimer = 2.4;
    police.siren = true;
  } else {
    police.siren = false;
  }
  // Decay: staying clean for a while drops a star.
  if (police.wanted > 0 && police.sinceCrime > WANTED.decayDelay) {
    police.heat -= WANTED.decayRate * dt;
    if (police.heat <= police.wanted - 1) {
      police.wanted -= 1;
      police.heat = police.wanted;
      syncUnits(police);
    }
  }
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  const speed = WANTED.copSpeed[police.wanted] || 0;
  for (const u of police.units) {
    const c = u.car;
    const dx = px - c.x, dy = py - c.y;
    const d = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    let da = wantAngle - c.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, da));
    c.speed = d > 46 ? speed : 0;
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    // Bust: a cop standing next to the player on foot for 2 seconds.
    if (!player.inCar && d < 40) {
      u.bustTimer += dt;
      if (u.bustTimer > 2 && !police.busted) {
        police.busted = true;
        if (onBusted) onBusted();
      }
    } else {
      u.bustTimer = 0;
    }
    // Ramming the player's car slows it and hurts the player a little.
    if (player.inCar && d < 40) {
      player.inCar.speed *= 0.92;
    }
  }
}

export function clearWanted(police) {
  police.wanted = 0;
  police.heat = 0;
  police.units = [];
  police.busted = false;
}

// How close the nearest unit is to the player (Infinity when no units).
export function nearestCopDistance(police, player) {
  let best = Infinity;
  for (const u of police.units) {
    const d = Math.hypot(u.car.x - player.x, u.car.y - player.y);
    if (d < best) best = d;
  }
  return best;
}
