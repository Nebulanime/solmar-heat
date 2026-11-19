// SOLMAR HEAT world: the player, traffic, pedestrians, police, helicopter and
// the five-mission story of Nova Vega. Pure simulation + dynamic geometry;
// the DOM HUD and the renderer live in hud.js and gl.js.
import { CITY, MISSIONS, SHOPS, CAR_COLORS, PLAYER_CAR_COLOR, PED_SHIRTS, POLICE_BODY, POLICE_TRIM, HELI_BODY } from './config.js';
import { mulberry32, pick, range, rangeInt, clamp, lerp, angleLerp, dist2 } from './rng.js';
import { buildCity, onRoad, nearestRoadPoint } from './city.js';
import { wantedForCrime, policeCount, heliActive, atMarker, collideBuildings, clampToCity, POLICE_SPAWN_DIST } from './logic.js';
import { Geom } from './gl.js';

export function createWorld(seed, timePreset) {
  const rng = mulberry32(seed);
  const city = buildCity(seed, timePreset.night);
  const state = {
    seed, rng, city, time: timePreset, clock: timePreset.hour * 3600,
    player: {
      x: 0, z: 0, angle: Math.PI / 2, speed: 0, onFoot: false,
      health: 100, armor: 0, money: 250, ammo: 24, wanted: 0, quiet: 0,
      walkPhase: 0, carColor: PLAYER_CAR_COLOR.slice(),
    },
    cars: [], peds: [], police: [], heli: { angle: 0, x: 0, z: 0 },
    mission: 0, done: [], missionPhase: 'go', missionTimer: 0,
    dialog: '', dialogUntil: 0, banner: '', bannerUntil: 0,
    radio: 0, screen: 'title', // title | play | passed | map | busted | complete | paused
    passedInfo: '', elapsed: 0, shots: 0, busts: 0,
    frozen: false, // set by shots.js: after staging, the scene holds still for its photo
    targetCar: null, flash: 0, siren: 0, camX: 0, camZ: 0, camA: 0,
  };
  spawnTraffic(state);
  spawnPeds(state);
  spawnTargetCar(state);
  return state;
}

function spawnTraffic(state) {
  const rng = state.rng;
  for (let i = 0; i < 11; i++) {
    const p = nearestRoadPoint(range(rng, -200, 200), range(rng, -200, 200));
    const alongX = rng() < 0.5;
    state.cars.push({
      x: p.x, z: p.z, angle: alongX ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI),
      speed: range(rng, 7, 12), color: pick(rng, CAR_COLORS), alongX,
      brake: 0,
    });
  }
}

function spawnPeds(state) {
  const rng = state.rng;
  for (let i = 0; i < 16; i++) {
    const x = range(rng, -210, 210), z = range(rng, -210, 210);
    state.peds.push({
      x, z, tx: x + range(rng, -40, 40), tz: z + range(rng, -40, 40),
      angle: range(rng, 0, Math.PI * 2), speed: range(rng, 1.2, 2.0),
      shirt: pick(rng, PED_SHIRTS), phase: range(rng, 0, 6), skin: pick(rng, [[0.85, 0.65, 0.5], [0.55, 0.4, 0.3], [0.95, 0.8, 0.65]]),
    });
  }
}

function spawnTargetCar(state) {
  // The mint Comet GT for mission 2, parked uptown.
  state.targetCar = { x: 108, z: -54, angle: Math.PI / 2, color: [0.15, 0.75, 0.35], stolen: false };
}

export function currentMission(state) {
  return MISSIONS[state.mission] ?? null;
}

export function missionTarget(state) {
  const m = currentMission(state);
  if (!m) return null;
  if (m.kind === 'steal' && state.missionPhase === 'go') return { x: state.targetCar.x, z: state.targetCar.z };
  if (m.kind === 'steal') return { x: 108, z: 54 }; // the garage, on the spray-shop block
  return { x: m.target.x, z: m.target.z };
}

function say(state, text, seconds = 5) {
  state.dialog = text;
  state.dialogUntil = state.elapsed + seconds;
}

function banner(state, text, seconds = 3.5) {
  state.banner = text;
  state.bannerUntil = state.elapsed + seconds;
}

export function startMission(state) {
  const m = currentMission(state);
  if (!m) { state.screen = 'complete'; return; }
  state.missionPhase = 'go';
  state.missionTimer = m.timeLimit ?? 0;
  if (m.wanted) state.player.wanted = Math.max(state.player.wanted, m.wanted);
  say(state, `${m.giver}: ${m.brief}`, 7);
  banner(state, `MISSION: ${m.title}`, 4);
}

