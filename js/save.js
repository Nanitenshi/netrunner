// js/save.js
const SAVE_KEY = "neon_alley_v1";

export function loadSave() {
  try {
    const data = localStorage.getItem(SAVE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error("Save corrupted", e);
    return null;
  }
}

export function saveNow() {
  // Wir importieren den State dynamisch, um kreisförmige Abhängigkeiten zu vermeiden
  import("./core.js").then((module) => {
    const game = module.game;
    const data = {
      money: game.money,
      heat: game.heat,
      frags: game.frags,
      missionsDone: game.missionsDone,
      upgrades: game.upgrades,
      district: game.district,
      storyIndex: game.storyIndex
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  });
}

export function resetSave() {
  localStorage.removeItem(SAVE_KEY);
}
