// js/core.js
import {
  initThree,
  setMoodProgress,
  setPaused as setThreePaused,
  setQuality as setThreeQuality
} from "./threeScene.js?v=31691361";

import {
  initWorld,
  worldTick,
  handleWorldPointer,
  worldCancelPointer,
  worldSetFocusToggle
} from "./world.js?v=31691361";

import { initUI, uiTick, toast, setComms } from "./ui.js?v=31691361";
import { loadSave, saveNow, resetSave } from "./save.js?v=31691361";
import { openNpcDialog, npcTick } from "./npc.js?v=31691361";
import { initCrewUI, closeCrewOverlay } from "./crew.js?v=31691361";
import { unlockAudio } from "./sfx.js?v=31691361";
import { musicSetEnabled, musicSetIntensity } from "./music.js?v=31691361";

import {
  startDive,
  diveTick,
  handleDivePointer,
  diveCancelPointer,
  diveSetPaused,
  initDive
} from "./dive.js?v=31691361";

const DAY_CYCLE = 220; // seconds for a full day/night loop

export const game = {
  mode: "TITLE", // TITLE | WORLD | MISSION | RESULT
  paused: false,

  money: 0,
  heat: 0,
  frags: 0,
  district: 7,
  dayClock: 0,
  dayRatio: 0,
  missionsDone: 0,

  settings: {
    quality: "perf", // perf | quality
    autosave: true,
    music: true
  },

  upgrades: { buffer: 0, amplifier: 0, pulse: 0 },
  crew: { roster: {}, equipped: [], pity: 0 },
  daily: { date: "", done: false },
  stats: { bestLayer: 0, dives: 0, dumps: 0 },
  selectedNodeId: null,
  selectedMissionType: null,
  selectedMissionTier: 1,
  selectedMissionHot: false,
  storyLog: [],

  canvases: { three: null, world: null, mission: null },
  ctx: { world: null, mission: null }
};

const $ = (id) => document.getElementById(id);

/* ---------------- DAILY (Tagesauftrag) ---------------- */
export const DAILY_GOAL_LAYER = 3;
export const DAILY_REWARD = 30;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function checkDailyReset() {
  if (game.daily.date !== todayStr()) {
    game.daily = { date: todayStr(), done: false };
  }
}

/* ---------------- MODE ---------------- */
export function setMode(next) {
  if (game.mode === next) return;

  // IMPORTANT: cancel pointer state on mode switch
  worldCancelPointer?.();
  diveCancelPointer?.();

  game.mode = next;

  // canvas visibility + input routing
  if (game.canvases.world) {
    const on = (next === "TITLE" || next === "WORLD");
    game.canvases.world.style.display = on ? "block" : "none";
    game.canvases.world.style.pointerEvents = on ? "auto" : "none";
  }

  if (game.canvases.mission) {
    const on = (next === "MISSION");
    game.canvases.mission.style.display = on ? "block" : "none";
    game.canvases.mission.style.pointerEvents = on ? "auto" : "none";
  }

  // UI panels
  const toggle = (id, show) => {
    const el = $(id);
    if (el) el.classList.toggle("hidden", !show);
  };

  toggle("title", next === "TITLE");
  // Stadt-HUD im Dive ausblenden: verhindert Chip-Überlappung auf schmalen
  // Screens und gibt der Spielfläche ~100px mehr Höhe
  toggle("hudTop", next !== "TITLE" && next !== "MISSION");
  toggle("leftPanel", next === "WORLD");
  toggle("rightPanel", next === "WORLD");
  toggle("missionHud", next === "MISSION");
  toggle("result", next === "RESULT");
  toggle("diveChoice", false);
  closeCrewOverlay?.();

  // Musik: dichter im Dive, ruhiger in der Stadt
  musicSetIntensity(next === "MISSION" ? 1 : 0);

  // Erste-Schritte-Hinweis für frische Spieler
  if (next === "WORLD" && game.missionsDone === 0 && !game._introShown) {
    game._introShown = true;
    setComms(`NYX: „Lauf zum CACHE POP TERMINAL — dein erster Dive wartet. Tipp einfach hin.“`);
  }

  // no pause carryover
  setPaused(false);
}

