// main.js — SOLMAR HEAT bootstrap: game state, player controller, camera,
// input, the render loop, shot modes for screenshots, and the test hook.
import { buildCity, buildingAt, onRoad, nearestRoadPoint } from './city.js';
import { World, PRESETS } from './world.js';
import { Traffic, driveCar, buildCarMesh, drawCar } from './vehicles.js';
import { Police } from './police.js';
import { MissionRunner, MISSIONS, SHOPS, loadSave, writeSave, clearSave } from './missions.js';
import { AudioEngine } from './audio.js';
import { HUD } from './hud.js';
import { mat4Perspective, mat4LookAt, mat4Model, clamp, lerp, mulberry32, hashSeed, angDiff, TAU } from './util.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || '';
const SEED = parseInt(params.get('seed') || '1337', 10);
const rnd = mulberry32(SEED);

const city = buildCity(SEED);
const canvas = document.getElementById('gl');
const world = new World(canvas, city);
const gl = world.ctx.gl;
const traffic = new Traffic(city, rnd, 18);
const police = new Police(city, rnd);
const audio = new AudioEngine();
const hud = new HUD(city);

// ---- game state ----
const S = {
  mode: 'title', // title | playing | paused
  x: city.spawn.x, z: city.spawn.z, heading: city.spawn.heading,
  speed: 0, onFootSpeed: 0,
  inCar: false, car: null, carMesh: null,
  money: 250, ammo: 12, reserveAmmo: 48, health: 100, armor: 0,
  clock: 18.7 * 60, // minutes since midnight
  now: 0, t: 0,
  wanted: 0, showBigMap: false,
  station: AudioEngine.STATIONS[0],
  missions: null,
  peds: [], flashUntil: 0, sprintBoost: 0,
  camYaw: 0, camDist: 10, camHeight: 4.2,
  preset: 'sunset',
  shotMode: SHOT,
};

function setPreset(name) {
  S.preset = name;
  world.setPreset(name);
}
function presetForClock() {
  const h = (S.clock / 60) % 24;
  if (h >= 7 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'sunset';
  return 'night';
}

S.missions = new MissionRunner(city, (kind, payload) => {
  if (kind === 'banner') hud.showBanner(payload);
  else if (kind === 'dialog') hud.showDialog(payload[0], payload[1], 6);
  else if (kind === 'reward') { S.money += payload; writeSave(S); }
  else if (kind === 'toast') hud.showToast(payload);
});

// ---- pedestrians ----
function spawnPed(far = false) {
  const a = city.avenues[Math.floor(rnd() * city.avenues.length)];
  const z = city.min + rnd() * (city.max - city.min);
  const side = rnd() < 0.5 ? -8.5 : 8.5;
  return {
    x: a.x + side, z, heading: rnd() * TAU, speed: 1.2 + rnd() * 1.2,
    mesh: Math.floor(rnd() * world.pedMeshes.length), bob: rnd() * 10,
  };
}
for (let i = 0; i < 26; i++) S.peds.push(spawnPed());

// ---- player car (the garage car for mission 1) ----
function spawnPlayerCar(x, z, heading) {
  S.car = { x, z, heading, speed: 0 };
  S.carMesh = world.carMeshes.player;
}
spawnPlayerCar(city.places.garage.x + 4, city.places.garage.z, Math.PI / 2);

// ---- input ----
const keys = {};
const input = { forward: false, back: false, left: false, right: false };
let mouseDown = false, lastMouseX = 0, camOrbit = 0;

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.key.toLowerCase()] = true;
  audio.ensure();
  if (e.key === 'p' || e.key === 'P') togglePause();
  if (e.key === 'm' || e.key === 'M') toggleBigMap();
  if (e.key === 'r' || e.key === 'R') { S.station = audio.nextStation(); }
  if (e.key === 'c' || e.key === 'C') { S.camDist = S.camDist === 10 ? 15 : S.camDist === 15 ? 7 : 10; }
  if (e.key === 'e' || e.key === 'E') tryInteract();
  if (e.key === 'f' || e.key === 'F') shoot();
  if (e.key === 'Escape') { if (S.mode === 'playing') toTitle(); }
  if (S.mode === 'title' && (e.key === 'Enter' || e.key === ' ')) startGame(false);
  if (e.key === 'ArrowUp' && S.mode === 'title') moveMenu(-1);
  if (e.key === 'ArrowDown' && S.mode === 'title') moveMenu(1);
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousedown', (e) => { mouseDown = true; lastMouseX = e.clientX; audio.ensure(); });
addEventListener('mouseup', () => { mouseDown = false; });
addEventListener('mousemove', (e) => {
  if (!mouseDown) return;
  camOrbit += (e.clientX - lastMouseX) * 0.005;
  lastMouseX = e.clientX;
});
document.querySelectorAll('#title .menu-item').forEach((el) => {
  el.addEventListener('click', () => menuAction(el.dataset.act));
});
document.querySelectorAll('#pause .menu-item').forEach((el) => {
  el.addEventListener('click', () => menuAction(el.dataset.act));
});

