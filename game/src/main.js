// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), the renderer paints
// what is there and the HUD updates. The game moves between four screens:
// title, play, paused and game over.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, MAX_FRAME, STEP } from './config.js';
import { createWorld, EVENT_MISSION, EVENT_OVER } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const hud = createHud();
const audio = createAudio();

function readBest() {
  const save = loadSave();
  if (save) return save.bestCash || 0;
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function applySave() {
  const save = loadSave();
  if (!save) return false;
  world.state.cash = save.cash;
  world.missions.index = Math.min(save.missionIndex, 3);
  world.combat.hasPistol = save.hasPistol;
  world.combat.pistolAmmo = save.pistolAmmo;
  world.bestCash = save.bestCash || 0;
  return true;
}

function runShot(name) {
  const scene = stageShot(name, world);
  // Shot scenes show the HUD too, so the screenshot proves the systems.
  hud.update(world, SCREEN_PLAY);
  // Paint synchronously once, then keep repainting every animation frame: a
  // headless screenshot can be taken before the next frame ever fires, and a
  // late window resize clears the canvas, so one paint alone is not enough.
  // The camera is snapped onto the player first: only one or two frames run
  // before the shutter, so a smoothed camera would still be travelling.
  renderer.snap(world);
  renderer.draw(world, scene.screen, scene.best);
  window.__shotReady = true;
  (function repaint() {
    renderer.draw(world, scene.screen, scene.best);
    requestAnimationFrame(repaint);
  })();
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;
  let hadSave = applySave();

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    if (fresh) {
      world.reset();
      world.bestCash = best;
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    renderer.snap(world);
    audio.unlock();
    audio.startMusic();
    audio.startEngine();
    announce('Playing in Solmar. Press M to start the story.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    best = Math.max(best, world.state.cash);
    world.bestCash = best;
    writeSave(world);
    try {
      window.localStorage.setItem(BEST_KEY, String(best));
    } catch {
      // Storage off: the best haul lasts this visit only.
    }
    audio.busted();
    audio.setSiren(false);
    announce(world.state.overKind === 'busted' ? 'Busted by the Solmar PD.' : 'Wasted in Solmar.');
  }

  function handleActions() {
    if (input.actionPressed(ACTION_CONFIRM) && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      startGame(screen === SCREEN_OVER || !hadSave);
      hadSave = true;
      return;
    }
    if (input.actionPressed(ACTION_PAUSE)) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        writeSave(world);
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The title screen shows the living city behind the panel.
      world.step(STEP, { axis: () => ({ x: 0, y: 0 }), held: () => false, actionPressed: () => false, consumeDrag: () => 0, endFrame() {} }, null);
      return;
    }
    const events = world.step(STEP, input, audio);
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_MISSION) announce('Mission complete — paid.');
    saveTimer += STEP;
    if (saveTimer > 10) {
      saveTimer = 0;
      writeSave(world);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, best);
    hud.update(world, screen);
    renderer.setOrbit(world._orbit);
    input.endFrame();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      writeSave(world);
      announce('Paused.');
    }
  });
  canvas.addEventListener('pointerdown', () => {
    audio.unlock();
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startGame(screen === SCREEN_OVER || !hadSave);
  });

  announce('Solmar Heat. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
