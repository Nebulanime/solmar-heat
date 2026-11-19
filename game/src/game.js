// SOLMAR HEAT — game.js
// The game itself: state machine (title / playing / paused / map /
// busted), player on foot and in a car, traffic and pedestrians, police
// and the helicopter, the five story missions, wanted level, shops,
// safehouse saving, day/night, and the camera. Rendering lives in
// render.js; the DOM HUD lives in hud.js; this file wires them together.

import {
  WORLD, MISSIONS, SHOPS, SAFEHOUSE, PLAYER, TUNING, RADIO, DIALOGUE,
  districtAt, streetAt,
} from './config.js';
import { generateCity, randomRoadPoint, randomSidewalkPoint } from './world.js';
import { Renderer, mat4Model } from './render.js';
import { createAtlas, paintAtlasRest, createGlowTexture, createBlobTexture } from './textures.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import {
  addWanted, copsForWanted, heliForWanted, advanceStep, currentStep,
  allMissionsDone, makeSave, parseSave, SAVE_KEY, resolveCircleBox,
  WANTED_DECAY_SECONDS, formatMoney,
} from './logic.js';
import { mulberry32, int, range, pick, clamp, lerp, angleDiff, dist2 } from './random.js';

const CAR_COLORS = [
  [0.75, 0.12, 0.14], [0.12, 0.35, 0.75], [0.85, 0.75, 0.25],
  [0.25, 0.7, 0.3], [0.9, 0.9, 0.92], [0.15, 0.15, 0.18],
  [0.85, 0.4, 0.1], [0.55, 0.2, 0.6], [0.2, 0.6, 0.6],
];

const PED_SHIRTS = [
  [0.9, 0.3, 0.3], [0.3, 0.5, 0.9], [0.9, 0.8, 0.3], [0.3, 0.8, 0.4],
  [0.9, 0.5, 0.8], [0.95, 0.95, 0.95], [0.2, 0.2, 0.25], [0.9, 0.55, 0.2],
];
const PED_PANTS = [[0.15, 0.18, 0.3], [0.3, 0.25, 0.2], [0.5, 0.5, 0.55], [0.2, 0.3, 0.2]];
const PED_SKINS = [[0.85, 0.65, 0.5], [0.65, 0.45, 0.32], [0.45, 0.32, 0.22], [0.95, 0.8, 0.68]];
const PED_HAIRS = [[0.1, 0.08, 0.06], [0.4, 0.25, 0.1], [0.7, 0.7, 0.7], [0.15, 0.12, 0.3]];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.input = new Input();
    this.audio = new AudioEngine();
    this.renderer = new Renderer(canvas);
    const atlas = createAtlas();
    paintAtlasRest(atlas);
    this.renderer.setTextures(atlas, createGlowTexture(), createBlobTexture());
    this.city = generateCity(20261119);
    this.renderer.buildStaticCity(this.city);
    this.rng = mulberry32(777);
    this.reset();
  }

  reset() {
    this.state = 'title';
    this.menuIndex = 0;
    this.menuItems = ['CONTINUE', 'NEW GAME', 'MISSIONS', 'MAP', 'OPTIONS'];
    this.dayT = 0.74; // golden sunset over the bay
    this.timeScale = 1;
    this.cameraMode = 0; // 0 chase near, 1 chase far, 2 hood, 3 top
    this.camYaw = Math.PI;
    this.camDist = 11;
    this.camHeight = 4.2;
    this.player = {
      x: PLAYER.startX, z: PLAYER.startZ, yaw: Math.PI / 2, speed: 0,
      inCar: false, health: PLAYER.health, money: PLAYER.money,
      ammo: PLAYER.pistolAmmo, wanted: 0, runT: 0,
    };
    this.playerCar = null; // the car the player drives (a traffic car object)
    this.mission = { index: 0, step: 0 };
    this.dialog = null;
    this.banner = null;
    this.dispatch = [];
    this.bustedT = 0;
    this.quietT = 0;
    this.saveData = this.loadSave();
    this.spawnTraffic();
    this.spawnPeds();
    this.cops = [];
    this.heli = null;
    this.heliAngle = 0;
    this.rotorAngle = 0;
    this.muted = false;
    this.missionsOverlay = false;
    this.optionsOverlay = false;
    this.titleT = 0;
    this.talkFlash = 0;
    this.showDialog(DIALOGUE.intro, 'NOVA', 6);
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? parseSave(raw) : null;
    } catch {
      return null;
    }
  }

  saveGame() {
    const s = makeSave({
      money: this.player.money,
      missionIndex: this.mission.index,
      missionStep: this.mission.step,
      x: this.player.x, z: this.player.z,
      health: this.player.health, ammo: this.player.ammo,
    });
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
      this.saveData = s;
      this.showDialog(DIALOGUE.save, 'SOLMAR', 4);
    } catch { /* storage unavailable: play on without saving */ }
    return s;
  }

  spawnTraffic() {
    this.traffic = [];
    for (let i = 0; i < TUNING.trafficCount; i++) {
      const p = randomRoadPoint(this.rng);
      const axis = p.axis;
      const dir = this.rng() < 0.5 ? 1 : -1;
      const yaw = axis === 'z' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      this.traffic.push({
        x: p.x, z: p.z, yaw, speed: range(this.rng, 6, 11),
        color: pick(this.rng, CAR_COLORS), sport: this.rng() < 0.25,
        axis, dir, waitT: 0, mesh: null,
      });
    }
  }

  spawnPeds() {
    this.peds = [];
    for (let i = 0; i < TUNING.pedCount; i++) {
      const p = randomSidewalkPoint(this.rng);
      this.peds.push({
        x: p.x, z: p.z, yaw: range(this.rng, 0, Math.PI * 2),
        speed: range(this.rng, 0.9, 1.8),
        cfg: {
          shirt: pick(this.rng, PED_SHIRTS),
          pants: pick(this.rng, PED_PANTS),
          skin: pick(this.rng, PED_SKINS),
          hair: pick(this.rng, PED_HAIRS),
          height: range(this.rng, 1.6, 1.9),
          hat: this.rng() < 0.25 ? pick(this.rng, [[0.9, 0.85, 0.6], [0.2, 0.2, 0.25], [0.85, 0.3, 0.3]]) : null,
          bag: this.rng() < 0.3 ? pick(this.rng, [[0.5, 0.3, 0.15], [0.2, 0.4, 0.2]]) : null,
          dress: this.rng() < 0.2,
        },
        turnT: range(this.rng, 2, 8),
        bob: this.rng() * Math.PI * 2,
      });
    }
  }

  showDialog(text, speaker, seconds = 5) {
    this.dialog = { text, speaker, until: performance.now() / 1000 + seconds };
  }

  showBanner(title, sub = '') {
    this.banner = { title, sub, until: performance.now() / 1000 + 3.5 };
  }

  dispatchMsg(text) {
    this.dispatch.unshift(text);
    if (this.dispatch.length > 4) this.dispatch.pop();
  }

  currentMission() {
    return MISSIONS[this.mission.index] ?? null;
  }

  currentStep() {
    return currentStep(this.mission);
  }

  // The world position the current objective points at (for the beacon,
  // the minimap blip and the HUD distance readout).
  objectivePos() {
    const step = this.currentStep();
    if (!step) return null;
    if (step.type === 'wanted') return { x: SAFEHOUSE.x, z: SAFEHOUSE.z };
    return { x: step.x, z: step.z };
  }
}

