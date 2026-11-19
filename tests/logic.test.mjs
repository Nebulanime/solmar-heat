// Solmar Heat logic tests (Node, no DOM): run with `node tests/logic.test.mjs`.
import assert from 'node:assert/strict';
import { MISSIONS, TOTAL_REWARD, MISSION_SPOTS, missionAdvance, driveStep, walkStep, coolHeat, wantedFromHeat,
  heatForCrime, policeCount, heliActive, missionById, nextMission,
  applyMissionReward, newGameState, clockString, isNight, saveData, loadData,
  deathResult, formatMoney, rng, clamp, CITY } from '../game/src/logic.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };

ok('five missions, rewards sum to $4,700', () => {
  assert.equal(MISSIONS.length, 5);
  assert.equal(TOTAL_REWARD, 4700);
  assert.deepEqual(MISSIONS.map((m) => m.reward), [400, 650, 900, 1200, 1550]);
});
ok('drive: W accelerates forward, car moves -Z at heading 0', () => {
  const car = { x: 0, z: 0, heading: 0, speed: 0 };
  driveStep(car, { up: true }, 1);
  assert.ok(car.speed > 0 && car.speed <= 46);
  assert.ok(car.z < 0, `z=${car.z}`);
  assert.equal(car.x, 0);
});
ok('drive: speed clamps at max and reverses slowly', () => {
  const car = { x: 0, z: 0, heading: 0, speed: 0 };
  for (let i = 0; i < 10; i++) driveStep(car, { up: true }, 1);
  assert.equal(car.speed, 46);
  const rev = { x: 0, z: 0, heading: 0, speed: 0 };
  for (let i = 0; i < 10; i++) driveStep(rev, { down: true }, 1);
  assert.equal(rev.speed, -12);
});
ok('drive: steering turns the car only while moving', () => {
  const still = { x: 0, z: 0, heading: 0, speed: 0 };
  driveStep(still, { left: true }, 1);
  assert.equal(still.heading, 0);
  const moving = { x: 0, z: 0, heading: 0, speed: 20 };
  driveStep(moving, { left: true }, 1);
  assert.ok(moving.heading !== 0);
});
ok('walk: moves, runs faster, stays inside the city', () => {
  const p = { x: 0, z: 0, heading: 0 };
  walkStep(p, { up: true }, 1);
  assert.ok(p.z < 0);
  const q = { x: CITY.half, z: 0, heading: 0 };
  walkStep(q, { right: true }, 5);
  assert.equal(q.x, CITY.half);
});
ok('wanted: heat maps to 0-5 stars, police scale, heli at 3+', () => {
  assert.equal(wantedFromHeat(0), 0);
  assert.equal(wantedFromHeat(2.4), 2);
  assert.equal(wantedFromHeat(99), 5);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(policeCount), [0, 1, 2, 3, 4, 6]);
  assert.equal(heliActive(2), false);
  assert.equal(heliActive(3), true);
  assert.equal(heatForCrime('steal'), 1.2);
});
ok('wanted: heat cools faster while hiding', () => {
  assert.ok(coolHeat(3, 10, true) < coolHeat(3, 10, false));
  assert.equal(coolHeat(0.05, 1, true), 0);
});
ok('missions: waypoints advance and complete', () => {
  const a = missionAdvance(1, 0, 224, -224);
  assert.deepEqual(a, { stage: 1, done: false });
  const b = missionAdvance(1, 1, -160, 224);
  assert.deepEqual(b, { stage: 2, done: true });
  const c = missionAdvance(1, 0, 0, 0);
  assert.deepEqual(c, { stage: 0, done: false });
  const d = missionAdvance(99, 0, 0, 0);
  assert.deepEqual(d, { stage: 0, done: false });
});
ok('missions: lookup, next, reward applies money + progress', () => {
  assert.equal(missionById(3).name, 'The Long Way Home');
  assert.equal(nextMission([1, 2]).id, 3);
  assert.equal(nextMission([1, 2, 3, 4, 5]), null);
  const s = newGameState();
  applyMissionReward(s, missionById(1));
  assert.equal(s.money, 650);
  assert.deepEqual(s.done, [1]);
});
ok('clock: formats and night detection', () => {
  assert.equal(clockString(18 * 60 + 24), '18:24');
  assert.equal(clockString(21 * 60 + 40), '21:40');
  assert.equal(isNight(18 * 60 + 24), false);
  assert.equal(isNight(21 * 60 + 40), true);
  assert.equal(isNight(3 * 60), true);
});
ok('save: round-trips, rejects garbage', () => {
  const s = newGameState(); s.money = 1250; s.done = [1, 2];
  const d = loadData(saveData(s));
  assert.equal(d.money, 1250);
  assert.deepEqual(d.done, [1, 2]);
  assert.equal(loadData('nope'), null);
  assert.equal(loadData('{"money":"x","done":[]}'), null);
});
ok('death: BUSTED with heat, WASTED without', () => {
  assert.equal(deathResult(0, 2), 'BUSTED');
  assert.equal(deathResult(0, 0), 'WASTED');
  assert.equal(deathResult(50, 5), null);
});
ok('money formats with commas', () => {
  assert.equal(formatMoney(4700), '$4,700');
  assert.equal(formatMoney(250), '$250');
});
ok('rng is deterministic', () => {
  const a = rng(7), b = rng(7);
  const a1 = a(), a2 = a(), b1 = b(), b2 = b();
  assert.equal(a1, b1);
  assert.equal(a2, b2);
  assert.notEqual(a1, a2);
});
ok('clamp behaves', () => {
  assert.equal(clamp(9, 0, 5), 5);
  assert.equal(clamp(-2, 0, 5), 0);
  assert.equal(clamp(3, 0, 5), 3);
});
console.log(`\n${n} logic tests passed`);
