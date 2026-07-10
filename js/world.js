// js/world.js
import { game } from "./core.js";
import { toast, updateNodeList } from "./ui.js";
import { openNpcDialog } from "./npc.js";

const $ = (id) => document.getElementById(id);

const PLAYER_SPEED = 260;   // world units / sec
const INTERACT_R = 110;     // world units

const cam = { x: 0, y: 0, zoom: 0.62 };
let focusZoom = false;

const player = { x: 0, y: -40, tx: 0, ty: -40, moving: false, facing: 0 };
let pendingInteractId = null;
let downPos = null;

const keys = new Set();
window.addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

const DISTRICTS = [
  { id: "neon",       name: "Neon-Viertel",     cx: 0,     cy: 0,     r: 520, color: "rgba(0,243,255,0.16)" },
  { id: "downtown",   name: "Innenstadt",       cx: 950,   cy: -150,  r: 600, color: "rgba(120,140,255,0.15)" },
  { id: "corporate",  name: "Konzernbezirk",    cx: 1750,  cy: -700,  r: 480, color: "rgba(190,225,255,0.16)" },
  { id: "industrial", name: "Industriegebiet",  cx: 750,   cy: 950,   r: 560, color: "rgba(255,140,40,0.14)" },
  { id: "slums",      name: "Slums",            cx: -850,  cy: 750,   r: 600, color: "rgba(120,200,90,0.12)" },
  { id: "undercity",  name: "Undercity",        cx: -250,  cy: 1550,  r: 430, color: "rgba(170,0,220,0.16)" }
];

const NODE_DEFS = [
  { id: "A1", type: "npc",     name: "Neon Gate",         npc: "NYX",       tag: "Clean start. Too clean.",                  x: -120, y: -80 },
  { id: "M1", type: "mission", name: "Cache Pop Terminal",npc: "NYX",       tag: "Pop caches. Stay sharp.",                  x: 160,  y: 120,  missionType: "cache",  tier: 1 },
  { id: "B1", type: "npc",     name: "Alley Market",      npc: "GHOST",     tag: "Dirty deals. Quick money. Gear gibt's im CREW-Menü.", x: 200, y: -160 },
  { id: "M2", type: "mission", name: "Relay Tap",         npc: "GHOST",     tag: "Finde die Paare, bevor der Trace greift.", x: -180, y: 180,  missionType: "wires",  tier: 1 },

  { id: "C1", type: "npc",     name: "Datastream Café",   npc: "RUNNER-9",  tag: "Kaffee und Gerüchte. Beides bitter.",      x: 950,  y: -260 },
  { id: "M3", type: "mission", name: "Corp Firewall",     npc: "RUNNER-9",  tag: "Reihenfolge knacken, bevor sie zurückverfolgen.", x: 1080, y: -40, missionType: "breach", tier: 2 },

  { id: "D1", type: "npc",     name: "Arasaka Lobby",     npc: "ICE-VOICE", tag: "Lächeln am Tag. Nachts fressen sie.",      x: 1650, y: -780 },
  { id: "M4", type: "mission", name: "Executive Breach",  npc: "ICE-VOICE", tag: "Höchste Sicherheitsstufe. Höchster Preis.",x: 1850, y: -560, missionType: "breach", tier: 3 },

  { id: "E1", type: "npc",     name: "Scrapyard Boss",    npc: "RUST",      tag: "Schrott ist nur Metall, das noch nicht verkauft wurde.", x: 650, y: 1020 },
  { id: "M5", type: "mission", name: "Line Sabotage",     npc: "RUST",      tag: "Kabel kreuzen sich. Finde die Paare.",     x: 850,  y: 860,  missionType: "wires",  tier: 2 },

  { id: "F1", type: "npc",     name: "Clinic Runner",     npc: "DOC-K",     tag: "Ich flick dich. Frag nicht wie. (Senkt Heat gegen Eddies)", x: -900, y: 820 },
  { id: "M6", type: "mission", name: "Black Cache",       npc: "DOC-K",     tag: "Schnelle Beute, schneller Ausstieg.",      x: -760, y: 650,  missionType: "cache",  tier: 2 },

  { id: "G1", type: "npc",     name: "Ghost Signal",      npc: "ECHO",      tag: "Wenn du glaubst du steuerst das, hat dich die Stadt schon.", x: -280, y: 1600 },
  { id: "M7", type: "mission", name: "Deep Breach",       npc: "ECHO",      tag: "Niemand hier war je wirklich hier.",       x: -180, y: 1450, missionType: "breach", tier: 3 }
];

const nodes = [];
const citizens = [];

const CITIZEN_COLORS = {
  neon: "rgba(0,243,255,.55)", downtown: "rgba(150,170,255,.55)",
  corporate: "rgba(210,235,255,.55)", industrial: "rgba(255,160,70,.55)",
  slums: "rgba(150,220,110,.55)", undercity: "rgba(200,90,255,.55)"
};

// Hot Zone: rotiert täglich über die Mission-Nodes (+1 Tier, +50% Loot)
function todaySeed() {
  const d = new Date();
  return d.getFullYear() * 372 + (d.getMonth() + 1) * 31 + d.getDate();
}