// ---- Per-frame update ----------------------------------------------------

Game.prototype.update = function (dt) {
  const now = performance.now() / 1000;
  if (this.dialog && now > this.dialog.until) this.dialog = null;
  if (this.banner && now > this.banner.until) this.banner = null;
  this.titleT += dt;

  if (this.state === 'title') {
    this.updateTitle(dt);
    this.updateTraffic(dt);
    this.updatePeds(dt);
    return;
  }
  if (this.state === 'paused' || this.state === 'map' || this.state === 'busted') {
    this.updatePaused(dt);
    return;
  }
  // Playing.
  this.dayT = (this.dayT + (dt / TUNING.dayLengthSeconds) * this.timeScale) % 1;
  this.updatePlayer(dt);
  this.updateTraffic(dt);
  this.updatePeds(dt);
  this.updatePolice(dt);
  this.updateMissions();
  this.updateCamera(dt);
  this.audio.setEngine(
    this.player.inCar && this.playerCar ? Math.abs(this.playerCar.speed) / TUNING.carMaxSpeed : 0,
    this.player.inCar,
  );
  this.audio.setSiren(this.player.wanted > 0);
};

Game.prototype.updateTitle = function (dt) {
  const input = this.input;
  if (this.missionsOverlay || this.optionsOverlay) {
    if (input.pressed('Escape') || input.pressed('Enter')) {
      this.missionsOverlay = false;
      this.optionsOverlay = false;
    }
    if (this.optionsOverlay && input.pressed('KeyM')) {
      this.muted = !this.muted;
      this.audio.setMuted(this.muted);
    }
    return;
  }
  if (input.pressed('ArrowDown') || input.pressed('KeyS')) {
    this.menuIndex = (this.menuIndex + 1) % this.menuItems.length;
    this.audio.blip(660, 0.06, 0.06);
  }
  if (input.pressed('ArrowUp') || input.pressed('KeyW')) {
    this.menuIndex = (this.menuIndex - 1 + this.menuItems.length) % this.menuItems.length;
    this.audio.blip(660, 0.06, 0.06);
  }
  if (input.pressed('Enter') || input.pressed('Space')) this.activateMenu();
};

