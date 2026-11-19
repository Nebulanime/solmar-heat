// SOLMAR HEAT — textures.js
// Every texture in the game is painted procedurally on 2D canvases at
// boot: no image files, no network. The main atlas is a 512x512 sheet of
// sixteen 128x128 tiles (facades, road, sand, water, roofs, neon...).
// Windows are kept SMALL and dense on purpose: the close-up shots of the
// previous round showed facades with windows far too large.

export const TILE = 128;
export const ATLAS_COLS = 4;

export function tileUV(index) {
  // No Y flip on upload, so v grows downward in canvas space: the tile's
  // bottom edge (the bottom of a face) is v = (row+1)/4 and its top edge
  // is v = row/4. Returning them in that order keeps the painted facade
  // upright on the wall.
  const col = index % ATLAS_COLS;
  const row = Math.floor(index / ATLAS_COLS);
  const u0 = col / ATLAS_COLS;
  const v0 = (row + 1) / ATLAS_COLS;
  const u1 = (col + 1) / ATLAS_COLS;
  const v1 = row / ATLAS_COLS;
  return [u0, v0, u1, v1];
}

function makeTileCanvas() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  return c;
}

function tileCtx(ctx, index) {
  const col = index % ATLAS_COLS;
  const row = Math.floor(index / ATLAS_COLS);
  ctx.save();
  ctx.translate(col * TILE, row * TILE);
  ctx.beginPath();
  ctx.rect(0, 0, TILE, TILE);
  ctx.clip();
  return () => ctx.restore();
}

// Paint a grid of small windows. litChance is the share of windows that
// glow warm (evening), the rest are dark glass. Window size stays small
// (9x12 px in a 128 tile) so close-ups read as a real facade.
function paintWindows(ctx, rng, base, cols, rows, litChance) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TILE, TILE);
  const cw = TILE / cols;
  const ch = TILE / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const lit = rng() < litChance;
      const x = i * cw + cw * 0.22;
      const y = j * ch + ch * 0.2;
      const w = cw * 0.56;
      const h = ch * 0.6;
      if (lit) {
        ctx.fillStyle = rng() < 0.7 ? '#ffd98a' : '#ffeec2';
      } else {
        ctx.fillStyle = rng() < 0.5 ? '#1c2733' : '#263646';
      }
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x, y, w, 2);
    }
  }
}

