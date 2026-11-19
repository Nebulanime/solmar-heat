// SOLMAR HEAT — tests/logic.test.mjs
// Unit tests for the pure game rules in game/src/logic.js.
// Run: node --test tests/logic.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addWanted, copsForWanted, heliForWanted, stepIsComplete, advanceStep,
  currentStep, allMissionsDone, missionCount, makeSave, parseSave,
  formatMoney, circleHitsBox, resolveCircleBox, onRoad,
} from '../game/src/logic.js';
import { MISSIONS, WORLD } from '../game/src/config.js';

test('wanted level clamps to 0..5', () => {
  assert.equal(addWanted(0, 1), 1);
  assert.equal(addWanted(5, 3), 5);
  assert.equal(addWanted(0, -2), 0);
  assert.equal(addWanted(3, 2), 5);
});

test('police response scales with wanted level', () => {
  assert.equal(copsForWanted(0), 0);
  assert.equal(copsForWanted(1), 2);
  assert.equal(copsForWanted(3), 4);
  assert.equal(copsForWanted(5), 6);
  assert.equal(heliForWanted(2), false);
  assert.equal(heliForWanted(3), true);
  assert.equal(heliForWanted(5), true);
});

test('five missions with rising rewards', () => {
  assert.equal(missionCount(), 5);
  assert.equal(MISSIONS.length, 5);
  const rewards = MISSIONS.map((m) => m.reward);
  assert.deepEqual(rewards, [400, 650, 900, 1400, 2200]);
  assert.equal(rewards.reduce((a, b) => a + b, 0), 5550);
  for (const m of MISSIONS) assert.ok(m.steps.length >= 1 && m.steps.length <= 3);
});

test('goto step completes inside its radius only', () => {
  const step = { type: 'goto', x: 100, z: 50, radius: 10 };
  assert.equal(stepIsComplete(step, { x: 105, z: 52, inCar: false, wanted: 0 }), true);
  assert.equal(stepIsComplete(step, { x: 120, z: 50, inCar: false, wanted: 0 }), false);
});

test('enterCar and wanted steps read the snapshot', () => {
  assert.equal(stepIsComplete({ type: 'enterCar' }, { inCar: true }), true);
  assert.equal(stepIsComplete({ type: 'enterCar' }, { inCar: false }), false);
  assert.equal(stepIsComplete({ type: 'wanted', level: 2 }, { wanted: 1 }), false);
  assert.equal(stepIsComplete({ type: 'wanted', level: 2 }, { wanted: 3 }), true);
});

test('talk step needs the player at the marker', () => {
  const step = { type: 'talk', x: 0, z: 0, radius: 6 };
  assert.equal(stepIsComplete(step, { x: 1, z: 1, nearTalkTarget: true }), true);
  assert.equal(stepIsComplete(step, { x: 1, z: 1, nearTalkTarget: false }), false);
  assert.equal(stepIsComplete(step, { x: 50, z: 0, nearTalkTarget: true }), false);
});

test('advancing steps completes a mission and pays out', () => {
  let rt = { index: 0, step: 0 };
  const m1 = MISSIONS[0];
  for (let i = 0; i < m1.steps.length - 1; i++) {
    const res = advanceStep(rt);
    assert.equal(res.completedMission, null);
    rt = res.runtime;
  }
  const done = advanceStep(rt);
  assert.equal(done.completedMission, m1);
  assert.equal(done.runtime.index, 1);
  assert.equal(done.runtime.step, 0);
});

test('all five missions finish the story', () => {
  let rt = { index: 0, step: 0 };
  let finished = 0;
  while (!allMissionsDone(rt)) {
    const m = MISSIONS[rt.index];
    for (let i = 0; i < m.steps.length; i++) {
      const res = advanceStep(rt);
      rt = res.runtime;
      if (res.completedMission) finished++;
    }
  }
  assert.equal(finished, 5);
  assert.equal(currentStep(rt), null);
});

test('money formats with commas', () => {
  assert.equal(formatMoney(250), '$250');
  assert.equal(formatMoney(5550), '$5,550');
  assert.equal(formatMoney(0), '$0');
});

test('save round-trips and rejects bad data', () => {
  const s = makeSave({ money: 1234, missionIndex: 2, missionStep: 1, x: 10.5, z: -20.25, health: 80, ammo: 12 });
  assert.equal(s.version, 1);
  assert.equal(s.money, 1234);
  const back = parseSave(JSON.stringify(s));
  assert.equal(back.missionIndex, 2);
  assert.equal(back.x, 10.5);
  assert.equal(parseSave('not json'), null);
  assert.equal(parseSave(JSON.stringify({ version: 2 })), null);
  assert.equal(parseSave(JSON.stringify({ version: 1, money: 1, missionIndex: 99 })), null);
});

test('circle vs building box collision', () => {
  const box = { x0: 0, z0: 0, x1: 10, z1: 10 };
  assert.equal(circleHitsBox(5, 5, 1, box), true);
  assert.equal(circleHitsBox(20, 20, 1, box), false);
  assert.equal(circleHitsBox(11, 5, 2, box), true);
  const res = resolveCircleBox(11, 5, 2, box);
  assert.equal(res.hit, true);
  assert.ok(res.x >= 12);
  const inside = resolveCircleBox(5, 5, 1, box);
  assert.equal(inside.hit, true);
  assert.ok(inside.x < 0 || inside.x > 10 || inside.z < 0 || inside.z > 10);
});

test('onRoad knows the street grid', () => {
  assert.equal(onRoad(0, 0, WORLD), true); // intersection of Vega Ln / Bayside Ave
  assert.equal(onRoad(-160, 0, WORLD), true); // Coral Way
  assert.equal(onRoad(-120, -120, WORLD), false); // middle of a block
  assert.equal(onRoad(400, 0, WORLD), false); // out on the beach
});

// ---- Extra: mission totals (second pass) ---------------------------------
import { TOTAL_REWARD } from '../game/src/config.js';

test('total story reward matches the README', () => {
  assert.equal(TOTAL_REWARD, 5550);
});