export function completeMission(state) {
  const m = currentMission(state);
  if (!m) return;
  state.player.money += m.pay;
  state.done.push(m.id);
  state.mission += 1;
  state.screen = 'passed';
  state.passedInfo = `${m.title} — $${m.pay}`;
  state.player.wanted = Math.max(0, state.player.wanted - 2);
}

function failMission(state, why) {
  state.screen = 'passed';
  state.passedInfo = `MISSION FAILED — ${why}`;
  state.missionTimer = 0;
}

// --- driving ---------------------------------------------------------------

function drivePlayer(state, dt, input) {
  const p = state.player;
  const accel = input.up ? 26 : input.down ? -14 : 0;
  p.speed += accel * dt;
  p.speed *= Math.pow(0.45, dt); // drag + rolling resistance
  if (input.brake) p.speed *= Math.pow(0.05, dt);
  p.speed = clamp(p.speed, -10, CITY.maxSpeed);
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const spd = Math.abs(p.speed);
  if (spd > 0.3) p.angle += steer * 1.9 * dt * clamp(spd / 10, 0.25, 1) * Math.sign(p.speed);
  const fx = Math.sin(p.angle), fz = Math.cos(p.angle);
  let nx = p.x + fx * p.speed * dt;
  let nz = p.z + fz * p.speed * dt;
  const hit = collideBuildings(nx, nz, 1.6, state.city.buildings);
  if (hit.x !== nx || hit.z !== nz) { p.speed *= 0.55; if (spd > 12) { p.wanted = wantedForCrime(p.wanted, 'hit'); p.health = Math.max(0, p.health - 4); } }
  const c = clampToCity(hit.x, hit.z);
  p.x = c.x; p.z = c.z;
  // Hitting a pedestrian at speed is a crime, and it slows the car.
  for (const ped of state.peds) {
    if (dist2(p.x, p.z, ped.x, ped.z) < 4 && spd > 6) {
      p.wanted = wantedForCrime(p.wanted, 'hit');
      ped.tx = ped.x + (ped.x - p.x) * 3; ped.tz = ped.z + (ped.z - p.z) * 3;
      p.speed *= 0.7;
    }
  }
}

function walkPlayer(state, dt, input) {
  const p = state.player;
  const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const mz = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const len = Math.hypot(mx, mz);
  const sp = (input.sprint ? 6.5 : 3.6);
  if (len > 0) {
    const a = Math.atan2(mx, mz);
    p.angle = angleLerp(p.angle, a, Math.min(1, dt * 10));
    const nx = p.x + Math.sin(a) * sp * dt;
    const nz = p.z + Math.cos(a) * sp * dt;
    const hit = collideBuildings(nx, nz, 0.6, state.city.buildings);
    const c = clampToCity(hit.x, hit.z);
    p.x = c.x; p.z = c.z;
    p.walkPhase += dt * sp * 1.6;
  }
}

// --- traffic / peds / police ------------------------------------------------

function updateTraffic(state, dt) {
  const lines = state.city.lines;
  for (const car of state.cars) {
    const near = (v) => { let best = null, bd = 99; for (const l of lines) { const d = Math.abs(v - l); if (d < bd) { bd = d; best = l; } } return { line: best, d: bd }; };
    // Follow the current road; at an intersection, sometimes turn.
    if (car.alongX) {
      car.z = lerp(car.z, near(car.z).line, Math.min(1, dt * 3));
      const cross = near(car.x);
      if (cross.d < 3 && state.rng() < dt * 0.5) { car.alongX = false; car.angle = state.rng() < 0.5 ? 0 : Math.PI; }
      car.x += Math.sin(car.angle) * car.speed * dt;
      car.z += Math.cos(car.angle) * car.speed * dt;
      if (Math.abs(car.x) > 240) car.angle = car.angle > 0 ? -Math.PI / 2 : Math.PI / 2;
    } else {
      car.x = lerp(car.x, near(car.x).line, Math.min(1, dt * 3));
      const cross = near(car.z);
      if (cross.d < 3 && state.rng() < dt * 0.5) { car.alongX = true; car.angle = state.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2; }
      car.x += Math.sin(car.angle) * car.speed * dt;
      car.z += Math.cos(car.angle) * car.speed * dt;
      if (Math.abs(car.z) > 240) car.angle = car.angle === 0 ? Math.PI : 0;
    }
    // Slow down for the car ahead.
    for (const other of state.cars) {
      if (other === car) continue;
      const dx = other.x - car.x, dz = other.z - car.z;
      const ahead = dx * Math.sin(car.angle) + dz * Math.cos(car.angle);
      if (ahead > 0 && ahead < 9 && Math.abs(dx * Math.cos(car.angle) - dz * Math.sin(car.angle)) < 2.5) car.brake = 1;
    }
    if (car.brake) { car.speed = Math.max(0, car.speed - 20 * dt); car.brake = 0; }
    else car.speed = Math.min(12, car.speed + 2 * dt);
    const c = clampToCity(car.x, car.z);
    car.x = c.x; car.z = c.z;
  }
}

