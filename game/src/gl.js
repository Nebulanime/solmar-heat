// Hand-written WebGL renderer for SOLMAR HEAT: no library, no texture files.
// One world shader (per-vertex colour + directional sun + fog + emissive windows),
// one sky shader (sunset gradient + sun disc), and a geometry builder that pushes
// boxes and quads into flat arrays the GPU draws in a single call per buffer.
import { mat4Identity, mat4Multiply, mat4Perspective, mat4LookAt } from './math3.js';

const WORLD_VERT = `
attribute vec3 aPos; attribute vec3 aNorm; attribute vec3 aCol; attribute float aEmi;
uniform mat4 uMVP; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uAmb;
uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar;
varying vec3 vCol; varying float vFog; varying float vEmi;
void main() {
  vec4 wp = uMVP * vec4(aPos, 1.0);
  gl_Position = wp;
  float diff = max(dot(normalize(aNorm), normalize(uSunDir)), 0.0);
  vCol = aCol * (uAmb + diff * uSunCol);
  vEmi = aEmi;
  float dist = max(-wp.z, 0.0);
  vFog = clamp((dist - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
}
`;

const WORLD_FRAG = `
precision mediump float;
uniform vec3 uFogCol;
varying vec3 vCol; varying float vFog; varying float vEmi;
void main() {
  vec3 c = vCol + vec3(vEmi);
  gl_FragColor = vec4(mix(c, uFogCol, vFog), 1.0);
}
`;

const SKY_VERT = `
attribute vec2 aPos; varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.999, 1.0); }
`;

