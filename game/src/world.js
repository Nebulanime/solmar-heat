// SOLMAR HEAT — world.js
// Deterministic city generation for Solmar. One seed builds the whole
// town: blocks, towers, setbacks, cylinders, the marina, the beach, the
// sea, palms and streetlights. game.js renders what this returns and
// collides against its colliders; nothing here touches the DOM.

import { WORLD, DISTRICTS } from './config.js';
import { mulberry32, int, range, pick, hash2 } from './random.js';

// Facade tiles in the texture atlas (see textures.js for the tile map).
const FACADE_GLASS = 0;
const FACADE_BRICK = 1;
const FACADE_TOWER = 2;
const FACADE_NEON = 8;

export function generateCity(seed = 20261119) {
  const rng = mulberry32(seed);
  const buildings = [];
  const colliders = [];
  const palms = [];
  const lamps = [];
  const yachts = [];
  const docks = [];

  const blockX0 = (col) => -320 + col * WORLD.pitch + WORLD.road / 2;
  const blockZ0 = (row) => -240 + row * WORLD.pitch + WORLD.road / 2;

  for (let col = 0; col < WORLD.cols; col++) {
    for (let row = 0; row < WORLD.rows; row++) {
      const x0 = blockX0(col);
      const z0 = blockZ0(row);
      const cx = x0 + WORLD.block / 2;
      const cz = z0 + WORLD.block / 2;
      const district = DISTRICTS.find(
        (d) => cx >= d.x0 && cx < d.x1 && cz >= d.z0 && cz < d.z1,
      ) || DISTRICTS[0];
      const tall = district.tall;
      const roll = rng();

      if (roll < 0.12) {
        // Plaza / parking lot: low props only, no big building.
        palms.push({ x: cx - 14, z: cz - 10 });
        palms.push({ x: cx + 16, z: cz + 12 });
        continue;
      }

      if (roll < 0.3) {
        // One big tower, sometimes with a setback crown, sometimes a cylinder.
        const w = range(rng, 30, 44);
        const d = range(rng, 30, 44);
        const h = tall ? range(rng, 42, 78) : range(rng, 18, 34);
        const kind = rng() < 0.22 ? 'cyl' : 'box';
        const tile = h > 40 ? FACADE_TOWER : pick(rng, [FACADE_GLASS, FACADE_BRICK]);
        const tint = [range(rng, 0.75, 1), range(rng, 0.75, 1), range(rng, 0.8, 1)];
        buildings.push({ x: cx, z: cz, w, d, h, kind, tile, tint, setback: rng() < 0.5 });
        colliders.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });
      } else {
        // 2-4 mid/low buildings filling the block, varied footprints.
        const n = int(rng, 2, 4);
        const slots = n === 2
          ? [[-16, 0, 26, 56], [16, 0, 26, 56]]
          : n === 3
            ? [[-18, -14, 24, 24], [18, -14, 24, 24], [0, 16, 44, 22]]
            : [[-16, -16, 26, 26], [16, -16, 26, 26], [-16, 16, 26, 26], [16, 16, 26, 26]];
        for (const [ox, oz, w, d] of slots) {
          const h = tall ? range(rng, 16, 46) : range(rng, 8, 24);
          const tile = pick(rng, [FACADE_GLASS, FACADE_BRICK, FACADE_BRICK, FACADE_NEON]);
          const tint = [range(rng, 0.7, 1), range(rng, 0.7, 1), range(rng, 0.75, 1)];
          const bx = cx + ox;
          const bz = cz + oz;
          buildings.push({ x: bx, z: bz, w, d, h, kind: 'box', tile, tint, setback: h > 30 && rng() < 0.4 });
          colliders.push({ x0: bx - w / 2, z0: bz - d / 2, x1: bx + w / 2, z1: bz + d / 2 });
        }
      }

      // A palm or two at the block corners, deterministic per block.
      if (hash2(col, row, 7) < 0.55) palms.push({ x: x0 + 4, z: z0 + 4 });
      if (hash2(col, row, 13) < 0.4) palms.push({ x: x0 + WORLD.block - 4, z: z0 + WORLD.block - 4 });
    }
  }

  // Streetlights: both sides of every vertical street, every 40 m, offset
  // so the lamp head hangs over the road. Same for horizontal streets.
  for (let i = 0; i <= WORLD.cols; i++) {
    const x = -320 + i * WORLD.pitch;
    for (let z = -240; z <= 240; z += 40) {
      lamps.push({ x: x - WORLD.road / 2 - 1.5, z, arm: 1 });
      lamps.push({ x: x + WORLD.road / 2 + 1.5, z: z + 20, arm: -1 });
    }
  }
  for (let j = 0; j <= WORLD.rows; j++) {
    const z = -240 + j * WORLD.pitch;
    for (let x = -320; x <= 320; x += 40) {
      lamps.push({ x: x + 20, z: z - WORLD.road / 2 - 1.5, arm: 1 });
      lamps.push({ x, z: z + WORLD.road / 2 + 1.5, arm: -1 });
    }
  }

  // Beach palms along the sand strip.
  for (let z = -240; z <= 240; z += 28) {
    palms.push({ x: 344 + hash2(99, z, 3) * 10, z: z + hash2(99, z, 5) * 8 });
  }

  // Old Marina: wooden docks jutting into the sea and moored yachts.
  for (let k = 0; k < 4; k++) {
    const z = 140 + k * 28;
    docks.push({ x: 380, z, len: 46 });
    const nY = 2 + (k % 2);
    for (let y = 0; y < nY; y++) {
      yachts.push({
        x: 392 + y * 16,
        z: z + (y % 2 === 0 ? -7 : 7),
        angle: (rng() - 0.5) * 0.3,
        len: range(rng, 11, 16),
        hull: pick(rng, [[0.92, 0.92, 0.95], [0.85, 0.2, 0.25], [0.15, 0.35, 0.6]]),
      });
    }
  }

  return { buildings, colliders, palms, lamps, yachts, docks, seed };
}

