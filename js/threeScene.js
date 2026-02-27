import { initThree, setMoodProgress } from "./threeScene.js";
import { initWorld, worldTick, handleWorldPointer, worldCancelPointer, worldSetFocusToggle } from "./world.js";
import { initUI, uiTick, toast } from "./ui.js";
import { loadSave, saveNow, resetSave } from "./save.js";
import { openNpcDialog, npcTick } from "./npc.js";
import { startMission, missionTick, handleMissionPointer, missionCancelPointer, missionSetPaused } from "./missions.js";

export const game = {
  mode: "TITLE",
  paused: false,

  money: 0,
  heat: 0,
  frags: 0,
  district: 7,
  globalProgress: 0,
  missionsDone: 0,

  settings: {
    quality: "perf",   // "perf" | "sharp"
    autosave: true
  },

  selectedNodeId: null,

  canvases: { three: null, world: null, mission: null },
  ctx: { world: null, mission: null }
};

const $ = (id) => document.getElementById(id);

/* ================= MODE ================= */

export function setMode(next) {
  if (game.mode === next) return;

  worldCancelPointer?.();
  missionCancelPointer?.();

  game.mode = next;

  if (game.canvases.world) {
    const on = next === "TITLE" || next === "WORLD";
    game.canvases.world.style.display = on ? "block" : "none";
    game.canvases.world.style.pointerEvents = on ? "auto" : "none";
  }

  if (game.canvases.mission) {
    const on = next === "MISSION";
    game.canvases.mission.style.display = on ? "block" : "none";
    game.canvases.mission.style.pointerEvents = on ? "auto" : "none";
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

  setPaused(false);
}

/* ================= PAUSE ================= */

export function setPaused(p) {
  game.paused = !!p;
  missionSetPaused?.(game.paused);

  const btnPause = $("btnPause");
  if (btnPause) btnPause.textContent = game.paused ? "RESUME" : "PAUSE";

  toast(game.paused ? "PAUSED." : "RESUMED.");
}

export function togglePause() {
  setPaused(!game.paused);
}

/* ================= DPR ================= */

function getDpr() {
  const raw = window.devicePixelRatio || 1;
  const cap = (game.settings.quality === "perf") ? 1.15 : 1.6;
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
}

/* ================= POINTER ================= */

function bindCanvasPointers(canvas, handler, onlyWhen) {
  if (!canvas) return;

  const opts = { passive: false };

  const fire = (type, e) => {
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

/* ================= BOOT ================= */

function boot() {
  game.canvases.three = $("threeCanvas");
  game.canvases.world = $("worldCanvas");
  game.canvases.mission = $("missionCanvas");

  if (game.canvases.world)
    game.ctx.world = game.canvases.world.getContext("2d", { alpha: true });

  if (game.canvases.mission)
    game.ctx.mission = game.canvases.mission.getContext("2d", { alpha: true });

  const saved = loadSave();
  if (saved) Object.assign(game, saved);

  initUI({
    setMode,
    startMission: () => {
      if (!game.selectedNodeId) {
        toast("SELECT A NODE FIRST.");
        return;
      }
      startMission("cache");
      setMode("MISSION");
    },
    openNpcDialog,
    saveNow,
    resetSave,
    togglePause,
    toggleQuality: () => {
      game.settings.quality =
        game.settings.quality === "perf" ? "sharp" : "perf";
      saveNow();
      resizeAll();
      toast(game.settings.quality.toUpperCase());
    },
    toggleAutosave: () => {
      game.settings.autosave = !game.settings.autosave;
      saveNow();
      toast(game.settings.autosave ? "AUTO ON" : "AUTO OFF");
    },
    focusToggle: () => worldSetFocusToggle?.()
  });

  // 🔥 WICHTIG: PerfGetter gibt STRING zurück
  if (game.canvases.three) {
    initThree(game.canvases.three, () => game.settings.quality);
  }

  initWorld();

  bindCanvasPointers(
    game.canvases.world,
    handleWorldPointer,
    () => game.mode === "TITLE" || game.mode === "WORLD"
  );

  bindCanvasPointers(
    game.canvases.mission,
    handleMissionPointer,
    () => game.mode === "MISSION"
  );

  $("btnStart")?.addEventListener("click", () => {
    setMode("WORLD");
    toast("NIGHT CITY ONLINE.");
  });

  $("btnReset")?.addEventListener("click", () => {
    if (confirm("PURGE ALL DATA?")) {
      resetSave();
      location.reload();
    }
  });

  $("btnBackToCity")?.addEventListener("click", () => setMode("WORLD"));

  resizeAll();
  window.addEventListener("resize", resizeAll);

  setMode("TITLE");
  toast("SYSTEM READY.");

  requestAnimationFrame(loop);
}

/* ================= LOOP ================= */

let lastTime = 0;

function loop(now) {
  const dt = Math.min(0.033, ((now - lastTime) / 1000) || 0);
  lastTime = now;

  game.globalProgress = Math.min(1, game.missionsDone / 12);
  setMoodProgress(game.globalProgress);

  if (!game.paused) {
    if (game.mode === "WORLD" || game.mode === "TITLE") {
      worldTick(dt);
      npcTick(dt);
    }

    if (game.mode === "MISSION") {
      missionTick(dt, (resultData) => {
        Object.assign(game, resultData.apply(game));
        game.missionsDone += 1;
        if (game.settings.autosave) saveNow();
        setMode("RESULT");
      });
    }
  }

  uiTick(dt);
  requestAnimationFrame(loop);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
