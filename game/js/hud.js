// hud.js — the DOM HUD and the 2D minimap / big map: wanted stars, cash,
// speed, weapon, radio, mission panel, police list, dialogs, banners.
import { fmtMoney, fmtTime, streetNameAt } from './util.js';
import { wantedStars } from './police.js';
import { missionProgress, objectiveText } from './missions.js';

export class HUD {
  constructor(city) {
    this.city = city;
    this.el = {};
    for (const id of ['wanted','cash','clock','street','mission-title','mission-obj','mission-timer','police-list','dialog','dialog-name','dialog-text','radio','ammo','speed-num','health-bar','health-num','banner','toast','hint','title','menu-mission','howto','pause','bigmap','bigmap-canvas']) {
      this.el[id] = document.getElementById(id);
    }
    this.mapCanvas = document.getElementById('map');
    this.mapCtx = this.mapCanvas.getContext('2d');
    this.dialogUntil = 0;
    this.bannerUntil = 0;
    this.toastUntil = 0;
  }

  showDialog(name, text, seconds = 5) {
    this.el['dialog-name'].textContent = name;
    this.el['dialog-text'].textContent = text;
    this.el.dialog.style.display = 'block';
    this.dialogUntil = performance.now() / 1000 + seconds;
  }
  showBanner(text, sub = '', seconds = 3) {
    this.el.banner.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
    this.el.banner.style.display = 'block';
    this.bannerUntil = performance.now() / 1000 + seconds;
  }
  showToast(text, seconds = 2.5) {
    this.el.toast.textContent = text;
    this.el.toast.style.display = 'block';
    this.toastUntil = performance.now() / 1000 + seconds;
  }
  hideTimed(now) {
    if (this.dialogUntil && now > this.dialogUntil) { this.el.dialog.style.display = 'none'; this.dialogUntil = 0; }
    if (this.bannerUntil && now > this.bannerUntil) { this.el.banner.style.display = 'none'; this.bannerUntil = 0; }
    if (this.toastUntil && now > this.toastUntil) { this.el.toast.style.display = 'none'; this.toastUntil = 0; }
  }

  update(s) {
    const w = s.police.wanted;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += `<span class="${i < w ? (w >= 4 ? 'hot' : '') : 'off'}">★</span>`;
    this.el.wanted.innerHTML = stars;
    this.el.cash.textContent = fmtMoney(s.money);
    const hh = Math.floor(s.clock / 60) % 24, mm = Math.floor(s.clock % 60);
    this.el.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    this.el.street.textContent = streetNameAt(s.x, s.z, this.city);
    this.el['mission-title'].textContent = missionProgress(s.missions);
    this.el['mission-obj'].textContent = objectiveText(s.missions);
    const o = s.missions.objective;
    this.el['mission-timer'].textContent = o && o.timer ? '⏱ ' + fmtTime(s.missions.timer) : '';
    this.el['police-list'].innerHTML = s.police.responseList().map((l) => `<div>▸ ${l}</div>`).join('');
    this.el.radio.textContent = `${s.station.name} — ${s.station.song}`;
    this.el.ammo.textContent = `${s.ammo} / ${s.reserveAmmo}`;
    this.el['speed-num'].textContent = String(Math.round(Math.abs(s.speedMph)));
    this.el['health-bar'].style.width = `${Math.max(0, s.health)}%`;
    this.el['health-num'].textContent = String(Math.max(0, Math.round(s.health)));
    this.el['menu-mission'].textContent = String(Math.min(5, s.missions.missionIndex + 1));
    this.drawMinimap(s);
    if (s.showBigMap) this.drawBigMap(s);
  }

