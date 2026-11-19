// SOLMAR HEAT — main.ts
// The program that hands the entry in. It is the game's own bootstrap,
// not the starter's plumbing: it validates the entry first (game files,
// screenshots, dimensions, caps), copies game/ and screenshots/ into the
// output directory in a fixed order, writes /output/dossier.json with
// the vendored make.fun library, and then verifies its own output by
// rebuilding the dossier from the output tree and comparing bytes.
// It runs the same way twice and must write the same bytes twice:
// nothing here reads the clock, the environment's randomness, or file
// modification times.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Screenshot gate (RULES.txt): 3-4 images, each at most 256 KiB, long
// side at most 1280 px, short side at least 480 px, PNG or JPEG.
const SHOT_NAME = /^[A-Za-z0-9._-]{1,128}$/;

function fail(message) {
  throw new Error(`main.ts: ${message}`);
}

// Read a PNG or JPEG's pixel dimensions from its header, without any
// image library: PNG stores them in IHDR, JPEG in its first SOF marker.
function imageDimensions(path) {
  const buf = readFileSync(path);
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), kind: 'png' };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) fail(`${path}: corrupt JPEG at offset ${i}`);
      const marker = buf[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5), kind: 'jpeg' };
      }
      i += 2 + len;
    }
    fail(`${path}: no JPEG frame found`);
  }
  fail(`${path}: not a PNG or JPEG`);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

// Walk a directory depth-first in sorted order and return every file's
// path relative to the root, so the copy and the report are stable.
function listFiles(root, rel = '') {
  const outFiles = [];
  for (const name of readdirSync(join(root, rel)).sort()) {
    const childRel = rel ? `${rel}/${name}` : name;
    const st = statSync(join(root, childRel));
    if (st.isDirectory()) outFiles.push(...listFiles(root, childRel));
    else if (st.isFile()) outFiles.push(childRel);
    else fail(`${childRel}: not a plain file or directory`);
  }
  return outFiles;
}

// ---- Validate, copy, dossier, verify (second pass) -----------------------

function validateEntry() {
  const gameDir = join(here, 'game');
  const shotsDir = join(here, 'screenshots');
  if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
  const gameFiles = listFiles(gameDir);
  if (gameFiles.length > CAPS.game_max_files) {
    fail(`game/ has ${gameFiles.length} files, over the ${CAPS.game_max_files} cap`);
  }
  let gameBytes = 0;
  for (const f of gameFiles) {
    if (Buffer.byteLength(f, 'utf8') > CAPS.game_path_max_bytes) fail(`game path too long: ${f}`);
    gameBytes += statSync(join(gameDir, f)).size;
  }
  if (gameBytes > CAPS.game_max_bytes) fail(`game/ is ${gameBytes} bytes, over the cap`);

  if (!existsSync(shotsDir)) fail('screenshots/ is missing');
  const shots = readdirSync(shotsDir).filter((n) => !n.startsWith('.')).sort();
  if (shots.length < 3 || shots.length > CAPS.screenshots.max) {
    fail(`screenshots/ has ${shots.length} images, need 3-${CAPS.screenshots.max}`);
  }
  for (const name of shots) {
    if (!SHOT_NAME.test(name) || name.startsWith('-')) fail(`bad screenshot name: ${name}`);
    const p = join(shotsDir, name);
    const size = statSync(p).size;
    if (size > CAPS.screenshots.max_bytes) fail(`${name} is ${size} bytes, over 256 KiB`);
    const { width, height, kind } = imageDimensions(p);
    const long = Math.max(width, height);
    const short = Math.min(width, height);
    if (long > 1280 || short < 480) fail(`${name} is ${width}x${height}, outside 1280x480 bounds`);
    console.log(`shot ${name}: ${kind} ${width}x${height} ${size} bytes`);
  }
  console.log(`game/: ${gameFiles.length} files, ${gameBytes} bytes`);
  return { gameFiles, shots };
}

function main() {
  const { gameFiles, shots } = validateEntry();

  // Fresh output tree, copied in sorted order so the result is stable.
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'game'), { recursive: true });
  mkdirSync(join(out, 'screenshots'), { recursive: true });
  cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
  if (existsSync(join(here, 'screenshots'))) {
    cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
  }

  const dossier = buildDossier(out, CAPS);
  writeFileSync(join(out, 'dossier.json'), dossier);

  // Verify: the dossier rebuilt from a CLEAN copy of the same tree must
  // be identical (this is what the grader's two runs compare), and every
  // file we meant to ship must be present in the output. Note the rebuild
  // cannot run against `out` itself: once dossier.json exists there,
  // buildDossier sees it in the output tree and its answer changes.
  const tmp = mkdtempSync(join(tmpdir(), 'solmar-verify-'));
  try {
    mkdirSync(join(tmp, 'game'), { recursive: true });
    mkdirSync(join(tmp, 'screenshots'), { recursive: true });
    cpSync(join(out, 'game'), join(tmp, 'game'), { recursive: true });
    cpSync(join(out, 'screenshots'), join(tmp, 'screenshots'), { recursive: true });
    const rebuilt = buildDossier(tmp, CAPS);
    // buildDossier returns bytes (a Uint8Array), so compare contents,
    // not object identity.
    if (!Buffer.from(rebuilt).equals(Buffer.from(dossier))) fail('dossier is not stable across rebuilds');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  const outGameFiles = listFiles(join(out, 'game'));
  if (JSON.stringify(outGameFiles) !== JSON.stringify(gameFiles)) fail('game/ copy mismatch');
  const outShots = readdirSync(join(out, 'screenshots')).filter((n) => !n.startsWith('.')).sort();
  if (JSON.stringify(outShots) !== JSON.stringify(shots)) fail('screenshots/ copy mismatch');

  console.log(`dossier.json: ${Buffer.byteLength(dossier, 'utf8')} bytes, sha256 ${sha256(Buffer.from(dossier, 'utf8'))}`);
  console.log(`SOLMAR HEAT handed in: ${gameFiles.length} game files, ${shots.length} screenshots -> ${out}`);
}

main();
