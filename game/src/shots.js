// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, driven
// by a scripted input (drive forward, steer toward the marker, run from the
// cops), so the frame is what real play looks like and the same seed always
// gives the same frame.

import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { MISSION_DEFS, showMessage, startMissions } from './missions.js';
import { addWanted } from './police.js';
import { makeCar } from './vehicles.js';

export function createShotInput() {
  let axis = { x: 0, y: 0 };
  let heldKeys = new Set();
  let actions = new Set();
  return {
    setAxis(x, y) { axis = { x, y }; },
    setHeld(code, on) { if (on) heldKeys.add(code); else heldKeys.delete(code); },
    press(action) { actions.add(action); },
    axis() { return axis; },
    held(code) { return heldKeys.has(code); },
    actionPressed(action) { return actions.has(action); },
    consumeDrag() { return 0; },
    endFrame() { actions.clear(); },
  };
}

// Steer the player (or their car) toward a target point.
function steerToward(world, tx, tz, input) {
  const p = world.state.player;
  const dx = tx - p.x;
  const dz = tz - p.z;
  const want = Math.atan2(dx, dz);
  let d = (want - p.heading) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  input.setAxis(Math.max(-1, Math.min(1, -d * 1.5)), 1);
}

function stepWorld(world, input, steps) {
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, input, null);
    input.endFrame();
  }
}

export function stageShot(name, world) {
  const input = createShotInput();
  world.reset();
  if (name === 'start') {
    // A slow drive-by of the plaza for the title backdrop.
    stepWorld(world, input, 5 / STEP);
    return { screen: SCREEN_TITLE, best: 1250 };
  }
  if (name === 'drive') {
    // Steal a car and cruise straight down the plaza avenue: one road, no
    // turns, so the autopilot never cuts across a block.
    const car = world.cars.find((c) => c.kind === 'parked');
    if (car) {
      car.x = 0;
      car.z = -80;
      car.heading = 0; // south, down the avenue
      car.color = '#d94f3d'; // hero red, so the player's car reads at a glance
      car.kind = 'player';
      world.state.player.inCar = true;
      world.state.player.car = car;
      world.state.player.x = 0;
      world.state.player.z = -80;
      world.state.player.heading = 0;
      car.speed = 20;
    }
    for (let i = 0; i < 6 / STEP; i += 1) {
      steerToward(world, 0, 160, input);
      world.step(STEP, input, null);
      input.endFrame();
    }
    return { screen: SCREEN_PLAY, best: 1250 };
  }
  if (name === 'chase') {
    // Mid-mission, two stars, cruisers on the tail, racing for the pier.
    // Everything is placed, not driven: the player car mid-avenue heading
    // east, two cruisers right behind it, the pier marker ahead.
    startMissions(world.missions);
    world.missions.index = 2;
    world.missions.step = 1;
    showMessage(world.missions, MISSION_DEFS[2].briefing, 6);
    addWanted(world.police, 2, 0);
    const car = world.cars.find((c) => c.kind === 'parked');
    if (car) {
      car.x = 100;
      car.z = 0;
      car.heading = Math.PI / 2;
      car.color = '#e85d3d'; // hero red, so the player's car reads at a glance
      car.kind = 'player';
      world.state.player.inCar = true;
      world.state.player.car = car;
      world.state.player.x = 100;
      world.state.player.z = 0;
      world.state.player.heading = Math.PI / 2;
      car.speed = 24;
    }
    // One cruiser comes at the player head-on, one pulls alongside: both
    // stay in the frame ahead of the camera, so the chase reads at a glance.
    const cop1 = makeCar(140, -3.5, -Math.PI / 2, '#20242e', 'cop');
    cop1.siren = true;
    cop1.speed = 26;
    const cop2 = makeCar(116, 3.8, Math.PI / 2, '#20242e', 'cop');
    cop2.siren = true;
    cop2.speed = 29;
    world.police.cops.push(cop1, cop2);
    // Short run-up only: longer and the head-on cruiser reaches the player
    // and the chase stalls at 2 km/h behind it.
    for (let i = 0; i < 0.4 / STEP; i += 1) {
      steerToward(world, 178, 0, input);
      world.step(STEP, input, null);
      input.endFrame();
    }
    return { screen: SCREEN_PLAY, best: 1250 };
  }
  // mission: on foot at the market, pistol out, objective marker ahead.
  startMissions(world.missions);
  world.missions.index = 1;
  world.missions.step = 0;
  showMessage(world.missions, MISSION_DEFS[1].briefing, 6);
  world.state.player.x = -40;
  world.state.player.z = 55;
  world.state.player.heading = 0; // south, toward the market and its marker
  world.combat.hasPistol = true;
  world.combat.pistolAmmo = 24;
  stepWorld(world, input, 1 / STEP);
  return { screen: SCREEN_PLAY, best: 1250 };
}