// ---- menus / flow ----
let menuIndex = 0;
const menuActs = ['continue', 'new', 'freeroam'];
function moveMenu(d) {
  menuIndex = (menuIndex + d + menuActs.length) % menuActs.length;
  document.querySelectorAll('#title .menu-item').forEach((el, i) => el.classList.toggle('sel', i === menuIndex));
}
function menuAction(act) {
  audio.ensure();
  if (act === 'continue') startGame(false);
  else if (act === 'new') { clearSave(); S.money = 250; S.missions.missionIndex = 0; startGame(true); }
  else if (act === 'freeroam') { S.mode = 'playing'; hideTitle(); hud.showToast('Free roam — Solmar is yours'); }
  else if (act === 'howto') document.getElementById('howto').classList.toggle('hidden');
  else if (act === 'resume') togglePause();
  else if (act === 'quit-title') toTitle();
}
function hideTitle() { document.getElementById('title').classList.add('hidden'); }
function showTitle() { document.getElementById('title').classList.remove('hidden'); }
function startGame(fresh) {
  hideTitle();
  S.mode = 'playing';
  document.getElementById('pause').classList.add('hidden');
  if (fresh || !S.missions.active) {
    S.missions.startMission(S.missions.missionIndex);
  }
  hud.showToast('Mission started — follow the yellow marker');
}
function toTitle() {
  S.mode = 'title';
  showTitle();
  document.getElementById('pause').classList.add('hidden');
  document.getElementById('bigmap').classList.add('hidden');
  S.showBigMap = false;
}
function togglePause() {
  if (S.mode === 'playing') {
    S.mode = 'paused';
    document.getElementById('pause').classList.remove('hidden');
  } else if (S.mode === 'paused') {
    S.mode = 'playing';
    document.getElementById('pause').classList.add('hidden');
  }
}
function toggleBigMap() {
  if (S.mode !== 'playing') return;
  S.showBigMap = !S.showBigMap;
  document.getElementById('bigmap').classList.toggle('hidden', !S.showBigMap);
}

