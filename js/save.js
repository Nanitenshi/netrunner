import { game } from "./core.js";

const KEY = "neonAlley_save_v1";

export function saveNow() {
  try {
    const data = {
      mode: "WORLD",
      money: game.money,
      heat: game.heat,
      frags: game.frags,
      district: game.district,
      globalProgress: game.globalProgress,
      missionsDone: game.missionsDone,
      upgrades: game.upgrades,
      selectedNodeId: game.selectedNodeId,
      perfMode: game.perfMode,
      storyLog: game.storyLog
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch {}
}
