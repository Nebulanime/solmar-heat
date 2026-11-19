// SOLMAR HEAT r7 — screenshot/playtest shooter over CDP.
// Headless Playwright Chromium + SwiftShader: WebGL needs
// --enable-unsafe-swiftshader and must NOT get --disable-gpu (that flag
// kills SwiftShader WebGL in this Chrome build). Viewport is forced to
// exactly 1280x720 via Emulation.setDeviceMetricsOverride.
// Usage: node tests/shoot-r7.mjs <url> <out.jpg> [width] [height] [timeoutMs]
// It waits for window.__shotReady, then captures a JPEG.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const [url, out, wArg, hArg, tArg] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node tests/shoot-r7.mjs <url> <out.jpg> [width] [height] [timeoutMs]');
  process.exit(2);
}
const width = Number(wArg) || 1280;
const height = Number(hArg) || 720;
const timeoutMs = Number(tArg) || 60000;
const port = 9333 + Math.floor(Math.random() * 500);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  '--enable-unsafe-swiftshader', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, `--window-size=${width},${height}`, 'about:blank',
], { stdio: 'ignore' });

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
      console.error('[page exception]', JSON.stringify(msg.params.exceptionDetails).slice(0, 600));
    }
  };
  ws.addEventListener('message', onMsg);
  ws.send(JSON.stringify({ id, method, params }));
});

let code = 1;
try {
  let version = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) { version = await res.json(); break; }
    } catch { /* not up yet */ }
    await sleep(250);
  }
  if (!version) throw new Error('chrome devtools did not come up');

  const created = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!created.ok) throw new Error(`json/new failed: ${created.status}`);
  const target = await created.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
    setTimeout(() => reject(new Error('websocket open timeout')), 15000);
  });

  let id = 0;
  await send(ws, ++id, 'Page.enable');
  await send(ws, ++id, 'Runtime.enable');
  await send(ws, ++id, 'Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

  const deadline = Date.now() + timeoutMs;
  let ready = false;
  let lastState = '';
  while (Date.now() < deadline) {
    const res = await send(ws, ++id, 'Runtime.evaluate', { expression: 'window.__shotReady === true' });
    if (res?.result?.value === true) { ready = true; break; }
    const st = await send(ws, ++id, 'Runtime.evaluate', { expression: `JSON.stringify({frames: window.__frames||0, errors: (window.__errors||[]).slice(0,2), boot: window.__bootError||null, shotErr: window.__shotError||null})`, returnByValue: true });
    lastState = st?.result?.value || '';
    await sleep(300);
  }
  if (!ready) throw new Error('__shotReady never became true; last state: ' + lastState);

  const shot = await send(ws, ++id, 'Page.captureScreenshot', { format: 'jpeg', quality: 82 });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(`saved ${out}`);
  ws.close();
  code = 0;
} catch (err) {
  console.error(`shoot failed: ${err.message}`);
} finally {
  chrome.kill('SIGKILL');
}
process.exit(code);

// ---- Exit codes (second pass) --------------------------------------------
// 0: screenshot saved. 1: Chrome never came up, the page never signalled
// __shotReady, or the capture failed. The error line names the cause.
export const SHOOT_OK = 0;
export const SHOOT_FAIL = 1;