export function initWorld() {
  nodes.length = 0;
  NODE_DEFS.forEach((n) => nodes.push({ ...n, visited: false, hot: false }));

  const missionNodes = nodes.filter((n) => n.type === "mission");
  if (missionNodes.length) {
    missionNodes[todaySeed() % missionNodes.length].hot = true;
  }

  citizens.length = 0;
  for (const d of DISTRICTS) {
    for (let i = 0; i < 3; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rr = Math.random() * d.r * 0.5;
      const home = { x: d.cx + Math.cos(ang) * rr, y: d.cy + Math.sin(ang) * rr };
      citizens.push({
        x: home.x, y: home.y, tx: home.x, ty: home.y,
        home, leash: d.r * 0.4,
        speed: 40 + Math.random() * 30,
        t: Math.random() * 3,
        color: CITIZEN_COLORS[d.id] || "rgba(255,255,255,.4)"
      });
    }
  }

  cam.x = player.x; cam.y = player.y;
  updateNodeList(nodes, game.selectedNodeId, goToNode);
}

export function getNodeById(id) {
  return nodes.find((n) => n.id === id);
}

export function worldSetFocusToggle() {
  focusZoom = !focusZoom;
  cam.zoom = focusZoom ? 1.05 : 0.62;
  toast(focusZoom ? "FOCUS ON." : "FOCUS OFF.");
}

export function worldCancelPointer() {
  downPos = null;
}

function localPos(e) {
  const c = game.canvases.world;
  const r = c.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
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

function interact(n) {
  game.selectedNodeId = n.id;
  game.selectedMissionType = n.missionType || null;
  game.selectedMissionTier = n.tier || 1;
  game.selectedMissionHot = !!n.hot;
  pendingInteractId = null;

  const npcName = $("npcName");
  const npcRole = $("npcRole");
  const dialog = $("dialogText");

  if (npcName) npcName.textContent = `${n.npc} // ${n.name}`;
  if (npcRole) npcRole.textContent = (n.type === "mission"
    ? `NETZZUGANG · TIER ${n.tier || 1}${n.hot ? " · 🔥 HOT ZONE" : ""}`
    : "NPC SIGNAL");
  if (dialog) dialog.textContent = n.hot ? `${n.tag}\n\n🔥 HOT ZONE HEUTE: +1 Tier, +50% Loot.` : n.tag;

  if (n.type === "npc") {
    openNpcDialog(n.id);

    // Clinic: Heat gegen Eddies löschen
    if (n.id === "F1" && game.heat >= 5) {
      const cost = Math.ceil(game.heat * 2);
      if (game.money >= cost) {
        game.money -= cost;
        game.heat = 0;
        toast(`DOC-K: SYSTEM CLEAN. -${cost} E$`);
      } else {
        toast(`DOC-K will ${cost} E$ für den Clean.`);
      }
    } else if (!n.visited) {
      n.visited = true;
      game.money += 5;
      toast(`+5 E$ // ${n.npc} TIP.`);
    }
  } else {
    toast(`TIER ${n.tier || 1} NETZ. START MISSION = DIVE.`);
  }

  updateNodeList(nodes, game.selectedNodeId, goToNode);
}

function goToNode(id) {
  const n = nodes.find((x) => x.id === id);
  if (!n) return;

  const d = Math.hypot(player.x - n.x, player.y - n.y);
  if (d <= INTERACT_R) {
    interact(n);
    return;
  }

  player.tx = n.x;
  player.ty = n.y;
  player.moving = true;
  pendingInteractId = n.id;
  toast(`ROUTING TO ${n.name.toUpperCase()}…`);
}

function stepPlayer(dt) {
  let kx = 0, ky = 0;
  if (keys.has("arrowup") || keys.has("w")) ky -= 1;
  if (keys.has("arrowdown") || keys.has("s")) ky += 1;
  if (keys.has("arrowleft") || keys.has("a")) kx -= 1;
  if (keys.has("arrowright") || keys.has("d")) kx += 1;

  if (kx || ky) {
    const len = Math.hypot(kx, ky) || 1;
    player.x += (kx / len) * PLAYER_SPEED * dt;
    player.y += (ky / len) * PLAYER_SPEED * dt;
    player.facing = Math.atan2(ky, kx);
    player.moving = true;
    pendingInteractId = null;
  } else if (player.moving) {
    const dx = player.tx - player.x;
    const dy = player.ty - player.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 6) {
      player.moving = false;
    } else {
      player.facing = Math.atan2(dy, dx);
      const step = Math.min(dist, PLAYER_SPEED * dt);
      player.x += (dx / dist) * step;
      player.y += (dy / dist) * step;
    }
  }

  if (pendingInteractId) {
    const n = nodes.find((x) => x.id === pendingInteractId);
    if (!n) {
      pendingInteractId = null;
    } else if (Math.hypot(player.x - n.x, player.y - n.y) <= INTERACT_R) {
      interact(n);
    }
  }
}