function updatePeds(state, dt) {
  for (const ped of state.peds) {
    const dx = ped.tx - ped.x, dz = ped.tz - ped.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5) {
      ped.tx = clamp(ped.x + (state.rng() - 0.5) * 90, -220, 220);
      ped.tz = clamp(ped.z + (state.rng() - 0.5) * 90, -220, 220);
    } else {
      const a = Math.atan2(dx, dz);
      ped.angle = angleLerp(ped.angle, a, Math.min(1, dt * 6));
      const hit = collideBuildings(ped.x + Math.sin(a) * ped.speed * dt, ped.z + Math.cos(a) * ped.speed * dt, 0.5, state.city.buildings);
      ped.x = hit.x; ped.z = hit.z;
      ped.phase += dt * ped.speed * 2.4;
    }
  }
}

function updatePolice(state, dt) {
  const p = state.player;
  const want = policeCount(p.wanted);
  while (state.police.length < want) {
    const a = state.rng() * Math.PI * 2;
    state.police.push({
      x: p.x + Math.sin(a) * POLICE_SPAWN_DIST, z: p.z + Math.cos(a) * POLICE_SPAWN_DIST,
      angle: 0, speed: 0, flash: state.rng() < 0.5, cd: 0,
    });
  }
  while (state.police.length > want) state.police.pop();
  for (const cop of state.police) {
    const dx = p.x - cop.x, dz = p.z - cop.z;
    const d = Math.hypot(dx, dz);
    const target = Math.atan2(dx, dz);
    cop.angle = angleLerp(cop.angle, target, Math.min(1, dt * 2.2));
    // Chase hard from afar, but hold a few metres off once close: a cruiser
    // glued to the bumper reads as one blob, and it should ram, back off,
    // then come again — not sit inside the player's car.
    if (d < 6 && cop.cd > 0) cop.speed = Math.max(-10, cop.speed - 30 * dt);
    else cop.speed = clamp(cop.speed + (d > 12 ? 14 : -8) * dt, -10, 30);
    cop.x += Math.sin(cop.angle) * cop.speed * dt;
    cop.z += Math.cos(cop.angle) * cop.speed * dt;
    const hit = collideBuildings(cop.x, cop.z, 1.6, state.city.buildings);
    cop.x = hit.x; cop.z = hit.z;
    if (cop.cd > 0) cop.cd -= dt;
    if (d < 3.2 && cop.cd <= 0) {
      // A ram: one solid hit, then the cruiser backs off for a moment.
      p.health = Math.max(0, p.health - 8);
      p.speed = Math.max(0, p.speed - 6 * dt);
      cop.speed = -8;
      cop.cd = 1.4;
    }
  }
  // Helicopter circles overhead once the heat is serious.
  if (heliActive(p.wanted)) {
    state.heli.angle += dt * 0.45;
    state.heli.x = p.x + Math.cos(state.heli.angle) * 26;
    state.heli.z = p.z + Math.sin(state.heli.angle) * 26;
  }
  // Quiet time cools the wanted level, unless a cop is right on top of you.
  const nearest = state.police.reduce((m, c) => Math.min(m, Math.hypot(c.x - p.x, c.z - p.z)), 999);
  if (p.wanted > 0 && nearest > 25) {
    p.quiet += dt;
    if (p.quiet > 14) { p.wanted -= 1; p.quiet = 0; banner(state, 'The heat is cooling off…'); }
  } else p.quiet = 0;
}

// --- actions ----------------------------------------------------------------

