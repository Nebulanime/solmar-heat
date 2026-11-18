// SOLMAR HEAT — missions.mjs
// The story: five missions in a chain. Each mission has a kind —
// drive to a marker, reach a place on foot, or lose the heat — and
// pays out when its condition is met. Completing all five ends the story.
import { MISSIONS } from './config.mjs';

export function createMissions() {
  return {
    index: 0,
    active: false,
    done: false,
    completed: [],
    message: '',
    messageTimer: 0,
  };
}

export function currentMission(missions) {
  return missions.done ? null : MISSIONS[missions.index];
}

export function startMission(missions, i = 0) {
  missions.index = i;
  missions.active = true;
  missions.done = false;
  const m = MISSIONS[i];
  missions.message = `MISSION: ${m.name} — ${m.brief}`;
  missions.messageTimer = 6;
}

export function completeMission(missions, player) {
  const m = MISSIONS[missions.index];
  missions.completed.push(m.id);
  if (player) player.money += m.pay;
  missions.index += 1;
  if (missions.index >= MISSIONS.length) {
    missions.done = true;
    missions.active = false;
    missions.message = 'STORY COMPLETE — Nova owns Solmar. $1000 bonus banked.';
    missions.messageTimer = 8;
    if (player) player.money += 1000;
    return 'story';
  }
  const next = MISSIONS[missions.index];
  missions.message = `MISSION COMPLETE: ${m.name} +$${m.pay}. Next: ${next.name} — ${next.brief}`;
  missions.messageTimer = 6;
  return 'mission';
}

// Check the active mission's win condition each frame.
// Returns 'mission' | 'story' | null.
export function updateMissions(missions, player, police, dt) {
  missions.messageTimer = Math.max(0, missions.messageTimer - dt);
  if (!missions.active || missions.done) return null;
  const m = MISSIONS[missions.index];
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  if (m.kind === 'drive' || m.kind === 'reach') {
    if (m.target && Math.hypot(px - m.target.x, py - m.target.y) < 70) {
      return completeMission(missions, player);
    }
  }
  if (m.kind === 'loseheat') {
    if (police.wanted === 0) return completeMission(missions, player);
  }
  return null;
}

// A crime during mission 3 ("Heat Rising") is part of the story: the
// mission starts with the cops already on Nova's tail.
export function armHeatMission(missions, police) {
  if (MISSIONS[missions.index].id !== 'heat') return;
  if (police.wanted === 0) {
    police.wanted = 2;
    police.heat = 2;
    police.sinceCrime = 0;
  }
}

// Skip the current mission (debug / stuck recovery): no payout, next one starts.
export function skipMission(missions) {
  if (missions.done) return;
  missions.index += 1;
  if (missions.index >= MISSIONS.length) {
    missions.done = true;
    missions.active = false;
    return;
  }
  const next = MISSIONS[missions.index];
  missions.message = `Skipped ahead: ${next.name} — ${next.brief}`;
  missions.messageTimer = 5;
}
