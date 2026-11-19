// SOLMAR HEAT HUD: the GTA-style overlay — round minimap, wanted stars, cash,
// speedometer, mission panel, dialog box, radio readout and every menu screen.
// All DOM; the 3D world underneath is WebGL.
import { RADIO, SHOPS, MISSIONS } from './config.js';
import { speedKmh, wantedStars } from './logic.js';
import { missionTarget, currentMission } from './world.js';

function el(id) { return document.getElementById(id); }

export class Hud {
  constructor(state) {
    this.state = state;
    this.mapCanvas = el('map-canvas');
    this.mini = el('minimap');
    this.miniCtx = this.mini.getContext('2d');
    this.mapCtx = this.mapCanvas.getContext('2d');
  }

  fmtClock() {
    const h = Math.floor((this.state.clock / 3600) % 24);
    const m = Math.floor((this.state.clock / 60) % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  update() {
    const s = this.state, p = s.player;
    const m = currentMission(s);
    el('hud-wanted').textContent = wantedStars(p.wanted);
    el('hud-wanted').style.color = p.wanted > 0 ? '#ff4444' : '#888';
    el('hud-money').textContent = `$${p.money.toLocaleString('en-US')}`;
    el('hud-clock').textContent = this.fmtClock();
    el('hud-health-fill').style.width = `${p.health}%`;
    el('hud-health-fill').style.background = p.health > 50 ? '#4ade80' : p.health > 25 ? '#facc15' : '#ef4444';
    el('hud-armor-fill').style.width = `${p.armor}%`;
    const tgt = missionTarget(s);
    el('hud-mission-title').textContent = m ? `${m.id}. ${m.title}` : 'Free roam — Solmar is yours';
    el('hud-mission-obj').textContent = m ? m.objective : 'Explore, earn, survive.';
    el('hud-mission-dist').textContent = m && tgt ? `${Math.round(Math.hypot(tgt.x - p.x, tgt.z - p.z))}m` : '';
    el('hud-mission-timer').textContent = m && m.kind === 'timed' ? `⏱ ${Math.max(0, Math.ceil(s.missionTimer))}s` : '';
    el('hud-speed').textContent = p.onFoot ? 'ON FOOT' : `${speedKmh(p.speed)}`;
    el('hud-speed-unit').textContent = p.onFoot ? '' : 'km/h';
    el('hud-weapon').textContent = p.onFoot ? `PISTOL  ${p.ammo}` : 'COMET GT';
    el('hud-radio').textContent = `${RADIO[s.radio].name} — ${RADIO[s.radio].track}`;
    el('hud-radio').style.display = s.screen === 'map' ? 'none' : 'block';
    el('hud-dialog').style.display = s.dialog && s.elapsed < s.dialogUntil ? 'block' : 'none';
    el('hud-dialog').textContent = s.dialog || '';
    const showBanner = s.banner && s.elapsed < s.bannerUntil;
    el('hud-banner').style.display = showBanner ? 'block' : 'none';
    el('hud-banner').textContent = s.banner || '';
    el('hud-crosshair').style.display = p.onFoot && s.screen === 'play' ? 'block' : 'none';
    el('hud-help').style.display = s.screen === 'play' ? 'block' : 'none';
    this.drawMinimap();
    if (s.screen === 'map') this.drawMap();
  }

  drawMinimap() {
    const ctx = this.miniCtx, s = this.state, p = s.player;
    const W = 180, H = 180, scale = W / 520, cx = W / 2, cy = H / 2;
    const X = (x) => cx + x * scale, Y = (z) => cy + z * scale;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#101018';
    ctx.fillRect(0, 0, W, H);
    // Ocean to the south.
    ctx.fillStyle = '#0a3a5c';
    ctx.fillRect(0, Y(243), W, H - Y(243));
    ctx.strokeStyle = '#3a3a44';
    ctx.lineWidth = 5;
    for (const c of s.city.lines) {
      ctx.beginPath(); ctx.moveTo(X(-260), Y(c)); ctx.lineTo(X(260), Y(c)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(c), Y(-260)); ctx.lineTo(X(c), Y(260)); ctx.stroke();
    }
    ctx.fillStyle = '#2c2c38';
    for (const b of s.city.buildings) ctx.fillRect(X(b.x - b.w / 2), Y(b.z - b.d / 2), b.w * scale, b.d * scale);
    // Shops.
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    for (const shop of SHOPS) {
      ctx.fillStyle = shop.kind === 'safe' ? '#4ade80' : shop.kind === 'arms' ? '#f87171' : '#facc15';
      ctx.fillText(shop.kind === 'safe' ? 'H' : shop.kind === 'arms' ? '$' : '•', X(shop.x), Y(shop.z) + 3);
    }
    // Mission target blip (pulsing yellow diamond).
    const tgt = missionTarget(s);
    if (tgt) {
      const r = 5 + Math.sin(s.elapsed * 5) * 2;
      ctx.fillStyle = '#facc15';
      ctx.beginPath(); ctx.moveTo(X(tgt.x), Y(tgt.z) - r); ctx.lineTo(X(tgt.x) + r, Y(tgt.z)); ctx.lineTo(X(tgt.x), Y(tgt.z) + r); ctx.lineTo(X(tgt.x) - r, Y(tgt.z)); ctx.fill();
    }
    // Police blips.
    for (const cop of s.police) {
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath(); ctx.arc(X(cop.x), Y(cop.z), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow, rotated to heading (map north is -z, so tip angle is PI - heading).
    ctx.save();
    ctx.translate(X(p.x), Y(p.z));
    ctx.rotate(-p.angle + Math.PI);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  drawMap() {
    const ctx = this.mapCtx, s = this.state, p = s.player;
    const W = 860, H = 620, scale = W / 560, ox = 40, oy = 30;
    const X = (x) => ox + (x + 260) * scale, Y = (z) => oy + (z + 260) * scale;
    ctx.fillStyle = '#0d0d14';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0a4a6e';
    ctx.fillRect(0, Y(243), W, H - Y(243));
    ctx.fillStyle = '#c9b078';
    ctx.fillRect(0, Y(216), W, Y(243) - Y(216));
    ctx.strokeStyle = '#55555f';
    ctx.lineWidth = 9;
    for (const c of s.city.lines) {
      ctx.beginPath(); ctx.moveTo(X(-260), Y(c)); ctx.lineTo(X(260), Y(c)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(c), Y(-260)); ctx.lineTo(X(c), Y(260)); ctx.stroke();
    }
    ctx.fillStyle = '#33333f';
    for (const b of s.city.buildings) ctx.fillRect(X(b.x - b.w / 2), Y(b.z - b.d / 2), b.w * scale, b.d * scale);
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    for (const shop of SHOPS) {
      ctx.fillStyle = '#facc15';
      ctx.fillText(`◆ ${shop.name}`, X(shop.x) + 6, Y(shop.z) - 4);
    }
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#facc15';
    ctx.fillText('N', X(0) - 4, 22);
    const tgt = missionTarget(s);
    if (tgt) {
      ctx.fillStyle = '#facc15';
      ctx.beginPath(); ctx.arc(X(tgt.x), Y(tgt.z), 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', X(tgt.x), Y(tgt.z) + 4);
      ctx.textAlign = 'left';
    }
    ctx.save();
    ctx.translate(X(p.x), Y(p.z));
    ctx.rotate(-p.angle + Math.PI);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('SOLMAR — CITY MAP', 24, 34);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('M / Esc — close map', 24, H - 18);
  }

  showScreen(name) {
    for (const id of ['screen-title', 'screen-passed', 'screen-busted', 'screen-complete', 'screen-map', 'screen-paused']) {
      el(id).style.display = id === `screen-${name}` ? 'flex' : 'none';
    }
    const hud = el('hud');
    hud.style.display = name === 'play' || name === 'map' ? 'block' : 'none';
    if (name === 'passed') {
      const m = currentMission(this.state);
      el('passed-title').textContent = this.state.passedInfo.startsWith('MISSION FAILED') ? 'MISSION FAILED' : 'MISSION PASSED';
      el('passed-title').style.color = this.state.passedInfo.startsWith('MISSION FAILED') ? '#ef4444' : '#4ade80';
      el('passed-info').textContent = this.state.passedInfo;
      el('passed-next').textContent = m ? `Next: ${m.id}. ${m.title} — press ENTER` : 'Press ENTER for the finale';
    }
    if (name === 'complete') {
      el('complete-stats').textContent = `Missions done: ${this.state.done.length}/${MISSIONS.length}  •  Cash: $${this.state.player.money}  •  Busted: ${this.state.busts}  •  Shots fired: ${this.state.shots}`;
    }
    if (name === 'title') {
      el('title-continue').style.display = (typeof localStorage !== 'undefined' && localStorage.getItem('solmar-heat-save')) ? 'block' : 'none';
    }
  }
}
