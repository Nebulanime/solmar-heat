// SOLMAR HEAT — render.mjs
// World rendering: the ground, roads and lane markings, beach and sea,
// buildings with shaded roofs, the park, mission markers, cars,
// pedestrians, police and the player — all drawn as flat vector shapes
// on one canvas, in a hot noon palette.
import { WORLD_W, WORLD_H, ROAD_STEP, ROAD_W, BEACH_X, COLORS } from './config.mjs';

export function drawWorld(ctx, G) {
  const cam = G.camera;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  // Ground.
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // Beach sand and sea on the east edge.
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(BEACH_X, 0, WORLD_W - BEACH_X, WORLD_H);
  ctx.fillStyle = COLORS.sea;
  ctx.fillRect(WORLD_W - 120, 0, 120, WORLD_H);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(WORLD_W - 126, 0, 6, WORLD_H);
  // Parks.
  for (const park of G.city.parks) {
    ctx.fillStyle = '#5d9e4a';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = '#3f7a35';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(park.x + 24 + (i % 3) * 56, park.y + 30 + Math.floor(i / 3) * 90, 16, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Roads.
  ctx.fillStyle = COLORS.road;
  for (const r of G.city.roads) {
    if (r.vertical) ctx.fillRect(r.x, 0, ROAD_W, WORLD_H);
    else ctx.fillRect(0, r.y, WORLD_W, ROAD_W);
  }
  // Sidewalks.
  ctx.fillStyle = COLORS.sidewalk;
  for (const r of G.city.roads) {
    if (r.vertical) { ctx.fillRect(r.x - 8, 0, 8, WORLD_H); ctx.fillRect(r.x + ROAD_W, 0, 8, WORLD_H); }
    else { ctx.fillRect(0, r.y - 8, WORLD_W, 8); ctx.fillRect(0, r.y + ROAD_W, WORLD_W, 8); }
  }
  // Centre lane dashes.
  ctx.fillStyle = COLORS.roadLine;
  for (let x = 0; x <= WORLD_W; x += ROAD_STEP) {
    for (let y = 0; y < WORLD_H; y += 40) ctx.fillRect(x + ROAD_W / 2 - 2, y, 4, 18);
  }
  for (let y = 0; y <= WORLD_H; y += ROAD_STEP) {
    for (let x = 0; x < WORLD_W; x += 40) ctx.fillRect(x, y + ROAD_W / 2 - 2, 18, 4);
  }
  // Buildings with a roof inset and a height shadow.
  for (const b of G.city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 5 + b.height, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, 6);
    if (b.landmark) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('SOLMAR TOWER', b.x + 6, b.y - 6);
    }
  }
  // Mission target marker: a pulsing ring + beacon.
  if (G.missions.active && !G.missions.done) {
    const m = G.missions.list[G.missions.index];
    if (m.target) {
      const pulse = 1 + Math.sin(G.time * 4) * 0.18;
      ctx.strokeStyle = '#4db8ff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(m.target.x, m.target.y, 46 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(77,184,255,0.25)';
      ctx.beginPath();
      ctx.arc(m.target.x, m.target.y, 46 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4db8ff';
      ctx.beginPath();
      ctx.moveTo(m.target.x, m.target.y - 34);
      ctx.lineTo(m.target.x + 12, m.target.y - 12);
      ctx.lineTo(m.target.x - 12, m.target.y - 12);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Parked + traffic cars, police cars, pedestrians, player.
  for (const c of G.cars) drawCar(ctx, c);
  for (const c of G.traffic) drawCar(ctx, c);
  for (const u of G.police.units) drawCar(ctx, u.car, true);
  for (const p of G.peds) drawPed(ctx, p);
  drawPlayer(ctx, G.player);
  // Bullet tracers and punch flashes.
  ctx.strokeStyle = '#ffe27a';
  ctx.lineWidth = 3;
  for (const b of G.combat.bullets) {
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.ex, b.ey); ctx.stroke();
  }
  for (const f of G.combat.flashes) {
    ctx.fillStyle = 'rgba(255,226,122,0.8)';
    ctx.beginPath(); ctx.arc(f.x, f.y, 12, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawCar(ctx, car, isCop = false) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-19, -11, 40, 26);
  ctx.fillStyle = car.wrecked ? '#555' : car.color;
  ctx.fillRect(-20, -12, 40, 24);
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  ctx.fillRect(-4, -10, 12, 20);
  ctx.fillStyle = '#111';
  ctx.fillRect(-16, -13, 7, 4); ctx.fillRect(-16, 9, 7, 4);
  ctx.fillRect(10, -13, 7, 4); ctx.fillRect(10, 9, 7, 4);
  ctx.fillStyle = '#ffe27a';
  ctx.fillRect(19, -9, 2, 5); ctx.fillRect(19, 4, 2, 5);
  if (isCop) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-2, -12, 6, 24);
    ctx.fillStyle = '#e33b3b';
    ctx.fillRect(-8, -12, 4, 5);
    ctx.fillStyle = '#3b7fe3';
    ctx.fillRect(-8, 7, 4, 5);
  }
  ctx.restore();
}

export function drawPed(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.state === 'down') {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(-12, -5, 24, 10);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 8, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath(); ctx.arc(0, -11, 5, 0, Math.PI * 2); ctx.fill();
    if (p.state === 'panic') {
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText('!', -3, -20);
    }
  }
  ctx.restore();
}

export function drawPlayer(ctx, player) {
  if (player.inCar || player.dead) return;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 9, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = COLORS.player;
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd9a0';
  ctx.beginPath(); ctx.arc(4, 0, 6, 0, Math.PI * 2); ctx.fill();
  // Facing nose.
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(6, -5); ctx.lineTo(6, 5); ctx.closePath(); ctx.fill();
  if (player.punching) {
    ctx.fillStyle = '#ffd9a0';
    ctx.beginPath(); ctx.arc(24, 0, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Player ring so the eye never loses Nova in a crowd.
  ctx.strokeStyle = 'rgba(255,95,162,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(player.x, player.y, 17, 0, Math.PI * 2); ctx.stroke();
  // Direction tick on the ring, showing which way Nova faces.
  ctx.strokeStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(player.x + Math.cos(player.angle) * 17, player.y + Math.sin(player.angle) * 17);
  ctx.lineTo(player.x + Math.cos(player.angle) * 24, player.y + Math.sin(player.angle) * 24);
  ctx.stroke();
}
