// SOLMAR HEAT — the renderer: a hand-rolled sun-soaked pseudo-3D city on a 2D
// canvas. An oblique projection turns the world grid into a diorama: sky and sea
// behind, roads and blocks on the ground, buildings extruded with lit roofs and
// shaded sides, cars and locals sorted by depth, and a gold beacon over the job.
import { CFG, PALETTE } from './config.mjs';

export function updateCamera(S, dt) {
  const cam = S.camera;
  const p = S.player;
  const targetYaw = p.heading + S.camera.orbit;
  let d = targetYaw - cam.yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  cam.yaw += d * Math.min(1, dt * 4);
  const tx = p.x - Math.sin(cam.yaw) * 46;
  const tz = p.z - Math.cos(cam.yaw) * 46;
  cam.x += (tx - cam.x) * Math.min(1, dt * 5);
  cam.z += (tz - cam.z) * Math.min(1, dt * 5);
  const driving = !p.onFoot && p.car ? Math.abs(p.car.speed) / CFG.carMaxSpeed : 0;
  cam.zoom += ((driving > 0.5 ? 0.82 : 1) - cam.zoom) * Math.min(1, dt * 2);
}

export function projectPoint(S, W, H, wx, wz, h = 0) {
  const cam = S.camera;
  const scale = CFG.camScale * cam.zoom * (W / 1280);
  const rx = wx - cam.x;
  const rz = wz - cam.z;
  const right = rx * Math.cos(cam.yaw) - rz * Math.sin(cam.yaw);
  const fwd = rx * Math.sin(cam.yaw) + rz * Math.cos(cam.yaw);
  return {
    x: W / 2 + right * scale,
    y: H * 0.62 - fwd * scale * CFG.camTilt - h * scale,
    fwd,
    scale,
  };
}

function screenAngle(S, heading) {
  const d = heading - S.camera.yaw;
  return Math.atan2(-Math.cos(d) * CFG.camTilt, Math.sin(d));
}

