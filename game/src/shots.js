// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot (follow the street grid toward a waypoint,
// full throttle, ease off when something is right ahead), so the frame is what
// a short game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { startMission } from './missions.js';

const START_SECONDS = 5;
const DRIVE_SECONDS = 14;
const CHASE_SECONDS = 12;
const MISSION_SECONDS = 10;

// A loop around the city, used only when a scene names no route.
const LOOP = [
  { x: 320, z: 0 }, { x: 320, z: 320 }, { x: 0, z: 320 }, { x: -320, z: 320 },
  { x: -320, z: 0 }, { x: -320, z: -320 }, { x: 0, z: -320 }, { x: 320, z: -320 },
];

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function putPlayerInCar(state, x, z, heading, kind) {
  const car = {
    id: state.nextCarId++,
    kind: kind || 'sport',
    color: 2,
    driver: 'player',
    parked: false,
    hp: 100,
    speed: 0,
    targetSpeed: 0,
    dir: 0,
    street: 0,
    lastTurn: 0,
    x, z, heading,
  };
  state.cars.push(car);
  const p = state.player;
  p.car = car;
  p.onFoot = false;
  p.x = x;
  p.z = z;
  p.heading = heading;
  p.speed = 0;
}

/** Install a staged street route for the autopilot to follow, waypoint by waypoint. */
function setShotRoute(state, route) {
  state.shotRoute = route;
  state.shotWp = 0;
}

function nextWaypoint(state) {
  // A staged route wins: it follows the streets, intersection to intersection.
  // Otherwise the mission target, otherwise the city loop.
  if (state.shotRoute && state.shotRoute.length > 0) {
    const p = state.player;
    let target = state.shotRoute[state.shotWp];
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    if (dx * dx + dz * dz < 18 * 18 && state.shotWp < state.shotRoute.length - 1) {
      state.shotWp += 1;
      target = state.shotRoute[state.shotWp];
    }
    return target;
  }
  if (state.mission && state.mission.target) return state.mission.target;
  return LOOP[0];
}

/** The autopilot's input, shaped like the real input object. */
export function autopilotInput(state) {
  const target = nextWaypoint(state);
  const p = state.player;
  const want = Math.atan2(target.x - p.x, target.z - p.z);
  const diff = wrapAngle(want - p.heading);
  const strafe = Math.max(-1, Math.min(1, diff * 1.6));
  // Ease off when a car is right ahead.
  let forward = 1;
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  for (const car of state.cars) {
    if (car.driver === 'player') continue;
    const dx = car.x - p.x;
    const dz = car.z - p.z;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (along > 0 && along < 12 && side < 3) {
      forward = 0;
      break;
    }
  }
  return {
    forward: () => forward,
    strafe: () => strafe,
    run: () => false,
    firing: () => false,
    takeOrbit: () => 0,
    mouse: () => ({ x: 0, y: 0 }),
    takeActions: () => 0,
  };
}

/**
 * Set `state` to the named scene and return the screen to draw, how long to
 * play it forward, and whether the camera should slowly orbit.
 */
export function stageShot(name, state) {
  const L = state.city.landmarks;
  if (name === 'drive') {
    putPlayerInCar(state, -280, 0, Math.PI / 2, 'sport');
    setShotRoute(state, [
      { x: -160, z: 0 }, { x: 0, z: 0 }, { x: 160, z: 0 }, { x: 320, z: 0 },
      { x: 320, z: 160 }, { x: 320, z: 320 }, { x: 160, z: 320 }, { x: 0, z: 320 },
    ]);
    return { screen: SCREEN_PLAY, seconds: DRIVE_SECONDS, orbit: false };
  }
  if (name === 'chase') {
    putPlayerInCar(state, -200, 160, Math.PI / 2, 'sedan');
    state.heat = 60;
    state.lastCrime = state.time;
    setShotRoute(state, [
      { x: 0, z: 160 }, { x: 160, z: 160 }, { x: 320, z: 160 }, { x: 320, z: 0 },
      { x: 320, z: -160 }, { x: 160, z: -160 }, { x: 0, z: -160 },
    ]);
    return { screen: SCREEN_PLAY, seconds: CHASE_SECONDS, orbit: false };
  }
  if (name === 'mission') {
    putPlayerInCar(state, 160, 300, Math.PI, 'sport');
    startMission(state, 2);
    // The package is already grabbed: the shot is the delivery run.
    state.mission.step = 1;
    state.mission.label = 'Deliver to Plaza del Sol — 90s';
    state.mission.target = { x: L.plaza.x, z: L.plaza.z, label: 'Plaza' };
    state.mission.timer = 88;
    state.heat = 20;
    state.lastCrime = state.time;
    setShotRoute(state, [{ x: 160, z: 160 }, { x: 160, z: 0 }, { x: 0, z: 0 }]);
    return { screen: SCREEN_PLAY, seconds: MISSION_SECONDS, orbit: false };
  }
  // start: the title over the plaza, camera drifting around it.
  state.player.x = L.plaza.x + 14;
  state.player.z = L.plaza.z + 14;
  state.player.heading = Math.PI * 0.75;
  state.camera.yaw = Math.PI * 0.75;
  return { screen: SCREEN_TITLE, seconds: START_SECONDS, orbit: true };
}
