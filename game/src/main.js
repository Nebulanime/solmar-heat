// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between four screens: title, play,
// paused and game over. ?seed=N fixes the city. ?shot=start|drive|chase|mission
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, PLAYER, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createTraffic, stepTraffic } from './traffic.js';
import { spawnPlayer, stepPlayer, EVENT_CRASH, EVENT_PICKUP } from './player.js';
import { stepPolice, EVENT_BUSTED } from './police.js';
import { stepCombat, EVENT_EXPLOSION, EVENT_SHOT, EVENT_WASTED } from './combat.js';
import { startMission, stepMissions } from './missions.js';
import { createAudio } from './audio.js';
import { autopilotInput, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;
const SAVE_EVERY = 5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function createGame(gameSeed) {
  const rng = createRandom(gameSeed);
  const state = {
    seed: gameSeed,
    rng,
    time: 0,
    city: null,
    player: {
      x: 0, z: 0, heading: 0, speed: 0, vx: 0, vz: 0,
      onFoot: true, car: null, health: PLAYER.health, cash: 0,
      invuln: 0, fireCooldown: 0,
    },
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    particles: [],
    pickups: [],
    wanted: 0,
    heat: 0,
    lastCrime: 0,
    lastHurt: -10,
    mission: { index: 0, step: 0, label: '', target: null, timer: -1, hold: 0 },
    camera: { yaw: 0, orbit: 0 },
    screen: SCREEN_TITLE,
    overReason: null,
    messages: [],
    stats: { missionsDone: 0, finished: false },
    nextCarId: 1,
    saveTimer: 0,
  };
  state.city = createCity(rng);
  spawnPlayer(state);
  createTraffic(state);
  return state;
}

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.player.cash,
      missionsDone: state.stats.missionsDone,
      finished: state.stats.finished,
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Best score then lasts this visit only.
  }
}

/** Apply a loaded save onto a fresh state (cash, missions, completion). */
function applySave(state, saveData) {
  if (!saveData) return;
  state.player.cash = saveData.cash || 0;
  state.stats.missionsDone = saveData.missionsDone || 0;
  state.stats.finished = !!saveData.finished;
}

let state = createGame(seed);
let best = readBest();
applySave(state, readSave());

/** One fixed step of every system, in order. `actions` were already taken by the caller. */
function stepGame(input, actions, dt) {
  state.time += dt;
  const hpBefore = state.player.health;
  // The camera chases the player's heading, plus whatever the mouse orbited.
  state.camera.orbit += input.takeOrbit() * 0.005;
  const targetYaw = state.player.heading + state.camera.orbit;
  state.camera.yaw += wrapAngle(targetYaw - state.camera.yaw) * Math.min(1, 5 * dt);

  const missionBefore = `${state.mission.index}:${state.mission.step}`;
  const doneBefore = state.stats.missionsDone;

  const playerEvents = stepPlayer(state, input, actions, dt);
  stepTraffic(state, dt);
  const policeEvents = stepPolice(state, dt);
  // Aim with the mouse: where the pointer falls on the ground, else straight ahead.
  let aim = { x: state.player.x + Math.sin(state.player.heading) * 20, z: state.player.z + Math.cos(state.player.heading) * 20 };
  const mouse = input.mouse();
  const ground = renderer.screenToGround(mouse.x, mouse.y);
  if (ground) aim = ground;
  const combatEvents = stepCombat(state, input.firing(), aim.x, aim.z, dt);
  stepMissions(state, dt);

  if (playerEvents & EVENT_CRASH) {
    audio.crash();
    state.lastHurt = state.time;
  }
  // Any health drop at all counts as being hurt (crash, ram, explosion).
  if (state.player.health < hpBefore) state.lastHurt = state.time;
  if (playerEvents & EVENT_PICKUP) audio.pickup();
  if (combatEvents & EVENT_SHOT) audio.shot();
  if (combatEvents & EVENT_EXPLOSION) audio.crash();
  if (state.stats.missionsDone > doneBefore) audio.jingle();
  const missionAfter = `${state.mission.index}:${state.mission.step}`;
  if (missionBefore !== missionAfter && state.mission.index > 0 && state.mission.step === 0 && missionBefore.split(':')[1] !== '0') {
    audio.sting();
  }

  // Engine and siren follow the world; the music plays while driving around.
  const driving = !state.player.onFoot && state.player.car;
  audio.engine(driving ? Math.abs(state.player.car.speed) / 34 : 0, !!driving);
  let copNear = false;
  for (const cop of state.cops) {
    const dx = cop.x - state.player.x;
    const dz = cop.z - state.player.z;
    if (dx * dx + dz * dz < 14400) {
      copNear = true;
      break;
    }
  }
  audio.siren(state.wanted > 0 && copNear, state.time);
  audio.music(dt, state.screen === SCREEN_PLAY);

  // Old messages fade out of the feed.
  while (state.messages.length > 0 && state.time - state.messages[0].t > 6) state.messages.shift();

  // Save every few seconds of play.
  state.saveTimer += dt;
  if (state.saveTimer > SAVE_EVERY) {
    state.saveTimer = 0;
    writeSave(state);
  }

  if (policeEvents & EVENT_BUSTED) endGame('busted');
  else if (combatEvents & EVENT_WASTED) endGame('wasted');
  else if (state.player.health <= 0) endGame('wasted');
}

function endGame(reason) {
  state.screen = SCREEN_OVER;
  state.overReason = reason;
  if (state.player.cash > best) {
    best = state.player.cash;
    saveBest(best);
  }
  writeSave(state);
  announce(reason === 'busted' ? 'Busted. The Solmar PD caught Jax.' : 'Wasted. Jax went down.');
}

function startGame() {
  audio.unlock();
  state = createGame(Math.floor(Math.random() * 4294967296));
  applySave(state, readSave());
  state.screen = SCREEN_PLAY;
  const next = state.stats.missionsDone + 1;
  if (!state.stats.finished && next <= 4) startMission(state, next);
  announce('Playing. Steal a car — E — and follow the job.');
}

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const scene = stageShot(name, state);
  const input = scene.orbit
    ? { forward: () => 0, strafe: () => 0, run: () => false, firing: () => false, takeOrbit: () => 0, mouse: () => ({ x: 0, y: 0 }), takeActions: () => 0 }
    : autopilotInput(state);
  const steps = Math.round(scene.seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (scene.orbit) state.camera.orbit += 0.0016;
    stepGame(input, 0, STEP);
    if (state.screen === SCREEN_OVER) break;
  }
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (state.screen === SCREEN_TITLE || state.screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startGame();
    } else if (state.screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        state.screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (state.screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        state.screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (state.screen === SCREEN_PLAY) {
      let stepActions = actions;
      while (accumulator >= STEP) {
        stepGame(input, stepActions, STEP);
        stepActions = 0; // one-shot presses count once, on the first step
        accumulator -= STEP;
        if (state.screen !== SCREEN_PLAY) break;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(state, state.screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === SCREEN_PLAY) {
      state.screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('SOLMAR HEAT. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

// Exported for automated tests (node test-game.mjs) and debugging; the game
// itself never calls these from outside main.js.
export { createGame, startGame, stepGame, state, renderer, audio };
