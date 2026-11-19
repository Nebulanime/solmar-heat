// textures.js — every texture in Solmar is painted procedurally on canvas:
// building facades with lit windows, the whole-city ground map, car paint,
// neon signs and the sun glow. No image files, no network.
import { mulberry32 } from './util.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Building facade: concrete + window grid. `lit` 0..1 = share of windows glowing.
// `tone` picks the palette; windows get warm/cool random tints.
export function facadeTexture(seed, tone, lit) {
  const rnd = mulberry32(seed);
  const c = canvas(256, 256), g = c.getContext('2d');
  const palettes = {
    glass: ['#2c3e55', '#31465f', '#243447'],
    brick: ['#7a4a38', '#8a5540', '#6b4032'],
    sand: ['#c9a06a', '#d4af7a', '#b98f5c'],
    concrete: ['#8d9299', '#979ca3', '#82878e'],
    coral: ['#d98a6a', '#e09a78', '#cf7d5e'],
    teal: ['#3f7d7a', '#4a8d89', '#35706d'],
  };
  const base = palettes[tone] || palettes.concrete;
  g.fillStyle = base[0]; g.fillRect(0, 0, 256, 256);
  // subtle vertical panel variation
  for (let x = 0; x < 256; x += 32) {
    g.fillStyle = base[1 + Math.floor(rnd() * 2)] + '';
    g.globalAlpha = 0.25;
    g.fillRect(x, 0, 32, 256);
  }
  g.globalAlpha = 1;
  // floor bands
  const floors = 8 + Math.floor(rnd() * 6);
  const cols = 6 + Math.floor(rnd() * 4);
  const fh = 256 / floors, cw = 256 / cols;
  for (let f = 0; f < floors; f++) {
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, f * fh + fh - 3, 256, 3);
    for (let i = 0; i < cols; i++) {
      const x = i * cw + cw * 0.16, y = f * fh + fh * 0.2;
      const w = cw * 0.68, h = fh * 0.55;
      const on = rnd() < lit;
      if (on) {
        const warm = rnd() < 0.7;
        g.fillStyle = warm ? `rgba(255,${190 + Math.floor(rnd() * 50)},90,0.95)` : `rgba(150,220,255,0.9)`;
      } else {
        g.fillStyle = rnd() < 0.5 ? '#141c28' : '#1d2836';
      }
      g.fillRect(x, y, w, h);
      if (on) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y, w, h * 0.3); }
    }
  }
  return c;
}