/* ---------------- PAUSE ---------------- */
export function setPaused(p) {
  game.paused = !!p;
  diveSetPaused?.(game.paused);
  setThreePaused?.(game.paused);

  const btnPause = $("btnPause");
  if (btnPause) btnPause.textContent = game.paused ? "RESUME" : "PAUSE";

  toast(game.paused ? "PAUSED." : "RESUMED.");
}

export function togglePause() {
  setPaused(!game.paused);
}

/* ---------------- QUALITY / DPR ---------------- */
function getDpr() {
  const raw = window.devicePixelRatio || 1;
  // Honor Pad x9a: keep DPR low in perf mode
  const cap = (game.settings.quality === "perf") ? 1.0 : 1.5;
  return Math.max(1, Math.min(cap, raw));
}

function applyQualityToThree() {
  setThreeQuality?.({ dpr: getDpr(), perf: (game.settings.quality === "perf") });
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

  applyQualityToThree();
}

/* ---------------- POINTER ROUTING ---------------- */
function bindCanvasPointers(canvas, handler, onlyWhen) {
  if (!canvas) return;
  const opts = { passive: false };

  const ok = () => onlyWhen() && !game.paused;

  canvas.addEventListener("pointerdown", (e) => {
    if (!ok()) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    handler("down", e);
  }, opts);

  canvas.addEventListener("pointermove", (e) => {
    if (!ok()) return;
    e.preventDefault();
    handler("move", e);
  }, opts);

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

/* ---------------- BOOT ---------------- */
function boot() {
  // bind DOM
  game.canvases.three = $("threeCanvas");
  game.canvases.world = $("worldCanvas");
  game.canvases.mission = $("missionCanvas");

  if (game.canvases.world) game.ctx.world = game.canvases.world.getContext("2d", { alpha: true, desynchronized: true });
  if (game.canvases.mission) game.ctx.mission = game.canvases.mission.getContext("2d", { alpha: true, desynchronized: true });

  // load save
  const saved = loadSave();
  if (saved) {
    const { upgrades, settings, crew, daily, stats, ...rest } = saved;
    Object.assign(game, rest);
    if (upgrades) Object.assign(game.upgrades, upgrades);
    if (settings) Object.assign(game.settings, settings);
    if (daily) Object.assign(game.daily, daily);
    if (stats) Object.assign(game.stats, stats);
    if (crew) {
      if (crew.roster) game.crew.roster = crew.roster;
      if (Array.isArray(crew.equipped)) game.crew.equipped = crew.equipped;
      if (typeof crew.pity === "number") game.crew.pity = crew.pity;
    }
  } else {
    // Frischer Start: Nyx schickt dir JUNO + genug Frags für 2 Pulls
    game.frags = 40;
    game.crew.roster = { juno: 1 };
    game.crew.equipped = ["juno"];
    game.storyLog.unshift(`> NYX: „Ich hab dir JUNO geschickt. Und 40 Frags. Verkack's nicht.“`);
  }

  checkDailyReset();

  // init modules
  initUI({
    setMode,
    startMission: () => {
      if (!game.selectedNodeId) {
        toast("WÄHL ZUERST EINEN NODE.");
        return;
      }
      const type = game.selectedMissionType;
      if (!type) {
        toast("DIESER NODE HAT KEINEN NETZZUGANG.");
        return;
      }
      setMode("MISSION");
      startDive(type, game.selectedMissionTier || 1, game.selectedMissionHot);
    },
    openNpcDialog,
    saveNow,
    resetSave,
    togglePause,
    toggleQuality: () => {
      game.settings.quality = (game.settings.quality === "perf") ? "quality" : "perf";
      saveNow();
      resizeAll();
      toast(game.settings.quality === "perf" ? "QUALITY: PERF" : "QUALITY: SHARP");
    },
    toggleAutosave: () => {
      game.settings.autosave = !game.settings.autosave;
      saveNow();
      toast(game.settings.autosave ? "AUTO: ON" : "AUTO: OFF");
    },
    toggleMusic: () => {
      game.settings.music = !game.settings.music;
      saveNow();
      musicSetEnabled(game.settings.music);
      toast(game.settings.music ? "MUSIK: ON" : "MUSIK: OFF");
    },
    focusToggle: () => worldSetFocusToggle?.()
  });

  // three background
  if (game.canvases.three) {
    initThree(game.canvases.three, { dpr: getDpr(), perf: game.settings.quality === "perf" });
  }

  // overworld nodes
  initWorld();

  initDive();
  initCrewUI();

  // Audio erst nach erster User-Geste (Autoplay-Policy)
  window.addEventListener("pointerdown", () => {
    unlockAudio();
    musicSetEnabled(game.settings.music);
  }, { once: true });

  // route pointers
  bindCanvasPointers(game.canvases.world, handleWorldPointer, () => (game.mode === "TITLE" || game.mode === "WORLD"));
  bindCanvasPointers(game.canvases.mission, handleDivePointer, () => (game.mode === "MISSION"));

  // TITLE buttons (use pointerup for tablets that sometimes eat click)
  const btnStart = $("btnStart");
  const enter = (e) => {
    e?.preventDefault?.();
    setMode("WORLD");
    toast("NIGHT CITY ONLINE.");
  };
  btnStart?.addEventListener("click", enter, { passive: false });
  btnStart?.addEventListener("pointerup", enter, { passive: false });

  const btnReset = $("btnReset");
  btnReset?.addEventListener("click", () => {
    if (confirm("WARNING: PURGE ALL DATA?")) {
      resetSave();
      location.reload();
    }
  });

  const btnBack = $("btnBackToCity");
  btnBack?.addEventListener("click", () => setMode("WORLD"));

  resizeAll();
  window.addEventListener("resize", resizeAll);

  toast("SYSTEM READY.");
  setMode("TITLE");

  // Debug-/Test-Zugriff
  window.__NEON = { game };

  requestAnimationFrame(loop);
}

/* ---------------- LOOP ---------------- */
let lastTime = 0;
function loop(tNow) {
  const dt = Math.min(0.033, ((tNow - lastTime) / 1000) || 0);
  lastTime = tNow;

  if (!game.paused) {
    game.dayClock = (game.dayClock + dt) % DAY_CYCLE;
    game.dayRatio = game.dayClock / DAY_CYCLE;
    setMoodProgress(game.dayRatio);

    if (game.mode === "WORLD" || game.mode === "TITLE") {
      worldTick(dt);
      npcTick(dt);
      // Heat kühlt nur langsam ab — die Klinik ist der schnelle Weg
      if (game.heat > 0) game.heat = Math.max(0, game.heat - dt * 0.08);
    }

    if (game.mode === "MISSION") {
      diveTick(dt, (resultData) => {
        Object.assign(game, resultData.apply(game));
        game.missionsDone += 1;

        // Statistik + Tiefen-Rekord
        game.stats.dives += 1;
        if (!resultData.meta?.jackout) game.stats.dumps += 1;
        let recordLine = "";
        if ((resultData.meta?.layer || 0) > game.stats.bestLayer) {
          game.stats.bestLayer = resultData.meta.layer;
          if (game.stats.bestLayer >= 3) {
            recordLine = `\n\n★ NEUER TIEFEN-REKORD: LAYER ${game.stats.bestLayer}`;
            toast(`★ NEUER REKORD: LAYER ${game.stats.bestLayer}`);
          }
        }

        // Tagesauftrag: 1x per Jack Out aus Layer 3+ zurückkommen
        checkDailyReset();
        let dailyLine = "";
        if (!game.daily.done && resultData.meta?.jackout && resultData.meta.layer >= DAILY_GOAL_LAYER) {
          game.daily.done = true;
          game.frags += DAILY_REWARD;
          dailyLine = `\n\n✔ TAGESAUFTRAG ERFÜLLT: +${DAILY_REWARD} ◆`;
          toast(`TAGESAUFTRAG ERFÜLLT: +${DAILY_REWARD} ◆`);
        }

        if (game.settings.autosave) saveNow();

        setMode("RESULT");
        const res = $("resText");
        if (res) res.textContent = (resultData.text || "Dive beendet.") + recordLine + dailyLine;
      });
    }
  } else {
    // when paused: still draw mission frame for “frozen” visuals
    if (game.mode === "MISSION") diveTick(0, () => {});
  }

  uiTick(dt);
  requestAnimationFrame(loop);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
  }
