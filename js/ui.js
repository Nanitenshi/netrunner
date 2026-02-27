import { game } from "./core.js";
import { saveNow } from "./save.js";

const $ = (id) => document.getElementById(id);

let api = null;
let toastTimer = null;

export function initUI(_api) {
  api = _api;

  const btnTalk = $("btnTalk");
  if (btnTalk) btnTalk.onclick = () => api.openNpcDialog(game.selectedNodeId);

  // Autosave wenn Tab gewechselt wird
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
  toastTimer = setTimeout(() => el.classList.add("hidden"), 1800);
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

  const t = $("hudTime");
  if (t) t.textContent = game.globalProgress < 0.35 ? "DAY" : (game.globalProgress < 0.7 ? "DUSK" : "NIGHT");
}
