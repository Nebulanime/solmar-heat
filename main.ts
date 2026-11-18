// SOLMAR HEAT — entrypoint (Node 22, standard library only).
// This program hands the game in: it takes the static game/ folder and the
// screenshots/ folder sitting next to this file, copies both into the
// output directory, and writes the dossier.json summary there using the
// vendored make.fun library. The game itself is plain static files —
// game/index.html plus its ES modules — that a desktop browser opens
// offline, with no build step and no network request.
//
// Run it locally with:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// The grader runs it with /output as the destination instead.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const destination = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameSource = join(repoRoot, 'game');
const shotsSource = join(repoRoot, 'screenshots');
const gameTarget = join(destination, 'game');
const shotsTarget = join(destination, 'screenshots');

// The scorer's caps for this bounty (from the kit's reference gate):
// at most 4 screenshots of at most 256 KiB each, at most 993 files and
// 48 MiB under game/, and a 160 KiB cap on the dossier's text payload.
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(destination, { recursive: true });
mkdirSync(shotsTarget, { recursive: true });
cpSync(gameSource, gameTarget, { recursive: true });
if (existsSync(shotsSource)) {
  cpSync(shotsSource, shotsTarget, { recursive: true });
}

const dossier = buildDossier(destination, dossierCaps);
writeFileSync(join(destination, 'dossier.json'), dossier);
console.log(`SOLMAR HEAT packaged into ${destination} (${dossier.length} bytes of dossier)`);
