// The city of Solmar, built fresh from a seed: ground, roads, lit-window towers,
// palms, streetlights, the marina and the ocean. One static Geom per time of day.
import { CITY } from './config.js';
import { mulberry32, range, rangeInt, pick } from './rng.js';
import { Geom } from './gl.js';

const FACADES = [
  [0.62, 0.55, 0.48], [0.55, 0.60, 0.66], [0.70, 0.45, 0.38], [0.45, 0.50, 0.58],
  [0.66, 0.62, 0.55], [0.38, 0.48, 0.62], [0.72, 0.60, 0.50], [0.50, 0.42, 0.44],
];
const GLASS = [0.16, 0.22, 0.30];
const NEON = [
  [1.0, 0.15, 0.55], [0.1, 0.9, 1.0], [1.0, 0.6, 0.05], [0.55, 0.2, 1.0], [0.1, 1.0, 0.5],
];
const WINDOW_LIT = [1.0, 0.72, 0.30];
const WINDOW_DARK = [0.10, 0.13, 0.20];

// Windows on one face of a building: a grid of small quads, some lit.
function windows(g, rng, cx, cz, w, d, h, face, litChance) {
  const y0 = 2.2, gapY = 3.1, gapX = 3.0;
  const rows = Math.max(1, Math.floor((h - y0 - 1) / gapY));
  const along = face === 'n' || face === 's' ? w : d;
  const cols = Math.max(1, Math.floor((along - 2) / gapX));
  const off = 0.08;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const y = y0 + r * gapY;
      const u = -along / 2 + 1.5 + c * gapX;
      const lit = rng() < litChance;
      const col = lit ? WINDOW_LIT : WINDOW_DARK;
      const emi = lit ? 0.85 : 0.0;
      const wq = 1.5, hq = 1.7;
      if (face === 's') g.quad([cx + u - wq / 2, y, cz + d / 2 + off], [cx + u + wq / 2, y, cz + d / 2 + off], [cx + u + wq / 2, y + hq, cz + d / 2 + off], [cx + u - wq / 2, y + hq, cz + d / 2 + off], [0, 0, 1], col, emi);
      else if (face === 'n') g.quad([cx + u + wq / 2, y, cz - d / 2 - off], [cx + u - wq / 2, y, cz - d / 2 - off], [cx + u - wq / 2, y + hq, cz - d / 2 - off], [cx + u + wq / 2, y + hq, cz - d / 2 - off], [0, 0, -1], col, emi);
      else if (face === 'e') g.quad([cx + w / 2 + off, y, cz + u + wq / 2], [cx + w / 2 + off, y, cz + u - wq / 2], [cx + w / 2 + off, y + hq, cz + u - wq / 2], [cx + w / 2 + off, y + hq, cz + u + wq / 2], [1, 0, 0], col, emi);
      else g.quad([cx - w / 2 - off, y, cz + u - wq / 2], [cx - w / 2 - off, y, cz + u + wq / 2], [cx - w / 2 - off, y + hq, cz + u + wq / 2], [cx - w / 2 - off, y + hq, cz + u - wq / 2], [-1, 0, 0], col, emi);
    }
  }
}

function palm(g, x, z, rng) {
  const h = range(rng, 5.5, 7.5);
  g.box(x, h / 2, z, 0.5, h, 0.5, [0.45, 0.32, 0.18]);
  const cy = h + 0.6;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rng() * 0.5;
    const dx = Math.cos(a) * 1.6, dz = Math.sin(a) * 1.6;
    g.quad([x, cy, z], [x + dx, cy - 0.9, z + dz], [x + dx * 1.15, cy - 1.1, z + dz * 1.15], [x, cy - 0.4, z], [0, 1, 0], [0.10, 0.45, 0.14], 0);
  }
  g.box(x, cy + 0.3, z, 1.2, 0.7, 1.2, [0.12, 0.55, 0.16]);
}

