// SOLMAR HEAT — the HUD: cash, health, wanted stars, mission objective, message
// toasts, prompts, and the minimap — a live top-down of Solmar with the player
// arrow, traffic, cruisers in red and the job marker in gold.
import { CFG, STARS, wantedStars } from './config.mjs';
import { objectiveText } from './missions.mjs';

export function drawHud(ctx, S, W, H) {
  const p = S.player;
  ctx.textBaseline = 'alphabetic';
  // Top-left: cash + health.
  ctx.fillStyle = 'rgba(10, 16, 24, 0.55)';
  roundRect(ctx, 14, 12, 250, 64, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${p.cash}`, 26, 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(S.mission ? S.mission.title : '', 26, 60);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(26, 66, 120, 8);
  ctx.fillStyle = p.health > 30 ? '#3ddc5a' : '#e03a2e';
  ctx.fillRect(26, 66, Math.max(0, 120 * (p.health / CFG.playerHealth)), 8);
  // Top-right: wanted stars.
  const stars = wantedStars(S.heat);
  ctx.fillStyle = 'rgba(10, 16, 24, 0.55)';
  roundRect(ctx, W - 214, 12, 200, 44, 10);
  ctx.fill();
  ctx.fillStyle = stars > 0 ? '#ffd94a' : 'rgba(255,255,255,0.6)';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(STARS[stars], W - 26, 42);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(stars > 0 ? 'SOLMAR PD' : 'CLEAN', W - 26, 52);
  // Objective banner under the top bar.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(10, 16, 24, 0.55)';
  const obj = objectiveText(S);
  const ow = ctx.measureText(obj).width + 36;
  roundRect(ctx, (W - ow) / 2, 66, ow, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(obj, W / 2, 86);
  // Toast message.
  if (S.message && S.time < S.messageUntil) {
    ctx.fillStyle = 'rgba(20, 24, 40, 0.7)';
    const mw = ctx.measureText(S.message).width + 32;
    roundRect(ctx, (W - mw) / 2, H - 118, mw, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(S.message, W / 2, H - 99);
  }
  // Context prompt.
  if (S.prompt) {
    ctx.fillStyle = 'rgba(10, 16, 24, 0.6)';
    const pw = ctx.measureText(S.prompt).width + 30;
    roundRect(ctx, (W - pw) / 2, H - 158, pw, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(S.prompt, W / 2, H - 139);
  }
  // Controls footnote.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD move / drive · Shift run · E steal car · F shoot · drag mouse to orbit · M mute', 14, H - 14);
  drawMinimap(ctx, S, W - 174, H - 174, 160);
}

export function drawMinimap(ctx, S, x, y, size) {
  const half = CFG.halfWorld;
  const scale = size / (half * 2);
  const toMap = (wx, wz) => [x + (wx + half) * scale, y + (wz + half) * scale];
  ctx.save();
  ctx.fillStyle = 'rgba(8, 14, 22, 0.72)';
  roundRect(ctx, x - 6, y - 6, size + 12, size + 12, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  // Sea + sand + ground.
  ctx.fillStyle = '#2e9fc4';
  ctx.fillRect(x, y + (S.city.beachZ + half) * scale, size, size - (S.city.beachZ + half) * scale);
  ctx.fillStyle = '#3a4a3a';
  ctx.fillRect(x, y, size, (S.city.beachZ + half) * scale);
  // Roads.
  ctx.strokeStyle = '#5a6068';
  ctx.lineWidth = Math.max(1, CFG.roadWidth * scale);
  for (const line of S.city.roads) {
    const [ax, ay] = toMap(line, -half);
    const [bx, by] = toMap(line, half);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    const [cx, cy] = toMap(-half, line);
    const [dx, dy] = toMap(half, line);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(dx, dy); ctx.stroke();
  }
  // Mission target.
  const t = S.mission && S.mission.target;
  if (t) {
    const [tx, ty] = toMap(t.x, t.z);
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath(); ctx.arc(tx, ty, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7a5c00';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(tx, ty, 6, 0, Math.PI * 2); ctx.stroke();
  }
  // Cops in red.
  ctx.fillStyle = '#ff4a3a';
  for (const cop of S.cops) {
    const [cx, cy] = toMap(cop.x, cop.z);
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow: world heading (sin h, cos h) maps to a screen rotation of PI - h.
  const [px, py] = toMap(S.player.x, S.player.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.PI - S.player.heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
