// SOLMAR HEAT — hud.mjs
// Everything drawn on top of the world: health and money, wanted stars,
// the mission objective line, speed, the minimap in the corner and the
// start / pause / game-over screens.
import { WORLD_W, WORLD_H, GAME_TITLE, CITY_NAME } from './config.mjs';

export function drawHud(ctx, G, canvas) {
  const { player, police, missions } = G;
  const cx = canvas.width / 2;
  ctx.save();
  // Health bar, top-left.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, 14, 220, 54);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('NOVA VEGA', 24, 34);
  ctx.fillStyle = '#222';
  ctx.fillRect(24, 42, 180, 12);
  ctx.fillStyle = player.health > 30 ? '#3be37f' : '#e33b3b';
  ctx.fillRect(24, 42, 180 * (player.health / 100), 12);
  ctx.fillStyle = '#fff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`$${player.money}`, 24, 62);
  // Wanted label under the stars so the level reads at a glance.
  ctx.fillStyle = police.wanted > 0 ? '#ffd94d' : '#ccc';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(police.wanted > 0 ? `WANTED LEVEL ${police.wanted}` : 'CLEAN', cx, 62);
  ctx.textAlign = 'left';
  // Wanted stars, top-centre.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(cx - 95, 14, 190, 34);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < police.wanted ? '#ffd94d' : 'rgba(255,255,255,0.25)';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('★', cx - 82 + i * 36, 39);
  }
  // Mission objective, under the stars and the wanted label.
  if (missions.active && !missions.done) {
    const m = missions.list[missions.index];
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(cx - 380, 92, 760, 30);
    ctx.fillStyle = '#8fd4ff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`▸ ${m.name}: ${m.brief.slice(0, 68)}`, cx, 111);
    ctx.textAlign = 'left';
  }
  // Mission toast message.
  if (missions.messageTimer > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(40, canvas.height - 92, canvas.width - 80, 40);
    ctx.fillStyle = '#ffe27a';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(missions.message.slice(0, 110), canvas.width / 2, canvas.height - 66);
    ctx.textAlign = 'left';
  }
  // Speed + context hint, bottom-left.
  const speed = player.inCar ? Math.round(Math.abs(player.inCar.speed) * 0.36) : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, canvas.height - 64, 300, 50);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(player.inCar ? `${speed} km/h — DRIVING` : 'ON FOOT', 24, canvas.height - 42);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#ddd';
  ctx.fillText(player.inCar ? 'WASD drive · E exit · Space horn' : 'WASD move · E steal car · Space punch · F shoot', 24, canvas.height - 24);
  // Clock.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(canvas.width - 118, canvas.height - 64, 104, 50);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(G.clock, canvas.width - 104, canvas.height - 42);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#ddd';
  ctx.fillText(CITY_NAME + ' · noon', canvas.width - 104, canvas.height - 24);
  ctx.restore();
}

export function drawMinimap(ctx, G, canvas) {
  const size = 168;
  const x0 = canvas.width - size - 14;
  const y0 = 92;
  const sx = size / WORLD_W;
  const sy = size / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.fillStyle = '#5a7a4a';
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(x0 + 2880 * sx, y0, size - 2880 * sx, size);
  ctx.fillStyle = '#3c3f46';
  for (let x = 0; x <= WORLD_W; x += 200) ctx.fillRect(x0 + x * sx - 1, y0, 2, size);
  for (let y = 0; y <= WORLD_H; y += 200) ctx.fillRect(x0, y0 + y * sy, size, 2);
  // Mission target marker.
  if (G.missions.active && !G.missions.done) {
    const m = G.missions.list[G.missions.index];
    if (m.target) {
      ctx.fillStyle = '#4db8ff';
      ctx.beginPath();
      ctx.arc(x0 + m.target.x * sx, y0 + m.target.y * sy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  // Police blips.
  ctx.fillStyle = '#2244ff';
  for (const u of G.police.units) {
    ctx.beginPath();
    ctx.arc(x0 + u.car.x * sx, y0 + u.car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const px = G.player.inCar ? G.player.inCar.x : G.player.x;
  const py = G.player.inCar ? G.player.inCar.y : G.player.y;
  ctx.fillStyle = '#ff5fa2';
  ctx.beginPath();
  ctx.arc(x0 + px * sx, y0 + py * sy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('SOLMAR', x0, y0 - 8);
  ctx.restore();
}

export function drawTitle(ctx, canvas, saved) {
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#ff9a3d');
  grad.addColorStop(0.55, '#c94a6a');
  grad.addColorStop(1, '#2b1a4a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(0, canvas.height - 120, canvas.width, 120);
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(0, canvas.height - 128, canvas.width, 8);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText(GAME_TITLE, canvas.width / 2, 210);
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = '#ffe27a';
  ctx.fillText('An open-world crime story in the city of ' + CITY_NAME, canvas.width / 2, 258);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('Steal cars · Outrun the cops · Run five missions · Own the coast', canvas.width / 2, 310);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const bw = 460, bh = 150;
  ctx.fillRect(canvas.width / 2 - bw / 2, 350, bw, bh);
  ctx.fillStyle = '#fff';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('WASD / arrows — move & drive      E — steal / exit car', canvas.width / 2, 388);
  ctx.fillText('Space — punch / horn      F — shoot      Shift — run', canvas.width / 2, 414);
  ctx.fillText('M — mission list      P — pause      N — mute', canvas.width / 2, 440);
  ctx.fillStyle = '#ffe27a';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(saved ? 'Press ENTER — continue saved game' : 'Press ENTER — start a new game', canvas.width / 2, 480);
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = '#ddd';
  ctx.fillText('Progress auto-saves. Original game — no Rockstar content.', canvas.width / 2, 560);
  ctx.textAlign = 'left';
  ctx.restore();
}

export function drawPaused(ctx, canvas) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('Press P to resume · M for missions', canvas.width / 2, canvas.height / 2 + 28);
  ctx.textAlign = 'left';
  ctx.restore();
}

export function drawGameOver(ctx, canvas, reason, missions) {
  ctx.save();
  ctx.fillStyle = 'rgba(20,0,0,0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ff5f5f';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(reason, canvas.width / 2, canvas.height / 2 - 20);
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(`Missions completed: ${missions.completed.length} / 5`, canvas.width / 2, canvas.height / 2 + 24);
  ctx.fillText('Press ENTER to play again', canvas.width / 2, canvas.height / 2 + 58);
  ctx.textAlign = 'left';
  ctx.restore();
}
