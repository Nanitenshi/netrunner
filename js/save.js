import { game } from "./core.js";

const KEY = "neonAlley_save_v1";

export function saveNow() {
  try {
    const data = {
      mode: "WORLD",
      money: game.money,
      heat: game.heat,
      frags: game.frags,
      psychosis: game.psychosis,
      build: game.build,
      programsOwned: game.programsOwned,
      district: game.district,
      dayClock: game.dayClock,
      missionsDone: game.missionsDone,
      upgrades: game.upgrades,
      crew: game.crew,
      daily: game.daily,
      stats: game.stats,
      buffs: game.buffs,
      storyStage: game.storyStage,
      tutorialDone: game.tutorialDone,
      settings: game.settings,
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
