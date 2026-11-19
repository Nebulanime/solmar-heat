// SOLMAR HEAT — main.js
// Browser entrypoint: canvas setup, the frame loop, input wiring, the
// HUD update, and the debug handle the screenshot stager and the
// headless playtest use. This is the file index.html loads; the game
// logic itself lives in game.js.

import { Game } from './game.js';
import { Hud } from './hud.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(window.innerWidth * dpr);
  const h = Math.round(window.innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}
window.addEventListener('resize', resize);
resize();

let game;
let hud;
try {
  game = new Game(canvas);
  hud = new Hud(game);
} catch (err) {
  window.__bootError = String(err && err.stack || err);
  document.body.innerHTML = '<pre style="color:#fff;background:#300;padding:20px;font:14px monospace">'
    + window.__bootError.replace(/</g, '&lt;') + '</pre>';
  throw err;
}

game.input.attach();

// Audio needs a user gesture in a real browser; unlock it on the first
// key or click, and never let a failure stop the game.
const unlockAudio = () => game.audio.ensure();
window.addEventListener('keydown', unlockAudio, { once: true });
window.addEventListener('pointerdown', unlockAudio, { once: true });

// Collect page errors so the headless playtest can report them.
window.__errors = [];
window.addEventListener('error', (e) => {
  window.__errors.push(String(e.message || e.error || e));
});
window.addEventListener('unhandledrejection', (e) => {
  window.__errors.push('unhandled: ' + String(e.reason));
});

// Debug handle for the screenshot stager (shots.js) and playtests.
// Normal players never touch this; it is how the four screenshots and
// the headless mission playtest drive the game without a keyboard.
window.__solmar = {
  game,
  hud,
  version: 'r7',
  completeObjective() {
    game.completeCurrentStep();
  },
  state() {
    return game.hudState();
  },
};

let last = performance.now();
let frames = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  frames++;
  try {
    game.update(dt);
    game.render();
    hud.update(game.hudState());
  } catch (err) {
    window.__errors.push('frame: ' + String(err && err.stack || err));
  }
  window.__frames = frames;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Screenshot staging: ?shot=chase|night|title|map stages the scene, then
// sets window.__shotReady so the capture script knows the frame is done.
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  stageShot(game, shot, params).catch((err) => {
    window.__shotError = String(err && err.stack || err);
  });
}

// ---- Frame counter export (second pass) ----------------------------------
// The playtest reads window.__frames to confirm the loop is alive and
// advancing; main.js sets it every frame above. Nothing else to add.
export const SHOT_NAMES = ['chase', 'night', 'title', 'map'];
