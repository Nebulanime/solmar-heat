// Solmar Heat — hand-written WebGL renderer. One shader program, no library:
// per-vertex colour + optional facade texture, sun directional light with
// long-shadow tint, warm sunset fog, emissive glow for lights and neon.
// The canvas is transparent so the page's painted sky gradient and sun show
// through behind the 3D scene; fog colour matches the horizon.
import { matPerspective, matLookAt, matMul } from './mesh.js';
import { STRIDE } from './mesh.js';

const VS = `
attribute vec3 aPos; attribute vec3 aNorm; attribute vec3 aCol;
attribute vec2 aUv; attribute float aTex; attribute float aEmis;
uniform mat4 uMVP; uniform mat4 uModel;
varying vec3 vCol; varying vec3 vNorm; varying vec2 vUv; varying float vTex;
varying float vEmis; varying float vDepth; varying vec3 vWorld;
void main(){
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vec4 v = uMVP * w;
  vDepth = -v.z;
  gl_Position = v;
  vCol = aCol; vNorm = mat3(uModel) * aNorm; vUv = aUv; vTex = aTex; vEmis = aEmis;
}`;
const FS = `
precision mediump float;
varying vec3 vCol; varying vec3 vNorm; varying vec2 vUv; varying float vTex;
varying float vEmis; varying float vDepth; varying vec3 vWorld;
uniform sampler2D uTex[8];
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uAmb;
uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar;
uniform float uNight;
void main(){
  vec3 n = normalize(vNorm);
  vec3 base = vCol;
  if (vTex > 0.5) {
    int ti = int(vTex - 0.5);
    vec4 t = vec4(1.0);
    if (ti == 0) t = texture2D(uTex[0], vUv);
    else if (ti == 1) t = texture2D(uTex[1], vUv);
    else if (ti == 2) t = texture2D(uTex[2], vUv);
    else if (ti == 3) t = texture2D(uTex[3], vUv);
    else if (ti == 4) t = texture2D(uTex[4], vUv);
    else if (ti == 5) t = texture2D(uTex[5], vUv);
    else if (ti == 6) t = texture2D(uTex[6], vUv);
    else t = texture2D(uTex[7], vUv);
    base = t.rgb * (0.55 + 0.45 * vCol);
  }
  float diff = max(dot(n, uSunDir), 0.0);
  float wrap = max(dot(n, uSunDir) * 0.5 + 0.5, 0.0);
  vec3 col = base * (uAmb + uSunCol * (diff * 0.85 + wrap * 0.25));
  col += base * vEmis * 0.9;
  // Wet asphalt sheen: low surfaces catch a warm streak from the low sun.
  if (vWorld.y < 0.6 && vWorld.y > -0.5) {
    float sheen = max(dot(normalize(vec3(0.0, 1.0, 0.0)), uSunDir), 0.0);
    col += vec3(1.0, 0.55, 0.3) * sheen * 0.22 * (1.0 - uNight);
  }
  float f = clamp((vDepth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  col = mix(col, uFogCol, f * 0.92);
  gl_FragColor = vec4(col, 1.0);
}`;

export function createRenderer(canvas, textures) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL unavailable');
  const vs = compile(gl, gl.VERTEX_SHADER, VS);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const loc = (n) => gl.getUniformLocation(prog, n);
  const U = { mvp: loc('uMVP'), model: loc('uModel'), sunDir: loc('uSunDir'), sunCol: loc('uSunCol'),
    amb: loc('uAmb'), fogCol: loc('uFogCol'), fogNear: loc('uFogNear'), fogFar: loc('uFogFar'), night: loc('uNight') };
  for (let i = 0; i < 8; i++) gl.uniform1i(loc(`uTex[${i}]`), i);
  // Upload the 8 facade textures.
  textures.forEach((cv, i) => {
    gl.activeTexture(gl.TEXTURE0 + i);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.generateMipmap(gl.TEXTURE_2D);
  });
  const buf = gl.createBuffer();
  const attLocs = {};
  const att = (name, size, off) => {
    const l = gl.getAttribLocation(prog, name);
    attLocs[name] = { l, size, off };
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, size, gl.FLOAT, false, STRIDE * 4, off * 4);
  };
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  att('aPos', 3, 0); att('aNorm', 3, 3); att('aCol', 3, 6);
  att('aUv', 2, 9); att('aTex', 1, 11); att('aEmis', 1, 12);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  return { gl, prog, U, buf, attLocs };
}
// Re-point the attributes at the currently bound ARRAY_BUFFER (WebGL binds
// attrib pointers to the buffer active when vertexAttribPointer runs).
export function bindAttribs(r) {
  const { gl, attLocs } = r;
  for (const { l, size, off } of Object.values(attLocs)) {
    gl.vertexAttribPointer(l, size, gl.FLOAT, false, STRIDE * 4, off * 4);
  }
}
function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
export function uploadMesh(r, mesh) {
  const { gl } = r;
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.data), gl.STATIC_DRAW);
  return { buf, count: mesh.count };
}
export function drawMesh(r, mesh, mvp, model, env) {
  const { gl, U, prog } = r;
  gl.useProgram(prog);
  setUniforms(gl, U, mvp, model, env);
  gl.bindBuffer(gl.ARRAY_BUFFER, r.buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.data), gl.DYNAMIC_DRAW);
  bindAttribs(r);
  drawBound(r, mesh.count);
}
export function drawStatic(r, up, mvp, model, env) {
  const { gl, U, prog } = r;
  gl.useProgram(prog);
  setUniforms(gl, U, mvp, model, env);
  gl.bindBuffer(gl.ARRAY_BUFFER, up.buf);
  bindAttribs(r);
  drawBound(r, up.count);
}
function setUniforms(gl, U, mvp, model, env) {
  gl.uniformMatrix4fv(U.mvp, false, new Float32Array(mvp));
  gl.uniformMatrix4fv(U.model, false, new Float32Array(model));
  gl.uniform3fv(U.sunDir, env.sunDir);
  gl.uniform3fv(U.sunCol, env.sunCol);
  gl.uniform3fv(U.amb, env.amb);
  gl.uniform3fv(U.fogCol, env.fogCol);
  gl.uniform1f(U.fogNear, env.fogNear);
  gl.uniform1f(U.fogFar, env.fogFar);
  gl.uniform1f(U.night, env.night);
}
function drawBound(r, count) {
  r.gl.drawArrays(r.gl.TRIANGLES, 0, count);
}
export function viewMatrix(cam) {
  const proj = matPerspective(1.15, cam.aspect, 0.5, 900);
  const view = matLookAt(cam.ex, cam.ey, cam.ez, cam.cx, cam.cy, cam.cz);
  return matMul(proj, view);
}
export const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
// Sunset and night lighting environments.
export function sunsetEnv() {
  return { sunDir: norm3([-0.55, 0.28, 0.78]), sunCol: [1.0, 0.55, 0.32], amb: [0.42, 0.32, 0.38],
    fogCol: [0.98, 0.55, 0.42], fogNear: 120, fogFar: 620, night: 0 };
}
export function nightEnv() {
  return { sunDir: norm3([0.3, 0.6, 0.4]), sunCol: [0.25, 0.3, 0.55], amb: [0.22, 0.22, 0.32],
    fogCol: [0.08, 0.09, 0.2], fogNear: 90, fogFar: 480, night: 1 };
}
function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
