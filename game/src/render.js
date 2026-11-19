// SOLMAR HEAT — render.js
// Hand-rolled WebGL renderer: no 3D library, no network, everything the
// game draws goes through this file. One textured lit program draws the
// static city and every vehicle and pedestrian; a second unlit program
// draws billboards (sun, lamp glow, beacons, blob shadows); a fullscreen
// triangle paints the sky gradient. Time of day drives the palette,
// fog and sun position.

// ---- Minimal mat4 (column-major, like WebGL expects) ---------------------

export function mat4Identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

export function mat4Perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const out = mat4Identity();
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  out[15] = 0;
  return out;
}

export function mat4LookAt(eye, target, up) {
  const zx = eye[0] - target[0];
  const zy = eye[1] - target[1];
  const zz = eye[2] - target[2];
  let zl = Math.hypot(zx, zy, zz);
  const z = [zx / zl, zy / zl, zz / zl];
  let xx = up[1] * z[2] - up[2] * z[1];
  let xy = up[2] * z[0] - up[0] * z[2];
  let xz = up[0] * z[1] - up[1] * z[0];
  zl = Math.hypot(xx, xy, xz) || 1;
  const x = [xx / zl, xy / zl, xz / zl];
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  const out = mat4Identity();
  out[0] = x[0]; out[4] = x[1]; out[8] = x[2];
  out[1] = y[0]; out[5] = y[1]; out[9] = y[2];
  out[2] = z[0]; out[6] = z[1]; out[10] = z[2];
  out[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
  out[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
  out[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
  return out;
}

// Model matrix from position + yaw (rotation around Y) + uniform scale.
export function mat4Model(x, y, z, yaw, scale = 1) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const out = mat4Identity();
  out[0] = c * scale; out[2] = -s * scale;
  out[8] = s * scale; out[10] = c * scale;
  out[5] = scale;
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}

export function projectPoint(viewProj, x, y, z) {
  const w = viewProj[3] * x + viewProj[7] * y + viewProj[11] * z + viewProj[15];
  if (w === 0) return null;
  const cx = (viewProj[0] * x + viewProj[4] * y + viewProj[8] * z + viewProj[12]) / w;
  const cy = (viewProj[1] * x + viewProj[5] * y + viewProj[9] * z + viewProj[13]) / w;
  const cz = (viewProj[2] * x + viewProj[6] * y + viewProj[10] * z + viewProj[14]) / w;
  return { x: cx, y: cy, z: cz, behind: cz > 1 || cz < -1 };
}

// ---- Shaders -------------------------------------------------------------

const VERT = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec2 aUV;
attribute vec3 aColor;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
varying vec3 vNormal;
varying vec2 vUV;
varying vec3 vColor;
varying float vDist;
void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vNormal = mat3(uModel) * aNormal;
  vUV = aUV;
  vColor = aColor;
  vec4 vp = uView * wp;
  vDist = -vp.z;
  gl_Position = uProj * vp;
}
`;

const FRAG = `
precision mediump float;
varying vec3 vNormal;
varying vec2 vUV;
varying vec3 vColor;
varying float vDist;
uniform sampler2D uTex;
uniform vec3 uLightDir;
uniform float uLightI;
uniform vec3 uAmbient;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uEmissive;
void main() {
  vec4 tex = texture2D(uTex, vUV);
  vec3 base = tex.rgb * vColor;
  float diff = max(dot(normalize(vNormal), normalize(uLightDir)), 0.0);
  vec3 col = base * (uAmbient + diff * uLightI) + base * uEmissive;
  float f = 1.0 - exp(-vDist * vDist * uFogDensity * uFogDensity);
  col = mix(col, uFogColor, clamp(f, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

const SPRITE_VERT = `
attribute vec3 aPos;
attribute vec2 aUV;
uniform mat4 uView;
uniform mat4 uProj;
varying vec2 vUV;
void main() {
  vUV = aUV;
  gl_Position = uProj * uView * vec4(aPos, 1.0);
}
`;

const SPRITE_FRAG = `
precision mediump float;
varying vec2 vUV;
uniform sampler2D uTex;
uniform vec3 uTint;
uniform float uAlpha;
void main() {
  vec4 tex = texture2D(uTex, vUV);
  gl_FragColor = vec4(uTint * tex.rgb, tex.a * uAlpha);
}
`;

const SKY_VERT = `
attribute vec2 aPos;
varying vec2 vPos;
void main() {
  vPos = aPos;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const SKY_FRAG = `
precision mediump float;
varying vec2 vPos;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunSize;
void main() {
  float h = clamp(vPos.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(h, 0.75));
  vec3 dir = normalize(vec3(vPos.x * 0.9, vPos.y * 0.62 + 0.08, -1.0));
  float s = max(dot(dir, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(s, 220.0) * 1.4 + pow(s, 18.0) * 0.35 * uSunSize);
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---- Geometry builders ---------------------------------------------------
// Arrays are plain JS arrays: { pos: [], nrm: [], uv: [], col: [], idx: [] }.
// UVs are in atlas space; tileUV() maps a tile index to its atlas rect.
// Faces get the tile stretched across them, repeated (rx, ry) times.

function quad(arrays, p, n, uv, col) {
  // p: 4 corners [x,y,z]; n: face normal; uv: [u0,v0,u1,v1]; col: [r,g,b]
  const base = arrays.pos.length / 3;
  for (const v of p) arrays.pos.push(v[0], v[1], v[2]);
  for (let i = 0; i < 4; i++) arrays.nrm.push(n[0], n[1], n[2]);
  arrays.uv.push(uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]);
  for (let i = 0; i < 4; i++) arrays.col.push(col[0], col[1], col[2]);
  arrays.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

export function newArrays() {
  return { pos: [], nrm: [], uv: [], col: [], idx: [] };
}

import { tileUV } from './textures.js';

// A quad with explicit per-corner UVs (uv8 = [u0,v0, u1,v0, u1,v1, u0,v1]).
function quadUV(arrays, p, n, uv8, col) {
  const base = arrays.pos.length / 3;
  for (const v of p) arrays.pos.push(v[0], v[1], v[2]);
  for (let i = 0; i < 4; i++) arrays.nrm.push(n[0], n[1], n[2]);
  arrays.uv.push(uv8[0], uv8[1], uv8[2], uv8[3], uv8[4], uv8[5], uv8[6], uv8[7]);
  for (let i = 0; i < 4; i++) arrays.col.push(col[0], col[1], col[2]);
  arrays.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

// Emit a face subdivided into (nu x nv) cells, each cell sampling the
// whole tile once. An atlas cannot repeat a sub-rect by stretching UVs
// (that samples neighbouring tiles), so subdivision is how a 70 m tower
// keeps its windows small instead of stretching one facade over it.
// p: the face's four corners in order; n: face normal; swapUV rotates
// the texture 90 degrees (for road tops running along x).
function faceGrid(arrays, p, n, tile, tint, nu, nv, swapUV = false) {
  const [u0, v0, u1, v1] = tileUV(tile);
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const at = (fu, fv) => {
    const bot = lerp3(p[0], p[1], fu);
    const top = lerp3(p[3], p[2], fu);
    return lerp3(bot, top, fv);
  };
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const corners = [at(i / nu, j / nv), at((i + 1) / nu, j / nv), at((i + 1) / nu, (j + 1) / nv), at(i / nu, (j + 1) / nv)];
      const uv = swapUV
        ? [u0, v1, u0, v0, u1, v0, u1, v1]
        : [u0, v0, u1, v0, u1, v1, u0, v1];
      quadUV(arrays, corners, n, uv, tint);
    }
  }
}

// A box centred at (cx, cy, cz) with size (sx, sy, sz). tile is the atlas
// tile for the sides; topTile overrides the top face (roofs); topSwap
// rotates the top-face texture (horizontal roads). One tile spans about
// 16 m, so every face is subdivided to keep the texture dense.
export function pushBox(arrays, cx, cy, cz, sx, sy, sz, tile, tint, topTile = null, topSwap = false) {
  const TILE_M = 16;
  const [tu0, tv0, tu1, tv1] = tileUV(topTile ?? tile);
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const grid = (w, h) => [Math.max(1, Math.round(w / TILE_M)), Math.max(1, Math.round(h / TILE_M))];
  const [gx, gy] = grid(sz, sy); // +x / -x faces
  const [gzx, gzy] = grid(sx, sy); // +z / -z faces
  const [gtx, gtz] = grid(sx, sz); // top face
  faceGrid(arrays, [[cx + hx, cy - hy, cz - hz], [cx + hx, cy - hy, cz + hz], [cx + hx, cy + hy, cz + hz], [cx + hx, cy + hy, cz - hz]], [1, 0, 0], tile, tint, gx, gy);
  faceGrid(arrays, [[cx - hx, cy - hy, cz + hz], [cx - hx, cy - hy, cz - hz], [cx - hx, cy + hy, cz - hz], [cx - hx, cy + hy, cz + hz]], [-1, 0, 0], tile, tint, gx, gy);
  faceGrid(arrays, [[cx - hx, cy - hy, cz + hz], [cx + hx, cy - hy, cz + hz], [cx + hx, cy + hy, cz + hz], [cx - hx, cy + hy, cz + hz]], [0, 0, 1], tile, tint, gzx, gzy);
  faceGrid(arrays, [[cx + hx, cy - hy, cz - hz], [cx - hx, cy - hy, cz - hz], [cx - hx, cy + hy, cz - hz], [cx + hx, cy + hy, cz - hz]], [0, 0, -1], tile, tint, gzx, gzy);
  faceGrid(arrays, [[cx - hx, cy + hy, cz - hz], [cx + hx, cy + hy, cz - hz], [cx + hx, cy + hy, cz + hz], [cx - hx, cy + hy, cz + hz]], [0, 1, 0], topTile ?? tile, tint, gtx, gtz, topSwap);
  quad(arrays, [[cx - hx, cy - hy, cz + hz], [cx + hx, cy - hy, cz + hz], [cx + hx, cy - hy, cz - hz], [cx - hx, cy - hy, cz - hz]], [0, -1, 0], [tu0, tv0, tu1, tv1], tint);
}

// A cylinder. axis 'y' is vertical (tower, trunk, pole); 'x' makes the
// axis run along x (a wheel); 'z' along z (an exhaust pipe). The side is
// banded vertically so each band samples the whole tile once.
export function pushCyl(arrays, cx, cy, cz, radius, height, tile, tint, segments = 12, axis = 'y') {
  const [u0, v0, u1, v1] = tileUV(tile);
  const y0 = cy - height / 2;
  const y1 = cy + height / 2;
  // Rotate a point built for a Y-axis cylinder onto the requested axis.
  const rot = (x, y, z) => {
    if (axis === 'x') return [y, -x, z];
    if (axis === 'z') return [x, z, -y];
    return [x, y, z];
  };
  // Side faces, built in local Y-axis space then rotated onto the axis.
  const put = (lx, ly, lz, nx, ny, nz, uu, vv) => {
    const [px, py, pz] = rot(lx, ly, lz);
    const [qx, qy, qz] = rot(nx, ny, nz);
    arrays.pos.push(cx + px, cy + py, cz + pz);
    arrays.nrm.push(qx, qy, qz);
    arrays.uv.push(uu, vv);
    arrays.col.push(tint[0], tint[1], tint[2]);
  };
  const bands = Math.max(1, Math.round(height / 14));
  for (let b = 0; b < bands; b++) {
    const yb0 = -height / 2 + (height * b) / bands;
    const yb1 = -height / 2 + (height * (b + 1)) / bands;
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const x0 = Math.cos(a0) * radius;
      const z0 = Math.sin(a0) * radius;
      const x1 = Math.cos(a1) * radius;
      const z1 = Math.sin(a1) * radius;
      const uu0 = u0 + (u1 - u0) * (i / segments);
      const uu1 = u0 + (u1 - u0) * ((i + 1) / segments);
      const base = arrays.pos.length / 3;
      put(x0, yb0, z0, Math.cos(a0), 0, Math.sin(a0), uu0, v0);
      put(x1, yb0, z1, Math.cos(a1), 0, Math.sin(a1), uu1, v0);
      put(x1, yb1, z1, Math.cos(a1), 0, Math.sin(a1), uu1, v1);
      put(x0, yb1, z0, Math.cos(a0), 0, Math.sin(a0), uu0, v1);
      // Winding reversed vs the corner order so the outside faces outward.
      arrays.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }
  // Top cap (fan around centre), in local space too.
  const topBase = arrays.pos.length / 3;
  put(0, y1 - cy, 0, 0, 1, 0, (u0 + u1) / 2, (v0 + v1) / 2);
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const bi = arrays.pos.length / 3;
    put(Math.cos(a0) * radius, y1 - cy, Math.sin(a0) * radius, 0, 1, 0,
      u0 + (u1 - u0) * (0.5 + 0.5 * Math.cos(a0)), v0 + (v1 - v0) * (0.5 + 0.5 * Math.sin(a0)));
    put(Math.cos(a1) * radius, y1 - cy, Math.sin(a1) * radius, 0, 1, 0,
      u0 + (u1 - u0) * (0.5 + 0.5 * Math.cos(a1)), v0 + (v1 - v0) * (0.5 + 0.5 * Math.sin(a1)));
    arrays.idx.push(topBase, bi + 1, bi);
  }
}

// A prism: a closed 2D profile in the (z, y) plane, extruded across the
// width (x). Used for sloped car hoods, trunks and cabins so a car reads
// as shaped metal instead of a slab. profile: [[z, y], ...] clockwise.
export function pushPrism(arrays, cx, cy, cz, width, profile, tile, tint) {
  const [u0, v0, u1, v1] = tileUV(tile);
  const hw = width / 2;
  // Side faces: one quad per profile edge. The profile is clockwise in
  // the (z, y) plane, so the outward normal of edge (dz, dy) is
  // (n_y, n_z) = (dz, -dy) / len, and the corners run end -> start so the
  // winding faces outward.
  for (let i = 0; i < profile.length; i++) {
    const [z0, y0] = profile[i];
    const [z1, y1] = profile[(i + 1) % profile.length];
    const dz = z1 - z0;
    const dy = y1 - y0;
    const len = Math.hypot(dz, dy) || 1;
    const n = [0, dz / len, -dy / len];
    quad(arrays,
      [[cx - hw, cy + y1, cz + z1], [cx + hw, cy + y1, cz + z1], [cx + hw, cy + y0, cz + z0], [cx - hw, cy + y0, cz + z0]],
      n, [u0, v0, u1, v1], tint);
  }
  // End caps at x = +/-hw (triangle fan from the profile centroid).
  let czm = 0, cym = 0;
  for (const [z, y] of profile) { czm += z; cym += y; }
  czm /= profile.length; cym /= profile.length;
  for (const side of [-1, 1]) {
    const base = arrays.pos.length / 3;
    arrays.pos.push(cx + side * hw, cy + cym, cz + czm);
    arrays.nrm.push(side, 0, 0);
    arrays.uv.push((u0 + u1) / 2, (v0 + v1) / 2);
    arrays.col.push(tint[0], tint[1], tint[2]);
    for (let i = 0; i < profile.length; i++) {
      const [z0, y0] = profile[i];
      const [z1, y1] = profile[(i + 1) % profile.length];
      const bi = arrays.pos.length / 3;
      arrays.pos.push(cx + side * hw, cy + y0, cz + z0);
      arrays.nrm.push(side, 0, 0);
      arrays.uv.push(u0, v0);
      arrays.col.push(tint[0], tint[1], tint[2]);
      arrays.pos.push(cx + side * hw, cy + y1, cz + z1);
      arrays.nrm.push(side, 0, 0);
      arrays.uv.push(u1, v1);
      arrays.col.push(tint[0], tint[1], tint[2]);
      if (side === 1) arrays.idx.push(base, bi, bi + 1);
      else arrays.idx.push(base, bi + 1, bi);
    }
  }
}

// ---- Renderer ------------------------------------------------------------

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('shader compile: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

function linkProgram(gl, vsSrc, fsSrc) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('program link: ' + gl.getProgramInfoLog(prog));
  }
  return prog;
}

function uploadTexture(gl, canvas) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.generateMipmap(gl.TEXTURE_2D);
  return tex;
}

// Time-of-day palette keyframes. dayT: 0 dawn, 0.25 midday, 0.72 sunset,
// 0.9 night. Each entry: zenith, horizon, fog, sun colour, sun elevation
// (radians above horizon), sun azimuth, ambient, light intensity, night
// factor (0 day .. 1 night, drives window glow and lamp halos).
const DAY_KEYS = [
  { t: 0.0, zen: [0.30, 0.36, 0.55], hor: [1.0, 0.70, 0.48], fog: [0.85, 0.62, 0.5], sun: [1.0, 0.62, 0.3], el: 0.10, az: 1.35, amb: 0.5, li: 0.7, night: 0.35 },
  { t: 0.25, zen: [0.24, 0.49, 0.76], hor: [0.74, 0.85, 0.91], fog: [0.72, 0.80, 0.85], sun: [1.0, 0.95, 0.75], el: 1.05, az: 0.9, amb: 0.75, li: 1.0, night: 0 },
  { t: 0.5, zen: [0.24, 0.49, 0.76], hor: [0.74, 0.85, 0.91], fog: [0.72, 0.80, 0.85], sun: [1.0, 0.95, 0.75], el: 0.9, az: 2.2, amb: 0.75, li: 1.0, night: 0 },
  { t: 0.72, zen: [0.16, 0.16, 0.37], hor: [1.0, 0.48, 0.24], fog: [0.88, 0.54, 0.35], sun: [1.0, 0.60, 0.18], el: 0.12, az: 2.9, amb: 0.52, li: 0.75, night: 0.25 },
  { t: 0.85, zen: [0.05, 0.07, 0.16], hor: [0.35, 0.22, 0.28], fog: [0.28, 0.20, 0.26], sun: [1.0, 0.45, 0.2], el: -0.05, az: 3.1, amb: 0.38, li: 0.35, night: 0.75 },
  { t: 0.95, zen: [0.02, 0.04, 0.09], hor: [0.06, 0.10, 0.20], fog: [0.05, 0.08, 0.15], sun: [0.87, 0.91, 1.0], el: 0.55, az: 4.2, amb: 0.30, li: 0.25, night: 1 },
  { t: 1.0, zen: [0.30, 0.36, 0.55], hor: [1.0, 0.70, 0.48], fog: [0.85, 0.62, 0.5], sun: [1.0, 0.62, 0.3], el: 0.10, az: 1.35, amb: 0.5, li: 0.7, night: 0.35 },
];

export function dayPalette(dayT) {
  let a = DAY_KEYS[0];
  let b = DAY_KEYS[DAY_KEYS.length - 1];
  for (let i = 0; i < DAY_KEYS.length - 1; i++) {
    if (dayT >= DAY_KEYS[i].t && dayT <= DAY_KEYS[i + 1].t) {
      a = DAY_KEYS[i];
      b = DAY_KEYS[i + 1];
      break;
    }
  }
  const span = b.t - a.t || 1;
  const f = Math.min(1, Math.max(0, (dayT - a.t) / span));
  const mix = (x, y) => x + (y - x) * f;
  const mix3 = (x, y) => [mix(x[0], y[0]), mix(x[1], y[1]), mix(x[2], y[2])];
  const sunDir = [
    Math.cos(a.el + (b.el - a.el) * f) * Math.cos(mix(a.az, b.az, f)),
    Math.sin(a.el + (b.el - a.el) * f),
    Math.cos(a.el + (b.el - a.el) * f) * Math.sin(mix(a.az, b.az, f)),
  ];
  return {
    zenith: mix3(a.zen, b.zen),
    horizon: mix3(a.hor, b.hor),
    fog: mix3(a.fog, b.fog),
    sunColor: mix3(a.sun, b.sun),
    sunDir,
    ambient: mix(a.amb, b.amb, f),
    lightI: mix(a.li, b.li, f),
    night: mix(a.night, b.night, f),
  };
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL not available');
    this.gl = gl;
    this.prog = linkProgram(gl, VERT, FRAG);
    this.spriteProg = linkProgram(gl, SPRITE_VERT, SPRITE_FRAG);
    this.skyProg = linkProgram(gl, SKY_VERT, SKY_FRAG);
    this.meshes = new Map();
    this.carMeshes = new Map();
    this.pedMeshes = new Map();
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }

  setTextures(atlasCanvas, glowCanvas, blobCanvas) {
    const gl = this.gl;
    this.atlasTex = uploadTexture(gl, atlasCanvas);
    this.glowTex = uploadTexture(gl, glowCanvas);
    this.blobTex = uploadTexture(gl, blobCanvas);
    // Fullscreen sky triangle.
    this.skyVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    // Sprite quad buffer (positions filled per sprite).
    this.spriteVbo = gl.createBuffer();
    this.spriteUvbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteUvbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);
    this.spriteIbo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.spriteIbo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  }

  uploadMesh(name, arrays) {
    const gl = this.gl;
    const mesh = {
      count: arrays.idx.length,
      vbo: gl.createBuffer(),
      nbo: gl.createBuffer(),
      uvbo: gl.createBuffer(),
      cbo: gl.createBuffer(),
      ibo: gl.createBuffer(),
    };
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrays.pos), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.nbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrays.nrm), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrays.uv), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.cbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrays.col), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(arrays.idx), gl.STATIC_DRAW);
    this.meshes.set(name, mesh);
    return mesh;
  }
}

