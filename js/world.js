// js/world.js
import { game } from "./core.js";
import { toast, updateNodeList, openSignalPanel, closeNodesPanel } from "./ui.js";
import { openNpcDialog } from "./npc.js";
import { PALETTES, makeCitizenPalette, getSprites, drawCharacterAt, facingToDir } from "./sprites.js";
import { sfx } from "./sfx.js";
import { saveNow } from "./save.js";
import { encounterTick } from "./encounters.js";
import { getArchetype } from "./archetypes.js";

const $ = (id) => document.getElementById(id);

const PLAYER_SPEED = 260;   // world units / sec
const INTERACT_R = 110;     // world units

const cam = { x: 0, y: 0, zoom: 0.62 };
let focusZoom = false;
const ZOOM_MIN = 0.32;
const ZOOM_MAX = 1.7;

const player = { x: 0, y: -40, tx: 0, ty: -40, moving: false, facing: Math.PI / 2, animT: 0, frame: 0 };

const NPC_PALETTE = {
  NYX: PALETTES.nyx, GHOST: PALETTES.ghost, "RUNNER-9": PALETTES.runner9,
  "ICE-VOICE": PALETTES.iceVoice, RUST: PALETTES.rust, "DOC-K": PALETTES.docK, ECHO: PALETTES.echo
};
let pendingInteractId = null;
let downPos = null;
let dragLast = null;
let dragging = false;
let manualPan = false;

// Zwei-Finger-Pinch: aktive Touches nach pointerId, Basis-Distanz/-Zoom bei
// Pinch-Start. Vorher gab es keinerlei Zoom-Steuerung außer dem festen
// FOCUS-Toggle (gemeldetes Problem: "es gibt kein Zoom")
const activeTouches = new Map();
let pinchStartDist = null;
let pinchStartZoom = null;

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
  { id: "M1", type: "mission", name: "Cache Pop Terminal",npc: "NYX",       tag: "Pop caches. Stay sharp.",                  x: 160,  y: 120,  missionType: "cache",  tier: 1, archetype: "heist" },
  { id: "B1", type: "npc",     name: "Alley Market",      npc: "GHOST",     tag: "Dirty deals. Quick money. Gear gibt's im CREW-Menü.", x: 200, y: -160 },
  { id: "M2", type: "mission", name: "Relay Tap",         npc: "GHOST",     tag: "Finde die Paare, bevor der Trace greift.", x: -180, y: 180,  missionType: "wires",  tier: 1, archetype: "intel" },

  { id: "C1", type: "npc",     name: "Datastream Café",   npc: "RUNNER-9",  tag: "Kaffee und Gerüchte. Beides bitter.",      x: 950,  y: -260 },
  { id: "M3", type: "mission", name: "Corp Firewall",     npc: "RUNNER-9",  tag: "Reihenfolge knacken, bevor sie zurückverfolgen.", x: 1080, y: -40, missionType: "breach", tier: 2, archetype: "infiltration" },

  { id: "D1", type: "npc",     name: "Arasaka Lobby",     npc: "ICE-VOICE", tag: "Lächeln am Tag. Nachts fressen sie.",      x: 1650, y: -780 },
  { id: "M4", type: "mission", name: "Executive Breach",  npc: "ICE-VOICE", tag: "Höchste Sicherheitsstufe. Höchster Preis.",x: 1850, y: -560, missionType: "breach", tier: 3, archetype: "sabotage" },

  { id: "E1", type: "npc",     name: "Scrapyard Boss",    npc: "RUST",      tag: "Schrott ist nur Metall, das noch nicht verkauft wurde.", x: 650, y: 1020 },
  { id: "M5", type: "mission", name: "Line Sabotage",     npc: "RUST",      tag: "Kabel kreuzen sich. Finde die Paare.",     x: 850,  y: 860,  missionType: "wires",  tier: 2, archetype: "sabotage" },

  { id: "F1", type: "npc",     name: "Clinic Runner",     npc: "DOC-K",     tag: "Ich flick dich. Frag nicht wie. (Senkt Heat gegen Eddies)", x: -900, y: 820 },
  { id: "M6", type: "mission", name: "Black Cache",       npc: "DOC-K",     tag: "Schnelle Beute, schneller Ausstieg.",      x: -760, y: 650,  missionType: "cache",  tier: 2, archetype: "heist" },

  { id: "G1", type: "npc",     name: "Ghost Signal",      npc: "ECHO",      tag: "Wenn du glaubst du steuerst das, hat dich die Stadt schon.", x: -280, y: 1600 },
  { id: "M7", type: "mission", name: "Deep Breach",       npc: "ECHO",      tag: "Niemand hier war je wirklich hier.",       x: -180, y: 1450, missionType: "breach", tier: 3, archetype: "escort" },

  // Verstecktes Finale: taucht erst auf, wenn du Layer 10 erreicht hast —
  // ECHO hört ab dieser Tiefe ein Signal, das vorher nur Rauschen war
  { id: "H1", type: "mission", name: "Void Signal", npc: "ECHO", tag: "Das war nie ein Echo. Das war eine Antwort.", x: -420, y: 1780, missionType: "trace", tier: 3, requires: (g) => g.stats.bestLayer >= 10 }
];

const nodes = [];

// Nodes mit unerfüllter `requires`-Bedingung sind unsichtbar und nicht antippbar
function visibleNodes() {
  return nodes.filter((n) => !n.requires || n.requires(game));
}

const citizens = [];
const buildings = [];
const cars = [];
const lamps = [];
const drones = [];
const props = [];
const steamVents = [];
const puffs = [];
const secondaryRoads = [];
const groundGrain = [];

// deterministischer Pseudozufall pro Gebäude (für stabile Fenster-Muster)
function hashRnd(seed, i) {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Gebäude-Stil pro Bezirk: Höhenprofil + Neon-Farbe der Dachkanten
// Bezirks-Persönlichkeit: nicht nur Höhe/Farbe, sondern eigene Grundriss-
// Proportionen, Dachform und Dachaufbauten — vorher war jedes Gebäude in
// jedem Bezirk dieselbe Box, nur umgefärbt (gemeldetes Problem: "nichts
// unterscheidet sich voneinander"). wMin/wMax/hMin/hMax steuern die
// Grundriss-Proportion (z.B. Industrie: breit+flach = Lagerhalle,
// Corporate: schmal+tief = Monolith), roof/rooftop geben jedem Viertel eine
// eigene Silhouette.
const BUILD_STYLE = {
  neon:       { h: 1.0,  neon: "0,243,255",   count: 16, wMin: 40, wMax: 76,  hMin: 40, hMax: 76,  roof: "flat",    rooftop: null,          winChance: 0.85, signChance: 0.5,  billboardChance: 0.3 },
  downtown:   { h: 1.3,  neon: "150,170,255", count: 16, wMin: 46, wMax: 78,  hMin: 46, hMax: 78,  roof: "flat",    rooftop: "watertower",  winChance: 0.88, signChance: 0.28, billboardChance: 0.25 },
  corporate:  { h: 1.9,  neon: "210,235,255", count: 11, wMin: 58, wMax: 88,  hMin: 58, hMax: 88,  roof: "tiered",  rooftop: null,          winChance: 0.9,  signChance: 0.08, billboardChance: 0.42 },
  industrial: { h: 0.55, neon: "255,150,60",  count: 15, wMin: 72, wMax: 120, hMin: 40, hMax: 58,  roof: "sawtooth",rooftop: "smokestack",  winChance: 0.45, signChance: 0.12, billboardChance: 0.04 },
  slums:      { h: 0.45, neon: "140,220,110", count: 20, wMin: 30, wMax: 54,  hMin: 30, hMax: 54,  roof: "lean",    rooftop: null,          winChance: 0.55, signChance: 0.22, billboardChance: 0.03 },
  undercity:  { h: 0.75, neon: "190,90,255",  count: 13, wMin: 44, wMax: 70,  hMin: 44, hMax: 70,  roof: "flat",    rooftop: "pipes",       winChance: 0.32, signChance: 0.1,  billboardChance: 0.08 }
};

// Graffiti-Wahrscheinlichkeit pro Bezirk — das ist es, was Slums/Industrie
// nach gelebter Stadt statt Beton-Kulisse aussehen lässt
const GRAFFITI_CHANCE = { neon: 0.1, downtown: 0.06, corporate: 0, industrial: 0.32, slums: 0.4, undercity: 0.22 };

// Requisiten pro Bezirk: welcher Typ wie oft vorkommt — gibt jedem Viertel
// einen eigenen Charakter statt austauschbarer Klötze
const PROP_WEIGHTS = {
  neon:       { bench: 2, planter: 3, stall: 3, vending: 2, puddle: 2, dumpster: 1 },
  downtown:   { bench: 3, planter: 2, stall: 1, vending: 3, puddle: 1, dumpster: 1 },
  corporate:  { bench: 2, planter: 4, vending: 1 },
  industrial: { crate: 4, dumpster: 3, vent: 3, puddle: 2 },
  slums:      { crate: 2, dumpster: 3, stall: 1, puddle: 3, vent: 1, bench: 1 },
  undercity:  { crate: 1, dumpster: 1, vending: 1, puddle: 3, vent: 2 }
};

function weightedPick(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
  return entries[0][0];
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

// Nächstgelegener Bezirk zu einem Node — für die Straßen-Hervorhebung
// (welche Route führt gerade zum Auftragsziel)
function nodeDistrict(n) {
  let best = DISTRICTS[0], bestD = Infinity;
  for (const d of DISTRICTS) {
    const dd = Math.hypot(n.x - d.cx, n.y - d.cy);
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}

// Zweite Straßen-Ebene zwischen benachbarten Bezirken (nicht über den Hub) —
// bricht die reine Stern-Topologie auf, damit sich die Stadt wie ein
// zusammenhängendes Netz anfühlt statt wie Speichen um einen Mittelpunkt
const SECONDARY_ROADS = [
  ["downtown", "corporate"],
  ["industrial", "slums"],
  ["slums", "undercity"]
];

// N-1 Zwischenpunkte, seitlich ausgelenkt (deterministisch, per Seed) —
// macht aus einer Lineal-Geraden eine leicht geschwungene Straße
function bendWaypoints(ax, ay, bx, by, seed, segs = 3) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;

  const pts = [{ x: ax, y: ay }];
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const wob = (hashRnd(seed, i * 17 + 3) - 0.5) * len * 0.16;
    pts.push({ x: ax + dx * t + nx * wob, y: ay + dy * t + ny * wob });
  }
  pts.push({ x: bx, y: by });
  return pts;
}

// Organische Bezirksgrenze statt Zirkelkreis: N Punkte mit zufälligem
// Radius-Jitter, per hashRnd stabil (kein Geflacker zwischen Frames)
function initDistrictBlobs() {
  for (const d of DISTRICTS) {
    const seed = d.cx * 3 + d.cy * 7 + 11;
    const n = 11;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const jitter = 0.7 + hashRnd(seed, i * 13 + 5) * 0.36;
      pts.push({ x: d.cx + Math.cos(ang) * d.r * jitter, y: d.cy + Math.sin(ang) * d.r * jitter });
    }
    d.blobPts = pts;
  }
}

