// Solmar Heat — mesh builder + tiny matrix math. Everything is built from
// triangles with per-vertex normals, colour, UV and an emissive term, so one
// shader can draw textured buildings, glossy cars and glowing neon alike.
// A Mesh is a flat float array: pos(3) normal(3) colour(3) uv(2) tex(1) emis(1).
export const STRIDE = 13;
export function createMesh() { return { data: [], count: 0 }; }
export function pushTri(m, a, b, c) {
  // Each vertex: [x,y,z, nx,ny,nz, r,g,b, u,v, tex, emis]
  const n = faceNormal(a, b, c);
  for (const v of [a, b, c]) {
    m.data.push(v[0], v[1], v[2], n[0], n[1], n[2],
      v[6], v[7], v[8], v[9], v[10], v[11], v[12]);
  }
  m.count += 3;
}
export function faceNormal(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}
// Vertex helper: [x,y,z, nx,ny,nz, r,g,b, u,v, tex, emis] — normal filled by face.
export function V(x, y, z, rgb, uv = [0, 0], tex = 0, emis = 0) {
  return [x, y, z, 0, 0, 0, rgb[0], rgb[1], rgb[2], uv[0], uv[1], tex, emis];
}
export function quad(m, a, b, c, d) { pushTri(m, a, b, c); pushTri(m, a, c, d); }
export function box(m, cx, cy, cz, sx, sy, sz, rgb, opts = {}) {
  const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
  const t = opts.tex ?? 0, e = opts.emis ?? 0;
  const top = opts.top ?? rgb, side = opts.side ?? rgb, bot = opts.bot ?? rgb;
  const uv = opts.uv ?? [[0, 0], [1, 0], [1, 1], [0, 1]];
  const f = (p, col, u) => V(p[0], p[1], p[2], col, u, t, e);
  quad(m, f([x0, y1, z1], top, uv[0]), f([x1, y1, z1], top, uv[1]), f([x1, y1, z0], top, uv[2]), f([x0, y1, z0], top, uv[3]));
  quad(m, f([x0, y0, z0], bot, uv[0]), f([x1, y0, z0], bot, uv[1]), f([x1, y0, z1], bot, uv[2]), f([x0, y0, z1], bot, uv[3]));
  quad(m, f([x0, y0, z1], side, uv[0]), f([x1, y0, z1], side, uv[1]), f([x1, y1, z1], side, uv[2]), f([x0, y1, z1], side, uv[3]));
  quad(m, f([x1, y0, z0], side, uv[0]), f([x0, y0, z0], side, uv[1]), f([x0, y1, z0], side, uv[2]), f([x1, y1, z0], side, uv[3]));
  quad(m, f([x0, y0, z0], side, uv[0]), f([x0, y0, z1], side, uv[1]), f([x0, y1, z1], side, uv[2]), f([x0, y1, z0], side, uv[3]));
  quad(m, f([x1, y0, z1], side, uv[0]), f([x1, y0, z0], side, uv[1]), f([x1, y1, z0], side, uv[2]), f([x1, y1, z1], side, uv[3]));
}
// Tapered box: top face scaled by (tx, tz) around the centre — the wedge that
// makes a car hood, cabin and roof read as shaped, not a plain cuboid.
export function taperBox(m, cx, cy, cz, sx, sy, sz, tx, tz, rgb, opts = {}) {
  const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
  const tx0 = cx - (sx * tx) / 2, tx1 = cx + (sx * tx) / 2, tz0 = cz - (sz * tz) / 2, tz1 = cz + (sz * tz) / 2;
  const t = opts.tex ?? 0, e = opts.emis ?? 0;
  const top = opts.top ?? rgb, side = opts.side ?? rgb, bot = opts.bot ?? rgb;
  const f = (p, col, u = [0, 0]) => V(p[0], p[1], p[2], col, u, t, e);
  quad(m, f([tx0, y1, tz1], top), f([tx1, y1, tz1], top), f([tx1, y1, tz0], top), f([tx0, y1, tz0], top));
  quad(m, f([x0, y0, z0], bot), f([x1, y0, z0], bot), f([x1, y0, z1], bot), f([x0, y0, z1], bot));
  quad(m, f([x0, y0, z1], side), f([x1, y0, z1], side), f([tx1, y1, tz1], side), f([tx0, y1, tz1], side));
  quad(m, f([x1, y0, z0], side), f([x0, y0, z0], side), f([tx0, y1, tz0], side), f([tx1, y1, tz0], side));
  quad(m, f([x0, y0, z0], side), f([x0, y0, z1], side), f([tx0, y1, tz1], side), f([tx0, y1, tz0], side));
  quad(m, f([x1, y0, z1], side), f([x1, y0, z0], side), f([tx1, y1, tz0], side), f([tx1, y1, tz1], side));
}
// Cylinder along Y (wheels, trunks, towers). seg segments, capped.
export function cylinder(m, cx, cy, cz, r, h, rgb, opts = {}) {
  const seg = opts.seg ?? 12, t = opts.tex ?? 0, e = opts.emis ?? 0;
  const y0 = cy - h / 2, y1 = cy + h / 2;
  const f = (p, col, u) => V(p[0], p[1], p[2], col, u, t, e);
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const x0 = cx + Math.cos(a0) * r, z0 = cz + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r, z1 = cz + Math.sin(a1) * r;
    const u0 = i / seg, u1 = (i + 1) / seg;
    quad(m, f([x0, y0, z0], rgb, [u0, 0]), f([x1, y0, z1], rgb, [u1, 0]),
      f([x1, y1, z1], rgb, [u1, 1]), f([x0, y1, z0], rgb, [u0, 1]));
    pushTri(m, f([cx, y1, cz], rgb, [0.5, 0.5]), f([x1, y1, z1], rgb, [u1, 1]), f([x0, y1, z0], rgb, [u0, 1]));
    pushTri(m, f([cx, y0, cz], rgb, [0.5, 0.5]), f([x0, y0, z0], rgb, [u0, 0]), f([x1, y0, z1], rgb, [u1, 0]));
  }
}
// Cylinder rotated to lie along X (a wheel axle direction).
export function wheel(m, cx, cy, cz, r, w, rgb, hubRgb) {
  const seg = 14, t = 0;
  const f = (p, col, u) => V(p[0], p[1], p[2], col, u, t, 0);
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const y0 = cy + Math.sin(a0) * r, z0 = cz + Math.cos(a0) * r;
    const y1 = cy + Math.sin(a1) * r, z1 = cz + Math.cos(a1) * r;
    quad(m, f([cx - w / 2, y0, z0], rgb, [0, 0]), f([cx + w / 2, y0, z0], rgb, [1, 0]),
      f([cx + w / 2, y1, z1], rgb, [1, 1]), f([cx - w / 2, y1, z1], rgb, [0, 1]));
    // Hub caps (lighter disc on each side).
    pushTri(m, f([cx - w / 2 - 0.01, cy, cz], hubRgb, [0.5, 0.5]),
      f([cx - w / 2 - 0.01, y0, z0], hubRgb, [0, 0]), f([cx - w / 2 - 0.01, y1, z1], hubRgb, [1, 0]));
    pushTri(m, f([cx + w / 2 + 0.01, cy, cz], hubRgb, [0.5, 0.5]),
      f([cx + w / 2 + 0.01, y1, z1], hubRgb, [1, 0]), f([cx + w / 2 + 0.01, y0, z0], hubRgb, [0, 0]));
  }
}