// ---- Static city ---------------------------------------------------------

Renderer.prototype.buildStaticCity = function (city) {
  const solid = newArrays();
  const glow = newArrays(); // facades: emissive at night so windows shine
  // Ground: road strips (vertical + horizontal), block sidewalks, beach, sea.
  // Roads first at y=0, sidewalks slightly raised to avoid z-fighting.
  for (let i = 0; i <= 8; i++) {
    const x = -320 + i * 80;
    pushBox(solid, x, -0.05, 0, 16, 0.1, 496, 3, [1, 1, 1]);
  }
  for (let j = 0; j <= 6; j++) {
    const z = -240 + j * 80;
    pushBox(solid, 0, -0.05, z, 656, 0.1, 16, 3, [1, 1, 1], null, true);
  }
  // Beach sand + sea.
  pushBox(solid, 349, 0.0, 0, 34, 0.12, 560, 5, [1, 1, 1]);
  pushBox(solid, 463, -0.02, 0, 194, 0.1, 560, 6, [1, 1, 1]);
  // Blocks: sidewalk slabs (some plaza, some grass) at y=0.06.
  for (let col = 0; col < 8; col++) {
    for (let row = 0; row < 6; row++) {
      const x0 = -320 + col * 80 + 8;
      const z0 = -240 + row * 80 + 8;
      const tile = (col * 7 + row * 3) % 9 === 0 ? 9 : ((col + row) % 5 === 0 ? 10 : 4);
      pushBox(solid, x0 + 32, 0.06, z0 + 32, 64, 0.12, 64, tile, [1, 1, 1]);
    }
  }
  // Buildings: facades into the glow mesh (night emissive), roofs + setbacks
  // into the solid mesh. Texture repeats scale with height so windows stay
  // small even on a 70 m tower.
  for (const b of city.buildings) {
    if (b.kind === 'cyl') {
      pushCyl(glow, b.x, b.h / 2, b.z, b.w / 2, b.h, b.tile, b.tint, 16);
      pushCyl(solid, b.x, b.h + 0.05, b.z, b.w / 2, 0.3, 7, [1, 1, 1], 16);
    } else {
      pushBox(glow, b.x, b.h / 2, b.z, b.w, b.h, b.d, b.tile, b.tint);
      pushBox(solid, b.x, b.h + 0.05, b.z, b.w, 0.3, b.d, 7, [0.9, 0.9, 0.9]);
      // Roof plant: AC boxes on taller buildings.
      if (b.h > 18) {
        pushBox(solid, b.x - b.w / 5, b.h + 0.8, b.z, 5, 1.4, 4, 7, [0.55, 0.55, 0.58]);
        pushBox(solid, b.x + b.w / 5, b.h + 0.7, b.z + b.d / 6, 3.5, 1.2, 3, 7, [0.5, 0.5, 0.53]);
      }
      if (b.setback) {
        const sw = b.w * 0.55, sd = b.d * 0.55, sh = b.h * 0.22;
        pushBox(glow, b.x, b.h + sh / 2, b.z, sw, sh, sd, b.tile, b.tint);
        pushBox(solid, b.x, b.h + sh + 0.05, b.z, sw, 0.3, sd, 7, [0.9, 0.9, 0.9]);
      }
    }
  }
  // Marina docks + yachts.
  for (const d of city.docks) {
    pushBox(solid, d.x + d.len / 2, 0.35, d.z, d.len, 0.5, 5, 11, [1, 1, 1]);
    for (let px = 0; px < d.len; px += 8) {
      pushCyl(solid, d.x + px + 4, -0.2, d.z + 2, 0.5, 1.6, 12, [0.4, 0.35, 0.3], 6);
    }
  }
  for (const y of city.yachts) {
    const hull = newArrays();
    pushPrism(hull, 0, 0.6, 0, y.len * 0.45, [[-y.len / 2, 0], [y.len / 2 - 1.5, 0], [y.len / 2, 0.9], [-y.len / 2 + 1, 0.9]], 12, y.hull);
    pushBox(hull, 0, 1.6, -0.5, y.len * 0.32, 1.2, y.len * 0.3, 12, [0.95, 0.95, 0.97]);
    pushCyl(hull, 0, 3.4, 0, 0.12, 4.5, 12, [0.8, 0.8, 0.85], 6);
    this.uploadMesh('yacht' + y.x + '_' + y.z, hull);
    this.yachtTransforms = this.yachtTransforms || [];
    this.yachtTransforms.push({ x: y.x, z: y.z, yaw: y.angle, mesh: 'yacht' + y.x + '_' + y.z });
  }
  // Palms: trunk + 5 crossed frond blades.
  for (const p of city.palms) {
    pushCyl(solid, p.x, 2.2, p.z, 0.22, 4.4, 12, [0.45, 0.32, 0.2], 6);
    for (let f = 0; f < 5; f++) {
      const a = (f / 5) * Math.PI * 2 + 0.4;
      const fx = Math.cos(a), fz = Math.sin(a);
      const tip = [p.x + fx * 2.4, 4.0, p.z + fz * 2.4];
      const mid = [p.x + fx * 1.3, 4.9, p.z + fz * 1.3];
      const top = [p.x, 4.4, p.z];
      const near = [p.x + fx * 0.4, 4.15, p.z + fz * 0.4];
      // Fronds are thin: emit both windings so they read from every side.
      quad(solid, [top, mid, tip, near], [0, 1, 0], tileUV(9), [0.25, 0.5, 0.2]);
      quad(solid, [near, tip, mid, top], [0, 1, 0], tileUV(9), [0.25, 0.5, 0.2]);
    }
  }
  // Streetlight poles (heads glow via sprites at night, see render()).
  for (const l of city.lamps) {
    pushCyl(solid, l.x, 2.6, l.z, 0.09, 5.2, 12, [0.25, 0.25, 0.28], 6);
    pushBox(solid, l.x + l.arm * 1.1, 5.1, l.z, 2.2, 0.12, 0.12, 12, [0.25, 0.25, 0.28]);
    pushBox(solid, l.x + l.arm * 2.0, 5.0, l.z, 0.7, 0.18, 0.3, 12, [0.9, 0.85, 0.6]);
  }
  this.uploadMesh('citySolid', solid);
  this.uploadMesh('cityGlow', glow);
  this.city = city;
};

