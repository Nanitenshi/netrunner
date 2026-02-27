import { game } from "./core.js";
import { toast, updateNodeList } from "./ui.js";
import { openNpcDialog } from "./npc.js";

const cam = { x: 0, y: 0, zoom: 1 };
const nodes = [];

let dragging = false;
let last = { x: 0, y: 0 };
let dist = 0;
let pointerId = null;

function $(id) { return document.getElementById(id); }

export function initWorld() {
  nodes.length = 0;
  
  const base = [
    { id: "A1", type: "npc",     name: "Neon Gate",       npc: "NYX",     tag: "Clean start. Too clean.", district: 1 },
    { id: "M1", type: "mission", name: "Relay Tap",       npc: "NYX",     tag: "Trace the signal.",       district: 1 },
    { id: "B1", type: "npc",     name: "Alley Market",    npc: "GHOST",   tag: "Dirty deals. Fast.",      district: 1 },
    { id: "M2", type: "mission", name: "Courier Run",     npc: "MARA",    tag: "Deliver under heat.",     district: 2 },
    { id: "C1", type: "npc",     name: "Ripperdoc Den",   npc: "DOC K",   tag: "Upgrade or die.",         district: 2 },
    { id: "M3", type: "mission", name: "ICE Sweep",       npc: "NYX",     tag: "Avoid scanners.",         district: 3 },
    { id: "D1", type: "boss",    name: "ARASAKA PERIMETER",npc: "ARASAKA",tag: "First wall.",             district: 4 },
  ];

  let startX = -220, startY = -120;
  base.forEach((n, i) => {
    nodes.push({
      ...n,
      x: startX + i * 140 + (Math.random() * 40 - 20),
      y: startY + Math.sin(i * 0.6) * 90 + (Math.random() * 30 - 15),
      r: (n.type === "boss") ? 28 : 20
    });
  });

  updateNodeList(nodes);
  
  // Nutze selectNode für die Initiale Auswahl, um saubere State-Updates zu garantieren
  if (!game.selectedNodeId) selectNode(nodes[0].id);

  // Keyboard Support für Desktop
  window.addEventListener("keydown", handleKeyboardPan);
}

function handleKeyboardPan(e) {
  if (game.mode !== "WORLD" && game.mode !== "TITLE") return;
  const speed = 25 / cam.zoom;
  switch (e.key) {
    case "w": case "ArrowUp":    cam.y -= speed; break;
    case "s": case "ArrowDown":  cam.y += speed; break;
    case "a": case "ArrowLeft":  cam.x -= speed; break;
    case "d": case "ArrowRight": cam.x += speed; break;
  }
}

export function worldTick(dt) {
  const ctx = game.ctx.world;
  if (!ctx) return;
  const w = window.innerWidth, h = window.innerHeight;

  ctx.clearRect(0, 0, w, h);

  // --- Grid (1 Draw Call Optimization) ---
  ctx.strokeStyle = "rgba(0,243,255,0.08)";
  ctx.lineWidth = 1;
  const step = 70 * cam.zoom;
  const offX = (-cam.x * cam.zoom) % step;
  const offY = (-cam.y * cam.zoom) % step;

  ctx.beginPath();
  for (let gx = offX; gx < w; gx += step) { ctx.moveTo(gx, 0); ctx.lineTo(gx, h); }
  for (let gy = offY; gy < h; gy += step) { ctx.moveTo(0, gy); ctx.lineTo(w, gy); }
  ctx.stroke();

  // --- Route Lines (1 Draw Call Optimization) ---
  if (nodes.length > 1) {
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const startPos = worldToScreen(nodes[0].x, nodes[0].y);
    ctx.moveTo(startPos.x, startPos.y);
    
    for (let i = 1; i < nodes.length; i++) {
      const p = worldToScreen(nodes[i].x, nodes[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  // --- Nodes Rendering ---
  nodes.forEach(n => {
    const p = worldToScreen(n.x, n.y);
    const active = game.selectedNodeId === n.id;
    const scaledRadius = n.r * cam.zoom;

    let col = "rgba(0,243,255,0.55)";
    if (n.type === "npc") col = "rgba(255,0,124,0.50)";
    if (n.type === "boss") col = "rgba(255,80,90,0.60)";
    if (active) col = "#ffffff";

    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(p.x, p.y, scaledRadius, 0, Math.PI * 2);
    ctx.fill();

    // Dynamischer Label-Offset basierend auf Zoom
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "12px monospace";
    ctx.fillText(n.name, p.x + scaledRadius + 6, p.y + 4);

    ctx.fillStyle = "rgba(180,200,215,0.75)";
    ctx.font = "10px monospace";
    ctx.fillText(n.tag, p.x + scaledRadius + 6, p.y + 18);
  });
}

export function handleWorldPointer(type, e) {
  const canvas = game.canvases.world;

  if (type === "down") {
    e.preventDefault();
    pointerId = e.pointerId;
    canvas.setPointerCapture(pointerId);
    dragging = true;
    last = { x: e.clientX, y: e.clientY };
    dist = 0;
    return;
  }

  if (type === "move") {
    if (!dragging) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    
    // Mathematisch korrekte Distanz
    dist += Math.hypot(dx, dy);

    cam.x -= dx / cam.zoom;
    cam.y -= dy / cam.zoom;

    last = { x: e.clientX, y: e.clientY };
    return;
  }

  if (type === "up") {
    if (!dragging) return;
    dragging = false;
    try { canvas.releasePointerCapture(pointerId); } catch {}

    // Tap Detection (verzeihender für Wurstfinger auf Tablets)
    if (dist < 15) {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const wpos = screenToWorld(sx, sy);

      // Hit-Test mit leicht vergrößerter Touch-Hitbox
      let hit = nodes.find(n => Math.hypot(wpos.x - n.x, wpos.y - n.y) < (n.r + 20));
      
      if (hit) selectNode(hit.id);
    }
    return;
  }

  if (type === "cancel") {
    dragging = false;
    return;
  }
}

export function getSelected() {
  return nodes.find(n => n.id === game.selectedNodeId) || null;
}

export function selectNode(id) {
  game.selectedNodeId = id;
  const n = getSelected();
  
  if (n) {
    // Distrikt-Progression nur bei Klick updaten
    game.district = Math.max(game.district, n.district);
    
    openNpcDialog(n);
    toast(`Selected: ${n.name}`);
  }
  
  updateNodeList(nodes);
}

export function getNodes() {
  return nodes;
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

export function toggleZoom() {
  cam.zoom = (cam.zoom < 1.4) ? 1.8 : 1.0;
  toast(`Zoom: ${cam.zoom.toFixed(1)}x`);
      }
    
