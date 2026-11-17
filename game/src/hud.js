// The HUD: cash, health, wanted stars, clock, speed and the objective line as
// DOM text, plus a live top-down minimap on its own canvas — the player, cars,
// cops and the mission marker as dots on the street grid.

import { formatCash, formatClock } from './config.js';
import { objectiveTarget, objectiveText } from './missions.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const cashEl = el('hud-cash');
  const healthEl = el('hud-health-fill');
  const starsEl = el('hud-stars');
  const clockEl = el('hud-clock');
  const speedEl = el('hud-speed');
  const objectiveEl = el('hud-objective');
  const messageEl = el('hud-message');
  const ammoEl = el('hud-ammo');
  const map = el('minimap');
  const mapCtx = map ? map.getContext('2d') : null;

  function drawMinimap(world) {
    if (!mapCtx) return;
    const S = map.width;
    const scale = S / 460; // city spans about -230..230
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    mapCtx.fillStyle = 'rgba(16,22,32,0.85)';
    mapCtx.fillRect(0, 0, S, S);
    // Sea and beach on the east edge.
    mapCtx.fillStyle = '#1e7fa8';
    mapCtx.fillRect(S / 2 + 185 * scale, 0, S, S);
    mapCtx.fillStyle = '#ecd9a4';
    mapCtx.fillRect(S / 2 + 178 * scale, 0, 7 * scale, S);
    // Roads.
    mapCtx.strokeStyle = '#5a6068';
    mapCtx.lineWidth = Math.max(2, 10 * scale);
    for (const line of world.cityRoads) {
      const [x1, y1] = toMap(line, -185);
      const [x2, y2] = toMap(line, 185);
      mapCtx.beginPath();
      mapCtx.moveTo(x1, y1);
      mapCtx.lineTo(x2, y2);
      mapCtx.stroke();
      const [hx1, hy1] = toMap(-185, line);
      const [hx2, hy2] = toMap(185, line);
      mapCtx.beginPath();
      mapCtx.moveTo(hx1, hy1);
      mapCtx.lineTo(hx2, hy2);
      mapCtx.stroke();
    }
    // Mission marker.
    const target = objectiveTarget(world.missions);
    if (target) {
      const [mx, my] = toMap(target.x, target.z);
      mapCtx.fillStyle = '#ffd94d';
      mapCtx.beginPath();
      mapCtx.arc(mx, my, 6, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.strokeStyle = '#7a5b00';
      mapCtx.lineWidth = 2;
      mapCtx.stroke();
    }
    const dot = (x, z, color, r) => {
      const [dx, dy] = toMap(x, z);
      mapCtx.fillStyle = color;
      mapCtx.beginPath();
      mapCtx.arc(dx, dy, r, 0, Math.PI * 2);
      mapCtx.fill();
    };
    for (const car of world.cars) if (car.alive && car.kind !== 'parked') dot(car.x, car.z, '#e8e8e8', 2.5);
    for (const cop of world.police.cops) dot(cop.x, cop.z, '#2d6bff', 3.5);
    for (const off of world.police.officers) if (off.alive) dot(off.x, off.z, '#7fb3ff', 2.5);
    const p = world.state.player;
    const [px, py] = toMap(p.x, p.z);
    mapCtx.fillStyle = '#ff5a2a';
    mapCtx.beginPath();
    mapCtx.moveTo(px + Math.sin(p.heading) * 7, py + Math.cos(p.heading) * 7);
    mapCtx.lineTo(px + Math.sin(p.heading + 2.5) * 5, py + Math.cos(p.heading + 2.5) * 5);
    mapCtx.lineTo(px + Math.sin(p.heading - 2.5) * 5, py + Math.cos(p.heading - 2.5) * 5);
    mapCtx.closePath();
    mapCtx.fill();
    // North marker.
    mapCtx.fillStyle = '#f4ead8';
    mapCtx.font = 'bold 12px sans-serif';
    mapCtx.textAlign = 'center';
    mapCtx.fillText('N', S / 2, 13);
  }

  function update(world, screen) {
    const state = world.state;
    const player = state.player;
    if (cashEl) cashEl.textContent = formatCash(state.cash);
    if (healthEl) {
      healthEl.style.width = Math.max(0, state.health) + '%';
      healthEl.style.background = state.health < 30 ? '#e83a3a' : '#4fae62';
    }
    if (starsEl) {
      let stars = '';
      for (let i = 0; i < 5; i += 1) stars += i < world.police.stars ? '★' : '☆';
      starsEl.textContent = stars;
      starsEl.style.color = world.police.stars > 0 ? '#ffd94d' : 'rgba(244,234,216,0.5)';
    }
    if (clockEl) clockEl.textContent = formatClock(state.clockMinutes);
    if (speedEl) {
      speedEl.textContent = player.inCar && player.car ? Math.round(Math.abs(player.car.speed) * 3.6) + ' km/h' : '';
    }
    if (objectiveEl) objectiveEl.textContent = objectiveText(world.missions);
    if (ammoEl) {
      ammoEl.textContent = world.combat.hasPistol
        ? 'Pistol ' + world.combat.pistolAmmo + ' rounds  •  Q punch  •  F shoot'
        : 'Q punch  •  E steal car  •  M story';
    }
    if (messageEl) {
      messageEl.textContent = world.missions.messageTimer > 0 ? world.missions.message : '';
      messageEl.style.opacity = world.missions.messageTimer > 0 ? '1' : '0';
    }
    const hud = document.getElementById('hud');
    if (hud) hud.style.display = screen === 'play' ? 'block' : 'none';
    drawMinimap(world);
  }

  return { update };
}