// ---- Dynamic meshes ------------------------------------------------------
// Cars are built from prisms so the hood and trunk slope and the rear
// carries a light bar, bumper and exhausts instead of a flat slab.

Renderer.prototype.carMesh = function (color, opts = {}) {
  const key = color.join(',') + '|' + (opts.cop ? 'cop' : '') + '|' + (opts.sport ? 'sport' : '');
  if (this.carMeshes.has(key)) return this.carMeshes.get(key);
  const a = newArrays();
  const body = color;
  const dark = [0.08, 0.08, 0.1];
  const glass = [0.12, 0.18, 0.24];
  // Chassis + sloped hood (front +z) + sloped trunk (rear -z).
  pushBox(a, 0, 0.62, 0, 1.9, 0.5, 4.4, 12, body);
  pushPrism(a, 0, 0.62, 0, 1.86, [[1.1, 0.28], [2.2, 0.28], [2.2, -0.1], [1.1, -0.25]], 12, body); // hood
  pushPrism(a, 0, 0.62, 0, 1.86, [[-2.2, 0.28], [-1.1, 0.28], [-1.1, -0.25], [-2.2, -0.08]], 12, body); // trunk
  // Cabin with sloped windshield and rear window.
  pushPrism(a, 0, 0.62, 0, 1.7, [[-1.15, 0.28], [-0.55, 1.05], [0.55, 1.05], [1.15, 0.28]], 12, glass);
  pushBox(a, 0, 1.18, 0, 1.66, 0.14, 1.9, 12, body); // roof panel
  // Rear: full-width taillight bar, bumper, twin exhausts, spoiler.
  pushBox(a, 0, 0.72, -2.21, 1.7, 0.16, 0.06, 12, [0.85, 0.05, 0.08]); // taillight bar
  pushBox(a, 0, 0.42, -2.24, 1.84, 0.22, 0.1, 12, dark); // rear bumper
  pushBox(a, 0, 0.42, 2.24, 1.84, 0.22, 0.1, 12, dark); // front bumper
  pushCyl(a, -0.55, 0.38, -2.26, 0.09, 0.3, 12, [0.6, 0.6, 0.62], 8, 'z');
  pushCyl(a, 0.55, 0.38, -2.26, 0.09, 0.3, 12, [0.6, 0.6, 0.62], 8, 'z');
  if (opts.sport) pushBox(a, 0, 1.02, -2.05, 1.7, 0.07, 0.35, 12, dark); // spoiler
  // Headlights: pale emissive quads on the nose.
  pushBox(a, -0.6, 0.78, 2.21, 0.42, 0.14, 0.05, 12, [1.0, 0.95, 0.75]);
  pushBox(a, 0.6, 0.78, 2.21, 0.42, 0.14, 0.05, 12, [1.0, 0.95, 0.75]);
  // Wheels: dark tyres with light hubs so they read on dark asphalt.
  const wheelPos = [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]];
  for (const [wx, wz] of wheelPos) {
    pushCyl(a, wx, 0.36, wz, 0.36, 0.26, 12, [0.05, 0.05, 0.06], 10, 'x');
    pushCyl(a, wx + (wx < 0 ? -0.14 : 0.14), 0.36, wz, 0.2, 0.05, 12, [0.75, 0.75, 0.78], 10, 'x');
  }
  if (opts.cop) {
    // Black-and-white cruiser livery + light bar.
    pushBox(a, 0, 0.9, 0, 1.92, 0.06, 4.42, 12, [0.95, 0.95, 0.95]);
    pushBox(a, -0.35, 1.32, -0.1, 0.5, 0.16, 0.3, 12, [0.9, 0.05, 0.1]);
    pushBox(a, 0.35, 1.32, -0.1, 0.5, 0.16, 0.3, 12, [0.1, 0.2, 0.9]);
  }
  const mesh = this.uploadMesh('car:' + key, a);
  this.carMeshes.set(key, mesh);
  return mesh;
};