const SKY_FRAG = `
precision mediump float;
uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot; uniform vec2 uSunPos; uniform vec3 uSunCol;
varying vec2 vUv;
void main() {
  vec3 c = vUv.y > 0.62 ? mix(uMid, uTop, (vUv.y - 0.62) / 0.38)
        : vUv.y > 0.30 ? mix(uBot, uMid, (vUv.y - 0.30) / 0.32) : uBot;
  float d = distance(vUv, uSunPos);
  c += uSunCol * (smoothstep(0.16, 0.0, d) * 0.9 + smoothstep(0.34, 0.0, d) * 0.25);
  gl_FragColor = vec4(c, 1.0);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(sh));
  return sh;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  return p;
}

// A flat triangle soup: positions, normals, colours, emissive per vertex.
export class Geom {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.emi = []; }
  get tris() { return this.pos.length / 9; }
  quad(a, b, c, d, n, color, emi) {
    // Two triangles (a b c) and (a c d); normal n shared.
    const vs = [a, b, c, a, c, d];
    for (const v of vs) {
      this.pos.push(v[0], v[1], v[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(color[0], color[1], color[2]);
      this.emi.push(emi);
    }
  }
  // Axis-aligned box centred at (cx, cy, cz) with size (w, h, d). Top face is
  // brightened a touch, side faces shaded, so buildings read in 3D at a glance.
  box(cx, cy, cz, w, h, d, color, emi = 0) {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const top = [Math.min(color[0] * 1.25, 1), Math.min(color[1] * 1.25, 1), Math.min(color[2] * 1.25, 1)];
    const side = [color[0] * 0.85, color[1] * 0.85, color[2] * 0.85];
    this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], top, emi);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], [0, -1, 0], side, emi);
    this.quad([x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [0, 0, 1], color, emi);
    this.quad([x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [0, 0, -1], color, emi);
    this.quad([x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [1, 0, 0], side, emi);
    this.quad([x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [-1, 0, 0], side, emi);
  }
  // A box rotated around Y (cars, palms, peds): corners transformed, faces kept.
  boxRot(cx, cy, cz, w, h, d, angle, color, emi = 0) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const rot = (x, z) => [cx + x * c + z * s, cz - x * s + z * c];
    const hw = w / 2, hd = d / 2, y0 = cy - h / 2, y1 = cy + h / 2;
    const p = (x, y, z) => { const r = rot(x, z); return [r[0], y, r[1]]; };
    const n = (x, z) => [x * c + z * s, 0, -x * s + z * c];
    const top = [Math.min(color[0] * 1.25, 1), Math.min(color[1] * 1.25, 1), Math.min(color[2] * 1.25, 1)];
    this.quad(p(-hw, y1, -hd), p(hw, y1, -hd), p(hw, y1, hd), p(-hw, y1, hd), [0, 1, 0], top, emi);
    this.quad(p(-hw, y0, hd), p(hw, y0, hd), p(hw, y1, hd), p(-hw, y1, hd), n(0, 1), color, emi);
    this.quad(p(hw, y0, -hd), p(-hw, y0, -hd), p(-hw, y1, -hd), p(hw, y1, -hd), n(0, -1), color, emi);
    this.quad(p(hw, y0, hd), p(hw, y0, -hd), p(hw, y1, -hd), p(hw, y1, hd), n(1, 0), color, emi);
    this.quad(p(-hw, y0, -hd), p(-hw, y0, hd), p(-hw, y1, hd), p(-hw, y1, -hd), n(-1, 0), color, emi);
  }
  // A flat quad lying on the ground (y up), for roads, markings, glows.
  groundQuad(x0, z0, x1, z1, y, color, emi = 0) {
    this.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], color, emi);
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
    if (!this.gl) throw new Error('WebGL unavailable');
    const gl = this.gl;
    this.world = program(gl, WORLD_VERT, WORLD_FRAG);
    this.sky = program(gl, SKY_VERT, SKY_FRAG);
    this.u = {};
    for (const n of ['uMVP', 'uSunDir', 'uSunCol', 'uAmb', 'uFogCol', 'uFogNear', 'uFogFar']) this.u[n] = gl.getUniformLocation(this.world, n);
    this.s = {};
    for (const n of ['uTop', 'uMid', 'uBot', 'uSunPos', 'uSunCol']) this.s[n] = gl.getUniformLocation(this.sky, n);
    // Sky fullscreen triangle.
    this.skyBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.staticBuf = { pos: null, nor: null, col: null, emi: null, n: 0 };
    this.dynBuf = { pos: null, nor: null, col: null, emi: null, n: 0 };
    for (const b of [this.staticBuf, this.dynBuf]) {
      b.pos = gl.createBuffer(); b.nor = gl.createBuffer(); b.col = gl.createBuffer(); b.emi = gl.createBuffer();
    }
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }

  upload(buf, geom) {
    const gl = this.gl;
    const bind = (b, arr, size) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
    };
    bind(buf.pos, geom.pos, 3); bind(buf.nor, geom.nor, 3); bind(buf.col, geom.col, 3); bind(buf.emi, geom.emi, 1);
    buf.n = geom.pos.length / 3;
  }

  setStatic(geom) { this.upload(this.staticBuf, geom); }
  setDynamic(geom) { this.upload(this.dynBuf, geom); }

  // Keep the drawing buffer matched to the displayed size (sharp on hidpi).
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
    }
  }

  render(view, time) {
    const gl = this.gl;
    this.resize();
    const w = this.canvas.width, h = this.canvas.height;
    gl.viewport(0, 0, w, h);
    // Sky first, no depth.
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.sky);
    gl.uniform3fv(this.s.uTop, time.skyTop); gl.uniform3fv(this.s.uMid, time.skyMid);
    gl.uniform3fv(this.s.uBot, time.skyBot); gl.uniform3fv(this.s.uSunCol, time.sun);
    gl.uniform2f(this.s.uSunPos, view.sunScreenX, view.sunScreenY);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
    const aPos = gl.getAttribLocation(this.sky, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    // World.
    gl.useProgram(this.world);
    const proj = mat4Perspective(1.15, w / h, 0.5, 900);
    const cam = mat4LookAt(view.eye, view.target, [0, 1, 0]);
    const mvp = mat4Multiply(proj, cam);
    gl.uniformMatrix4fv(this.u.uMVP, false, new Float32Array(mvp));
    const sunDir = [Math.cos(time.sunEl) * Math.cos(time.sunAz), Math.sin(time.sunEl), Math.cos(time.sunEl) * Math.sin(time.sunAz)];
    gl.uniform3fv(this.u.uSunDir, sunDir);
    gl.uniform3fv(this.u.uSunCol, time.sun);
    gl.uniform1f(this.u.uAmb, time.amb);
    gl.uniform3fv(this.u.uFogCol, time.fog);
    gl.uniform1f(this.u.uFogNear, 90);
    gl.uniform1f(this.u.uFogFar, 520);
    for (const buf of [this.staticBuf, this.dynBuf]) {
      if (!buf.n) continue;
      const bind = (b, loc, size) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      };
      bind(buf.pos, gl.getAttribLocation(this.world, 'aPos'), 3);
      bind(buf.nor, gl.getAttribLocation(this.world, 'aNorm'), 3);
      bind(buf.col, gl.getAttribLocation(this.world, 'aCol'), 3);
      bind(buf.emi, gl.getAttribLocation(this.world, 'aEmi'), 1);
      gl.drawArrays(gl.TRIANGLES, 0, buf.n);
    }
  }
}