// Low-poly sphere (lat-long) for heads, sun, lamps and domes.
export function sphere(m, cx, cy, cz, r, rgb, opts = {}) {
  const seg = opts.seg ?? 10, rings = opts.rings ?? 6, e = opts.emis ?? 0;
  const f = (p, col, u) => V(p[0], p[1], p[2], col, u, 0, e);
  for (let ri = 0; ri < rings; ri++) {
    const p0 = (ri / rings) * Math.PI, p1 = ((ri + 1) / rings) * Math.PI;
    for (let si = 0; si < seg; si++) {
      const a0 = (si / seg) * Math.PI * 2, a1 = ((si + 1) / seg) * Math.PI * 2;
      const pt = (p, a) => [cx + Math.sin(p) * Math.cos(a) * r, cy + Math.cos(p) * r, cz + Math.sin(p) * Math.sin(a) * r];
      quad(m, f(pt(p0, a0), rgb, [si / seg, ri / rings]), f(pt(p0, a1), rgb, [(si + 1) / seg, ri / rings]),
        f(pt(p1, a1), rgb, [(si + 1) / seg, (ri + 1) / rings]), f(pt(p1, a0), rgb, [si / seg, (ri + 1) / rings]));
    }
  }
}
// Merge mesh b into a (concatenate vertex data).
export function merge(a, b) { for (const v of b.data) a.data.push(v); a.count += b.count; return a; }
// Rotate mesh vertices around Y by heading, then translate. PURE: returns a
// new mesh, so the same local-space mesh can be placed every frame without
// accumulating transforms (a mutating version made traffic drift away).
export function transform(m, heading, tx, ty, tz) {
  const out = { data: m.data.slice(), count: m.count };
  const c = Math.cos(heading), s = Math.sin(heading);
  for (let i = 0; i < out.data.length; i += STRIDE) {
    const x = out.data[i], y = out.data[i + 1], z = out.data[i + 2];
    const nx = out.data[i + 3], nz = out.data[i + 5];
    out.data[i] = x * c + z * s + tx;
    out.data[i + 1] = y + ty;
    out.data[i + 2] = -x * s + z * c + tz;
    out.data[i + 3] = nx * c + nz * s;
    out.data[i + 5] = -nx * s + nz * c;
  }
  return out;
}
// --- matrices (column-major, WebGL style) ----------------------------------
export function matIdentity() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
export function matPerspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}
export function matLookAt(ex, ey, ez, cx, cy, cz, ux = 0, uy = 1, uz = 0) {
  let zx = ex - cx, zy = ey - cy, zz = ez - cz;
  let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
  let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx;
  l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
    -(xx * ex + xy * ey + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1];
}
export function matMul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
export function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
