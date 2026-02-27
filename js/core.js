import { initThree, setMoodProgress } from "./threeScene.js";
import { initWorld, worldTick, handleWorldPointer, worldSetFocusToggle } from "./world.js";
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

  upgrades: { buffer: 0, amplifier: 0, pulse: 0 },
  selectedNodeId: null,

  canvases: { three: null, world: null, mission: null },
  ctx: { world: null, mission: null }
};

const $ = (id) => document.getElementById(id);

export function setMode(next) {
  game.mode = next;

  // canvases
  if (game.canvases.mission) game.canvases.mission.style.display = (next === "MISSION") ? "block" : "none";
  if (game.canvases.world) game.canvases.world.style.display = (next === "MISSION" || next === "RESULT") ? "none" : "block";

  const show = (id, on) => {
    const el = $(id);
    if (el) el.classList.toggle("hidden", !on);
  };

  show("title", next === "TITLE");
  show("hudTop", next === "WORLD" || next === "MISSION");
  show("leftPanel", next === "WORLD");
  show("rightPanel", next === "WORLD");
  show("missionHud", next === "MISSION");
  show("result", next === "RESULT");
}

function resizeAll() {
  const dpr = window.devicePixelRatio || 1;
  for (const key of ["three", "world", "mission"]) {
    const c = game.canvases[key];
    if (!c) continue;
    c.width = Math.floor(window.innerWidth * dpr);
    c.height = Math.floor(window.innerHeight * dpr);

    const ctx = game.ctx[key];
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function boot() {
  console.log("Boot…");

  game.canvases.three = $("threeCanvas");
  game.canvases.world = $("worldCanvas");
  game.canvases.mission = $("missionCanvas");

  if (game.canvases.world) game.ctx.world = game.canvases.world.getContext("2d");
  if (game.canvases.mission) game.ctx.mission = game.canvases.mission.getContext("2d");

  // Pointer Events World
  if (game.canvases.world) {
    const c = game.canvases.world;
    c.addEventListener("pointerdown",   (e) => handleWorldPointer("down", e),   { passive: false });
    c.addEventListener("pointermove",   (e) => handleWorldPointer("move", e),   { passive: false });
    c.addEventListener("pointerup",     (e) => handleWorldPointer("up", e),     { passive: false });
    c.addEventListener("pointercancel", (e) => handleWorldPointer("cancel", e), { passive: false });
  }

  // Pointer Events Mission
  if (game.canvases.mission) {
    const c = game.canvases.mission;
    c.addEventListener("pointerdown",   (e) => handleMissionPointer("down", e),   { passive: false });
    c.addEventListener("pointermove",   (e) => handleMissionPointer("move", e),   { passive: false });
    c.addEventListener("pointerup",     (e) => handleMissionPointer("up", e),     { passive: false });
    c.addEventListener("pointercancel", (e) => handleMissionPointer("cancel", e), { passive: false });
  }

  window.addEventListener("resize", resizeAll);

  // Save laden
  const saved = loadSave();
  if (saved) {
    const { upgrades, ...rest } = saved;
    Object.assign(game, rest);
    if (upgrades) Object.assign(game.upgrades, upgrades);
  }

  initUI({ setMode, startMission, openNpcDialog, saveNow, resetSave });
  if (game.canvases.three) initThree(game.canvases.three);
  initWorld();

  resizeAll();
  setMode("TITLE");
  toast("SYSTEM READY. TAP ENTER.");

  // Buttons
  const btnStart = $("btnStart");
  if (btnStart) btnStart.onclick = () => { setMode("WORLD"); toast("NIGHT CITY ONLINE."); };

  const btnContinue = $("btnContinue");
  if (btnContinue) {
    btnContinue.style.display = saved ? "inline-block" : "none";
    btnContinue.onclick = () => { setMode("WORLD"); toast("LINK RESTORED."); };
  }

  const btnReset = $("btnReset");
  if (btnReset) btnReset.onclick = () => {
    if (confirm("WARNING: PURGE ALL DATA?")) { resetSave(); location.reload(); }
  };

  const btnFocus = $("btnFocus");
  if (btnFocus) btnFocus.onclick = () => worldSetFocusToggle();

  const btnSave = $("btnSave");
  if (btnSave) btnSave.onclick = () => { saveNow(); toast("SAVE WRITTEN."); };

  const btnBack = $("btnBackToWorld");
  if (btnBack) btnBack.onclick = () => { setMode("WORLD"); toast("BACK ONLINE."); };

  requestAnimationFrame(loop);
}

let lastTime = 0;
function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;

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
      const rt = document.getElementById("resultText");
      if (rt) rt.textContent = resultData.text || "Mission complete.";
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