// Road centre lines, for traffic spawning and the minimap.
export function roadLines() {
  const vertical = [];
  const horizontal = [];
  for (let i = 0; i <= WORLD.cols; i++) vertical.push(-320 + i * WORLD.pitch);
  for (let j = 0; j <= WORLD.rows; j++) horizontal.push(-240 + j * WORLD.pitch);
  return { vertical, horizontal };
}

// Random point on a road lane, for spawning traffic cars.
export function randomRoadPoint(rng) {
  const lines = roadLines();
  if (rng() < 0.5) {
    const x = pick(rng, lines.vertical) + (rng() < 0.5 ? -3.5 : 3.5);
    return { x, z: range(rng, -230, 230), axis: 'z' };
  }
  const z = pick(rng, lines.horizontal) + (rng() < 0.5 ? -3.5 : 3.5);
  return { x: range(rng, -310, 310), z, axis: 'x' };
}

// ---- Sidewalk spawn points (second pass) --------------------------------
// Pedestrians walk the sidewalks that ring each block. This returns points
// just outside a block edge, on the pavement, for ped spawning.

export function randomSidewalkPoint(rng) {
  const col = int(rng, 0, WORLD.cols - 1);
  const row = int(rng, 0, WORLD.rows - 1);
  const x0 = -320 + col * WORLD.pitch + WORLD.road / 2;
  const z0 = -240 + row * WORLD.pitch + WORLD.road / 2;
  const side = int(rng, 0, 3);
  const t = range(rng, 6, WORLD.block - 6);
  if (side === 0) return { x: x0 - 3, z: z0 + t };
  if (side === 1) return { x: x0 + WORLD.block + 3, z: z0 + t };
  if (side === 2) return { x: x0 + t, z: z0 - 3 };
  return { x: x0 + t, z: z0 + WORLD.block + 3 };
}

// Is a point inside any building collider (used to keep spawns honest)?
export function insideAnyCollider(x, z, colliders) {
  for (const c of colliders) {
    if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) return true;
  }
  return false;
}