function streetlight(g, x, z, night) {
  g.box(x, 3.2, z, 0.22, 6.4, 0.22, [0.15, 0.15, 0.18]);
  g.box(x + 0.9, 6.3, z, 1.9, 0.22, 0.22, [0.15, 0.15, 0.18]);
  const glow = night > 0.5 ? 1.0 : 0.35;
  g.box(x + 1.8, 6.2, z, 0.5, 0.18, 0.5, [1.0, 0.9, 0.6], glow);
  g.groundQuad(x + 0.6, z - 1.2, x + 3.0, z + 1.2, 0.06, [1.0, 0.85, 0.5], glow * 0.28 * night + 0.02);
}

// Road centre lines: the world axes where roads run.
export function roadLines() {
  const lines = [];
  const half = (CITY.blocks - 1) / 2;
  for (let i = 0; i < CITY.blocks; i++) lines.push((i - half) * CITY.pitch);
  return lines;
}

export function buildCity(seed, night) {
  const rng = mulberry32(seed);
  const g = new Geom();
  const buildings = [];
  const palms = [];
  const half = (CITY.blocks - 1) / 2;
  const span = CITY.blocks * CITY.pitch;
  const litChance = 0.18 + night * 0.45;

  // Ground: concrete base, then the ocean to the south and a sand strip.
  g.groundQuad(-span / 2 - 40, -span / 2 - 40, span / 2 + 40, span / 2 + 40, 0, [0.32, 0.32, 0.34]);
  g.groundQuad(-span / 2 - 40, span / 2 + 6, span / 2 + 40, span / 2 + 90, 0.02, [0.06, 0.28, 0.42], 0.12);
  g.groundQuad(-span / 2 - 40, span / 2, span / 2 + 40, span / 2 + 6, 0.03, [0.85, 0.75, 0.55]);
  // Marina pier at the south edge, where the final mission ends.
  g.groundQuad(-6, span / 2 + 6, 6, span / 2 + 34, 0.25, [0.45, 0.35, 0.22]);
  g.box(0, 1.2, span / 2 + 36, 7, 2.4, 10, [0.85, 0.85, 0.88]); // the yacht
  g.box(0, 3.0, span / 2 + 36, 4, 1.4, 6, [0.15, 0.35, 0.55]);

  // Roads: asphalt strips both ways, with dashed centre lines and crosswalks.
  const lines = roadLines();
  const roadCol = [0.14, 0.14, 0.16];
  for (const c of lines) {
    g.groundQuad(-span / 2 - 20, c - CITY.roadWidth / 2, span / 2 + 20, c + CITY.roadWidth / 2, 0.04, roadCol);
    g.groundQuad(c - CITY.roadWidth / 2, -span / 2 - 20, c + CITY.roadWidth / 2, span / 2 + 20, 0.04, roadCol);
    for (let t = -span / 2; t < span / 2; t += 9) {
      g.groundQuad(t, c - 0.25, t + 4.5, c + 0.25, 0.06, [0.85, 0.8, 0.4], 0.05);
      g.groundQuad(c - 0.25, t, c + 0.25, t + 4.5, 0.06, [0.85, 0.8, 0.4], 0.05);
    }
  }
  // Sidewalks: pale strips hugging each block. Blocks sit BETWEEN the road
  // lines: roads run at multiples of the pitch, block centres at the midpoints
  // between them, so no building ever stands on a road.
  const blockCount = CITY.blocks - 1;
  const halfB = (blockCount - 1) / 2;
  const blockCentre = (i) => (i - halfB) * CITY.pitch;
  for (let i = 0; i < blockCount; i++) {
    for (let j = 0; j < blockCount; j++) {
      const bx = blockCentre(i), bz = blockCentre(j);
      g.groundQuad(bx - CITY.blockSize / 2 - 2, bz - CITY.blockSize / 2 - 2, bx + CITY.blockSize / 2 + 2, bz + CITY.blockSize / 2 + 2, 0.05, [0.42, 0.42, 0.44]);
    }
  }

  // Buildings, block by block. The two blocks near the marina stay low (beachfront).
  for (let i = 0; i < blockCount; i++) {
    for (let j = 0; j < blockCount; j++) {
      const bx = blockCentre(i), bz = blockCentre(j);
      const beach = j >= blockCount - 2;
      const count = beach ? 1 : rangeInt(rng, 1, 2);
      for (let k = 0; k < count; k++) {
        const w = range(rng, 14, count === 1 ? 34 : 18);
        const d = range(rng, 14, count === 1 ? 30 : 18);
        const ox = count === 1 ? 0 : (k === 0 ? -9 : 9);
        const oz = count === 1 ? 0 : (k === 0 ? -8 : 8);
        const h = beach ? range(rng, 6, 12) : range(rng, 9, 44);
        const col = pick(rng, FACADES);
        const cx = bx + ox, cz = bz + oz;
        g.box(cx, h / 2, cz, w, h, d, col);
        // Glass crown on tall towers, rooftop plant on the rest.
        if (h > 26) g.box(cx, h + 1.2, cz, w * 0.55, 2.4, d * 0.55, GLASS, 0.25);
        else g.box(cx + w * 0.2, h + 0.7, cz, 3, 1.4, 3, [0.35, 0.35, 0.38]);
        for (const face of ['n', 's', 'e', 'w']) windows(g, rng, cx, cz, w, d, h, face, litChance);
        buildings.push({ x: cx, z: cz, w, d, h });
        // Neon sign on a few downtown towers (blocks near the centre).
        if (Math.abs(i - 3.5) <= 2 && Math.abs(j - 3.5) <= 2 && rng() < 0.5) {
          const nc = pick(rng, NEON);
          const sy = range(rng, 4, Math.min(h - 3, 14));
          g.box(cx, sy, cz + d / 2 + 0.35, 2.2, 5.5, 0.3, nc, 1.0);
          g.groundQuad(cx - 3, cz + d / 2 + 0.5, cx + 3, cz + d / 2 + 4, 0.07, nc, 0.35 * (0.4 + night));
        }
      }
      // Palms along the block's south sidewalk.
      if (rng() < 0.8) {
        const px = bx + range(rng, -16, 16);
        palm(g, px, bz + CITY.blockSize / 2 + 1, rng);
        palms.push({ x: px, z: bz + CITY.blockSize / 2 + 1 });
      }
    }
  }
  // Streetlights at every other intersection.
  for (let a = 0; a < lines.length; a += 2) {
    for (let b = 0; b < lines.length; b += 2) streetlight(g, lines[a] + 5, lines[b] + 5, night);
  }
  // A lighthouse far out on the water, so the horizon never looks empty at night.
  g.box(-span / 2 - 18, 9, span / 2 + 48, 4, 18, 4, [0.8, 0.75, 0.65]);
  g.box(-span / 2 - 18, 18.6, span / 2 + 48, 2.2, 1.6, 2.2, [1.0, 0.9, 0.4], 1.2);
  return { geom: g, buildings, palms, lines };
}

// Is (x, z) on a road (drivable)? Roads are the strips between blocks.
export function onRoad(x, z) {
  const lines = roadLines();
  const hw = CITY.roadWidth / 2 + 1;
  for (const c of lines) if (Math.abs(x - c) < hw || Math.abs(z - c) < hw) return true;
  return false;
}

// Snap a point onto the nearest road centre line (for spawning traffic).
export function nearestRoadPoint(x, z) {
  const lines = roadLines();
  let bx = lines[0], bz = lines[0], bd = Infinity;
  for (const c of lines) {
    const d = Math.abs(x - c);
    if (d < bd) { bd = d; bx = c; }
  }
  bd = Infinity;
  for (const c of lines) {
    const d = Math.abs(z - c);
    if (d < bd) { bd = d; bz = c; }
  }
  return Math.abs(x - bx) < Math.abs(z - bz) ? { x: bx, z } : { x, z: bz };
}
