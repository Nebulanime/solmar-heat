// SOLMAR HEAT — boot, input, the frame loop and screen flow.
// Nova Vega's Solmar: five missions, traffic, police, a wanted level, shops,
// a safehouse, a radio and a map, all rendered by the hand-written WebGL
// renderer in gl.js over the procedural city in city.js.
import { TIMES, MISSIONS, RADIO } from './config.js';
import { Renderer } from './gl.js';
import { createWorld, update, ambient, startMission, camera, buildDynamic } from './world.js';
import { stageScene, timeForScene } from './shots.js';
import { Hud } from './hud.js';
import { Sound } from './audio.js';
import { validSave } from './logic.js';

const params = new URLSearchParams(location.search);
const scene = params.get('scene') || params.get('shot') || '';
const seed = Number(params.get('seed') || 7) || 7;

let state, renderer, hud, sound;
const input = { up: false, down: false, left: false, right: false, brake: false, sprint: false, action: false, shoot: false };

function loadSave() {
  try {
    const raw = localStorage.getItem('solmar-heat-save');
    if (!raw) return null;
    const s = JSON.parse(raw);
    return validSave(s) ? s : null;
  } catch { return null; }
}

function applySave(s) {
  const p = state.player;
  p.money = s.money; p.health = s.health; p.ammo = s.ammo;
  p.x = s.x; p.z = s.z;
  state.done = s.done.slice();
  state.mission = s.mission;
  state.radio = s.radio;
}

function setScreen(name) {
  state.screen = name;
  hud.showScreen(name);
}

function startPlaying() {
  sound.ensure();
  sound.radio(true, state.radio);
  setScreen('play');
  startMission(state);
  sound.jingle();
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  sound.ensure();
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') input.up = true;
  else if (k === 's' || k === 'arrowdown') input.down = true;
  else if (k === 'a' || k === 'arrowleft') input.left = true;
  else if (k === 'd' || k === 'arrowright') input.right = true;
  else if (k === ' ') { input.brake = true; e.preventDefault(); }
  else if (k === 'shift') input.sprint = true;
  else if (k === 'e' && state.screen === 'play') input.action = true;
  else if (k === 'm') {
    if (state.screen === 'play') setScreen('map');
    else if (state.screen === 'map') setScreen('play');
  } else if (k === 'r' && state.screen === 'play') {
    state.radio = (state.radio + 1) % RADIO.length;
    sound.radio(true, state.radio);
  } else if (k === 'p') {
    if (state.screen === 'play') setScreen('paused');
    else if (state.screen === 'paused') setScreen('play');
  } else if (k === 'h') {
    const h = document.getElementById('hud-help');
    if (h) h.style.display = h.style.display === 'none' ? 'block' : 'none';
  } else if (k === 'enter') {
    if (state.screen === 'title') startPlaying();
    else if (state.screen === 'passed') {
      if (state.passedInfo.startsWith('MISSION FAILED')) { setScreen('play'); startMission(state); }
      else if (state.mission >= MISSIONS.length) setScreen('complete');
      else { setScreen('play'); startMission(state); sound.jingle(); }
    } else if (state.screen === 'busted') {
      const p = state.player;
      p.health = 100; p.wanted = 0; p.x = -54; p.z = -108; p.onFoot = true; p.speed = 0;
      setScreen('play');
    } else if (state.screen === 'complete') setScreen('play');
  } else if (k === 'c' && state.screen === 'title') {
    const s = loadSave();
    if (s) {
      applySave(s);
      sound.ensure();
      sound.radio(true, state.radio);
      setScreen('play');
      startMission(state);
    }
  } else if (k === 'escape' && state.screen === 'map') setScreen('play');
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') input.up = false;
  else if (k === 's' || k === 'arrowdown') input.down = false;
  else if (k === 'a' || k === 'arrowleft') input.left = false;
  else if (k === 'd' || k === 'arrowright') input.right = false;
  else if (k === ' ') input.brake = false;
  else if (k === 'shift') input.sprint = false;
});

window.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || state.screen !== 'play' || !state.player.onFoot) return;
  sound.ensure();
  input.shoot = true;
  sound.shot();
});

function boot() {
  const time = scene ? timeForScene(scene) : TIMES.sunset;
  state = createWorld(seed, time);
  renderer = new Renderer(document.getElementById('game'));
  renderer.setStatic(state.city.geom);
  hud = new Hud(state);
  sound = new Sound();
  if (scene) stageScene(state, scene);
  hud.showScreen(state.screen);
  lastScreen = state.screen;
  window.__solmar = { state, ready: true, scene };
  requestAnimationFrame(frame);
}

let last = performance.now();
let titleAngle = 0;
let lastScreen = '';
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  // world.js flips state.screen directly on mission pass / bust — mirror it to the DOM.
  if (state.screen !== lastScreen) { hud.showScreen(state.screen); lastScreen = state.screen; }
  let view;
  if (state.screen === 'title') {
    // Slow orbit over the sunset city behind the title screen.
    titleAngle += dt * 0.05;
    ambient(state, dt);
    view = {
      eye: [Math.sin(titleAngle) * 150, 46, Math.cos(titleAngle) * 150],
      target: [0, 8, 0],
      sunScreenX: 0.72, sunScreenY: 0.42,
    };
  } else {
    if (state.screen === 'play' && !state.frozen) {
      update(state, dt, input);
      sound.engine(state.player.speed, !state.player.onFoot);
      sound.siren(state.player.wanted > 0);
    }
    view = camera(state, dt);
  }
  renderer.setDynamic(buildDynamic(state));
  renderer.render(view, state.time);
  hud.update();
  if (params.get('debug')) {
    const p = state.player;
    document.getElementById('status').textContent = `px=${p.x.toFixed(1)} pz=${p.z.toFixed(1)} ang=${p.angle.toFixed(2)} spd=${p.speed.toFixed(1)} cam=${view.eye.map((v) => v.toFixed(1)).join(',')} tgt=${view.target.map((v) => v.toFixed(1)).join(',')} screen=${state.screen} wanted=${p.wanted} hp=${p.health.toFixed(0)}`;
  }
  requestAnimationFrame(frame);
}

try {
  boot();
} catch (err) {
  window.__solmarError = String(err && err.stack || err);
  document.getElementById('status').textContent = 'Failed to start: ' + err.message;
}
