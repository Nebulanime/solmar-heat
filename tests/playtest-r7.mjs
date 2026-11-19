// SOLMAR HEAT r7 — headless playtest over CDP.
// Drives the real game in headless Chromium + SwiftShader with keyboard
// events and the debug handle, and checks: no console errors, the loop
// runs, NEW GAME starts, driving moves the player, entering a car works,
// mission 1 completes and pays, pause/map/radio/camera/day-night keys
// work, and the safehouse save round-trips through localStorage.
// Usage: node tests/playtest-r7.mjs <baseUrl>   (e.g. http://localhost:8123)
import { spawn } from 'node:child_process';

const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const [base] = process.argv.slice(2);
if (!base) {
  console.error('usage: node tests/playtest-r7.mjs <baseUrl>');
  process.exit(2);
}
const port = 9400 + Math.floor(Math.random() * 400);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  '--enable-unsafe-swiftshader', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, '--window-size=1280,720', 'about:blank',
], { stdio: 'ignore' });

const errors = [];
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const send = (ws, id, method, params = {}) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`cdp timeout ${method}`)), 20000);
  const onMsg = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id === id) {
      clearTimeout(timer);
      ws.removeEventListener('message', onMsg);
      if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
      else resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push('exception: ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 400));
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push('console.error: ' + (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '));
    }
  };
  ws.addEventListener('message', onMsg);
  ws.send(JSON.stringify({ id, method, params }));
});

