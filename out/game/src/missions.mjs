// SOLMAR HEAT — the story: four chained jobs for Rico and Mara that teach every
// system (steal a car, deliver, outrun the law, survive the showdown) and pay
// out in cash. Each mission is steps with a target landmark; reaching it
// advances the step, and the last step pays and starts the next job.
import { CFG, missionPay } from './config.mjs';
import { addHeat } from './police.mjs';

export const MISSION_DEFS = [
  {
    index: 1,
    giver: 'Rico',
    title: 'Hot Wheels',
    briefing: 'Rico needs wheels. Steal any car, then bring it to his garage.',
    steps: [
      { text: 'Steal any car (walk up to one and press E)', target: null, needCar: true },
      { text: 'Deliver the car to Rico\'s Garage', target: 'garage', needCar: true, pay: true },
    ],
  },
  {
    index: 2,
    giver: 'Mara',
    title: 'Harbor Package',
    briefing: 'Mara left a package at the marina. Grab it and bring it to the plaza.',
    steps: [
      { text: 'Pick up the package at Solmar Marina', target: 'marina', grab: true },
      { text: 'Deliver the package to Solmar Plaza', target: 'plaza', pay: true },
    ],
  },
  {
    index: 3,
    giver: 'Rico',
    title: 'Heat Run',
    briefing: 'A buyer waits at the dockside warehouse. The PD is already watching — go in hot.',
    steps: [
      { text: 'Drive to the Dockside Warehouse (stay in the car)', target: 'warehouse', needCar: true },
      { text: 'Shake the tail: reach the Lighthouse', target: 'lighthouse', pay: true },
    ],
  },
  {
    index: 4,
    giver: 'Mara',
    title: 'Solmar Showdown',
    briefing: 'The whole PD is coming for the plaza meet. Get there, then survive the heat.',
    steps: [
      { text: 'Reach the Plaza rendezvous', target: 'plaza' },
      { text: 'Survive the showdown — stay alive for 20 seconds', survive: 20, pay: true },
    ],
  },
];

export function startMission(S, index) {
  const def = MISSION_DEFS[index - 1];
  if (!def) {
    S.mission = { index: 0, step: 0, title: 'Free Roam', text: 'Solmar is yours. Cause trouble or lie low.', target: null, done: true };
    return;
  }
  if (index === 3) addHeat(S, 45);
  if (index === 4) addHeat(S, 60);
  S.mission = {
    index: def.index,
    step: 0,
    title: def.title,
    giver: def.giver,
    text: def.steps[0].text,
    target: stepTarget(S, def, 0),
    timer: 0,
    done: false,
  };
  S.message = `${def.giver}: ${def.briefing}`;
  S.messageUntil = S.time + 5;
}

function stepTarget(S, def, step) {
  const s = def.steps[step];
  if (!s || !s.target) return null;
  const lm = S.city.landmarks[s.target];
  return { x: lm.x, z: lm.z, label: lm.label };
}

export function stepMissions(S, dt) {
  const m = S.mission;
  if (!m || m.done || m.index === 0) return;
  const def = MISSION_DEFS[m.index - 1];
  const step = def.steps[m.step];
  const p = S.player;
  m.timer += dt;

  if (step.survive) {
    // Shake the tail completely and the showdown ends early.
    if (S.heat <= 0) { completeStep(S, def); return; }
    if (m.timer >= step.survive) completeStep(S, def);
    return;
  }
  if (step.needCar && p.onFoot) {
    m.text = `${step.text} — you need a car!`;
    return;
  }
  if (!step.target) {
    // Step 0 of mission 1: any stolen car completes it.
    if (!p.onFoot) completeStep(S, def);
    return;
  }
  const t = m.target;
  if (!t) return;
  const radius = step.grab ? CFG.missionGrabRadius : CFG.missionRadius;
  const dx = p.x - t.x;
  const dz = p.z - t.z;
  if (dx * dx + dz * dz < radius * radius) {
    if (step.grab && S.audio) S.audio.pickup();
    completeStep(S, def);
  }
}

function completeStep(S, def) {
  const m = S.mission;
  const step = def.steps[m.step];
  if (step.pay) {
    const pay = missionPay(def.index);
    S.player.cash += pay;
    S.stats.missionsDone += 1;
    S.message = `Job done! ${def.giver} paid you $${pay}.`;
    S.messageUntil = S.time + 4;
    if (S.audio) S.audio.chime();
    if (S.saveGame) S.saveGame();
    if (def.index >= MISSION_DEFS.length) {
      S.mission = { index: 0, step: 0, title: 'King of Solmar', text: 'Every job done. Solmar is yours, Jax.', target: null, done: true };
      S.screen = 'complete';
      S.deathAt = S.time;
      return;
    }
    startMission(S, def.index + 1);
    return;
  }
  m.step += 1;
  m.timer = 0;
  const next = def.steps[m.step];
  m.text = next.text;
  m.target = stepTarget(S, def, m.step);
  if (S.audio) S.audio.pickup();
}

export function objectiveText(S) {
  const m = S.mission;
  if (!m) return '';
  if (m.done) return m.text;
  if (m.step === 1 && MISSION_DEFS[m.index - 1] && MISSION_DEFS[m.index - 1].steps[1].survive) {
    const left = Math.max(0, Math.ceil(20 - m.timer));
    return `${m.text} (${left}s)`;
  }
  return m.text;
}
