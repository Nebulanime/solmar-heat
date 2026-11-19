// SOLMAR HEAT — hud.js
// Everything drawn in the DOM on top of the WebGL canvas: the minimap,
// wanted stars, cash, health, ammo, speedometer, radio, mission panel,
// police dispatch feed, dialogue, banners, and the title / pause / map /
// busted / missions / options screens. The game hands this class one
// snapshot per frame (game.hudState()) and it renders from that alone.

import { WORLD, SHOPS, SAFEHOUSE, MISSIONS } from './config.js';
import { formatMoney } from './logic.js';

function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
}

export class Hud {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('hud');
    this.build();
    this.mapCanvas = document.getElementById('map-canvas');
    this.mapCtx = this.mapCanvas.getContext('2d');
    this.miniCtx = this.miniCanvas.getContext('2d');
  }

  build() {
    // Top-left: cash, health, ammo.
    const tl = el('div', 'hud-tl', this.root);
    this.cashEl = el('div', 'hud-cash', tl);
    this.healthEl = el('div', 'hud-health', tl);
    const healthBar = el('div', 'hud-bar', this.healthEl);
    this.healthFill = el('div', 'hud-bar-fill', healthBar);
    this.ammoEl = el('div', 'hud-ammo', tl);
    // Top-right: wanted stars.
    const tr = el('div', 'hud-tr', this.root);
    this.starsEl = el('div', 'hud-stars', tr);
    // Mission panel (left, below cash).
    const mp = el('div', 'hud-mission', this.root);
    this.missionTitle = el('div', 'hud-mission-title', mp);
    this.missionStep = el('div', 'hud-mission-step', mp);
    this.missionDist = el('div', 'hud-mission-dist', mp);
    // Dispatch feed (right, below stars).
    this.dispatchEl = el('div', 'hud-dispatch', this.root);
    // Bottom-left: minimap + radio + street.
    const bl = el('div', 'hud-bl', this.root);
    this.miniCanvas = el('canvas', 'hud-minimap', bl);
    this.miniCanvas.width = 190;
    this.miniCanvas.height = 190;
    this.radioEl = el('div', 'hud-radio', bl);
    this.streetEl = el('div', 'hud-street', bl);
    // Bottom-right: big speedometer.
    const br = el('div', 'hud-br', this.root);
    this.speedEl = el('div', 'hud-speed', br);
    el('div', 'hud-speed-unit', br).textContent = 'KM/H';
    // Centre: dialogue, banner, contextual prompt.
    this.dialogEl = el('div', 'hud-dialog', this.root);
    this.dialogSpeaker = el('div', 'hud-dialog-speaker', this.dialogEl);
    this.dialogText = el('div', 'hud-dialog-text', this.dialogEl);
    this.bannerEl = el('div', 'hud-banner', this.root);
    this.bannerTitle = el('div', 'hud-banner-title', this.bannerEl);
    this.bannerSub = el('div', 'hud-banner-sub', this.bannerEl);
    this.promptEl = el('div', 'hud-prompt', this.root);
    // Overlays.
    this.titleEl = el('div', 'hud-title', this.root);
    el('div', 'hud-title-kicker', this.titleEl).textContent = 'A NOVA VEGA STORY  •  SOLMAR, USA';
    const logo = el('div', 'hud-title-logo', this.titleEl);
    logo.innerHTML = 'SOLMAR<br>HEAT';
    el('div', 'hud-title-sub', this.titleEl).textContent = 'Sun. Sea. Everybody else\'s money.';
    this.menuEl = el('div', 'hud-title-menu', this.titleEl);
    el('div', 'hud-title-foot', this.titleEl).textContent =
      'WASD move/drive  •  E enter car / interact  •  M map  •  P pause  •  C camera  •  R radio  •  N day/night  •  Space brake  •  Shift run';
    this.pauseEl = el('div', 'hud-overlay', this.root);
    this.pauseEl.innerHTML = '<div class="hud-overlay-title">PAUSED</div><div class="hud-overlay-sub">Press P to keep playing</div>';
    this.bustedEl = el('div', 'hud-overlay hud-busted', this.root);
    this.bustedEl.innerHTML = '<div class="hud-overlay-title">BUSTED</div><div class="hud-overlay-sub">The Solmar PD caught up with Nova Vega.<br>Press Enter — back to the safehouse, $200 lighter.</div>';
    this.mapEl = el('div', 'hud-map', this.root);
    const mapCanvas = document.createElement('canvas');
    mapCanvas.id = 'map-canvas';
    mapCanvas.width = 960;
    mapCanvas.height = 600;
    this.mapEl.appendChild(mapCanvas);
    const mapFoot = el('div', 'hud-map-foot', this.mapEl);
    mapFoot.textContent = 'SOLMAR CITY MAP  •  M / Esc to close  •  Yellow diamond: mission  •  Teal H: safehouse  •  Pink: shops';
    this.missionsEl = el('div', 'hud-overlay', this.root);
    this.missionsEl.innerHTML = '<div class="hud-overlay-title">MISSIONS</div><div class="hud-missions-list" id="missions-list"></div><div class="hud-overlay-sub">Press Esc to go back</div>';
    this.optionsEl = el('div', 'hud-overlay', this.root);
    this.optionsEl.innerHTML = '<div class="hud-overlay-title">OPTIONS</div><div class="hud-overlay-sub" id="options-body">Press M to toggle sound</div><div class="hud-overlay-sub">Press Esc to go back</div>';
  }

  update(s) {
    const playing = s.state === 'playing';
    const inGame = playing || s.state === 'paused' || s.state === 'map' || s.state === 'busted';
    this.root.classList.toggle('hud-in-game', inGame);
    this.root.classList.toggle('hud-title', s.state === 'title');
    // Cash / health / ammo.
    this.cashEl.textContent = formatMoney(s.money);
    this.healthFill.style.width = s.health + '%';
    this.healthFill.style.background = s.health > 50 ? '#37d67a' : s.health > 25 ? '#ffb02e' : '#ff4444';
    this.ammoEl.textContent = 'PISTOL  •  ' + s.ammo + ' rounds';
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < s.wanted ? '★' : '☆';
    this.starsEl.textContent = stars;
    this.starsEl.style.color = s.wanted > 0 ? '#ffd23e' : 'rgba(255,255,255,0.35)';
    // Mission panel.
    if (s.mission) {
      this.missionTitle.textContent = `MISSION ${s.mission.index + 1}/${s.mission.total} — ${s.mission.title}`;
      this.missionStep.textContent = s.stepLabel || '';
      this.missionDist.textContent = s.objectivePos ? `◈ ${s.objectiveDist} m  •  Reward ${formatMoney(s.mission.reward)}` : '';
    } else {
      this.missionTitle.textContent = 'SOLMAR HEAT — COMPLETE';
      this.missionStep.textContent = 'Every mission done. Solmar is yours, Nova.';
      this.missionDist.textContent = '';
    }
    // Dispatch feed.
    this.dispatchEl.innerHTML = s.dispatch.map((d) => `<div class="hud-dispatch-line">📻 ${d}</div>`).join('');
    // Radio + street + speed.
    this.radioEl.textContent = '♪ ' + s.radio;
    this.streetEl.textContent = `${s.street}  •  ${s.district}`;
    this.speedEl.textContent = s.inCar ? String(s.speed) : '—';
    // Dialogue.
    if (s.dialog && playing) {
      this.dialogEl.style.display = 'block';
      this.dialogSpeaker.textContent = s.dialog.speaker;
      this.dialogText.textContent = s.dialog.text;
    } else {
      this.dialogEl.style.display = 'none';
    }
    // Banner.
    if (s.banner) {
      this.bannerEl.style.display = 'block';
      this.bannerTitle.textContent = s.banner.title;
      this.bannerSub.textContent = s.banner.sub;
    } else {
      this.bannerEl.style.display = 'none';
    }
    // Contextual prompt (E).
    this.promptEl.textContent = this.promptFor(s);
    this.promptEl.style.display = this.promptFor(s) ? 'block' : 'none';
    // Overlays.
    this.titleEl.style.display = s.state === 'title' ? 'flex' : 'none';
    this.pauseEl.style.display = s.state === 'paused' ? 'flex' : 'none';
    this.bustedEl.style.display = s.state === 'busted' ? 'flex' : 'none';
    this.mapEl.style.display = s.state === 'map' ? 'flex' : 'none';
    this.missionsEl.style.display = s.missionsOverlay ? 'flex' : 'none';
    this.optionsEl.style.display = s.optionsOverlay ? 'flex' : 'none';
    if (s.state === 'title') this.renderMenu(s);
    if (s.missionsOverlay) this.renderMissions(s);
    if (s.optionsOverlay) {
      document.getElementById('options-body').textContent =
        `Sound: ${s.muted ? 'OFF' : 'ON'} — press M to toggle  •  Camera mode: ${['Chase', 'Far chase', 'Hood', 'Top'][s.camMode]}`;
    }
    // Minimap + map screen.
    if (inGame) this.drawMinimap(s);
    if (s.state === 'map') this.drawMap(s);
  }

  promptFor(s) {
    if (s.state !== 'playing') return '';
    const g = this.game;
    const p = { x: s.x, z: s.z };
    const d = (x, z) => Math.hypot(p.x - x, p.z - z);
    if (s.stepLabel && s.mission && s.objectivePos && d(s.objectivePos.x, s.objectivePos.z) < 7) {
      return 'Press E to continue the mission';
    }
    if (d(SAFEHOUSE.x, SAFEHOUSE.z) < 10 && !s.inCar) return 'Press E — save at the safehouse';
    for (const shop of SHOPS) {
      if (d(shop.x, shop.z) < 7 && !s.inCar) return `Press E — ${shop.name} ($${shop.price})`;
    }
    if (!s.inCar) {
      for (const t of g.traffic) {
        if (d(t.x, t.z) < 4.5) return 'Press E — take the car';
      }
    }
    if (s.inCar) return 'Press E — get out';
    return '';
  }

  renderMenu(s) {
    const items = s.menuItems.map((item, i) => {
      const disabled = item === 'CONTINUE' && !s.saveExists;
      const label = item === 'CONTINUE' && !s.saveExists ? 'CONTINUE (no save yet)' : item;
      return `<div class="hud-menu-item${i === s.menuIndex ? ' selected' : ''}${disabled ? ' disabled' : ''}">${label}</div>`;
    }).join('');
    this.menuEl.innerHTML = items;
  }

  renderMissions(s) {
    const list = document.getElementById('missions-list');
    if (!list) return;
    list.innerHTML = MISSIONS.map((m, i) => {
      const state = i < s.mission.index ? '✓ DONE' : i === s.mission.index ? '▶ ACTIVE' : '○ LOCKED';
      return `<div class="hud-missions-row"><span>${i + 1}. ${m.title}</span><span>${state} — ${formatMoney(m.reward)}</span></div>`;
    }).join('');
  }
}