Game.prototype.activateMenu = function () {
  const item = this.menuItems[this.menuIndex];
  this.audio.ensure();
  if (item === 'CONTINUE') {
    if (this.saveData) {
      this.applySave(this.saveData);
      this.state = 'playing';
      this.showDialog('Back on the streets of Solmar. The city kept your seat warm.', 'NOVA', 5);
    } else {
      this.startNewGame();
    }
  } else if (item === 'NEW GAME') {
    this.startNewGame();
  } else if (item === 'MISSIONS') {
    this.missionsOverlay = true;
  } else if (item === 'MAP') {
    this.state = 'map';
  } else if (item === 'OPTIONS') {
    this.optionsOverlay = true;
  }
};

Game.prototype.startNewGame = function () {
  this.player.money = PLAYER.money;
  this.player.health = PLAYER.health;
  this.player.ammo = PLAYER.pistolAmmo;
  this.player.wanted = 0;
  this.player.x = PLAYER.startX;
  this.player.z = PLAYER.startZ;
  this.player.yaw = Math.PI / 2;
  this.player.inCar = false;
  this.playerCar = null;
  this.mission = { index: 0, step: 0 };
  this.state = 'playing';
  this.showDialog(DIALOGUE.intro, 'NOVA', 6);
};

Game.prototype.applySave = function (s) {
  this.player.money = s.money;
  this.player.health = s.health;
  this.player.ammo = s.ammo;
  this.player.x = s.x;
  this.player.z = s.z;
  this.player.inCar = false;
  this.playerCar = null;
  this.mission = { index: s.missionIndex, step: s.missionStep };
  this.state = 'playing';
};

Game.prototype.updatePaused = function (dt) {
  const input = this.input;
  if (this.state === 'busted') {
    if (input.pressed('Enter') || input.pressed('Space')) {
      // Released: respawn at the safehouse, lighter by $200, heat gone.
      this.player.money = Math.max(0, this.player.money - 200);
      this.player.wanted = 0;
      this.player.health = PLAYER.health;
      this.player.x = SAFEHOUSE.x;
      this.player.z = SAFEHOUSE.z;
      this.player.inCar = false;
      this.playerCar = null;
      this.cops = [];
      this.heli = null;
      this.state = 'playing';
      this.showDialog('Out on bail, back at the safehouse. Solmar gives second chances — expensive ones.', 'NOVA', 5);
    }
    return;
  }
  if (input.pressed('KeyP') || input.pressed('Escape') || (this.state === 'map' && input.pressed('KeyM'))) {
    this.state = 'playing';
  }
};

Game.prototype.updatePlayer = function (dt) {
  const input = this.input;
  const p = this.player;
  if (input.pressed('KeyP') || input.pressed('Escape')) {
    this.state = 'paused';
    return;
  }
  if (input.pressed('KeyM')) { this.state = 'map'; return; }
  if (input.pressed('KeyC')) {
    this.cameraMode = (this.cameraMode + 1) % 4;
  }
  if (input.pressed('KeyR')) {
    this.audio.cycleStation();
    const st = RADIO[this.audio.station];
    this.showDialog(`Radio: ${st.name} — ${st.desc}.`, 'RADIO', 3);
  }
  if (input.pressed('KeyN')) {
    const presets = [0.32, 0.74, 0.92];
    let best = presets[0];
    let bd = 99;
    for (const pr of presets) {
      const d = Math.abs(this.dayT - pr);
      if (d < bd) { bd = d; best = pr; }
    }
    this.dayT = presets[(presets.indexOf(best) + 1) % presets.length];
  }

  if (p.inCar && this.playerCar) this.updateDriving(dt);
  else this.updateOnFoot(dt);

  // Interactions (E).
  if (input.pressed('KeyE')) this.tryInteract();
};

Game.prototype.updateOnFoot = function (dt) {
  const input = this.input;
  const p = this.player;
  const axes = input.moveAxes();
  const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  // Movement is relative to the camera: W walks away from the camera.
  // camYaw points from the player TO the camera (the camera sits at
  // player + back * dist), so forward is camYaw + PI; the strafe term is
  // subtracted because screen-right is camYaw + PI/2. The turn is
  // smoothed so the camera auto-follow cannot spin the player in a
  // circle (camYaw chases player.yaw + PI every frame).
  const moveYaw = this.camYaw + Math.PI - Math.atan2(axes.x, axes.y);
  if (axes.x !== 0 || axes.y !== 0) {
    p.yaw += angleDiff(p.yaw, moveYaw) * Math.min(1, dt * 12);
    p.x += Math.sin(p.yaw) * speed * dt;
    p.z += Math.cos(p.yaw) * speed * dt;
    p.runT += dt * (run ? 14 : 9);
  }
  p.x = clamp(p.x, WORLD.minX, WORLD.maxX);
  p.z = clamp(p.z, WORLD.minZ, WORLD.maxZ);
  const hit = this.collideCircle(p.x, p.z, 0.9);
  p.x = hit.x;
  p.z = hit.z;
};

