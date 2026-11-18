// SOLMAR HEAT — logic tests (Node, no browser needed).
// Run: node tests/logic.test.mjs
import assert from 'node:assert/strict';
import { makeRng, hashString } from '../game/src/rng.mjs';
import { generateCity, onRoad, hitBuilding } from '../game/src/city.mjs';
import { createPlayer, updatePlayer, hurtPlayer } from '../game/src/player.mjs';
import { createInput } from '../game/src/input.mjs';
import { createPolice, addWanted, setWanted, clearWanted, updatePolice } from '../game/src/police.mjs';
import { createMissions, startMission, updateMissions, currentMission } from '../game/src/missions.mjs';
import { spawnParkedCars, nearestCar, enterCar, exitCar } from '../game/src/vehicles.mjs';
import { spawnPedestrians, scareNearby, knockDown } from '../game/src/pedestrians.mjs';
import { spawnTraffic, checkTrafficCrash } from '../game/src/traffic.mjs';
import { createCombat, doPunch } from '../game/src/combat.mjs';
import { MISSIONS } from '../game/src/config.mjs';

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`PASS ${name}`);
}

// 1. RNG is deterministic for seed 7.
check('rng seed 7 deterministic', () => {
  const a = makeRng(7);
  const b = makeRng(7);
  for (let i = 0; i < 50; i++) assert.equal(a.next(), b.next());
  assert.notEqual(makeRng(7).next(), makeRng(8).next());
  assert.equal(hashString('solmar'), hashString('solmar'));
});

// 2. City generation is deterministic and non-empty.
check('city generates buildings deterministically', () => {
  const cityA = generateCity(makeRng(7));
  const cityB = generateCity(makeRng(7));
  assert.equal(cityA.buildings.length, cityB.buildings.length);
  assert.ok(cityA.buildings.length > 100, `got ${cityA.buildings.length} buildings`);
  assert.equal(cityA.buildings[0].x, cityB.buildings[0].x);
  assert.ok(cityA.landmarks.tower, 'tower landmark exists');
  assert.ok(onRoad(20, 100), 'vertical road point is road');
  assert.ok(onRoad(100, 20), 'horizontal road point is road');
  assert.ok(!onRoad(100, 100), 'block interior is not road');
});

// 3. Player movement + building collision.
check('player walks and collides with buildings', () => {
  const rng = makeRng(7);
  const city = generateCity(rng);
  const input = createInput();
  const p = createPlayer(420, 620);
  input.press('KeyD');
  updatePlayer(p, input, city, 0.5, null);
  assert.ok(p.x > 420, 'player moved right');
  assert.equal(p.health, 100);
  hurtPlayer(p, 30);
  assert.equal(p.health, 70);
});

// 4. Wanted level rises and police units spawn.
check('wanted level spawns police', () => {
  const police = createPolice();
  assert.equal(police.wanted, 0);
  addWanted(police, 2);
  assert.equal(police.wanted, 2);
  assert.equal(police.units.length, 2);
  addWanted(police, 9);
  assert.equal(police.wanted, 5, 'wanted caps at 5');
  setWanted(police, 1);
  assert.equal(police.units.length, 1);
  clearWanted(police);
  assert.equal(police.wanted, 0);
  assert.equal(police.units.length, 0);
});

// 5. Police chase the player and wanted decays when clean.
check('police chase and wanted decays', () => {
  const police = createPolice();
  addWanted(police, 1);
  const p = createPlayer(1600, 1200);
  const start = Math.hypot(police.units[0].car.x - p.x, police.units[0].car.y - p.y);
  for (let i = 0; i < 60; i++) updatePolice(police, p, 0.1, null);
  const end = Math.hypot(police.units[0].car.x - p.x, police.units[0].car.y - p.y);
  assert.ok(end < start, `cop closed in: ${start.toFixed(0)} -> ${end.toFixed(0)}`);
  police.sinceCrime = 30;
  for (let i = 0; i < 200; i++) updatePolice(police, p, 0.1, null);
  assert.ok(police.wanted === 0, `wanted decayed to ${police.wanted}`);
});

