// Save / load: progress (money, respect, missions, position, health) in
// localStorage, written on mission complete and on demand, read at boot.
export const SAVE_KEY = 'solmarbay.save.v1';

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      respect: state.respect,
      health: state.health,
      ammo: state.ammo,
      missionIndex: state.missionIndex,
      missionDone: state.missionDone,
      player: { x: state.player.x, z: state.player.z, angle: state.player.angle },
      day: state.day,
      stats: state.stats,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number') return null;
    return data;
  } catch { return null; }
}

export function hasSave() { return loadGame() !== null; }

/** Apply a loaded save onto a fresh state object. */
export function applySave(state, data) {
  state.money = data.money;
  state.respect = data.respect || 0;
  state.health = data.health || 100;
  state.ammo = data.ammo || 24;
  state.missionIndex = data.missionIndex || 0;
  if (Array.isArray(data.missionDone)) state.missionDone = data.missionDone;
  if (data.player) {
    state.player.x = data.player.x;
    state.player.z = data.player.z;
    state.player.angle = data.player.angle || 0;
  }
  state.day = data.day || 1;
  if (data.stats) state.stats = { ...state.stats, ...data.stats };
}

/** Wipe the save (used by Restart Day). */
export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