function drawSky(ctx, S, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.55, '#bfe6f7');
  g.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Sun with a soft halo.
  const sunX = W * 0.82;
  const sunY = H * 0.12;
  const halo = ctx.createLinearGradient(sunX - 90, sunY - 90, sunX + 90, sunY + 90);
  ctx.fillStyle = 'rgba(255, 244, 200, 0.5)';
  ctx.beginPath(); ctx.arc(sunX, sunY, 66, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff6cf';
  ctx.beginPath(); ctx.arc(sunX, sunY, 34, 0, Math.PI * 2); ctx.fill();
  // Drifting clouds, placed from the clock so the scene stays alive.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 5; i += 1) {
    const cx = ((i * 263 + S.time * 6) % (W + 260)) - 130;
    const cy = 40 + i * 26;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 52, 15, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 34, cy + 6, 38, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function groundQuad(ctx, S, W, H, x0, z0, x1, z1, color) {
  const a = projectPoint(S, W, H, x0, z0);
  const b = projectPoint(S, W, H, x1, z0);
  const c = projectPoint(S, W, H, x1, z1);
  const d = projectPoint(S, W, H, x0, z1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
  ctx.closePath(); ctx.fill();
}

function drawGround(ctx, S, W, H) {
  const b = CFG.halfWorld + 220;
  groundQuad(ctx, S, W, H, -b, -b, b, S.city.beachZ, PALETTE.grass);
  groundQuad(ctx, S, W, H, -b, S.city.beachZ, b, S.city.seaZ + 260, PALETTE.sand);
  groundQuad(ctx, S, W, H, -b, S.city.seaZ, b, S.city.seaZ + 260, PALETTE.sea);
  // Sea shimmer lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i += 1) {
    const z = S.city.seaZ + 40 + i * 36;
    const a = projectPoint(S, W, H, -b + ((S.time * 20 + i * 90) % 300), z);
    const c = projectPoint(S, W, H, -b + 120 + ((S.time * 20 + i * 90) % 300), z);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
  }
  // Roads as dark quads with dashed centre lines.
  for (const line of S.city.roads) {
    const hw = CFG.roadWidth / 2;
    groundQuad(ctx, S, W, H, line - hw, -CFG.halfWorld, line + hw, CFG.halfWorld, PALETTE.road);
    groundQuad(ctx, S, W, H, -CFG.halfWorld, line - hw, CFG.halfWorld, line + hw, PALETTE.road);
  }
  ctx.strokeStyle = PALETTE.laneMark;
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 18]);
  for (const line of S.city.roads) {
    const a = projectPoint(S, W, H, line, -CFG.halfWorld);
    const c = projectPoint(S, W, H, line, CFG.halfWorld);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    const d = projectPoint(S, W, H, -CFG.halfWorld, line);
    const e = projectPoint(S, W, H, CFG.halfWorld, line);
    ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(e.x, e.y); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Plaza paving.
  const pl = S.city.landmarks.plaza;
  const pc = projectPoint(S, W, H, pl.x, pl.z);
  ctx.fillStyle = PALETTE.plaza;
  ctx.beginPath(); ctx.ellipse(pc.x, pc.y, 52 * pc.scale, 30 * pc.scale, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b8a67e';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(pc.x, pc.y, 52 * pc.scale, 30 * pc.scale, 0, 0, Math.PI * 2); ctx.stroke();
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

function drawBuilding(ctx, S, W, H, b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const corners = [
    projectPoint(S, W, H, b.x - hw, b.z - hd),
    projectPoint(S, W, H, b.x + hw, b.z - hd),
    projectPoint(S, W, H, b.x + hw, b.z + hd),
    projectPoint(S, W, H, b.x - hw, b.z + hd),
  ];
  const tops = [
    projectPoint(S, W, H, b.x - hw, b.z - hd, b.h),
    projectPoint(S, W, H, b.x + hw, b.z - hd, b.h),
    projectPoint(S, W, H, b.x + hw, b.z + hd, b.h),
    projectPoint(S, W, H, b.x - hw, b.z + hd, b.h),
  ];
  // Ground shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.moveTo(corners[0].x + 6, corners[0].y + 4);
  ctx.lineTo(corners[1].x + 6, corners[1].y + 4);
  ctx.lineTo(corners[2].x + 6, corners[2].y + 4);
  ctx.lineTo(corners[3].x + 6, corners[3].y + 4);
  ctx.closePath(); ctx.fill();
  // Two visible sides: the far side darker, the near side mid.
  ctx.fillStyle = shade(b.color, 0.62);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y); ctx.lineTo(corners[1].x, corners[1].y);
  ctx.lineTo(tops[1].x, tops[1].y); ctx.lineTo(tops[0].x, tops[0].y);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(b.color, 0.82);
  ctx.beginPath();
  ctx.moveTo(corners[1].x, corners[1].y); ctx.lineTo(corners[2].x, corners[2].y);
  ctx.lineTo(tops[2].x, tops[2].y); ctx.lineTo(tops[1].x, tops[1].y);
  ctx.closePath(); ctx.fill();
  // Roof with a parapet edge.
  ctx.fillStyle = b.roof;
  ctx.beginPath();
  ctx.moveTo(tops[0].x, tops[0].y); ctx.lineTo(tops[1].x, tops[1].y);
  ctx.lineTo(tops[2].x, tops[2].y); ctx.lineTo(tops[3].x, tops[3].y);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Windows on the near side.
  const rows = Math.max(1, Math.floor(b.h / 16));
  ctx.fillStyle = 'rgba(40, 70, 110, 0.55)';
  for (let r = 0; r < rows; r += 1) {
    const t = (r + 0.6) / (rows + 0.4);
    const y = corners[1].y + (tops[1].y - corners[1].y) * t;
    const y2 = corners[2].y + (tops[2].y - corners[2].y) * t;
    const x1 = corners[1].x + (corners[2].x - corners[1].x) * 0.2;
    const x2 = corners[1].x + (corners[2].x - corners[1].x) * 0.8;
    ctx.fillRect(Math.min(x1, x2), Math.min(y, y2) - 3, Math.abs(x2 - x1), 6);
  }
}

function drawCar(ctx, S, W, H, car) {
  const c = projectPoint(S, W, H, car.x, car.z);
  const s = c.scale;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(c.x + 3, c.y + 3, 13 * s, 7 * s, screenAngle(S, car.heading), 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(screenAngle(S, car.heading));
  const L = 22 * s;
  const Wid = 11 * s;
  ctx.fillStyle = car.kind === 'cop' ? '#1c2f4a' : car.color;
  ctx.beginPath();
  ctx.roundRect(-L / 2, -Wid / 2, L, Wid, 3 * s);
  ctx.fill();
  ctx.fillStyle = 'rgba(20, 40, 70, 0.85)';
  ctx.fillRect(-L * 0.18, -Wid * 0.38, L * 0.22, Wid * 0.76);
  ctx.fillStyle = shade(car.kind === 'cop' ? '#1c2f4a' : car.color, 0.75);
  ctx.fillRect(L * 0.08, -Wid * 0.38, L * 0.2, Wid * 0.76);
  if (car.kind === 'cop') {
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(-L * 0.02, -Wid * 0.32, L * 0.1, Wid * 0.28);
    ctx.fillStyle = '#2e7df2';
    ctx.fillRect(-L * 0.02, Wid * 0.05, L * 0.1, Wid * 0.28);
    if (Math.floor(S.time * 4) % 2 === 0) {
      ctx.fillStyle = 'rgba(255, 60, 50, 0.5)';
      ctx.beginPath(); ctx.arc(0, 0, 20 * s, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(L / 2 - 2 * s, -Wid * 0.32, 2 * s, 3 * s);
    ctx.fillRect(L / 2 - 2 * s, Wid * 0.08, 2 * s, 3 * s);
  }
  ctx.restore();
}

function drawPed(ctx, S, W, H, ped) {
  const c = projectPoint(S, W, H, ped.x, ped.z);
  const s = c.scale;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(c.x, c.y + 2, 5 * s, 2.5 * s, 0, 0, Math.PI * 2); ctx.fill();
  const bob = ped.state === 'walk' ? Math.sin(S.time * 9 + ped.x) * 1.5 : 0;
  ctx.fillStyle = ped.color;
  ctx.beginPath(); ctx.arc(c.x, c.y - 7 * s + bob, 3.2 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(c.x - 3 * s, c.y - 6 * s + bob, 6 * s, 7 * s);
  ctx.fillStyle = '#2c2118';
  ctx.beginPath(); ctx.arc(c.x, c.y - 10 * s + bob, 2.4 * s, 0, Math.PI * 2); ctx.fill();
}

function drawMarker(ctx, S, W, H) {
  const m = S.mission;
  if (!m || !m.target) return;
  const t = m.target;
  const c = projectPoint(S, W, H, t.x, t.z);
  const s = c.scale;
  const pulse = 0.5 + 0.5 * Math.sin(S.time * 3);
  ctx.fillStyle = `rgba(255, 217, 74, ${0.25 + pulse * 0.2})`;
  ctx.beginPath(); ctx.ellipse(c.x, c.y, 26 * s, 12 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffd94a';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(c.x, c.y, 26 * s, 12 * s, 0, 0, Math.PI * 2); ctx.stroke();
  const bob = Math.sin(S.time * 2.5) * 6;
  const top = projectPoint(S, W, H, t.x, t.z, 46 + bob);
  ctx.fillStyle = 'rgba(255, 217, 74, 0.35)';
  ctx.fillRect(c.x - 3 * s, top.y, 6 * s, c.y - top.y);
  ctx.fillStyle = '#ffd94a';
  ctx.save();
  ctx.translate(top.x, top.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-7 * s, -7 * s, 14 * s, 14 * s);
  ctx.restore();
  ctx.fillStyle = '#1c2f4a';
  ctx.font = `bold ${Math.max(11, 13 * s)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(t.label, c.x, top.y - 12);
}

function drawBullets(ctx, S, W, H) {
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2;
  for (const b of S.bullets) {
    const a = projectPoint(S, W, H, b.x, b.z);
    const c = projectPoint(S, W, H, b.x - b.vx * 0.03, b.z - b.vz * 0.03);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
  }
  if (S.tracer) {
    const a = projectPoint(S, W, H, S.tracer.x1, S.tracer.z1);
    const c = projectPoint(S, W, H, S.tracer.x2, S.tracer.z2);
    ctx.strokeStyle = 'rgba(255, 120, 90, 0.8)';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
  }
}

function drawLooseCash(ctx, S, W, H) {
  for (const c of S.looseCash) {
    const p = projectPoint(S, W, H, c.x, c.z);
    ctx.fillStyle = '#2fae4e';
    ctx.beginPath(); ctx.arc(p.x, p.y, 5 * p.scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(9, 10 * p.scale)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('$', p.x, p.y + 3);
  }
}

function drawPalm(ctx, S, W, H, palm) {
  const c = projectPoint(S, W, H, palm.x, palm.z);
  const s = c.scale;
  ctx.strokeStyle = '#7a5c33';
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + 2 * s, c.y - 16 * s); ctx.stroke();
  ctx.fillStyle = '#2e9e4a';
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.ellipse(c.x + 2 * s + Math.cos(a) * 7 * s, c.y - 16 * s + Math.sin(a) * 3 * s, 8 * s, 3 * s, a, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawOverlay(ctx, W, H, title, lines, accent) {
  ctx.fillStyle = 'rgba(8, 14, 26, 0.62)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(title, W / 2, H / 2 - 60);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, W / 2, H / 2 - 10 + i * 32));
}

export function render(ctx, S, W, H, input) {
  drawSky(ctx, S, W, H);
  drawGround(ctx, S, W, H);
  // Depth-sorted drawables: far (large fwd) first.
  const items = [];
  for (const b of S.city.buildings) {
    const c = projectPoint(S, W, H, b.x, b.z);
    if (c.x < -160 || c.x > W + 160 || c.y < -220 || c.y > H + 160) continue;
    items.push({ key: c.fwd, draw: () => drawBuilding(ctx, S, W, H, b) });
  }
  for (const palm of S.city.palms) {
    const c = projectPoint(S, W, H, palm.x, palm.z);
    if (c.x < -60 || c.x > W + 60 || c.y < -60 || c.y > H + 60) continue;
    items.push({ key: c.fwd, draw: () => drawPalm(ctx, S, W, H, palm) });
  }
  for (const car of S.cars) {
    const c = projectPoint(S, W, H, car.x, car.z);
    if (c.x < -80 || c.x > W + 80 || c.y < -80 || c.y > H + 80) continue;
    items.push({ key: c.fwd, draw: () => drawCar(ctx, S, W, H, car) });
  }
  for (const ped of S.peds) {
    const c = projectPoint(S, W, H, ped.x, ped.z);
    if (c.x < -40 || c.x > W + 40 || c.y < -40 || c.y > H + 40) continue;
    items.push({ key: c.fwd, draw: () => drawPed(ctx, S, W, H, ped) });
  }
  // Jax himself, on foot: gold jacket so he always reads as the player.
  if (S.player.onFoot) {
    const c = projectPoint(S, W, H, S.player.x, S.player.z);
    items.push({
      key: c.fwd,
      draw: () => drawPed(ctx, S, W, H, {
        x: S.player.x, z: S.player.z, color: '#e8b04a', state: 'walk', panic: 0,
      }),
    });
  }
  items.sort((a, b) => b.key - a.key);
  for (const item of items) item.draw();
  drawMarker(ctx, S, W, H);
  drawBullets(ctx, S, W, H);
  drawLooseCash(ctx, S, W, H);

  // Mouse aim: turn the pointer into a world heading for the pistol.
  if (input && input.mouse) {
    const pc = projectPoint(S, W, H, S.player.x, S.player.z);
    const dx = input.mouse.x - pc.x;
    const dy = input.mouse.y - pc.y;
    const right = dx;
    const fwd = -dy / CFG.camTilt;
    const wx = Math.cos(S.camera.yaw) * right + Math.sin(S.camera.yaw) * fwd;
    const wz = -Math.sin(S.camera.yaw) * right + Math.cos(S.camera.yaw) * fwd;
    if (Math.abs(wx) + Math.abs(wz) > 4) {
      S.screenAim = { x: wx, y: wz };
    }
  }

  if (S.screen === 'title') {
    drawOverlay(ctx, W, H, 'SOLMAR HEAT', [
      'An open-world crime story in the sun-soaked city of Solmar',
      'Jax Rook · Rico · Mara — steal cars, run jobs, outrun Solmar PD',
      'Press SPACE or click to start — WASD move · E steal car · F shoot',
      S.saveExists ? 'Save found — press C to continue your story' : 'No save yet — a fresh start in Solmar',
    ], '#ffd94a');
  } else if (S.shotTitle) {
    // Cover-shot title band: names the game without dimming the city, the HUD
    // or the minimap underneath. Sits below the objective banner (y 66-96).
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10, 16, 24, 0.55)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 250, 118, 500, 92, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('SOLMAR HEAT', W / 2, 170);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('An open-world crime story in the sun-soaked city of Solmar', W / 2, 198);
  } else if (S.screen === 'busted') {
    drawOverlay(ctx, W, H, 'BUSTED', ['Solmar PD caught up with Jax.', 'Press SPACE to walk out of the precinct and keep playing.'], '#7ec8f2');
  } else if (S.screen === 'wasted') {
    drawOverlay(ctx, W, H, 'WASTED', ['Jax went down hard in the streets of Solmar.', 'Press SPACE to get patched up at Solmar General.'], '#e05a4e');
  } else if (S.screen === 'complete') {
    drawOverlay(ctx, W, H, 'KING OF SOLMAR', [
      'Every job done. Rico and Mara split the take with Jax.',
      `Final cash: $${S.player.cash} — press SPACE to keep cruising Solmar.`,
    ], '#ffd94a');
  }
}