// Pedestrian: torso, head, hair, legs, arms — colours vary per person so
// the crowd is not a row of identical capsules.
Renderer.prototype.pedMesh = function (cfg) {
  const key = JSON.stringify(cfg);
  if (this.pedMeshes.has(key)) return this.pedMeshes.get(key);
  const a = newArrays();
  const h = cfg.height || 1.75;
  const s = h / 1.75;
  pushBox(a, -0.11, 0.42 * s, 0, 0.16, 0.84 * s, 0.18, 12, cfg.pants);
  pushBox(a, 0.11, 0.42 * s, 0, 0.16, 0.84 * s, 0.18, 12, cfg.pants);
  pushBox(a, 0, 1.12 * s, 0, 0.46, 0.62 * s, 0.26, 12, cfg.shirt);
  pushBox(a, -0.29, 1.1 * s, 0, 0.12, 0.55 * s, 0.14, 12, cfg.shirt);
  pushBox(a, 0.29, 1.1 * s, 0, 0.12, 0.55 * s, 0.14, 12, cfg.shirt);
  pushBox(a, 0, 1.62 * s, 0, 0.24, 0.24, 0.24, 12, cfg.skin);
  pushBox(a, 0, 1.76 * s, 0, 0.26, 0.1, 0.26, 12, cfg.hair);
  if (cfg.hat) pushCyl(a, 0, 1.82 * s, 0, 0.2, 0.06, 12, cfg.hat, 8);
  if (cfg.bag) pushBox(a, 0, 1.12 * s, -0.2, 0.3, 0.4, 0.12, 12, cfg.bag);
  if (cfg.dress) pushPrism(a, 0, 0.5 * s, 0, 0.5, [[-0.3, 0], [0.3, 0], [0.22, 0.9], [-0.22, 0.9]], 12, cfg.shirt);
  const mesh = this.uploadMesh('ped:' + key, a);
  this.pedMeshes.set(key, mesh);
  return mesh;
};

