// SOLMAR HEAT — main.mjs
// Game bootstrap: builds the world, runs the loop, owns the screen
// state (title / playing / paused / busted / wasted / story done),
// wires every module together, saves progress, and supports the
// deterministic ?shot= modes the screenshots are taken from.
import { SEED_DEFAULT, MISSIONS, STORY } from './config.mjs';
import { makeRng } from './rng.mjs';
import { generateCity } from './city.mjs';
import { createInput } from './input.mjs';
import { createAudio } from './audio.mjs';
import { createPlayer, updatePlayer, hurtPlayer } from './player.mjs';
import { spawnParkedCars, nearestCar, enterCar, exitCar, updateDriving } from './vehicles.mjs';
import { spawnTraffic, updateTraffic, checkTrafficCrash } from './traffic.mjs';
import { spawnPedestrians, updatePedestrians, scareNearby } from './pedestrians.mjs';
import { createPolice, addWanted, updatePolice, clearWanted } from './police.mjs';
import { createCombat, doPunch, doShoot, updateCombat } from './combat.mjs';
import { createMissions, startMission, updateMissions, armHeatMission } from './missions.mjs';
import { drawHud, drawMinimap, drawTitle, drawPaused, drawGameOver } from './hud.mjs';
import { drawWorld } from './render.mjs';

const SAVE_KEY = 'solmar-heat-save-v1';

export function buildGame(seed = SEED_DEFAULT) {
  const rng = makeRng(seed);
  const city = generateCity(rng);
  const G = {
    seed, rng, city,
    time: 0,
    clock: '12:00',
    state: 'title', // title | playing | paused | busted | wasted | story
    player: createPlayer(420, 620),
    cars: spawnParkedCars(rng, city, 26),
    traffic: spawnTraffic(rng, 18),
    peds: spawnPedestrians(rng, city, 42),
    police: createPolice(),
    combat: createCombat(),
    missions: { ...createMissions(), list: MISSIONS },
    camera: { x: 0, y: 0 },
    input: createInput(),
    audio: createAudio(),
    saveExists: false,
    frame: 0,
  };
  return G;
}

export function loadSave(G) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    G.player.money = s.money ?? 50;
    G.player.health = s.health ?? 100;
    G.player.x = s.x ?? 420; G.player.y = s.y ?? 620;
    G.missions.index = Math.min(s.mission ?? 0, MISSIONS.length - 1);
    G.missions.completed = s.completed ?? [];
    G.saveExists = true;
    return true;
  } catch { return false; }
}

export function saveGame(G) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: G.player.money,
      health: G.player.health,
      x: Math.round(G.player.x),
      y: Math.round(G.player.y),
      mission: G.missions.index,
      completed: G.missions.completed,
      savedAt: Date.now(),
    }));
    G.saveExists = true;
  } catch { /* storage unavailable: game still plays */ }
}

function startPlay(G, fresh) {
  G.audio.ensure();
  G.audio.startMusic();
  if (fresh || !loadSave(G)) {
    G.player = createPlayer(420, 620);
    G.missions = { ...createMissions(), list: MISSIONS };
    clearWanted(G.police);
  }
  startMission(G.missions, G.missions.index);
  G.state = 'playing';
  G.missions.message = STORY.intro;
  G.missions.messageTimer = 6;
}

function onCrime(G, kind) {
  if (kind === 'shoot') { addWanted(G.police, 1); scareNearby(G.peds, G.player.x, G.player.y, 320); }
  if (kind === 'punch') { /* punching a cop or a ped draws heat only via hits */ }
}

