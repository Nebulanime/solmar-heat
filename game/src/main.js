// Solmar Heat — Patient Nova. A 3D open-world crime game in Solmar: drive,
// walk, steal cars, outrun the Solmar PD, run five story missions for Nova
// Vega, save at the Bayview Motel safehouse. Hand-written WebGL, no libraries,
// no network requests. Playable offline from static files.
import { MISSIONS, SHOPS, SAFEHOUSE, TOTAL_REWARD, MISSION_SPOTS, missionAdvance, newGameState, driveStep,
  walkStep, coolHeat, heatForCrime, wantedFromHeat, policeCount, heliActive,
  clockString, isNight, saveData, loadData, deathResult, formatMoney,
  missionById, nextMission, applyMissionReward, clamp, rng, CITY } from './logic.js';
import { buildCity, buildStaticMesh, buildBuildingsMesh, buildPalmsMesh,
  buildLampsMesh, buildBillboardsMesh } from './city.js';
import { buildCar, buildPed, buildNova, buildHeli } from './vehicles.js';
import { createMesh, box, cylinder, sphere, quad, V, merge, transform,
  matIdentity, hexRgb } from './mesh.js';
import { createRenderer, drawMesh, drawStatic, uploadMesh, viewMatrix, IDENTITY, sunsetEnv, nightEnv } from './render.js';
import { makeBuildingTextures, neonTexture } from './textures.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || '';
const canvas = $('gl');
const ctx2d = $('minimap').getContext('2d');

const state = newGameState();
const saved = loadData(localStorage.getItem('solmar-heat-save') || '');
if (saved) { state.money = saved.money; state.done = saved.done; state.timeMin = saved.timeMin; state.day = saved.day; }

const city = buildCity(7);
const staticMesh = buildStaticMesh(city);
const buildingsMesh = buildBuildingsMesh(city);
const palmsMesh = buildPalmsMesh(city);
const textures = makeBuildingTextures();
const renderer = createRenderer(canvas, textures);
// Static meshes cached once (lamps/billboards differ day vs night).
const lampsDay = buildLampsMesh(city, false), lampsNight = buildLampsMesh(city, true);
const bbDay = buildBillboardsMesh(city, false), bbNight = buildBillboardsMesh(city, true);
const sunMeshDay = sunMeshStatic(false), sunMeshNight = sunMeshStatic(true);
// Static geometry uploaded to the GPU once — re-uploading it every frame
// was the main frame-rate killer under software rendering.
const upStatic = uploadMesh(renderer, staticMesh);
const upBuildings = uploadMesh(renderer, buildingsMesh);
const upPalms = uploadMesh(renderer, palmsMesh);
const upLampsDay = uploadMesh(renderer, lampsDay), upLampsNight = uploadMesh(renderer, lampsNight);
const upBbDay = uploadMesh(renderer, bbDay), upBbNight = uploadMesh(renderer, bbNight);
const upSunDay = uploadMesh(renderer, sunMeshDay), upSunNight = uploadMesh(renderer, sunMeshNight);
function sunMeshStatic(nightFlag) {
  const m = createMesh();
  // Sun sits south-west over the sea, matching the lighting sunDir.
  sphere(m, -520, nightFlag ? 130 : 55, 380, 34, nightFlag ? [0.9, 0.95, 1] : [1, 0.62, 0.25], { seg: 16, rings: 10, emis: 3 });
  sphere(m, -520, nightFlag ? 130 : 55, 380, 52, nightFlag ? [0.5, 0.55, 0.7] : [1, 0.45, 0.2], { seg: 16, rings: 10, emis: 0.7 });
  return m;
}