// Police helicopter: body, tail, skids, spinning rotor (rotor drawn as a
// separate thin mesh the caller rotates).
Renderer.prototype.heliMesh = function () {
  if (this.meshes.has('heli')) return this.meshes.get('heli');
  const a = newArrays();
  pushBox(a, 0, 0, 0, 1.8, 1.1, 3.2, 12, [0.1, 0.12, 0.16]);
  pushBox(a, 0, 0.1, -2.6, 0.5, 0.5, 2.6, 12, [0.1, 0.12, 0.16]);
  pushBox(a, 0, 0.45, -3.8, 0.2, 1.1, 0.5, 12, [0.1, 0.12, 0.16]);
  pushBox(a, 0, -0.65, 0.6, 1.4, 0.12, 0.4, 12, [0.2, 0.2, 0.22]);
  pushBox(a, 0, -0.65, -0.6, 1.4, 0.12, 0.4, 12, [0.2, 0.2, 0.22]);
  pushBox(a, 0, 0.45, 0.9, 1.2, 0.5, 1.0, 12, [0.15, 0.3, 0.45]); // canopy
  pushBox(a, -0.5, 0.62, 0.2, 0.3, 0.12, 0.3, 12, [0.9, 0.05, 0.1]); // beacon
  const mesh = this.uploadMesh('heli', a);
  const r = newArrays();
  pushBox(r, 0, 0, 0, 7.5, 0.06, 0.35, 12, [0.3, 0.3, 0.33]);
  this.uploadMesh('heliRotor', r);
  return mesh;
};