function initRoadPaths() {
  const hub = DISTRICTS[0];
  for (let i = 1; i < DISTRICTS.length; i++) {
    const d = DISTRICTS[i];
    d.roadPts = bendWaypoints(hub.cx, hub.cy, d.cx, d.cy, d.cx * 5 + d.cy * 13 + 41);
  }

  secondaryRoads.length = 0;
  for (const [aId, bId] of SECONDARY_ROADS) {
    const a = DISTRICTS.find((x) => x.id === aId);
    const b = DISTRICTS.find((x) => x.id === bId);
    if (!a || !b) continue;
    secondaryRoads.push({ pts: bendWaypoints(a.cx, a.cy, b.cx, b.cy, a.cx * 7 + b.cy * 19 + 71, 2) });
  }
}

// Feine Boden-Körnung statt eines Koordinatengitters — ein Gitter über der
// ganzen Stadt sah nach Diagrammpapier aus, nicht nach Asphalt (gemeldetes
// Problem: "Mathe-Optik"). Einmal berechnet, dann nur noch neu projiziert.
function initGroundGrain() {
  groundGrain.length = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const d of DISTRICTS) {
    minX = Math.min(minX, d.cx - d.r); maxX = Math.max(maxX, d.cx + d.r);
    minY = Math.min(minY, d.cy - d.r); maxY = Math.max(maxY, d.cy + d.r);
  }
  const count = Math.min(700, Math.round(((maxX - minX) * (maxY - minY)) / 11000));
  for (let i = 0; i < count; i++) {
    groundGrain.push({
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
      r: 1 + Math.random() * 1.8,
      a: 0.03 + Math.random() * 0.05,
      warm: Math.random() < 0.25
    });
  }
}

function initBuildings() {
  buildings.length = 0;
  const hub = DISTRICTS[0];

  for (const d of DISTRICTS) {
    const style = BUILD_STYLE[d.id];

    for (let i = 0; i < style.count; i++) {
      let placed = false;
      for (let tries = 0; tries < 24 && !placed; tries++) {
        const ang = Math.random() * Math.PI * 2;
        const rr = d.r * (0.2 + Math.random() * 0.68);
        const x = d.cx + Math.cos(ang) * rr;
        const y = d.cy + Math.sin(ang) * rr;
        const w = style.wMin + Math.random() * (style.wMax - style.wMin);
        const h = style.hMin + Math.random() * (style.hMax - style.hMin);

        // nicht auf Nodes, Straßen oder anderen Gebäuden
        if (NODE_DEFS.some((n) => Math.hypot(n.x - x, n.y - y) < 130)) continue;
        if (DISTRICTS.slice(1).some((dd) => distToSegment(x, y, hub.cx, hub.cy, dd.cx, dd.cy) < 85)) continue;
        if (buildings.some((b) => Math.abs(b.x - x) < (b.w + w) / 2 + 18 && Math.abs(b.y - y) < (b.h + h) / 2 + 18)) continue;

        const height = (0.4 + Math.random() * 0.9) * style.h;
        buildings.push({
          x, y, w, h,
          height,
          neon: style.neon,
          windows: Math.random() < style.winChance,
          seed: Math.random() * 1000,
          hasAntenna: Math.random() < 0.4,
          hasSign: Math.random() < style.signChance,
          hasBillboard: height > 0.9 && Math.random() < style.billboardChance,
          hasGraffiti: Math.random() < (GRAFFITI_CHANCE[d.id] || 0),
          roof: style.roof,
          rooftop: style.rooftop && Math.random() < 0.55 ? style.rooftop : null,
          district: d.id,
          landmark: false
        });
        placed = true;
      }
    }
  }

  // pro Bezirk das höchste Gebäude als Wahrzeichen markieren — größer,
  // heller, mit Lichtstrahl, damit die Skyline einen Blickfang hat
  for (const d of DISTRICTS) {
    let best = null;
    for (const b of buildings) {
      if (b.district === d.id && (!best || b.height > best.height)) best = b;
    }
    if (best) {
      best.landmark = true;
      best.height *= 1.6;
      best.hasBillboard = true;
      best.hasAntenna = true;
    }
  }
}

/* ---- Ambient-Partikel: treibende Neon-Motes über der Stadt ---- */
const ambient = [];
function initAmbient() {
  ambient.length = 0;
  for (let i = 0; i < 26; i++) {
    ambient.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vy: -8 - Math.random() * 14,
      vx: (Math.random() - 0.5) * 6,
      r: 1 + Math.random() * 2,
      life: Math.random(),
      speed: 0.05 + Math.random() * 0.08,
      color: Math.random() < 0.5 ? "0,243,255" : "255,0,124"
    });
  }
}

function stepAmbient(dt) {
  const W = window.innerWidth, H = window.innerHeight;
  for (const p of ambient) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life += p.speed * dt;
    if (p.life >= 1 || p.y < -10) {
      p.life = 0;
      p.x = Math.random() * W;
      p.y = H + 10;
    }
  }
}

