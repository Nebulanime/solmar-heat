// Solmar Heat — vehicles and people. Cars are NOT boxes: a tapered lower
// body, a sloped hood, a trapezoidal glass cabin, a sloped trunk, cylinder
// wheels with hubs, glowing headlights/taillights and a spoiler on the
// player's sports car. Police cruisers get a light bar; the helicopter gets
// a rotor and a searchlight.
import { createMesh, box, taperBox, wheel, cylinder, quad, V, sphere, merge, transform, hexRgb } from './mesh.js';

const TIRE = [0.08, 0.08, 0.09], HUB = [0.75, 0.75, 0.78], GLASS = [0.06, 0.1, 0.16];
// Build a car in local space: forward = -Z, length ~4.6, width ~2.0.
export function buildCar(colorHex, opts = {}) {
  const m = createMesh();
  const body = hexRgb(colorHex);
  const dark = body.map((v) => v * 0.55);
  const light = body.map((v) => Math.min(1, v * 1.25 + 0.08));
  // Lower body: tapered, wider at the back, narrower at the nose.
  taperBox(m, 0, 0.62, 0, 1.9, 0.72, 4.5, 0.92, 0.94, body, { top: light, side: body, bot: dark });
  // Hood slope: a low wedge at the front (-Z).
  taperBox(m, 0, 0.98, -1.55, 1.78, 0.3, 1.3, 0.86, 0.7, body, { top: light });
  // Trunk slope at the back.
  taperBox(m, 0, 0.98, 1.6, 1.8, 0.3, 1.0, 0.9, 0.78, body, { top: light });
  // Glass cabin: trapezoidal, dark glass, sloped windshield and rear window.
  taperBox(m, 0, 1.32, 0.25, 1.62, 0.62, 2.3, 0.78, 0.72, GLASS, { top: [0.1, 0.16, 0.24] });
  // Roof panel (body colour, thin) + pillars implied by glass edges.
  box(m, 0, 1.66, 0.25, 1.5, 0.08, 1.9, body, { top: light });
  // Side skirts + bumpers.
  box(m, 0, 0.32, -2.28, 1.86, 0.3, 0.22, dark);
  box(m, 0, 0.32, 2.28, 1.86, 0.3, 0.22, dark);
  // Headlights: bright emissive quads + glow strip; taillights red.
  const hl = [1, 0.95, 0.75];
  quad(m, V(-0.62, 0.78, -2.26, hl, [0, 0], 0, 2.2), V(-0.2, 0.78, -2.26, hl, [1, 0], 0, 2.2),
    V(-0.2, 0.98, -2.26, hl, [1, 1], 0, 2.2), V(-0.62, 0.98, -2.26, hl, [0, 1], 0, 2.2));
  quad(m, V(0.2, 0.78, -2.26, hl, [0, 0], 0, 2.2), V(0.62, 0.78, -2.26, hl, [1, 0], 0, 2.2),
    V(0.62, 0.98, -2.26, hl, [1, 1], 0, 2.2), V(0.2, 0.98, -2.26, hl, [0, 1], 0, 2.2));
  const tl = [1, 0.08, 0.1];
  quad(m, V(-0.7, 0.82, 2.26, tl, [0, 0], 0, 1.6), V(-0.15, 0.82, 2.26, tl, [1, 0], 0, 1.6),
    V(-0.15, 0.98, 2.26, tl, [1, 1], 0, 1.6), V(-0.7, 0.98, 2.26, tl, [0, 1], 0, 1.6));
  quad(m, V(0.15, 0.82, 2.26, tl, [0, 0], 0, 1.6), V(0.7, 0.82, 2.26, tl, [1, 0], 0, 1.6),
    V(0.7, 0.98, 2.26, tl, [1, 1], 0, 1.6), V(0.15, 0.98, 2.26, tl, [0, 1], 0, 1.6));
  // Grille + mirrors.
  box(m, 0, 0.62, -2.27, 1.1, 0.22, 0.06, [0.12, 0.12, 0.14]);
  box(m, -1.02, 1.18, -0.4, 0.14, 0.12, 0.3, dark);
  box(m, 1.02, 1.18, -0.4, 0.14, 0.12, 0.3, dark);
  // Wheels: real cylinders with hubcaps, front axle steered visually by opts.
  const steer = opts.steer ?? 0;
  for (const [wx, wz] of [[-0.95, -1.5], [0.95, -1.5], [-0.95, 1.5], [0.95, 1.5]]) {
    const w = createMesh();
    wheel(w, 0, 0.36, 0, 0.36, 0.3, TIRE, HUB);
    merge(m, transform(w, steer * (wz < 0 ? 1 : 0), wx, 0, wz));
  }
  if (opts.sport) {
    // Spoiler + hood scoop + side stripe.
    box(m, 0, 1.28, 2.05, 1.7, 0.06, 0.28, dark);
    box(m, -0.7, 1.34, 2.12, 0.1, 0.16, 0.1, dark);
    box(m, 0.7, 1.34, 2.12, 0.1, 0.16, 0.1, dark);
    box(m, 0, 1.12, -1.55, 0.5, 0.1, 0.9, [0.15, 0.15, 0.16]);
    box(m, -0.95, 0.72, 0, 0.06, 0.14, 3.6, [1, 0.85, 0.9]);
    box(m, 0.95, 0.72, 0, 0.06, 0.14, 3.6, [1, 0.85, 0.9]);
  }
  if (opts.police) {
    // Black-and-white cruiser: white doors, light bar, push bar.
    box(m, -0.96, 0.78, 0.3, 0.04, 0.5, 1.7, [0.92, 0.92, 0.94]);
    box(m, 0.96, 0.78, 0.3, 0.04, 0.5, 1.7, [0.92, 0.92, 0.94]);
    const rb = opts.flash === 0 ? [1, 0.1, 0.15] : [0.1, 0.3, 1];
    const bb = opts.flash === 0 ? [0.1, 0.3, 1] : [1, 0.1, 0.15];
    box(m, -0.35, 1.72, 0.25, 0.62, 0.16, 0.3, rb, { emis: 2.4 });
    box(m, 0.35, 1.72, 0.25, 0.62, 0.16, 0.3, bb, { emis: 2.4 });
    box(m, 0, 0.55, -2.3, 1.4, 0.4, 0.12, [0.2, 0.2, 0.22]);
  }
  if (opts.taxi) {
    box(m, 0, 1.74, 0.25, 0.7, 0.22, 0.9, [1, 0.8, 0.1], { emis: 0.8 });
  }
  return m;
}
// A pedestrian: capsule-ish body (cylinder + sphere head), coloured clothes.
export function buildPed(shirtHex, skinHex, pantsHex) {
  const m = createMesh();
  const shirt = hexRgb(shirtHex), skin = hexRgb(skinHex), pants = hexRgb(pantsHex);
  cylinder(m, 0, 0.55, 0, 0.22, 0.9, pants, { seg: 8 });
  cylinder(m, 0, 1.25, 0, 0.3, 0.8, shirt, { seg: 8 });
  sphere(m, 0, 1.82, 0, 0.21, skin, { seg: 8, rings: 5 });
  cylinder(m, -0.34, 1.25, 0, 0.08, 0.7, shirt, { seg: 6 });
  cylinder(m, 0.34, 1.25, 0, 0.08, 0.7, shirt, { seg: 6 });
  return m;
}
// Nova on foot: pink jacket, dark jeans — readable at a distance.
export function buildNova() {
  const m = buildPed('#ff5e8a', '#e8b48c', '#23283a');
  // Hair: dark volume behind the head.
  sphere(m, 0, 1.86, 0.12, 0.22, [0.12, 0.08, 0.1], { seg: 8, rings: 4 });
  return m;
}
// Police helicopter: rounded body, tail boom, spinning rotor, searchlight.
export function buildHeli(t) {
  const m = createMesh();
  const body = [0.12, 0.16, 0.22];
  sphere(m, 0, 0, 0, 1.5, body, { seg: 10, rings: 6 });
  box(m, 0, -0.2, 3.2, 0.5, 0.5, 4.2, body);
  box(m, 0, 0.4, 3.6, 0.12, 1.6, 1.4, [0.1, 0.14, 0.2]);
  cylinder(m, 0, 1.6, 0, 0.2, 0.5, [0.3, 0.3, 0.32], { seg: 8 });
  const a = t * 9;
  const r = 3.4;
  box(m, Math.cos(a) * 0, 1.85, 0, 0.24, 0.08, r * 2, [0.5, 0.5, 0.52]);
  box(m, 0, 1.85, 0, r * 2, 0.08, 0.24, [0.5, 0.5, 0.52]);
  sphere(m, 0, -1.2, -1.2, 0.3, [1, 0.95, 0.7], { seg: 8, rings: 4, emis: 2.0 });
  const rb = Math.floor(t * 2) % 2 === 0 ? [1, 0.1, 0.15] : [0.1, 0.3, 1];
  sphere(m, 0, -1.4, 1.4, 0.22, rb, { seg: 8, rings: 4, emis: 2.2 });
  return m;
}