// ---- Frame rendering -----------------------------------------------------

import { mulberry32 } from './random.js';

const STARS = (() => {
  const rng = mulberry32(424242);
  const out = [];
  for (let i = 0; i < 90; i++) {
    const a = rng() * Math.PI * 2;
    const e = 0.15 + rng() * 1.1;
    out.push([Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a), 0.5 + rng() * 1.5]);
  }
  return out;
})();

Renderer.prototype.beginFrame = function (dayT, eye, target) {
  const gl = this.gl;
  const pal = dayPalette(dayT);
  this.palette = pal;
  this.eye = eye;
  const aspect = this.canvas.width / this.canvas.height;
  this.proj = mat4Perspective((62 * Math.PI) / 180, aspect, 0.1, 1500);
  this.view = mat4LookAt(eye, target, [0, 1, 0]);
  this.viewProj = mat4Multiply(this.proj, this.view);
  // Camera basis for billboards (rows of the view matrix).
  this.camRight = [this.view[0], this.view[4], this.view[8]];
  this.camUp = [this.view[1], this.view[5], this.view[9]];
  gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  gl.clearColor(pal.fog[0], pal.fog[1], pal.fog[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  // Sky gradient triangle (no depth).
  gl.disable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.useProgram(this.skyProg);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.skyVbo);
  const aPos = gl.getAttribLocation(this.skyProg, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.uniform3fv(gl.getUniformLocation(this.skyProg, 'uZenith'), pal.zenith);
  gl.uniform3fv(gl.getUniformLocation(this.skyProg, 'uHorizon'), pal.horizon);
  gl.uniform3fv(gl.getUniformLocation(this.skyProg, 'uSunDir'), pal.sunDir);
  gl.uniform3fv(gl.getUniformLocation(this.skyProg, 'uSunColor'), pal.sunColor);
  gl.uniform1f(gl.getUniformLocation(this.skyProg, 'uSunSize'), 1 - pal.night * 0.7);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.depthMask(true);
  gl.enable(gl.DEPTH_TEST);
  // Main program shared uniforms.
  gl.useProgram(this.prog);
  gl.uniformMatrix4fv(gl.getUniformLocation(this.prog, 'uView'), false, this.view);
  gl.uniformMatrix4fv(gl.getUniformLocation(this.prog, 'uProj'), false, this.proj);
  gl.uniform3fv(gl.getUniformLocation(this.prog, 'uLightDir'), pal.sunDir);
  gl.uniform1f(gl.getUniformLocation(this.prog, 'uLightI'), pal.lightI);
  gl.uniform3f(gl.getUniformLocation(this.prog, 'uAmbient'), pal.ambient, pal.ambient, pal.ambient);
  gl.uniform3fv(gl.getUniformLocation(this.prog, 'uFogColor'), pal.fog);
  gl.uniform1f(gl.getUniformLocation(this.prog, 'uFogDensity'), 0.0016);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
  gl.uniform1i(gl.getUniformLocation(this.prog, 'uTex'), 0);
  // Sun / moon billboard + stars, far out so buildings occlude them.
  const sunSize = 150 + (1 - pal.night) * 90 + (pal.night > 0.2 && pal.night < 0.8 ? 60 : 0);
  const sunPos = [
    eye[0] + pal.sunDir[0] * 900,
    eye[1] + Math.max(20, pal.sunDir[1] * 900),
    eye[2] + pal.sunDir[2] * 900,
  ];
  this.drawSprite(sunPos[0], sunPos[1], sunPos[2], sunSize, pal.sunColor, 0.95, this.glowTex, true);
  if (pal.night > 0.35) {
    for (const [sx, sy, sz, ss] of STARS) {
      this.drawSprite(eye[0] + sx * 850, eye[1] + sy * 850, eye[2] + sz * 850, ss * 3, [1, 1, 1], pal.night * 0.8, this.glowTex, true);
    }
  }
};

Renderer.prototype.bindMesh = function (mesh) {
  const gl = this.gl;
  const prog = this.prog;
  // Bind by attribute NAME with its component count: the linker is free
  // to assign locations in any order, so guessing from the location
  // number scrambles UVs and colours.
  const bind = (buf, name, size) => {
    const loc = gl.getAttribLocation(prog, name);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  };
  bind(mesh.vbo, 'aPos', 3);
  bind(mesh.nbo, 'aNormal', 3);
  bind(mesh.uvbo, 'aUV', 2);
  bind(mesh.cbo, 'aColor', 3);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
};

Renderer.prototype.drawMesh = function (mesh, model, emissive = 0) {
  const gl = this.gl;
  gl.useProgram(this.prog);
  // Re-bind the atlas: sprite draws between mesh draws leave the glow
  // texture bound to unit 0, which would wash every facade white.
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
  gl.uniformMatrix4fv(gl.getUniformLocation(this.prog, 'uModel'), false, model);
  gl.uniform1f(gl.getUniformLocation(this.prog, 'uEmissive'), emissive);
  this.bindMesh(mesh);
  gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
};

Renderer.prototype.drawStatic = function () {
  const pal = this.palette;
  const nightGlow = pal.night * 0.85;
  this.drawMesh(this.meshes.get('citySolid'), mat4Identity(), 0);
  this.drawMesh(this.meshes.get('cityGlow'), mat4Identity(), nightGlow);
  if (this.yachtTransforms) {
    for (const y of this.yachtTransforms) {
      this.drawMesh(this.meshes.get(y.mesh), mat4Model(y.x, 0.4, y.z, y.yaw), 0);
    }
  }
};

// A camera-facing quad with the glow/blob texture.
Renderer.prototype.drawSprite = function (x, y, z, size, tint, alpha, tex, additive = false) {
  const gl = this.gl;
  const r = this.camRight;
  const u = this.camUp;
  const hs = size / 2;
  const corners = [
    [x - r[0] * hs - u[0] * hs, y - r[1] * hs - u[1] * hs, z - r[2] * hs - u[2] * hs],
    [x + r[0] * hs - u[0] * hs, y + r[1] * hs - u[1] * hs, z + r[2] * hs - u[2] * hs],
    [x + r[0] * hs + u[0] * hs, y + r[1] * hs + u[1] * hs, z + r[2] * hs + u[2] * hs],
    [x - r[0] * hs + u[0] * hs, y - r[1] * hs + u[1] * hs, z - r[2] * hs + u[2] * hs],
  ];
  this.drawTexturedQuad(corners, tint, alpha, tex, additive);
};

// A vertical billboard (mission beacon, light pillar): faces the camera
// around the Y axis, spans y0..y1 at world (x, z).
Renderer.prototype.drawVerticalBillboard = function (x, z, y0, y1, width, tint, alpha, tex) {
  const r = this.camRight;
  const hw = width / 2;
  const corners = [
    [x - r[0] * hw, y0, z - r[2] * hw],
    [x + r[0] * hw, y0, z + r[2] * hw],
    [x + r[0] * hw, y1, z + r[2] * hw],
    [x - r[0] * hw, y1, z - r[2] * hw],
  ];
  this.drawTexturedQuad(corners, tint, alpha, tex, true);
};

Renderer.prototype.drawTexturedQuad = function (corners, tint, alpha, tex, additive) {
  const gl = this.gl;
  gl.useProgram(this.spriteProg);
  gl.uniformMatrix4fv(gl.getUniformLocation(this.spriteProg, 'uView'), false, this.view);
  gl.uniformMatrix4fv(gl.getUniformLocation(this.spriteProg, 'uProj'), false, this.proj);
  gl.uniform3fv(gl.getUniformLocation(this.spriteProg, 'uTint'), tint);
  gl.uniform1f(gl.getUniformLocation(this.spriteProg, 'uAlpha'), alpha);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(gl.getUniformLocation(this.spriteProg, 'uTex'), 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteVbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(corners.flat()), gl.DYNAMIC_DRAW);
  const aPos = gl.getAttribLocation(this.spriteProg, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteUvbo);
  const aUV = gl.getAttribLocation(this.spriteProg, 'aUV');
  gl.enableVertexAttribArray(aUV);
  gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.spriteIbo);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
};

// Soft contact shadow: a dark blob lying flat on the ground.
Renderer.prototype.drawBlobShadow = function (x, z, rx, rz, alpha = 0.55) {
  const corners = [
    [x - rx, 0.09, z - rz],
    [x + rx, 0.09, z - rz],
    [x + rx, 0.09, z + rz],
    [x - rx, 0.09, z + rz],
  ];
  this.drawTexturedQuad(corners, [0, 0, 0], alpha, this.blobTex, false);
};
