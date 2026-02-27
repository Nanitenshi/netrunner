import { game } from "./core.js";

const KEY = "neon_alley_save_v1";

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveNow() {
  try {
    const data = {
      money: game.money,
      heat: game.heat,
      frags: game.frags,
      district: game.district,
      globalProgress: game.globalProgress,
      storyIndex: game.storyIndex,
      missionsDone: game.missionsDone,
      upgrades: { ...game.upgrades },
      selectedNodeId: game.selectedNodeId
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch {}
}