export function tryAction(state) {
  const p = state.player;
  // Shops and the safehouse.
  for (const s of SHOPS) {
    if (dist2(p.x, p.z, s.x, s.z) < 64) {
      if (s.kind === 'arms' && p.money >= 50) { p.money -= 50; p.ammo += 24; say(state, 'SOLMAR ARMS: 24 rounds. Stay safe out there, Nova.', 4); return; }
      if (s.kind === 'food' && p.money >= 15) { p.money -= 15; p.health = Math.min(100, p.health + 40); say(state, 'PALM BURGER: that hit the spot. +40 health.', 4); return; }
      if (s.kind === 'safe') {
        if (typeof localStorage !== 'undefined') localStorage.setItem('solmar-heat-save', JSON.stringify({ money: p.money, done: state.done, mission: state.mission, health: 100, ammo: p.ammo, radio: state.radio, x: p.x, z: p.z, version: 1 }));
        p.health = 100;
        banner(state, 'GAME SAVED — progress kept at the safehouse', 4);
        say(state, 'Safehouse: home sweet home. Health restored.', 4);
        return;
      }
      if (s.kind === 'spray' && p.money >= 100 && p.wanted > 0) { p.money -= 100; p.wanted = 0; say(state, 'SPRAY SHOP: fresh paint, fresh start. The cops lost you.', 4); return; }
      if (s.kind === 'arms' || s.kind === 'food' || s.kind === 'spray') { say(state, 'Not enough cash for that.', 3); return; }
    }
  }
  // Mission 2: steal the Comet GT.
  const m = currentMission(state);
  if (m && m.kind === 'steal' && state.missionPhase === 'go' && dist2(p.x, p.z, state.targetCar.x, state.targetCar.z) < 25) {
    state.targetCar.stolen = true;
    state.missionPhase = 'deliver';
    p.wanted = wantedForCrime(p.wanted, 'steal');
    p.onFoot = false; p.carColor = state.targetCar.color.slice();
    p.x = state.targetCar.x; p.z = state.targetCar.z; p.angle = state.targetCar.angle;
    say(state, 'Rico: nice wheels! Now get it to the garage — no scratches.', 5);
    return;
  }
  // Enter / exit the nearest car.
  if (p.onFoot) {
    let best = null, bd = 16;
    for (const car of state.cars) {
      const d = dist2(p.x, p.z, car.x, car.z);
      if (d < bd) { bd = d; best = car; }
    }
    if (best) {
      p.onFoot = false; p.carColor = best.color.slice();
      p.x = best.x; p.z = best.z; p.angle = best.angle; p.speed = 0;
      state.cars.splice(state.cars.indexOf(best), 1);
      p.wanted = wantedForCrime(p.wanted, 'steal');
      say(state, 'You jacked a ride. The owner will not be happy.', 3);
    }
  } else {
    p.onFoot = true; p.speed = 0;
    state.cars.push({ x: p.x + 2, z: p.z + 2, angle: p.angle, speed: 0, color: p.carColor.slice(), alongX: true, brake: 0 });
  }
}

export function shoot(state) {
  const p = state.player;
  if (p.onFoot === false || p.ammo <= 0) return;
  p.ammo -= 1; p.shots += 1; state.flash = 0.12;
  state.siren = 0;
  // Hitscan toward the camera's forward: the nearest cop or ped in a cone.
  const fx = Math.sin(p.angle), fz = Math.cos(p.angle);
  const targets = [...state.police.map((c) => ({ x: c.x, z: c.z, cop: true })), ...state.peds.map((d) => ({ x: d.x, z: d.z, cop: false }))];
  let best = null, bd = 40;
  for (const t of targets) {
    const dx = t.x - p.x, dz = t.z - p.z;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (along > 2 && along < bd && side < 2.5) { bd = along; best = t; }
  }
  if (best) {
    p.wanted = wantedForCrime(p.wanted, 'shoot');
    if (best.cop) { const cop = state.police.find((c) => c.x === best.x && c.z === best.z); if (cop) { cop.speed = 0; state.police.splice(state.police.indexOf(cop), 1); } say(state, 'Cop down! That will bring more heat.', 3); }
    else { const ped = state.peds.find((d) => d.x === best.x && d.z === best.z); if (ped) { ped.tx = ped.x + (ped.x - p.x) * 5; ped.tz = ped.z + (ped.z - p.z) * 5; } }
  }
}

// Ambient life for the title screen: traffic and pedestrians move, nothing else.
export function ambient(state, dt) {
  updateTraffic(state, dt);
  updatePeds(state, dt);
}

// --- main update ------------------------------------------------------------

