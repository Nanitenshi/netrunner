import { game } from "./core.js";
import { saveNow } from "./save.js";

const $ = (id) => document.getElementById(id);

let api = null;
let toastTimer = null;
let storyLines = [];

export function initUI(_api) {
  api = _api;

  const btnTalk = $("btnTalk");
  const btnMission = $("btnMission");
  const btnFocus = $("btnFocus");
  const btnReset = $("btnReset");
  const btnBack = $("btnBackToWorld");
  const qualityBtn = $("qualityBtn");
  const pauseBtn = $("btnPause");

  if (btnTalk) btnTalk.onclick = () => api.onTalk();
  if (btnMission) btnMission.onclick = () => api.onStartMission();
  if (btnFocus) btnFocus.onclick = () => api.onFocus();
  if (btnReset) btnReset.onclick = () => api.onReset();
  if (btnBack) btnBack.onclick = () => api.onBackToWorld();
  if (pauseBtn) pauseBtn.onclick = () => api.onPause();

  if (qualityBtn) {
    qualityBtn.onclick = () => {
      const next = (qualityBtn.dataset.mode === "auto")
        ? "perf"
        : (qualityBtn.dataset.mode === "perf" ? "quality" : "auto");
      qualityBtn.dataset.mode = next;
      qualityBtn.textContent = next.toUpperCase();
      api.onQuality(next);
      toast(`QUALITY: ${next.toUpperCase()}`);
    };
  }

  window.addEventListener("visibilitychange", () => {
    if (document.hidden) saveNow();
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

export function setTicker(text) {
  const el = $("ticker");
  if (el) el.textContent = text;
}

export function pushStoryLog(line) {
  storyLines.unshift(`[${new Date().toLocaleTimeString().slice(0,5)}] ${line}`);
  if (storyLines.length > 24) storyLines.length = 24;

  const wrap = $("storyArchive");
  if (!wrap) return;
  wrap.innerHTML = storyLines.map(s => `<div class="archRow">${escapeHtml(s)}</div>`).join("");
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

    card.onclick = () => onPick(n.id);
    wrap.appendChild(card);
  });
}

export function uiTick() {
  const d = $("hudDistrict"); if (d) d.textContent = `Sector-${String(game.district).padStart(2,"0")}`;
  const m = $("hudMoney"); if (m) m.textContent = `E$ ${game.money}`;
  const h = $("hudHeat"); if (h) h.textContent = `${game.heat}%`;
  const f = $("hudFrags"); if (f) f.textContent = `${game.frags}`;
  const fps = $("hudFps"); if (fps) fps.textContent = `${game.fps}`;

  const t = $("hudTime");
  if (t) t.textContent = game.globalProgress < 0.35 ? "DAY" : (game.globalProgress < 0.7 ? "DUSK" : "NIGHT");
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