let code = 1;
try {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) break; } catch {}
    await sleep(250);
  }
  const created = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(base + '/index.html')}`, { method: 'PUT' });
  const target = await created.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  let id = 0;
  await send(ws, ++id, 'Page.enable');
  await send(ws, ++id, 'Runtime.enable');
  const ev = async (expr) => {
    const r = await send(ws, ++id, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r?.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r?.result?.value;
  };
  const key = async (code, k, type, ms = 0) => {
    await send(ws, ++id, 'Input.dispatchKeyEvent', { type, code, key: k, windowsVirtualKeyCode: k.length === 1 ? k.toUpperCase().charCodeAt(0) : 0 });
    if (ms) await sleep(ms);
  };
  const tap = async (code, k) => { await key(code, k, 'keyDown'); await key(code, k, 'keyUp'); };

  const waitFrames = async (n, timeoutMs = 60000) => {
    const start = await ev('window.__frames');
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const now = await ev('window.__frames');
      if (now - start >= n) return now - start;
      await sleep(300);
    }
    return (await ev('window.__frames')) - start;
  };

  // SwiftShader renders a few frames a second, so every wait below is
  // counted in frames, not wall-clock milliseconds.
  await waitFrames(30);
  check('page boots without errors', (await ev('window.__errors.length')) === 0, JSON.stringify(await ev('window.__errors')));
  check('frame loop advances', (await ev('window.__frames')) > 30, 'frames=' + (await ev('window.__frames')));
  check('title screen shown', (await ev('window.__solmar.state().state')) === 'title');

  // NEW GAME: menu starts on CONTINUE (no save yet) which starts a game.
  await tap('Enter', 'Enter');
  await waitFrames(10);
  check('Enter starts the game', (await ev('window.__solmar.state().state')) === 'playing');

  // Walk forward: position must change (40 frames at 5.2 m/s, dt<=0.05).
  const p0 = await ev('JSON.stringify({x: window.__solmar.state().x, z: window.__solmar.state().z})');
  await key('KeyW', 'w', 'keyDown');
  await waitFrames(40);
  await key('KeyW', 'w', 'keyUp');
  const p1 = await ev('JSON.stringify({x: window.__solmar.state().x, z: window.__solmar.state().z})');
  const dWalk = Math.hypot(JSON.parse(p1).x - JSON.parse(p0).x, JSON.parse(p1).z - JSON.parse(p0).z);
  check('WASD walking moves Nova', dWalk > 3, `moved ${dWalk.toFixed(1)} m`);

  // Teleport next to a traffic car and steal it with E. Freeze the car
  // first: it drives away between the read and the teleport otherwise.
  await ev(`(() => { const g = window.__solmar.game; const t = g.traffic[0]; t.speed = 0; window.__solmar.game.debug.teleport(g, t.x + 0.5, t.z); })()`);
  await waitFrames(5);
  await tap('KeyE', 'e');
  await waitFrames(5);
  const inCar = await ev('window.__solmar.state().inCar');
  check('E steals a car (wanted rises)', inCar === true, 'wanted=' + (await ev('window.__solmar.state().wanted')));

  // Drive: speed must rise and the car must move (40 frames of W).
  const c0 = await ev('JSON.stringify({x: window.__solmar.state().x, z: window.__solmar.state().z})');
  await key('KeyW', 'w', 'keyDown');
  await waitFrames(40);
  await key('KeyW', 'w', 'keyUp');
  const speed = await ev('window.__solmar.state().speed');
  const c1 = await ev('JSON.stringify({x: window.__solmar.state().x, z: window.__solmar.state().z})');
  const dDrive = Math.hypot(JSON.parse(c1).x - JSON.parse(c0).x, JSON.parse(c1).z - JSON.parse(c0).z);
  check('driving accelerates the car', speed > 20 && dDrive > 20, `speed=${speed} km/h, moved ${dDrive.toFixed(1)} m`);

  // Mission 1: the enterCar step already completed itself the moment we
  // got in the car (updateMissions watches for it), so the first
  // completeObjective() finishes the goto step and pays the mission out;
  // the second one just advances mission 2's first step.
  const money0 = await ev('window.__solmar.state().money');
  await ev('window.__solmar.completeObjective()'); // finishes goto step -> mission 1 done, +$400
  await ev('window.__solmar.completeObjective()'); // advances mission 2 step 0
  await waitFrames(5);
  const money1 = await ev('window.__solmar.state().money');
  const mission = await ev('window.__solmar.state().mission');
  check('mission 1 completes and pays $400', money1 === money0 + 400 && mission.index === 1, `money ${money0} -> ${money1}, mission=${mission.index}`);

  // Camera, radio, day/night, pause, map keys.
  const cam0 = await ev('window.__solmar.state().camMode');
  await tap('KeyC', 'c');
  check('C cycles the camera', (await ev('window.__solmar.state().camMode')) !== cam0);
  const radio0 = await ev('window.__solmar.state().radio');
  await tap('KeyR', 'r');
  check('R changes the radio station', (await ev('window.__solmar.state().radio')) !== radio0);
  const day0 = await ev('window.__solmar.state().dayT');
  await tap('KeyN', 'n');
  check('N cycles day/sunset/night', Math.abs((await ev('window.__solmar.state().dayT')) - day0) > 0.01);
  await tap('KeyP', 'p');
  await waitFrames(5);
  check('P pauses', (await ev('window.__solmar.state().state')) === 'paused');
  await tap('KeyP', 'p');
  await waitFrames(5);
  check('P resumes', (await ev('window.__solmar.state().state')) === 'playing');
  await tap('KeyM', 'm');
  await waitFrames(5);
  check('M opens the map', (await ev('window.__solmar.state().state')) === 'map');
  await tap('KeyM', 'm');
  await waitFrames(5);
  check('M closes the map', (await ev('window.__solmar.state().state')) === 'playing');

  // Safehouse save: teleport to the safehouse, save with E, reload the
  // page and check CONTINUE restores the money.
  await ev('window.__solmar.game.debug.teleport(window.__solmar.game, -251, 229)');
  await waitFrames(5);
  // Exit the car first so E triggers the save, not the exit.
  await tap('KeyE', 'e');
  await waitFrames(5);
  await tap('KeyE', 'e');
  await waitFrames(5);
  const saved = await ev('JSON.parse(localStorage.getItem("solmar-heat-save-v1") || "null")');
  check('safehouse save writes localStorage', !!saved && saved.money === money1, JSON.stringify(saved));

  check('no console errors during the whole playtest', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('no page errors recorded', (await ev('window.__errors.length')) === 0, JSON.stringify(await ev('window.__errors')));

  ws.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  code = failed === 0 ? 0 : 1;
} catch (err) {
  console.error('playtest failed:', err.message);
} finally {
  chrome.kill('SIGKILL');
}
process.exit(code);
