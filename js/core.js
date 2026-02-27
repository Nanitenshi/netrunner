import { initThree, setMoodProgress } from "./threeScene.js";
import { initWorld, worldTick, handleWorldPointer } from "./world.js";
import { initUI, uiTick, toast } from "./ui.js";
import { loadSave, saveNow, resetSave } from "./save.js";
import { openNpcDialog, npcTick } from "./npc.js";
import { startMission, missionTick, handleMissionPointer } from "./missions.js";

// --- GLOBAL GAME STATE ---
export const game = {
  mode: "TITLE", // TITLE | WORLD | MISSION | RESULT
  money: 0,
  heat: 0,
  frags: 0,
  district: 1,
  globalProgress: 0, // 0..1 (day -> sunset -> night)
  storyIndex: 0,
  missionsDone: 0,

  upgrades: {
    buffer: 0,     // +time
    amplifier: 0,  // +hitbox
    pulse: 0       // active ability (slow time)
  },

  selectedNodeId: null,

  // Runtime references (nicht im Savegame speichern!)
  canvases: {
    three: null,
    world: null,
    mission: null
  },
  ctx: {
    world: null,
    mission: null
  }
};

// --- HELPER ---
const $ = (id) => document.getElementById(id);

// --- STATE MANAGEMENT ---
export function setMode(next) {
  game.mode = next;

  // Sichtbarkeit der Canvases steuern
  if (game.canvases.mission) {
    game.canvases.mission.style.display = (next === "MISSION") ? "block" : "none";
  }
  if (game.canvases.world) {
    // World ist auf TITLE und WORLD sichtbar (als Overlay über Three.js)
    game.canvases.world.style.display = (next === "MISSION" || next === "RESULT") ? "none" : "block";
  }

  // UI-Panels steuern (sicherstellen, dass die IDs existieren)
  const toggleVisibility = (id, forceShow) => {
    const el = $(id);
    if (el) el.classList.toggle("hidden", !forceShow);
  };

  toggleVisibility("title", next === "TITLE");
  toggleVisibility("leftPanel", next === "WORLD");
  toggleVisibility("rightPanel", next === "WORLD");
  toggleVisibility("missionHud", next === "MISSION");
  toggleVisibility("result", next === "RESULT");
}

// --- RESIZE HANDLING ---
function resizeAll() {
  const dpr = window.devicePixelRatio || 1;

  for (const key of ["three", "world", "mission"]) {
    const canvas = game.canvases[key];
    if (!canvas) continue;

    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    
    // ctx updaten, falls es ein 2D Canvas ist
    const ctx = game.ctx[key];
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

// --- INITIALIZATION ---
function boot() {
  console.log("System boot sequence initiated...");

  // DOM Elemente binden
  game.canvases.three = $("threeCanvas");
  game.canvases.world = $("worldCanvas");
  game.canvases.mission = $("missionCanvas");

  if (game.canvases.world) game.ctx.world = game.canvases.world.getContext("2d");
  if (game.canvases.mission) game.ctx.mission = game.canvases.mission.getContext("2d");

  // Pointer Events für World (mit preventDefault in den Handlern, um Scrollen zu verhindern)
  if (game.canvases.world) {
    game.canvases.world.addEventListener("pointerdown",   (e) => handleWorldPointer("down", e),   { passive: false });
    game.canvases.world.addEventListener("pointermove",   (e) => handleWorldPointer("move", e),   { passive: false });
    game.canvases.world.addEventListener("pointerup",     (e) => handleWorldPointer("up", e),     { passive: false });
    game.canvases.world.addEventListener("pointercancel", (e) => handleWorldPointer("cancel", e), { passive: false });
  }

  // Pointer Events für Mission
  if (game.canvases.mission) {
    game.canvases.mission.addEventListener("pointerdown",   (e) => handleMissionPointer("down", e),   { passive: false });
    game.canvases.mission.addEventListener("pointermove",   (e) => handleMissionPointer("move", e),   { passive: false });
    game.canvases.mission.addEventListener("pointerup",     (e) => handleMissionPointer("up", e),     { passive: false });
    game.canvases.mission.addEventListener("pointercancel", (e) => handleMissionPointer("cancel", e), { passive: false });
  }

  window.addEventListener("resize", resizeAll);

  // Spielstand laden (nur Spielwerte überschreiben, keine Laufzeit-Referenzen wie 'canvases')
  const savedData = loadSave();
  if (savedData) {
    // Sicheres Merge: Upgrades extra behandeln, falls neue im Code dazukamen
    const { upgrades, ...rest } = savedData;
    Object.assign(game, rest);
    if (upgrades) Object.assign(game.upgrades, upgrades);
  }

  // Module initialisieren
  initUI({ setMode, startMission, openNpcDialog, saveNow, resetSave });
  if (game.canvases.three) initThree(game.canvases.three);
  initWorld();
  
  toast("SYSTEM READY. TAP ENTER.");

  resizeAll();
  setMode("TITLE");

  // Main Menu Buttons
  const btnStart = $("btnStart");
  if (btnStart) {
    btnStart.onclick = () => {
      setMode("WORLD");
      toast("NIGHT CITY ONLINE.");
    };
  }

  const btnContinue = $("btnContinue");
  if (btnContinue) {
    // Zeige "Continue" nur, wenn es einen Save gibt
    btnContinue.style.display = savedData ? "inline-block" : "none";
    btnContinue.onclick = () => {
      setMode("WORLD");
      toast("LINK RESTORED.");
    };
  }

  const btnReset = $("btnReset");
  if (btnReset) {
    btnReset.onclick = () => {
      if (confirm("WARNING: PURGE ALL DATA?")) {
        resetSave();
        location.reload();
      }
    };
  }

  // Game Loop starten
  requestAnimationFrame(loop);
}

// --- MAIN LOOP ---
let lastTime = 0;

function loop(timeNow) {
  // Delta Time berechnen (max 33ms / ~30fps Fallback bei Lag)
  const dt = Math.min(0.033, (timeNow - lastTime) / 1000 || 0);
  lastTime = timeNow;

  // Globale Progression (Tageszeit)
  game.globalProgress = Math.min(1, game.missionsDone / 12);
  setMoodProgress(game.globalProgress);

  // State Updates
  if (game.mode === "WORLD" || game.mode === "TITLE") {
    worldTick(dt);
    npcTick(dt);
  }
  
  if (game.mode === "MISSION") {
    missionTick(dt, (resultData) => {
      // Mission abgeschlossen
      Object.assign(game, resultData.apply(game)); // Values von der Mission anwenden
      game.missionsDone += 1;
      saveNow();
      setMode("RESULT");
    });
  }

  // UI Update
  uiTick();

  // Nächster Frame
  requestAnimationFrame(loop);
}

// --- START ---
// Stelle sicher, dass das DOM komplett geladen ist
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
                                           }
