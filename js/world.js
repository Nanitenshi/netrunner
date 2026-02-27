// js/world.js
import { game } from "./core.js";
import { toast, updateNodeList } from "./ui.js";

const cam = { x: 0, y: 0, zoom: 1 };
const nodes = [];

let dragging = false;
let last = { x: 0, y: 0 };
let dist = 0;
let pointerId = null;
let focusZoom = false;

function localPos(e) {
  const c = game.canvases.world;
  const r = c.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
}

export function initWorld() {
  nodes.length = 0;

  const base = [
    { id: "A1", type: "npc", name: "Neon Gate", npc: "NYX", tag: "Clean start. Too clean.", district: 1 },
    { id: "M1", type: "mission", name: "Cache Pop", npc: "NYX", tag: "Pop caches. Stay sharp.", district: 1 },
    { id: "B1", type: "npc", name: "Alley Market", npc: "GHOST", tag: "Dirty deals. Quick money.", district: 1 },
    { id: "M2", type: "mission", name: "Relay Tap", npc: "GHOST", tag: "Trace the signal.", district: 1 }
  ];

  base.forEach((n, i) => {
    nodes.push({
      ...n,
      x: (i % 2 ? 180 : -180) + (i * 20),
      y: -120 + i * 120
    });
  });

  updateNodeList(nodes, game.selectedNodeId, (id) => selectNodeById(id));
}

export function worldSetFocusToggle() {
  focusZoom = !focusZoom;
  cam.zoom = focusZoom ? 1.6 : 1.0;
  toast(focusZoom ? "FOCUS ON." : "FOCUS OFF.");
}

export function worldCancelPointer() {
  dragging = false;
  pointerId = null;
}

function worldToScreen(wx, wy, W, H) {
  return {
    x: (W / 2) + (wx - cam.x) * cam.zoom,
    y: (H / 2) + (wy - cam.y) * cam.zoom
  };
}

function screenToWorld(sx, sy, W, H) {
  return {
    x: (sx - W / 2) / cam.zoom + cam.x,
    y: (sy - H / 2) / cam.zoom + cam.y
  };
}

export function worldTick() {
  const ctx = game.ctx.world;
  const c = game.canvases.world;
  if (!c || !ctx) return;

  const W = window.innerWidth;
  const H = window.innerHeight;

  ctx.clearRect(0, 0, W, H);

  // grid (perf: keep cheap)
  ctx.strokeStyle = "rgba(0,243,255,.10)";
  ctx.lineWidth = 1;

  const step = 60 * cam.zoom;
  const offX = (-cam.x * cam.zoom) % step;
  const offY = (-cam.y * cam.zoom) % step;

  for (let x = offX; x < W; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = offY; y < H; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // nodes
  nodes.forEach(n => {
    const p = worldToScreen(n.x, n.y, W, H);
    const active = (game.selectedNodeId === n.id);

    ctx.fillStyle = active ? "#ffffff" : (n.type === "mission" ? "rgba(0,243,255,.55)" : "rgba(255,0,124,.55)");
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16 * cam.zoom, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(n.name, p.x + 22, p.y + 5);
  });
}

export function handleWorldPointer(type, e) {
  e.preventDefault?.();

  if (type === "down") {
    dragging = true;
    pointerId = e.pointerId;
    const p = localPos(e);
    last = { x: p.x, y: p.y };
    dist = 0;
    return;
  }

  if (type === "move") {
    if (!dragging) return;
    const p = localPos(e);

    const dx = p.x - last.x;
    const dy = p.y - last.y;
    dist += Math.abs(dx) + Math.abs(dy);

    cam.x -= dx / cam.zoom;
    cam.y -= dy / cam.zoom;

    last = { x: p.x, y: p.y };
    return;
  }

  if (type === "up" || type === "cancel") {
    if (!dragging) return;
    dragging = false;
    pointerId = null;

    if (dist < 10) {
      const p = localPos(e);
      const w = screenToWorld(p.x, p.y, p.w, p.h);
      const hit = nodes.find(n => Math.hypot(w.x - n.x, w.y - n.y) < 28);
      if (hit) selectNodeById(hit.id);
    }
  }
}

function selectNodeById(id) {
  const n = nodes.find(x => x.id === id);
  if (!n) return;

  game.selectedNodeId = n.id;

  // simple economy feedback
  game.money += (n.type === "mission" ? 0 : 10);
  game.heat = Math.min(100, game.heat + (n.type === "mission" ? 8 : 3));

  const npcName = document.getElementById("npcName");
  const npcRole = document.getElementById("npcRole");
  const dialog = document.getElementById("dialogText");

  if (npcName) npcName.textContent = `${n.npc} // ${n.name}`;
  if (npcRole) npcRole.textContent = (n.type === "mission" ? "MISSION OFFER" : "NPC SIGNAL");
  if (dialog) dialog.textContent = n.tag;

  updateNodeList(nodes, game.selectedNodeId, (pickId) => selectNodeById(pickId));
  toast(n.type === "mission" ? "MISSION NODE LOCKED." : "NODE LOCKED.");
}
