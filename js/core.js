// js/core.js
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
  globalProgress: 0,
  storyIndex: 0,
  missionsDone: 0,

  upgrades: {
    buffer: 0,
    amplifier: 0,
    pulse: 0
  },

  selectedNodeId: null,

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

const $ = (id) => document.getElementById(id);

// --- STATE MANAGEMENT (FIXED for your current index.html IDs) ---
export function setMode(next) {
  game.mode = next;

  // Canvases visibility
  if (game.canvases.mission) {
    game.canvases.mission.style.display = (next === "MISSION") ? "block" : "none";
  }
  if (game.canvases.world) {
    // World shown in TITLE + WORLD, hidden during mission/result
    game.canvases.world.style.display = (next === "MISSION" || next === "RESULT") ? "none" : "block";
  }
  if (game.canvases.three) {
    // Keep 3D on in WORLD (optional: also in TITLE)
    game.canvases.three.style.display = (next === "WORLD" || next === "TITLE") ? "block" : "block";
  }

  // Helper: show/hide by toggling .hidden
  const show = (id, yes) => {
    const el = $(id);
    if (!el) return;
    el.classList.toggle("hidden", !yes);
  };

  // ✅ IDs from your index:
  // title, hudTop, rightPanel, toast
  show("title", next === "TITLE");
  show("hudTop", next === "WORLD" || next === "MISSION");
  show("rightPanel", next === "WORLD");

  // Optional future panels (safe if missing)
  show("leftPanel", next === "WORLD");
  show("missionHud", next === "MISSION");
  show("result", next === "RESULT");

  console.log("[MODE]", next);
}

// --- RESIZE HANDLING ---
function resizeAll() {
  const dpr = window.devicePixelRatio || 1;

  const fit = (canvas, ctx2d) => {
    if (!canvas) return;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    if (ctx2d) ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  fit(game.canvases.three, null);          // WebGL handles its own scale usually, but this keeps size correct
  fit(game.canvases.world, game.ctx.world);
  fit(game.canvases.mission, game.ctx.mission);
}

// --- INITIALIZATION ---
function boot() {
  console.log("System boot sequence initiated...");

  // Bind DOM
  game.canvases.three = $("threeCanvas");
  game.canvases.world = $("worldCanvas");
  game.canvases.mission = $("missionCanvas");

  if (game.canvases.world) game.ctx.world = game.canvases.world.getContext("2d");
  if (game.canvases.mission) game.ctx.mission = game.canvases.mission.getContext("2d");

  // Pointer events (WORLD)
  if (game.canvases.world) {
    const c = game.canvases.world;
    c.addEventListener("pointerdown",   (e) => handleWorldPointer("down", e),   { passive: false });
    c.addEventListener("pointermove",   (e) => handleWorldPointer("move", e),   { passive: false });
    c.addEventListener("pointerup",     (e) => handleWorldPointer("up", e),     { passive: false });
    c.addEventListener("pointercancel", (e) => handleWorldPointer("cancel", e), { passive: false });
  }

  // Pointer events (MISSION)
  if (game.canvases.mission) {
    const c = game.canvases.mission;
    c.addEventListener("pointerdown",   (e) => handleMissionPointer("down", e),   { passive: false });
    c.addEventListener("pointermove",   (e) => handleMissionPointer("move", e),   { passive: false });
    c.addEventListener("pointerup",     (e) => handleMissionPointer("up", e),     { passive: false });
    c.addEventListener("pointercancel", (e) => handleMissionPointer("cancel", e), { passive: false });
  }

  window.addEventListener("resize", resizeAll);

  // Load save (safe merge)
  const savedData = loadSave();
  if (savedData) {
    const { upgrades, ...rest } = savedData;
    Object.assign(game, rest);
    if (upgrades) Object.assign(game.upgrades, upgrades);
  }

  // Init modules (UI first so toast works)
  initUI({ setMode, startMission, openNpcDialog, saveNow, resetSave });

  // ✅ FAIL-SAFE: Three init must not crash the whole app
  try {
    if (game.canvases.three) initThree(game.canvases.three);
  } catch (err) {
    console.error("Three init failed:", err);
    toast("3D OFFLINE — 2D WORLD ACTIVE");
  }

  initWorld();

  resizeAll();
  setMode("TITLE");
  toast("SYSTEM READY. TAP ENTER.");

  // --- Buttons (match your index IDs) ---
  const btnStart = $("btnStart");
  if (btnStart) {
    btnStart.addEventListener("click", () => {
      console.log("[BTN] Start pressed");
      setMode("WORLD");
      toast("NIGHT CITY ONLINE. TAP A NODE.");
    });
  } else {
    console.warn("btnStart not found in DOM.");
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

  // Start loop
  requestAnimationFrame(loop);
}

// --- MAIN LOOP ---
let lastTime = 0;

function loop(timeNow) {
  const dt = Math.min(0.033, (timeNow - lastTime) / 1000 || 0);
  lastTime = timeNow;

  // Global mood progress
  game.globalProgress = Math.min(1, game.missionsDone / 12);
  try { setMoodProgress(game.globalProgress); } catch {}

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
