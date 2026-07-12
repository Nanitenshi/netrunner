import { game, DAILY_GOAL_LAYER, DAILY_REWARD } from "./core.js";
import { saveNow } from "./save.js";
import { BUILDS } from "./builds.js";

const $ = (id) => document.getElementById(id);

const RANKS = ["ROOKIE", "STREET RUNNER", "NETRUNNER", "GHOSTWALKER", "ICE BREAKER", "LEGEND"];

let api = null;
let toastTimer = null;

/**
 * Prevent double-trigger on Android:
 * - Use Pointer Events as primary.
 * - Block synthetic click after touch with a short guard.
 */
let blockClickUntil = 0;
function guardClick(e) {
  // If a pointer/touch just happened, ignore click
  if (performance.now() < blockClickUntil) {
    e.preventDefault();
    e.stopPropagation();
    return true;
  }
  return false;
}

export function bindFastPress(el, fn) {
  if (!el) return;

  // Pointer Events (best for Android + desktop)
  el.addEventListener(
    "pointerup",
    (e) => {
      // Only primary pointer (avoid multi-touch weirdness)
      if (e.isPrimary === false) return;
      e.preventDefault();
      e.stopPropagation();

      // block the follow-up synthetic click
      blockClickUntil = performance.now() + 450;

      fn(e);
    },
    { passive: false }
  );

  // Click fallback (keyboard/mouse/old browsers)
  el.addEventListener(
    "click",
    (e) => {
      if (guardClick(e)) return;
      e.preventDefault();
      e.stopPropagation();
      fn(e);
    },
    { passive: false }
  );
}

export function initUI(_api) {
  api = _api;

  // LEFT PANEL
  bindFastPress($("btnTalk"), () => api.openNpcDialog?.(game.selectedNodeId));
  bindFastPress($("btnMission"), () => api.startMission?.());
  bindFastPress($("btnFocus"), () => api.focusToggle?.());

  // BOTTOM BAR
  bindFastPress($("btnPause"), () => api.togglePause?.());
  bindFastPress($("btnQuality"), () => api.toggleQuality?.());
  bindFastPress($("btnSave"), () => api.manualSave?.());
  bindFastPress($("btnMusic"), () => api.toggleMusic?.());

  // Result screen
  bindFastPress($("btnBackToCity"), () => api.setMode?.("WORLD"));

  // AUFTRAG-Chip: Tap routet direkt zum Ziel-Node
  bindFastPress($("hudGoal"), () => api.routeGoal?.());

  // Quick-Start: steht man auf einem Mission-Node, startet ein Tap den Dive
  bindFastPress($("btnDiveNow"), () => {
    const n = api.nearMission?.();
    if (n) api.quickStart?.(n);
  });

  // Zentrieren: Kamera kehrt zum Charakter zurück, ohne dass man dafür
  // (ungewollt) irgendwo hinlaufen muss
  bindFastPress($("btnRecenter"), () => api.recenterCamera?.());

  // Mobile-Drawer: NODES-Liste ein-/ausblenden, Signal-Panel schließen —
  // beim Öffnen die Liste neu aufbauen, falls sich Requires-Gates (z.B. ein
  // frisch freigeschalteter Node) seit dem letzten Aufbau geändert haben
  bindFastPress($("btnNodes"), () => {
    const panel = $("leftPanel");
    const opening = !panel?.classList.contains("open");
    panel?.classList.toggle("open");
    if (opening) api.refreshNodeList?.();
  });
  bindFastPress($("btnCloseSignal"), () => $("rightPanel")?.classList.remove("open"));

  // Immer speichern, wenn die App in den Hintergrund geht oder die Seite
  // verlassen wird — auf Mobile kann das OS den Tab jederzeit ohne
  // Vorwarnung beenden. visibilitychange UND pagehide, da mobile Browser
  // das eine manchmal auslassen, das andere aber zuverlässiger feuert.
  window.addEventListener("visibilitychange", () => {
    if (document.hidden) saveNow();
  });
  window.addEventListener("pagehide", () => saveNow());

  renderStoryLog();
}

export function renderStoryLog() {
  const wrap = $("storyArchive");
  if (!wrap) return;

  wrap.innerHTML = "";
  for (const line of game.storyLog.slice(0, 30)) {
    const row = document.createElement("div");
    row.className = "archRow";
    row.textContent = line;
    wrap.appendChild(row);
  }
}

export function openSignalPanel() {
  // Nie beide Drawer gleichzeitig offen (mobile: würden sich überlappen)
  $("leftPanel")?.classList.remove("open");
  $("rightPanel")?.classList.add("open");
}

export function closeNodesPanel() {
  $("leftPanel")?.classList.remove("open");
}

export function setComms(text) {
  const el = $("commsTicker");
  if (!el) return;
  el.innerHTML = "<b>COMMS:</b> ";
  el.appendChild(document.createTextNode(text));
}

export function toast(msg) {
  const el = $("toast");
  if (!el) return;

  el.textContent = msg;
  el.classList.remove("hidden");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 1600);
}