// --- world state -----------------------------------------------------------
const player = { x: 40, z: 60, heading: -Math.PI / 2, speed: 0, inCar: true, onFoot: { x: 40, z: 60, heading: 0 } };
let car = { x: 40, z: 60, heading: -Math.PI / 2, speed: 0 };
let carColor = '#ff2e63';
let screen = SHOT === 'play' || SHOT === 'night' || SHOT === 'map' || SHOT === 'end' ? (SHOT === 'map' ? 'map' : SHOT === 'end' ? 'passed' : 'play') : 'title';
let paused = false, busted = false, missionPassed = null, dialog = null, dialogT = 0;
let timeMin = SHOT === 'night' ? 21 * 60 + 40 : 18 * 60 + 24;
let radio = 0;
const RADIOS = ['SOLMAR 98.5 — Sunset FM', 'NEON ROW RADIO', 'VELA BAY TALK', 'PALM COURT OLDIES'];
let cameraMode = 0; // 0 chase, 1 high, 2 hood
const R = rng(42);
// Traffic: 10 cars cruising the grid.
const TRAFFIC_COLORS = ['#2e86ff', '#ffd166', '#9dff6e', '#c9b8ff', '#ff8a5e', '#e8e8e8', '#3a3f4a', '#7ee7ff', '#ffb45e', '#5e8a6e'];
const traffic = [];
for (let i = 0; i < 10; i++) {
  const horiz = i % 2 === 0;
  const line = city.lines[1 + Math.floor(R() * (city.lines.length - 2))];
  traffic.push({ x: horiz ? -300 + R() * 600 : line, z: horiz ? line : -300 + R() * 600,
    heading: horiz ? (R() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (R() < 0.5 ? 0 : Math.PI),
    speed: 9 + R() * 7, color: TRAFFIC_COLORS[i], mesh: buildCar(TRAFFIC_COLORS[i], { taxi: i === 3 }) });
}
const peds = [];
const PED_SHIRTS = ['#ffd166', '#7ee7ff', '#ff8a5e', '#9dff6e', '#c9b8ff', '#e8e8e8', '#ff5e8a', '#5e8a6e'];
for (let i = 0; i < 12; i++) {
  peds.push({ x: -280 + R() * 560, z: -280 + R() * 560, heading: R() * Math.PI * 2,
    speed: 1.2 + R() * 1.2, mesh: buildPed(PED_SHIRTS[i % PED_SHIRTS.length], '#e8b48c', '#23283a'), t: R() * 10 });
}
let police = []; // spawned from wanted level
let heli = null;
let playerMesh = buildCar(carColor, { sport: true });
let novaMesh = buildNova();
let mission = null; let missionStage = 0; let missionMarker = null;
function startMission(id) {
  const m = missionById(id); if (!m) return;
  mission = m; missionStage = 0;
  missionMarker = MISSION_SPOTS[id][0];
  state.heat = Math.max(state.heat, m.wanted * 0.6);
  showDialog(`${m.giver}: ${m.brief}`, 6);
  $('mission-name').textContent = `MISSION: ${m.name}`;
  $('mission-obj').textContent = m.objective;
}
function completeMission() {
  applyMissionReward(state, mission);
  missionPassed = mission; mission = null; missionMarker = null;
  $('passed-title').textContent = 'MISSION PASSED';
  $('passed-sub').textContent = `${missionPassed.name} — ${formatMoney(missionPassed.reward)}`;
  $('passed-reward').textContent = `Reward ${formatMoney(missionPassed.reward)}  •  Total ${formatMoney(state.money)}`;
  screen = 'passed'; saveGame();
  setTimeout(() => { if (screen === 'passed') screen = 'play'; }, 4200);
}
function saveGame() {
  try { localStorage.setItem('solmar-heat-save', saveData({ ...state, timeMin })); } catch { /* private mode */ }
}
function showDialog(text, secs = 5) { dialog = text; dialogT = secs; $('dialog').textContent = text; $('dialog').style.display = 'block'; }
// --- input -----------------------------------------------------------------
const keys = {};
addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'Enter' && screen === 'title') { screen = 'play'; startMission(nextMission(state.done)?.id ?? 1); }
  if (e.key === ' ' && screen === 'title') { screen = 'play'; startMission(nextMission(state.done)?.id ?? 1); }
  if (e.key === 'Enter' && screen === 'busted') { busted = false; state.health = 100; state.heat = 0; screen = 'play'; }
  if (e.key.toLowerCase() === 'p' && screen === 'play') { paused = !paused; $('pause').style.display = paused ? 'flex' : 'none'; }
  if (e.key.toLowerCase() === 'm' && (screen === 'play' || screen === 'map')) { screen = screen === 'map' ? 'play' : 'map'; }
  if (e.key.toLowerCase() === 'c') cameraMode = (cameraMode + 1) % 3;
  if (e.key.toLowerCase() === 'r') { radio = (radio + 1) % RADIOS.length; }
  if (e.key.toLowerCase() === 'e') toggleCar();
  if (e.key.toLowerCase() === 'n' && screen === 'play') { timeMin = isNight(timeMin) ? 18 * 60 + 24 : 21 * 60 + 30; }
  if (e.key === 'Escape' && screen === 'map') screen = 'play';
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
function toggleCar() {
  if (screen !== 'play') return;
  if (player.inCar) {
    player.inCar = false; player.onFoot = { x: car.x + 2.5, z: car.z + 2.5, heading: car.heading };
    car.speed = 0;
  } else {
    // Enter the nearest car: own car first, then a traffic car (steal it).
    let best = null, bd = 1e9;
    const cands = [{ c: car, own: true }, ...traffic.map((t) => ({ c: t, own: false }))];
    for (const cand of cands) {
      const d = Math.hypot(cand.c.x - player.onFoot.x, cand.c.z - player.onFoot.z);
      if (d < bd) { bd = d; best = cand; }
    }
    if (best && bd < 7) {
      if (!best.own) {
        state.heat = Math.min(5, state.heat + heatForCrime('steal'));
        showDialog('Nova: "Borrowed. Don\'t wait up."', 3);
        const i = traffic.indexOf(best.c); if (i >= 0) traffic.splice(i, 1);
        car = best.c; carColor = best.c.color; playerMesh = buildCar(carColor, { sport: false });
      }
      player.inCar = true; player.heading = car.heading;
    }
  }
}