// 6. Mission chain: drive mission completes at target, chain advances.
check('mission chain advances and pays', () => {
  const missions = createMissions();
  startMission(missions, 0);
  assert.equal(currentMission(missions).id, 'wheels');
  const p = createPlayer(1050, 1050);
  const police = createPolice();
  const result = updateMissions(missions, p, police, 0.1);
  assert.equal(result, 'mission');
  assert.equal(missions.index, 1);
  assert.equal(p.money, 50 + 150, 'payout banked');
  assert.deepEqual(missions.completed, ['wheels']);
});

// 7. Lose-heat mission completes only at wanted 0.
check('lose-heat mission needs wanted 0', () => {
  const missions = createMissions();
  startMission(missions, 2);
  const p = createPlayer(500, 500);
  const police = createPolice();
  addWanted(police, 2);
  assert.equal(updateMissions(missions, p, police, 0.1), null);
  clearWanted(police);
  assert.equal(updateMissions(missions, p, police, 0.1), 'mission');
});

// 8. Car steal: enter/exit round-trips.
check('steal and exit car', () => {
  const rng = makeRng(7);
  const city = generateCity(rng);
  const cars = spawnParkedCars(rng, city, 10);
  assert.ok(cars.length >= 8, `parked cars: ${cars.length}`);
  const p = createPlayer(cars[0].x + 10, cars[0].y);
  const car = nearestCar(cars, p.x, p.y);
  assert.ok(car, 'car within reach');
  enterCar(p, car);
  assert.equal(p.inCar, car);
  exitCar(p);
  assert.equal(p.inCar, null);
  assert.equal(car.driver, null);
});

// 9. Pedestrians panic and can be knocked down for cash.
check('pedestrian panic and knockdown', () => {
  const rng = makeRng(7);
  const city = generateCity(rng);
  const peds = spawnPedestrians(rng, city, 10);
  assert.equal(peds.length, 10);
  const scared = scareNearby(peds, peds[0].x, peds[0].y, 50);
  assert.ok(scared >= 1);
  const cash = knockDown(peds[0]);
  assert.ok(cash >= 5 && cash <= 40, `cash ${cash}`);
  assert.equal(knockDown(peds[0]), 0, 'second knockdown pays nothing');
});

// 10. Punch hits a pedestrian in range.
check('punch hits nearby ped', () => {
  const combat = createCombat();
  const p = createPlayer(500, 500);
  p.angle = 0;
  const peds = [{ x: 520, y: 500, state: 'walk', wallet: 20 }];
  const police = createPolice();
  let hit = null;
  const res = doPunch(combat, p, peds, police, (kind, cash) => { hit = { kind, cash }; });
  assert.ok(res, 'punch connected');
  assert.equal(hit.kind, 'ped');
  assert.equal(hit.cash, 20);
  assert.equal(peds[0].state, 'down');
});

// 11. Traffic crash wrecks the traffic car.
check('traffic crash wrecks car', () => {
  const rng = makeRng(7);
  const traffic = spawnTraffic(rng, 3);
  const playerCar = { x: traffic[0].x, y: traffic[0].y, speed: 300 };
  let crashed = false;
  checkTrafficCrash(traffic, playerCar, () => { crashed = true; });
  assert.ok(crashed, 'crash detected');
  assert.ok(traffic[0].wrecked);
});

// 12. Full mission chain can be completed end to end.
check('full story completes', () => {
  const missions = createMissions();
  startMission(missions, 0);
  const p = createPlayer(0, 0);
  const police = createPolice();
  const targets = MISSIONS.map((m) => m.target);
  let last = null;
  for (let i = 0; i < 5; i++) {
    const m = MISSIONS[i];
    if (m.kind === 'loseheat') { clearWanted(police); }
    else { p.x = m.target.x; p.y = m.target.y; }
    last = updateMissions(missions, p, police, 0.1);
  }
  assert.equal(last, 'story');
  assert.equal(missions.done, true);
  assert.equal(missions.completed.length, 5);
  assert.ok(p.money > 2000, `final money ${p.money}`);
});

console.log(`\n${passed}/12 logic tests passed`);
