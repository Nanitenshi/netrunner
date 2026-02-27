import { game } from "./core.js";
import { saveNow } from "./save.js";
import { getSelectedNode } from "./world.js";

const $ = (id) => document.getElementById(id);
let api = null;
let toastTimer = null;

export function initUI(_api) {
  api = _api;

  $("btnTalk")?.addEventListener("click", () => api.openNpcDialog(game.selectedNodeId));

  // FIX: Mission Button -> nutzt api.startMission (macht setMode("MISSION") in core.js)
  $("btnMission")?.addEventListener("click", () => {
    const n = getSelectedNode();
    if (!n) return toast("NO NODE SELECTED.");
    if (n.type !== "mission") return toast("SELECT A MISSION NODE.");

    api.startMission("cache", n.id);
  });

  $("btnFocus")?.addEventListener("click", () => api.focusToggle());

  $("btnQuality")?.addEventListener("click", () => {
    const btn = $("btnQuality");
    const next = (game.perfMode === "perf") ? "quality" : "perf";
    btn.dataset.mode = next;
    btn.textContent = next.toUpperCase();
    api.setPerf(next);
  });

  $("btnPause")?.addEventListener("click", () => {
    toast("Autosave.");
    saveNow();
  });

  $("btnSave")?.addEventListener("click", () => {
    toast("Saved.");
    saveNow();
  });

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
  toastTimer = setTimeout(() => el.classList.add("hidden"), 1200);
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
    wrap.appendChild(card);
  });
}

export function uiTick() {
  $("hudDistrict") && ($("hudDistrict").textContent = `Sector-${String(game.district).padStart(2,"0")}`);
  $("hudMoney") && ($("hudMoney").textContent = `E$ ${game.money}`);
  $("hudHeat") && ($("hudHeat").textContent = `${game.heat}%`);
  $("hudFrags") && ($("hudFrags").textContent = `${game.frags}`);

  const t = $("hudTime");
  if (t) t.textContent = game.globalProgress < 0.35 ? "DAY" : (game.globalProgress < 0.7 ? "DUSK" : "NIGHT");

  // story archive
  const arch = $("storyArchive");
  if (arch) {
    arch.innerHTML = game.storyLog.slice(0, 10).map(s => `<div class="archRow">${escapeHtml(s)}</div>`).join("");
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