// --- police ----------------------------------------------------------------
function syncPolice(dt, t) {
  const wanted = wantedFromHeat(state.heat);
  const want = policeCount(wanted);
  // In the staged chase shot, police spawn where the camera can see them:
  // one roadblock ahead, one closing in from behind.
  const shotSpawns = [[-10, 120], [8, -45], [-14, 140], [12, -60], [-6, 160], [16, -75]];
  while (police.length < want) {
    let px, pz;
    if (SHOT === 'play') { const o = shotSpawns[police.length % shotSpawns.length]; px = car.x + o[0]; pz = car.z + o[1]; }
    else { const a = R() * Math.PI * 2; px = car.x + Math.cos(a) * 60; pz = car.z + Math.sin(a) * 60; }
    police.push({ x: px, z: pz, heading: 0, speed: 0,
      mesh: buildCar('#14181f', { police: true }), flash: police.length % 2 });
  }
  while (police.length > want) police.pop();
  for (const p of police) {
    const dx = car.x - p.x, dz = car.z - p.z, d = Math.hypot(dx, dz) || 1;
    const target = Math.atan2(dx, -dz);
    let dh = target - p.heading;
    while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    p.heading += clamp(dh, -2.2 * dt, 2.2 * dt);
    p.speed = clamp(p.speed + (d > 12 ? 30 : 12) * dt * 0.5, 0, 34);
    p.x += Math.sin(p.heading) * p.speed * dt;
    p.z += -Math.cos(p.heading) * p.speed * dt;
    if (d < 4.5) { state.health = Math.max(0, state.health - 12 * dt); state.heat = Math.min(5, state.heat + 0.2 * dt); }
    p.mesh = buildCar('#14181f', { police: true, flash: (Math.floor(t * 3) + p.flash) % 2 });
  }
  heli = heliActive(wanted) ? { x: car.x + Math.sin(t * 0.25) * 26, z: car.z + Math.cos(t * 0.2) * 26, y: 42 + Math.sin(t * 0.5) * 3 } : null;
}
// --- camera + sun ----------------------------------------------------------
function cameraFor(t) {
  const focus = player.inCar ? car : player.onFoot;
  const h = focus.heading;
  const back = 7.8, up = 2.9;
  // Slight side offset: a 3/4 rear view shows the car's flank, wheels and
  // spoiler instead of a flat rear slab.
  const rx = Math.cos(h) * 2.0, rz = Math.sin(h) * 2.0;
  if (cameraMode === 1) return { ex: focus.x, ey: 26, ez: focus.z + 26, cx: focus.x, cy: 0, cz: focus.z, aspect: canvas.width / canvas.height };
  if (cameraMode === 2) return { ex: focus.x - Math.sin(h) * 0.4, ey: 1.7, ez: focus.z + Math.cos(h) * 0.4, cx: focus.x + Math.sin(h) * 20, cy: 1.2, cz: focus.z - Math.cos(h) * 20, aspect: canvas.width / canvas.height };
  return { ex: focus.x - Math.sin(h) * back + rx, ey: up, ez: focus.z + Math.cos(h) * back + rz,
    cx: focus.x + Math.sin(h) * 10 + rx * 0.4, cy: 1.3, cz: focus.z - Math.cos(h) * 10 + rz * 0.4, aspect: canvas.width / canvas.height };
}
function shadowMesh(x, z, w, d, heading) {
  const m = createMesh();
  const c = [0.07, 0.07, 0.09];
  // Long shadow stretching east (away from the low western sun).
  const ox = 1.8, oz = 0.6;
  quad(m, V(x + ox - w / 2, 0.34, z + oz + d / 2, c), V(x + ox + w / 2, 0.34, z + oz + d / 2, c),
    V(x + ox + w / 2, 0.34, z + oz - d / 2, c), V(x + ox - w / 2, 0.34, z + oz - d / 2, c));
  return m;
}
function markerMesh(t) {
  if (!missionMarker) return null;
  const m = createMesh();
  const pulse = 1 + Math.sin(t * 3) * 0.12;
  cylinder(m, missionMarker.x, 6, missionMarker.z, 1.1 * pulse, 12, [1, 0.85, 0.2], { seg: 10, emis: 1.2 });
  const y = 14 + Math.sin(t * 2) * 1.2;
  quad(m, V(missionMarker.x - 1.4, y, missionMarker.z, [1, 0.85, 0.2], [0, 0], 0, 1.6),
    V(missionMarker.x + 1.4, y, missionMarker.z, [1, 0.85, 0.2], [0, 0], 0, 1.6),
    V(missionMarker.x, y - 2.6, missionMarker.z, [1, 0.85, 0.2], [0, 0], 0, 1.6),
    V(missionMarker.x - 1.4, y, missionMarker.z, [1, 0.85, 0.2], [0, 0], 0, 1.6));
  return m;
}
// --- HUD -------------------------------------------------------------------
function updateHUD() {
  const wanted = wantedFromHeat(state.heat);
  $('stars').textContent = '★'.repeat(wanted) + '☆'.repeat(5 - wanted);
  $('stars').style.color = wanted >= 3 ? '#ff4040' : '#ffd166';
  $('money').textContent = formatMoney(state.money);
  $('clock').textContent = clockString(timeMin);
  $('health-fill').style.width = state.health + '%';
  $('armor-fill').style.width = state.armor + '%';
  const speed = Math.abs(player.inCar ? car.speed : 0) * 3.6;
  $('speed').textContent = String(Math.round(speed)).padStart(3, '0');
  $('weapon').textContent = `${state.weapon}  ${state.ammo}`;
  $('radio').textContent = RADIOS[radio];
  $('wanted-label').textContent = wanted === 0 ? 'SOLMAR PD — CLEAR' : wanted >= 4 ? 'SOLMAR PD — FULL RESPONSE' : `SOLMAR PD — ${wanted} STAR${wanted > 1 ? 'S' : ''}`;
  const near = police.length;
  $('police-list').textContent = wanted === 0 ? 'No units on you. Stay cool.' :
    `${near} unit${near === 1 ? '' : 's'} pursuing${heli ? ' • Air support overhead' : ''} — break line of sight to cool down.`;
  if (mission) {
    const d = missionMarker ? Math.round(Math.hypot(missionMarker.x - car.x, missionMarker.z - car.z)) : 0;
    $('mission-dist').textContent = missionMarker ? `${missionMarker.label} — ${d}m` : '';
  } else {
    $('mission-name').textContent = state.done.length >= MISSIONS.length ? 'ALL MISSIONS COMPLETE' : 'NO ACTIVE MISSION';
    $('mission-obj').textContent = 'Press Enter on the title screen to start the next job. Safehouse: Bayview Motel.';
    $('mission-dist').textContent = '';
  }
  $('save-note').textContent = `Saved at Bayview Motel • Day ${state.day} • ${state.done.length}/5 missions`;
}
function drawMinimap() {
  const g = ctx2d, S = 168, half = CITY.half;
  g.clearRect(0, 0, S, S);
  g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.clip();
  g.fillStyle = '#0d1520'; g.fillRect(0, 0, S, S);
  const to = (x, z) => [S / 2 + (x / half) * (S / 2), S / 2 + (z / half) * (S / 2)];
  g.fillStyle = '#1d5c8a'; g.fillRect(0, 0, 14, S); // sea west
  g.strokeStyle = '#3a3f4a'; g.lineWidth = 3;
  for (const v of city.lines) {
    const [ax] = to(v, 0); g.beginPath(); g.moveTo(ax, 0); g.lineTo(ax, S); g.stroke();
    const [, az] = to(0, v); g.beginPath(); g.moveTo(0, az); g.lineTo(S, az); g.stroke();
  }
  g.fillStyle = '#ffd166';
  for (const s of SHOPS) { const [x, y] = to(s.x, s.z); g.fillRect(x - 2, y - 2, 4, 4); }
  if (missionMarker) {
    const [x, y] = to(missionMarker.x, missionMarker.z);
    g.fillStyle = '#ff2e63'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
  }
  const [px, py] = to(player.inCar ? car.x : player.onFoot.x, player.inCar ? car.z : player.onFoot.z);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(px, py, 4, 0, 7); g.fill();
  g.fillStyle = '#ff2e63'; g.beginPath(); g.arc(px, py, 2.2, 0, 7); g.fill();
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.stroke();
}

