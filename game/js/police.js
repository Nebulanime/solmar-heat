// police.js — the wanted system: 0–5 stars, Solmar PD cruisers that chase and
// ram, a police helicopter at wanted 3+, heat that cools when you lay low.
import { clamp, angDiff } from './util.js';
import { randomRoadPoint } from './city.js';

export const WANTED_LABELS = [
  'CLEAN', 'SUSPICIOUS', 'PURSUIT', 'MANHUNT', 'LOCKDOWN', 'CITYWIDE ALERT',
];

export class Police {
  constructor(city, rnd) {
    this.city = city;
    this.rnd = rnd;
    this.wanted = 0;
    this.heat = 0; // 0..100, drives wanted stars
    this.cruisers = [];
    this.heli = null;
    this.bustedTimer = 0;
    this.lastCrime = -999;
  }

  addHeat(amount, now) {
    this.heat = clamp(this.heat + amount, 0, 100);
    this.lastCrime = now;
    this.syncWanted();
  }
  syncWanted() {
    const w = this.heat < 8 ? 0 : this.heat < 25 ? 1 : this.heat < 45 ? 2 : this.heat < 65 ? 3 : this.heat < 85 ? 4 : 5;
    if (w !== this.wanted) {
      this.wanted = w;
      this.spawnCruisers();
    }
  }
  spawnCruisers() {
    const want = this.wanted === 0 ? 0 : this.wanted + 1;
    while (this.cruisers.length < want) {
      const p = randomRoadPoint(this.city, this.rnd);
      this.cruisers.push({ x: p.x, z: p.z, heading: 0, speed: 0, mesh: null, siren: this.rnd() * 10 });
    }
    this.cruisers.length = want;
    if (this.wanted >= 3 && !this.heli) this.heli = { x: 0, y: 55, z: 0, angle: 0 };
    if (this.wanted < 3) this.heli = null;
  }

  // Cruiser AI: steer toward the player, ram on contact, give up when far.
  update(dt, now, player) {
    // heat cools when no crime for a while
    if (now - this.lastCrime > 12 && this.wanted > 0) {
      this.heat = Math.max(0, this.heat - dt * 2.2);
      this.syncWanted();
    }
    for (const c of this.cruisers) {
      const dx = player.x - c.x, dz = player.z - c.z;
      const d = Math.hypot(dx, dz);
      const target = Math.atan2(dz, dx);
      c.heading += clamp(angDiff(c.heading, target), -2.4 * dt, 2.4 * dt);
      const maxSpd = 15 + this.wanted * 2.4;
      c.speed = Math.min(maxSpd, c.speed + 12 * dt);
      if (d < 3.2) c.speed = Math.max(2, c.speed - 20 * dt); // ram, then back off
      c.x += Math.cos(c.heading) * c.speed * dt;
      c.z += Math.sin(c.heading) * c.speed * dt;
      c.siren += dt;
      // busted: cop sits on you while you're slow on foot
      if (d < 2.6 && !player.inCar && Math.abs(player.speed || 0) < 1.5) this.bustedTimer += dt;
      else this.bustedTimer = Math.max(0, this.bustedTimer - dt);
    }
    if (this.heli) {
      this.heli.angle += dt * 0.35;
      this.heli.x = player.x + Math.cos(this.heli.angle) * 26;
      this.heli.z = player.z + Math.sin(this.heli.angle) * 26;
      this.heli.y = 52 + Math.sin(now * 0.7) * 3;
    }
  }

  // Human-readable police response list for the HUD.
  responseList() {
    if (this.wanted === 0) return [];
    const out = [`SOLMAR PD — ${WANTED_LABELS[this.wanted]}`];
    out.push(`Units responding: ${this.cruisers.length} cruiser${this.cruisers.length === 1 ? '' : 's'}`);
    if (this.heli) out.push('Air support: HELI-1 circling');
    if (this.wanted >= 4) out.push('Roadblocks reported on NEON STRIP');
    if (this.wanted >= 5) out.push('SWAT on standby — lose them!');
    return out;
  }
}

// ---- wanted helpers shared by HUD + tests ----
export function wantedStars(wanted) {
  return '★'.repeat(wanted) + '☆'.repeat(5 - wanted);
}
export function heatForWanted(w) {
  return [0, 10, 30, 50, 70, 90][w] ?? 0;
}
