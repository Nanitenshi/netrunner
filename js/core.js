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

  // UI-Panels steuern
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

    const ctx = game.ctx[key];
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

// --- POINTER HELPERS (FIX: Tablet verwertet Touch korrekt) ---
function bindCanvasPointers(canvas, handler) {
  if (!canvas) return;

  // Wichtig: auf manchen Android-Geräten sind Pointer-Events ohne preventDefault + passive:false “halb kaputt”
  const opts = { passive: false };

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    // Capture hilft gegen pointercancel / verloren gegangene pointerup
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    handler("down", e);
  }, opts);

  canvas.addEventListener("pointermove", (e) => {
    e.preventDefault();
    handler("move", e);
  }, opts);

  canvas.addEventListener("pointerup", (e) => {
    e.preventDefault();
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
    handler("up", e);
  }, opts);

  canvas.addEventListener("pointercancel", (e) => {
    e.preventDefault();
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
    handler("cancel", e);
  }, opts);
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

  // FIX: Pointer sauber binden (World + Mission)
  bindCanvasPointers(game.canvases.world, handleWorldPointer);
  bindCanvasPointers(game.canvases.mission, handleMissionPointer);

  window.addEventListener("resize", resizeAll);

  // Spielstand laden (nur Spielwerte überschreiben)
  const savedData = loadSave();
  if (savedData) {
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
    // FIX: click + touchstart (manche Android Browser haben delay/quirks bei click)
    btnStart.addEventListener("click", () => {
      setMode("WORLD");
      toast("NIGHT CITY ONLINE.");
    });
    btnStart.addEventListener("touchstart", (e) => {
      e.preventDefault();
      setMode("WORLD");
      toast("NIGHT CITY ONLINE.");
    }, { passive: false });
  }

  const btnContinue = $("btnContinue");
  if (btnContinue) {
    btnContinue.style.display = savedData ? "inline-block" : "none";
    btnContinue.addEventListener("click", () => {
      setMode("WORLD");
      toast("LINK RESTORED.");
    });
    btnContinue.addEventListener("touchstart", (e) => {
      e.preventDefault();
      setMode("WORLD");
      toast("LINK RESTORED.");
    }, { passive: false });
  }

  const btnReset = $("btnReset");
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      if (confirm("WARNING: PURGE ALL DATA?")) {
        resetSave();
        location.reload();
      }
    });
  }

  requestAnimationFrame(loop);
}

// --- MAIN LOOP ---
let lastTime = 0;

function loop(timeNow) {
  const dt = Math.min(0.033, (timeNow - lastTime) / 1000 || 0);
  lastTime = timeNow;

  // Tageszeit
  game.globalProgress = Math.min(1, game.missionsDone / 12);
  setMoodProgress(game.globalProgress);

  if (game.mode === "WORLD" || game.mode === "TITLE") {
    worldTick(dt);
    npcTick(dt);
  }

  if (game.mode === "MISSION") {
    missionTick(dt, (resultData) => {
      Object.assign(game, resultData.apply(game));
      game.missionsDone += 1;
      saveNow();
      setMode("RESULT");
    });
  }

  uiTick();
  requestAnimationFrame(loop);
}

// --- START ---
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