export function updateNodeList(nodes, selectedId, onPick) {
  const wrap = $("nodeList");
  if (!wrap) return;

  wrap.innerHTML = "";

  for (const n of nodes) {
    const card = document.createElement("div");
    card.className = "nodeCard" + (n.id === selectedId ? " active" : "");

    const left = document.createElement("div");

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = n.name;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = n.tag;

    left.appendChild(name);
    left.appendChild(meta);

    const badge = document.createElement("div");
    badge.className = "badge " + (n.hot ? "hot" : (n.type === "mission" ? "mission" : "npc"));
    badge.textContent = n.hot ? "🔥 HOT" : (n.type === "mission" ? `TIER ${n.tier || 1}` : "NPC");

    card.appendChild(left);
    card.appendChild(badge);

    // Use the same safe press binding
    bindFastPress(card, () => onPick(n.id));

    wrap.appendChild(card);
  }
}

export function uiTick(dt = 0) {
  const d = $("hudDistrict");
  if (d) d.textContent = `Sector-${String(game.district).padStart(2, "0")}`;

  const m = $("hudMoney");
  if (m) m.textContent = `${game.money} E$`;

  const h = $("hudHeat");
  if (h) h.textContent = `${Math.round(game.heat)}%`;

  const f = $("hudFrags");
  if (f) f.textContent = `${game.frags}`;

  const rk = $("hudRank");
  if (rk) {
    rk.textContent = game.stats?.voidCompleted
      ? "VOID WALKER"
      : RANKS[Math.min(RANKS.length - 1, Math.floor(game.missionsDone / 3))];
  }

  const hb = $("hudBuild");
  if (hb) {
    const b = BUILDS[game.build];
    hb.textContent = b ? ` · ${b.name}` : "";
  }

  const goalText = $("hudGoalText");
  if (goalText) {
    const goal = api?.getGoal?.();
    if (goal && goal.text !== goalText.textContent) goalText.textContent = goal.text;
  }

  // Quick-Start-Button: nur sichtbar, wenn man in der Stadt auf einem
  // Mission-Node steht UND kein anderes Overlay offen ist (der Button hat
  // ein eigenes z-index und würde sonst über CREW/PAUSE/Tutorial gemalt —
  // gleiche Ursache wie der AUFTRAG-Chip-Overlap-Bug). Position dynamisch
  // unter die HUD-Leiste setzen, sonst überlappt er mit dem Signal-Panel
  // weiter unten (das Panel malt sich optisch darüber, obwohl
  // pointer-events:none Taps durchlässt — der Button wäre da, aber unsichtbar)
  const diveBtn = $("btnDiveNow");
  if (diveBtn) {
    const overlayOpen = !$("crewOverlay")?.classList.contains("hidden")
      || !$("pauseMenu")?.classList.contains("hidden")
      || !$("tutorial")?.classList.contains("hidden");
    const n = (game.mode === "WORLD" && !overlayOpen) ? api?.nearMission?.() : null;
    diveBtn.classList.toggle("hidden", !n);
    if (n) {
      const label = `▶ DIVE: ${n.name.toUpperCase()} · TIER ${(n.tier || 1) + (n.hot ? 1 : 0)}${n.hot ? " 🔥" : ""}`;
      if (diveBtn.textContent !== label) diveBtn.textContent = label;

      const hud = $("hudTop");
      const hudBottom = hud ? hud.getBoundingClientRect().bottom : 100;
      diveBtn.style.top = `${Math.round(hudBottom + 14)}px`;
    }
  }

  // Zentrieren-Button: nur sichtbar, wenn die Kamera manuell weggezogen
  // wurde (Wisch-Pan/Pinch) — vorher gab es dafür keinen dedizierten Weg
  // zurück, nur einen Tap-zum-Hinlaufen, der ungewollt losläuft
  const recenterBtn = $("btnRecenter");
  if (recenterBtn) {
    const overlayOpen = !$("crewOverlay")?.classList.contains("hidden")
      || !$("pauseMenu")?.classList.contains("hidden")
      || !$("tutorial")?.classList.contains("hidden");
    const show = game.mode === "WORLD" && !overlayOpen && !!api?.isManualPan?.();
    recenterBtn.classList.toggle("hidden", !show);
  }

  const t = $("hudTime");
  if (t) t.textContent = game.dayRatio < 0.35 ? "DAY" : (game.dayRatio < 0.7 ? "DUSK" : "NIGHT");

  // Quality label
  const q = $("btnQuality");
  if (q) q.textContent = (game.settings?.quality === "perf") ? "PERF" : "SHARP";

  // Speichern läuft immer automatisch im Hintergrund; der Button ist ein
  // reines "Jetzt speichern"-Kommando, kein Zustands-Schalter mehr —
  // deshalb hier keine dynamische Label-Zuordnung mehr nötig.

  const p = $("btnPause");
  if (p) p.textContent = game.paused ? "RESUME" : "PAUSE";

  const daily = $("dailyInfo");
  if (daily) {
    daily.textContent = game.daily?.done
      ? "✔ TAGESAUFTRAG erledigt — morgen gibt's einen neuen."
      : `TAGESAUFTRAG: Jack Out aus Layer ${DAILY_GOAL_LAYER}+ → +${DAILY_REWARD} ◆`;
  }

  const snd = $("btnMusic");
  if (snd) snd.textContent = game.settings?.music ? "SND" : "MUTE";

  const stats = $("titleStats");
  if (stats) {
    const owned = Object.keys(game.crew?.roster || {}).length;
    const walker = game.stats?.voidCompleted ? " · VOID WALKER" : "";
    stats.textContent = game.stats?.dives > 0
      ? `REKORD: LAYER ${game.stats.bestLayer} · DIVES: ${game.stats.dives} · CREW: ${owned}/15${walker}`
      : "Noch keine Dives. Zeit, das zu ändern.";
  }
}