export function update(state, dt, input) {
  state.elapsed += dt;
  state.clock += dt * 60; // game clock runs fast: a minute a second
  if (state.screen !== 'play') return;
  const p = state.player;
  if (input.action) { tryAction(state); input.action = false; }
  if (input.shoot) { shoot(state); input.shoot = false; }
  if (p.onFoot) walkPlayer(state, dt, input); else drivePlayer(state, dt, input);
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  if (state.flash > 0) state.flash -= dt;
  // Mission progress.
  const m = currentMission(state);
  if (m) {
    if (m.kind === 'timed') {
      state.missionTimer -= dt;
      if (state.missionTimer <= 0) { failMission(state, 'the deadline passed'); return; }
    }
    const t = missionTarget(state);
    if (t && atMarker(p.x, p.z, t.x, t.z)) {
      if (m.kind === 'escape') { completeMission(state); return; }
      if (m.kind === 'steal' && state.missionPhase === 'go') { /* need E to steal */ }
      else completeMission(state);
    }
  }
  if (p.health <= 0) {
    state.screen = 'busted';
    state.busts += 1;
    p.money = Math.max(0, p.money - 100);
  }
}

// --- camera -----------------------------------------------------------------

export function camera(state, dt) {
  const p = state.player;
  const fx = Math.sin(p.angle), fz = Math.cos(p.angle);
  const dist = p.onFoot ? 6.0 : 8.5;
  const height = p.onFoot ? 2.9 : 3.8;
  const tx = p.x - fx * dist, tz = p.z - fz * dist;
  state.camX = lerp(state.camX || tx, tx, Math.min(1, dt * 4));
  state.camZ = lerp(state.camZ || tz, tz, Math.min(1, dt * 4));
  const eye = [state.camX, height, state.camZ];
  const target = [p.x + fx * 7, p.onFoot ? 1.6 : 1.4, p.z + fz * 7];
  const sunEl = state.time.sunEl, sunAz = state.time.sunAz;
  return {
    eye, target,
    sunScreenX: 0.5 + Math.cos(sunAz) * 0.28,
    sunScreenY: 0.5 + Math.sin(sunEl) * 0.55,
  };
}

// --- dynamic geometry -------------------------------------------------------

function drawCar(g, x, z, angle, color, opts = {}) {
  const police = opts.police;
  g.boxRot(x, 0.75, z, 2.0, 0.75, 4.4, angle, police ? POLICE_BODY : color);
  g.boxRot(x, 1.45, z - 0.2, 1.7, 0.65, 2.2, angle, police ? POLICE_TRIM : [0.10, 0.12, 0.16]);
  if (police) g.boxRot(x, 1.25, z, 2.02, 0.35, 4.42, angle, POLICE_TRIM);
  // Wheels.
  for (const [wx, wz] of [[-1.0, 1.5], [1.0, 1.5], [-1.0, -1.5], [1.0, -1.5]]) {
    g.boxRot(x + wx * Math.cos(angle) + wz * Math.sin(angle), 0.35, z - wx * Math.sin(angle) + wz * Math.cos(angle), 0.3, 0.7, 0.7, angle, [0.05, 0.05, 0.06]);
  }
  // Headlights (warm) and taillights (red).
  const fx = Math.sin(angle), fz = Math.cos(angle);
  g.box(x + fx * 2.25 - fz * 0.7, 0.7, z + fz * 2.25 + fx * 0.7, 0.4, 0.25, 0.15, [1.0, 0.95, 0.7], 1.4);
  g.box(x + fx * 2.25 + fz * 0.7, 0.7, z + fz * 2.25 - fx * 0.7, 0.4, 0.25, 0.15, [1.0, 0.95, 0.7], 1.4);
  g.box(x - fx * 2.25 - fz * 0.7, 0.8, z - fz * 2.25 + fx * 0.7, 0.4, 0.25, 0.15, [1.0, 0.1, 0.1], 0.9);
  g.box(x - fx * 2.25 + fz * 0.7, 0.8, z - fz * 2.25 - fx * 0.7, 0.4, 0.25, 0.15, [1.0, 0.1, 0.1], 0.9);
  if (police) {
    g.box(x - fz * 0.5, 1.95, z + fx * 0.5, 0.7, 0.25, 0.5, opts.flashPhase ? [1.0, 0.1, 0.1] : [0.1, 0.1, 0.3], opts.flashPhase ? 1.6 : 0.1);
    g.box(x + fz * 0.5, 1.95, z - fx * 0.5, 0.7, 0.25, 0.5, opts.flashPhase ? [0.1, 0.1, 0.3] : [0.1, 0.3, 1.0], opts.flashPhase ? 0.1 : 1.6);
  }
}