// ---- Minimap + fullscreen map (second pass) ------------------------------
// Both draw the same city from the same data: sea on the east, the road
// grid, building blocks, shops, the safehouse, the mission marker, the
// player arrow, police, traffic and the helicopter. The minimap is a
// north-up circle; the map screen adds street and district labels.

Hud.prototype.worldToMap = function (x, z, w, h) {
  // World x in [-360, 560], z in [-280, 280] -> canvas (w, h).
  const px = ((x + 360) / 920) * w;
  const py = ((z + 280) / 560) * h;
  return [px, py];
};

Hud.prototype.drawCityBase = function (ctx, w, h) {
  const g = this.game;
  // Sea + sand.
  const [seaX] = this.worldToMap(366, 0, w, h);
  const [beachX] = this.worldToMap(332, 0, w, h);
  ctx.fillStyle = '#0e4a6b';
  ctx.fillRect(seaX, 0, w - seaX, h);
  ctx.fillStyle = '#d9c08a';
  ctx.fillRect(beachX, 0, seaX - beachX, h);
  // Land.
  ctx.fillStyle = '#20242c';
  ctx.fillRect(0, 0, beachX, h);
  // Blocks.
  ctx.fillStyle = '#3a3f4a';
  for (let col = 0; col < 8; col++) {
    for (let row = 0; row < 6; row++) {
      const [x0, y0] = this.worldToMap(-320 + col * 80 + 8, -240 + row * 80 + 8, w, h);
      const [x1, y1] = this.worldToMap(-320 + col * 80 + 72, -240 + row * 80 + 72, w, h);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  // Roads.
  ctx.strokeStyle = '#565d6b';
  ctx.lineWidth = Math.max(2, w / 260);
  for (let i = 0; i <= 8; i++) {
    const [x] = this.worldToMap(-320 + i * 80, 0, w, h);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let j = 0; j <= 6; j++) {
    const [, y] = this.worldToMap(0, -240 + j * 80, w, h);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  // Marina docks.
  ctx.strokeStyle = '#8a6a42';
  ctx.lineWidth = Math.max(2, w / 300);
  for (const d of g.city.docks) {
    const [x0, y0] = this.worldToMap(d.x, d.z, w, h);
    const [x1] = this.worldToMap(d.x + d.len, d.z, w, h);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
  }
  // Shops (pink) + safehouse (teal H).
  for (const shop of SHOPS) {
    const [x, y] = this.worldToMap(shop.x, shop.z, w, h);
    ctx.fillStyle = '#ff5fa2';
    ctx.beginPath(); ctx.arc(x, y, Math.max(2.5, w / 220), 0, Math.PI * 2); ctx.fill();
  }
  const [hx, hy] = this.worldToMap(SAFEHOUSE.x, SAFEHOUSE.z, w, h);
  ctx.fillStyle = '#2ee6c8';
  ctx.fillRect(hx - 4, hy - 4, 8, 8);
  ctx.fillStyle = '#06231e';
  ctx.font = `bold ${Math.max(7, w / 90)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('H', hx, hy + 0.5);
};

Hud.prototype.drawMinimap = function (s) {
  const ctx = this.miniCtx;
  const w = 190, h = 190;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
  ctx.clip();
  this.drawCityBase(ctx, w, h);
  // Mission marker (pulsing yellow diamond).
  if (s.objectivePos) {
    const [x, y] = this.worldToMap(s.objectivePos.x, s.objectivePos.z, w, h);
    const r = 5 + Math.sin(performance.now() / 250) * 1.5;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
    ctx.closePath(); ctx.fill();
  }
  // Traffic (grey) + police (blue/red flashing) + heli (white).
  ctx.fillStyle = '#9aa3b2';
  for (const t of s.traffic) {
    const [x, y] = this.worldToMap(t.x, t.z, w, h);
    ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  const flash = Math.floor(performance.now() / 300) % 2 === 0;
  ctx.fillStyle = flash ? '#ff4444' : '#4488ff';
  for (const c of s.cops) {
    const [x, y] = this.worldToMap(c.x, c.z, w, h);
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  if (s.heli) {
    const [x, y] = this.worldToMap(s.heli.x, s.heli.z, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow, rotated by heading (yaw: 0 = +z/south on the map).
  const [px, py] = this.worldToMap(s.x, s.z, w, h);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.PI - s.yaw);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.restore();
  // Ring + north tick.
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', w / 2, 13);
};

Hud.prototype.drawMap = function (s) {
  const ctx = this.mapCtx;
  const w = 960, h = 600;
  ctx.clearRect(0, 0, w, h);
  this.drawCityBase(ctx, w, h);
  // Street labels (dark outline so they read over the blocks).
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 3;
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  const nsNames = ['Solmar Blvd', 'Palma St', 'Coral Way', 'Neon Ave', 'Vega Ln', 'Harbor Rd', 'Sunset Dr', 'Marina Pkwy', 'Ocean View'];
  for (let i = 0; i <= 8; i++) {
    const [x] = this.worldToMap(-320 + i * 80, 0, w, h);
    ctx.save();
    ctx.translate(x + 8, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.strokeText(nsNames[i], 0, 0);
    ctx.fillText(nsNames[i], 0, 0);
    ctx.restore();
  }
  const ewNames = ['Northgate Ave', 'Flamingo Row', 'Crown St', 'Bayside Ave', 'Jacaranda St', 'Dolphin Way', 'South Pier'];
  for (let j = 0; j <= 6; j++) {
    const [, y] = this.worldToMap(0, -240 + j * 80, w, h);
    ctx.strokeText(ewNames[j], w / 2, y - 6);
    ctx.fillText(ewNames[j], w / 2, y - 6);
  }
  // District labels.
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  const districts = [
    ['DOWNTOWN SOLMAR', -160, -150], ['PALMA HEIGHTS', 170, -150],
    ['NEON ROW', -150, 40], ['OLD MARINA', 200, 190], ['SOLMAR BEACH', 440, -40],
  ];
  for (const [name, x, z] of districts) {
    const [px, py] = this.worldToMap(x, z, w, h);
    ctx.fillText(name, px, py);
  }
  // Shop name labels, with a dark outline so they stay readable over
  // street labels. Eastern shops get right-aligned labels.
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#ffb3d1';
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = 3;
  for (const shop of SHOPS) {
    const [x, y] = this.worldToMap(shop.x, shop.z, w, h);
    if (shop.x > 250) {
      ctx.textAlign = 'right';
      ctx.strokeText(shop.name, x - 6, y + 3);
      ctx.fillText(shop.name, x - 6, y + 3);
    } else {
      ctx.textAlign = 'left';
      ctx.strokeText(shop.name, x + 6, y + 3);
      ctx.fillText(shop.name, x + 6, y + 3);
    }
  }
  // Mission marker + player.
  if (s.objectivePos) {
    const [x, y] = this.worldToMap(s.objectivePos.x, s.objectivePos.z, w, h);
    const r = 9 + Math.sin(performance.now() / 250) * 2;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', x, y + 3);
  }
  const [px, py] = this.worldToMap(s.x, s.z, w, h);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.PI - s.yaw);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -11); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
};