Game.prototype.updateDriving = function (dt) {
  const input = this.input;
  const car = this.playerCar;
  const p = this.player;
  const axes = input.moveAxes();
  const brake = input.isDown('Space');
  const accel = axes.y;
  if (accel > 0) car.speed += TUNING.carAccel * dt;
  else if (accel < 0) {
    if (car.speed > 0.5) car.speed -= TUNING.carBrake * dt;
    else car.speed -= TUNING.carAccel * 0.6 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 6 * dt;
    if (Math.abs(car.speed) < 0.2) car.speed = 0;
  }
  if (brake) car.speed -= Math.sign(car.speed) * TUNING.carBrake * dt * 1.4;
  car.speed = clamp(car.speed, -TUNING.carReverseMax, TUNING.carMaxSpeed);
  const steer = axes.x * TUNING.carTurn * clamp(Math.abs(car.speed) / 8, 0, 1);
  car.yaw += steer * dt * Math.sign(car.speed || 1);
  car.x += Math.sin(car.yaw) * car.speed * dt;
  car.z += Math.cos(car.yaw) * car.speed * dt;
  car.x = clamp(car.x, WORLD.minX, WORLD.maxX);
  car.z = clamp(car.z, WORLD.minZ, WORLD.maxZ);
  const hit = this.collideCircle(car.x, car.z, 1.7);
  if (hit.hit && Math.abs(car.speed) > 6) {
    this.audio.crash();
    car.speed *= 0.35;
  }
  car.x = hit.x;
  car.z = hit.z;
  // Bump into traffic cars: a soft push, no full physics.
  for (const t of this.traffic) {
    const d = dist2(car.x, car.z, t.x, t.z);
    if (d < 3.4 && d > 0.01) {
      const push = (3.4 - d) / d;
      car.x += (car.x - t.x) * push * 0.5;
      car.z += (car.z - t.z) * push * 0.5;
      if (Math.abs(car.speed) > 8) {
        this.audio.crash();
        car.speed *= 0.6;
        t.speed *= 0.5;
      }
    }
  }
  // Running over a pedestrian is a crime, not a sport.
  for (let i = this.peds.length - 1; i >= 0; i--) {
    const ped = this.peds[i];
    if (dist2(car.x, car.z, ped.x, ped.z) < 2.2 && Math.abs(car.speed) > 2) {
      this.peds.splice(i, 1);
      this.raiseWanted(1, 'Pedestrian down — dispatch is sending units.');
      this.respawnPed();
    }
  }
  p.x = car.x;
  p.z = car.z;
  p.yaw = car.yaw;
};

Game.prototype.collideCircle = function (x, z, r) {
  let hit = false;
  for (const c of this.city.colliders) {
    const res = resolveCircleBox(x, z, r, c);
    if (res.hit) {
      x = res.x;
      z = res.z;
      hit = true;
    }
  }
  return { x, z, hit };
};

// ---- Interactions, traffic, pedestrians, police, missions --------------

Game.prototype.tryInteract = function () {
  const p = this.player;
  const step = this.currentStep();
  // Talk step: press E at the marker.
  if (step && step.type === 'talk' && dist2(p.x, p.z, step.x, step.z) <= (step.radius ?? 6)) {
    this.completeCurrentStep();
    return;
  }
  // Safehouse: save the game.
  if (dist2(p.x, p.z, SAFEHOUSE.x, SAFEHOUSE.z) < 10 && !p.inCar) {
    this.saveGame();
    return;
  }
  // Shops: buy what they sell.
  for (const shop of SHOPS) {
    if (dist2(p.x, p.z, shop.x, shop.z) < 7 && !p.inCar) {
      if (p.money < shop.price) {
        this.showDialog(`Not enough cash for ${shop.name} ($${shop.price}).`, 'SOLMAR', 3);
        return;
      }
      p.money -= shop.price;
      if (shop.kind === 'heal' || shop.kind === 'food') {
        p.health = 100;
        this.showDialog(DIALOGUE[shop.kind === 'heal' ? 'shopHeal' : 'shopFood'], shop.name.toUpperCase(), 3);
      } else if (shop.kind === 'ammo') {
        p.ammo += 48;
        this.showDialog(DIALOGUE.shopAmmo, shop.name.toUpperCase(), 3);
      } else {
        this.showDialog(DIALOGUE.shopClothes, shop.name.toUpperCase(), 3);
      }
      this.audio.blip(1200, 0.1, 0.1);
      return;
    }
  }
  // Enter / exit a car.
  if (p.inCar) {
    const car = this.playerCar;
    p.inCar = false;
    p.x = car.x - Math.sin(car.yaw + Math.PI / 2) * 2.2;
    p.z = car.z - Math.cos(car.yaw + Math.PI / 2) * 2.2;
    p.yaw = car.yaw;
    this.playerCar = null;
    return;
  }
  let best = null;
  let bestD = 4.5;
  for (const t of this.traffic) {
    const d = dist2(p.x, p.z, t.x, t.z);
    if (d < bestD) { best = t; bestD = d; }
  }
  if (best) {
    this.traffic.splice(this.traffic.indexOf(best), 1);
    this.playerCar = best;
    best.speed = 0;
    best.cop = false;
    p.inCar = true;
    this.raiseWanted(1, 'Grand theft auto — a 10-91 on Neon Ave. Units respond.');
    this.showDialog(DIALOGUE.enterCar, 'NOVA', 3);
    this.audio.blip(520, 0.12, 0.12);
    this.respawnTrafficCar();
  }
};