// ---- interactions ----
function nearestCar(maxD) {
  let best = null, bd = maxD;
  const cars = [];
  if (S.car) cars.push({ car: S.car, mesh: S.carMesh, owned: true });
  for (const c of traffic.cars) cars.push({ car: c, mesh: null, owned: false, ref: c });
  for (const c of cars) {
    const d = Math.hypot(c.car.x - S.x, c.car.z - S.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function tryInteract() {
  if (S.mode !== 'playing') return;
  if (S.inCar) {
    // exit car
    S.inCar = false;
    S.x = S.car.x + Math.cos(S.car.heading + Math.PI / 2) * 2.5;
    S.z = S.car.z + Math.sin(S.car.heading + Math.PI / 2) * 2.5;
    S.heading = S.car.heading;
    audio.blip(440, 0.08);
    return;
  }
  // shop?
  for (const shop of SHOPS) {
    const p = city.places[shop.place];
    if (Math.hypot(p.x - S.x, p.z - S.z) < 8) {
      const item = shop.items.find((it) => S.money >= it.price);
      if (item) {
        S.money -= item.price;
        item.apply(S);
        hud.showToast(`Bought: ${item.name} (-$${item.price})`);
        audio.blip(990, 0.1);
      } else {
        hud.showToast(`${shop.name}: not enough cash`);
      }
      return;
    }
  }
  // enter nearest car
  const near = nearestCar(5);
  if (near) {
    if (!near.owned) {
      // steal a traffic car
      const idx = traffic.cars.indexOf(near.ref);
      if (idx >= 0) traffic.cars.splice(idx, 1);
      S.car = { x: near.car.x, z: near.car.z, heading: traffic.heading(near.car), speed: 0 };
      S.carMesh = world.trafficMeshes[near.ref.meshIndex ?? 0] || world.carMeshes.player;
      police.addHeat(6, S.now);
      hud.showToast('Car stolen — the PD noticed!');
    } else {
      S.car.speed = 0;
    }
    S.inCar = true;
    S.heading = S.car.heading;
    audio.blip(520, 0.08);
    if (S.carMesh === world.carMeshes.player) S.carMesh = world.carMeshes.player;
  }
}

// ---- shooting ----
function shoot() {
  if (S.mode !== 'playing' || S.ammo <= 0) { if (S.ammo <= 0) hud.showToast('Out of ammo — visit SOLMAR ARMS'); return; }
  S.ammo--;
  S.flashUntil = S.now + 0.09;
  audio.gunshot();
  const fx = Math.cos(S.heading), fz = Math.sin(S.heading);
  let best = null, bd = 34;
  for (const p of S.peds) {
    const dx = p.x - S.x, dz = p.z - S.z;
    const d = Math.hypot(dx, dz);
    if (d < bd && d > 0.5) {
      const dot = (dx * fx + dz * fz) / d;
      if (dot > 0.94) { bd = d; best = p; }
    }
  }
  if (best) {
    const i = S.peds.indexOf(best);
    S.peds.splice(i, 1);
    S.peds.push(spawnPed(true));
    police.addHeat(12, S.now);
    hud.showToast('Target down — wanted up!');
  } else {
    police.addHeat(2, S.now);
  }
}

// ---- per-frame update ----
function update(dt) {
  S.now += dt;
  S.t += dt;
  S.clock += dt * 0.9; // ~1 game minute per 1.1s
  if (!S.shotMode) {
    const want = presetForClock();
    if (want !== S.preset) setPreset(want);
  }
  input.forward = keys['w'] || keys['arrowup'];
  input.back = keys['s'] || keys['arrowdown'];
  input.left = keys['a'] || keys['arrowleft'];
  input.right = keys['d'] || keys['arrowright'];
  if (S.shotMode === 'chase') input.forward = true; // staged chase keeps speed

  if (S.mode === 'playing') {
    const sprint = (keys['shift'] ? 1.7 : 1) * (S.sprintBoost > 0 ? 1.4 : 1);
    if (S.sprintBoost > 0) S.sprintBoost -= dt;
    if (S.inCar && S.car) {
      driveCar(S.car, input, dt);
      S.x = S.car.x; S.z = S.car.z; S.heading = S.car.heading;
      S.speed = S.car.speed;
      // building collision: stop and slide back
      if (buildingAt(city, S.car.x, S.car.z, 1.2)) {
        S.car.x -= Math.cos(S.car.heading) * S.car.speed * dt * 2;
        S.car.z -= Math.sin(S.car.heading) * S.car.speed * dt * 2;
        if (Math.abs(S.car.speed) > 8) { audio.crash(); police.addHeat(3, S.now); }
        S.car.speed *= 0.4;
        S.x = S.car.x; S.z = S.car.z;
      }
      // keep inside the city
      S.car.x = clamp(S.car.x, city.min + 4, city.max - 4);
      S.car.z = clamp(S.car.z, city.min + 4, city.max - 4);
      // run over a ped?
      for (let i = S.peds.length - 1; i >= 0; i--) {
        const p = S.peds[i];
        if (Math.hypot(p.x - S.car.x, p.z - S.car.z) < 2.4 && Math.abs(S.car.speed) > 4) {
          S.peds.splice(i, 1);
          S.peds.push(spawnPed(true));
          police.addHeat(8, S.now);
          hud.showToast('Pedestrian hit!');
        }
      }
      // hit a traffic car?
      for (const c of traffic.cars) {
        if (Math.hypot(c.x - S.car.x, c.z - S.car.z) < 3.6 && Math.abs(S.car.speed) > 6) {
          S.car.speed *= 0.5;
          police.addHeat(2, S.now);
          audio.crash();
        }
      }
      // speeding past a cruiser raises heat a little
      if (Math.abs(S.car.speed) > 26 && police.cruisers.length) police.addHeat(dt * 1.5, S.now);
    } else {
      // on foot
      const turn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
      S.heading += turn * 2.6 * dt;
      const walk = 5.2 * sprint;
      let mx = 0, mz = 0;
      if (input.forward) { mx += Math.cos(S.heading); mz += Math.sin(S.heading); }
      if (input.back) { mx -= Math.cos(S.heading) * 0.6; mz -= Math.sin(S.heading) * 0.6; }
      const len = Math.hypot(mx, mz) || 1;
      const px = S.x, pz = S.z;
      S.x += (mx / len) * walk * dt * (input.forward || input.back ? 1 : 0);
      S.z += (mz / len) * walk * dt * (input.forward || input.back ? 1 : 0);
      S.onFootSpeed = (input.forward || input.back) ? walk : 0;
      if (buildingAt(city, S.x, S.z, 0.8)) { S.x = px; S.z = pz; }
      S.x = clamp(S.x, city.min + 2, city.max - 2);
      S.z = clamp(S.z, city.min + 2, city.max - 2);
      S.speed = S.onFootSpeed;
    }
    traffic.update(dt, S);
    police.update(dt, S.now, S);
    // pedestrians wander the sidewalks
    for (const p of S.peds) {
      p.x += Math.cos(p.heading) * p.speed * dt;
      p.z += Math.sin(p.heading) * p.speed * dt;
      p.bob += dt * 6;
      if (Math.random() < dt * 0.08) p.heading += (Math.random() - 0.5) * 1.6;
      if (p.x < city.min + 6 || p.x > city.max - 6 || p.z < city.min + 6 || p.z > city.max - 6) p.heading += Math.PI;
      if (buildingAt(city, p.x, p.z, 0.4)) p.heading += Math.PI / 2;
    }
    // missions
    S.missions.update(dt, { x: S.x, z: S.z, inCar: S.inCar, police, now: S.now });
    // busted?
    if (police.bustedTimer > 2.5) {
      police.bustedTimer = 0;
      police.heat = 0; police.syncWanted();
      S.money = Math.max(0, S.money - 200);
      hud.showBanner('BUSTED', '-$200 bail · back on the street');
      S.x = city.spawn.x; S.z = city.spawn.z;
      if (S.inCar) { S.inCar = false; }
    }
    // audio
    audio.setEngine(Math.abs(S.speed) / 34, S.inCar);
    audio.setSiren(police.wanted > 0);
  }
  // camera orbit decay
  camOrbit *= 0.94;
}

// ---- render ----
function render() {
  const aspect = canvas.width / canvas.height;
  const proj = mat4Perspective((62 * Math.PI) / 180, aspect, 0.1, 2000);
  let eye, target;
  if (S.shotMode === 'map') {
    eye = [S.x, 320, S.z + 0.01];
    target = [S.x, 0, S.z];
  } else if (S.mode === 'title') {
    if (S.shotMode === 'title') {
      // staged: low east camera looking west-northwest — sun disc over the skyline
      eye = [168, 46, -72];
      target = [-140, 62, 90];
    } else {
      const a = S.t * 0.05;
      eye = [Math.cos(a) * 190, 62, Math.sin(a) * 190];
      target = [0, 26, 0];
    }
  } else {
    const yaw = S.heading + Math.PI + camOrbit;
    const dist = S.inCar ? S.camDist : 8;
    const h = S.inCar ? S.camHeight : 3.4;
    eye = [S.x + Math.cos(yaw) * dist, h, S.z + Math.sin(yaw) * dist];
    target = [S.x, 1.6, S.z];
  }
  world.ctx.camera.pos = eye;
  const view = mat4LookAt(eye, target, [0, 1, 0]);
  world.beginFrame(view, proj);
  world.drawSky(eye);
  world.drawGround();
  world.drawCity(eye);
  // mission marker
  const o = S.missions.objective;
  if (S.mode === 'playing' && o && o.type === 'reach' && o.x !== undefined) {
    world.drawMarker(o.x, o.z, S.t);
  }
  // traffic
  for (const c of traffic.cars) {
    const mesh = world.trafficMeshes[c.meshIndex ?? 0] || world.trafficMeshes[0];
    drawCar(world.ctx, mesh, c.x, 0, c.z, traffic.heading(c), { night: S.preset === 'night' });
  }
  // player car
  if (S.car) {
    drawCar(world.ctx, S.carMesh, S.car.x, 0, S.car.z, S.car.heading, { night: S.preset === 'night' });
  }
  // player on foot
  if (!S.inCar && S.mode !== 'title') {
    const bob = Math.abs(S.onFootSpeed) > 0.5 ? Math.sin(S.t * 10) * 0.06 : 0;
    const m = mat4Model(S.x, bob, S.z, S.heading, 0, 0, 1, 1, 1);
    world.novaMesh.draw(world.ctx, m, world.ctx.whiteTex, false, 0);
  }
  // pedestrians
  for (const p of S.peds) {
    const bob = Math.abs(Math.sin(p.bob)) * 0.05;
    const m = mat4Model(p.x, bob, p.z, p.heading, 0, 0, 1, 1, 1);
    world.pedMeshes[p.mesh].draw(world.ctx, m, world.ctx.whiteTex, false, 0);
  }
  // police
  for (const c of police.cruisers) {
    drawCar(world.ctx, world.carMeshes.cop, c.x, 0, c.z, c.heading, { night: S.preset === 'night' });
  }
  if (police.heli) {
    world.drawHelicopter(police.heli.x, police.heli.y, police.heli.z, S.t, S.t * 0.4);
  }
  // muzzle flash
  if (S.now < S.flashUntil) {
    const fx = S.x + Math.cos(S.heading) * 1.6, fz = S.z + Math.sin(S.heading) * 1.6;
    const m = mat4Model(fx, 1.4, fz, 0, 0, 0, 1.6, 1.6, 1);
    world.glowMesh.draw(world.ctx, m, world.ctx.glowTex, true, 0, 1);
  }
}

// ---- shot modes: fixed staged scenes for screenshots (?shot=chase|night|title|map) ----
function applyShotMode() {
  if (!S.shotMode) return;
  hideTitle();
  S.mode = 'playing';
  if (S.shotMode === 'chase') {
    setPreset('sunset');
    S.clock = 18.6 * 60;
    // westbound on TIDEWATER ROW (z=128), sun dead ahead-left in frame
    const st = city.streets[5];
    spawnPlayerCar(100, st.z + 3.2, Math.PI);
    S.car.speed = 22;
    S.inCar = true;
    S.x = S.car.x; S.z = S.car.z; S.heading = Math.PI;
    S.camDist = 10; S.camHeight = 3.4;
    police.addHeat(50, 0);
    // stage cruisers ahead in the lanes, cutting across the pursuit
    const lanes = [st.z - 3.2, st.z + 3.2, st.z - 3.2];
    police.cruisers.forEach((c, i) => {
      c.x = S.car.x - 16 - i * 9;
      c.z = lanes[i % lanes.length];
      c.heading = Math.PI; c.speed = 20;
    });
    S.missions.startMission(2);
    S.missions.objIndex = 1;
    S.missions.armObjective();
    S.money = 1840;
  } else if (S.shotMode === 'night') {
    setPreset('night');
    S.clock = 22.4 * 60;
    // Nova on the avenue west of the CLUB MIRAGE neon sign, facing it (east)
    S.x = city.avenues[3].x - 2; S.z = city.places.club.z + 2;
    S.heading = -0.2;
    S.money = 2320;
    S.missions.startMission(3);
    police.addHeat(12, 0);
    // a couple of cars + peds nearby so the street feels alive
    const near = traffic.cars[0];
    near.x = S.x + 10; near.z = S.z - 3.2; near.along = 'z'; near.dir = -1;
    const near2 = traffic.cars[1];
    near2.x = S.x - 14; near2.z = S.z + 3.2; near2.along = 'z'; near2.dir = 1;
  } else if (S.shotMode === 'title') {
    setPreset('sunset');
    S.clock = 18.6 * 60;
    S.mode = 'title';
    showTitle();
  } else if (S.shotMode === 'map') {
    setPreset('day');
    S.clock = 12 * 60;
    S.showBigMap = true;
    document.getElementById('bigmap').classList.remove('hidden');
    S.x = 80; S.z = -40;
  }
  // staged shots: no intro dialog blocking the frame
  document.getElementById('dialog').style.display = 'none';
  hud.dialogUntil = 0;
  hud.update({
    ...S, speedMph: Math.abs(S.speed) * 2.237, police, missions: S.missions,
    station: S.station, now: S.now,
  });
}

// ---- main loop ----
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (S.mode !== 'paused') update(dt);
  render();
  // HUD + minimap stay hidden on the title screen
  const showHud = S.mode !== 'title';
  document.getElementById('hud').style.display = showHud ? 'block' : 'none';
  document.getElementById('map').style.display = showHud ? 'block' : 'none';
  if (S.mode === 'playing') {
    hud.update({
      ...S, speedMph: Math.abs(S.speed) * 2.237, police, missions: S.missions,
      station: S.station, now: S.now,
    });
    hud.hideTimed(now / 1000);
  }
  requestAnimationFrame(frame);
}

function resize() {
  const w = innerWidth, h = innerHeight;
  canvas.width = w; canvas.height = h;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
}
addEventListener('resize', resize);
resize();

// ---- boot ----
(function boot() {
  const save = loadSave();
  if (save) {
    S.missions.missionIndex = Math.min(4, save.mission || 0);
    S.money = save.money ?? 250;
    S.ammo = save.ammo ?? 12;
    S.health = save.health ?? 100;
  }
  if (S.shotMode) applyShotMode();
  else { setPreset('sunset'); showTitle(); }
  requestAnimationFrame(frame);
})();

// ---- test hook for headless playtests (not part of gameplay) ----
window.__solmar = {
  state: S, city, police, traffic, missions: S.missions,
  start: () => startGame(false),
  teleport: (x, z) => { S.x = x; S.z = z; if (S.inCar && S.car) { S.car.x = x; S.car.z = z; } },
  enterCar: () => { S.inCar = true; if (S.car) { S.car.x = S.x; S.car.z = S.z; S.car.heading = S.heading; } },
  setWanted: (w) => { police.heat = [0, 10, 30, 50, 70, 90][w] || 0; police.syncWanted(); },
  errors: [],
};
addEventListener('error', (e) => window.__solmar.errors.push(String(e.message)));
