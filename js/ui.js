import { game } from "./core.js";
import { saveNow } from "./save.js";

const $ = (id) => document.getElementById(id);

let api = null;
let toastTimer = null;

export function initUI(_api) {
  api = _api;

  // LEFT PANEL
  const btnTalk = $("btnTalk");
  if (btnTalk) btnTalk.onclick = () => api.openNpcDialog(game.selectedNodeId);

  const btnMission = $("btnMission");
  if (btnMission) btnMission.onclick = () => api.startMission();

  const btnFocus = $("btnFocus");
  if (btnFocus) btnFocus.onclick = () => api.focusToggle?.();

  // BOTTOM BAR
  const btnPause = $("btnPause");
  if (btnPause) {
    btnPause.addEventListener("click", (e) => { e.preventDefault(); api.togglePause(); }, { passive: false });
    btnPause.addEventListener("touchstart", (e) => { e.preventDefault(); api.togglePause(); }, { passive: false });
  }

  const btnQuality = $("btnQuality");
  if (btnQuality) {
    btnQuality.addEventListener("click", (e) => { e.preventDefault(); api.toggleQuality(); }, { passive: false });
    btnQuality.addEventListener("touchstart", (e) => { e.preventDefault(); api.toggleQuality(); }, { passive: false });
  }

  const btnSave = $("btnSave");
  if (btnSave) {
    btnSave.addEventListener("click", (e) => { e.preventDefault(); api.toggleAutosave(); }, { passive: false });
    btnSave.addEventListener("touchstart", (e) => { e.preventDefault(); api.toggleAutosave(); }, { passive: false });
  }

  // Autosave on background (nur wenn AUTO an)
  window.addEventListener("visibilitychange", () => {
    if (document.hidden && game.settings.autosave) saveNow();
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

  nodes.forEach(n => {
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
    badge.textContent = n.type.toUpperCase();

    card.appendChild(left);
    card.appendChild(badge);

    card.addEventListener("click", () => onPick(n.id));
    card.addEventListener("touchstart", (e) => { e.preventDefault(); onPick(n.id); }, { passive: false });

    wrap.appendChild(card);
  });
}

export function uiTick(dt = 0) {
  const d = $("hudDistrict"); if (d) d.textContent = `Sector-${String(game.district).padStart(2,"0")}`;
  const m = $("hudMoney"); if (m) m.textContent = `E$ ${game.money}`;
  const h = $("hudHeat"); if (h) h.textContent = `${game.heat}%`;
  const f = $("hudFrags"); if (f) f.textContent = `${game.frags}`;

  const t = $("hudTime");
  if (t) t.textContent = game.globalProgress < 0.35 ? "DAY" : (game.globalProgress < 0.7 ? "DUSK" : "NIGHT");

  // quality label
  const q = $("btnQuality");
  if (q) q.textContent = (game.settings.quality === "perf") ? "PERF" : "SHARP";

  const a = $("btnSave");
  if (a) a.textContent = game.settings.autosave ? "AUTO" : "MANUAL";

  const p = $("btnPause");
  if (p) p.textContent = game.paused ? "RESUME" : "PAUSE";
}