Game.prototype.raiseWanted = function (amount, msg) {
  const before = this.player.wanted;
  this.player.wanted = addWanted(this.player.wanted, amount);
  if (this.player.wanted > before) {
    this.dispatchMsg(msg || DIALOGUE.wantedUp);
    this.showDialog(DIALOGUE.wantedUp, 'DISPATCH', 3);
  }
};

Game.prototype.respawnTrafficCar = function () {
  const p = randomRoadPoint(this.rng);
  const axis = p.axis;
  const dir = this.rng() < 0.5 ? 1 : -1;
  const yaw = axis === 'z' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  this.traffic.push({
    x: p.x, z: p.z, yaw, speed: range(this.rng, 6, 11),
    color: pick(this.rng, CAR_COLORS), sport: this.rng() < 0.25,
    axis, dir, waitT: 0,
  });
};

Game.prototype.respawnPed = function () {
  const p = randomSidewalkPoint(this.rng);
  this.peds.push({
    x: p.x, z: p.z, yaw: range(this.rng, 0, Math.PI * 2),
    speed: range(this.rng, 0.9, 1.8),
    cfg: {
      shirt: pick(this.rng, PED_SHIRTS), pants: pick(this.rng, PED_PANTS),
      skin: pick(this.rng, PED_SKINS), hair: pick(this.rng, PED_HAIRS),
      height: range(this.rng, 1.6, 1.9), hat: null, bag: null, dress: false,
    },
    turnT: range(this.rng, 2, 8), bob: 0,
  });
};

