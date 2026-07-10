// js/dive.js — Push-your-luck Dive-Loop: Layer schaffen → sichern oder tiefer
import { game } from "./core.js";
import { toast, bindFastPress } from "./ui.js";
import { createMinigame, MG_TYPES, clearParticles } from "./missions.js";
import { computeMods, banter, banterLine } from "./crew.js";
import { sfx } from "./sfx.js";

const $ = (id) => document.getElementById(id);

let paused = false;
let dive = null;

export function diveSetPaused(p) { paused = !!p; }
export function diveCancelPointer() {}

function depthMult(layer) {
  return 1 + 0.5 * (layer - 1);
}

function layerDiff(tier, layer) {
  return Math.min(1, (tier - 1) * 0.22 + (layer - 1) * 0.13);
}

function setDiveHud() {
  if (!dive) return;

  const t = $("mHudType");
  if (t) t.textContent = dive.mg?.name || "—";

  const l = $("mHudLayer");
  if (l) l.textContent = `${dive.layer} (x${depthMult(dive.layer).toFixed(1)})`;

  const tr = $("mHudTrace");
  if (tr) tr.textContent = `${Math.round(dive.trace)}%`;

  const b = $("mHudBuffer");
  if (b) b.textContent = `${dive.bufferE} E$ · ${dive.bufferF} ◆`;
}

function showChoice(show) {
  const el = $("diveChoice");
  if (el) el.classList.toggle("hidden", !show);
}

function startLayer(type) {
  dive.lastType = type;
  dive.mg = createMinigame(type, {
    diff: layerDiff(dive.tier, dive.layer),
    mods: dive.mods
  });
  dive.mg.start();
  dive.phase = "play";
  showChoice(false);
}

export function startDive(firstType, tier = 1) {
  const mods = computeMods();
  clearParticles();

  dive = {
    tier,
    layer: 1,
    bufferE: 0,
    bufferF: 0,
    trace: Math.max(0, game.heat * 0.4 - mods.startTrace),
    mods,
    reviveLeft: mods.revive,
    mg: null,
    lastType: firstType,
    phase: "play",
    pending: null
  };

  startLayer(firstType);
  banter("start", true);
  toast(`DIVE START — TIER ${tier}`);
}

function onReport(res) {
  if (!dive) return;

  if (!res.success) {
    if (dive.reviveLeft > 0) {
      dive.reviveLeft -= 1;
      toast("NULL ZIEHT DICH ZURÜCK — NOCH EIN VERSUCH.");
      sfx.good();
      startLayer(dive.lastType);
      return;
    }
    return dumped("ICE HAT DICH ERWISCHT");
  }

  // Loot in den Buffer
  const mult = depthMult(dive.layer);
  const e = Math.round(res.score * 3 * mult * dive.mods.lootMult);
  const f = Math.round((res.score * 0.8 + dive.mods.fragsPerLayer) * (1 + 0.25 * (dive.layer - 1)));
  dive.bufferE += e;
  dive.bufferF += f;

  // Trace steigt
  const gain = (10 + dive.tier * 3 + res.misses * 3) * dive.mods.traceMult;
  dive.trace += gain;

  if (dive.trace >= 100) {
    dive.trace = 100;
    return dumped("TRACE COMPLETE — VERBINDUNG GEKAPPT");
  }

  // Entscheidung: Jack Out oder Deeper
  dive.phase = "choice";
  sfx.clear();
  banter("clear");

  const dcB = $("dcBuffer");
  if (dcB) dcB.textContent = `${dive.bufferE} E$ · ${dive.bufferF} ◆`;

  const dcT = $("dcTrace");
  if (dcT) {
    dcT.textContent = `${Math.round(dive.trace)}%`;
    dcT.parentElement?.classList.toggle("danger", dive.trace >= 65);
  }

  const dcN = $("dcNext");
  if (dcN) dcN.textContent = `LAYER ${dive.layer + 1} · LOOT x${depthMult(dive.layer + 1).toFixed(1)}`;

  const bant = banterLine("clear");
  const dcBanter = $("dcBanter");
  if (dcBanter) dcBanter.textContent = bant ? `${bant.name}: „${bant.line}“` : "Verbindung stabil. Deine Entscheidung.";

  showChoice(true);
}

function dumped(reason) {
  const lost = dive.bufferE;
  const salvage = Math.round(lost * dive.mods.salvage);

  dive.pending = {
    apply: (g) => ({
      money: g.money + salvage,
      heat: Math.min(100, g.heat + 12)
    }),
    text:
      `${reason}.\n\n` +
      `Buffer verloren: ${lost} E$ · ${dive.bufferF} ◆\n` +
      (salvage > 0 ? `Buffer Guard gerettet: ${salvage} E$\n` : "") +
      `Heat +12\n\n` +
      `Layer erreicht: ${dive.layer}`
  };
  dive.phase = "done";
  showChoice(false);
  sfx.dumped();
  banter("dumped", true);
  shakeScreen();
}

function jackOut() {
  if (!dive || dive.phase !== "choice") return;

  const heatAdd = Math.ceil(dive.trace / 12);
  const e = dive.bufferE, f = dive.bufferF, layer = dive.layer;

  dive.pending = {
    apply: (g) => ({
      money: g.money + e,
      frags: g.frags + f,
      heat: Math.min(100, g.heat + heatAdd)
    }),
    text:
      `JACK OUT ERFOLGREICH.\n\n` +
      `Gesichert: ${e} E$ · ${f} ◆\n` +
      `Heat +${heatAdd}\n\n` +
      `Tiefster Layer: ${layer}`
  };
  dive.phase = "done";
  showChoice(false);
  sfx.jackout();
  banter("jackout", true);
}

function goDeeper() {
  if (!dive || dive.phase !== "choice") return;

  dive.layer += 1;
  const type = MG_TYPES[Math.floor(Math.random() * MG_TYPES.length)];
  sfx.deeper();
  banter("deeper");
  startLayer(type);
}

function shakeScreen() {
  const app = $("app");
  if (!app) return;
  app.classList.remove("shake");
  void app.offsetWidth;
  app.classList.add("shake");
}

export function handleDivePointer(type, e) {
  if (!dive || paused || dive.phase !== "play") return;
  dive.mg.pointer(type, e);
}

export function diveTick(dt, onFinish) {
  if (!dive) return;

  if (dive.phase === "play") {
    dive.mg.tick(paused ? 0 : dt, paused, onReport);
  }

  setDiveHud();

  if (dive.pending) {
    const p = dive.pending;
    dive = null;
    onFinish(p);
  }
}

export function initDive() {
  bindFastPress($("btnJackOut"), jackOut);
  bindFastPress($("btnDeeper"), goDeeper);
}
