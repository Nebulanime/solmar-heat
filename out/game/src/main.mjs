// SOLMAR HEAT — the game itself: state, the fixed step the world simulates in,
// the browser loop that renders it, saves, and the deterministic ?shot= scenes
// the screenshots are taken from. The step is pure enough for headless tests to
// drive missions, heat and police through the same code the browser runs.
import { CFG, clamp } from './config.mjs';
import { makeRng } from './rng.mjs';
import { buildCity } from './city.mjs';
import { createInput, attachInput, ACTION_ENTER, ACTION_CONFIRM, ACTION_RESTART } from './input.mjs';
import { createAudio } from './audio.mjs';
import { createPlayer, stepPlayer, enterCar, exitCar, canSteal } from './player.mjs';
import { makeCar, spawnTrafficCars, stepDrive } from './vehicles.mjs';
import { stepTraffic } from './traffic.mjs';
import { spawnPeds, stepPeds } from './pedestrians.mjs';
import { stepPolice, respawnAfterEnd } from './police.mjs';
import { tryFire, stepBullets, stepPickups } from './combat.mjs';
import { startMission, stepMissions } from './missions.mjs';
import { drawHud } from './hud.mjs';
import { render, updateCamera } from './render.mjs';

export let state = null;

export function createState(seed) {
  const rng = makeRng(seed);
  const city = buildCity(seed);
  const plaza = city.landmarks.plaza;
  const S = {
    seed,
    rng,
    city,
    time: 0,
    screen: 'title',
    deathAt: 0,
    player: createPlayer(plaza.x + 10, plaza.z + 24),
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    looseCash: [],
    tracer: null,
    screenAim: null,
    heat: 0,
    lastCrime: -100,
    mission: null,
    stats: { missionsDone: 0, carsStolen: 0, shotsFired: 0, copsDown: 0 },
    message: '',
    messageUntil: 0,
    prompt: '',
    camera: { x: plaza.x + 10, z: plaza.z + 24, yaw: 0, orbit: 0, zoom: 1 },
    audio: createAudio(),
    saveExists: false,
    shotTitle: false,
    shotMode: false,
    saveGame: null,
  };
  S.cars = spawnTrafficCars(city, rng, CFG.trafficCount);
  S.peds = spawnPeds(city, rng, CFG.pedCount);
  S.saveGame = () => saveGame(S);
  startMission(S, 1);
  return S;
}

export function startGame(seed) {
  state = createState(seed ?? (state ? state.seed : 1));
  state.screen = 'play';
  state.saveExists = hasSave();
  if (state.audio) {
    state.audio.ensure();
    state.audio.startMusic();
  }
  return state;
}

export function stepGame(input, actions = 0, dt = 1 / 60) {
  const S = state;
  if (!S) return;
  S.time += dt;
  const acts = ((input && input.takeActions) ? input.takeActions() : 0) | actions;

  if (S.screen !== 'play') {
    if (acts & ACTION_CONFIRM || acts & ACTION_RESTART) {
      if (S.screen === 'title') startGame(S.seed);
      else respawnAfterEnd(S);
    }
    stepTraffic(S, dt);
    stepPeds(S, dt);
    updateCamera(S, dt);
    return;
  }

  if (input && input.takeOrbit) S.camera.orbit = clamp(S.camera.orbit + input.takeOrbit(), -2.4, 2.4);
  if (acts & ACTION_ENTER) {
    if (S.player.onFoot) enterCar(S);
    else exitCar(S);
  }
  if (input && input.firing && input.firing()) tryFire(S, input);
  if (S.player.onFoot) stepPlayer(S, input || idleInput(), dt);
  else stepDrive(S, input || idleInput(), dt);
  stepTraffic(S, dt);
  stepPeds(S, dt);
  stepPolice(S, dt);
  stepBullets(S, dt);
  stepPickups(S, dt);
  stepMissions(S, dt);
  S.prompt = canSteal(S) ? 'Press E to steal this car' : '';
  updateCamera(S, dt);
}

function idleInput() {
  return {
    forward: () => 0, strafe: () => 0, run: () => false,
    firing: () => false, takeActions: () => 0, takeOrbit: () => 0,
    mouse: () => ({ x: 0, y: 0 }),
  };
}

export function saveGame(S) {
  try {
    const data = {
      cash: S.player.cash,
      missionsDone: S.stats.missionsDone,
      missionIndex: S.mission ? S.mission.index : 1,
      health: S.player.health,
    };
    localStorage.setItem(CFG.saveKey, JSON.stringify(data));
    S.saveExists = true;
  } catch { /* storage unavailable: the game still plays */ }
}