Game.prototype.updateTraffic = function (dt) {
  for (const t of this.traffic) {
    // Drive along the current street axis; at an intersection, maybe turn.
    const nearCross = (v) => {
      const k = Math.round((v + 240) / 80);
      const c = -240 + k * 80;
      return Math.abs(v - c) < 7;
    };
    const atIntersection = (t.axis === 'z' && nearCross(t.z)) || (t.axis === 'x' && nearCross(t.x));
    if (atIntersection && this.rng() < dt * 0.5) {
      // Turn: switch axis and pick a direction on the new street.
      if (t.axis === 'z') {
        t.axis = 'x';
        t.dir = this.rng() < 0.5 ? 1 : -1;
        t.z = Math.round((t.z + 240) / 80) * 80 - 240 + (t.dir > 0 ? 3.5 : -3.5);
      } else {
        t.axis = 'z';
        t.dir = this.rng() < 0.5 ? 1 : -1;
        t.x = Math.round((t.x + 320) / 80) * 80 - 320 + (t.dir > 0 ? 3.5 : -3.5);
      }
    }
    const targetYaw = t.axis === 'z' ? (t.dir > 0 ? 0 : Math.PI) : (t.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    t.yaw += angleDiff(t.yaw, targetYaw) * Math.min(1, dt * 3);
    // Slow for the car ahead.
    let targetSpeed = 8 + (Math.sin(t.x * 0.13 + t.z * 0.07) * 0.5 + 0.5) * 4;
    for (const o of this.traffic) {
      if (o === t) continue;
      const d = dist2(t.x, t.z, o.x, o.z);
      if (d < 8) {
        const ahead = Math.sin(t.yaw) * (o.x - t.x) + Math.cos(t.yaw) * (o.z - t.z) > 0;
        if (ahead) targetSpeed = Math.min(targetSpeed, 2);
      }
    }
    t.speed = lerp(t.speed, targetSpeed, Math.min(1, dt * 1.5));
    t.x += Math.sin(t.yaw) * t.speed * dt;
    t.z += Math.cos(t.yaw) * t.speed * dt;
    // Keep inside the grid; wrap around the far edge.
    if (t.x < -330) t.x = 330;
    if (t.x > 330) t.x = -330;
    if (t.z < -250) t.z = 250;
    if (t.z > 250) t.z = -250;
  }
};

Game.prototype.updatePeds = function (dt) {
  for (const ped of this.peds) {
    ped.turnT -= dt;
    if (ped.turnT <= 0) {
      ped.turnT = range(this.rng, 3, 9);
      ped.yaw += pick(this.rng, [-Math.PI / 2, Math.PI / 2, Math.PI, 0]);
    }
    ped.x += Math.sin(ped.yaw) * ped.speed * dt;
    ped.z += Math.cos(ped.yaw) * ped.speed * dt;
    ped.bob += dt * ped.speed * 5;
    if (ped.x < -340 || ped.x > 340 || ped.z < -260 || ped.z > 260) {
      ped.yaw += Math.PI;
      ped.x = clamp(ped.x, -340, 340);
      ped.z = clamp(ped.z, -260, 260);
    }
    const hit = this.collideCircle(ped.x, ped.z, 0.6);
    ped.x = hit.x;
    ped.z = hit.z;
  }
};

Game.prototype.updatePolice = function (dt) {
  const p = this.player;
  const want = p.wanted;
  const need = copsForWanted(want);
  // Spawn cruisers near the player until the wanted level is matched.
  while (this.cops.length < need) {
    const a = this.rng() * Math.PI * 2;
    const r = 60 + this.rng() * 40;
    this.cops.push({
      x: clamp(p.x + Math.cos(a) * r, -330, 330),
      z: clamp(p.z + Math.sin(a) * r, -250, 250),
      yaw: 0, speed: 0, siren: 0,
    });
  }
  while (this.cops.length > need) this.cops.pop();
  // Helicopter at 3 stars and up.
  if (heliForWanted(want) && !this.heli) {
    this.heli = { x: p.x, z: p.z - 20, y: 42, yaw: 0 };
    this.dispatchMsg('Air unit Solmar-1 overhead. Suspect has a bird on them.');
  }
  if (!heliForWanted(want)) this.heli = null;
  if (this.heli) {
    this.heliAngle += dt * 0.25;
    this.heli.x = p.x + Math.cos(this.heliAngle) * 18;
    this.heli.z = p.z + Math.sin(this.heliAngle) * 18;
    this.heli.y = 42 + Math.sin(this.heliAngle * 2) * 3;
    this.rotorAngle += dt * 18;
  }
  // Chase: steer toward the player, ram speed, and bust them when slow
  // and cornered.
  let nearest = 999;
  for (const cop of this.cops) {
    const d = dist2(cop.x, cop.z, p.x, p.z);
    nearest = Math.min(nearest, d);
    const targetYaw = Math.atan2(p.x - cop.x, p.z - cop.z);
    cop.yaw += angleDiff(cop.yaw, targetYaw) * Math.min(1, dt * 2.2);
    cop.speed = lerp(cop.speed, TUNING.copChaseSpeed, Math.min(1, dt * 1.2));
    cop.x += Math.sin(cop.yaw) * cop.speed * dt;
    cop.z += Math.cos(cop.yaw) * cop.speed * dt;
    const hit = this.collideCircle(cop.x, cop.z, 1.7);
    cop.x = hit.x;
    cop.z = hit.z;
    cop.siren += dt;
    if (d > 220) {
      // Lost the player: respawn closer to keep the pressure on.
      const a = this.rng() * Math.PI * 2;
      cop.x = clamp(p.x + Math.cos(a) * 70, -330, 330);
      cop.z = clamp(p.z + Math.sin(a) * 70, -250, 250);
    }
  }
  const playerSpeed = p.inCar && this.playerCar ? Math.abs(this.playerCar.speed) : 0;
  if (want > 0 && nearest < 4 && playerSpeed < 3) {
    this.bustedT += dt;
    if (this.bustedT > TUNING.bustedSeconds) {
      this.state = 'busted';
      this.bustedT = 0;
      this.showDialog(DIALOGUE.busted, 'SOLMAR PD', 6);
    }
  } else {
    this.bustedT = Math.max(0, this.bustedT - dt * 2);
  }
  // Wanted decays after a quiet stretch with no cop nearby.
  if (want > 0) {
    if (nearest > 60) {
      this.quietT += dt;
      if (this.quietT > WANTED_DECAY_SECONDS) {
        this.player.wanted = Math.max(0, want - 1);
        this.quietT = 0;
        this.dispatchMsg(DIALOGUE.wantedDown);
      }
    } else {
      this.quietT = 0;
    }
  }
};

Game.prototype.updateMissions = function () {
  const step = this.currentStep();
  if (!step) return;
  const p = this.player;
  if (step.type === 'goto' && dist2(p.x, p.z, step.x, step.z) <= (step.radius ?? 10)) {
    this.completeCurrentStep();
  } else if (step.type === 'enterCar' && p.inCar) {
    this.completeCurrentStep();
  } else if (step.type === 'wanted' && p.wanted >= (step.level ?? 2)) {
    this.completeCurrentStep();
  }
};

Game.prototype.completeCurrentStep = function () {
  const mission = this.currentMission();
  const { runtime, completedMission } = advanceStep(this.mission);
  this.mission = runtime;
  this.audio.jingle();
  if (completedMission) {
    this.player.money += completedMission.reward;
    this.showBanner('MISSION PASSED', `${completedMission.title}  •  +${formatMoney(completedMission.reward)}`);
    this.showDialog(completedMission.complete, completedMission.id === 'm5' ? 'MARA' : 'SOLMAR', 6);
    if (allMissionsDone(this.mission)) {
      this.showBanner('SOLMAR HEAT COMPLETE', `All 5 missions done — ${formatMoney(this.player.money)} banked`);
    }
  } else {
    this.audio.blip(980, 0.1, 0.1);
  }
  void mission;
};

Game.prototype.updateCamera = function (dt) {
  const p = this.player;
  const targetYaw = p.yaw + Math.PI; // behind the player
  let diff = angleDiff(this.camYaw, targetYaw);
  this.camYaw += diff * Math.min(1, dt * (p.inCar ? 2.2 : 3.5));
  const dists = [11, 16, 7, 26];
  const heights = [4.2, 6.5, 2.2, 24];
  this.camDist = lerp(this.camDist, dists[this.cameraMode], Math.min(1, dt * 3));
  this.camHeight = lerp(this.camHeight, heights[this.cameraMode], Math.min(1, dt * 3));
};

// ---- Rendering + HUD snapshot + debug hooks ------------------------------

Game.prototype.cameraEyeTarget = function () {
  const p = this.player;
  if (this.state === 'title') {
    // Slow drift above the beach looking west at the Downtown skyline,
    // with the low sun behind the towers.
    const a = this.titleT * 0.045;
    const eye = [330 + Math.cos(a) * 40, 78 + Math.sin(this.titleT * 0.09) * 6, Math.sin(a) * 130];
    return { eye, target: [-80, 12, -30] };
  }
  const backX = Math.sin(this.camYaw);
  const backZ = Math.cos(this.camYaw);
  if (this.cameraMode === 2) {
    // Hood cam: right behind the windshield.
    const eye = [p.x - Math.sin(p.yaw) * 1.5, 1.9, p.z - Math.cos(p.yaw) * 1.5];
    const target = [p.x + Math.sin(p.yaw) * 12, 1.2, p.z + Math.cos(p.yaw) * 12];
    return { eye, target };
  }
  if (this.cameraMode === 3) {
    return { eye: [p.x, 46, p.z + 0.01], target: [p.x, 0, p.z] };
  }
  const eye = [p.x + backX * this.camDist, this.camHeight, p.z + backZ * this.camDist];
  const target = [p.x - backX * 3, 1.5, p.z - backZ * 3];
  return { eye, target };
};

Game.prototype.render = function () {
  const r = this.renderer;
  const { eye, target } = this.cameraEyeTarget();
  r.beginFrame(this.dayT, eye, target);
  r.drawStatic();
  const pal = r.palette;
  const night = pal.night;
  // Mission beacon: a light pillar + glow at the objective.
  const obj = this.state === 'playing' ? this.objectivePos() : null;
  if (obj) {
    const pulse = 0.6 + Math.sin(performance.now() / 300) * 0.25;
    r.drawVerticalBillboard(obj.x, obj.z, 0, 46, 5, [1.0, 0.8, 0.2], 0.35 * pulse, r.glowTex);
    r.drawSprite(obj.x, 3, obj.z, 7, [1.0, 0.8, 0.2], 0.9 * pulse, r.glowTex, true);
  }
  // Safehouse beacon (soft teal) so the player can always find home.
  r.drawVerticalBillboard(SAFEHOUSE.x, SAFEHOUSE.z, 0, 26, 3.5, [0.2, 0.9, 0.8], 0.22, r.glowTex);
  // Traffic cars.
  for (const t of this.traffic) {
    r.drawMesh(r.carMesh(t.color, { sport: t.sport }), mat4Model(t.x, 0, t.z, t.yaw), 0);
    r.drawBlobShadow(t.x, t.z, 1.5, 2.6, 0.5);
  }
  // Player car (or the player on foot). A touch of emissive keeps the
  // rear readable against the dark asphalt at sunset.
  if (this.player.inCar && this.playerCar) {
    const car = this.playerCar;
    r.drawMesh(r.carMesh(car.color, { sport: true }), mat4Model(car.x, 0, car.z, car.yaw), 0.14);
    r.drawBlobShadow(car.x, car.z, 1.6, 2.8, 0.55);
  } else {
    const p = this.player;
    const bob = Math.abs(Math.sin(p.runT)) * 0.09;
    r.drawMesh(r.pedMesh({
      shirt: [0.05, 0.65, 0.6], pants: [0.12, 0.14, 0.2], skin: [0.85, 0.65, 0.5],
      hair: [0.1, 0.08, 0.06], height: 1.78, hat: null, bag: null, dress: false,
    }), mat4Model(p.x, bob, p.z, p.yaw), 0);
    r.drawBlobShadow(p.x, p.z, 0.7, 0.7, 0.5);
  }
  // Pedestrians.
  for (const ped of this.peds) {
    const bob = Math.abs(Math.sin(ped.bob)) * 0.07;
    r.drawMesh(r.pedMesh(ped.cfg), mat4Model(ped.x, bob, ped.z, ped.yaw), 0);
    r.drawBlobShadow(ped.x, ped.z, 0.55, 0.55, 0.45);
  }
  // Police cruisers (light bars flash red/blue with time).
  for (const cop of this.cops) {
    const flash = Math.sin(cop.siren * 9) > 0;
    r.drawMesh(r.carMesh([0.12, 0.12, 0.14], { cop: true }), mat4Model(cop.x, 0, cop.z, cop.yaw), flash ? 0.9 : 0.15);
    r.drawBlobShadow(cop.x, cop.z, 1.6, 2.8, 0.55);
    r.drawSprite(cop.x, 1.6, cop.z, 3.2, flash ? [1, 0.1, 0.15] : [0.15, 0.3, 1], 0.75, r.glowTex, true);
  }
  // Helicopter + spotlight pool on the ground.
  if (this.heli) {
    const h = this.heli;
    r.drawMesh(r.heliMesh(), mat4Model(h.x, h.y, h.z, h.yaw), 0);
    r.drawMesh(r.meshes.get('heliRotor'), mat4Model(h.x, h.y + 0.7, h.z, this.rotorAngle), 0);
    r.drawSprite(this.player.x, 0.6, this.player.z, 12, [1, 1, 0.85], 0.35, r.glowTex, true);
  }
  // Streetlight halos at night — only near the camera, capped, so the
  // foreground of a night shot is lit instead of empty black.
  if (night > 0.3) {
    let drawn = 0;
    for (const l of this.city.lamps) {
      if (drawn > 46) break;
      const dx = l.x - eye[0];
      const dz = l.z - eye[2];
      if (dx * dx + dz * dz > 130 * 130) continue;
      r.drawSprite(l.x + l.arm * 2.0, 5.0, l.z, 5, [1.0, 0.8, 0.45], night * 0.8, r.glowTex, true);
      drawn++;
    }
    // Shop neon glows at night.
    for (const shop of SHOPS) {
      r.drawSprite(shop.x, 4, shop.z, 9, [1, 0.25, 0.55], night * 0.55, r.glowTex, true);
    }
  }
  return pal;
};

// Everything the DOM HUD needs, in one snapshot per frame.
Game.prototype.hudState = function () {
  const p = this.player;
  const step = this.currentStep();
  const mission = this.currentMission();
  const obj = this.objectivePos();
  const dist = obj ? Math.round(dist2(p.x, p.z, obj.x, obj.z)) : 0;
  return {
    state: this.state,
    money: p.money,
    health: p.health,
    ammo: p.ammo,
    wanted: p.wanted,
    speed: p.inCar && this.playerCar ? Math.round(Math.abs(this.playerCar.speed) * 3.6) : 0,
    inCar: p.inCar,
    x: p.x, z: p.z, yaw: p.yaw,
    street: streetAt(p.x, p.z),
    district: districtAt(p.x, p.z).name,
    dayT: this.dayT,
    radio: RADIO[this.audio.station].name,
    mission: mission ? { title: mission.title, index: this.mission.index, total: MISSIONS.length, reward: mission.reward } : null,
    stepLabel: step ? step.label : null,
    objectiveDist: dist,
    objectivePos: obj,
    dialog: this.dialog,
    banner: this.banner,
    dispatch: this.dispatch.slice(),
    menuIndex: this.menuIndex,
    menuItems: this.menuItems,
    saveExists: !!this.saveData,
    missionsOverlay: this.missionsOverlay,
    optionsOverlay: this.optionsOverlay,
    muted: this.muted,
    cops: this.cops.map((c) => ({ x: c.x, z: c.z })),
    heli: this.heli ? { x: this.heli.x, z: this.heli.z } : null,
    traffic: this.traffic.map((t) => ({ x: t.x, z: t.z })),
    peds: this.peds.slice(0, 40).map((pd) => ({ x: pd.x, z: pd.z })),
    busted: this.state === 'busted',
    allDone: allMissionsDone(this.mission),
    camMode: this.cameraMode,
  };
};

// Debug hooks for the screenshot stager and the headless playtest.
// Nothing here is reachable from normal play; shots.js calls stage().
Game.prototype.debug = {
  teleport(game, x, z) {
    game.player.x = x;
    game.player.z = z;
    if (game.playerCar) {
      game.playerCar.x = x;
      game.playerCar.z = z;
    }
  },
  setDay(game, dayT) {
    game.dayT = dayT;
  },
  setWanted(game, level) {
    game.player.wanted = level;
  },
  setMission(game, index, step = 0) {
    game.mission = { index, step };
  },
  giveCar(game, x, z, yaw = 0) {
    const car = {
      x, z, yaw, speed: 0,
      color: [0.05, 0.65, 0.6], sport: true, axis: 'z', dir: 1, waitT: 0,
    };
    game.playerCar = car;
    game.player.inCar = true;
    game.player.x = x;
    game.player.z = z;
    game.player.yaw = yaw;
  },
  addMoney(game, n) {
    game.player.money += n;
  },
  startPlaying(game) {
    game.state = 'playing';
  },
  showTitle(game) {
    game.state = 'title';
  },
};
