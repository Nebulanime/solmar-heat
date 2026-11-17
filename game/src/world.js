// The game's rules and state, with no drawing and no browser in it: the
// player on foot and in cars, the city, traffic, pedestrians, police, missions
// and combat, all advancing one fixed step at a time. step() returns what
// happened as bit flags, so the caller can react without the world knowing
// about screens or sound.

import { CAR, CITY_EDGE, PLAYER, PLACES, ROAD_LINES, STEP, WANTED } from './config.js';
import { clamp, dist2D } from './config.js';
import { createCity } from './city.js';
import { createRandom } from './random.js';
import { createVehicles, nearestCar, stepPlayerCar, stepTraffic } from './vehicles.js';
import { createPedestrians, stepPedestrians } from './pedestrians.js';
import { addWanted, clearWanted, createPolice, stepPolice } from './police.js';
import { createCombat, carHitCheck, punch, shoot, stepCombat } from './combat.js';
import { MISSION_DEFS, createMissions, currentMission, objectiveTarget, showMessage, startMissions, stepMissions } from './missions.js';

export const EVENT_HIT = 1;
export const EVENT_COIN = 2;
export const EVENT_OVER = 4;
export const EVENT_MISSION = 8;

export function createWorld(seed) {
  const world = {
    state: null,
    city: null,
    cars: [],
    peds: [],
    police: null,
    missions: null,
    combat: null,
    particles: [],
    cityRoads: ROAD_LINES,
    missionTarget: null,
    bestCash: 0,
    saveTimer: 0,
  };

  function build() {
    const random = createRandom(seed);
    world.city = createCity(random);
    world.cars = createVehicles(random, world.city);
    world.peds = createPedestrians(random, world.city);
    world.police = createPolice();
    world.missions = createMissions();
    world.combat = createCombat();
    world.particles = [];
    world.rng = createRandom(seed + 999);
    const pickups = [];
    for (let i = 0; i < 8; i += 1) {
      const p = world.city.randomRoadPoint();
      pickups.push({ x: p.x, z: p.z, amount: random.int(40, 150), taken: false, kind: 'cash' });
    }
    pickups.push({ x: PLACES.garage.x + 8, z: PLACES.garage.z, amount: 0, taken: false, kind: 'pistol' });
    world.state = {
      player: {
        x: PLACES.plaza.x, z: PLACES.plaza.z + 14, heading: 0,
        health: PLAYER.maxHealth, walkPhase: 0, inCar: false, car: null,
      },
      cash: PLAYER.startCash,
      health: PLAYER.maxHealth,
      clockMinutes: 9 * 60 + 24, // a bright Solmar morning
      elapsed: 0,
      damageFlash: 0,
      overKind: null,
      pickups,
    };
    world.missionTarget = null;
    world.bestCash = 0;
  }

  function reset() {
    build();
  }

  function spawnParticles(x, y, z, color, count, spread) {
    for (let i = 0; i < count; i += 1) {
      world.particles.push({
        x, y, z,
        vx: (Math.random() - 0.5) * spread,
        vy: Math.random() * spread * 0.6,
        vz: (Math.random() - 0.5) * spread,
        life: 0.7, maxLife: 0.7, color, size: 5,
      });
    }
  }

  function damagePlayer(amount, kind) {
    const state = world.state;
    state.health -= amount;
    state.damageFlash = 1;
    if (state.health <= 0) {
      state.health = 0;
      state.overKind = kind || 'wasted';
      return true;
    }
    return false;
  }

  // One fixed step. `input` is the live input (or a scripted stand-in for
  // screenshots); `audio` may be null. Returns EVENT_* flags.
  function step(dt, input, audio) {
    const state = world.state;
    const player = state.player;
    const now = state.elapsed;
    state.elapsed += dt;
    state.clockMinutes = (state.clockMinutes + dt * 0.6) % (24 * 60);
    if (state.damageFlash > 0) state.damageFlash -= dt * 2;
    let events = 0;

    const axis = input.axis();
    const drag = input.consumeDrag ? input.consumeDrag() : 0;
    if (drag) world._orbit = (world._orbit || 0) + drag * 0.004;

    // M starts the story.
    if (input.held && input.held('KeyM') && !world.missions.started) {
      startMissions(world.missions);
      if (audio) audio.mission();
    }

    if (player.inCar && player.car) {
      const car = player.car;
      const before = car.speed;
      stepPlayerCar(car, input, dt);
      const fixed = world.city.collideCircle(car.x, car.z, 1.8);
      if ((fixed.x !== car.x || fixed.z !== car.z) && Math.abs(car.speed) > 10) {
        car.speed *= 0.4;
        if (audio) audio.crash();
        spawnParticles(car.x, 1, car.z, '#ffb84d', 8, 6);
      }
      car.x = fixed.x;
      car.z = fixed.z;
      player.x = car.x;
      player.z = car.z;
      player.heading = car.heading;
      carHitCheck(car, world.peds, world.police, now, audio);
      if (Math.abs(before) > 12 && Math.abs(car.speed) < 3) {
        // Hard stop into something solid hurts.
        if (damagePlayer(6, 'wasted') && audio) audio.hit();
      }
      if (audio) audio.setEngine(Math.abs(car.speed) / CAR.maxSpeed, true);
      // Exit the car.
      if (input.actionPressed && input.actionPressed('enterCar')) {
        player.inCar = false;
        player.x = car.x - Math.sin(car.heading) * 3;
        player.z = car.z - Math.cos(car.heading) * 3;
        player.car = null;
        car.kind = 'parked';
        if (audio) audio.setEngine(0, false);
      }
    } else {
      // On foot: A/D turn, W/S walk, Shift runs.
      const running = input.held && input.held('ShiftLeft') || input.held && input.held('ShiftRight');
      const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
      player.heading += -axis.x * 2.6 * dt;
      const move = axis.y * speed;
      if (move !== 0) {
        player.walkPhase += dt * (running ? 11 : 7);
        player.x += Math.sin(player.heading) * move * dt;
        player.z += Math.cos(player.heading) * move * dt;
      }
      const fixed = world.city.collideCircle(player.x, player.z, PLAYER.radius);
      player.x = fixed.x;
      player.z = fixed.z;
      if (audio) audio.setEngine(0, false);
      // Enter / steal the nearest stopped car.
      if (input.actionPressed && input.actionPressed('enterCar')) {
        const car = nearestCar(world.cars, player.x, player.z, 4.5);
        if (car) {
          if (car.kind === 'parked' || car.kind === 'traffic') {
            addWanted(world.police, WANTED.stealCar, now);
            showMessage(world.missions, 'Car stolen — the Solmar PD noticed.', 3);
          }
          car.kind = 'player';
          player.inCar = true;
          player.car = car;
          car.speed = 0;
          if (audio) audio.startEngine();
        }
      }
      // Combat on foot.
      if (input.actionPressed && input.actionPressed('punch')) {
        if (punch(world.combat, player, world.peds, world.police, now)) {
          if (audio) audio.punch();
          spawnParticles(player.x + Math.sin(player.heading) * 1.6, 1.4, player.z + Math.cos(player.heading) * 1.6, '#ffd94d', 6, 4);
        }
      }
      if (input.actionPressed && input.actionPressed('shoot')) {
        if (shoot(world.combat, player, world.peds, world.police, now)) {
          if (audio) audio.shoot();
          spawnParticles(player.x + Math.sin(player.heading) * 1.6, 1.4, player.z + Math.cos(player.heading) * 1.6, '#fff3c4', 8, 5);
        }
      }
    }
    if (input.held && input.held('KeyH') && audio) audio.horn();

    // Pickups on the street.
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      if (dist2D(player.x, player.z, pk.x, pk.z) < 2.4) {
        pk.taken = true;
        if (pk.kind === 'pistol') {
          world.combat.hasPistol = true;
          world.combat.pistolAmmo += 24;
          showMessage(world.missions, 'Picked up a pistol — F to shoot.', 4);
        } else {
          state.cash += pk.amount;
          events |= EVENT_COIN;
          showMessage(world.missions, 'Found $' + pk.amount + ' on the street.', 2.5);
        }
        if (audio) audio.pickup();
      }
    }

    stepTraffic(world.cars, dt, world.city, world.rng, player.car);
    stepPedestrians(world.peds, dt, world.city, world.rng, { x: player.x, z: player.z });
    stepCombat(world.combat, dt);

    // Police: chase, arrest, and ramming damage.
    const busted = stepPolice(world.police, dt, player, world.city, world.rng, now);
    if (busted) {
      state.overKind = 'busted';
      events |= EVENT_OVER;
      return events;
    }
    for (const cop of world.police.cops) {
      if (dist2D(player.x, player.z, cop.x, cop.z) < 3.2) {
        if (player.inCar) {
          player.car.speed *= 0.7;
          cop.speed *= 0.5;
          if (audio) audio.crash();
        } else if (damagePlayer(14 * dt * 10, 'wasted')) {
          events |= EVENT_OVER;
          return events;
        }
      }
    }
    if (audio) audio.setSiren(world.police.stars > 0);

    // Missions: objectives, payouts, story end.
    const missionResult = stepMissions(world.missions, player, world.police, dt);
    if (missionResult === 'complete' || missionResult === 'storyDone') {
      const finished = MISSION_DEFS[world.missions.index - 1];
      if (finished) {
        state.cash += finished.reward;
        if (audio) audio.cash();
        if (finished.id === 'm1') {
          world.combat.hasPistol = true;
          world.combat.pistolAmmo += 24;
        }
      }
      events |= EVENT_MISSION;
      if (missionResult === 'storyDone') showMessage(world.missions, 'Story complete! Solmar is yours — free roam.', 8);
    }
    world.missionTarget = objectiveTarget(world.missions);

    // Particles.
    for (const pt of world.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z += pt.vz * dt;
      pt.vy -= 6 * dt;
    }
    world.particles = world.particles.filter((pt) => pt.life > 0);

    if (state.health <= 0) events |= EVENT_OVER;
    return events;
  }

  build();
  return {
    get state() { return world.state; },
    get city() { return world.city; },
    get cars() { return world.cars; },
    get peds() { return world.peds; },
    get police() { return world.police; },
    get missions() { return world.missions; },
    get combat() { return world.combat; },
    get particles() { return world.particles; },
    get cityRoads() { return world.cityRoads; },
    get missionTarget() { return world.missionTarget; },
    get bestCash() { return world.bestCash; },
    set bestCash(v) { world.bestCash = v; },
    get _orbit() { return world._orbit || 0; },
    reset,
    step,
    damagePlayer,
    spawnParticles,
  };
}
