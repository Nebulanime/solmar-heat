// vehicles.js — car meshes (shaped bodies, cylinder wheels, slanted hoods,
// glowing headlights/taillights) and traffic AI that follows the road grid.
import { buildBox, buildCylinder, mergeParts, meshFromParts } from './gl.js';
import { mat4Model } from './util.js';
import { randomRoadPoint } from './city.js';

const CAR_COLORS = [
  [0.85, 0.12, 0.14, 1], [0.1, 0.25, 0.75, 1], [0.95, 0.8, 0.15, 1],
  [0.12, 0.7, 0.3, 1], [0.85, 0.85, 0.88, 1], [0.15, 0.15, 0.18, 1],
  [0.9, 0.45, 0.1, 1], [0.55, 0.15, 0.65, 1], [0.1, 0.65, 0.7, 1],
];
const WHEEL = [0.08, 0.08, 0.09, 1];
const GLASS = [0.12, 0.2, 0.3, 0.9];
const HEAD = [1, 0.95, 0.75, 1];
const TAIL = [1, 0.1, 0.1, 1];

// Shift a part-build by (x, y, z) so boxes stack into a shaped car.
function shift(p, x, y, z) {
  for (let i = 0; i < p.pos.length; i += 3) { p.pos[i] += x; p.pos[i + 1] += y; p.pos[i + 2] += z; }
  return p;
}

// Build one car mesh. `kind`: 'sedan' | 'taxi' | 'cop' | 'sport' | 'van'.
export function buildCarMesh(gl, color, kind = 'sedan') {
  const parts = [];
  const L = kind === 'van' ? 5.4 : kind === 'sport' ? 4.4 : 4.6;
  const W = 2.0, bodyH = 0.75, bodyY = 0.62;
  // main body
  parts.push(shift(buildBox(L, bodyH, W, color), 0, bodyY, 0));
  // slanted hood (front, lower) + trunk (rear, lower)
  parts.push(shift(buildBox(L * 0.3, 0.4, W * 0.94, color), L * 0.32, bodyY - 0.12, 0));
  parts.push(shift(buildBox(L * 0.24, 0.42, W * 0.94, color), -L * 0.36, bodyY - 0.1, 0));
  // cabin (glass) — shifted back, roof on top
  const cabL = kind === 'van' ? L * 0.55 : L * 0.42;
  const cabX = kind === 'van' ? -L * 0.05 : -L * 0.06;
  parts.push(shift(buildBox(cabL, 0.62, W * 0.88, GLASS), cabX, bodyY + 0.62, 0));
  parts.push(shift(buildBox(cabL * 0.9, 0.1, W * 0.9, color), cabX, bodyY + 0.96, 0));
  // headlights (front = +X) and taillights
  for (const z of [-0.62, 0.62]) {
    parts.push(shift(buildBox(0.08, 0.16, 0.3, HEAD), L / 2 + 0.01, bodyY + 0.05, z));
    parts.push(shift(buildBox(0.08, 0.16, 0.3, TAIL), -L / 2 - 0.01, bodyY + 0.05, z));
  }
  // taxi sign / police light bar
  if (kind === 'taxi') parts.push(shift(buildBox(0.7, 0.22, 0.5, [1, 0.85, 0.1, 1]), cabX, bodyY + 1.08, 0));
  if (kind === 'cop') {
    parts.push(shift(buildBox(0.9, 0.18, 0.5, [0.1, 0.1, 0.12, 1]), cabX, bodyY + 1.05, 0));
    parts.push(shift(buildBox(0.38, 0.2, 0.5, [1, 0.1, 0.1, 1]), cabX - 0.22, bodyY + 1.05, 0));
    parts.push(shift(buildBox(0.38, 0.2, 0.5, [0.15, 0.3, 1, 1]), cabX + 0.22, bodyY + 1.05, 0));
  }
  const mesh = meshFromParts(gl, parts);
  const wheelMesh = meshFromParts(gl, [buildCylinder(0.36, 0.28, 12, WHEEL)]);
  return { mesh, wheelMesh, length: L, width: W, wheelR: 0.36, kind };
}

export function drawCar(ctx, car, x, y, z, heading, opts = {}) {
  const { gl } = ctx;
  const model = mat4Model(x, y, z, heading, 0, 0, 1, 1, 1);
  const emissive = opts.night ? 0.25 : 0;
  car.mesh.draw(ctx, model, ctx.whiteTex, false, emissive);
  // wheels (cylinder axis Y -> rotate Z 90deg so axis points sideways)
  const wheelPos = [
    [-car.length * 0.32, -car.width / 2], [-car.length * 0.32, car.width / 2],
    [car.length * 0.32, -car.width / 2], [car.length * 0.32, car.width / 2],
  ];
  const cos = Math.cos(heading), sin = Math.sin(heading);
  for (const [lx, lz] of wheelPos) {
    const wx = x + lx * cos - lz * sin;
    const wz = z + lx * sin + lz * cos;
    const wm = mat4Model(wx, car.wheelR, wz, heading, 0, Math.PI / 2, 1, 1, 1);
    car.wheelMesh.draw(ctx, wm, ctx.whiteTex, false, 0);
  }
  // headlight glow quads at night
  if (opts.night && ctx.glowTex) {
    const hx = x + Math.cos(heading) * (car.length / 2 + 0.4);
    const hz = z + Math.sin(heading) * (car.length / 2 + 0.4);
    drawGlow(ctx, hx, 0.7, hz, 2.2, [1, 0.95, 0.7, 0.5]);
  }
}

