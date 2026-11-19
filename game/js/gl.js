// gl.js — hand-rolled WebGL1 renderer core: context, shaders, mesh buffers,
// draw calls. No external library; every triangle in Solmar goes through here.
import { mat4Identity } from './util.js';

const VERT = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec2 aUV;
attribute vec4 aColor;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
varying vec2 vUV;
varying vec4 vColor;
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vNormal = mat3(uModel) * aNormal;
  vUV = aUV;
  vColor = aColor;
  gl_Position = uProj * uView * w;
}`;

const FRAG = `
precision mediump float;
varying vec2 vUV;
varying vec4 vColor;
varying vec3 vNormal;
varying vec3 vWorld;
uniform sampler2D uTex;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uUseTex;
uniform float uEmissive;
uniform float uNoFog;
uniform vec3 uCamPos;
void main() {
  vec4 tex = texture2D(uTex, vUV);
  vec3 base = mix(vColor.rgb, tex.rgb, uUseTex * step(0.001, tex.a));
  if (uUseTex > 0.5 && tex.a < 0.02) discard;
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, normalize(uSunDir)), 0.0);
  vec3 col = base * (uAmbient + uSunColor * diff);
  col += base * uEmissive;
  // warm rim toward the sun for sunset silhouettes (damped on flat ground)
  vec3 viewDir = normalize(uCamPos - vWorld);
  float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
  col += uSunColor * rim * 0.10 * (1.0 - max(n.y, 0.0) * 0.6);
  float d = distance(uCamPos, vWorld);
  float f = clamp((d - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  col = mix(col, uFogColor, f * (1.0 - uNoFog));
  gl_FragColor = vec4(col, vColor.a);
}`;

export function createGL(canvas) {
  const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
  if (!gl) return null;
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, VERT); gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, FRAG); gl.compileShader(fs);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  gl.useProgram(prog);
  const loc = {};
  for (const name of ['uProj','uView','uModel','uTex','uSunDir','uSunColor','uAmbient','uFogColor','uFogNear','uFogFar','uUseTex','uEmissive','uCamPos','uNoFog']) {
    loc[name] = gl.getUniformLocation(prog, name);
  }
  const attrib = {
    aPos: gl.getAttribLocation(prog, 'aPos'),
    aNormal: gl.getAttribLocation(prog, 'aNormal'),
    aUV: gl.getAttribLocation(prog, 'aUV'),
    aColor: gl.getAttribLocation(prog, 'aColor'),
  };
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0.05, 0.06, 0.12, 1);
  return { gl, prog, loc, attrib };
}

export function makeTexture(gl, canvas) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);
  return tex;
}

// A mesh: interleaved vertex buffer (pos3 normal3 uv2 color4 = 12 floats).
export class Mesh {
  constructor(gl, positions, normals, uvs, colors, indices) {
    this.gl = gl;
    const n = positions.length / 3;
    const data = new Float32Array(n * 12);
    for (let i = 0; i < n; i++) {
      data.set(positions.slice(i * 3, i * 3 + 3), i * 12);
      data.set(normals.slice(i * 3, i * 3 + 3), i * 12 + 3);
      data.set(uvs.slice(i * 2, i * 2 + 2), i * 12 + 6);
      data.set(colors.slice(i * 4, i * 4 + 4), i * 12 + 8);
    }
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    this.count = indices.length;
  }
  draw(ctx, model, texture, useTex, emissive, noFog) {
    const { gl, loc, attrib } = ctx;
    gl.uniformMatrix4fv(loc.uModel, false, model);
    gl.uniform1i(loc.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture || ctx.whiteTex);
    gl.uniform1f(loc.uUseTex, useTex ? 1 : 0);
    gl.uniform1f(loc.uEmissive, emissive || 0);
    gl.uniform1f(loc.uNoFog, noFog ? 1 : 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    const stride = 48;
    gl.enableVertexAttribArray(attrib.aPos);
    gl.vertexAttribPointer(attrib.aPos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(attrib.aNormal);
    gl.vertexAttribPointer(attrib.aNormal, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(attrib.aUV);
    gl.vertexAttribPointer(attrib.aUV, 2, gl.FLOAT, false, stride, 24);
    gl.enableVertexAttribArray(attrib.aColor);
    gl.vertexAttribPointer(attrib.aColor, 4, gl.FLOAT, false, stride, 32);
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
  }
}

// ---- mesh builders: boxes, cylinders, quads, ground plane ----// Box centered at origin, size (w,h,d). uvScale stretches texture per face.
export function buildBox(w, h, d, color, uvScale = 1) {
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const x = w / 2, y = h / 2, z = d / 2;
  const faces = [
    { n: [0,0,1], v: [[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]] },
    { n: [0,0,-1], v: [[x,-y,-z],[-x,-y,-z],[-x,y,-z],[x,y,-z]] },
    { n: [1,0,0], v: [[x,-y,z],[x,-y,-z],[x,y,-z],[x,y,z]] },
    { n: [-1,0,0], v: [[-x,-y,-z],[-x,-y,z],[-x,y,z],[-x,y,-z]] },
    { n: [0,1,0], v: [[-x,y,z],[x,y,z],[x,y,-z],[-x,y,-z]] },
    { n: [0,-1,0], v: [[-x,-y,-z],[x,-y,-z],[x,-y,z],[-x,-y,z]] },
  ];
  for (const f of faces) {
    const base = pos.length / 3;
    for (const v of f.v) pos.push(v[0], v[1], v[2]);
    for (let i = 0; i < 4; i++) nor.push(f.n[0], f.n[1], f.n[2]);
    uv.push(0,0, uvScale,0, uvScale,uvScale, 0,uvScale);
    for (let i = 0; i < 4; i++) col.push(color[0], color[1], color[2], color[3] ?? 1);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { pos, nor, uv, col, idx };
}
export function buildCylinder(r, h, segments, color) {
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const top = pos.length / 3;
  pos.push(0, h / 2, 0); nor.push(0,1,0); uv.push(.5,.5); col.push(...color);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    pos.push(cx, h / 2, cz); nor.push(0,1,0); uv.push(.5 + Math.cos(a) * .5, .5 + Math.sin(a) * .5); col.push(...color);
    if (i > 0) idx.push(top, top + i, top + i + 1);
  }
  const bot = pos.length / 3;
  pos.push(0, -h / 2, 0); nor.push(0,-1,0); uv.push(.5,.5); col.push(...color);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    pos.push(cx, -h / 2, cz); nor.push(0,-1,0); uv.push(.5 + Math.cos(a) * .5, .5 + Math.sin(a) * .5); col.push(...color);
    if (i > 0) idx.push(bot, bot + i + 1, bot + i);
  }
  const side = pos.length / 3;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const cx = Math.cos(a), cz = Math.sin(a);
    pos.push(cx * r, -h / 2, cz * r); nor.push(cx, 0, cz); uv.push(i / segments, 0); col.push(...color);
    pos.push(cx * r, h / 2, cz * r); nor.push(cx, 0, cz); uv.push(i / segments, 1); col.push(...color);
    if (i > 0) {
      const b = side + (i - 1) * 2;
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  return { pos, nor, uv, col, idx };
}
// Flat ground plane (single quad, UV 0..1 across the whole city).
export function buildPlane(size, color) {
  const s = size / 2;
  return {
    pos: [-s,0,-s, s,0,-s, s,0,s, -s,0,s],
    nor: [0,1,0, 0,1,0, 0,1,0, 0,1,0],
    uv: [0,0, 1,0, 1,1, 0,1],
    col: [...color, ...color, ...color, ...color],
    idx: [0,1,2, 0,2,3],
  };
}
// Merge several part-builds into one mesh-ready set.
export function mergeParts(parts) {
  const pos = [], nor = [], uv = [], col = [], idx = [];
  for (const p of parts) {
    const base = pos.length / 3;
    pos.push(...p.pos); nor.push(...p.nor); uv.push(...p.uv); col.push(...p.col);
    for (const i of p.idx) idx.push(i + base);
  }
  return { pos, nor, uv, col, idx };
}
export function meshFromParts(gl, parts) {
  const m = mergeParts(parts);
  return new Mesh(gl, m.pos, m.nor, m.uv, m.col, m.idx);
}
