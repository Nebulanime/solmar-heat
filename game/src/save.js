// Saving: the player's cash, story progress and pistol live in localStorage,
// so a session can be continued from the title screen. Nothing leaves the
// browser; a missing or corrupt save just starts fresh.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: typeof data.cash === 'number' ? data.cash : 120,
      missionIndex: typeof data.missionIndex === 'number' ? data.missionIndex : 0,
      hasPistol: data.hasPistol === true,
      pistolAmmo: typeof data.pistolAmmo === 'number' ? data.pistolAmmo : 0,
      bestCash: typeof data.bestCash === 'number' ? data.bestCash : 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(world) {
  try {
    const data = {
      cash: world.state.cash,
      missionIndex: world.missions.index,
      hasPistol: world.combat.hasPistol,
      pistolAmmo: world.combat.pistolAmmo,
      bestCash: Math.max(world.state.cash, world.bestCash || 0),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage off: nothing to clear.
  }
}
