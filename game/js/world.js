// world.js — Solmar rendered: sky gradient box, the sun disc + glow, ground
// map, textured buildings (facades, setbacks, towers, cylinders, helipads),
// long sunset shadows, palms, lamps, neon signs, pedestrians, helicopter.
import { createGL, makeTexture, Mesh, buildBox, buildCylinder, buildPlane, mergeParts, meshFromParts } from './gl.js';
import { facadeTexture, roofTexture, groundTexture, neonTexture, sunTexture, whiteTexture } from './textures.js';
import { mat4Model, mat4Identity, clamp } from './util.js';
import { buildCarMesh, drawCar } from './vehicles.js';

// Box with per-face UV repeats so facade windows never stretch:
// sides repeat u = face width/10, v = height/10; top repeats by footprint.
function buildTexturedBox(w, h, d, color) {
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const x = w / 2, y = h / 2, z = d / 2;
  const u = (v) => v / 10, v = (vv) => vv / 10;
  const faces = [
    { n: [0,0,1], v: [[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]], ru: u(w), rv: v(h) },
    { n: [0,0,-1], v: [[x,-y,-z],[-x,-y,-z],[-x,y,-z],[x,y,-z]], ru: u(w), rv: v(h) },
    { n: [1,0,0], v: [[x,-y,z],[x,-y,-z],[x,y,-z],[x,y,z]], ru: u(d), rv: v(h) },
    { n: [-1,0,0], v: [[-x,-y,-z],[-x,-y,z],[-x,y,z],[-x,y,-z]], ru: u(d), rv: v(h) },
    { n: [0,1,0], v: [[-x,y,z],[x,y,z],[x,y,-z],[-x,y,-z]], ru: u(w), rv: u(d) },
    { n: [0,-1,0], v: [[-x,-y,-z],[x,-y,-z],[x,-y,z],[-x,-y,z]], ru: u(w), rv: u(d) },
  ];
  for (const f of faces) {
    const base = pos.length / 3;
    for (const vv of f.v) pos.push(vv[0], vv[1], vv[2]);
    for (let i = 0; i < 4; i++) nor.push(f.n[0], f.n[1], f.n[2]);
    uv.push(0, 0, f.ru, 0, f.ru, f.rv, 0, f.rv);
    for (let i = 0; i < 4; i++) col.push(color[0], color[1], color[2], color[3] ?? 1);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { pos, nor, uv, col, idx };
}

// Sky box: huge cube around the camera, top color at top vertices,
// horizon color at the bottom — the shader interpolates the gradient.
function buildSkyBox(size, top, horizon) {
  const s = size / 2;
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const corners = [
    [-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s],
    [-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s],
  ];
  const faces = [[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]];
  for (const f of faces) {
    const base = pos.length / 3;
    for (const ci of f) {
      pos.push(...corners[ci]);
      nor.push(0, 1, 0);
      uv.push(0, 0);
      const c = corners[ci][1] > 0 ? top : horizon;
      col.push(c[0], c[1], c[2], 1);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { pos, nor, uv, col, idx };
}

// Vertical quad (for glow billboards / neon signs), facing +Z, 2x2 centered.
// V is flipped: the texture upload mirrors vertically, so a V-flipped quad
// reads upright and in order. (U stays normal.)
function buildQuadXY(color) {
  return {
    pos: [-1,-1,0, 1,-1,0, 1,1,0, -1,1,0],
    nor: [0,0,1, 0,0,1, 0,0,1, 0,0,1],
    uv: [0,1, 1,1, 1,0, 0,0],
    col: [...color, ...color, ...color, ...color],
    idx: [0,1,2, 0,2,3],
  };
}

export const PRESETS = {
  sunset: {
    skyTop: [0.16, 0.22, 0.45], skyHorizon: [1.0, 0.55, 0.25],
    fog: [0.98, 0.55, 0.32], fogNear: 120, fogFar: 700,
    sunDir: [-0.75, 0.28, 0.25], sunColor: [1.0, 0.62, 0.3], ambient: [0.42, 0.36, 0.38],
    sunPos: [-560, 95, 120], sunSize: 150, lit: 0.35, glow: true, clear: [0.98, 0.55, 0.32],
  },
  night: {
    skyTop: [0.02, 0.03, 0.09], skyHorizon: [0.1, 0.12, 0.28],
    fog: [0.05, 0.07, 0.16], fogNear: 100, fogFar: 480,
    sunDir: [0.3, 0.7, 0.4], sunColor: [0.28, 0.36, 0.55], ambient: [0.16, 0.18, 0.27],
    sunPos: [300, 320, -260], sunSize: 60, lit: 0.8, glow: true, clear: [0.05, 0.07, 0.16],
  },
  day: {
    skyTop: [0.25, 0.55, 0.95], skyHorizon: [0.75, 0.88, 1.0],
    fog: [0.7, 0.83, 0.95], fogNear: 150, fogFar: 800,
    sunDir: [0.4, 0.85, 0.3], sunColor: [1.0, 0.95, 0.85], ambient: [0.5, 0.52, 0.55],
    sunPos: [320, 420, 200], sunSize: 90, lit: 0.2, glow: true, clear: [0.7, 0.83, 0.95],
  },
};

export class World {
  constructor(canvasEl, city) {
    this.city = city;
    this.ctx = createGL(document.getElementById('gl'));
    const { gl: g } = this.ctx;
    this.gl = g;
    this.ctx.whiteTex = makeTexture(g, whiteTexture());
    this.ctx.glowTex = makeTexture(g, sunTexture());
    this.ctx.camera = { pos: [0, 10, 20] };
    // facade texture sets: day-lit and night-lit per tone
    this.facades = {};
    const tones = ['glass', 'brick', 'sand', 'concrete', 'coral', 'teal'];
    for (const t of tones) {
      this.facades[t + '-day'] = makeTexture(g, facadeTexture(1000 + tones.indexOf(t) * 77, t, 0.22));
      this.facades[t + '-night'] = makeTexture(g, facadeTexture(5000 + tones.indexOf(t) * 77, t, 0.8));
    }
    this.roofs = [makeTexture(g, roofTexture(11, false)), makeTexture(g, roofTexture(22, true))];
    this.groundTex = makeTexture(g, groundTexture(city));
    this.neonTex = {
      club: makeTexture(g, neonTexture('CLUB MIRAGE', '#ff4fd8')),
      diner: makeTexture(g, neonTexture('NEON DINER', '#37e0ff')),
      arms: makeTexture(g, neonTexture('SOLMAR ARMS', '#ffcf3d')),
      loft: makeTexture(g, neonTexture("NOVA'S LOFT", '#7dff8a')),
    };
    this.groundMesh = meshFromParts(g, [buildPlane(city.max * 2 + 80, [1, 1, 1, 1])]);
    this.skyMeshes = {};
    for (const name of Object.keys(PRESETS)) {
      const p = PRESETS[name];
      this.skyMeshes[name] = meshFromParts(g, [buildSkyBox(1600, p.skyTop, p.skyHorizon)]);
    }
    this.glowMesh = meshFromParts(g, [buildQuadXY([1, 1, 1, 1])]);
    this.ctx.glowMesh = this.glowMesh;
    this.shadowMesh = meshFromParts(g, [buildPlane(1, [0, 0, 0, 0.32])]);
    this.buildBuildings();
    this.buildProps();
    this.buildPedMeshes();
    this.buildHeli();
    this.buildCarMeshes();
  }

  buildCarMeshes() {
    const g = this.gl;
    this.carMeshes = {};
    const defs = [
      ['player', [0.95, 0.25, 0.35, 1], 'sport'],
      ['cop', [0.08, 0.12, 0.2, 1], 'cop'],
      ['taxi', [1, 0.8, 0.1, 1], 'taxi'],
    ];
    for (const [name, color, kind] of defs) this.carMeshes[name] = buildCarMesh(g, color, kind);
    this.trafficMeshes = [];
    const cols = [
      [0.85, 0.12, 0.14, 1], [0.1, 0.25, 0.75, 1], [0.95, 0.8, 0.15, 1],
      [0.12, 0.7, 0.3, 1], [0.85, 0.85, 0.88, 1], [0.15, 0.15, 0.18, 1],
      [0.9, 0.45, 0.1, 1], [0.55, 0.15, 0.65, 1], [0.1, 0.65, 0.7, 1],
    ];
    for (const c of cols) this.trafficMeshes.push(buildCarMesh(g, c, 'sedan'));
    this.trafficMeshes.push(buildCarMesh(g, [0.9, 0.9, 0.9, 1], 'van'));
  }

  buildBuildings() {
    const g = this.gl;
    for (const b of this.city.buildings) {
      const white = [1, 1, 1, 1];
      if (b.kind === 'cylinder') {
        const cyl = buildCylinder(Math.max(b.w, b.d) / 2, b.h, 18, white);
        for (let i = 0; i < cyl.uv.length; i += 2) cyl.uv[i + 1] *= b.h / 12;
        b.mesh = meshFromParts(g, [cyl]);
        b.meshTex = this.facades[b.tone + '-day'];
        b.meshTexNight = this.facades[b.tone + '-night'];
        b.roof = null;
      } else if (b.kind === 'tower') {
        const lowerH = b.h * 0.6, upperH = b.h * 0.4;
        const lower = buildTexturedBox(b.w, lowerH, b.d, white);
        const upper = buildTexturedBox(b.w * b.setback, upperH, b.d * b.setback, white);
        // lower centered at lowerH/2, upper centered at lowerH + upperH/2
        for (let i = 0; i < lower.pos.length; i += 3) lower.pos[i + 1] += lowerH / 2;
        for (let i = 0; i < upper.pos.length; i += 3) upper.pos[i + 1] += lowerH + upperH / 2;
        b.mesh = meshFromParts(g, [lower, upper]);
        b.meshTex = this.facades[b.tone + '-day'];
        b.meshTexNight = this.facades[b.tone + '-night'];
        b.roofY = b.h;
        b.roofW = b.w * b.setback;
        b.roofD = b.d * b.setback;
      } else {
        const box = buildTexturedBox(b.w, b.h, b.d, white);
        for (let i = 0; i < box.pos.length; i += 3) box.pos[i + 1] += b.h / 2;
        b.mesh = meshFromParts(g, [box]);
        b.meshTex = this.facades[b.tone + '-day'];
        b.meshTexNight = this.facades[b.tone + '-night'];
        b.roofY = b.h; b.roofW = b.w; b.roofD = b.d;
      }
      b.roofMesh = meshFromParts(g, [buildBox(b.roofW || b.w, 0.6, b.roofD || b.d, [1, 1, 1, 1])]);
    }
  }

  buildProps() {
    const g = this.gl;
    // palm tree: trunk + 4 frond boxes
    const trunk = buildCylinder(0.22, 5.5, 8, [0.45, 0.32, 0.2, 1]);
    for (let i = 0; i < trunk.pos.length; i += 3) trunk.pos[i + 1] += 2.75;
    const fronds = [];
    for (let k = 0; k < 4; k++) {
      const f = buildBox(4.2, 0.12, 0.7, [0.12, 0.55, 0.2, 1]);
      const a = (k / 4) * Math.PI;
      const cos = Math.cos(a), sin = Math.sin(a);
      for (let i = 0; i < f.pos.length; i += 3) {
        const x = f.pos[i], z = f.pos[i + 2];
        f.pos[i] = x * cos - z * sin;
        f.pos[i + 2] = x * sin + z * cos;
        f.pos[i + 1] += 5.6;
      }
      fronds.push(f);
    }
    this.palmMesh = meshFromParts(g, [trunk, ...fronds]);
    // street lamp: pole + head
    const pole = buildCylinder(0.09, 6, 6, [0.2, 0.2, 0.22, 1]);
    for (let i = 0; i < pole.pos.length; i += 3) pole.pos[i + 1] += 3;
    const head = buildBox(0.5, 0.25, 0.9, [1, 0.95, 0.7, 1]);
    for (let i = 0; i < head.pos.length; i += 3) head.pos[i + 1] += 6;
    this.lampMesh = meshFromParts(g, [pole, head]);
    // palm + lamp placements along avenues (never inside a cross street)
    this.palms = [];
    this.lamps = [];
    const rnd = Math.random;
    const nearStreet = (z) => this.city.streets.some((s) => Math.abs(z - s.z) < this.city.roadW / 2 + 4);
    for (const a of this.city.avenues) {
      for (let z = -220; z <= 220; z += 32) {
        if (nearStreet(z)) continue;
        if (rnd() < 0.55) this.palms.push({ x: a.x + 9.5, z: z + (rnd() - 0.5) * 8, s: 0.85 + rnd() * 0.4 });
        if (rnd() < 0.5) this.lamps.push({ x: a.x - 8.5, z });
      }
    }
    // neon sign quads on the sidewalk edge by each named place, all facing west
    // toward their avenue so one view transform applies to every sign
    this.signs = [
      { tex: this.neonTex.club, x: this.city.avenues[3].x + 8, z: this.city.places.club.z, y: 8, w: 16, h: 4, yaw: -Math.PI / 2 },
      { tex: this.neonTex.diner, x: this.city.avenues[3].x + 8, z: this.city.places.diner.z, y: 8, w: 14, h: 3.5, yaw: -Math.PI / 2 },
      { tex: this.neonTex.arms, x: this.city.avenues[5].x + 8, z: this.city.places.arms.z, y: 7, w: 14, h: 3.5, yaw: -Math.PI / 2 },
      { tex: this.neonTex.loft, x: this.city.avenues[0].x + 8, z: this.city.places.safehouse.z, y: 7, w: 16, h: 4, yaw: -Math.PI / 2 },
    ];
    this.signMesh = meshFromParts(g, [buildQuadXY([1, 1, 1, 1])]);
  }

  buildPedMeshes() {
    const g = this.gl;
    this.pedMeshes = [];
    const shirts = [[0.9, 0.3, 0.3, 1], [0.3, 0.5, 0.9, 1], [0.9, 0.8, 0.2, 1], [0.4, 0.8, 0.4, 1], [0.9, 0.5, 0.8, 1], [0.2, 0.2, 0.25, 1]];
    for (const shirt of shirts) {
      const parts = [];
      const legs = buildBox(0.34, 0.8, 0.2, [0.15, 0.2, 0.35, 1]);
      for (let i = 0; i < legs.pos.length; i += 3) legs.pos[i + 1] += 0.4;
      const torso = buildBox(0.5, 0.62, 0.26, shirt);
      for (let i = 0; i < torso.pos.length; i += 3) torso.pos[i + 1] += 1.11;
      const head = buildBox(0.3, 0.3, 0.3, [0.85, 0.65, 0.5, 1]);
      for (let i = 0; i < head.pos.length; i += 3) head.pos[i + 1] += 1.58;
      parts.push(legs, torso, head);
      this.pedMeshes.push(meshFromParts(g, parts));
    }
    // Nova herself: red jacket, dark hair
    const nova = [];
    const nLegs = buildBox(0.34, 0.8, 0.2, [0.1, 0.12, 0.2, 1]);
    for (let i = 0; i < nLegs.pos.length; i += 3) nLegs.pos[i + 1] += 0.4;
    const nTorso = buildBox(0.5, 0.62, 0.26, [0.85, 0.1, 0.18, 1]);
    for (let i = 0; i < nTorso.pos.length; i += 3) nTorso.pos[i + 1] += 1.11;
    const nHead = buildBox(0.3, 0.3, 0.3, [0.9, 0.7, 0.55, 1]);
    for (let i = 0; i < nHead.pos.length; i += 3) nHead.pos[i + 1] += 1.58;
    const nHair = buildBox(0.34, 0.16, 0.34, [0.08, 0.05, 0.05, 1]);
    for (let i = 0; i < nHair.pos.length; i += 3) nHair.pos[i + 1] += 1.76;
    nova.push(nLegs, nTorso, nHead, nHair);
    this.novaMesh = meshFromParts(g, nova);
  }

  buildHeli() {
    const g = this.gl;
    const parts = [];
    const body = buildBox(3.4, 1.4, 1.8, [0.05, 0.1, 0.35, 1]);
    const tail = buildBox(3.2, 0.5, 0.5, [0.05, 0.1, 0.35, 1]);
    for (let i = 0; i < tail.pos.length; i += 3) tail.pos[i] -= 3;
    const skids = buildBox(3.0, 0.12, 1.6, [0.15, 0.15, 0.18, 1]);
    for (let i = 0; i < skids.pos.length; i += 3) skids.pos[i + 1] -= 0.9;
    parts.push(body, tail, skids);
    this.heliMesh = meshFromParts(g, parts);
    this.rotorMesh = meshFromParts(g, [buildBox(7.5, 0.08, 0.5, [0.2, 0.2, 0.22, 1])]);
  }

  // ---- frame render ----
  setPreset(name) {
    this.presetName = name;
    this.preset = PRESETS[name];
    const { gl, loc } = this.ctx;
    gl.clearColor(...this.preset.clear, 1);
    gl.uniform3fv(loc.uSunDir, this.preset.sunDir);
    gl.uniform3fv(loc.uSunColor, this.preset.sunColor);
    gl.uniform3fv(loc.uAmbient, this.preset.ambient);
    gl.uniform3fv(loc.uFogColor, this.preset.fog);
    gl.uniform1f(loc.uFogNear, this.preset.fogNear);
    gl.uniform1f(loc.uFogFar, this.preset.fogFar);
  }

  beginFrame(view, proj) {
    const { gl, loc } = this.ctx;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(loc.uProj, false, proj);
    gl.uniformMatrix4fv(loc.uView, false, view);
    gl.uniform3fv(loc.uCamPos, this.ctx.camera.pos);
    gl.uniform1f(loc.uEmissive, 0);
  }

  drawSky(camPos) {
    const m = mat4Model(camPos[0], camPos[1], camPos[2], 0, 0, 0, 1, 1, 1);
    this.skyMeshes[this.presetName].draw(this.ctx, m, this.ctx.whiteTex, false, 0, 1);
    // sun disc + glow, billboarded toward the camera so it reads from any angle
    const p = this.preset;
    const syaw = Math.atan2(p.sunPos[0] - camPos[0], p.sunPos[2] - camPos[2]);
    const sunM = mat4Model(p.sunPos[0], p.sunPos[1], p.sunPos[2], syaw, 0, 0, p.sunSize, p.sunSize, 1);
    this.glowMesh.draw(this.ctx, sunM, this.ctx.glowTex, true, 0, 1);
  }

  drawGround() {
    const m = mat4Identity();
    this.groundMesh.draw(this.ctx, m, this.groundTex, true, 0);
  }

  drawCity(camPos) {
    const night = this.presetName === 'night';
    const p = this.preset;
    // long shadows: dark quads stretched away from the sun
    const shX = -p.sunDir[0], shZ = -p.sunDir[2];
    const shLen = 0.55;
    for (const b of this.city.buildings) {
      if (b.kind === 'cylinder') continue;
      const len = Math.min(40, b.h * shLen);
      const m = mat4Model(b.x + shX * len * 0.5, 0.06, b.z + shZ * len * 0.5, 0, 0, 0, b.w + len * Math.abs(shX), 1, b.d + len * Math.abs(shZ));
      this.shadowMesh.draw(this.ctx, m, this.ctx.whiteTex, false, 0);
    }
    // buildings
    for (const b of this.city.buildings) {
      const y = b.kind === 'cylinder' ? b.h / 2 : 0;
      const m = mat4Model(b.x, y, b.z, b.rot || 0, 0, 0, 1, 1, 1);
      const tex = night ? b.meshTexNight : b.meshTex;
      b.mesh.draw(this.ctx, m, tex, true, night ? 0.35 : 0);
      if (b.roofMesh && b.roofY) {
        const rm = mat4Model(b.x, b.roofY + 0.3, b.z, b.rot || 0, 0, 0, 1, 1, 1);
        b.roofMesh.draw(this.ctx, rm, this.roofs[b.helipad ? 1 : 0], true, 0);
      }
    }
    // palms + lamps
    for (const pl of this.palms) {
      const m = mat4Model(pl.x, 0, pl.z, 0, 0, 0, pl.s, pl.s, pl.s);
      this.palmMesh.draw(this.ctx, m, this.ctx.whiteTex, false, 0);
    }
    for (const l of this.lamps) {
      const m = mat4Model(l.x, 0, l.z, 0, 0, 0, 1, 1, 1);
      this.lampMesh.draw(this.ctx, m, this.ctx.whiteTex, false, night ? 0.6 : 0);
    }
    // neon signs (billboarded toward the avenue, facing west)
    for (const s of this.signs) {
      const m = mat4Model(s.x, s.y, s.z, s.yaw, 0, 0, s.w / 2, s.h / 2, 1);
      this.signMesh.draw(this.ctx, m, s.tex, true, night ? 1.2 : 0.5);
    }
  }

  // Mission marker: tall glowing beacon column + floating diamond.
  drawMarker(x, z, t, color = [1, 0.85, 0.2, 1]) {
    const bob = Math.sin(t * 2.4) * 0.5;
    const cam = this.ctx.camera.pos;
    const yaw = Math.atan2(x - cam[0], z - cam[2]);
    const beam = mat4Model(x, 7, z, yaw, 0, 0, 3.2, 15, 1);
    this.glowMesh.draw(this.ctx, beam, this.ctx.glowTex, true, 0, 1);
    const m = mat4Model(x, 3 + bob, z, t * 1.2, 0, 0, 2.2, 2.2, 1);
    this.glowMesh.draw(this.ctx, m, this.ctx.glowTex, true, 0, 1);
  }

  drawHelicopter(x, y, z, t, heading) {
    const m = mat4Model(x, y, z, heading, 0, 0, 1, 1, 1);
    this.heliMesh.draw(this.ctx, m, this.ctx.whiteTex, false, 0);
    const rm = mat4Model(x, y + 0.9, z, heading + t * 9, 0, 0, 1, 1, 1);
    this.rotorMesh.draw(this.ctx, rm, this.ctx.whiteTex, false, 0);
  }
}
