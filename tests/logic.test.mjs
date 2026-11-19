// Logic tests for SOLMAR HEAT (Node 22, no browser needed).
// Run: node --test tests/logic.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  wantedForCrime, policeCount, heliActive, wantedAfterQuiet,
  atMarker, speedKmh, collideBuildings, clampToCity,
  totalMissionPay, makeSave, validSave, wantedStars, missionTimeLimit,
} from '../game/src/logic.js';
import { MISSIONS } from '../game/src/config.js';

test('stealing a car raises wanted by one star, capped at five', () => {
  assert.equal(wantedForCrime(0, 'steal'), 1);
  assert.equal(wantedForCrime(4, 'shoot'), 5);
  assert.equal(wantedForCrime(5, 'shoot'), 5);
  assert.equal(wantedForCrime(2, 'speed'), 2);
});

test('police response scales with wanted, helicopter joins at three stars', () => {
  assert.equal(policeCount(0), 0);
  assert.equal(policeCount(1), 1);
  assert.equal(policeCount(3), 2);
  assert.equal(policeCount(5), 3);
  assert.equal(heliActive(2), false);
  assert.equal(heliActive(3), true);
});

test('wanted cools down after quiet time', () => {
  assert.equal(wantedAfterQuiet(3, 13), 3);
  assert.equal(wantedAfterQuiet(3, 14), 2);
  assert.equal(wantedAfterQuiet(3, 29), 1);
  assert.equal(wantedAfterQuiet(1, 100), 0);
});

test('mission markers complete within their radius', () => {
  assert.equal(atMarker(100, 100, 105, 105), true);
  assert.equal(atMarker(100, 100, 120, 100), false);
  assert.equal(atMarker(0, 0, 0, 0, 1), true);
});

test('speedometer converts m/s to km/h', () => {
  assert.equal(speedKmh(0), 0);
  assert.equal(speedKmh(10), 36);
  assert.equal(speedKmh(38), 137);
});

test('buildings push a circle out instead of letting it through', () => {
  const buildings = [{ x: 0, z: 0, w: 20, d: 20, h: 10 }];
  const inside = collideBuildings(0, 0, 1, buildings);
  assert.ok(Math.abs(inside.x) >= 10 || Math.abs(inside.z) >= 10);
  const outside = collideBuildings(50, 50, 1, buildings);
  assert.deepEqual(outside, { x: 50, z: 50 });
});

test('the city clamp keeps the player in bounds, marina included', () => {
  assert.deepEqual(clampToCity(999, 999), { x: 252, z: 286 });
  assert.deepEqual(clampToCity(-999, -999), { x: -252, z: -252 });
});

test('the five missions pay out $6,900 in total', () => {
  assert.equal(totalMissionPay(MISSIONS), 6900);
  assert.equal(MISSIONS.length, 5);
  assert.equal(missionTimeLimit(MISSIONS[3]), 75);
  assert.equal(missionTimeLimit(MISSIONS[0]), 0);
  // Every mission has a distinct target on the map.
  const targets = MISSIONS.map((m) => `${m.target.x},${m.target.z}`);
  assert.equal(new Set(targets).size, MISSIONS.length);
});

test('save snapshots round-trip and validate', () => {
  const save = makeSave({ money: 1250, done: [1, 2], mission: 2, health: 80, ammo: 40, radio: 1, x: 12, z: -30 });
  assert.equal(validSave(save), true);
  assert.equal(save.money, 1250);
  assert.equal(validSave({ version: 2, money: 1, done: [], mission: 0 }), false);
  assert.equal(validSave(null), false);
});

test('wanted stars render as filled and empty stars', () => {
  assert.equal(wantedStars(0), '☆☆☆☆☆');
  assert.equal(wantedStars(3), '★★★☆☆');
  assert.equal(wantedStars(5), '★★★★★');
});