  // Minimap: circular 2D map — roads, parks, beach, mission marker, cops,
  // player arrow, north up.
  drawMinimap(s) {
    const g = this.mapCtx, W = 220, C = W / 2;
    const city = this.city;
    const scale = W / (city.max - city.min);
    const toX = (x) => C + x * scale;
    const toY = (z) => C + z * scale;
    g.clearRect(0, 0, W, W);
    g.save();
    g.beginPath(); g.arc(C, C, C - 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#10182a'; g.fillRect(0, 0, W, W);
    // beach
    g.fillStyle = '#2b84a8';
    g.fillRect(0, 0, toX(city.beachX), W);
    g.fillStyle = '#e8d9a8';
    g.fillRect(toX(city.beachX), 0, toX(city.beachX + 30) - toX(city.beachX), W);
    // parks
    g.fillStyle = '#2f6b34';
    for (const p of city.parks) g.fillRect(toX(p.x - p.w / 2), toY(p.z - p.d / 2), p.w * scale, p.d * scale);
    // roads
    g.strokeStyle = '#3a4150'; g.lineWidth = city.roadW * scale;
    for (const a of city.avenues) { g.beginPath(); g.moveTo(toX(a.x), 0); g.lineTo(toX(a.x), W); g.stroke(); }
    for (const st of city.streets) { g.beginPath(); g.moveTo(0, toY(st.z)); g.lineTo(W, toY(st.z)); g.stroke(); }
    g.strokeStyle = '#d8b93a'; g.lineWidth = 1;
    for (const a of city.avenues) { g.beginPath(); g.moveTo(toX(a.x), 0); g.lineTo(toX(a.x), W); g.stroke(); }
    for (const st of city.streets) { g.beginPath(); g.moveTo(0, toY(st.z)); g.lineTo(W, toY(st.z)); g.stroke(); }
    // mission marker
    const o = s.missions.objective;
    if (o && o.x !== null && o.x !== undefined) {
      const pulse = 6 + Math.sin(s.now * 5) * 2;
      g.fillStyle = '#ffd23e';
      g.beginPath(); g.arc(toX(o.x), toY(o.z), pulse, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#000';
      g.font = 'bold 10px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('!', toX(o.x), toY(o.z));
    }
    // police dots
    g.fillStyle = '#5aa2ff';
    for (const c of s.police.cruisers) { g.beginPath(); g.arc(toX(c.x), toY(c.z), 3.5, 0, Math.PI * 2); g.fill(); }
    // player arrow
    const px = toX(s.x), py = toY(s.z);
    g.save();
    g.translate(px, py);
    g.rotate(Math.atan2(Math.sin(s.heading), Math.cos(s.heading)) + Math.PI / 2);
    g.fillStyle = s.inCar ? '#ff5a4d' : '#fff';
    g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill();
    g.restore();
    g.restore();
    // ring + N
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2;
    g.beginPath(); g.arc(C, C, C - 2, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 13px Arial'; g.textAlign = 'center';
    g.fillText('N', C, 16);
  }

  // Full-screen city map with labels (M key / shot=map).
  drawBigMap(s) {
    const cv = this.el['bigmap-canvas'];
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const city = this.city;
    const scale = Math.min(W / (city.max - city.min), H / (city.max - city.min));
    const ox = (W - (city.max - city.min) * scale) / 2;
    const oy = (H - (city.max - city.min) * scale) / 2;
    const toX = (x) => ox + (x - city.min) * scale;
    const toY = (z) => oy + (z - city.min) * scale;
    g.fillStyle = '#0e1626'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2b84a8'; g.fillRect(0, 0, toX(city.beachX), H);
    g.fillStyle = '#e8d9a8'; g.fillRect(toX(city.beachX), 0, toX(city.beachX + 30) - toX(city.beachX), H);
    g.fillStyle = '#2f6b34';
    for (const p of city.parks) g.fillRect(toX(p.x - p.w / 2), toY(p.z - p.d / 2), p.w * scale, p.d * scale);
    g.strokeStyle = '#3a4150'; g.lineWidth = Math.max(3, city.roadW * scale);
    for (const a of city.avenues) { g.beginPath(); g.moveTo(toX(a.x), 0); g.lineTo(toX(a.x), H); g.stroke(); }
    for (const st of city.streets) { g.beginPath(); g.moveTo(0, toY(st.z)); g.lineTo(W, toY(st.z)); g.stroke(); }
    // street labels
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.font = '11px Arial'; g.textAlign = 'left';
    for (const a of city.avenues) {
      g.save(); g.translate(toX(a.x) + 4, 14); g.rotate(Math.PI / 2); g.fillText(a.name, 0, 0); g.restore();
    }
    for (const st of city.streets) g.fillText(st.name, 8, toY(st.z) - 4);
    // places
    g.font = 'bold 12px Arial';
    for (const [key, p] of Object.entries(city.places)) {
      g.fillStyle = '#ffd23e';
      g.beginPath(); g.arc(toX(p.x), toY(p.z), 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff';
      g.fillText(p.name, toX(p.x) + 8, toY(p.z) + 4);
    }
    // player
    g.fillStyle = '#ff5a4d';
    g.beginPath(); g.arc(toX(s.x), toY(s.z), 7, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 13px Arial';
    g.fillText('NOVA', toX(s.x) + 10, toY(s.z) - 8);
    g.fillStyle = '#ffe9b0'; g.font = 'bold 18px Arial'; g.textAlign = 'center';
    g.fillText('SOLMAR CITY', W / 2, 26);
  }
}
