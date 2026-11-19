// Solmar Heat — procedural textures, drawn on canvas at load time. No image
// files, no network: every facade and neon sign is painted here from a
// seeded generator, so buildings never read as flat coloured boxes.
import { rng } from './logic.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
// A building facade, tileable vertically: base colour, floor bands, a grid
// of windows (some lit warm, some dark, a few curtained) and grime streaks.
// Shops and roof details are geometry, so this texture repeats cleanly
// every ~12 m of building height.
export function buildingTexture(seed, base, opts = {}) {
  const R = rng(seed);
  const W = 256, H = 512;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(0,0,0,${0.03 + R() * 0.06})`;
    g.fillRect(R() * W, R() * H * 0.7, 2 + R() * 8, 30 + R() * 120);
  }
  const floors = opts.floors ?? 8, cols = opts.cols ?? 6;
  const top = 8, avail = H - top - 8;
  const fh = avail / floors, cw = (W - 24) / cols;
  for (let f = 0; f < floors; f++) {
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, top + f * fh, W, 2);
    for (let col = 0; col < cols; col++) {
      const x = 12 + col * cw + 3, y = top + f * fh + 4, w = cw - 6, h = fh - 8;
      const lit = R();
      if (lit < 0.34) g.fillStyle = ['#ffd98a', '#ffb45e', '#ffe9b0', '#9fd8ff'][Math.floor(R() * 4)];
      else if (lit < 0.5) g.fillStyle = '#3a4a63';
      else g.fillStyle = '#10151f';
      g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,0.16)';
      g.fillRect(x, y, w, 2);
      if (R() < 0.3) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y + h * 0.45, w, h * 0.55); }
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
    }
  }
  return c;
}
export const FACADE_SIGNS = [
  ['#7a5c46', 'VELA HOTEL', '#ffd166'], ['#4a5a78', 'SOLMAR TOWER', '#7ee7ff'],
  ['#6b4a5e', 'NEON ROW', '#ff5e8a'], ['#3f5a4a', 'PALM COURT', '#9dff6e'],
  ['#5e4a3a', 'BAYVIEW', '#ffb45e'], ['#46506b', 'MARINA PLAZA', '#c9b8ff'],
  ['#74443f', 'CALLE ROSA', '#ff8a5e'], ['#39505c', 'PORT SOLMAR', '#7ee7ff'],
];
export function makeBuildingTextures() {
  return FACADE_SIGNS.map(([base], i) =>
    buildingTexture(1000 + i * 77, base, { floors: 7 + (i % 5), cols: 5 + (i % 3) }));
}
// Neon sign texture: glowing text on transparent dark, for clubs and shops.
export function neonTexture(text, color) {
  const c = makeCanvas(256, 64), g = c.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 18;
  g.fillStyle = color; g.fillText(text, 128, 32);
  g.shadowBlur = 4; g.fillStyle = '#fff'; g.fillText(text, 128, 32);
  return c;
}
// Wet asphalt: dark base with faint lane wear and puddle sheen patches.
export function roadTexture(seed) {
  const R = rng(seed);
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#232327'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${120 + R() * 60 | 0},${120 + R() * 60 | 0},${130 + R() * 60 | 0},${0.05 + R() * 0.08})`;
    g.fillRect(R() * 256, R() * 256, 1 + R() * 2, 1 + R() * 2);
  }
  for (let i = 0; i < 7; i++) {
    const x = R() * 256, y = R() * 256, r = 12 + R() * 30;
    const gr = g.createRadialGradient(x, y, 2, x, y, r);
    gr.addColorStop(0, 'rgba(255,170,110,0.20)'); gr.addColorStop(1, 'rgba(255,170,110,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  return c;
}
