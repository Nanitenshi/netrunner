import { initThree, setMoodProgress, setPaused as setThreePaused, setQuality as setThreeQuality } from "./threeScene.js";
import { initWorld, worldTick, handleWorldPointer, worldCancelPointer } from "./world.js";
import { initUI, uiTick, toast } from "./ui.js";
import { loadSave, saveNow, resetSave } from "./save.js";
import { openNpcDialog, npcTick } from "./npc.js";
import { startMission, missionTick, handleMissionPointer, missionCancelPointer, missionSetPaused } from "./missions.js";

export const game = {
  mode: "TITLE", // TITLE | WORLD | MISSION | RESULT
  paused: false,

  money: 0,
  heat: 0,
  frags: 0,
  district: 1,
  globalProgress: 0,
  storyIndex: 0,
  missionsDone: 0,

  settings: {
    perfMode: true, // default: true fürs Tablet
    autoMode: false
  },

  upgrades: { buffer: 0, amplifier: 0, pulse: 0 },
  selectedNodeId: null,

  canvases: { three: null, world: null, mission: null },
  ctx: { world: null, mission: null }
};

const $ = (id) => document.getElementById(id);

// ===== Mode switching (FIX: Input sauber trennen + Capture killen) =====
export function setMode(next) {
  if (game.mode === next) return;

  // HARD CANCEL input on switch (wichtig wegen PointerCapture)
  worldCancelPointer?.();
  missionCancelPointer?.();

  game.mode = next;

  // Canvas visibility + pointer-events (entscheidend!)
  if (game.canvases.world) {
    const worldOn = (next === "TITLE" || next === "WORLD");
    game.canvases.world.style.display = worldOn ? "block" : "none";
    game.canvases.world.style.pointerEvents = worldOn ? "auto" : "none";
  }
  if (game.canvases.mission) {
    const misOn = (next === "MISSION");
    game.canvases.mission.style.display = misOn ? "block" : "none";
    game.canvases.mission.style.pointerEvents = misOn ? "auto" : "none";
  }

  const toggle = (id, show) => {
    const el = $(id);
    if (el) el.classList.toggle("hidden", !show);
  };

  toggle("title", next === "TITLE");
  toggle("hudTop", next !== "TITLE");
  toggle("leftPanel", next === "WORLD");
  toggle("rightPanel", next === "WORLD");
  toggle("missionHud", next === "MISSION");
  toggle("result", next === "RESULT");

  // Pause beim Moduswechsel immer aus
  setPaused(false);
}

// ===== Pause System (FIX: echte Pause) =====
export function setPaused(p) {
  game.paused = !!p;

  // Mission/Three synchronisieren
  missionSetPaused?.(game.paused);
  setThreePaused?.(game.paused);

  // optional UI state
  const btnPause = $("btnPause");
  if (btnPause) btnPause.textContent = game.paused ? "RESUME" : "PAUSE";

  toast(game.paused ? "PAUSED." : "RESUMED.");
}

export function togglePause() {
  setPaused(!game.paused);
}

// ===== Quality / DPR (Performance) =====
function getDpr() {
  // Tablet-friendly: lieber stabil als ultra sharp
  const raw = window.devicePixelRatio || 1;
  const cap = game.settings.perfMode ? 1.15 : 1.6;
  return Math.max(1, Math.min(cap, raw));
}

function resizeAll() {
  const dpr = getDpr();

  for (const key of ["world", "mission"]) {
    const canvas = game.canvases[key];
    if (!canvas) continue;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    const ctx = game.ctx[key];
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Three bekommt eigenes Quality-Handling
  if (game.canvases.three) {
    setThreeQuality?.({ dpr });
  }
}

// ===== Pointer binding (FIX: routed by mode) =====
function bindCanvasPointers(canvas, handler, onlyWhen) {
  if (!canvas) return;
  const opts = { passive: false };

  const fire = (type, e) => {
    // nie durchreichen wenn falscher Mode oder paused
    if (!onlyWhen()) return;
    if (game.paused) return;
    e.preventDefault();
    handler(type, e);
  };

  canvas.addEventListener("pointerdown", (e) => {
    if (!onlyWhen()) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    handler("down", e);
  }, opts);

  canvas.addEventListener("pointermove", (e) => fire("move", e), opts);

  canvas.addEventListener("pointerup", (e) => {
    if (!onlyWhen()) return;
    e.preventDefault();
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
    handler("up", e);
  }, opts);

  canvas.addEventListener("pointercancel", (e) => {
    if (!onlyWhen()) return;
    e.preventDefault();
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
    handler("cancel", e);
  }, opts);
}

// ===== Boot =====
function boot() {
  game.canvases.three = $("threeCanvas");
  game.canvases.world = $("worldCanvas");
  game.canvases.mission = $("missionCanvas");

  if (game.canvases.world) game.ctx.world = game.canvases.world.getContext("2d", { alpha: true });
  if (game.canvases.mission) game.ctx.mission = game.canvases.mission.getContext("2d", { alpha: true });

  // Save load
  const savedData = loadSave();
  if (savedData) {
    const { upgrades, settings, ...rest } = savedData;
    Object.assign(game, rest);
    if (upgrades) Object.assign(game.upgrades, upgrades);
    if (settings) Object.assign(game.settings, settings);
  }

  // UI API
  initUI({
    setMode,
    startMission: (type) => {
      // start mission + switch mode
      startMission(type);
      setMode("MISSION");
    },
    openNpcDialog,
    saveNow,
    resetSave,
    togglePause,
    togglePerf: () => {
      game.settings.perfMode = !game.settings.perfMode;
      saveNow();
      resizeAll();
      toast(game.settings.perfMode ? "PERF: ON" : "PERF: OFF");
    },
    toggleAuto: () => {
      game.settings.autoMode = !game.settings.autoMode;
      saveNow();
      toast(game.settings.autoMode ? "AUTO: ON" : "AUTO: OFF");
    }
  });

  // Three
  if (game.canvases.three) initThree(game.canvases.three, { dpr: getDpr() });

  // World init
  initWorld();
  resizeAll();
  window.addEventListener("resize", resizeAll);

  // Pointer routing: world only when TITLE/WORLD, mission only when MISSION
  bindCanvasPointers(game.canvases.world, handleWorldPointer, () => game.mode === "TITLE" || game.mode === "WORLD");
  bindCanvasPointers(game.canvases.mission, handleMissionPointer, () => game.mode === "MISSION");

  toast("SYSTEM READY.");
  setMode("TITLE");

  requestAnimationFrame(loop);
}

let lastTime = 0;
function loop(timeNow) {
  const dtRaw = (timeNow - lastTime) / 1000 || 0;
  const dt = Math.min(0.033, dtRaw);
  lastTime = timeNow;

  // Mood
  game.globalProgress = Math.min(1, game.missionsDone / 12);
  setMoodProgress(game.globalProgress);

  // Wenn paused: UI darf weiter, aber game ticks nicht
  if (!game.paused) {
    if (game.mode === "WORLD" || game.mode === "TITLE") {
      worldTick(dt);
      npcTick(dt);
    }

    if (game.mode === "MISSION") {
      missionTick(dt, (resultData) => {
        Object.assign(game, resultData.apply(game));
        game.missionsDone += 1;
        saveNow();
        setMode("WORLD");
      });
    }
  }

  uiTick();
  requestAnimationFrame(loop);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
