// SOLMAR HEAT — player.mjs
// Nova Vega on foot: movement, running, health, money, punching and
// shooting. Driving is handled by vehicles.mjs; this module owns the
// on-foot body and the crime consequences of what the player does.
import { PLAYER, WORLD_W, WORLD_H } from './config.mjs';
import { hitBuilding, clampWorld } from './city.mjs';

export function createPlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0, angle: 0,
    health: PLAYER.maxHealth,
    money: 50,
    inCar: null, // vehicle object when driving, else null
    punchTimer: 0,
    shootTimer: 0,
    moving: false,
    dead: false,
  };
}

export function updatePlayer(p, input, city, dt, onCrime) {
  if (p.dead || p.inCar) return;
  const axis = input.axis();
  const running = input.action('run');
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(axis.x, axis.y) || 1;
  p.moving = axis.x !== 0 || axis.y !== 0;
  p.vx = (axis.x / len) * speed * (p.moving ? 1 : 0);
  p.vy = (axis.y / len) * speed * (p.moving ? 1 : 0);
  if (p.moving) p.angle = Math.atan2(p.vy, p.vx);

  let nx = p.x + p.vx * dt;
  let ny = p.y + p.vy * dt;
  if (hitBuilding(city, nx, p.y, PLAYER.radius)) nx = p.x;
  if (hitBuilding(city, p.x, ny, PLAYER.radius)) ny = p.y;
  const clamped = clampWorld(nx, ny, PLAYER.radius);
  p.x = clamped.x; p.y = clamped.y;

  p.punchTimer = Math.max(0, p.punchTimer - dt);
  p.shootTimer = Math.max(0, p.shootTimer - dt);
  if (input.actionPressed('punch') && p.punchTimer <= 0) {
    p.punchTimer = PLAYER.punchCooldown;
    p.punching = true;
    if (onCrime) onCrime('punch');
  } else {
    p.punching = false;
  }
  if (input.actionPressed('shoot') && p.shootTimer <= 0) {
    p.shootTimer = 0.5;
    p.shotFired = true;
    if (onCrime) onCrime('shoot');
  } else {
    p.shotFired = false;
  }
  if (p.health <= 0) { p.dead = true; p.health = 0; }
}

export function hurtPlayer(p, amount) {
  p.health = Math.max(0, p.health - amount);
  if (p.health <= 0) p.dead = true;
}

export function healPlayer(p, amount) {
  p.health = Math.min(PLAYER.maxHealth, p.health + amount);
}

// True when the player is far enough from every cop to start cooling down.
export function isHiddenFromPolice(p, police) {
  for (const u of police.units) {
    const d = Math.hypot(u.car.x - p.x, u.car.y - p.y);
    if (d < 420) return false;
  }
  return true;
}

export function payPlayer(p, amount) { p.money += amount; }