// Roof: dark slab with vents / AC boxes / a helipad ring on some towers.
export function roofTexture(seed, helipad) {
  const rnd = mulberry32(seed);
  const c = canvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#3a3f46'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#33383f';
  for (let i = 0; i < 5; i++) g.fillRect(10 + rnd() * 90, 10 + rnd() * 90, 14 + rnd() * 18, 10 + rnd() * 14);
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 2;
  g.strokeRect(4, 4, 120, 120);
  if (helipad) {
    g.strokeStyle = '#ffd23e'; g.lineWidth = 4;
    g.beginPath(); g.arc(64, 64, 42, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ffd23e'; g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('H', 64, 66);
  }
  return c;
}

// Ground map: one 2048 canvas painted over the whole city — dark asphalt roads
// with lane markings + crosswalks, pale sidewalks, green parks, a sandy beach
// and marina water on the west edge. Mapped 1:1 onto the ground plane.
export function groundTexture(city) {
  const S = 2048, c = canvas(S, S), g = c.getContext('2d');
  const toPx = (v) => ((v - city.min) / (city.max - city.min)) * S;
  // base: dark block interiors
  g.fillStyle = '#4c5158'; g.fillRect(0, 0, S, S);
  // sidewalk strips along every road (lighter than blocks, darker than before)
  g.fillStyle = '#7d828a';
  for (const a of city.avenues) g.fillRect(toPx(a.x - city.roadW / 2 - 5), 0, toPx(a.x + city.roadW / 2 + 5) - toPx(a.x - city.roadW / 2 - 5), S);
  for (const s of city.streets) g.fillRect(0, toPx(s.z - city.roadW / 2 - 5), S, toPx(s.z + city.roadW / 2 + 5) - toPx(s.z - city.roadW / 2 - 5));
  // parks
  for (const p of city.parks) {
    g.fillStyle = '#3f7a44';
    g.fillRect(toPx(p.x - p.w / 2), toPx(p.z - p.d / 2), toPx(p.x + p.w / 2) - toPx(p.x - p.w / 2), toPx(p.z + p.d / 2) - toPx(p.z - p.d / 2));
    g.fillStyle = '#356b3a';
    for (let i = 0; i < 8; i++) {
      g.beginPath();
      g.arc(toPx(p.x - p.w / 2) + Math.random() * (toPx(p.x + p.w / 2) - toPx(p.x - p.w / 2)), toPx(p.z - p.d / 2) + Math.random() * (toPx(p.z + p.d / 2) - toPx(p.z - p.d / 2)), 8 + Math.random() * 14, 0, Math.PI * 2);
      g.fill();
    }
  }
  // beach + water on the west edge
  const bx = toPx(city.beachX);
  g.fillStyle = '#e8d9a8'; g.fillRect(0, 0, bx, S);
  g.fillStyle = '#1d6f8e'; g.fillRect(0, 0, bx * 0.55, S);
  g.fillStyle = '#2b84a8';
  for (let i = 0; i < 40; i++) { g.fillRect(Math.random() * bx * 0.5, Math.random() * S, 30 + Math.random() * 60, 3); }
  // roads: dark asphalt
  g.fillStyle = '#23262c';
  for (const a of city.avenues) g.fillRect(toPx(a.x - city.roadW / 2), 0, toPx(a.x + city.roadW / 2) - toPx(a.x - city.roadW / 2), S);
  for (const s of city.streets) g.fillRect(0, toPx(s.z - city.roadW / 2), S, toPx(s.z + city.roadW / 2) - toPx(s.z - city.roadW / 2));
  // lane markings: dashed center lines (yellow) + edge lines (white)
  g.fillStyle = '#d8b93a';
  for (const a of city.avenues) {
    const x = toPx(a.x);
    for (let y = 0; y < S; y += 46) g.fillRect(x - 2, y, 4, 24);
  }
  for (const s of city.streets) {
    const y = toPx(s.z);
    for (let x = 0; x < S; x += 46) g.fillRect(x, y - 2, 24, 4);
  }
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (const a of city.avenues) {
    g.fillRect(toPx(a.x - city.roadW / 2 + 2), 0, 2, S);
    g.fillRect(toPx(a.x + city.roadW / 2 - 4), 0, 2, S);
  }
  for (const s of city.streets) {
    g.fillRect(0, toPx(s.z - city.roadW / 2 + 2), S, 2);
    g.fillRect(0, toPx(s.z + city.roadW / 2 - 4), S, 2);
  }
  // crosswalks at every intersection
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (const a of city.avenues) for (const s of city.streets) {
    const x = toPx(a.x), y = toPx(s.z), w = city.roadW;
    for (let i = -3; i <= 3; i++) {
      g.fillRect(x + i * 7 - 2, y - w / 2 * 0.9, 4, w * 0.9);
      g.fillRect(x - w / 2 * 0.9, y + i * 7 - 2, w * 0.9, 4);
    }
  }
  return c;
}

// Neon sign strip texture (shop / club signs): bright letters on dark.
export function neonTexture(text, color) {
  const c = canvas(512, 128), g = c.getContext('2d');
  g.fillStyle = '#0a0a14'; g.fillRect(0, 0, 512, 128);
  g.font = 'bold 64px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 26;
  g.fillStyle = color; g.fillText(text, 256, 66);
  g.shadowBlur = 8; g.fillStyle = '#fff'; g.fillText(text, 256, 66);
  return c;
}

// Radial sun glow sprite (additive-ish soft disc).
export function sunTexture() {
  const c = canvas(256, 256), g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,246,220,1)');
  grad.addColorStop(0.25, 'rgba(255,214,120,0.95)');
  grad.addColorStop(0.6, 'rgba(255,140,60,0.45)');
  grad.addColorStop(1, 'rgba(255,110,40,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  return c;
}

// Plain 1x1 white texture for untextured color meshes.
export function whiteTexture() {
  const c = canvas(2, 2), g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 2, 2);
  return c;
}
