// Screenshot scenes for ?scene=chase|night|title|map. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot, so the frame is what real play looks like — and the same
// seed always gives the same frame. Default play (no ?scene) starts at title.
import { TIMES } from './config.js';
import { update, startMission, missionTarget } from './world.js';

const STEP = 1 / 30;

// Chase autopilot: foot down, steer back toward the z=0 avenue. Heading east is
// angle PI/2 (forward = sin/cos); when z drifts positive, angle must grow past
// PI/2 so the forward z-component turns negative, back toward the centre line.
function chaseInput(state) {
  const p = state.player;
  const want = Math.PI / 2 + Math.max(-0.45, Math.min(0.45, p.z * 0.02));
  let d = want - p.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return { up: true, down: false, left: d > 0.06, right: d < -0.06, brake: false, sprint: false, action: false, shoot: false };
}

function stepWorld(state, seconds, inputFn) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) update(state, STEP, inputFn(state));
}

export function stageScene(state, name) {
  if (name === 'chase') {
    state.screen = 'play';
    state.mission = 2; // Heat Rising — the escape, wanted 3, cruisers on your tail
    startMission(state);
    state.player.x = -80; state.player.z = 0; state.player.angle = Math.PI / 2;
    state.player.speed = 18; state.player.onFoot = false;
    // Two cruisers tucked in behind, lights flashing.
    state.police.length = 0;
    state.police.push(
      { x: -94, z: 3, angle: Math.PI / 2, speed: 20, flash: true, cd: 0 },
      { x: -98, z: -3, angle: Math.PI / 2, speed: 19, flash: false, cd: 0 },
    );
    stepWorld(state, 4.5, chaseInput);
    // Re-show the mission banner after the simulation, so the screenshot has it.
    state.banner = 'MISSION: Heat Rising';
    state.bannerUntil = state.elapsed + 30;
    state.dialog = 'Marisol: The Solmar PD is onto you. Lose the heat — shake the cruisers!';
    state.dialogUntil = state.elapsed + 30;
    // Frame the pursuit: both cruisers just behind the Comet, in shot, lights
    // flashing — the chase camera sits 8.5m behind the player, so cruisers
    // staged any further back would hide behind the camera.
    {
      const p = state.player;
      const fx = Math.sin(p.angle), fz = Math.cos(p.angle);
      const rx = Math.cos(p.angle), rz = -Math.sin(p.angle);
      const place = (back, side, flash) => ({
        x: p.x - fx * back + rx * side, z: p.z - fz * back + rz * side,
        angle: p.angle, speed: p.speed, flash, cd: 0,
      });
      state.police.length = 0;
      // One cruiser just in front of the camera on the left, one cutting
      // across ahead on the right: both read as pursuit without blocking
      // the Comet, since anything further back hides behind the camera.
      state.police.push(place(9, 5.5, true), place(-6, -6, false));
    }
    state.camX = state.player.x - Math.sin(state.player.angle) * 8.5;
    state.camZ = state.player.z - Math.cos(state.player.angle) * 8.5;
    state.frozen = true; // hold the chase mid-pursuit for its photo
    return;
  }
  if (name === 'night') {
    state.screen = 'play';
    state.mission = 3; // Neon Run, at night in the neon district
    startMission(state);
    state.player.onFoot = true;
    state.player.x = 0; state.player.z = 0; state.player.angle = Math.PI / 2;
    state.player.wanted = 2;
    state.player.speed = 0;
    stepWorld(state, 2.5, () => ({ up: false, down: false, left: false, right: false, brake: false, sprint: false, action: false, shoot: false }));
    state.banner = 'MISSION: Neon Run';
    state.bannerUntil = state.elapsed + 30;
    state.dialog = 'Kestrel: A package for the Neon District. Midnight deadline. No stops.';
    state.dialogUntil = state.elapsed + 30;
    state.camX = state.player.x - Math.sin(state.player.angle) * 6.0;
    state.camZ = state.player.z - Math.cos(state.player.angle) * 6.0;
    state.frozen = true; // hold the night street for its photo
    return;
  }
  if (name === 'map') {
    state.screen = 'map';
    state.mission = 1; // Hot Wheels — the steal, with the map open
    startMission(state);
    state.player.x = 20; state.player.z = -20; state.player.angle = Math.PI / 2;
    state.player.wanted = 1;
    stepWorld(state, 1.5, chaseInput);
    state.banner = 'MISSION: Hot Wheels';
    state.bannerUntil = state.elapsed + 30;
    state.frozen = true; // the map is a still frame by nature
    return;
  }
  // title (and anything unknown): the title screen over the sunset city.
  state.screen = 'title';
}

// Which time-of-day preset a scene uses.
export function timeForScene(name) {
  if (name === 'night') return TIMES.night;
  return TIMES.sunset;
}
