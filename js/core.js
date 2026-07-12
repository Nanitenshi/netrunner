// js/core.js
import {
  initThree,
  setMoodProgress,
  setPaused as setThreePaused,
  setQuality as setThreeQuality
} from "./threeScene.js";

import {
  initWorld,
  worldTick,
  handleWorldPointer,
  worldCancelPointer,
  worldSetFocusToggle,
  refreshNodeList,
  currentGoal,
  routeGoal,
  nearMissionNode,
  worldIsManualPan,
  worldRecenterCamera
} from "./world.js";

import { initUI, uiTick, toast, setComms } from "./ui.js";
import { loadSave, saveNow, resetSave } from "./save.js";
import { openNpcDialog, npcTick } from "./npc.js";
import { initCrewUI, closeCrewOverlay } from "./crew.js";
import { initEncounters } from "./encounters.js";
import { unlockAudio } from "./sfx.js";
import { musicSetEnabled, musicSetIntensity } from "./music.js";

import {
  startDive,
  diveTick,
  handleDivePointer,
  diveCancelPointer,
  diveSetPaused,
  diveAbort,
  initDive
} from "./dive.js";

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
  // Cyberpsychose: steigt bei gescheiterten Dives (Dump), sinkt langsam von
  // allein und deutlicher bei einem sauberen, tiefen Jack Out. Bewusst ohne
  // HUD-Anzeige — man soll es hören, nicht ablesen.
  psychosis: 0,
  // Timestamp (performance.now()), bis zu dem der Welt-Canvas glitchen soll —
  // rein transient, wird nie gespeichert
  glitchUntil: 0,

  settings: {
    quality: "perf", // perf | quality
    autosave: true,
    music: true
  },

  // Hacker-Build: permanente, jederzeit wechselbare Spielstil-Wahl
  // (GHOST RUNNER / COMBAT RUNNER / DATA THIEF) — siehe builds.js
  build: null,
  // Programme: verbrauchbare Dive-Items, mit E$ gekauft, im Dive verbraucht
  programsOwned: { panic: 0, boost: 0, decoy: 0 },

  upgrades: { buffer: 0, amplifier: 0, pulse: 0 },
  crew: { roster: {}, equipped: [], pity: 0 },
  daily: { date: "", done: false, npcs: {}, lootTaken: {} },
  tutorialDone: false,
  stats: { bestLayer: 0, dives: 0, dumps: 0, voidAnnounced: false, voidCompleted: false, psychosisWarned: false },
  // Fortschritt der NPC-Story-Arcs: welche Dialogzeile als nächstes dran ist
  storyStage: {},
  // einmalige Boni von NPC-Besuchen, werden beim nächsten Dive verbraucht
  buffs: { traceCut: 0, lootBonus: 1, traceMultCut: 1, gearDiscount: 0 },
  selectedNodeId: null,
  selectedMissionType: null,
  selectedMissionTier: 1,
  selectedMissionHot: false,
  selectedMissionArchetype: null,
  storyLog: [],

  canvases: { three: null, world: null, mission: null },
  ctx: { world: null, mission: null }
};

const $ = (id) => document.getElementById(id);

// Prestige jenseits des Void Signal: feste Meilensteine für 15/20/25/30,
// danach alle 10 Layer eine generische Zeile (siehe Aufrufstelle)
const DEPTH_MILESTONES = {
  15: "Layer 15. Die Stadt kennt jetzt deinen Namen. Sie mag ihn nicht.",
  20: "Layer 20. ECHO sagt, so tief war noch niemand, den sie kennt.",
  25: "Layer 25. Selbst KURO hat aufgehört, das für Zufall zu halten.",
  30: "Layer 30. Du bist tiefer, als das Netz je gebaut wurde. Es merkt das."
};

