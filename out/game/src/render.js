// Drawing only: the city in 3D, the HUD, the minimap and the menus. A chase
// camera follows Jax; every box in the world is projected with a perspective
// basis, collected as polygons, sorted far-to-near and painted flat-shaded.
// The HUD and the minimap are screen space. Nothing here touches the rules.
import { CITY, FONT, FONT_DISPLAY, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const FOV = 1.05; // vertical field of view, radians
const CAM_DIST = 27;
const CAM_HEIGHT = 16;
const CAM_PITCH = 0.42;
const VIEW_DIST = 340;

function shade(hex, factor) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `rgb(${r},${g},${b})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { w: 1280, h: 720, dpr: 1 };
  const fonts = new Map();
  // The camera basis of the last drawn frame, for screenToGround.
  let cam = null;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.dpr = ratio;
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.round(view.w * ratio);
    canvas.height = Math.round(view.h * ratio);
    canvas.style.width = `${view.w}px`;
    canvas.style.height = `${view.h}px`;
  }

  function font(size, display) {
    const key = `${size}|${display ? 'd' : ''}`;
    if (!fonts.has(key)) fonts.set(key, `${display ? '700 ' : ''}${size}px ${display ? FONT_DISPLAY : FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align = 'left', display = false) {
    ctx.font = font(size, display);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function computeCamera(state) {
    const p = state.player;
    const yaw = state.camera.yaw;
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);
    const tx = p.x + fwdX * 8;
    const tz = p.z + fwdZ * 8;
    const pos = { x: tx - fwdX * CAM_DIST, y: CAM_HEIGHT, z: tz - fwdZ * CAM_DIST };
    const cp = Math.cos(CAM_PITCH);
    const sp = Math.sin(CAM_PITCH);
    const fwd = { x: fwdX * cp, y: -sp, z: fwdZ * cp };
    const right = { x: -fwdZ, y: 0, z: fwdX };
    const up = { x: fwdX * sp, y: cp, z: fwdZ * sp };
    const focal = (view.h / 2) / Math.tan(FOV / 2);
    cam = { pos, fwd, right, up, focal };
    return cam;
  }

  function project(x, y, z) {
    const dx = x - cam.pos.x;
    const dy = y - cam.pos.y;
    const dz = z - cam.pos.z;
    const cz = dx * cam.fwd.x + dy * cam.fwd.y + dz * cam.fwd.z;
    if (cz < 1) return null;
    const cx = dx * cam.right.x + dy * cam.right.y + dz * cam.right.z;
    const cy = dx * cam.up.x + dy * cam.up.y + dz * cam.up.z;
    return {
      x: view.w / 2 + (cam.focal * cx) / cz,
      y: view.h / 2 - (cam.focal * cy) / cz,
      d: cz,
    };
  }

  /** A screen point back onto the ground plane (y = 0), or null when it misses. */
  function screenToGround(sx, sy) {
    if (!cam) return null;
    const nx = (sx - view.w / 2) / cam.focal;
    const ny = (view.h / 2 - sy) / cam.focal;
    const dx = cam.right.x * nx + cam.up.x * ny + cam.fwd.x;
    const dy = cam.right.y * nx + cam.up.y * ny + cam.fwd.y;
    const dz = cam.right.z * nx + cam.up.z * ny + cam.fwd.z;
    if (dy >= -0.001) return null;
    const t = -cam.pos.y / dy;
    return { x: cam.pos.x + dx * t, z: cam.pos.z + dz * t };
  }

  function drawSky(state) {
    const g = ctx.createLinearGradient(0, 0, 0, view.h * 0.62);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(0.7, PALETTE.skyMid);
    g.addColorStop(1, PALETTE.horizon);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.w, view.h * 0.62 + 2);
    // The sun hangs in the south-west, fixed in the world.
    const sun = project(state.player.x - 500, 260, state.player.z + 500);
    if (sun) {
      ctx.fillStyle = PALETTE.sun;
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, 34, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // A polygon is [x, y, z] corners plus a fill; depth is its centre's distance.
  function poly(list, pts, color) {
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const p of pts) {
      cx += p[0];
      cy += p[1];
      cz += p[2];
    }
    const n = pts.length;
    const dx = cx / n - cam.pos.x;
    const dy = cy / n - cam.pos.y;
    const dz = cz / n - cam.pos.z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d > VIEW_DIST * VIEW_DIST) return;
    list.push({ pts, color, d });
  }

  function face(list, quad, color, shadeFactor) {
    poly(list, quad, shadeFactor === undefined ? color : shade(color, shadeFactor));
  }

  /** The visible faces of an axis-aligned box. */
  function box(list, x, z, w, d, h, topColor, sideColor, windows) {
    const x0 = x - w / 2;
    const x1 = x + w / 2;
    const z0 = z - d / 2;
    const z1 = z + d / 2;
    const cx = cam.pos.x;
    const cz = cam.pos.z;
    // Roof.
    face(list, [[x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]], topColor, 1.05);
    // The two sides facing the camera.
    if (cz < z0) face(list, [[x0, 0, z0], [x1, 0, z0], [x1, h, z0], [x0, h, z0]], sideColor, 0.82);
    if (cz > z1) face(list, [[x1, 0, z1], [x0, 0, z1], [x0, h, z1], [x1, h, z1]], sideColor, 0.82);
    if (cx < x0) face(list, [[x0, 0, z1], [x0, 0, z0], [x0, h, z0], [x0, h, z1]], sideColor, 0.68);
    if (cx > x1) face(list, [[x1, 0, z0], [x1, 0, z1], [x1, h, z1], [x1, h, z0]], sideColor, 0.68);
    if (windows) drawWindows(list, x, z, w, d, h);
  }

  function drawWindows(list, x, z, w, d, h) {
    // Lit windows on the faces the camera can see, as small inset quads.
    const rows = Math.max(1, Math.floor(h / 7));
    const cols = Math.max(1, Math.floor(Math.max(w, d) / 9));
    const x0 = x - w / 2;
    const x1 = x + w / 2;
    const z0 = z - d / 2;
    const z1 = z + d / 2;
    const win = '#ffe9a8';
    for (let r = 0; r < rows; r += 1) {
      const y0 = 3 + r * 7;
      const y1 = y0 + 3.5;
      for (let c = 0; c < cols; c += 1) {
        if ((r * 7 + c * 3) % 5 === 0) continue; // some windows stay dark
        if (cam.pos.z < z0) {
          const wx0 = x0 + 4 + c * ((w - 8) / cols);
          const wx1 = wx0 + 3.5;
          poly(list, [[wx0, y0, z0 - 0.15], [wx1, y0, z0 - 0.15], [wx1, y1, z0 - 0.15], [wx0, y1, z0 - 0.15]], win);
        }
        if (cam.pos.z > z1) {
          const wx0 = x0 + 4 + c * ((w - 8) / cols);
          const wx1 = wx0 + 3.5;
          poly(list, [[wx1, y0, z1 + 0.15], [wx0, y0, z1 + 0.15], [wx0, y1, z1 + 0.15], [wx1, y1, z1 + 0.15]], win);
        }
        if (cam.pos.x < x0) {
          const wz0 = z0 + 4 + c * ((d - 8) / cols);
          const wz1 = wz0 + 3.5;
          poly(list, [[x0 - 0.15, y0, wz1], [x0 - 0.15, y0, wz0], [x0 - 0.15, y1, wz0], [x0 - 0.15, y1, wz1]], win);
        }
        if (cam.pos.x > x1) {
          const wz0 = z0 + 4 + c * ((d - 8) / cols);
          const wz1 = wz0 + 3.5;
          poly(list, [[x1 + 0.15, y0, wz0], [x1 + 0.15, y0, wz1], [x1 + 0.15, y1, wz1], [x1 + 0.15, y1, wz0]], win);
        }
      }
    }
  }

  function drawGround(state, list) {
    const H = CITY.half;
    const s = CITY.streets;
    // The dirt the city sits on.
    poly(list, [[-H - 60, 0, -H - 60], [H + 60, 0, -H - 60], [H + 60, 0, H + 120], [-H - 60, 0, H + 120]], PALETTE.blockTop);
    // Beach and sea to the south.
    poly(list, [[-H - 60, 0.1, CITY.seaZ - 22], [H + 60, 0.1, CITY.seaZ - 22], [H + 60, 0.1, CITY.seaZ], [-H - 60, 0.1, CITY.seaZ]], PALETTE.sand);
    poly(list, [[-H - 60, 0.05, CITY.seaZ], [H + 60, 0.05, CITY.seaZ], [H + 60, 0.05, CITY.seaZ + 500], [-H - 60, 0.05, CITY.seaZ + 500]], PALETTE.sea);
    // Sidewalks, then the asphalt on top of them.
    for (const street of s) {
      const w2 = CITY.street / 2 + 8;
      poly(list, [[-H, 0.12, street - w2], [H, 0.12, street - w2], [H, 0.12, street + w2], [-H, 0.12, street + w2]], PALETTE.sidewalk);
      poly(list, [[street - w2, 0.12, -H], [street + w2, 0.12, -H], [street + w2, 0.12, H], [street - w2, 0.12, H]], PALETTE.sidewalk);
      const a2 = CITY.street / 2;
      poly(list, [[-H, 0.15, street - a2], [H, 0.15, street - a2], [H, 0.15, street + a2], [-H, 0.15, street + a2]], PALETTE.asphalt);
      poly(list, [[street - a2, 0.15, -H], [street + a2, 0.15, -H], [street + a2, 0.15, H], [street - a2, 0.15, H]], PALETTE.asphalt);
    }
    // The plaza's paving, and the parks' grass.
    poly(list, [[-60, 0.18, -60], [60, 0.18, -60], [60, 0.18, 60], [-60, 0.18, 60]], PALETTE.plaza);
    // Dashed centre lines down every street, so the roads read as roads.
    for (const street of s) {
      for (let v = -H + 8; v < H - 8; v += 16) {
        poly(list, [[v, 0.22, street - 1], [v + 6, 0.22, street - 1], [v + 6, 0.22, street + 1], [v, 0.22, street + 1]], PALETTE.asphaltLine);
        poly(list, [[street - 1, 0.22, v], [street + 1, 0.22, v], [street + 1, 0.22, v + 6], [street - 1, 0.22, v + 6]], PALETTE.asphaltLine);
      }
    }
    // Zebra crossings at every intersection, so the grid reads at a glance.
    const cross = '#e8e8e8';
    for (const sx of s) {
      for (const sz of s) {
        for (let k = -3; k <= 3; k += 1) {
          const off = k * 4;
          poly(list, [[sx + off - 1.2, 0.2, sz - 14], [sx + off + 1.2, 0.2, sz - 14], [sx + off + 1.2, 0.2, sz - 8], [sx + off - 1.2, 0.2, sz - 8]], cross);
          poly(list, [[sx - 14, 0.2, sz + off - 1.2], [sx - 8, 0.2, sz + off - 1.2], [sx - 8, 0.2, sz + off + 1.2], [sx - 14, 0.2, sz + off + 1.2]], cross);
        }
      }
    }
  }

  function drawBuildings(state, list) {
    for (const b of state.city.buildings) {
      const dx = b.x - state.player.x;
      const dz = b.z - state.player.z;
      if (dx * dx + dz * dz > VIEW_DIST * VIEW_DIST) continue;
      const near = dx * dx + dz * dz < 150 * 150;
      box(list, b.x, b.z, b.w, b.d, b.h,
        state.city.roofColors[b.roof], state.city.buildingColors[b.color], near);
    }
  }

  function drawCar(list, car, flashing) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const rx = fz;
    const rz = -fx;
    const L = 2.3;
    const W = 1.05;
    const cx = car.x;
    const cz = car.z;
    const body = car.kind === 'police' ? PALETTE.police : PALETTE.car[car.color % PALETTE.car.length];
    const dark = car.kind === 'police' ? PALETTE.policeDark : shade(body, 0.55);
    // Body: roof + the two long sides + the two ends.
    const y0 = 0;
    const y1 = 0.85;
    const corners = [
      [cx - rx * W - fx * L, y0, cz - rz * W - fz * L],
      [cx + rx * W - fx * L, y0, cz + rz * W - fz * L],
      [cx + rx * W + fx * L, y0, cz + rz * W + fz * L],
      [cx - rx * W + fx * L, y0, cz - rz * W + fz * L],
    ];
    face(list, [
      [corners[0][0], y1, corners[0][2]], [corners[1][0], y1, corners[1][2]],
      [corners[2][0], y1, corners[2][2]], [corners[3][0], y1, corners[3][2]],
    ], body, 1.0);
    // Cabin, set back a little.
    const cL = 1.1;
    const cW = 0.85;
    const ccx = cx - fx * 0.3;
    const ccz = cz - fz * 0.3;
    const cc = [
      [ccx - rx * cW - fx * cL, 0.85, ccz - rz * cW - fz * cL],
      [ccx + rx * cW - fx * cL, 0.85, ccz + rz * cW - fz * cL],
      [ccx + rx * cW + fx * cL, 0.85, ccz + rz * cW + fz * cL],
      [ccx - rx * cW + fx * cL, 0.85, ccz - rz * cW + fz * cL],
    ];
    face(list, [
      [cc[0][0], 1.6, cc[0][2]], [cc[1][0], 1.6, cc[1][2]],
      [cc[2][0], 1.6, cc[2][2]], [cc[3][0], 1.6, cc[3][2]],
    ], shade(body, 0.85), 1.0);
    // Wheels: four dark blocks.
    for (const s1 of [-1, 1]) {
      for (const s2 of [-1, 1]) {
        const wx = cx + rx * W * s1 + fx * L * 0.72 * s2;
        const wz = cz + rz * W * s1 + fz * L * 0.72 * s2;
        face(list, [[wx - 0.5, 0, wz - 0.5], [wx + 0.5, 0, wz - 0.5], [wx + 0.5, 0.45, wz - 0.5], [wx - 0.5, 0.45, wz - 0.5]], '#15181c', 1);
      }
    }
    if (car.kind === 'police') {
      // The light bar, flashing red and blue.
      const bar = flashing ? '#ff2d2d' : '#2d7bff';
      const bx = cx - fx * 0.3;
      const bz = cz - fz * 0.3;
      face(list, [
        [bx - rx * 0.7, 1.75, bz - rz * 0.7], [bx + rx * 0.7, 1.75, bz + rz * 0.7],
        [bx + rx * 0.7, 1.95, bz + rz * 0.7], [bx - rx * 0.7, 1.95, bz - rz * 0.7],
      ], bar, 1);
    }
    if (car.kind === 'taxi') {
      face(list, [
        [cc[0][0], 1.65, cc[0][2]], [cc[1][0], 1.65, cc[1][2]],
        [cc[2][0], 1.65, cc[2][2]], [cc[3][0], 1.65, cc[3][2]],
      ], PALETTE.taxi, 1);
    }
  }

  function drawPerson(list, x, z, heading, color, scale, isPlayer) {
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const rx = fz;
    const rz = -fx;
    const w = 0.42 * scale;
    const h = 1.75 * scale;
    const jacket = isPlayer ? PALETTE.player : PALETTE.ped[color % PALETTE.ped.length];
    // Legs, torso, head.
    box(list, x, z, w * 1.4, w * 1.4, h * 0.45, '#2c3e50', '#2c3e50', false);
    box(list, x + fx * 0.1, z + fz * 0.1, w * 1.7, w * 1.7, h * 0.55, jacket, jacket, false);
    const hx = x + fx * 0.15;
    const hz = z + fz * 0.15;
    face(list, [
      [hx - rx * 0.3, h * 0.95, hz - rz * 0.3], [hx + rx * 0.3, h * 0.95, hz + rz * 0.3],
      [hx + rx * 0.3, h * 1.25, hz + rz * 0.3], [hx - rx * 0.3, h * 1.25, hz - rz * 0.3],
    ], '#e8b98a', 1);
  }

  /** A world point in camera space (x right, y up, z forward). */
  function toCam(x, y, z) {
    const dx = x - cam.pos.x;
    const dy = y - cam.pos.y;
    const dz = z - cam.pos.z;
    return {
      x: dx * cam.right.x + dy * cam.right.y + dz * cam.right.z,
      y: dx * cam.up.x + dy * cam.up.y + dz * cam.up.z,
      z: dx * cam.fwd.x + dy * cam.fwd.y + dz * cam.fwd.z,
    };
  }

  /** Clip a camera-space polygon against the near plane (z >= 1). */
  function clipNear(pts) {
    const out = [];
    for (let i = 0; i < pts.length; i += 1) {
      const cur = pts[i];
      const nxt = pts[(i + 1) % pts.length];
      const curIn = cur.z >= 1;
      const nxtIn = nxt.z >= 1;
      if (curIn) out.push(cur);
      if (curIn !== nxtIn) {
        const t = (1 - cur.z) / (nxt.z - cur.z);
        out.push({ x: cur.x + (nxt.x - cur.x) * t, y: cur.y + (nxt.y - cur.y) * t, z: 1 });
      }
    }
    return out;
  }

  /** Paint a polygon list in order (ground) or far-to-near (objects). */
  function paintList(list, sorted) {
    if (sorted) list.sort((a, b) => b.d - a.d);
    for (const item of list) {
      // Clip against the near plane first: a quad with a corner behind the
      // camera still covers the screen in front of it, so it must be clipped,
      // not dropped.
      const clipped = clipNear(item.pts.map((p) => toCam(p[0], p[1], p[2])));
      if (clipped.length < 3) continue;
      ctx.fillStyle = item.color;
      ctx.beginPath();
      for (let i = 0; i < clipped.length; i += 1) {
        const p = clipped[i];
        const sx = view.w / 2 + (cam.focal * p.x) / p.z;
        const sy = view.h / 2 - (cam.focal * p.y) / p.z;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawWorld(state) {
    // The ground is flat: paint it first, in layer order (dirt, sea, walks,
    // asphalt, plaza), so nearer ground never loses to a farther tile.
    const ground = [];
    drawGround(state, ground);
    paintList(ground, false);
    // Everything standing on it is sorted far-to-near.
    const list = [];
    drawBuildings(state, list);
    const flashing = Math.floor(state.time * 2) % 2 === 0;
    for (const car of state.cars) {
      const dx = car.x - state.player.x;
      const dz = car.z - state.player.z;
      if (dx * dx + dz * dz > VIEW_DIST * VIEW_DIST) continue;
      drawCar(list, car, flashing);
    }
    for (const ped of state.peds) {
      const dx = ped.x - state.player.x;
      const dz = ped.z - state.player.z;
      if (dx * dx + dz * dz > VIEW_DIST * VIEW_DIST) continue;
      drawPerson(list, ped.x, ped.z, ped.heading, ped.color, 1, false);
    }
    for (const cop of state.cops) {
      if (cop.kind === 'foot') drawPerson(list, cop.x, cop.z, cop.heading, 0, 1.05, false);
    }
    // Jax, on foot or at the wheel.
    const p = state.player;
    if (p.onFoot) drawPerson(list, p.x, p.z, p.heading, 0, 1.1, true);
    // Pickups.
    for (const item of state.pickups) {
      const col = item.kind === 'cash' ? '#2ecc71' : '#ffffff';
      box(list, item.x, item.z, 1.2, 1.2, 0.7, col, col, false);
    }
    paintList(list, true);
    // Screen-space effects last, so nothing paints over them.
    // The mission target's golden beam.
    if (state.mission && state.mission.target) {
      const t = state.mission.target;
      const base = project(t.x, 0, t.z);
      const top = project(t.x, 60, t.z);
      if (base && top) {
        ctx.strokeStyle = 'rgba(255, 210, 63, 0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();
      }
    }
    // Bullets as bright streaks.
    for (const b of state.bullets) {
      const bx = b.x - Math.sin(b.heading) * 1.2;
      const bz = b.z - Math.cos(b.heading) * 1.2;
      const a = project(b.x, 1, b.z);
      const c = project(bx, 1, bz);
      if (a && c) {
        ctx.strokeStyle = '#ffe9a8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      }
    }
    // Particles.
    for (const pt of state.particles) {
      const s = project(pt.x, pt.y, pt.z);
      if (!s) continue;
      const r = Math.max(1, (pt.size * cam.focal) / s.d);
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawMinimap(state) {
    const size = Math.min(210, view.w * 0.16 + 90);
    const x0 = view.w - size - 16;
    const y0 = view.h - size - 16;
    const H = CITY.half + 60;
    const scale = size / (H * 2);
    const px = (x) => x0 + (x + H) * scale;
    const pz = (z) => y0 + (z + H) * scale;
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.beginPath();
    ctx.roundRect(x0 - 6, y0 - 6, size + 12, size + 12, 10);
    ctx.fill();
    // Sea.
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(x0, pz(CITY.seaZ), size, y0 + size - pz(CITY.seaZ));
    // Streets.
    ctx.strokeStyle = '#5a636e';
    ctx.lineWidth = 3;
    for (const s of CITY.streets) {
      ctx.beginPath();
      ctx.moveTo(px(-H), pz(s));
      ctx.lineTo(px(H), pz(s));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px(s), pz(-H));
      ctx.lineTo(px(s), pz(H));
      ctx.stroke();
    }
    // Mission target.
    if (state.mission && state.mission.target) {
      const t = state.mission.target;
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(px(t.x), pz(t.z), 5 + Math.sin(state.time * 4) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cops.
    ctx.fillStyle = '#ff5252';
    for (const cop of state.cops) {
      ctx.beginPath();
      ctx.arc(px(cop.x), pz(cop.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Jax, as an arrow pointing where he faces (map north is up, heading 0 is south).
    const p = state.player;
    ctx.save();
    ctx.translate(px(p.x), pz(p.z));
    ctx.rotate(Math.PI - p.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    text('SOLMAR', x0, y0 - 10, 12, PALETTE.hudMuted, 'left');
  }

  function drawHud(state) {
    const p = state.player;
    // Cash and wanted, top left and top right.
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.beginPath();
    ctx.roundRect(14, 12, 196, 52, 10);
    ctx.fill();
    text(`$${p.cash}`, 28, 42, 26, PALETTE.gold, 'left', true);
    text(`HEALTH ${Math.ceil(p.health)}`, 28, 60, 13, p.health < 35 ? PALETTE.danger : PALETTE.hudText, 'left');
    // Health bar.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(120, 48, 76, 8);
    ctx.fillStyle = p.health < 35 ? PALETTE.danger : PALETTE.ok;
    ctx.fillRect(120, 48, 76 * Math.max(0, p.health / 100), 8);
    // Wanted stars.
    const stars = state.wanted;
    text('★'.repeat(stars) + '☆'.repeat(5 - stars), view.w - 20, 44, 30, stars > 0 ? PALETTE.danger : PALETTE.hudMuted, 'right', true);
    if (state.wanted > 0) text('WANTED', view.w - 20, 64, 12, PALETTE.danger, 'right');
    // Mission panel.
    if (state.mission && state.mission.index > 0) {
      const m = state.mission;
      const label = m.timer > 0 ? `${m.label} — ${Math.ceil(m.timer)}s` : m.label;
      ctx.fillStyle = PALETTE.hudPanel;
      ctx.beginPath();
      ctx.roundRect(14, 74, Math.min(460, 24 + label.length * 7.5), 34, 10);
      ctx.fill();
      text(`◆ ${m.label}${m.timer > 0 ? ` — ${Math.ceil(m.timer)}s` : ''}`, 28, 97, 15, PALETTE.hudText, 'left');
    }
    // Speed, bottom left, while driving.
    if (!p.onFoot && p.car) {
      text(`${Math.round(Math.abs(p.car.speed) * 3.6)} km/h`, 24, view.h - 24, 22, PALETTE.hudText, 'left', true);
    }
    // The message feed, fading.
    let y = view.h - 120;
    for (let i = state.messages.length - 1; i >= 0 && i > state.messages.length - 4; i -= 1) {
      const msg = state.messages[i];
      const age = state.time - msg.t;
      if (age > 6) continue;
      ctx.globalAlpha = Math.max(0.25, 1 - age / 6);
      text(msg.text, 24, y, 16, PALETTE.hudText, 'left');
      ctx.globalAlpha = 1;
      y -= 24;
    }
    // Waypoint arrow at the screen edge when the target is off-screen.
    if (state.mission && state.mission.target) {
      const t = state.mission.target;
      const s = project(t.x, 2, t.z);
      const onScreen = s && s.x > 40 && s.x < view.w - 40 && s.y > 40 && s.y < view.h - 40;
      if (!onScreen) {
        const dx = t.x - p.x;
        const dz = t.z - p.z;
        const ang = Math.atan2(dx, dz) - state.camera.yaw;
        const ax = view.w / 2 + Math.sin(ang) * (view.h * 0.32);
        const ay = view.h / 2 - Math.cos(ang) * (view.h * 0.32);
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(Math.atan2(Math.sin(ang), Math.cos(ang)));
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(10, 8);
        ctx.lineTo(-10, 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        const dist = Math.round(Math.hypot(dx, dz));
        text(`${dist}m`, ax, ay + 30, 13, PALETTE.gold, 'center', true);
      }
    }
    // Hurt flash.
    if (state.time - (state.lastHurt || -10) < 0.4) {
      ctx.fillStyle = 'rgba(255, 40, 40, 0.18)';
      ctx.fillRect(0, 0, view.w, view.h);
    }
    drawMinimap(state);
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = Math.min(640, view.w - 60);
    const height = 150 + lines.length * 32;
    const x = (view.w - width) / 2;
    const y = (view.h - height) / 2;
    ctx.fillStyle = 'rgba(8, 12, 20, 0.78)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 14);
    ctx.fill();
    ctx.strokeStyle = accent || PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    text(title, view.w / 2, y + 62, 44, PALETTE.hudText, 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], view.w / 2, y + 108 + i * 32, 18, PALETTE.hudMuted, 'center');
    }
    text(prompt, view.w / 2, y + height - 30, 20, PALETTE.gold, 'center');
  }

  /** Paint one frame: sky, world, HUD, then a panel for the screen the game is on. */
  function draw(state, screen, best) {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    computeCamera(state);
    drawSky(state);
    drawWorld(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('SOLMAR HEAT', [
        'A sun-soaked open-world crime game. You are Jax Rook.',
        'Steal cars. Outrun the Solmar PD. Run four jobs for Rico and Mara.',
        'WASD drive & walk · Shift run · E steal car · F shoot · P pause',
        `Best haul: $${best}`,
      ], 'Press Space or click to start');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['Solmar waits for no one. Except now.'], 'Press P to keep playing');
    } else if (screen === SCREEN_OVER) {
      const busted = state.overReason === 'busted';
      drawPanel(busted ? 'BUSTED' : 'WASTED', [
        busted ? 'The Solmar PD finally caught up with Jax.' : 'Jax went down in the streets of Solmar.',
        `Cash kept: $${state.player.cash} · Missions done: ${state.stats.missionsDone}`,
        `Best haul: $${best}`,
      ], 'Press Space to try again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToGround };
}