function drawAmbient(ctx) {
  for (const p of ambient) {
    const fade = Math.sin(p.life * Math.PI);
    ctx.fillStyle = `rgba(${p.color},${(0.35 * fade).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function initCars() {
  cars.length = 0;
  for (let i = 1; i < DISTRICTS.length; i++) {
    for (let k = 0; k < 3; k++) {
      cars.push({
        seg: i,
        t: Math.random(),
        speed: 0.03 + Math.random() * 0.05,
        dir: Math.random() < 0.5 ? 1 : -1,
        color: Math.random() < 0.5 ? "255,60,140" : "0,220,255"
      });
    }
  }
}

function initLamps() {
  lamps.length = 0;
  const hub = DISTRICTS[0];
  for (let i = 1; i < DISTRICTS.length; i++) {
    const d = DISTRICTS[i];
    if (!d.roadPts) continue;
    const len = Math.hypot(d.cx - hub.cx, d.cy - hub.cy);
    const steps = Math.floor(len / 170);

    // Laternen folgen jetzt der gebogenen Straße statt der alten
    // Lineal-Geraden — sonst würden sie sichtbar neben der Fahrbahn
    // schweben (Folgefehler aus dem Straßen-Rework)
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const wp = pointOnPath(d.roadPts, t);
      const wlen = Math.hypot(wp.dx, wp.dy) || 1;
      const nx = -wp.dy / wlen, ny = wp.dx / wlen;
      const side = s % 2 === 0 ? 1 : -1;
      lamps.push({
        x: wp.x + nx * 26 * side,
        y: wp.y + ny * 26 * side
      });
    }
  }
}

function initDrones() {
  drones.length = 0;
  for (let i = 0; i < 6; i++) {
    const ang = Math.random() * Math.PI * 2;
    drones.push({
      x: (Math.random() - 0.5) * 3400,
      y: (Math.random() - 0.5) * 3400 + 400,
      vx: Math.cos(ang) * (22 + Math.random() * 25),
      vy: Math.sin(ang) * (22 + Math.random() * 25),
      blink: Math.random() * 10,
      color: Math.random() < 0.5 ? "255,60,60" : "80,255,120"
    });
  }
}

// Requisiten: Bänke, Marktstände, Pflanzen, Mülltonnen, Kisten, Automaten,
// Dampfschlote, Pfützen — geben jedem Bezirk gelebte Details statt leerer Fläche
function initProps() {
  props.length = 0;
  steamVents.length = 0;
  const hub = DISTRICTS[0];

  for (const d of DISTRICTS) {
    const weights = PROP_WEIGHTS[d.id];
    if (!weights) continue;

    for (let i = 0; i < 15; i++) {
      let placed = false;
      for (let tries = 0; tries < 20 && !placed; tries++) {
        const ang = Math.random() * Math.PI * 2;
        const rr = d.r * (0.15 + Math.random() * 0.75);
        const x = d.cx + Math.cos(ang) * rr;
        const y = d.cy + Math.sin(ang) * rr;

        if (NODE_DEFS.some((n) => Math.hypot(n.x - x, n.y - y) < 100)) continue;
        if (DISTRICTS.slice(1).some((dd) => distToSegment(x, y, hub.cx, hub.cy, dd.cx, dd.cy) < 50)) continue;
        if (buildings.some((b) => Math.abs(b.x - x) < b.w / 2 + 26 && Math.abs(b.y - y) < b.h / 2 + 26)) continue;
        if (props.some((pr) => Math.hypot(pr.x - x, pr.y - y) < 60)) continue;

        const type = weightedPick(weights);
        const prop = { type, x, y, seed: Math.random() * 1000 };
        props.push(prop);
        if (type === "vent") steamVents.push(prop);
        placed = true;
      }
    }
  }
}

/* ---- Requisiten-Zeichenfunktionen: eine pro Prop-Typ ---- */
function drawBench(ctx, p, s) {
  ctx.fillStyle = "rgba(20,26,38,.9)";
  ctx.fillRect(p.x - 14 * s, p.y - 6 * s, 28 * s, 5 * s);
  ctx.fillRect(p.x - 12 * s, p.y - 1 * s, 3 * s, 8 * s);
  ctx.fillRect(p.x + 9 * s, p.y - 1 * s, 3 * s, 8 * s);
  ctx.strokeStyle = "rgba(0,243,255,.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(p.x - 14 * s, p.y - 6 * s, 28 * s, 5 * s);
}

function drawDumpster(ctx, p, s, seed) {
  ctx.fillStyle = "rgba(38,44,30,.95)";
  ctx.fillRect(p.x - 13 * s, p.y - 14 * s, 26 * s, 14 * s);
  ctx.fillStyle = "rgba(55,64,42,.95)";
  ctx.fillRect(p.x - 13 * s, p.y - 16 * s, 26 * s, 4 * s);
  if (hashRnd(seed, 3) < 0.5) {
    ctx.fillStyle = `hsla(${Math.floor(hashRnd(seed, 7) * 360)},80%,55%,.55)`;
    ctx.beginPath();
    ctx.moveTo(p.x - 10 * s, p.y - 10 * s);
    ctx.quadraticCurveTo(p.x - 4 * s, p.y - 14 * s, p.x + 2 * s, p.y - 8 * s);
    ctx.quadraticCurveTo(p.x + 6 * s, p.y - 4 * s, p.x - 2 * s, p.y - 3 * s);
    ctx.closePath();
    ctx.fill();
  }
}

function drawPlanter(ctx, p, s, seed) {
  ctx.fillStyle = "rgba(40,32,26,.95)";
  ctx.fillRect(p.x - 10 * s, p.y - 8 * s, 20 * s, 8 * s);
  const hue = 140 + hashRnd(seed, 1) * 40;
  for (let i = 0; i < 4; i++) {
    const a = hashRnd(seed, i * 11) * Math.PI * 2;
    const len = (10 + hashRnd(seed, i * 17) * 8) * s;
    ctx.strokeStyle = `hsla(${hue},85%,60%,.8)`;
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 8 * s);
    ctx.quadraticCurveTo(p.x + Math.cos(a) * len * 0.5, p.y - 8 * s - len * 0.6, p.x + Math.cos(a) * len, p.y - 8 * s - len);
    ctx.stroke();
  }
  ctx.fillStyle = `hsla(${hue},90%,65%,.9)`;
  ctx.beginPath(); ctx.arc(p.x, p.y - 8 * s, 2.4 * s, 0, Math.PI * 2); ctx.fill();
}

function drawStall(ctx, p, s, seed) {
  const accent = hashRnd(seed, 2) < 0.5 ? "255,60,140" : "0,220,255";
  ctx.fillStyle = "rgba(20,26,38,.95)";
  ctx.fillRect(p.x - 16 * s, p.y - 4 * s, 32 * s, 6 * s);
  ctx.fillRect(p.x - 15 * s, p.y - 18 * s, 2 * s, 14 * s);
  ctx.fillRect(p.x + 13 * s, p.y - 18 * s, 2 * s, 14 * s);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p.x - 17 * s, p.y - 18 * s);
  ctx.lineTo(p.x + 17 * s, p.y - 18 * s);
  ctx.lineTo(p.x + 12 * s, p.y - 8 * s);
  ctx.lineTo(p.x - 12 * s, p.y - 8 * s);
  ctx.closePath();
  ctx.clip();
  for (let i = -2; i < 6; i++) {
    ctx.fillStyle = i % 2 === 0 ? `rgba(${accent},.85)` : "rgba(230,230,230,.85)";
    ctx.fillRect(p.x - 20 * s + i * 7 * s, p.y - 20 * s, 7 * s, 14 * s);
  }
  ctx.restore();
}

function drawCrate(ctx, p, s, seed) {
  ctx.fillStyle = "rgba(70,54,34,.95)";
  ctx.fillRect(p.x - 10 * s, p.y - 10 * s, 20 * s, 10 * s);
  ctx.strokeStyle = "rgba(30,20,10,.6)";
  ctx.lineWidth = 1;
  ctx.strokeRect(p.x - 10 * s, p.y - 10 * s, 20 * s, 10 * s);
  if (hashRnd(seed, 4) > 0.4) {
    ctx.fillStyle = "rgba(90,70,45,.95)";
    ctx.fillRect(p.x - 6 * s, p.y - 18 * s, 13 * s, 9 * s);
    ctx.strokeRect(p.x - 6 * s, p.y - 18 * s, 13 * s, 9 * s);
  }
}

function drawVending(ctx, p, s, seed) {
  ctx.fillStyle = "rgba(24,30,44,.96)";
  ctx.fillRect(p.x - 9 * s, p.y - 30 * s, 18 * s, 30 * s);
  const hue = hashRnd(seed, 9) < 0.5 ? 190 : 320;
  ctx.fillStyle = `hsla(${hue},90%,60%,.5)`;
  ctx.fillRect(p.x - 7 * s, p.y - 27 * s, 14 * s, 18 * s);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      ctx.fillStyle = `hsla(${hue},95%,${70 + hashRnd(seed, r * 3 + c) * 15}%,.85)`;
      ctx.fillRect(p.x - 6 * s + c * 7 * s, p.y - 26 * s + r * 6 * s, 5 * s, 4 * s);
    }
  }
}

function drawVent(ctx, p, s) {
  ctx.fillStyle = "rgba(15,18,24,.9)";
  ctx.beginPath(); ctx.ellipse(p.x, p.y, 11 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,150,60,.4)";
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(p.x + i * 3.5 * s, p.y - 3 * s);
    ctx.lineTo(p.x + i * 3.5 * s, p.y + 3 * s);
    ctx.stroke();
  }
}

function drawPuddle(ctx, p, s, seed, tNow) {
  const shimmer = 0.15 + 0.1 * Math.sin(tNow * 1.4 + seed);
  ctx.fillStyle = `rgba(10,16,26,${(0.45 + shimmer).toFixed(2)})`;
  ctx.beginPath(); ctx.ellipse(p.x, p.y, 16 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
  const color = hashRnd(seed, 5) < 0.5 ? "0,243,255" : "255,0,124";
  ctx.fillStyle = `rgba(${color},${(0.18 + shimmer).toFixed(2)})`;
  ctx.beginPath(); ctx.ellipse(p.x, p.y, 10 * s, 3.5 * s, 0, 0, Math.PI * 2); ctx.fill();
}

function drawProps(ctx, W, H) {
  const tNow = performance.now() / 1000;

  const vis = [];
  for (const pr of props) {
    const p = worldToScreen(pr.x, pr.y, W, H);
    const m = 60 * cam.zoom;
    if (p.x < -m || p.x > W + m || p.y < -m || p.y > H + m) continue;
    vis.push({ pr, p, d: Math.hypot(p.x - W / 2, p.y - H / 2) });
  }
  vis.sort((a, b) => b.d - a.d);

  const s = cam.zoom;
  for (const { pr, p } of vis) {
    switch (pr.type) {
      case "bench": drawBench(ctx, p, s); break;
      case "dumpster": drawDumpster(ctx, p, s, pr.seed); break;
      case "planter": drawPlanter(ctx, p, s, pr.seed); break;
      case "stall": drawStall(ctx, p, s, pr.seed); break;
      case "crate": drawCrate(ctx, p, s, pr.seed); break;
      case "vending": drawVending(ctx, p, s, pr.seed); break;
      case "vent": drawVent(ctx, p, s); break;
      case "puddle": drawPuddle(ctx, p, s, pr.seed, tNow); break;
    }
  }
}

// Dampfschlote: kleine aufsteigende Partikel, die aus Lüftungsgittern quellen
function stepPuffs(dt) {
  for (const v of steamVents) {
    v.spawnT = (v.spawnT ?? Math.random() * 2) - dt;
    if (v.spawnT <= 0) {
      v.spawnT = 1.2 + Math.random() * 1.4;
      puffs.push({ x: v.x, y: v.y, vx: (Math.random() - 0.5) * 6, vy: -14 - Math.random() * 8, age: 0, life: 2 + Math.random() });
    }
  }
  for (let i = puffs.length - 1; i >= 0; i--) {
    const pf = puffs[i];
    pf.age += dt;
    pf.x += pf.vx * dt;
    pf.y += pf.vy * dt;
    if (pf.age >= pf.life) puffs.splice(i, 1);
  }
}

function drawPuffs(ctx, W, H) {
  for (const pf of puffs) {
    const p = worldToScreen(pf.x, pf.y, W, H);
    if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) continue;
    const t = pf.age / pf.life;
    const r = (3 + t * 7) * cam.zoom;
    ctx.fillStyle = `rgba(200,210,220,${(0.22 * (1 - t)).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
  }
}

// Hot Zone: rotiert täglich über die Mission-Nodes (+1 Tier, +50% Loot)
function todaySeed() {
  const d = new Date();
  return d.getFullYear() * 372 + (d.getMonth() + 1) * 31 + d.getDate();
}

export function initWorld() {
  nodes.length = 0;
  NODE_DEFS.forEach((n) => nodes.push({ ...n, visited: false, hot: false }));

  const missionNodes = visibleNodes().filter((n) => n.type === "mission");
  if (missionNodes.length) {
    missionNodes[todaySeed() % missionNodes.length].hot = true;
  }

  citizens.length = 0;
  for (const d of DISTRICTS) {
    for (let i = 0; i < 6; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rr = Math.random() * d.r * 0.5;
      const home = { x: d.cx + Math.cos(ang) * rr, y: d.cy + Math.sin(ang) * rr };
      citizens.push({
        x: home.x, y: home.y, tx: home.x, ty: home.y,
        home, leash: d.r * 0.4,
        speed: 40 + Math.random() * 30,
        t: Math.random() * 3,
        facing: Math.PI / 2, animT: 0, frame: 0,
        pal: makeCitizenPalette(d.id, i)
      });
    }
  }

  cam.x = player.x; cam.y = player.y;
  initDistrictBlobs();
  initRoadPaths();
  initGroundGrain();
  initBuildings();
  initCars();
  initLamps();
  initDrones();
  initAmbient();
  initProps();
  initStreetLoot();
  updateNodeList(visibleNodes(), game.selectedNodeId, goToNode);

  // Maus-Zoom (Desktop) — Pendant zum Pinch-Zoom auf Touch-Geräten
  const worldCanvas = game.canvases.world;
  if (worldCanvas && !worldCanvas.dataset.wheelBound) {
    worldCanvas.dataset.wheelBound = "1";
    worldCanvas.addEventListener("wheel", (e) => {
      if (game.mode !== "WORLD") return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      cam.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cam.zoom * factor));
      manualPan = true;
    }, { passive: false });
  }

  // Debug-/Test-Zugriff
  window.__NEON_CAM = () => cam;
}

