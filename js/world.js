import { game } from "./core.js";
import { toast, updateNodeList, setTicker } from "./ui.js";

const cam = { x: 0, y: 0, zoom: 1 };
const nodes = [];

let dragging = false;
let last = { x: 0, y: 0 };
let dist = 0;
let pointerId = null;
let focusZoom = false;

export function initWorld() {
  nodes.length = 0;

  const base = [
    { id:"A1", type:"npc", name:"Neon Gate", npc:"NYX", tag:"Clean start. Too clean.", district:7 },
    { id:"M1", type:"mission", missionType:"quick", name:"Relay Tap", npc:"NYX", tag:"Hack the uplink relay.", district:7 },
    { id:"B1", type:"npc", name:"Alley Market", npc:"GHOST", tag:"Dirty deals. Quick money.", district:7 },
    { id:"M2", type:"mission", missionType:"trace", name:"Backdoor Trace", npc:"GHOST", tag:"Stay on the signal. Don’t slip.", district:7 },
    { id:"C1", type:"npc", name:"Ripper Doc", npc:"DOC", tag:"Hardware check. Upgrade rumors.", district:7 },
    { id:"M3", type:"mission", missionType:"burst", name:"Burst Upload", npc:"NYX", tag:"Charge → release at the right time.", district:7 },
  ];

  base.forEach((n, i) => {
    nodes.push({
      ...n,
      x: (i % 2 ? 190 : -190) + (i * 18),
      y: -180 + i * 140
    });
  });

  game.selectedNodeId = nodes[0]?.id || null;
  updateNodeList(nodes, game.selectedNodeId, (id) => selectNodeById(id));
  if (nodes[0]) selectNodeById(nodes[0].id);
}

export function worldSetFocusToggle() {
  focusZoom = !focusZoom;
  cam.zoom = focusZoom ? 1.6 : 1.0;
  toast(focusZoom ? "FOCUS ON" : "FOCUS OFF");
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

export function worldTick() {
  const ctx = game.ctx.world;
  if (!ctx) return;

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // grid (cheap)
  ctx.strokeStyle = "rgba(0,243,255,.09)";
  ctx.lineWidth = 1;

  const step = 70 * cam.zoom;
  const offX = (-cam.x * cam.zoom) % step;
  const offY = (-cam.y * cam.zoom) % step;

  for (let x = offX; x < window.innerWidth; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, window.innerHeight); ctx.stroke();
  }
  for (let y = offY; y < window.innerHeight; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(window.innerWidth, y); ctx.stroke();
  }

  // links between nodes (adds “route” feel)
  ctx.strokeStyle = "rgba(255,0,124,.12)";
  ctx.lineWidth = 3;
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = worldToScreen(nodes[i].x, nodes[i].y);
    const b = worldToScreen(nodes[i+1].x, nodes[i+1].y);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  // nodes
  nodes.forEach(n => {
    const p = worldToScreen(n.x, n.y);
    const active = game.selectedNodeId === n.id;

    // glow ring
    ctx.beginPath();
    ctx.arc(p.x, p.y, (active ? 22 : 18) * cam.zoom, 0, Math.PI * 2);
    ctx.strokeStyle = active ? "rgba(255,255,255,.75)" : "rgba(0,243,255,.25)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // core
    ctx.fillStyle = active ? "#ffffff" : (n.type === "mission" ? "rgba(0,243,255,.62)" : "rgba(255,0,124,.62)");
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12 * cam.zoom, 0, Math.PI * 2);
    ctx.fill();

    // label
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(n.name, p.x + 22, p.y + 5);

    // mission marker
    if (n.type === "mission") {
      ctx.fillStyle = "rgba(252,238,10,.95)";
      ctx.font = "10px ui-monospace, monospace";
      ctx.fillText("MISSION", p.x + 22, p.y + 18);
    }
  });
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

    // tap detection
    if (dist < 10) {
      const w = screenToWorld(e.clientX, e.clientY);
      const hit = nodes.find(n => Math.hypot(w.x - n.x, w.y - n.y) < 30);
      if (hit) selectNodeById(hit.id);
    }
  }
}

function selectNodeById(id) {
  const n = nodes.find(x => x.id === id);
  if (!n) return;

  game.selectedNodeId = n.id;

  // small economy + heat to feel alive
  game.money += (n.type === "npc" ? 8 : 0);
  game.heat = Math.min(100, game.heat + (n.type === "mission" ? 6 : 2));

  // right panel
  const npcName = document.getElementById("npcName");
  const npcRole = document.getElementById("npcRole");
  const dialog = document.getElementById("dialogText");

  if (npcName) npcName.textContent = `${n.npc} // ${n.name}`;
  if (npcRole) npcRole.textContent = (n.type === "mission" ? "MISSION OFFER" : "NPC SIGNAL");
  if (dialog) dialog.textContent = n.tag;

  setTicker(`${n.npc}: ${n.tag}`);

  updateNodeList(nodes, game.selectedNodeId, (pickId) => selectNodeById(pickId));
  toast(n.type === "mission" ? "MISSION NODE LOCKED" : "NPC SIGNAL LOCKED");
}

export function getSelectedNode() {
  if (!game.selectedNodeId) return null;
  return nodes.find(n => n.id === game.selectedNodeId) || null;
}