// --- full-map overlay ------------------------------------------------------
function drawBigMap() {
  const c = $('bigmap'), g = c.getContext('2d');
  const W = c.width, H = c.height, half = CITY.half;
  g.fillStyle = '#0b1220'; g.fillRect(0, 0, W, H);
  const to = (x, z) => [W / 2 + (x / half) * (W / 2 - 30), H / 2 + (z / half) * (H / 2 - 30)];
  g.fillStyle = '#14486e'; g.fillRect(0, 0, 46, H);
  g.fillStyle = '#c9a86a'; g.fillRect(46, 0, 8, H);
  g.strokeStyle = '#454b57'; g.lineWidth = 5;
  for (const v of city.lines) {
    const [ax] = to(v, 0); g.beginPath(); g.moveTo(ax, 0); g.lineTo(ax, H); g.stroke();
    const [, az] = to(0, v); g.beginPath(); g.moveTo(0, az); g.lineTo(W, az); g.stroke();
  }
  g.font = 'bold 15px sans-serif';
  for (const s of SHOPS) {
    if (s.kind === 'safehouse') continue; // drawn separately below with its own marker
    const [x, y] = to(s.x, s.z);
    g.fillStyle = '#ffd166'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.fillText(s.name, x + 10, y + 5);
  }
  const [sx, sy] = to(SAFEHOUSE.x, SAFEHOUSE.z);
  g.fillStyle = '#9dff6e'; g.fillRect(sx - 8, sy - 8, 16, 16);
  g.fillStyle = '#fff'; g.fillText('Bayview Motel — SAFEHOUSE (save)', sx + 20, sy + 5);
  if (missionMarker) {
    const [x, y] = to(missionMarker.x, missionMarker.z);
    g.fillStyle = '#ff2e63'; g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.fillText(missionMarker.label, x + 14, y + 5);
  }
  const [px, py] = to(player.inCar ? car.x : player.onFoot.x, player.inCar ? car.z : player.onFoot.z);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(px, py, 7, 0, 7); g.fill();
  g.fillStyle = '#ff2e63'; g.beginPath(); g.arc(px, py, 4, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 20px sans-serif';
  g.fillText('SOLMAR — CITY MAP', 24, 32);
  g.font = '14px sans-serif'; g.fillStyle = '#9fb4cc';
  g.fillText('M — close map  •  Yellow: shops  •  Green: safehouse  •  Pink: mission', 32, H - 26);
}
// --- main loop -------------------------------------------------------------
let last = performance.now(), t = 0, frames = 0;
const night = () => isNight(timeMin);
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
  frames++;
  if (frames === 45) window.__shotReady = true;
  window.__solmar = { screen, money: state.money, speed: Math.abs(car.speed) * 3.6,
    heat: state.heat, wanted: wantedFromHeat(state.heat), inCar: player.inCar,
    mission: mission ? mission.id : null, done: state.done, health: state.health, frames,
    paused, stage: missionStage,
    police: police.map((p) => [Math.round(p.x), Math.round(p.z)]),
    traffic: traffic.slice(0, 3).map((t) => [Math.round(t.x), Math.round(t.z)]),
    car: [Math.round(car.x), Math.round(car.z)] };
  if (!paused && screen !== 'title') {
    timeMin += dt * 0.9; // ~1 game hour per 67 real seconds
    if (dialogT > 0) { dialogT -= dt; if (dialogT <= 0) $('dialog').style.display = 'none'; }
    const input = { up: keys['w'] || keys['arrowup'], down: keys['s'] || keys['arrowdown'],
      left: keys['a'] || keys['arrowleft'], right: keys['d'] || keys['arrowright'], run: keys['shift'] };
    if (player.inCar) {
      driveStep(car, input, dt);
      car.x = clamp(car.x, -CITY.half, CITY.half); car.z = clamp(car.z, -CITY.half, CITY.half);
      if (Math.abs(car.speed) > 34 && state.heat < 5) state.heat = Math.min(5, state.heat + 0.05 * dt);
    } else {
      walkStep(player.onFoot, input, dt);
    }
    // Traffic cruise along the grid, wrapping at the edges.
    for (const tr of traffic) {
      tr.x += Math.sin(tr.heading) * tr.speed * dt;
      tr.z += -Math.cos(tr.heading) * tr.speed * dt;
      if (tr.x > CITY.half) tr.x = -CITY.half; if (tr.x < -CITY.half) tr.x = CITY.half;
      if (tr.z > CITY.half) tr.z = -CITY.half; if (tr.z < -CITY.half) tr.z = CITY.half;
    }
    for (const p of peds) {
      p.t -= dt;
      if (p.t <= 0) { p.t = 4 + R() * 6; p.heading = R() * Math.PI * 2; }
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += -Math.cos(p.heading) * p.speed * dt;
      if (Math.abs(p.x) > CITY.half - 10 || Math.abs(p.z) > CITY.half - 10) p.heading += Math.PI;
    }
    const hiding = Math.abs(car.speed) < 2 && police.every((p) => Math.hypot(p.x - car.x, p.z - car.z) > 45);
    state.heat = coolHeat(state.heat, dt, hiding && screen === 'play');
    syncPolice(dt, t);
    // Mission marker reach (rule lives in logic.js, tested in Node).
    if (mission && missionMarker) {
      const fx = player.inCar ? car.x : player.onFoot.x, fz = player.inCar ? car.z : player.onFoot.z;
      const adv = missionAdvance(mission.id, missionStage, fx, fz);
      if (adv.stage !== missionStage) {
        missionStage = adv.stage;
        if (adv.done) completeMission();
        else { missionMarker = MISSION_SPOTS[mission.id][missionStage]; showDialog(`Next: ${missionMarker.label}`, 4); }
      }
    }
    // Safehouse save.
    const fx = player.inCar ? car.x : player.onFoot.x, fz = player.inCar ? car.z : player.onFoot.z;
    if (Math.hypot(SAFEHOUSE.x - fx, SAFEHOUSE.z - fz) < 10 && !player._savedFlash) {
      player._savedFlash = true; saveGame(); state.health = 100;
      showDialog('Game saved at Bayview Motel. Health restored.', 4);
    } else if (Math.hypot(SAFEHOUSE.x - fx, SAFEHOUSE.z - fz) > 16) player._savedFlash = false;
    const dr = deathResult(state.health, wantedFromHeat(state.heat));
    if (dr) { busted = true; screen = 'busted'; $('busted-title').textContent = dr; $('busted-sub').textContent = dr === 'BUSTED' ? 'The Solmar PD took Nova in. The crew posts bail — but the heat stays.' : 'Nova is down. The crew drags her to the Bayview Motel.'; }
  }
  render(t);
  updateHUD(); drawMinimap();
  // The HUD belongs to gameplay only — title, map, passed and busted screens
  // carry their own overlays and must not fight it.
  $('hud').style.display = screen === 'play' ? 'block' : 'none';
  $('title').style.display = screen === 'title' ? 'flex' : 'none';
  $('mapscreen').style.display = screen === 'map' ? 'flex' : 'none';
  $('passed').style.display = screen === 'passed' ? 'flex' : 'none';
  $('bustedscreen').style.display = screen === 'busted' ? 'flex' : 'none';
  if (screen === 'map') drawBigMap();
  document.body.classList.toggle('night', night());
  requestAnimationFrame(frame);
}
function render(t) {
  const gl = renderer.gl;
  if (canvas.width !== innerWidth || canvas.height !== innerHeight) {
    canvas.width = innerWidth; canvas.height = innerHeight;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const env = night() ? nightEnv() : sunsetEnv();
  const cam = cameraFor(t);
  const mvp = viewMatrix(cam);
  drawStatic(renderer, upStatic, mvp, IDENTITY, env);
  drawStatic(renderer, upBuildings, mvp, IDENTITY, env);
  drawStatic(renderer, upPalms, mvp, IDENTITY, env);
  drawStatic(renderer, night() ? upLampsNight : upLampsDay, mvp, IDENTITY, env);
  drawStatic(renderer, night() ? upBbNight : upBbDay, mvp, IDENTITY, env);
  drawStatic(renderer, night() ? upSunNight : upSunDay, mvp, IDENTITY, env);
  // Player car + shadow.
  if (player.inCar || screen === 'title') {
    const cm = transform(buildCar(carColor, { sport: true, steer: (keys['a'] ? 0.3 : 0) - (keys['d'] ? 0.3 : 0) }), car.heading, car.x, 0, car.z);
    drawMesh(renderer, cm, mvp, IDENTITY, env);
    drawMesh(renderer, shadowMesh(car.x, car.z, 2.3, 5.4, car.heading), mvp, IDENTITY, env);
  } else {
    const nm = transform(novaMesh, player.onFoot.heading, player.onFoot.x, 0, player.onFoot.z);
    drawMesh(renderer, nm, mvp, IDENTITY, env);
    drawMesh(renderer, shadowMesh(player.onFoot.x, player.onFoot.z, 1.2, 1.6, 0), mvp, IDENTITY, env);
  }
  for (const tr of traffic) {
    const tm = transform(tr.mesh, tr.heading, tr.x, 0, tr.z);
    drawMesh(renderer, tm, mvp, IDENTITY, env);
    drawMesh(renderer, shadowMesh(tr.x, tr.z, 2.3, 5.2, tr.heading), mvp, IDENTITY, env);
  }
  for (const p of police) {
    const pm = transform(p.mesh, p.heading, p.x, 0, p.z);
    drawMesh(renderer, pm, mvp, IDENTITY, env);
  }
  for (const p of peds) {
    const bob = Math.sin(t * 6 + p.x) * 0.06;
    const pm = transform(p.mesh, p.heading, p.x, bob, p.z);
    drawMesh(renderer, pm, mvp, IDENTITY, env);
  }
  if (heli) {
    const hm = transform(buildHeli(t), 0, heli.x, heli.y, heli.z);
    drawMesh(renderer, hm, mvp, IDENTITY, env);
  }
  const mk = markerMesh(t);
  if (mk) drawMesh(renderer, mk, mvp, IDENTITY, env);
  // Headlight beams at night: two emissive quads ahead of the player car.
  if (night() && player.inCar) {
    const bm = createMesh();
    const h = car.heading;
    const fx = Math.sin(h), fz = -Math.cos(h);
    for (const s of [-0.45, 0.45]) {
      const bx = car.x + fx * 8 + Math.cos(h) * s, bz = car.z + fz * 8 - Math.sin(h) * s;
      quad(bm, V(car.x + Math.cos(h) * s, 0.8, car.z - Math.sin(h) * s, [1, 0.95, 0.7], [0, 0], 0, 0.5),
        V(bx, 0.4, bz, [1, 0.95, 0.7], [0, 0], 0, 0.5),
        V(bx, 1.2, bz, [1, 0.95, 0.7], [0, 0], 0, 0.5),
        V(car.x + Math.cos(h) * s, 1.1, car.z - Math.sin(h) * s, [1, 0.95, 0.7], [0, 0], 0, 0.5));
    }
    drawMesh(renderer, bm, mvp, IDENTITY, env);
  }
}
// Shot presets: deterministic staged scenes for the screenshots.
if (SHOT === 'play') {
  // Coastal avenue, driving south with the sea and the sunset on the right.
  car.x = -260; car.z = -40; car.heading = Math.PI; car.speed = 28;
  state.heat = 2; state.money = 1250;
  startMission(1);
  // Keep the chase car unobstructed for the screenshot.
  dialogT = 0; $('dialog').style.display = 'none';
  // Stage two traffic cars on the coastal road so the chase frame is alive:
  // one cruising ahead in our lane, one oncoming in the other lane. Spawned
  // far ahead: the player closes ~27 m on them before the shot is taken.
  traffic[0].x = car.x - 4; traffic[0].z = car.z + 75; traffic[0].heading = Math.PI;
  traffic[1].x = car.x + 4; traffic[1].z = car.z + 110; traffic[1].heading = 0;
} else if (SHOT === 'night') {
  player.inCar = false; player.onFoot = { x: -60, z: 150, heading: 0.6 };
  car.x = -66; car.z = 156; car.heading = 0.4;
  timeMin = 21 * 60 + 40; state.heat = 1; state.money = 1890;
  startMission(2); showDialog('Dario: "Package is on Calle Rosa. Move fast, the sweep starts at midnight."', 8);
} else if (SHOT === 'map') {
  state.money = 2450; startMission(3);
} else if (SHOT === 'end') {
  missionPassed = MISSIONS[0]; state.money = 650;
  $('passed-title').textContent = 'MISSION PASSED';
  $('passed-sub').textContent = 'Homecoming — $400';
  $('passed-reward').textContent = 'Reward $400  •  Total $650';
} else if (SHOT === 'start') {
  // Title screen: coastal avenue at sunset, car parked facing south with
  // the sun over the sea ahead-right.
  car.x = -260; car.z = -20; car.heading = Math.PI;
}
$('total-reward').textContent = `Total story rewards: ${formatMoney(TOTAL_REWARD)} across 5 missions`;
requestAnimationFrame(frame);
