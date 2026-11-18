// Rico and Mara's arc: four chained story missions starring Jax Rook. Each
// mission is a small state machine — reach the target, beat the clock, or lose
// the heat — and finishing one starts the next. Failing one (clock, busted,
// wasted) sends Jax back to its start; the story never ends, it waits.
import { MISSIONS } from './config.js';

// How close Jax must get to a target to count as there. Landmark targets are
// buildings, and the collision circle stops a car 15–25 units from their
// centre, so a building target needs a radius past its walls; open ground
// (the plaza, the marina docks) counts at arm's length. Do NOT shrink these:
// small radii are uncompletable because building collision stops a car
// 15–25 units from a landmark building's centre.
const RADIUS_OPEN = 10;
const RADIUS_BUILDING = 40;

function say(state, text) {
  state.messages.push({ text, t: state.time });
}

function setStep(state, step, label, target, timer) {
  state.mission.step = step;
  state.mission.label = label;
  state.mission.target = target || null;
  state.mission.timer = timer === undefined ? -1 : timer;
}

/** The mission definition for the mission currently running (or null). */
export function currentMissionDef(state) {
  if (!state.mission || state.mission.index < 1) return null;
  return MISSIONS[state.mission.index - 1];
}

/** Begin mission `index` (1-based). */
export function startMission(state, index) {
  const def = MISSIONS[index - 1];
  const L = state.city.landmarks;
  state.mission = { index, step: 0, label: '', target: null, timer: -1, hold: 0 };
  say(state, `${def.giver}: ${def.intro}`);
  if (index === 1) {
    setStep(state, 0, 'Steal any car', null);
  } else if (index === 2) {
    setStep(state, 0, "Pick up Mara's package at the marina", { x: L.marina.x, z: L.marina.z, label: 'Package' });
  } else if (index === 3) {
    state.heat = 60;
    state.lastCrime = state.time;
    setStep(state, 0, 'Lose the heat — get to zero stars', null, 150);
    say(state, 'Three stars. Every cop in Solmar is on you.');
  } else if (index === 4) {
    setStep(state, 0, 'Reach the marina vault', { x: L.vault.x, z: L.vault.z, label: 'Vault' });
  }
}

function completeMission(state) {
  const def = MISSIONS[state.mission.index - 1];
  state.player.cash += def.reward;
  state.stats.missionsDone += 1;
  say(state, `Mission complete: ${def.name} — +$${def.reward}.`);
  const next = state.mission.index + 1;
  if (next > MISSIONS.length) {
    state.mission = { index: 0, step: 0, label: '', target: null, timer: -1, hold: 0 };
    say(state, 'SOLMAR HEAT complete. The city is yours, Jax.');
    state.stats.finished = true;
    return;
  }
  startMission(state, next);
}

function failMission(state, reason) {
  const def = MISSIONS[state.mission.index - 1];
  say(state, `Mission failed: ${reason}. ${def.giver} is giving you another shot.`);
  startMission(state, state.mission.index);
}

function near(state, target, radius) {
  const dx = state.player.x - target.x;
  const dz = state.player.z - target.z;
  return dx * dx + dz * dz < radius * radius;
}

/** One fixed step of the story. Call every frame while playing. */
export function stepMissions(state, dt) {
  const m = state.mission;
  if (!m || m.index === 0) return;
  const L = state.city.landmarks;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(state, 'Out of time');
      return;
    }
  }
  if (m.index === 1) {
    if (m.step === 0) {
      if (!state.player.onFoot) {
        setStep(state, 1, "Bring it to Rico's garage", { x: L.garage.x, z: L.garage.z, label: 'Garage' });
        say(state, "Rico: Nice wheels. Now bring her home.");
      }
    } else if (near(state, m.target, RADIUS_BUILDING) && !state.player.onFoot) {
      completeMission(state);
    }
  } else if (m.index === 2) {
    if (m.step === 0) {
      if (near(state, m.target, 8)) {
        state.heat = Math.min(100, state.heat + 20);
        state.lastCrime = state.time;
        setStep(state, 1, 'Deliver to Plaza del Sol — 90s', { x: L.plaza.x, z: L.plaza.z, label: 'Plaza' }, 90);
        say(state, 'Package grabbed. The cops noticed. Run!');
      }
    } else if (near(state, m.target, RADIUS_OPEN)) {
      completeMission(state);
    }
  } else if (m.index === 3) {
    if (state.wanted === 0) completeMission(state);
  } else if (m.index === 4) {
    if (m.step === 0) {
      if (near(state, m.target, RADIUS_BUILDING)) {
        state.heat = 80;
        state.lastCrime = state.time;
        setStep(state, 1, 'Crack the vault — hold position', { x: L.vault.x, z: L.vault.z, label: 'Vault' });
        m.hold = 5;
        say(state, 'Four stars. Crack it fast and vanish.');
      }
    } else if (m.step === 1) {
      if (near(state, m.target, RADIUS_BUILDING)) {
        m.hold -= dt;
        if (m.hold <= 0) {
          setStep(state, 2, 'Escape to the safehouse', { x: L.safehouse.x, z: L.safehouse.z, label: 'Safehouse' });
          say(state, 'The take is yours. Lose them and get home.');
        }
      } else {
        m.hold = 5;
      }
    } else if (near(state, m.target, RADIUS_BUILDING)) {
      completeMission(state);
    }
  }
}
