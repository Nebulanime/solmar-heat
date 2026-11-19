// missions.js — Nova Vega's story: 5 missions across Solmar, each a chain of
// objectives (reach, drive, timed drops, escape, finale), plus shops and the
// safehouse save in localStorage.
import { fmtMoney } from './util.js';

export const MISSIONS = [
  {
    id: 1, title: 'FIRST WHEELS', reward: 500,
    intro: ['NOVA', 'Back in Solmar. First thing first — I need wheels. The garage on PALM ROW has a car with my name on it.'],
    objectives: [
      { type: 'reach', x: null, z: null, place: 'garage', text: 'Get to SOLMAR GARAGE' },
      { type: 'enterCar', text: 'Get in the car (press E)' },
      { type: 'reach', x: null, z: null, place: 'safehouse', text: "Drive it home to NOVA'S LOFT" },
    ],
    done: ['NOVA', 'Home sweet home. That was easy. Too easy.'],
  },
  {
    id: 2, title: 'COURIER RUN', reward: 1200,
    intro: ['MILO', 'Nova! Three drops, one hour, no questions. The buyers are waiting at the diner, the pier and the club. Go!'],
    objectives: [
      { type: 'reach', place: 'diner', text: 'Drop 1/3 — NEON DINER', timer: 90 },
      { type: 'reach', place: 'marina', text: 'Drop 2/3 — MARINA PIER', timer: 90 },
      { type: 'reach', place: 'club', text: 'Drop 3/3 — CLUB MIRAGE', timer: 90 },
    ],
    done: ['MILO', 'Clean run. The city is talking about you already.'],
  },
  {
    id: 3, title: 'HEAT RISING', reward: 1800,
    intro: ['NOVA', 'The PD is all over this drop. Grab the package at the Spire, then lose the heat — get wanted back to zero.'],
    objectives: [
      { type: 'reach', place: 'tower', text: 'Grab the package — SOLMAR SPIRE', heat: 45 },
      { type: 'loseHeat', text: 'Lose the cops — wanted back to 0' },
    ],
    done: ['NOVA', 'They never even saw my face. Almost.'],
  },
  {
    id: 4, title: 'NIGHT SHIFT', reward: 2500,
    intro: ['MILO', 'Night job. Pick up the case at the marina after dark, bring it to the garage. Keep it quiet — no heat.'],
    objectives: [
      { type: 'reach', place: 'marina', text: 'Pick up the case — MARINA PIER', night: true },
      { type: 'reach', place: 'garage', text: 'Deliver to SOLMAR GARAGE — stay clean' },
    ],
    done: ['MILO', 'Ghost-quiet. You are getting scary good at this.'],
  },
  {
    id: 5, title: 'SOLMAR SHOWDOWN', reward: 5000,
    intro: ['NOVA', 'This is it. The whole city is watching. Reach the Spire, hold the rooftop, and Solmar is ours.'],
    objectives: [
      { type: 'reach', place: 'tower', text: 'Reach the SOLMAR SPIRE', heat: 60 },
      { type: 'survive', seconds: 45, text: 'Hold the rooftop — survive 45s' },
      { type: 'reach', place: 'safehouse', text: "Get home — NOVA'S LOFT" },
    ],
    done: ['NOVA', 'Solmar is ours now. Every light in this city knows my name.'],
  },
];

export const SHOPS = [
  { place: 'arms', name: 'SOLMAR ARMS', items: [
    { name: 'Pistol ammo +24', price: 150, apply: (s) => { s.ammo += 24; } },
    { name: 'Body armor', price: 300, apply: (s) => { s.health = 100; s.armor = 100; } },
    { name: 'Health kit', price: 100, apply: (s) => { s.health = Math.min(100, s.health + 50); } },
  ]},
  { place: 'diner', name: 'NEON DINER', items: [
    { name: 'Neon burger', price: 25, apply: (s) => { s.health = Math.min(100, s.health + 25); } },
    { name: 'Coffee + sprint', price: 40, apply: (s) => { s.sprintBoost = 30; } },
  ]},
];

