import { game } from "./core.js?v=5192bf4c";

const KEY = "neonAlley_save_v1";
const BACKUP_KEY = "neonAlley_save_backup_v1";
const TEMP_KEY = "neonAlley_save_temp_v1";
const SAVE_VERSION = 2;

function emit(detail) {
  try {
    window.dispatchEvent(new CustomEvent("neon-save-status", { detail }));
  } catch {}
}

function parse(raw) {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const hasExpectedState = ["money", "frags", "crew", "stats", "settings"].some((key) => key in data);
    return hasExpectedState ? data : null;
  } catch {
    return null;
  }
}

function finite(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitize(data) {
  const safe = { ...data };

  safe.money = Math.round(finite(safe.money, 0, 0, 1e12));
  safe.frags = Math.round(finite(safe.frags, 0, 0, 1e9));
  safe.heat = finite(safe.heat, 0, 0, 100);
  safe.psychosis = finite(safe.psychosis, 0, 0, 100);
  safe.district = Math.round(finite(safe.district, 7, 0, 999));
  safe.dayClock = finite(safe.dayClock, 0, 0, 1e9);
  safe.missionsDone = Math.round(finite(safe.missionsDone, 0, 0, 1e7));

  if (!safe.settings || typeof safe.settings !== "object" || Array.isArray(safe.settings)) safe.settings = {};
  if (!safe.stats || typeof safe.stats !== "object" || Array.isArray(safe.stats)) safe.stats = {};
  if (!safe.daily || typeof safe.daily !== "object" || Array.isArray(safe.daily)) safe.daily = {};
  if (!safe.upgrades || typeof safe.upgrades !== "object" || Array.isArray(safe.upgrades)) safe.upgrades = {};
  if (!safe.buffs || typeof safe.buffs !== "object" || Array.isArray(safe.buffs)) safe.buffs = {};
  if (!safe.storyStage || typeof safe.storyStage !== "object" || Array.isArray(safe.storyStage)) safe.storyStage = {};
  if (!safe.skillLevels || typeof safe.skillLevels !== "object" || Array.isArray(safe.skillLevels)) safe.skillLevels = {};
  if (!safe.programsOwned || typeof safe.programsOwned !== "object" || Array.isArray(safe.programsOwned)) safe.programsOwned = {};

  if (!safe.crew || typeof safe.crew !== "object" || Array.isArray(safe.crew)) safe.crew = {};
  if (!safe.crew.roster || typeof safe.crew.roster !== "object" || Array.isArray(safe.crew.roster)) safe.crew.roster = {};
  if (!Array.isArray(safe.crew.equipped)) safe.crew.equipped = [];
  safe.crew.equipped = [...new Set(safe.crew.equipped.filter((id) => typeof id === "string"))].slice(0, 2);
  safe.crew.pity = Math.round(finite(safe.crew.pity, 0, 0, 10));

  if (!Array.isArray(safe.storyLog)) safe.storyLog = [];
  safe.storyLog = safe.storyLog.filter((line) => typeof line === "string").slice(0, 60);

  safe.tutorialStep = Math.round(finite(safe.tutorialStep, 0, 0, 99));
  safe.tutorialDone = !!safe.tutorialDone;

  return safe;
}

function snapshot() {
  return {
    _saveVersion: SAVE_VERSION,
    _savedAt: Date.now(),
    mode: "WORLD",
    money: game.money,
    heat: game.heat,
    frags: game.frags,
    psychosis: game.psychosis,
    build: game.build,
    skillLevels: game.skillLevels,
    programsOwned: game.programsOwned,
    district: game.district,
    dayClock: game.dayClock,
    missionsDone: game.missionsDone,
    upgrades: game.upgrades,
    crew: game.crew,
    daily: game.daily,
    stats: game.stats,
    buffs: game.buffs,
    storyStage: game.storyStage,
    tutorialDone: game.tutorialDone,
    tutorialStep: game.tutorialStep,
    settings: game.settings,
    storyLog: game.storyLog
  };
}

export function saveNow() {
  try {
    const json = JSON.stringify(snapshot());

    // First write a complete temporary copy. If the tab is killed during the
    // following writes, loadSave() can still recover this newest snapshot.
    localStorage.setItem(TEMP_KEY, json);

    const current = localStorage.getItem(KEY);
    if (parse(current)) {
      try { localStorage.setItem(BACKUP_KEY, current); } catch {}
    }

    localStorage.setItem(KEY, json);
    localStorage.removeItem(TEMP_KEY);
    emit({ ok: true, type: "save", at: Date.now() });
    return true;
  } catch (error) {
    console.warn("NEON ALLEY save failed", error);
    emit({ ok: false, type: "save", error: String(error?.message || error) });
    return false;
  }
}

export function loadSave() {
  const candidates = [
    { key: KEY, source: "primary" },
    { key: TEMP_KEY, source: "temporary" },
    { key: BACKUP_KEY, source: "backup" }
  ];

  for (const candidate of candidates) {
    let raw = null;
    try { raw = localStorage.getItem(candidate.key); } catch {}
    const parsed = parse(raw);
    if (!parsed) continue;

    const safe = sanitize(parsed);
    const recovered = candidate.source !== "primary";

    if (recovered) {
      try {
        localStorage.setItem(KEY, JSON.stringify(safe));
        localStorage.removeItem(TEMP_KEY);
      } catch {}
    }

    emit({ ok: true, type: "load", source: candidate.source, recovered });
    return safe;
  }

  emit({ ok: true, type: "load", source: "new", recovered: false });
  return null;
}

export function resetSave() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(BACKUP_KEY);
    localStorage.removeItem(TEMP_KEY);
    emit({ ok: true, type: "reset" });
  } catch (error) {
    console.warn("NEON ALLEY reset failed", error);
    emit({ ok: false, type: "reset", error: String(error?.message || error) });
  }
}
