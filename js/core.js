import { initThree, setMoodProgress, setThreeRunning, setThreeQuality } from "./threeScene.js";
import { initWorld, worldTick, handleWorldPointer, worldSetFocusToggle, getSelectedNode } from "./world.js";
import { initUI, uiTick, toast, pushStoryLog } from "./ui.js";
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
  storyIndex: 0,
  missionsDone: 0,

  upgrades: { buffer: 0, amplifier: 0, pulse: 0 },

  selectedNodeId: null,

  // perf
  qualityMode: "auto", // auto | quality | perf
  fps: 60,

  canvases: { three: null, world: null, mission: null },
  ctx: { world: null, mission: null }
};

const $ = (id) => document.getElementById(id);

export function setMode(next) {
  game.mode = next;

  // canvases
  if (game.canvases.mission) game.canvases.mission.style.display = (next === "MISSION") ? "block" : "none";
  if (game.canvases.world) game.canvases.world.style.display = (next === "MISSION") ? "none" : "block";

  // UI
  const show = (id, yes) => { const el = $(id); if (el) el.classList.toggle("hidden", !yes); };
  show("title", next === "TITLE");
  show("hudTop", next === "WORLD");
  show("leftPanel", next === "WORLD");
  show("rightPanel", next === "WORLD");
  show("missionHud", next === "MISSION");
  show("result", next === "RESULT");

  // perf: stop three during mission (huge win)
  if (next === "MISSION") setThreeRunning(false);
  else setThreeRunning(true);
}

// ---------- resize ----------
function resize2D(canvas, ctx) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function resizeAll() {
  if (game.canvases.world && game.ctx.world) resize2D(game.canvases.world, game.ctx.world);
  if (game.canvases.mission && game.ctx.mission) resize2D(game.canvases.mission, game.ctx.mission);
  // threeScene handles its own resize internally
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

// ---------- boot ----------
function boot() {
  game.canvases.three = $("threeCanvas");
  game.canvases.world = $("worldCanvas");
  game.canvases.mission = $("missionCanvas");

  if (game.canvases.world) game.ctx.world = game.canvases.world.getContext("2d", { alpha: true });
  if (game.canvases.mission) game.ctx.mission = game.canvases.mission.getContext("2d", { alpha: true });

  bindCanvasPointers(game.canvases.world, handleWorldPointer);
  bindCanvasPointers(game.canvases.mission, handleMissionPointer);

  window.addEventListener("resize", resizeAll);

  // load save
  const saved = loadSave();
  if (saved) {
    const { upgrades, ...rest } = saved;
    Object.assign(game, rest);
    if (upgrades) Object.assign(game.upgrades, upgrades);
  }

  initUI({
    setMode,
    onFocus: () => worldSetFocusToggle(),
    onStartMission: () => {
      const n = getSelectedNode();
      if (!n) return toast("Wähle einen Node.");
      if (n.type !== "mission") return toast("Das ist kein Mission-Node.");
      setMode("MISSION");               // <-- WICHTIG: Bildschirmwechsel
      startMission(n.missionType || "quick", n);
      toast(`MISSION: ${n.name}`);
    },
    onTalk: () => {
      const n = getSelectedNode();
      if (!n) return toast("Wähle einen Node.");
      openNpcDialog(n);
    },
    onReset: () => {
      if (confirm("WARNING: PURGE ALL DATA?")) { resetSave(); location.reload(); }
    },
    onQuality: (mode) => { game.qualityMode = mode; },
    onPause: () => {
      paused = !paused;
      toast(paused ? "PAUSED" : "RESUMED");
    },
    onBackToWorld: () => {
      setMode("WORLD");
    }
  });

  if (game.canvases.three) initThree(game.canvases.three);
  initWorld();

  resizeAll();
  setMode("TITLE");
  toast("SYSTEM READY.");

  const btnStart = $("btnStart");
  if (btnStart) {
    const go = () => { setMode("WORLD"); toast("NIGHT CITY ONLINE."); };
    btnStart.addEventListener("click", go);
    btnStart.addEventListener("touchstart", (e) => { e.preventDefault(); go(); }, { passive:false });
  }

  requestAnimationFrame(loop);
}

// ---------- perf / fps ----------
let lastT = 0;
let fpsSMA = 60;
let paused = false;
let tickAcc = 0;

function autoQuality(dt) {
  // fps estimate
  const fpsNow = 1 / Math.max(0.00001, dt);
  fpsSMA = fpsSMA * 0.9 + fpsNow * 0.1;
  game.fps = Math.round(fpsSMA);

  // auto mode chooses quality bucket
  if (game.qualityMode !== "auto") {
    setThreeQuality(game.qualityMode);
    return;
  }

  // thresholds tuned for tablets
  if (fpsSMA < 34) setThreeQuality("perf");
  else if (fpsSMA > 52) setThreeQuality("quality");
  // else keep
}

// ---------- main loop ----------
function loop(t) {
  const dtRaw = (t - lastT) / 1000 || 0;
  lastT = t;

  // cap dt to avoid jumps
  const dt = Math.min(0.033, dtRaw);

  if (!paused) {
    autoQuality(dt);

    game.globalProgress = Math.min(1, game.missionsDone / 12);
    setMoodProgress(game.globalProgress);

    if (game.mode === "WORLD" || game.mode === "TITLE") {
      worldTick(dt);
      npcTick(dt);
    }

    if (game.mode === "MISSION") {
      // Mission läuft komplett in 2D (Three ist paused)
      missionTick(dt, (result) => {
        // apply results
        Object.assign(game, result.apply(game));
        game.missionsDone += 1;
        pushStoryLog(result.storyLine || `Mission abgeschlossen: +${result.frags || 0} Frags`);
        saveNow();
        setMode("RESULT");

        const rt = $("resultText");
        if (rt) {
          rt.innerHTML = `
            <div><b>Ergebnis:</b> ${result.title || "Mission Report"}</div>
            <div style="margin-top:8px">+E$ ${result.cash || 0}</div>
            <div>+Frags ${result.frags || 0}</div>
            <div style="margin-top:8px;color:var(--muted)">${result.storyLine || ""}</div>
          `;
        }
      });
    }

    uiTick();
  }

  requestAnimationFrame(loop);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
