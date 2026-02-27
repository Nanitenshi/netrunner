import { initThree, setMoodProgress, setPerfMode } from "./threeScene.js";
import { initWorld, worldTick, handleWorldPointer, worldSetFocusToggle } from "./world.js";
import { initUI, uiTick, toast } from "./ui.js";
import { loadSave, saveNow, resetSave } from "./save.js";
import { openNpcDialog, npcTick } from "./npc.js";
import { startMission, missionTick, handleMissionPointer } from "./missions.js";

export const game = {
  mode: "TITLE", // TITLE | WORLD | MISSION | RESULT
  money: 0,
  heat: 0,
  frags: 0,
  district: 7,
  globalProgress: 0,
  missionsDone: 0,
  storyLog: [],

  upgrades: { buffer: 0, amplifier: 0, pulse: 0 },
  selectedNodeId: null,

  perfMode: "perf", // perf | quality

  canvases: { three: null, world: null, mission: null },
  ctx: { world: null, mission: null }
};

const $ = (id) => document.getElementById(id);

export function setMode(next) {
  game.mode = next;

  if (game.canvases.mission) {
    game.canvases.mission.style.display = (next === "MISSION") ? "block" : "none";
  }
  if (game.canvases.world) {
    game.canvases.world.style.display = (next === "MISSION" || next === "RESULT") ? "none" : "block";
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
}

function resizeAll() {
  // Perf: niedrigere DPR auf Tablet
  const rawDpr = window.devicePixelRatio || 1;
  const dpr = (game.perfMode === "perf") ? Math.min(1.25, rawDpr) : Math.min(2, rawDpr);

  for (const key of ["three", "world", "mission"]) {
    const canvas = game.canvases[key];
    if (!canvas) continue;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);

    const ctx = game.ctx[key];
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function bindCanvasPointers(canvas, handler) {
  if (!canvas) return;
  const opts = { passive: false };

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
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

function boot() {
  game.canvases.three = $("threeCanvas");
  game.canvases.world = $("worldCanvas");
  game.canvases.mission = $("missionCanvas");

  if (game.canvases.world) game.ctx.world = game.canvases.world.getContext("2d", { alpha: true });
  if (game.canvases.mission) game.ctx.mission = game.canvases.mission.getContext("2d", { alpha: true });

  bindCanvasPointers(game.canvases.world, handleWorldPointer);
  bindCanvasPointers(game.canvases.mission, handleMissionPointer);

  window.addEventListener("resize", () => {
    resizeAll();
  });

  // Save load
  const saved = loadSave();
  if (saved) {
    const { upgrades, storyLog, ...rest } = saved;
    Object.assign(game, rest);
    if (upgrades) Object.assign(game.upgrades, upgrades);
    if (Array.isArray(storyLog)) game.storyLog = storyLog;
  }

  // API: HIER ist der Mission-Fix
  const api = {
    setMode,
    saveNow,
    resetSave,

    openNpcDialog: (nodeId) => openNpcDialog(nodeId),

    startMission: (type, nodeId) => {
      // mission init + SCREEN SWITCH
      setMode("MISSION");
      startMission(type, nodeId);
      toast("JACK IN…");
    },

    backToCity: () => {
      setMode("WORLD");
      toast("BACK TO CITY.");
    },

    setPerf: (mode) => {
      game.perfMode = mode;
      setPerfMode(mode);
      resizeAll();
      toast(mode === "perf" ? "PERF MODE." : "QUALITY MODE.");
    },

    focusToggle: () => worldSetFocusToggle()
  };

  initUI(api);
  initWorld();

  if (game.canvases.three) initThree(game.canvases.three, () => game.perfMode);
  setPerfMode(game.perfMode);

  resizeAll();
  setMode("TITLE");
  toast("SYSTEM READY.");

  // Buttons
  $("btnStart")?.addEventListener("click", () => { setMode("WORLD"); toast("NIGHT CITY ONLINE."); }, { passive: true });

  $("btnReset")?.addEventListener("click", () => {
    if (confirm("WARNING: PURGE ALL DATA?")) { resetSave(); location.reload(); }
  });

  $("btnBackToCity")?.addEventListener("click", () => api.backToCity());

  // Loop
  requestAnimationFrame(loop);
}

let last = 0;
let fpsT = 0, fpsN = 0, fps = 0;

function loop(t) {
  const dt = Math.min(0.033, (t - last) / 1000 || 0);
  last = t;

  // FPS
  fpsT += dt; fpsN++;
  if (fpsT >= 0.5) { fps = Math.round(fpsN / fpsT); fpsT = 0; fpsN = 0; }
  const fpsEl = $("hudFps"); if (fpsEl) fpsEl.textContent = String(fps);

  game.globalProgress = Math.min(1, game.missionsDone / 10);
  setMoodProgress(game.globalProgress);

  if (game.mode === "WORLD" || game.mode === "TITLE") {
    worldTick(dt);
    npcTick(dt);
  }

  if (game.mode === "MISSION") {
    missionTick(dt, (resultData) => {
      Object.assign(game, resultData.apply(game));
      game.missionsDone += 1;
      game.storyLog.unshift(resultData.storyLine);
      saveNow();
      // RESULT
      const resText = $("resText");
      if (resText) resText.textContent = resultData.report;
      setMode("RESULT");
    });
  }

  uiTick();
  requestAnimationFrame(loop);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
