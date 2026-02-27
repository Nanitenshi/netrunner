import { game } from "./core.js";
import { saveNow } from "./save.js";

const $ = (id) => document.getElementById(id);

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

function bindFastPress(el, fn) {
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
  bindFastPress($("btnSave"), () => api.toggleAutosave?.());

  // Result screen
  bindFastPress($("btnBackToCity"), () => api.setMode?.("WORLD"));

  // Autosave on background (nur wenn AUTO an)
  window.addEventListener("visibilitychange", () => {
    if (document.hidden && game.settings?.autosave) saveNow();
  });
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
    badge.className = "badge " + (n.type === "mission" ? "mission" : "npc");
    badge.textContent = (n.type || "node").toUpperCase();

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
  if (m) m.textContent = `E$ ${game.money}`;

  const h = $("hudHeat");
  if (h) h.textContent = `${game.heat}%`;

  const f = $("hudFrags");
  if (f) f.textContent = `${game.frags}`;

  const t = $("hudTime");
  if (t) t.textContent = game.globalProgress < 0.35 ? "DAY" : (game.globalProgress < 0.7 ? "DUSK" : "NIGHT");

  // Quality label
  const q = $("btnQuality");
  if (q) q.textContent = (game.settings?.quality === "perf") ? "PERF" : "SHARP";

  const a = $("btnSave");
  if (a) a.textContent = game.settings?.autosave ? "AUTO" : "MANUAL";

  const p = $("btnPause");
  if (p) p.textContent = game.paused ? "RESUME" : "PAUSE";
}
