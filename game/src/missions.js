// The story of SOLMAR HEAT: four chained missions with short dialogue, a
// marker to reach, and a payout. Rico runs the garage, Mara runs the jobs,
// and the player — Jax Rook, a driver fresh out of the Solmar docks — climbs
// from stealing one car to the Marina Vault job.

import { PLACES, REWARDS } from './config.js';
import { dist2D } from './config.js';

export const MISSION_DEFS = [
  {
    id: 'm1',
    title: 'First Wheels',
    giver: 'Rico',
    briefing: 'Rico: "Jax! The garage needs a ride. Steal the red coupe by the plaza and bring it home."',
    steps: [
      { text: 'Steal a car and drive it to the garage', target: PLACES.plaza, radius: 6, needsCar: true },
      { text: 'Deliver the car to Rico\u2019s Garage', target: PLACES.garage, radius: 7, needsCar: true },
    ],
    reward: REWARDS.m1,
    done: 'Rico: "Clean work. You drive like you mean it."',
  },
  {
    id: 'm2',
    title: 'Courier Run',
    giver: 'Mara',
    briefing: 'Mara: "A package for the market. Fast and quiet — the Solmar PD is jumpy today."',
    steps: [
      { text: 'Pick up the package at Mercado Verde', target: PLACES.market, radius: 6 },
      { text: 'Deliver the package to the Marina', target: PLACES.marina, radius: 7 },
    ],
    reward: REWARDS.m2,
    done: 'Mara: "Delivered. The client sends his thanks — and his cash."',
  },
  {
    id: 'm3',
    title: 'Heat on the Pier',
    giver: 'Mara',
    briefing: 'Mara: "The cops made the drop. Lose them, then meet me at the pier. No heroics."',
    steps: [
      { text: 'Lose the police (get wanted to 0)', target: null, radius: 0, loseHeat: true },
      { text: 'Meet Mara at Sunset Pier', target: PLACES.pier, radius: 7 },
    ],
    reward: REWARDS.m3,
    done: 'Mara: "You shook them. One more job and we are out of this town\u2019s shadow."',
  },
  {
    id: 'm4',
    title: 'The Solmar Job',
    giver: 'Rico',
    briefing: 'Rico: "The Marina Vault. One car, one window, one big score. Bring it to the lookout."',
    steps: [
      { text: 'Reach the Marina Vault', target: PLACES.vault, radius: 7 },
      { text: 'Escape to the Cliff Lookout', target: PLACES.lookout, radius: 8 },
    ],
    reward: REWARDS.m4,
    done: 'Rico: "That\u2019s the whole town in one haul. Solmar is yours now, Jax."',
  },
];

export function createMissions() {
  return {
    index: 0, // which mission is active
    step: 0,
    active: false,
    done: false, // whole story finished
    message: '',
    messageTimer: 0,
    started: false,
  };
}

export function currentMission(missions) {
  if (missions.index >= MISSION_DEFS.length) return null;
  return MISSION_DEFS[missions.index];
}

export function currentStep(missions) {
  const m = currentMission(missions);
  return m ? m.steps[missions.step] : null;
}

export function startMissions(missions) {
  missions.active = true;
  missions.started = true;
  const m = currentMission(missions);
  if (m) showMessage(missions, m.briefing, 6);
}

export function showMessage(missions, text, seconds) {
  missions.message = text;
  missions.messageTimer = seconds || 4;
}

// Advance the mission state; returns 'complete' | 'storyDone' | null.
// `events` carries what the world just did: { stoleCar, wanted }.
export function stepMissions(missions, player, police, dt) {
  if (!missions.active || missions.done) return null;
  if (missions.messageTimer > 0) missions.messageTimer -= dt;
  const mission = currentMission(missions);
  if (!mission) return null;
  const stepDef = mission.steps[missions.step];
  if (!stepDef) return null;
  let reached = false;
  if (stepDef.loseHeat) {
    reached = police.stars === 0;
  } else if (stepDef.target) {
    const d = dist2D(player.x, player.z, stepDef.target.x, stepDef.target.z);
    reached = d < stepDef.radius && (!stepDef.needsCar || player.inCar);
  }
  if (!reached) return null;
  missions.step += 1;
  if (missions.step < mission.steps.length) {
    showMessage(missions, 'Objective done — ' + mission.steps[missions.step].text, 4);
    return 'step';
  }
  // Mission complete: payout and move to the next one.
  showMessage(missions, mission.done, 6);
  missions.index += 1;
  missions.step = 0;
  if (missions.index >= MISSION_DEFS.length) {
    missions.done = true;
    missions.active = false;
    return 'storyDone';
  }
  const next = currentMission(missions);
  window.setTimeout(() => showMessage(missions, next.briefing, 6), 1500);
  return 'complete';
}

export function objectiveText(missions) {
  if (missions.done) return 'Story complete — Solmar is yours. Free roam!';
  const mission = currentMission(missions);
  if (!mission || !missions.active) return 'Press M to start the story';
  const stepDef = mission.steps[missions.step];
  return mission.title + ': ' + stepDef.text;
}

export function objectiveTarget(missions) {
  const stepDef = currentStep(missions);
  return stepDef && stepDef.target ? stepDef.target : null;
}