/* ---------------- DAILY (Tagesauftrag) ---------------- */
export const DAILY_GOAL_LAYER = 3;
export const DAILY_REWARD = 30;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function checkDailyReset() {
  if (game.daily.date !== todayStr()) {
    game.daily = { date: todayStr(), done: false, npcs: {}, lootTaken: {} };
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

  // Erstes Mal in der Stadt: kurzes Tutorial statt kryptischem Einzeiler —
  // erklärt WAS man tut und WARUM (gemeldetes Problem: keine Orientierung)
  if (next === "WORLD" && !game.tutorialDone) {
    showTutorial(0);
  }

  // no pause carryover
  setPaused(false);
}

/* ---------------- TUTORIAL ---------------- */
const TUT_STEPS = [
  {
    title: "WILLKOMMEN IN NEON ALLEY",
    text: "Du bist Netrunner: Du hackst dich in Systeme („Dives“) und holst Eddies (E$) und Frags (◆) raus.\n\nDer gelbe AUFTRAG-Chip oben zeigt IMMER dein nächstes Ziel. Tipp drauf — dein Runner läuft automatisch hin."
  },
  {
    title: "DER DIVE — DEIN RISIKO, DEIN LOOT",
    text: "Im Dive löst du Minigames. Jede Ebene füllt deinen BUFFER (unsicherer Loot) — aber der TRACE steigt.\n\nBei TRACE 100% ist fast alles weg. Also: GO DEEPER für mehr Loot — oder JACK OUT, um alles zu sichern. Das ist das ganze Spiel: Gier gegen Vernunft."
  },
  {
    title: "CREW & STADT",
    text: "Mit Frags (◆) rekrutierst du im CREW-Menü Verbündete — sie geben Boni und reden mit dir.\n\nNPCs in der Stadt geben 1x täglich echte Boni. Gelbe Shards auf der Straße = Gratis-Loot. Und hör auf die Musik … sie sagt dir, wie es dir geht."
  },
  {
    title: "DEIN HACKER-BUILD",
    text: "Im CREW-Menü unter BUILD wählst du deinen Spielstil: GHOST RUNNER (Tarnung, wenig Trace), COMBAT RUNNER (bricht ICE mit Gewalt) oder DATA THIEF (maximaler Loot).\n\nJeder Build gibt dir eine eigene Signature-Fähigkeit im Dive. Jederzeit wechselbar — probier alle drei."
  }
];

let tutStep = 0;

function showTutorial(step) {
  tutStep = step;
  const box = $("tutorial");
  if (!box) return;

  if (step >= TUT_STEPS.length) {
    box.classList.add("hidden");
    game.tutorialDone = true;
    saveNow();
    toast("AUFTRAG oben antippen = loslegen.");
    return;
  }

  box.classList.remove("hidden");
  const t = $("tutTitle");
  const x = $("tutText");
  const b = $("btnTutNext");
  if (t) t.textContent = TUT_STEPS[step].title;
  if (x) x.textContent = TUT_STEPS[step].text;
  if (b) b.textContent = step === TUT_STEPS.length - 1 ? "LOS GEHT'S ▶" : `WEITER (${step + 1}/${TUT_STEPS.length})`;
}

/* ---------------- PAUSE ---------------- */
export function setPaused(p) {
  game.paused = !!p;
  diveSetPaused?.(game.paused);
  setThreePaused?.(game.paused);

  const btnPause = $("btnPause");
  if (btnPause) btnPause.textContent = game.paused ? "RESUME" : "PAUSE";

  // Echtes Pausenmenü statt eingefrorenem Bildschirm
  const menu = $("pauseMenu");
  if (menu) menu.classList.toggle("hidden", !game.paused);
  if (game.paused) {
    const snd = $("btnPmSound");
    if (snd) snd.textContent = `SOUND: ${game.settings.music ? "AN" : "AUS"}`;
    const q = $("btnPmQuality");
    if (q) q.textContent = `GRAFIK: ${game.settings.quality === "perf" ? "PERF (schnell)" : "SHARP (schön)"}`;
    const abort = $("btnPmAbort");
    if (abort) abort.classList.toggle("hidden", game.mode !== "MISSION");
  }

  toast(game.paused ? "PAUSED." : "RESUMED.");
}

export function togglePause() {
  setPaused(!game.paused);
}

// Als benannte Funktionen, damit Bottom-Bar UND Pausenmenü sie teilen
function toggleQuality() {
  game.settings.quality = (game.settings.quality === "perf") ? "quality" : "perf";
  saveNow();
  resizeAll();
  toast(game.settings.quality === "perf" ? "QUALITY: PERF" : "QUALITY: SHARP");
}

function toggleMusic() {
  game.settings.music = !game.settings.music;
  saveNow();
  musicSetEnabled(game.settings.music);
  toast(game.settings.music ? "MUSIK: ON" : "MUSIK: OFF");
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

  // KEIN desynchronized:true — auf Android-WebViews bleibt so ein Canvas nach
  // App-Background/Resume gern dauerhaft weiß (bekannter Chromium-Bug, deckt
  // sich mit dem gemeldeten White Screen nach Bildschirm-Aus)
  if (game.canvases.world) game.ctx.world = game.canvases.world.getContext("2d", { alpha: true });
  if (game.canvases.mission) game.ctx.mission = game.canvases.mission.getContext("2d", { alpha: true });

  // load save
  const saved = loadSave();
  if (saved) {
    const { upgrades, settings, crew, daily, stats, buffs, storyStage, ...rest } = saved;
    Object.assign(game, rest);
    if (upgrades) Object.assign(game.upgrades, upgrades);
    if (settings) Object.assign(game.settings, settings);
    if (daily) Object.assign(game.daily, daily);
    if (stats) Object.assign(game.stats, stats);
    if (buffs) Object.assign(game.buffs, buffs);
    if (storyStage) Object.assign(game.storyStage, storyStage);
    if (!game.daily.npcs) game.daily.npcs = {};
    if (!game.daily.lootTaken) game.daily.lootTaken = {};
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

  // Als benannte Funktion, damit START MISSION (Panel) und der
  // Quick-Start-Button am Node denselben Pfad nutzen
  const startMissionNow = () => {
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
    const special = game.selectedNodeId === "H1" ? "void" : null;
    startDive(type, game.selectedMissionTier || 1, game.selectedMissionHot, special, game.selectedMissionArchetype);
  };

  // init modules
  initUI({
    setMode,
    refreshNodeList,
    startMission: startMissionNow,
    quickStart: (n) => {
      game.selectedNodeId = n.id;
      game.selectedMissionType = n.missionType || null;
      game.selectedMissionTier = n.tier || 1;
      game.selectedMissionHot = !!n.hot;
      game.selectedMissionArchetype = n.archetype || null;
      startMissionNow();
    },
    nearMission: nearMissionNode,
    openNpcDialog,
    saveNow,
    resetSave,
    togglePause,
    toggleQuality,
    // Speichern läuft immer automatisch (nach jedem Dive, Kauf, NPC-Besuch,
    // Loot-Pickup, beim Wechsel in den Hintergrund). Der Button ist jetzt
    // ein echtes manuelles Speichern für Sicherheitsgefühl, kein Schalter,
    // der Autosave abschalten könnte — genau das war der Bug: MANUAL hatte
    // keine Alternative zum Speichern.
    manualSave: () => {
      saveNow();
      toast("💾 GESPEICHERT.");
    },
    toggleMusic,
    focusToggle: () => worldSetFocusToggle?.(),
    getGoal: currentGoal,
    routeGoal,
    isManualPan: () => worldIsManualPan?.(),
    recenterCamera: () => worldRecenterCamera?.()
  });

  // Tutorial-Button
  $("btnTutNext")?.addEventListener("click", () => showTutorial(tutStep + 1));

  // Pausenmenü-Buttons
  $("btnResume")?.addEventListener("click", () => setPaused(false));
  $("btnPmSound")?.addEventListener("click", () => { toggleMusic(); setPaused(true); });
  $("btnPmQuality")?.addEventListener("click", () => { toggleQuality(); setPaused(true); });
  $("btnPmAbort")?.addEventListener("click", () => {
    diveAbort?.();
    setPaused(false);
    setMode("WORLD");
    toast("DIVE ABGEBROCHEN — Buffer verworfen.");
  });

  // three background
  if (game.canvases.three) {
    initThree(game.canvases.three, { dpr: getDpr(), perf: game.settings.quality === "perf" });
  }

  // overworld nodes
  initWorld();

  initDive();
  initCrewUI();
  initEncounters();

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

  // Nach App-Resume (Bildschirm war aus / App im Hintergrund): Backing-Stores
  // neu anlegen und Audio aufwecken — zweite Verteidigungslinie gegen den
  // White Screen, zusätzlich zum entfernten desynchronized-Flag
  const onResume = () => {
    if (document.hidden) return;
    resizeAll();
    lastTime = performance.now();
    unlockAudio();
    musicSetEnabled(game.settings.music);
  };
  document.addEventListener("visibilitychange", onResume);
  window.addEventListener("pageshow", onResume);

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
      // Psychose klingt noch langsamer ab als Heat — schwerer abzuschütteln
      if (game.psychosis > 0) game.psychosis = Math.max(0, game.psychosis - dt * 0.03);
    }

    if (game.mode === "MISSION") {
      diveTick(dt, (resultData) => {
        Object.assign(game, resultData.apply(game));
        game.missionsDone += 1;

        // Statistik + Tiefen-Rekord
        game.stats.dives += 1;

        // Hauptstory Beat: Gerücht über verschwundene Runner (einmalig)
        if (game.missionsDone === 5) {
          game.storyLog.unshift(`> GHOST: „Läuft da draußen ein Gerücht rum. Manche Runner kommen nicht zurück. Nicht tot. Einfach... nicht zurück.“`);
        }

        if (!resultData.meta?.jackout) {
          game.stats.dumps += 1;
          // Cyberpsychose: ein gescheiterter Dive (Dump) nagt am Kopf
          game.psychosis = Math.min(100, game.psychosis + 18 + Math.random() * 10);

          // Hauptstory Beat: Reaktion auf den ersten je erlittenen Dump
          if (game.stats.dumps === 1) {
            game.storyLog.unshift(`> NYX: „Du hast gerade gefühlt, wie sich ein Verlust im Buffer anfühlt. Ich hab dir gesagt, halt den Mund leer. Jetzt halt auch den Kopf ruhig.“`);
          }
        } else if (resultData.meta.layer >= 5) {
          // ein sauberer, tiefer Jack Out beruhigt spürbar
          game.psychosis = Math.max(0, game.psychosis - 10);
        }

        // Hauptstory Beat: das erste Mal, dass die Psychose spürbar wird
        if (!game.stats.psychosisWarned && game.psychosis >= 50) {
          game.stats.psychosisWarned = true;
          game.storyLog.unshift(`> ??? : „...du hörst es jetzt auch, oder? Die Stadt nennt das Cyberpsychose. Die, die es hören, nennen es anders.“`);
          toast(`⚠ Du hörst Dinge, die nicht da sein sollten.`);
        }

        let recordLine = "";
        if ((resultData.meta?.layer || 0) > game.stats.bestLayer) {
          game.stats.bestLayer = resultData.meta.layer;
          if (game.stats.bestLayer >= 3) {
            recordLine = `\n\n★ NEUER TIEFEN-REKORD: LAYER ${game.stats.bestLayer}`;
            toast(`★ NEUER REKORD: LAYER ${game.stats.bestLayer}`);
          }
        }

        // Verstecktes Finale schaltet frei, sobald Layer 10 je erreicht wurde
        if (!game.stats.voidAnnounced && game.stats.bestLayer >= 10) {
          game.stats.voidAnnounced = true;
          game.storyLog.unshift(`> ECHO: „...du bist tief genug. Ich hör jetzt ein Signal, das vorher nur Rauschen war. Komm zu mir.“`);
          recordLine += `\n\n👁 NEUES SIGNAL ENTDECKT — ECHO hat etwas für dich.`;
          toast(`👁 NEUES SIGNAL — sprich mit ECHO`);
        }

        // Tiefen-Meilensteine jenseits des Void Signal: kein neuer Loot-/
        // Balance-Eingriff nötig, depthMult() belohnt Tiefe schon unbegrenzt —
        // das hier ist reine Anerkennung fürs Weitermachen, nachdem "das Ende"
        // längst erreicht ist
        const milestoneLine = DEPTH_MILESTONES[game.stats.bestLayer]
          || (game.stats.bestLayer > 30 && game.stats.bestLayer % 10 === 0
            ? "Es gibt kein Wort mehr dafür, was du gerade tust."
            : null);
        if (milestoneLine) {
          game.storyLog.unshift(`> SYSTEM: ${milestoneLine}`);
          game.frags += 20;
          recordLine += `\n\n🏆 TIEFEN-MEILENSTEIN: LAYER ${game.stats.bestLayer} · +20 ◆`;
          toast(`🏆 MEILENSTEIN: LAYER ${game.stats.bestLayer}`);
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

        // Speichern nach jedem Dive ist NICHT optional — Loot/Fortschritt
        // darf nie an einer Einstellung hängen, die man aus Versehen
        // umgelegt hat (gemeldetes Problem: Speicher-Zuverlässigkeit auf
        // Mobile). Der frühere AUTO/MANUAL-Schalter tat ohnehin nichts
        // anderes mehr, seit Gacha/Gear/NPC/Loot schon immer ungated speichern.
        saveNow();

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