// A deterministic per-tile rng so the atlas is identical every boot.
function tileRng(index) {
  let a = (index * 2654435761 + 40503) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createAtlas() {
  const canvas = makeTileCanvas();
  const ctx = canvas.getContext('2d');
  const rng = tileRng(0);

  // Tile 0 — glass facade, dense small windows.
  let done = tileCtx(ctx, 0);
  paintWindows(ctx, tileRng(0), '#5d6b78', 8, 10, 0.28);
  done();

  // Tile 1 — brick facade with balconies and small windows.
  done = tileCtx(ctx, 1);
  ctx.fillStyle = '#8a5a44';
  ctx.fillRect(0, 0, TILE, TILE);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < TILE; y += 8) ctx.fillRect(0, y, TILE, 1);
  for (let y = 0; y < TILE; y += 16) ctx.fillRect(0, y, TILE, 2);
  paintWindows(ctx, tileRng(1), 'rgba(0,0,0,0)', 6, 8, 0.22);
  ctx.fillStyle = 'rgba(20,20,24,0.55)';
  for (let j = 1; j < 8; j += 2) ctx.fillRect(4, j * 16 - 4, TILE - 8, 3);
  done();

  // Tile 2 — dark tower glass, vertical fins, small windows.
  done = tileCtx(ctx, 2);
  paintWindows(ctx, tileRng(2), '#2e3d4c', 10, 12, 0.34);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let x = 0; x < TILE; x += 13) ctx.fillRect(x, 0, 3, TILE);
  done();

  // Tile 3 — dark asphalt with a centre dash and edge lines.
  done = tileCtx(ctx, 3);
  ctx.fillStyle = '#232428';
  ctx.fillRect(0, 0, TILE, TILE);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.02 + rng() * 0.04})`;
    ctx.fillRect(rng() * TILE, rng() * TILE, 2, 2);
  }
  ctx.fillStyle = '#c8a84a';
  ctx.fillRect(TILE / 2 - 2, 0, 4, 26);
  ctx.fillRect(TILE / 2 - 2, 51, 4, 26);
  ctx.fillRect(TILE / 2 - 2, 102, 4, 26);
  ctx.fillStyle = '#d8d8d8';
  ctx.fillRect(6, 0, 2, TILE);
  ctx.fillRect(TILE - 8, 0, 2, TILE);
  done();

  // Tile 4 — sidewalk slabs.
  done = tileCtx(ctx, 4);
  ctx.fillStyle = '#9a938a';
  ctx.fillRect(0, 0, TILE, TILE);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 0; i <= 4; i++) {
    ctx.fillRect(i * 32, 0, 2, TILE);
    ctx.fillRect(0, i * 32, TILE, 2);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 120; i++) ctx.fillRect(rng() * TILE, rng() * TILE, 2, 2);
  done();

  // Tile 5 — sand.
  done = tileCtx(ctx, 5);
  ctx.fillStyle = '#d9c08a';
  ctx.fillRect(0, 0, TILE, TILE);
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = rng() < 0.5 ? 'rgba(120,90,40,0.18)' : 'rgba(255,240,200,0.25)';
    ctx.fillRect(rng() * TILE, rng() * TILE, 2, 1);
  }
  done();

  // Tile 6 — sea water with wave streaks.
  done = tileCtx(ctx, 6);
  ctx.fillStyle = '#14607e';
  ctx.fillRect(0, 0, TILE, TILE);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.5;
  for (let y = 8; y < TILE; y += 16) {
    ctx.beginPath();
    for (let x = 0; x <= TILE; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.2 + y) * 2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(20,120,160,0.35)';
  for (let i = 0; i < 40; i++) ctx.fillRect(rng() * TILE, rng() * TILE, 6, 2);
  done();

  // Tile 7 — rooftop: dark membrane, vents and AC boxes.
  done = tileCtx(ctx, 7);
  ctx.fillStyle = '#3a3a3e';
  ctx.fillRect(0, 0, TILE, TILE);
  ctx.fillStyle = '#4c4c52';
  ctx.fillRect(12, 12, 30, 22);
  ctx.fillRect(76, 60, 36, 26);
  ctx.fillRect(20, 84, 22, 18);
  ctx.fillStyle = '#2c2c30';
  ctx.fillRect(12, 12, 30, 4);
  ctx.fillRect(76, 60, 36, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(0, 0, TILE, 3);
  ctx.fillRect(0, 0, 3, TILE);
  done();

  return canvas;
}

// ---- Tiles 8-11 and the glow sprite (second pass) ----

export function paintAtlasRest(canvas) {
  const ctx = canvas.getContext('2d');
  const rng = tileRng(8);

  // Tile 8 — neon facade: dark wall, hot neon strips, lit windows.
  let done = tileCtx(ctx, 8);
  paintWindows(ctx, tileRng(8), '#232030', 6, 8, 0.5);
  const neon = ['#ff2e88', '#22e6ff', '#ffd23e', '#7CFF6B'];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = neon[i % neon.length];
    ctx.fillRect(6 + i * 30, 10 + i * 6, 20, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(6 + i * 30, 10 + i * 6, 20, 1);
  }
  ctx.fillStyle = '#ff2e88';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('NEON', 44, 108);
  done();

  // Tile 9 — grass.
  done = tileCtx(ctx, 9);
  ctx.fillStyle = '#4d7a3a';
  ctx.fillRect(0, 0, TILE, TILE);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = rng() < 0.5 ? 'rgba(20,60,20,0.25)' : 'rgba(140,190,90,0.25)';
    ctx.fillRect(rng() * TILE, rng() * TILE, 2, 3);
  }
  done();

  // Tile 10 — plaza checker tiles.
  done = tileCtx(ctx, 10);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? '#b8a894' : '#8f7f6c';
      ctx.fillRect(i * 32, j * 32, 32, 32);
    }
  }
  done();

  // Tile 11 — dock wood planks.
  done = tileCtx(ctx, 11);
  ctx.fillStyle = '#7a5a38';
  ctx.fillRect(0, 0, TILE, TILE);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let y = 0; y < TILE; y += 16) ctx.fillRect(0, y, TILE, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let y = 8; y < TILE; y += 16) ctx.fillRect(0, y, TILE, 1);
  done();

  // Tile 12 — plain white: vertex colour alone decides the look (car
  // bodies, props, lamp heads). Tile 13 — plain dark grey.
  done = tileCtx(ctx, 12);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, TILE, TILE);
  done();
  done = tileCtx(ctx, 13);
  ctx.fillStyle = '#3c3c40';
  ctx.fillRect(0, 0, TILE, TILE);
  done();

  return canvas;
}

// A soft radial glow sprite (sun, lamp halos, mission beacons, muzzle
// flashes). White at the centre fading to transparent; tinted per draw.
export function createGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.16)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

// A soft round blob for fake contact shadows under cars and people.
export function createBlobTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(0,0,0,0.5)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.28)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}
