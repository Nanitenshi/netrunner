import { game } from "./core.js";
import { toast, updateNodeList } from "./ui.js";

const cam = { x: 0, y: 0, zoom: 1 };
const nodes = [];

// --- PERFORMANCE: Dirty render + cached grid pattern ---
let worldDirty = true;
let gridPattern = null;
let gridStepPx = 120; // Basisgröße Pattern (unabhängig vom Zoom)

let dragging = false;
let last = { x: 0, y: 0 };
let dist = 0;
let pointerId = null;
let focusZoom = false;

export function markWorldDirty() {
  worldDirty = true;
}

export function initWorld() {
  nodes.length = 0;

  const base = [
    { id: "A1", type: "npc", name: "Neon Gate", npc: "NYX", tag: "Clean start. Too clean.", district: 1 },
    { id: "M1", type: "mission", name: "Relay Tap", npc: "NYX", tag: "Trace the signal.", district: 1 },
    { id: "B1", type: "npc", name: "Alley Market", npc: "GHOST", tag: "Dirty deals. Quick money.", district: 1 },
    { id: "M2", type: "mission", name: "Cache Run", npc: "GHOST", tag: "Grab the data. Run.", district: 1 },
  ];

  base.forEach((n, i) => {
    nodes.push({
      ...n,
      x: (i % 2 ? 180 : -180) + (i * 20),
      y: -120 + i * 120
    });
  });

  updateNodeList(nodes, game.selectedNodeId, (id) => selectNodeById(id));
  markWorldDirty();
}

export function worldSetFocusToggle() {
  focusZoom = !focusZoom;
  cam.zoom = focusZoom ? 1.6 : 1.0;
  toast(focusZoom ? "FOCUS ON." : "FOCUS OFF.");
  markWorldDirty();
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

// --- Grid pattern cache (sehr schnell) ---
function ensureGridPattern(ctx) {
  if (gridPattern) return;

  const c = document.createElement("canvas");
  c.width = gridStepPx;
  c.height = gridStepPx;

  const g = c.getContext("2d");
  g.clearRect(0, 0, c.width, c.height);

  // dünne Linien (wie vorher)
  g.strokeStyle = "rgba(0,243,255,.10)";
  g.lineWidth = 1;

  // vertical
  g.beginPath();
  g.moveTo(0.5, 0);
  g.lineTo(0.5, c.height);
  g.stroke();

  // horizontal
  g.beginPath();
  g.moveTo(0, 0.5);
  g.lineTo(c.width, 0.5);
  g.stroke();

  gridPattern = ctx.createPattern(c, "repeat");
}

export function worldTick() {
  // Nur rendern, wenn sichtbar UND dirty
  if (game.mode !== "WORLD" && game.mode !== "TITLE") return;
  if (!worldDirty) return;

  const c = game.canvases.world;
  const ctx = game.ctx.world;
  if (!c || !ctx) return;

  ensureGridPattern(ctx);

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // --- GRID (Pattern statt 200+ Lines) ---
  ctx.save();
  ctx.fillStyle = gridPattern;

  // Verschiebung: so wirkt es wie “bewegtes” Grid
  // Wir nehmen cam.x/y und mappen auf Pattern-Offset
  const px = (-cam.x * cam.zoom) % gridStepPx;
  const py = (-cam.y * cam.zoom) % gridStepPx;
  ctx.translate(px, py);

  // Pattern füllen: etwas größer, weil wir translate nutzen
  ctx.fillRect(-gridStepPx, -gridStepPx, window.innerWidth + gridStepPx * 2, window.innerHeight + gridStepPx * 2);
  ctx.restore();

  // --- NODES ---
  nodes.forEach(n => {
    const p = worldToScreen(n.x, n.y);
    const active = game.selectedNodeId === n.id;

    ctx.fillStyle = active ? "#ffffff" : (n.type === "mission" ? "rgba(0,243,255,.55)" : "rgba(255,0,124,.55)");
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16 * cam.zoom, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(n.name, p.x + 22, p.y + 5);
  });

  // jetzt clean
  worldDirty = false;
}

export function handleWorldPointer(type, e) {
  e.preventDefault();

  if (type === "down") {
    dragging = true;
    pointerId = e.pointerId;
    try { e.target.setPointerCapture(pointerId); } catch {}
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

    markWorldDirty();
    return;
  }

  if (type === "up" || type === "cancel") {
    if (!dragging) return;
    dragging = false;
    try { e.target.releasePointerCapture(pointerId); } catch {}

    if (dist < 10) {
      const w = screenToWorld(e.clientX, e.clientY);
      const hit = nodes.find(n => Math.hypot(w.x - n.x, w.y - n.y) < 28);
      if (hit) selectNodeById(hit.id);
    }
  }
}

function selectNodeById(id) {
  const n = nodes.find(x => x.id === id);
  if (!n) return;

  game.selectedNodeId = n.id;
  game.money += (n.type === "mission" ? 0 : 10);
  game.heat = Math.min(100, game.heat + (n.type === "mission" ? 8 : 3));

  const npcName = document.getElementById("npcName");
  const npcRole = document.getElementById("npcRole");
  const dialog = document.getElementById("dialogText");

  if (npcName) npcName.textContent = `${n.npc} // ${n.name}`;
  if (npcRole) npcRole.textContent = n.type === "mission" ? "MISSION OFFER" : "NPC SIGNAL";
  if (dialog) dialog.textContent = n.tag;

  updateNodeList(nodes, game.selectedNodeId, (pickId) => selectNodeById(pickId));
  toast("NODE LOCKED.");

  markWorldDirty();
}