export function getNodeById(id) {
  return nodes.find((n) => n.id === id);
}

// Liste neu aufbauen (z.B. beim Öffnen des NODES-Panels) — Requires-gates wie
// H1 können sich seit dem letzten Aufbau geändert haben (neuer Tiefen-Rekord)
export function refreshNodeList() {
  updateNodeList(visibleNodes(), game.selectedNodeId, goToNode);
}

// Auftrags-Leiter: sagt dem Spieler immer, was als Nächstes dran ist UND
// warum — gemeldetes Problem: "man versteht nicht, was man machen muss"
export function currentGoal() {
  const g = game;
  const crewOwned = Object.keys(g.crew?.roster || {}).length;

  if (g.missionsDone === 0)
    return { text: "ERSTER DIVE: Geh zum Cache Pop Terminal", nodeId: "M1" };
  if (g.stats.bestLayer < 3)
    return { text: "Schaff Layer 3 — GO DEEPER gibt mehr Loot", nodeId: "M1" };
  if (crewOwned < 2 && g.frags >= 20)
    return { text: "Rekrutiere Crew: CREW ◆ Menü (Frags einlösen)", nodeId: null };
  if (g.stats.bestLayer < 5)
    return { text: "Erreiche Layer 5 — der Boss dort senkt deinen Trace", nodeId: "M3" };
  if (g.stats.bestLayer < 10)
    return { text: "ECHO hört etwas: erreiche Layer 10 (Tier 2-3 hilft)", nodeId: "M7" };
  if (g.stats.voidAnnounced && !g.stats.voidCompleted)
    return { text: "👁 Folge dem VOID SIGNAL in der Undercity", nodeId: "H1" };

  const hot = nodes.find((n) => n.hot);
  return { text: `HOT ZONE heute: +1 Tier, +50% Loot`, nodeId: hot ? hot.id : null };
}

// Ein Tap auf den Auftrag routet direkt hin — löst "der Weg ist unübersichtlich"
export function routeGoal() {
  const goal = currentGoal();
  if (goal.nodeId) goToNode(goal.nodeId);
  else toast(goal.text);
}

// Mission-Node in Reichweite? Für den Quick-Start-Button ("steht man auf der
// Mission, muss man umständlich übers Menü starten" — jetzt: ein Tap)
export function nearMissionNode() {
  for (const n of visibleNodes()) {
    if (n.type !== "mission") continue;
    if (Math.hypot(player.x - n.x, player.y - n.y) <= INTERACT_R) return n;
  }
  return null;
}

/* ---- Street-Loot: tägliche Daten-Shards, die die Overworld nützlich machen ---- */
const streetLoot = [];

function initStreetLoot() {
  streetLoot.length = 0;
  const seed = todaySeed();
  for (let i = 0; i < 12; i++) {
    // deterministisch pro Tag: gleiche Positionen für alle Sessions heute
    const d = DISTRICTS[Math.floor(hashRnd(seed, i * 7) * DISTRICTS.length)];
    const ang = hashRnd(seed, i * 13 + 1) * Math.PI * 2;
    const rr = d.r * (0.15 + hashRnd(seed, i * 17 + 2) * 0.7);
    const frags = hashRnd(seed, i * 23 + 3) < 0.4;
    streetLoot.push({
      i,
      x: d.cx + Math.cos(ang) * rr,
      y: d.cy + Math.sin(ang) * rr,
      frags,
      amount: frags ? 3 + Math.floor(hashRnd(seed, i * 29 + 4) * 4) : 8 + Math.floor(hashRnd(seed, i * 31 + 5) * 13)
    });
  }
}

function stepStreetLoot() {
  if (game.mode !== "WORLD") return;
  for (const s of streetLoot) {
    if (game.daily.lootTaken?.[s.i]) continue;
    if (Math.hypot(player.x - s.x, player.y - s.y) > 46) continue;

    if (!game.daily.lootTaken) game.daily.lootTaken = {};
    game.daily.lootTaken[s.i] = true;
    if (s.frags) game.frags += s.amount;
    else game.money += s.amount;
    toast(`DATEN-SHARD: +${s.amount} ${s.frags ? "◆" : "E$"}`);
    sfx.pop();
    saveNow();
  }
}

function drawStreetLoot(ctx, W, H) {
  const tNow = performance.now() / 1000;
  for (const s of streetLoot) {
    if (game.daily.lootTaken?.[s.i]) continue;
    const p = worldToScreen(s.x, s.y, W, H);
    if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) continue;

    const bob = Math.sin(tNow * 3 + s.i) * 3;
    const size = 6 * cam.zoom;
    const color = s.frags ? "255,0,124" : "252,238,10";

    ctx.fillStyle = `rgba(${color},.25)`;
    ctx.beginPath(); ctx.arc(p.x, p.y + bob, size * 2.2, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = `rgba(${color},.95)`;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + bob - size);
    ctx.lineTo(p.x + size * 0.7, p.y + bob);
    ctx.lineTo(p.x, p.y + bob + size);
    ctx.lineTo(p.x - size * 0.7, p.y + bob);
    ctx.closePath();
    ctx.fill();
  }
}

export function worldSetFocusToggle() {
  focusZoom = !focusZoom;
  cam.zoom = focusZoom ? 1.05 : 0.62;
  toast(focusZoom ? "FOCUS ON." : "FOCUS OFF.");
}

export function worldCancelPointer() {
  downPos = null;
  dragging = false;
  activeTouches.clear();
  pinchStartDist = null;
  pinchStartZoom = null;
}

// Expliziter "zurück zum Charakter"-Weg — vorher gab es nach einem
// Kamera-Wisch nur den Umweg über einen Tap-zum-Hinlaufen, der ungewollt
// den Spieler losschickt (gemeldetes Problem: "keine Zentrierung")
export function worldIsManualPan() {
  return manualPan;
}