function stepCitizens(dt) {
  for (const c of citizens) {
    c.t -= dt;
    if (c.t <= 0) {
      const ang = Math.random() * Math.PI * 2;
      const rr = Math.random() * c.leash;
      c.tx = c.home.x + Math.cos(ang) * rr;
      c.ty = c.home.y + Math.sin(ang) * rr;
      c.t = 3 + Math.random() * 4;
    }

    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 2) {
      c.x += (dx / dist) * c.speed * dt;
      c.y += (dy / dist) * c.speed * dt;
    }
  }
}

function stepCamera(dt) {
  const f = 1 - Math.pow(0.0001, dt);
  cam.x += (player.x - cam.x) * f;
  cam.y += (player.y - cam.y) * f;
}

function draw() {
  const ctx = game.ctx.world;
  const c = game.canvases.world;
  if (!c || !ctx) return;

  const W = window.innerWidth;
  const H = window.innerHeight;

  ctx.clearRect(0, 0, W, H);

  // district glow zones
  for (const d of DISTRICTS) {
    const p = worldToScreen(d.cx, d.cy, W, H);
    const rr = d.r * cam.zoom;
    if (p.x < -rr || p.x > W + rr || p.y < -rr || p.y > H + rr) continue;

    const grd = ctx.createRadialGradient(p.x, p.y, rr * 0.15, p.x, p.y, rr);
    grd.addColorStop(0, d.color);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  // roads (hub = neon district)
  const hub = DISTRICTS[0];
  const hp = worldToScreen(hub.cx, hub.cy, W, H);
  ctx.strokeStyle = "rgba(0,243,255,.14)";
  ctx.lineWidth = 3 * cam.zoom;
  for (let i = 1; i < DISTRICTS.length; i++) {
    const bp = worldToScreen(DISTRICTS[i].cx, DISTRICTS[i].cy, W, H);
    ctx.beginPath();
    ctx.moveTo(hp.x, hp.y);
    ctx.lineTo(bp.x, bp.y);
    ctx.stroke();
  }

  // grid
  ctx.strokeStyle = "rgba(0,243,255,.08)";
  ctx.lineWidth = 1;
  const step = 60 * cam.zoom;
  const offX = (W / 2 - cam.x * cam.zoom) % step;
  const offY = (H / 2 - cam.y * cam.zoom) % step;
  for (let x = offX; x < W; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = offY; y < H; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // citizens
  for (const cz of citizens) {
    const p = worldToScreen(cz.x, cz.y, W, H);
    if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) continue;
    ctx.fillStyle = cz.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5 * cam.zoom, 0, Math.PI * 2);
    ctx.fill();
  }

  // nodes
  const tNow = performance.now() / 1000;
  nodes.forEach((n) => {
    const p = worldToScreen(n.x, n.y, W, H);
    const active = (game.selectedNodeId === n.id);
    const inRange = Math.hypot(player.x - n.x, player.y - n.y) <= INTERACT_R;

    // Hot Zone: pulsierender orangener Ring
    if (n.hot) {
      const pulse = 1 + Math.sin(tNow * 4) * 0.18;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,150,40,.85)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 30 * cam.zoom * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = active ? "#ffffff" : (n.type === "mission" ? "rgba(0,243,255,.6)" : "rgba(255,0,124,.6)");
    ctx.beginPath();
    ctx.arc(p.x, p.y, (inRange ? 20 : 16) * cam.zoom, 0, Math.PI * 2);
    ctx.fill();

    if (inRange) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 25 * cam.zoom, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(n.name, p.x + 22, p.y + 5);
  });

  // player
  const pp = worldToScreen(player.x, player.y, W, H);
  ctx.save();
  ctx.translate(pp.x, pp.y);
  ctx.rotate(player.facing || 0);
  ctx.fillStyle = "#fcee0a";
  ctx.beginPath();
  ctx.moveTo(12 * cam.zoom, 0);
  ctx.lineTo(-8 * cam.zoom, -8 * cam.zoom);
  ctx.lineTo(-8 * cam.zoom, 8 * cam.zoom);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function worldTick(dt = 0) {
  if (game.mode === "WORLD") stepPlayer(dt);
  stepCitizens(dt);
  stepCamera(dt);
  draw();
}

export function handleWorldPointer(type, e) {
  if (game.mode !== "WORLD") return;

  if (type === "down") {
    downPos = localPos(e);
    return;
  }

  if (type === "up") {
    if (!downPos) return;
    const p = localPos(e);
    const dist = Math.hypot(p.x - downPos.x, p.y - downPos.y);
    downPos = null;
    if (dist > 14) return;

    let hit = null;
    let bestD = 30;
    for (const n of nodes) {
      const sp = worldToScreen(n.x, n.y, p.w, p.h);
      const d = Math.hypot(p.x - sp.x, p.y - sp.y);
      if (d < bestD) { bestD = d; hit = n; }
    }

    if (hit) {
      goToNode(hit.id);
    } else {
      const w = screenToWorld(p.x, p.y, p.w, p.h);
      pendingInteractId = null;
      player.tx = w.x;
      player.ty = w.y;
      player.moving = true;
    }
    return;
  }

  if (type === "cancel") downPos = null;
}