function drawPed(g, ped) {
  const legSwing = Math.sin(ped.phase) * 0.25;
  const fx = Math.sin(ped.angle), fz = Math.cos(ped.angle);
  const lx = Math.cos(ped.angle) * 0.22, lz = -Math.sin(ped.angle) * 0.22;
  g.boxRot(ped.x + lx, 0.45, ped.z + lz, 0.22, 0.9, 0.22, ped.angle, [0.12, 0.12, 0.16]);
  g.boxRot(ped.x - lx, 0.45, ped.z - lz, 0.22, 0.9, 0.22, ped.angle, [0.12, 0.12, 0.16]);
  g.boxRot(ped.x, 1.35, ped.z, 0.7, 0.9, 0.4, ped.angle, ped.shirt);
  g.boxRot(ped.x + fx * legSwing, 2.05, ped.z + fz * legSwing, 0.42, 0.42, 0.42, ped.angle, ped.skin);
}

export function buildDynamic(state) {
  const g = new Geom();
  const p = state.player;
  const t = state.elapsed;
  // Player: car or on-foot Nova (orange jacket).
  if (p.onFoot) {
    drawPed(g, { x: p.x, z: p.z, angle: p.angle, phase: p.walkPhase, shirt: [0.95, 0.35, 0.08], skin: [0.85, 0.65, 0.5] });
    if (state.flash > 0) g.box(p.x + Math.sin(p.angle) * 1.2, 1.5, p.z + Math.cos(p.angle) * 1.2, 0.5, 0.5, 0.5, [1.0, 0.9, 0.4], 2.5);
  } else {
    drawCar(g, p.x, p.z, p.angle, p.carColor);
  }
  for (const car of state.cars) drawCar(g, car.x, car.z, car.angle, car.color);
  for (const ped of state.peds) drawPed(g, ped);
  const flashPhase = Math.floor(t * 3) % 2 === 0;
  for (const cop of state.police) drawCar(g, cop.x, cop.z, cop.angle, POLICE_BODY, { police: true, flashPhase });
  // The mission target car (mission 2) sits parked until stolen.
  const m = currentMission(state);
  if (m && m.kind === 'steal' && !state.targetCar.stolen) drawCar(g, state.targetCar.x, state.targetCar.z, state.targetCar.angle, state.targetCar.color);
  // Helicopter with a searchlight pool on the ground.
  if (heliActive(p.wanted)) {
    const hx = state.heli.x, hz = state.heli.z;
    g.boxRot(hx, 40, hz, 3.2, 1.6, 7.5, state.heli.angle, HELI_BODY);
    g.boxRot(hx, 41.2, hz, 0.3, 0.25, 9.5, state.heli.angle + t * 9, [0.2, 0.2, 0.22]);
    g.groundQuad(p.x - 4, p.z - 4, p.x + 4, p.z + 4, 0.08, [1.0, 0.95, 0.6], 0.5);
  }
  // Mission beacon: a pillar of light and a floating diamond over the target.
  const tgt = missionTarget(state);
  if (tgt && state.screen === 'play') {
    const pulse = 0.6 + 0.4 * Math.sin(t * 4);
    g.quad([tgt.x - 1.2, 0, tgt.z], [tgt.x + 1.2, 0, tgt.z], [tgt.x + 1.2, 26, tgt.z], [tgt.x - 1.2, 26, tgt.z], [0, 0, 1], [1.0, 0.8, 0.1], 0.5 * pulse);
    g.quad([tgt.x, 0, tgt.z - 1.2], [tgt.x, 0, tgt.z + 1.2], [tgt.x, 26, tgt.z + 1.2], [tgt.x, 26, tgt.z - 1.2], [1, 0, 0], [1.0, 0.8, 0.1], 0.5 * pulse);
    g.boxRot(tgt.x, 6 + Math.sin(t * 2) * 0.5, tgt.z, 1.6, 1.6, 1.6, t, [1.0, 0.75, 0.05], 1.2);
    g.groundQuad(tgt.x - 3, tgt.z - 3, tgt.x + 3, tgt.z + 3, 0.09, [1.0, 0.8, 0.1], 0.4 * pulse);
  }
  return g;
}