export function loadGame(S) {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    if (!raw) return false;
    const data = JSON.parse(raw);
    S.player.cash = data.cash || 0;
    S.stats.missionsDone = data.missionsDone || 0;
    S.player.health = data.health || CFG.playerHealth;
    const idx = Math.min(4, Math.max(1, (data.missionIndex || 1)));
    startMission(S, idx);
    return true;
  } catch {
    return false;
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(CFG.saveKey);
  } catch {
    return false;
  }
}

// Deterministic screenshot scenes: ?shot=start|drive|chase|mission&seed=N.
// Each one sets the world up from the seed, runs a few fixed steps so traffic
// settles into natural positions, and leaves the frame ready to capture.
export function applyShot(name, seed) {
  const S = startGame(seed);
  S.shotMode = true;
  const drive = {
    forward: () => 1, strafe: () => 0, run: () => false,
    firing: () => false, takeActions: () => 0, takeOrbit: () => 0,
    mouse: () => ({ x: 640, y: 200 }),
  };
  const idle = {
    forward: () => 0, strafe: () => 0, run: () => false,
    firing: () => false, takeActions: () => 0, takeOrbit: () => 0,
    mouse: () => ({ x: 640, y: 200 }),
  };
  if (name === 'start') {
    S.shotTitle = true;
    S.player.x = S.city.landmarks.plaza.x;
    S.player.z = S.city.landmarks.plaza.z + 30;
    S.camera.yaw = 0.5;
    S.camera.zoom = 0.72;
    S.camera.x = S.player.x;
    S.camera.z = S.player.z - 120;
    for (let i = 0; i < 24; i += 1) stepGame(idle, 0, 1 / 60);
    return S;
  }
  if (name === 'drive') {
    const car = S.cars[0];
    S.player.x = car.x + 2;
    S.player.z = car.z;
    stepGame(idle, ACTION_ENTER, 1 / 60);
    S.player.car.x = 0;
    S.player.car.z = -260;
    S.player.car.heading = 0;
    S.player.car.speed = 120;
    S.camera.yaw = 0;
    for (let i = 0; i < 45; i += 1) stepGame(drive, 0, 1 / 60);
    return S;
  }
  if (name === 'chase') {
    const car = S.cars[0];
    S.player.x = car.x + 2;
    S.player.z = car.z;
    stepGame(idle, ACTION_ENTER, 1 / 60);
    S.player.car.x = 100;
    S.player.car.z = 100;
    S.player.car.heading = Math.PI / 2;
    S.player.car.speed = 150;
    S.heat = 65;
    S.lastCrime = S.time;
    for (let i = 0; i < 30; i += 1) stepGame(idle, 0, 1 / 60);
    for (let i = 0; i < 40; i += 1) stepGame(drive, 0, 1 / 60);
    return S;
  }
  // mission: Mara's harbour package, Jax in a car closing on the marina.
  const car = S.cars[0];
  S.player.x = car.x + 2;
  S.player.z = car.z;
  stepGame(idle, ACTION_ENTER, 1 / 60);
  startMission(S, 2);
  S.player.car.x = -50;
  S.player.car.z = 330;
  S.player.car.heading = 0;
  S.player.car.speed = 90;
  S.camera.yaw = 0;
  for (let i = 0; i < 40; i += 1) stepGame(drive, 0, 1 / 60);
  return S;
}

state = createState(1);

function bootstrap() {
  const canvas = document.getElementById('game');
  const statusEl = document.getElementById('status');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const input = createInput();
  attachInput(input, canvas);
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = Number(params.get('seed') || 7);
  if (shot) {
    applyShot(shot, seed);
  } else {
    state.saveExists = hasSave();
  }
  canvas.addEventListener('click', () => {
    if (state.screen === 'title') startGame(state.seed);
  });
  let last = performance.now();
  let frames = 0;
  let mutePressed = false;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 1 / 60);
    last = now;
    if (input.isDown('mute') && !mutePressed) {
      mutePressed = true;
      if (state.audio) state.audio.setMuted(!state.audio.isMuted());
    } else if (!input.isDown('mute')) {
      mutePressed = false;
    }
    if (state.screen === 'title' && input.isDown('confirm')) {
      startGame(state.seed);
    }
    // C on the title screen continues a saved story instead of starting fresh.
    if (state.screen === 'title' && input.isDown('continue') && hasSave()) {
      startGame(state.seed);
      loadGame(state);
    }
    stepGame(input, 0, dt);
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    render(ctx, state, W, H, input);
    if (state.screen === 'play') drawHud(ctx, state, W, H);
    if (statusEl) {
      statusEl.textContent = state.screen === 'play'
        ? `${state.mission ? state.mission.title : ''} — $${state.player.cash}`
        : state.screen;
    }
    frames += 1;
    if (state.shotMode && frames >= 3) {
      window.__shotReady = true;
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (typeof process === 'undefined') {
  if (typeof document !== 'undefined') bootstrap();
}