export function worldRecenterCamera() {
  manualPan = false;
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

// Position + lokale Richtung entlang einer mehrsegmentigen Straße bei
// t ∈ [0,1] — Autos folgen jetzt der gebogenen Straße statt querfeldein
// schnurgerade zwischen Hub und Bezirk zu schneiden
function pointOnPath(pts, t) {
  const segs = pts.length - 1;
  const tt = Math.max(0, Math.min(1, t)) * segs;
  const i = Math.min(segs - 1, Math.floor(tt));
  const lt = tt - i;
  const a = pts[i], b = pts[i + 1];
  return { x: a.x + (b.x - a.x) * lt, y: a.y + (b.y - a.y) * lt, dx: b.x - a.x, dy: b.y - a.y };
}

// Öffnet einen Pfad entlang mehrerer Punkte (Straßen-Wegpunkte) — ein
// einzelner Stroke-Call statt Segment-für-Segment, für die durchgehenden
// Fahrbahn-/Tint-/Highlight-Passes
function pathThroughPoints(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
}

// Schließt einen weichen Blob-Umriss durch eine Punktreihe (Mittelpunkt-zu-
// Mittelpunkt-Quadrics) — macht aus den rohen Jitter-Punkten eine organische,
// geschlossene Kontur statt eines Vielecks mit sichtbaren Ecken
function pathBlob(ctx, pts) {
  const n = pts.length;
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const m0 = mid(pts[n - 1], pts[0]);
  ctx.beginPath();
  ctx.moveTo(m0.x, m0.y);
  for (let i = 0; i < n; i++) {
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const m = mid(cur, next);
    ctx.quadraticCurveTo(cur.x, cur.y, m.x, m.y);
  }
  ctx.closePath();
}

function interact(n) {
  game.selectedNodeId = n.id;
  game.selectedMissionType = n.missionType || null;
  game.selectedMissionTier = n.tier || 1;
  game.selectedMissionHot = !!n.hot;
  game.selectedMissionArchetype = n.archetype || null;
  pendingInteractId = null;
  openSignalPanel();

  const npcName = $("npcName");
  const npcRole = $("npcRole");
  const dialog = $("dialogText");
  const archetype = n.archetype ? getArchetype(n.archetype) : null;

  if (npcName) npcName.textContent = `${n.npc} // ${n.name}`;
  if (npcRole) npcRole.textContent = (n.type === "mission"
    ? `NETZZUGANG · TIER ${n.tier || 1}${n.hot ? " · 🔥 HOT ZONE" : ""}${archetype && archetype.id !== "infiltration" ? ` · ${archetype.icon} ${archetype.name}` : ""}`
    : "NPC SIGNAL");

  const archetypeLine = archetype && archetype.id !== "infiltration" ? `\n\n${archetype.icon} ${archetype.name}: ${archetype.brief}` : "";
  if (dialog) dialog.textContent = (n.hot ? `${n.tag}\n\n🔥 HOT ZONE HEUTE: +1 Tier, +50% Loot.` : n.tag) + archetypeLine;

  if (n.type === "npc") {
    openNpcDialog(n.id);

    // Clinic: Heat und (falls vorhanden) Cyberpsychose gegen Eddies löschen
    if (n.id === "F1" && (game.heat >= 5 || game.psychosis >= 10)) {
      const cost = Math.ceil(Math.max(game.heat, 8) * 2);
      if (game.money >= cost) {
        game.money -= cost;
        const hadPsychosis = game.psychosis >= 10;
        game.heat = 0;
        game.psychosis = Math.max(0, game.psychosis - 30);
        toast(`DOC-K: SYSTEM CLEAN. -${cost} E$${hadPsychosis ? " · Kopf ist wieder ruhig." : ""}`);
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

  updateNodeList(visibleNodes(), game.selectedNodeId, goToNode);
}

function goToNode(id) {
  const n = nodes.find((x) => x.id === id);
  if (!n) return;

  closeNodesPanel();

  const d = Math.hypot(player.x - n.x, player.y - n.y);
  if (d <= INTERACT_R) {
    interact(n);
    return;
  }

  player.tx = n.x;
  player.ty = n.y;
  player.moving = true;
  pendingInteractId = n.id;
  manualPan = false;
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
    manualPan = false;
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

  stepWalkAnim(player, dt);
}

function stepWalkAnim(actor, dt) {
  if (!actor.moving) {
    actor.animT = 0;
    actor.frame = 0;
    return;
  }
  actor.animT += dt;
  if (actor.animT >= 0.16) {
    actor.animT = 0;
    actor.frame = actor.frame === 0 ? 1 : 0;
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
      c.facing = Math.atan2(dy, dx);
      c.x += (dx / dist) * c.speed * dt;
      c.y += (dy / dist) * c.speed * dt;
      c.moving = true;
    } else {
      c.moving = false;
    }
    stepWalkAnim(c, dt);
  }
}

function stepCamera(dt) {
  if (manualPan) return; // Spieler schaut sich um — Kamera nicht wegziehen
  const f = 1 - Math.pow(0.0001, dt);
  cam.x += (player.x - cam.x) * f;
  cam.y += (player.y - cam.y) * f;
}

function stepCars(dt) {
  for (const c of cars) {
    c.t += c.speed * c.dir * dt;
    if (c.t > 1) { c.t = 1; c.dir = -1; }
    if (c.t < 0) { c.t = 0; c.dir = 1; }
  }

  for (const d of drones) {
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.blink += dt;
    if (d.x < -1800 || d.x > 2400) d.vx *= -1;
    if (d.y < -1400 || d.y > 2200) d.vy *= -1;
  }
}

/* ---- Fake-3D: Gebäude als extrudierte Blöcke (GTA-1/2-Stil) ---- */
function drawBuildings(ctx, W, H) {
  const perf = game.settings?.quality === "perf";
  const lean = perf ? 0.15 : 0.22;
  const cxS = W / 2, cyS = H / 2;

  // sichtbare Gebäude einsammeln, weit entfernte zuerst zeichnen (Painter's)
  const vis = [];
  for (const b of buildings) {
    const p = worldToScreen(b.x, b.y, W, H);
    const m = 220 * cam.zoom;
    if (p.x < -m || p.x > W + m || p.y < -m || p.y > H + m) continue;
    vis.push({ b, p, d: Math.hypot(p.x - cxS, p.y - cyS) });
  }
  vis.sort((a, b) => b.d - a.d);

  for (const { b, p } of vis) {
    const hw = (b.w / 2) * cam.zoom;
    const hh = (b.h / 2) * cam.zoom;
    const k = lean * b.height;

    // 4 Boden-Ecken + zugehörige Dach-Ecken (von der Bildmitte weggekippt)
    const base = [
      { x: p.x - hw, y: p.y - hh },
      { x: p.x + hw, y: p.y - hh },
      { x: p.x + hw, y: p.y + hh },
      { x: p.x - hw, y: p.y + hh }
    ];
    const top = base.map((c) => ({
      x: c.x + (c.x - cxS) * k,
      y: c.y + (c.y - cyS) * k
    }));

    // Lean-to-Dach (Slums): eine Kante des Dachs tiefer als die andere —
    // Wände laufen automatisch schräg mit, macht aus der Box eine schiefe
    // Hütte statt eines weiteren sauberen Blocks
    if (b.roof === "lean") {
      const drop = 9 * cam.zoom * (0.6 + hashRnd(b.seed, 999) * 0.9);
      top[0].y += drop;
      top[1].y += drop;
    }

    // Seitenwände: nur die zur Bildmitte gerichteten sind sichtbar
    const normals = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
    for (let i = 0; i < 4; i++) {
      const n = normals[i];
      if (n.x * (p.x - cxS) + n.y * (p.y - cyS) >= 0) continue;

      const j = (i + 1) % 4;
      ctx.fillStyle = "rgba(7,11,17,.96)";
      ctx.beginPath();
      ctx.moveTo(base[i].x, base[i].y);
      ctx.lineTo(base[j].x, base[j].y);
      ctx.lineTo(top[j].x, top[j].y);
      ctx.lineTo(top[i].x, top[i].y);
      ctx.closePath();
      ctx.fill();

      // Beleuchtete Fenster: Raster einzelner Zellen, Muster stabil pro Gebäude
      if (b.windows) {
        const cols = perf ? 2 : 3;
        const rows = perf ? 2 : 3;
        const ws = Math.max(1.6, 2.4 * cam.zoom);

        for (let cxi = 0; cxi < cols; cxi++) {
          for (let ryi = 0; ryi < rows; ryi++) {
            const f1 = (cxi + 1) / (cols + 1);
            const f2 = 0.25 + (ryi / rows) * 0.55;

            const bx = base[i].x + (base[j].x - base[i].x) * f1;
            const by = base[i].y + (base[j].y - base[i].y) * f1;
            const tx = top[i].x + (top[j].x - top[i].x) * f1;
            const ty = top[i].y + (top[j].y - top[i].y) * f1;

            const wx = bx + (tx - bx) * f2;
            const wy = by + (ty - by) * f2;

            const roll = hashRnd(b.seed, i * 37 + cxi * 7 + ryi * 13);
            const warm = hashRnd(b.seed, i * 91 + cxi * 5 + ryi * 3 + 500) > 0.8;
            ctx.fillStyle = roll > 0.42
              ? (warm ? "rgba(255,200,120,.7)" : `rgba(${b.neon},.75)`)
              : "rgba(40,55,80,.8)";
            ctx.fillRect(wx - ws / 2, wy - ws / 2, ws, ws * 1.4);
          }
        }
      }

      // Neonschild an der Wand zur Bildmitte
      if (b.hasSign && !perf) {
        const sx = (base[i].x + base[j].x) / 2;
        const sy = (base[i].y + base[j].y) / 2;
        const mx = sx + ((top[i].x + top[j].x) / 2 - sx) * 0.5;
        const my = sy + ((top[i].y + top[j].y) / 2 - sy) * 0.5;
        const sw = Math.abs(base[j].x - base[i].x) * 0.35 + 4;

        ctx.fillStyle = `rgba(${b.neon},.25)`;
        ctx.fillRect(mx - sw / 2 - 2, my - 4, sw + 4, 8);
        ctx.fillStyle = `rgba(${b.neon},.95)`;
        ctx.fillRect(mx - sw / 2, my - 2, sw, 4);
      }

      // Großes animiertes Billboard: pulsierende Farbe, dreht den Farbton
      // langsam durch — der Signatur-"lebendige Stadt"-Blickfang
      if (b.hasBillboard && !perf) {
        const wallPt = (u, v) => {
          const lx0 = base[i].x + (top[i].x - base[i].x) * v;
          const ly0 = base[i].y + (top[i].y - base[i].y) * v;
          const lx1 = base[j].x + (top[j].x - base[j].x) * v;
          const ly1 = base[j].y + (top[j].y - base[j].y) * v;
          return { x: lx0 + (lx1 - lx0) * u, y: ly0 + (ly1 - ly0) * u };
        };

        const corners = [wallPt(0.15, 0.1), wallPt(0.85, 0.1), wallPt(0.85, 0.4), wallPt(0.15, 0.4)];
        const hue = (performance.now() / 40 + b.seed * 30) % 360;
        const flick = 0.55 + 0.35 * Math.sin(performance.now() / 260 + b.seed);

        ctx.fillStyle = `hsla(${hue},90%,60%,${(0.55 * flick).toFixed(2)})`;
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let c = 1; c < 4; c++) ctx.lineTo(corners[c].x, corners[c].y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = `hsla(${hue},90%,75%,.8)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Graffiti-Tag: prozedurale Kritzel-Form nahe dem Boden — macht
      // Slums/Industrie nach gelebter Stadt statt Beton-Kulisse (bewusst
      // nicht an !perf gekoppelt: billig genug, um immer sichtbar zu sein)
      if (b.hasGraffiti) {
        const wallPt = (u, v) => {
          const lx0 = base[i].x + (top[i].x - base[i].x) * v;
          const ly0 = base[i].y + (top[i].y - base[i].y) * v;
          const lx1 = base[j].x + (top[j].x - base[j].x) * v;
          const ly1 = base[j].y + (top[j].y - base[j].y) * v;
          return { x: lx0 + (lx1 - lx0) * u, y: ly0 + (ly1 - ly0) * u };
        };
        const gu = 0.2 + hashRnd(b.seed, i * 53 + 700) * 0.5;
        const gc = wallPt(gu, 0.85);
        const ghue = hashRnd(b.seed, i * 61 + 800) < 0.5 ? "255,0,124" : "0,243,255";
        const gs = (10 + hashRnd(b.seed, i * 29 + 900) * 8) * cam.zoom;

        ctx.strokeStyle = `rgba(${ghue},.55)`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(gc.x - gs, gc.y + gs * 0.3);
        ctx.quadraticCurveTo(gc.x - gs * 0.3, gc.y - gs * 0.5, gc.x, gc.y);
        ctx.quadraticCurveTo(gc.x + gs * 0.4, gc.y + gs * 0.4, gc.x + gs, gc.y - gs * 0.2);
        ctx.stroke();
      }
    }

    // Dach
    ctx.fillStyle = "rgba(26,38,56,.97)";
    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(top[i].x, top[i].y);
    ctx.closePath();
    ctx.fill();

    // Neon-Dachkante
    ctx.strokeStyle = `rgba(${b.neon},.5)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Sawtooth-Dach (Industrie): gezackte Kammlinie über der Vorderkante —
    // die klassische Fabrikhallen-Silhouette
    if (b.roof === "sawtooth") {
      const teeth = 3;
      ctx.fillStyle = "rgba(14,20,30,.9)";
      for (let t = 0; t < teeth; t++) {
        const f0 = t / teeth, f1 = (t + 0.5) / teeth, f2 = (t + 1) / teeth;
        const p0 = { x: top[0].x + (top[1].x - top[0].x) * f0, y: top[0].y + (top[1].y - top[0].y) * f0 };
        const pMid = { x: top[0].x + (top[1].x - top[0].x) * f1, y: top[0].y + (top[1].y - top[0].y) * f1 - 7 * cam.zoom };
        const p2 = { x: top[0].x + (top[1].x - top[0].x) * f2, y: top[0].y + (top[1].y - top[0].y) * f2 };
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(pMid.x, pMid.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Tiered-Dach (Corporate): ein zweiter, kleinerer Aufbau oben drauf —
    // die klassische Konzernturm-Silhouette mit Rücksprung statt einer
    // weiteren austauschbaren Flachdach-Box
    if (b.roof === "tiered") {
      const shrink = 0.42;
      const center = { x: (top[0].x + top[2].x) / 2, y: (top[0].y + top[2].y) / 2 };
      const top2 = top.map((c) => ({ x: center.x + (c.x - center.x) * shrink, y: center.y + (c.y - center.y) * shrink }));
      const k2 = k * 0.6;
      const roof2 = top2.map((c) => ({ x: c.x + (c.x - cxS) * k2, y: c.y + (c.y - cyS) * k2 }));

      ctx.fillStyle = "rgba(9,13,21,.97)";
      ctx.beginPath();
      ctx.moveTo(top2[2].x, top2[2].y);
      ctx.lineTo(top2[3].x, top2[3].y);
      ctx.lineTo(roof2[3].x, roof2[3].y);
      ctx.lineTo(roof2[2].x, roof2[2].y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(34,48,68,.97)";
      ctx.beginPath();
      ctx.moveTo(roof2[0].x, roof2[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(roof2[i].x, roof2[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(${b.neon},.6)`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Dachdetails: Klimakasten + blinkende Antenne auf hohen Gebäuden
    const rcx = (top[0].x + top[2].x) / 2;
    const rcy = (top[0].y + top[2].y) / 2;

    if (!perf) {
      const acs = Math.max(2, 4 * cam.zoom);
      ctx.fillStyle = "rgba(14,20,32,.95)";
      ctx.fillRect(rcx - acs + 3 * cam.zoom, rcy - acs - 2 * cam.zoom, acs * 1.6, acs);
      ctx.strokeStyle = "rgba(120,150,190,.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(rcx - acs + 3 * cam.zoom, rcy - acs - 2 * cam.zoom, acs * 1.6, acs);
    }

    if (b.hasAntenna && b.height > 0.7) {
      const ax = rcx + (rcx - cxS) * 0.12 * b.height;
      const ay = rcy + (rcy - cyS) * 0.12 * b.height;
      ctx.strokeStyle = "rgba(150,170,200,.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(rcx, rcy); ctx.lineTo(ax, ay); ctx.stroke();

      if (Math.sin(performance.now() / 400 + b.seed) > 0.2) {
        ctx.fillStyle = "rgba(255,60,60,.95)";
        ctx.beginPath(); ctx.arc(ax, ay, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Dachaufbauten pro Bezirk — der eigentliche Punkt: Downtown hat
    // Wassertanks, Industrie raucht, Undercity glimmt an Rohren statt an
    // Neonschildern. Macht die Skyline von weitem unterscheidbar, nicht nur
    // die Fassade aus der Nähe.
    if (b.rooftop === "watertower" && !perf) {
      const legH = 8 * cam.zoom, tankR = 9 * cam.zoom;
      ctx.strokeStyle = "rgba(80,90,100,.8)";
      ctx.lineWidth = 1.2;
      for (const lx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(rcx + lx * tankR * 0.7, rcy);
        ctx.lineTo(rcx + lx * tankR * 0.7, rcy - legH);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(50,60,74,.95)";
      ctx.beginPath();
      ctx.ellipse(rcx, rcy - legH - tankR * 0.6, tankR, tankR * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(150,170,200,.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (b.rooftop === "smokestack") {
      const stackH = 20 * cam.zoom;
      const sx = rcx + 6 * cam.zoom, sy = rcy;
      ctx.fillStyle = "rgba(40,34,30,.95)";
      ctx.fillRect(sx - 3 * cam.zoom, sy - stackH, 6 * cam.zoom, stackH);
      ctx.strokeStyle = `rgba(${b.neon},.4)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - 3 * cam.zoom, sy - stackH, 6 * cam.zoom, stackH);

      if (!perf) {
        // Rauch: 3 langsam aufsteigende, verblassende Kreise, Phase per
        // Gebäude-Seed versetzt — kein Partikel-State nötig, rein zeitbasiert
        for (let sk = 0; sk < 3; sk++) {
          const ph = (performance.now() / 2200 + sk / 3 + b.seed * 0.001) % 1;
          const sy2 = sy - stackH - ph * 30 * cam.zoom;
          const r = (3 + ph * 5) * cam.zoom;
          ctx.fillStyle = `rgba(180,180,190,${(0.22 * (1 - ph)).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(sx + Math.sin(ph * 6 + sk) * 3 * cam.zoom, sy2, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (b.rooftop === "pipes" && !perf) {
      const pw = 15 * cam.zoom;
      const pulse = 0.4 + Math.sin(performance.now() / 900 + b.seed) * 0.3;
      ctx.strokeStyle = `rgba(${b.neon},${(0.3 + pulse * 0.3).toFixed(2)})`;
      ctx.lineWidth = 3 * cam.zoom;
      ctx.beginPath();
      ctx.moveTo(rcx - pw, rcy + 4 * cam.zoom);
      ctx.lineTo(rcx + pw, rcy + 4 * cam.zoom);
      ctx.stroke();
    }

    // Wahrzeichen: heller Lichtstrahl schießt in den Himmel — als Landmarke
    // von überall auf der Karte sichtbar (grober Fernwirkungs-Effekt)
    if (b.landmark) {
      const beam = ctx.createLinearGradient(rcx, rcy, rcx, rcy - 260 * cam.zoom);
      beam.addColorStop(0, `rgba(${b.neon},.35)`);
      beam.addColorStop(1, `rgba(${b.neon},0)`);
      ctx.fillStyle = beam;
      ctx.fillRect(rcx - 3 * cam.zoom, rcy - 260 * cam.zoom, 6 * cam.zoom, 260 * cam.zoom);

      ctx.fillStyle = `rgba(${b.neon},.9)`;
      ctx.beginPath(); ctx.arc(rcx, rcy, 3.5 * cam.zoom, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawCars(ctx, W, H) {
  for (const c of cars) {
    const d = DISTRICTS[c.seg];
    if (!d.roadPts) continue;
    const wp = pointOnPath(d.roadPts, c.t);
    const p = worldToScreen(wp.x, wp.y, W, H);
    if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) continue;

    // Lichtspur, entlang der lokalen Straßen-Richtung an dieser Stelle
    const len = Math.hypot(wp.dx, wp.dy) || 1;
    const tx = (wp.dx / len) * 14 * cam.zoom * -c.dir;
    const ty = (wp.dy / len) * 14 * cam.zoom * -c.dir;

    ctx.strokeStyle = `rgba(${c.color},.35)`;
    ctx.lineWidth = 3 * cam.zoom;
    ctx.beginPath();
    ctx.moveTo(p.x + tx, p.y + ty);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    ctx.fillStyle = `rgba(${c.color},.95)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.2 * cam.zoom, 0, Math.PI * 2);
    ctx.fill();
  }
}

function draw() {
  const ctx = game.ctx.world;
  const c = game.canvases.world;
  if (!c || !ctx) return;

  const W = window.innerWidth;
  const H = window.innerHeight;

  ctx.clearRect(0, 0, W, H);

  // einmal pro Frame berechnen — wird von mehreren Abschnitten gebraucht
  // (Straßen-Hervorhebung, Nodes, ...)
  const tNow = performance.now() / 1000;
  const perfMode = game.settings?.quality === "perf";

  // Boden: helle blaugraue Fläche statt schwarzem Loch
  ctx.fillStyle = "rgba(26,36,58,.72)";
  ctx.fillRect(0, 0, W, H);

  // district glow zones — organische Blob-Kontur statt Zirkelkreis (ein
  // perfekter Kreis pro Bezirk + Gitter + Speichen-Straßen sah wie ein
  // Mathe-Diagramm aus, nicht wie eine Stadt)
  for (const d of DISTRICTS) {
    const p = worldToScreen(d.cx, d.cy, W, H);
    const rr = d.r * cam.zoom;
    if (p.x < -rr || p.x > W + rr || p.y < -rr || p.y > H + rr) continue;

    const screenBlob = d.blobPts.map((pt) => worldToScreen(pt.x, pt.y, W, H));
    pathBlob(ctx, screenBlob);

    const grd = ctx.createRadialGradient(p.x, p.y, rr * 0.15, p.x, p.y, rr);
    grd.addColorStop(0, d.color.replace(/0\.1\d+\)/, "0.30)"));
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.fill();
  }

  // roads: echte Straßenbänder mit Bordstein-Kanten statt einer nackten
  // dicken Linie, und pro Bezirk in dessen eigener Neonfarbe getönt (statt
  // überall demselben Cyan) — Kritik "sieht optisch nicht gut aus" /
  // "alles derselbe Neon-Style, nichts hebt sich ab". Die Route zum
  // aktuellen Auftragsziel bleibt gelb hervorgehoben on top.
  const hub = DISTRICTS[0];
  const hp = worldToScreen(hub.cx, hub.cy, W, H);
  const goalNode = (() => {
    const gid = game.selectedNodeId || currentGoal().nodeId;
    return gid ? visibleNodes().find((n) => n.id === gid) : null;
  })();
  const goalDistrictId = goalNode ? nodeDistrict(goalNode).id : null;
  const roadW = 34 * cam.zoom;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (let i = 1; i < DISTRICTS.length; i++) {
    const d = DISTRICTS[i];
    const isGoalRoute = d.id === goalDistrictId;
    const tint = BUILD_STYLE[d.id]?.neon || "0,243,255";
    const pts = d.roadPts.map((pt) => worldToScreen(pt.x, pt.y, W, H));

    // Fahrbahn: dunkel, aber mit leichtem Bezirks-Farbstich statt reinem Grau
    pathThroughPoints(ctx, pts);
    ctx.strokeStyle = `rgba(14,20,34,.92)`;
    ctx.lineWidth = roadW;
    ctx.stroke();
    pathThroughPoints(ctx, pts);
    ctx.strokeStyle = `rgba(${tint},.05)`;
    ctx.lineWidth = roadW;
    ctx.stroke();

    // Bordstein-Kanten pro Segment: zwei helle Linien am Rand geben der
    // (jetzt geschwungenen) Fahrbahn Kontur
    const half = roadW / 2;
    for (let s = 0; s < pts.length - 1; s++) {
      const a = pts[s], b = pts[s + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      for (const side of [-1, 1]) {
        ctx.strokeStyle = `rgba(${tint},.35)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(a.x + nx * half * side, a.y + ny * half * side);
        ctx.lineTo(b.x + nx * half * side, b.y + ny * half * side);
        ctx.stroke();
      }
    }

    if (isGoalRoute) {
      // breiter, hell pulsierender Lichtstreifen mittig auf der Route
      const glowPulse = 0.5 + Math.sin(tNow * 3) * 0.2;
      pathThroughPoints(ctx, pts);
      ctx.strokeStyle = `rgba(252,238,10,${(0.22 + glowPulse * 0.18).toFixed(2)})`;
      ctx.lineWidth = 16 * cam.zoom;
      ctx.stroke();

      pathThroughPoints(ctx, pts);
      ctx.strokeStyle = "rgba(252,238,10,.9)";
      ctx.lineWidth = 3;
      ctx.setLineDash([14 * cam.zoom, 10 * cam.zoom]);
      ctx.lineDashOffset = -tNow * 40;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    } else {
      pathThroughPoints(ctx, pts);
      ctx.strokeStyle = `rgba(${tint},.32)`;
      ctx.lineWidth = 2;
      ctx.setLineDash([12 * cam.zoom, 16 * cam.zoom]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Nebenstraßen zwischen Nachbar-Bezirken — bricht die reine Stern-
  // Topologie auf (gemeldetes Problem: sah aus wie ein Graph-Diagramm)
  for (const road of secondaryRoads) {
    const pts = road.pts.map((pt) => worldToScreen(pt.x, pt.y, W, H));
    pathThroughPoints(ctx, pts);
    ctx.strokeStyle = "rgba(10,15,26,.85)";
    ctx.lineWidth = roadW * 0.5;
    ctx.stroke();
    pathThroughPoints(ctx, pts);
    ctx.strokeStyle = "rgba(150,170,200,.18)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10 * cam.zoom, 14 * cam.zoom]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Kreuzungs-Plaza: sauberer runder Abschluss am Konvergenzpunkt, statt
  // dass sich alle Straßenbänder unordentlich in einem Pixel überlagern
  const plaza = ctx.createRadialGradient(hp.x, hp.y, 2, hp.x, hp.y, roadW * 0.9);
  plaza.addColorStop(0, "rgba(20,28,44,.95)");
  plaza.addColorStop(1, "rgba(20,28,44,0)");
  ctx.fillStyle = plaza;
  ctx.beginPath();
  ctx.arc(hp.x, hp.y, roadW * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,243,255,.4)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(hp.x, hp.y, roadW * 0.55, 0, Math.PI * 2);
  ctx.stroke();

  // Boden-Körnung: verstreute feine Flecken statt eines Koordinatengitters —
  // ein Gitter über der ganzen Stadt sah nach Diagrammpapier aus, nicht nach
  // Asphalt (gemeldetes Problem: "Mathe-Optik"). In PERF ausgelassen.
  if (!perfMode) {
    for (const g of groundGrain) {
      const p = worldToScreen(g.x, g.y, W, H);
      if (p.x < -6 || p.x > W + 6 || p.y < -6 || p.y > H + 6) continue;
      ctx.fillStyle = g.warm ? `rgba(255,214,150,${g.a})` : `rgba(160,190,220,${g.a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, g.r * cam.zoom, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Straßenlaternen: warme Lichtpunkte mit Lichtkegel am Boden
  for (const lp of lamps) {
    const p = worldToScreen(lp.x, lp.y, W, H);
    if (p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 30) continue;

    const pool = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 26 * cam.zoom);
    pool.addColorStop(0, "rgba(255,214,150,.28)");
    pool.addColorStop(1, "rgba(255,214,150,0)");
    ctx.fillStyle = pool;
    ctx.beginPath(); ctx.arc(p.x, p.y, 26 * cam.zoom, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "rgba(255,226,170,.95)";
    ctx.beginPath(); ctx.arc(p.x, p.y, 3 * cam.zoom, 0, Math.PI * 2); ctx.fill();
  }

  // Gebäude (Fake-3D) + Verkehr
  drawBuildings(ctx, W, H);
  drawCars(ctx, W, H);
  drawProps(ctx, W, H);
  drawPuffs(ctx, W, H);
  drawStreetLoot(ctx, W, H);

  const charScale = 1.7 * cam.zoom;

  // citizens
  for (const cz of citizens) {
    const p = worldToScreen(cz.x, cz.y, W, H);
    if (p.x < -30 || p.x > W + 30 || p.y < -40 || p.y > H + 10) continue;

    const { dir, mirror } = facingToDir(cz.facing);
    const sprites = getSprites(cz.pal);
    drawCharacterAt(ctx, p.x, p.y + 6 * cam.zoom, charScale, dir, mirror, sprites[dir][cz.frame]);
  }

  // nodes
  visibleNodes().forEach((n) => {
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

    // Bodenmarkierung: ein IMMER sichtbarer, sanft pulsierender Ring unter
    // jedem interaktiven Node — unterscheidet ihn zuverlässig von Deko
    // (Props, Passanten, Gebäuden), die dieselbe Neon-Palette benutzen.
    // Gemeldetes Problem: "Overworld unübersichtlich" / Nodes gehen unter.
    const nodePulse = 0.7 + Math.sin(tNow * 2.4 + n.x * 0.01) * 0.3;
    const markColor = n.type === "npc" ? (NPC_PALETTE[n.npc]?.accent || "#00f3ff") : "#00f3ff";
    ctx.save();
    ctx.globalAlpha = 0.35 + nodePulse * 0.2;
    ctx.fillStyle = markColor;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 10 * cam.zoom, 20 * cam.zoom, 7 * cam.zoom, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (n.type === "npc") {
      const pal = NPC_PALETTE[n.npc] || PALETTES.nyx;
      const sprites = getSprites(pal);
      if (inRange || active) {
        ctx.save();
        ctx.shadowColor = pal.accent;
        ctx.shadowBlur = 12 * cam.zoom;
        drawCharacterAt(ctx, p.x, p.y + 6 * cam.zoom, charScale * 1.15, "down", false, sprites.down[0]);
        ctx.restore();
      } else {
        ctx.save();
        ctx.shadowColor = pal.accent;
        ctx.shadowBlur = 6 * cam.zoom;
        drawCharacterAt(ctx, p.x, p.y + 6 * cam.zoom, charScale * 1.15, "down", false, sprites.down[0]);
        ctx.restore();
      }
    } else {
      // weicher Halo immer sichtbar, nicht erst wenn man draufsteht
      const haloR = (18 + nodePulse * 4) * cam.zoom;
      const halo = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, haloR);
      halo.addColorStop(0, "rgba(0,243,255,.35)");
      halo.addColorStop(1, "rgba(0,243,255,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = active ? "#ffffff" : "rgba(0,243,255,.85)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, (inRange ? 20 : 16) * cam.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,.9)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, (inRange ? 20 : 16) * cam.zoom, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Namensschild mit dunklem Hintergrund — sonst geht weißer Text auf
    // der unruhigen Stadt-Kulisse unter
    ctx.font = "bold 12px ui-monospace, monospace";
    const labelW = ctx.measureText(n.name).width;
    ctx.fillStyle = "rgba(5,9,14,.75)";
    ctx.fillRect(p.x + 15, p.y - 4, labelW + 14, 18);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(n.name, p.x + 22, p.y + 9);
  });

  // player
  const pp = worldToScreen(player.x, player.y, W, H);
  const pDir = facingToDir(player.facing);
  const pSprites = getSprites(PALETTES.player);

  ctx.save();
  ctx.shadowColor = "rgba(252,238,10,.55)";
  ctx.shadowBlur = 10 * cam.zoom;
  drawCharacterAt(ctx, pp.x, pp.y + 6 * cam.zoom, charScale * 1.1, pDir.dir, pDir.mirror, pSprites[pDir.dir][player.frame]);
  ctx.restore();

  // Wegpunkt: zeigt immer zum aktuellen Ziel (ausgewählter Node oder Auftrag).
  // On-Screen: pulsierender Pfeil überm Node; Off-Screen: Randpfeil + Distanz
  const goal = currentGoal();
  const wpId = game.selectedNodeId || goal.nodeId;
  const wpNode = wpId ? visibleNodes().find((n) => n.id === wpId) : null;
  if (wpNode && Math.hypot(player.x - wpNode.x, player.y - wpNode.y) > INTERACT_R) {
    const p = worldToScreen(wpNode.x, wpNode.y, W, H);
    const pulse = Math.sin(tNow * 5) * 4;
    const onScreen = p.x > 30 && p.x < W - 30 && p.y > 90 && p.y < H - 120;

    ctx.fillStyle = "rgba(252,238,10,.95)";
    if (onScreen) {
      const ay = p.y - 34 * cam.zoom - 14 + pulse;
      ctx.beginPath();
      ctx.moveTo(p.x, ay + 10);
      ctx.lineTo(p.x - 8, ay);
      ctx.lineTo(p.x + 8, ay);
      ctx.closePath();
      ctx.fill();
    } else {
      // an den Bildschirmrand geklemmt, Pfeil zeigt Richtung Ziel
      const cxS = W / 2, cyS = H / 2;
      const ang = Math.atan2(p.y - cyS, p.x - cxS);
      const ex = Math.max(34, Math.min(W - 34, cxS + Math.cos(ang) * 10000));
      const ey = Math.max(96, Math.min(H - 130, cyS + Math.sin(ang) * 10000));

      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(12 + pulse * 0.5, 0);
      ctx.lineTo(-6, -8);
      ctx.lineTo(-6, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      const dist = Math.round(Math.hypot(player.x - wpNode.x, player.y - wpNode.y) / 10);
      ctx.font = "bold 11px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${wpNode.name} · ${dist}m`, ex, ey + 22);
      ctx.textAlign = "start";
    }
  }

  // Drohnen: über allem, mit Bodenschatten und Blinklicht
  for (const d of drones) {
    const p = worldToScreen(d.x, d.y, W, H);
    if (p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 40) continue;

    // "Flughöhe" durch Versatz weg von der Bildmitte
    const ax = p.x + (p.x - W / 2) * 0.22;
    const ay = p.y + (p.y - H / 2) * 0.22;

    ctx.fillStyle = "rgba(0,0,0,.20)";
    ctx.beginPath(); ctx.arc(p.x, p.y, 5 * cam.zoom, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "rgba(30,40,58,.95)";
    ctx.fillRect(ax - 4 * cam.zoom, ay - 2 * cam.zoom, 8 * cam.zoom, 4 * cam.zoom);

    if (Math.sin(d.blink * 5) > 0) {
      ctx.fillStyle = `rgba(${d.color},.95)`;
      ctx.beginPath(); ctx.arc(ax, ay - 3 * cam.zoom, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawAmbient(ctx);
  drawPsychosisGlitch(ctx, W, H);
}

// Cyberpsychose-Glitch: kurze horizontale Bildstörung mit Farbrand, ausgelöst
// von music.js im selben Moment wie ein Hilferuf — bindet Audio und Optik
// zusammen, ohne ein eigenes Timing-System zu brauchen
function drawPsychosisGlitch(ctx, W, H) {
  if (!game.glitchUntil || performance.now() >= game.glitchUntil) return;

  const bands = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < bands; i++) {
    const y = Math.random() * H;
    const h = 4 + Math.random() * 12;
    const dx = (Math.random() - 0.5) * 40;

    try { ctx.drawImage(game.canvases.world, 0, y, W, h, dx, y, W, h); } catch {}
    ctx.fillStyle = "rgba(255,0,60,.12)";
    ctx.fillRect(0, y, W, h);
    ctx.fillStyle = "rgba(0,220,255,.10)";
    ctx.fillRect(dx * 0.4, y, W, h);
  }
}

export function worldTick(dt = 0) {
  if (game.mode === "WORLD") stepPlayer(dt);
  stepCitizens(dt);
  stepCars(dt);
  stepAmbient(dt);
  stepPuffs(dt);
  stepStreetLoot();
  stepCamera(dt);
  if (game.mode === "WORLD") encounterTick(dt, nodeDistrict(player).id);
  draw();
}

function pinchDist() {
  const pts = [...activeTouches.values()];
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}

export function handleWorldPointer(type, e) {
  if (game.mode !== "WORLD") return;

  if (type === "down") {
    activeTouches.set(e.pointerId, localPos(e));

    if (activeTouches.size >= 2) {
      // Zweiter Finger: laufenden Ein-Finger-Drag verwerfen, sonst zählt
      // das Loslassen später fälschlich als Tap-zum-Hinlaufen
      downPos = null;
      dragging = false;
      pinchStartDist = pinchDist();
      pinchStartZoom = cam.zoom;
    } else {
      downPos = localPos(e);
      dragLast = downPos;
      dragging = true;
    }
    return;
  }

  if (type === "move") {
    if (activeTouches.has(e.pointerId)) activeTouches.set(e.pointerId, localPos(e));

    // Pinch-Zoom: zwei aktive Finger überschreiben die Ein-Finger-Logik
    if (activeTouches.size >= 2 && pinchStartDist) {
      const dist = pinchDist();
      cam.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchStartZoom * (dist / pinchStartDist)));
      manualPan = true;
      return;
    }

    if (!dragging || !downPos) return;
    const p = localPos(e);

    // erst ab einer kleinen Schwelle als Kamera-Wisch werten (sonst zittern Taps)
    if (manualPan || Math.hypot(p.x - downPos.x, p.y - downPos.y) > 14) {
      if (!manualPan) toast("KAMERA FREI — 📍 ZENTRIEREN tippen kehrt zurück.");
      manualPan = true;
      cam.x -= (p.x - dragLast.x) / cam.zoom;
      cam.y -= (p.y - dragLast.y) / cam.zoom;
    }
    dragLast = p;
    return;
  }

  if (type === "up" || type === "cancel") {
    activeTouches.delete(e.pointerId);
    if (activeTouches.size < 2) { pinchStartDist = null; pinchStartZoom = null; }

    if (type === "cancel") { downPos = null; dragging = false; return; }

    dragging = false;
    if (!downPos) return;
    const p = localPos(e);
    const dist = Math.hypot(p.x - downPos.x, p.y - downPos.y);
    downPos = null;
    if (dist > 14) return; // war ein Kamera-Wisch, kein Tap

    let hit = null;
    let bestD = 30;
    for (const n of visibleNodes()) {
      const sp = worldToScreen(n.x, n.y, p.w, p.h);
      const d = Math.hypot(p.x - sp.x, p.y - sp.y);
      if (d < bestD) { bestD = d; hit = n; }
    }

    if (hit) {
      goToNode(hit.id);
    } else {
      const w = screenToWorld(p.x, p.y, p.w, p.h);
      pendingInteractId = null;
      manualPan = false;
      player.tx = w.x;
      player.ty = w.y;
      player.moving = true;
    }
    return;
  }
}