function updatePlaying(G, dt) {
  const { player, input, police, missions } = G;
  G.time += dt;
  const mins = 12 * 60 + Math.floor(G.time / 10);
  G.clock = `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

  if (input.actionPressed('pause')) { G.state = 'paused'; return; }
  if (input.actionPressed('mute')) G.audio.toggleMute();

  // Enter / exit a car.
  if (input.actionPressed('enterCar')) {
    if (player.inCar) {
      exitCar(player);
      G.audio.engineOff();
    } else {
      const car = nearestCar(G.cars, player.x, player.y);
      if (car) {
        enterCar(player, car);
        if (car.driver === player && car.kind === 'player') addWanted(police, 1); // stealing is a crime
        G.audio.blip(440, 0.08);
      }
    }
  }

  if (player.inCar) {
    const crashed = updateDriving(player.inCar, input, G.city, dt);
    if (crashed) { G.audio.crash(); hurtPlayer(player, 3); }
    G.audio.engine(Math.abs(player.inCar.speed) / 520);
    checkTrafficCrash(G.traffic, player.inCar, () => { addWanted(police, 1); G.audio.crash(); });
    player.x = player.inCar.x; player.y = player.inCar.y;
  } else {
    G.audio.engineOff();
    updatePlayer(player, input, G.city, dt, (kind) => onCrime(G, kind));
    if (player.punching) {
      G.audio.punch();
      doPunch(G.combat, player, G.peds, police, (kind, cash) => {
        if (cash) { player.money += cash; G.audio.pickup(); }
        if (kind === 'cop') addWanted(police, 1);
        if (kind === 'ped' && cash) addWanted(police, 1);
      });
    }
    if (player.shotFired) {
      G.audio.gunshot();
      const tx = G.camera.x + input.mouse.x;
      const ty = G.camera.y + input.mouse.y;
      doShoot(G.combat, player, tx, ty, G.peds, police, G.traffic, (kind, cash) => {
        if (cash) player.money += cash;
        addWanted(police, 1);
      });
    }
  }

  updateTraffic(G.traffic, dt);
  updatePedestrians(G.peds, G.city, player, dt, (ped) => {
    if (player.inCar && Math.abs(player.inCar.speed) > 200) {
      addWanted(police, 1);
    }
  });
  updatePolice(police, player, dt, () => { G.state = 'busted'; saveGame(G); });
  if (police.siren) G.audio.siren();
  updateCombat(G.combat, dt);

  const result = updateMissions(missions, player, police, dt);
  if (result === 'mission') { G.audio.missionDone(); saveGame(G); }
  if (result === 'story') { G.state = 'story'; G.audio.missionDone(); saveGame(G); }
  if (missions.index === 2 && missions.active) armHeatMission(missions, police);

  if (player.dead) { G.state = 'wasted'; saveGame(G); }

  // Camera follows the player, clamped to the world.
  const focusX = player.inCar ? player.inCar.x : player.x;
  const focusY = player.inCar ? player.inCar.y : player.y;
  const canvas = G.canvas;
  G.camera.x = Math.max(0, Math.min(3200 - canvas.width, focusX - canvas.width / 2));
  G.camera.y = Math.max(0, Math.min(2400 - canvas.height, focusY - canvas.height / 2));

  // Autosave every ~20 seconds of play.
  if (Math.floor(G.time) % 20 === 0 && G.frame % 60 === 0) saveGame(G);
}

function draw(G) {
  const ctx = G.ctx, canvas = G.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (G.state === 'title') { drawTitle(ctx, canvas, G.saveExists); return; }
  drawWorld(ctx, G);
  drawHud(ctx, G, canvas);
  drawMinimap(ctx, G, canvas);
  if (G.state === 'paused') drawPaused(ctx, canvas);
  if (G.state === 'busted') drawGameOver(ctx, canvas, 'BUSTED!', G.missions);
  if (G.state === 'wasted') drawGameOver(ctx, canvas, 'WASTED', G.missions);
  if (G.state === 'story') {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffe27a';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KING OF SOLMAR', canvas.width / 2, canvas.height / 2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(STORY.outro, canvas.width / 2, canvas.height / 2 + 28);
    ctx.fillText('Press ENTER to keep cruising the city', canvas.width / 2, canvas.height / 2 + 58);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

function loop(G, last) {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  G.frame++;
  if (G.state === 'playing' && !G.frozen) updatePlaying(G, dt);
  else if (G.state === 'title' && (G.input.actionPressed('enterCar') || G.input.held.has('Enter'))) {
    startPlay(G, !G.saveExists);
  } else if ((G.state === 'busted' || G.state === 'wasted' || G.state === 'story') && G.input.held.has('Enter')) {
    startPlay(G, true);
  } else if (G.state === 'paused' && G.input.actionPressed('pause')) {
    G.state = 'playing';
  }
  draw(G);
  G.input.endFrame();
  requestAnimationFrame((t) => loop(G, now));
}

// Deterministic screenshot setups: put the game straight into a lively
// state so each ?shot= frame shows the named system at work.
export function applyShot(G, shot) {
  startPlay(G, true);
  const p = G.player;
  if (shot === 'driving') {
    const car = G.cars[2];
    enterCar(p, car);
    // Parked just short of the mission marker so the marker, the car,
    // the minimap and the objective line all read in one frame.
    car.x = 950; car.y = 1050; car.angle = 0; car.speed = 380;
    G.camera.x = 450; G.camera.y = 640;
  } else if (shot === 'onfoot') {
    p.x = 640; p.y = 640;
    G.camera.x = 0; G.camera.y = 280;
  } else if (shot === 'chase') {
    const car = G.cars[3];
    enterCar(p, car);
    car.x = 1200; car.y = 1200; car.angle = 0.2; car.speed = 320;
    addWanted(G.police, 3);
    for (const u of G.police.units) { u.car.x = car.x - 160 - Math.random() * 80; u.car.y = car.y + 60; }
    G.camera.x = 600; G.camera.y = 840;
  } else if (shot === 'mission') {
    startMission(G.missions, 1);
    const car = G.cars[1];
    enterCar(p, car);
    car.x = 2400; car.y = 620; car.angle = 0; car.speed = 300;
    G.camera.x = 1760; G.camera.y = 260;
  }
  // Let the world tick a little so traffic and peds are mid-motion.
  for (let i = 0; i < 40; i++) {
    updateTraffic(G.traffic, 0.05);
    updatePedestrians(G.peds, G.city, p, 0.05, null);
  }
  // Freeze the simulation for the staged frame: a screenshot is a still
  // image, so the car keeps its set speed and the mission stays active
  // instead of decaying or completing while the browser fast-forwards.
  G.frozen = true;
  G.state = 'playing';
}

export function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed') || SEED_DEFAULT) || SEED_DEFAULT;
  const G = buildGame(seed);
  G.canvas = canvas; G.ctx = ctx;
  G.input.attach(canvas);
  loadSave(G);
  const shot = params.get('shot');
  if (shot) {
    applyShot(G, shot);
  }
  window.__solmar = G; // exposed for the playtest harness
  requestAnimationFrame((t) => loop(G, t));
  return G;
}

boot();