const SAVE_KEY = 'solmar-heat-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
export function writeSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      mission: state.missionIndex, money: state.money, ammo: state.ammo,
      health: state.health, completed: state.completed,
    }));
  } catch { /* storage unavailable — play on without saving */ }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ } }

export class MissionRunner {
  constructor(city, onEvent) {
    this.city = city;
    this.onEvent = onEvent; // (kind, payload) — banner, dialog, reward, failed
    this.missionIndex = 0;
    this.objIndex = 0;
    this.timer = 0;
    this.surviveLeft = 0;
    this.active = false;
    this.finishedAll = false;
  }
  get mission() { return MISSIONS[this.missionIndex]; }
  get objective() { return this.mission?.objectives[this.objIndex]; }

  startMission(i) {
    this.missionIndex = i;
    this.objIndex = 0;
    this.active = true;
    this.timer = 0;
    const m = this.mission;
    this.onEvent('banner', `MISSION ${m.id} — ${m.title}`);
    this.onEvent('dialog', m.intro);
    this.armObjective();
  }
  armObjective() {
    const o = this.objective;
    if (!o) return;
    if (o.type === 'reach' && o.place) {
      const p = this.city.places[o.place];
      o.x = p.x; o.z = p.z;
    }
    if (o.timer) this.timer = o.timer;
    if (o.type === 'survive') this.surviveLeft = o.seconds;
  }
  completeObjective() {
    this.objIndex++;
    if (this.objIndex >= this.mission.objectives.length) {
      const m = this.mission;
      this.active = false;
      this.missionIndex++;
      this.onEvent('reward', m.reward);
      this.onEvent('banner', `MISSION PASSED — ${fmtMoney(m.reward)}`);
      this.onEvent('dialog', m.done);
      if (this.missionIndex >= MISSIONS.length) {
        this.finishedAll = true;
        this.onEvent('banner', 'STORY COMPLETE — SOLMAR IS YOURS');
      } else {
        // next mission briefs itself a few seconds after the pass banner
        this.pendingAt = (this.now || 0) + 4;
      }
      return true;
    }
    this.armObjective();
    return false;
  }
  failMission(reason) {
    this.active = false;
    this.onEvent('banner', `MISSION FAILED — ${reason}`);
    this.onEvent('dialog', ['MILO', 'Shake it off. We go again — same job, same pay.']);
  }
  // Called every frame with live state; returns nothing, fires events.
  update(dt, s) {
    this.now = s.now;
    if (!this.active) {
      if (this.pendingAt && s.now >= this.pendingAt) {
        this.pendingAt = 0;
        this.startMission(this.missionIndex);
      }
      return;
    }
    const o = this.objective;
    if (!o) return;
    if (o.timer) {
      this.timer -= dt;
      if (this.timer <= 0) { this.failMission('OUT OF TIME'); return; }
    }
    if (o.type === 'reach') {
      const d = Math.hypot(s.x - o.x, s.z - o.z);
      if (d < 7) {
        if (o.heat) s.police.addHeat(o.heat, s.now);
        this.onEvent('toast', 'Objective complete');
        this.completeObjective();
      }
    } else if (o.type === 'enterCar') {
      if (s.inCar) this.completeObjective();
    } else if (o.type === 'loseHeat') {
      if (s.police.wanted === 0) this.completeObjective();
    } else if (o.type === 'survive') {
      this.surviveLeft -= dt;
      if (this.surviveLeft <= 0) this.completeObjective();
    }
  }
}

// ---- mission helpers for HUD + tests ----
export function missionProgress(runner) {
  if (!runner.mission) return 'STORY COMPLETE';
  return `MISSION ${runner.mission.id}/5 — ${runner.mission.title}`;
}
export function objectiveText(runner) {
  if (!runner.active && runner.pendingAt) return 'Next mission incoming...';
  const o = runner.objective;
  if (!o) return 'All missions complete — free roam!';
  let t = o.text;
  if (o.type === 'survive') t += ` — ${Math.ceil(runner.surviveLeft)}s`;
  return t;
}