// A camera-facing glow billboard (sun, headlights, neon) — drawn as a quad
// that always faces the camera.
export function drawGlow(ctx, x, y, z, size, color) {
  const cam = ctx.camera;
  const dx = x - cam.pos[0], dz = z - cam.pos[2];
  const yaw = Math.atan2(dx, dz);
  const m = mat4Model(x, y, z, yaw, 0, 0, size, size, 1);
  ctx.glowMesh.draw(ctx, m, ctx.glowTex, true, 0, 1);
}

// ---- traffic: cars that cruise the grid, stop at nothing, honk at no one ----
export class Traffic {
  constructor(city, rnd, count = 16) {
    this.city = city;
    this.rnd = rnd;
    this.cars = [];
    for (let i = 0; i < count; i++) this.spawn(true);
  }
  spawn(anywhere = false) {
    const p = randomRoadPoint(this.city, this.rnd);
    const speed = 7 + this.rnd() * 6;
    const color = CAR_COLORS[Math.floor(this.rnd() * CAR_COLORS.length)];
    const kind = this.rnd() < 0.12 ? 'taxi' : this.rnd() < 0.1 ? 'van' : 'sedan';
    this.cars.push({
      x: p.x, z: p.z, along: p.along, dir: p.dir, speed,
      color, kind, mesh: null, meshIndex: Math.floor(this.rnd() * 10), wobble: this.rnd() * Math.PI * 2,
    });
  }
  // Move along the current road; at intersections randomly turn.
  update(dt, player) {
    for (const c of this.cars) {
      const step = c.speed * dt * c.dir;
      if (c.along === 'z') {
        c.z += step;
        if (c.z > this.city.max - 10 || c.z < this.city.min + 10) { c.dir *= -1; c.z = Math.max(this.city.min + 10, Math.min(this.city.max - 10, c.z)); }
      } else {
        c.x += step;
        if (c.x > this.city.max - 10 || c.x < this.city.min + 10) { c.dir *= -1; c.x = Math.max(this.city.min + 10, Math.min(this.city.max - 10, c.x)); }
      }
      // random turn at an intersection
      const nearX = this.city.avenues.some((a) => Math.abs(c.x - a.x) < 1.2);
      const nearZ = this.city.streets.some((s) => Math.abs(c.z - s.z) < 1.2);
      if (nearX && nearZ && this.rnd() < dt * 0.25) {
        if (c.along === 'z') { c.along = 'x'; c.dir = this.rnd() < 0.5 ? 1 : -1; c.x = this.city.avenues.reduce((b, a) => Math.abs(a.x - c.x) < Math.abs(b.x - c.x) ? a : b).x + (c.dir > 0 ? 3.2 : -3.2); }
        else { c.along = 'z'; c.dir = this.rnd() < 0.5 ? 1 : -1; c.z = this.city.streets.reduce((b, s) => Math.abs(s.z - c.z) < Math.abs(b.z - c.z) ? s : b).z + (c.dir > 0 ? 3.2 : -3.2); }
      }
      // keep lane offset
      if (c.along === 'z') {
        const a = this.city.avenues.reduce((b, av) => Math.abs(av.x - c.x) < Math.abs(b.x - c.x) ? av : b);
        c.x += (a.x + (c.dir > 0 ? 3.2 : -3.2) - c.x) * dt * 2;
      } else {
        const s = this.city.streets.reduce((b, st) => Math.abs(st.z - c.z) < Math.abs(b.z - c.z) ? st : b);
        c.z += (s.z + (c.dir > 0 ? 3.2 : -3.2) - c.z) * dt * 2;
      }
    }
  }
  heading(c) {
    if (c.along === 'z') return c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    return c.dir > 0 ? 0 : Math.PI;
  }
}

// ---- player car physics: arcade arcade — accelerate, steer, brake, drift ----
export function driveCar(car, input, dt) {
  const accel = 16, brake = 26, maxSpeed = 34, reverseMax = 10, drag = 0.6;
  if (input.forward) car.speed += accel * dt;
  if (input.back) car.speed -= (car.speed > 0.5 ? brake : accel * 0.6) * dt;
  if (!input.forward && !input.back) car.speed -= car.speed * drag * dt;
  car.speed = Math.max(-reverseMax, Math.min(maxSpeed, car.speed));
  if (Math.abs(car.speed) > 0.3) {
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const grip = 1 - Math.min(0.45, Math.abs(car.speed) / maxSpeed * 0.45);
    car.heading += steer * 1.9 * grip * dt * Math.sign(car.speed);
  }
  car.x += Math.cos(car.heading) * car.speed * dt;
  car.z += Math.sin(car.heading) * car.speed * dt;
  return car;
}
