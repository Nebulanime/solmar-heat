// tests/logic.test.mjs — pure-logic tests for SOLMAR HEAT (no browser needed).
// Run: node tests/logic.test.mjs
import assert from 'node:assert/strict';
import { mulberry32, hashSeed, clamp, angDiff, mat4Multiply, mat4Identity, streetNameAt } from '../game/js/util.js';
import { buildCity, onRoad, buildingAt, nearestRoadPoint } from '../game/js/city.js';
import { Police, wantedStars, heatForWanted } from '../game/js/police.js';
import { MISSIONS, MissionRunner, missionProgress, objectiveText } from '../game/js/missions.js';
import { driveCar } from '../game/js/vehicles.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok -', name);
}

// RNG is deterministic
test('mulberry32 deterministic', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
  assert.equal(hashSeed('solmar'), hashSeed('solmar'));
});

// math
test('clamp + angDiff', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.ok(Math.abs(angDiff(0, Math.PI * 1.5) + Math.PI / 2) < 1e-9);
  const m = mat4Multiply(mat4Identity(), mat4Identity());
  assert.equal(m[0], 1); assert.equal(m[15], 1);
});

// city layout
const city = buildCity(1337);
test('city has 7 avenues, 7 streets, buildings, places', () => {
  assert.equal(city.avenues.length, 7);
  assert.equal(city.streets.length, 7);
  assert.ok(city.buildings.length > 40);
  assert.ok(city.places.garage && city.places.safehouse && city.places.tower);
  assert.ok(city.buildings.some((b) => b.kind === 'tower'));
  assert.ok(city.buildings.some((b) => b.kind === 'cylinder'));
  assert.ok(city.buildings.some((b) => b.h > 100));
});
test('streetNameAt finds nearest named road', () => {
  const name = streetNameAt(city.avenues[0].x, 0, city);
  assert.equal(name, city.avenues[0].name);
  const name2 = streetNameAt(city.avenues[3].x + 24, city.streets[2].z, city);
  assert.equal(name2, city.streets[2].name);
});
test('onRoad + buildingAt', () => {
  assert.equal(onRoad(city, city.avenues[0].x, 0), true);
  assert.equal(onRoad(city, city.avenues[0].x + 30, city.streets[0].z + 30), false);
  const b = city.buildings[0];
  assert.equal(buildingAt(city, b.x, b.z), b);
  assert.equal(buildingAt(city, city.avenues[0].x, city.streets[0].z), null);
});
test('nearestRoadPoint snaps to a road', () => {
  const p = nearestRoadPoint(city, city.avenues[1].x + 2, city.streets[1].z + 2);
  assert.ok(onRoad(city, p.x, p.z));
});

// police: heat -> wanted stars, cruisers spawn, heat cools
test('wanted stars + heat thresholds', () => {
  assert.equal(wantedStars(0), '☆☆☆☆☆');
  assert.equal(wantedStars(3), '★★★☆☆');
  assert.equal(wantedStars(5), '★★★★★');
  assert.equal(heatForWanted(3), 50);
});
test('police heat, cruisers, heli, cooldown', () => {
  const p = new Police(city, mulberry32(7));
  assert.equal(p.wanted, 0);
  p.addHeat(50, 0);
  assert.equal(p.wanted, 3);
  assert.equal(p.cruisers.length, 4);
  assert.ok(p.heli);
  p.addHeat(50, 1);
  assert.equal(p.wanted, 5);
  // no crime for 12s -> heat cools
  p.update(20, 30, { x: 0, z: 0, speed: 0, inCar: false });
  assert.ok(p.heat < 100);
  assert.ok(p.wanted <= 5);
  assert.ok(p.responseList().length > 0);
});

// driving physics
test('driveCar accelerates, steers, brakes, clamps', () => {
  const car = { x: 0, z: 0, heading: 0, speed: 0 };
  driveCar(car, { forward: true }, 1);
  assert.ok(car.speed > 10 && car.speed <= 34);
  assert.ok(car.x > 0);
  const h0 = car.heading;
  driveCar(car, { forward: true, left: true }, 0.5);
  assert.ok(car.heading > h0);
  driveCar(car, { back: true }, 2);
  assert.ok(car.speed < 16);
  for (let i = 0; i < 20; i++) driveCar(car, { forward: true }, 1);
  assert.ok(car.speed <= 34.001);
});

// missions
test('5 missions, runner flow: reach -> enterCar -> reach', () => {
  const events = [];
  const r = new MissionRunner(city, (k, p) => events.push([k, p]));
  assert.equal(MISSIONS.length, 5);
  r.startMission(0);
  assert.equal(r.mission.id, 1);
  assert.equal(r.objective.type, 'reach');
  // teleport to the garage marker
  const g = city.places.garage;
  r.update(0.1, { x: g.x, z: g.z, inCar: false, police: new Police(city, mulberry32(1)), now: 0 });
  assert.equal(r.objective.type, 'enterCar');
  r.update(0.1, { x: g.x, z: g.z, inCar: true, police: new Police(city, mulberry32(1)), now: 0 });
  assert.equal(r.objective.type, 'reach');
  const s = city.places.safehouse;
  r.update(0.1, { x: s.x, z: s.z, inCar: true, police: new Police(city, mulberry32(1)), now: 0 });
  assert.equal(r.missionIndex, 1);
  assert.ok(events.some(([k]) => k === 'reward'));
  assert.equal(missionProgress(r), 'MISSION 2/5 — COURIER RUN');
  assert.ok(objectiveText(r).length > 0);
});
test('mission timer fails when it runs out', () => {
  const events = [];
  const r = new MissionRunner(city, (k, p) => events.push([k, p]));
  r.startMission(1);
  assert.equal(r.objective.timer, 90);
  r.update(91, { x: 0, z: 0, inCar: false, police: new Police(city, mulberry32(1)), now: 0 });
  assert.equal(r.active, false);
  assert.ok(events.some(([k, p]) => k === 'banner' && String(p).includes('FAILED')));
});
test('survive objective counts down', () => {
  const r = new MissionRunner(city, () => {});
  r.startMission(4);
  r.objIndex = 1; r.armObjective();
  assert.equal(r.objective.type, 'survive');
  r.update(46, { x: 0, z: 0, inCar: false, police: new Police(city, mulberry32(1)), now: 0 });
  assert.equal(r.objective.type, 'reach');
});

console.log(`\n${passed} logic tests passed`);
