import { game } from "./core.js";
import { toast, updateNodeList } from "./ui.js";

const cam = { x: 0, y: 0, zoom: 1 };
const nodes = [];

let dragging = false;
let last = { x: 0, y: 0 };
let dist = 0;
let pointerId = null;
let focusZoom = false;

// 30fps tick für 2D world (massiver Performance-Boost auf Tablets)
let acc = 0;

export function initWorld() {
  nodes.length = 0;

  const base = [
    { id: "A1", type: "npc", name: "Neon Gate", npc: "NYX", tag: "Clean start. Too clean.", district: 7 },
    { id: "M1", type: "mission", name: "Signal Slice", npc: "NYX", tag: "Schneide den Trace in Stücke.", district: 7 },
    { id: "B1", type: "npc", name: "Alley Market", npc: "GHOST", tag: "Dirty deals. Quick money.", district: 7 },
    { id: "M2", type: "mission", name: "Cache Pop", npc: "GHOST", tag: "Knacke die Caches bevor ICE tickt.", district: 7 },
  ];

  base.forEach((n, i) => {
    nodes.push({
      ...n,
      x: (i % 2 ? 190 : -190) + (i * 24),
      y: -140 + i * 130
    });
  });

  updateNodeList(nodes, game.selectedNodeId, (id) => selectNodeById(id));
}

export function worldSetFocusToggle() {
  focusZoom = !focusZoom;
  cam.zoom = focusZoom ? 1.55 : 1.0;
  toast(focusZoom ? "FOCUS ON." : "FOCUS OFF.");
}

function worldToScreen(wx, wy) {
  return {
    x: (window.innerWidth / 2) + (wx - cam.x) * cam.zoom,
    y: (window.innerHeight / 2) + (wy - cam.y) * cam.zoom
  };
}
function screenToWorld(sx, sy) {
  return {
    x: (sx - window.innerWidth / 2) / cam.zoom + cam.x,
    y: (sy - window.innerHeight / 2) / cam.zoom + cam.y
  };
}

export function worldTick(dt) {
  acc += dt;
  if (acc < (1/30)) return; // 30 fps cap
  acc = 0;

  const ctx = game.ctx.world;
  if (!ctx) return;

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // Grid (sparsam)
  ctx.strokeStyle = "rgba(0,243,255,.08)";
  ctx.lineWidth = 1;
  const step = 80 * cam.zoom;
  const offX = (-cam.x * cam.zoom) % step;
  const offY = (-cam.y * cam.zoom) % step;

  for (let x = offX; x < window.innerWidth; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, window.innerHeight); ctx.stroke();
  }
  for (let y = offY; y < window.innerHeight; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(window.innerWidth, y); ctx.stroke();
  }

  // Nodes
  for (const n of nodes) {
    const p = worldToScreen(n.x, n.y);
    const active = game.selectedNodeId === n.id;

    ctx.fillStyle = active ? "#ffffff" : (n.type === "mission" ? "rgba(0,243,255,.55)" : "rgba(255,0,124,.55)");
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16 * cam.zoom, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(n.name, p.x + 22, p.y + 5);
  }
}

export function handleWorldPointer(type, e) {
  e.preventDefault();

  if (type === "down") {
    dragging = true;
    pointerId = e.pointerId;
    last = { x: e.clientX, y: e.clientY };
    dist = 0;
    return;
  }

  if (type === "move") {
    if (!dragging) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    dist += Math.abs(dx) + Math.abs(dy);

    cam.x -= dx / cam.zoom;
    cam.y -= dy / cam.zoom;
    last = { x: e.clientX, y: e.clientY };
    return;
  }

  if (type === "up" || type === "cancel") {
    if (!dragging) return;
    dragging = false;

    // Tap
    if (dist < 10) {
      const w = screenToWorld(e.clientX, e.clientY);
      const hit = nodes.find(n => Math.hypot(w.x - n.x, w.y - n.y) < 32);
      if (hit) selectNodeById(hit.id);
    }
  }
}

function selectNodeById(id) {
  const n = nodes.find(x => x.id === id);
  if (!n) return;

  game.selectedNodeId = n.id;

  // kleine Belohnung für NPC, Heat für Mission
  if (n.type === "npc") game.money += 10;
  game.heat = Math.min(100, game.heat + (n.type === "mission" ? 8 : 3));

  // Right panel text
  const npcName = document.getElementById("npcName");
  const npcRole = document.getElementById("npcRole");
  const dialog = document.getElementById("dialogText");

  if (npcName) npcName.textContent = `${n.npc} // ${n.name}`;
  if (npcRole) npcRole.textContent = n.type === "mission" ? "MISSION OFFER" : "NPC SIGNAL";
  if (dialog) dialog.textContent = n.tag;

  updateNodeList(nodes, game.selectedNodeId, (pickId) => selectNodeById(pickId));
  toast(n.type === "mission" ? "MISSION NODE LOCKED." : "SIGNAL LOCKED.");
}

export function getSelectedNode() {
  return nodes.find(n => n.id === game.selectedNodeId) || null;
}
