import { game } from "./core.js";
import { toast } from "./ui.js";

let paused = false;
let pointerDown = false;

const mission = {
  active: false,
  type: "CACHE POP",
  timer: 0,
  timeLimit: 10.0,
  score: 0,
  popped: 0,
  objective: 20
};

// Performance: immer gleiche Anzahl Caches, nicht ständig pushen
const CACHE_COUNT = 6;

const caches = [];
let lastPopToast = 0;

// kleines Feedback ohne DOM-Toast-Spam
let flash = 0;

export function missionSetPaused(p) {
  paused = !!p;
}

export function missionCancelPointer() {
  pointerDown = false;
}

/* ---------------- HUD ---------------- */
function setHud() {
  const t = document.getElementById("mHudType");
  if (t) t.textContent = mission.type;

  const o = document.getElementById("mHudObjective");
  if (o) o.textContent = `${mission.popped} / ${mission.objective}`;

  const s = document.getElementById("mHudScore");
  if (s) s.textContent = String(mission.score);

  const timer = document.getElementById("mHudTimer");
  if (timer) timer.textContent = `${Math.max(0, mission.timeLimit - mission.timer).toFixed(1)}s`;
}

/* ---------------- CACHES ---------------- */
function getPlayArea() {
  // Spielbereich (HUD oben, Bottom-Bar unten)
  // Falls du HUD/Bottom-Bar änderst, passe diese Zahlen an.
  const W = window.innerWidth;
  const H = window.innerHeight;

  const top = 140;
  const bottom = H - 120;

  return { W, H, top, bottom };
}

function makeCache(x, y) {
  const rOuter = 52 + Math.random() * 18;
  const rInner = 22 + Math.random() * 10;
  return {
    x, y,
    rOuter,
    rInner,
    // squared radii for fast hit test
    ringMin2: Math.max(6, rInner - 14) ** 2,
    ringMax2: (rOuter + 14) ** 2,
    alive: true
  };
}

function respawnCache(c) {
  const { W, top, bottom } = getPlayArea();
  c.x = 120 + Math.random() * (W - 240);
  c.y = top + Math.random() * (bottom - top);

  const rOuter = 52 + Math.random() * 18;
  const rInner = 22 + Math.random() * 10;

  c.rOuter = rOuter;
  c.rInner = rInner;
  c.ringMin2 = Math.max(6, rInner - 14) ** 2;
  c.ringMax2 = (rOuter + 14) ** 2;
  c.alive = true;
}

function spawnCaches() {
  caches.length = 0;
  const { W, top, bottom } = getPlayArea();

  for (let i = 0; i < CACHE_COUNT; i++) {
    caches.push(
      makeCache(
        120 + Math.random() * (W - 240),
        top + Math.random() * (bottom - top)
      )
    );
  }
}

/* ---------------- START ---------------- */
export function startMission(type = "cache") {
  mission.active = true;
  mission.timer = 0;
  mission.score = 0;
  mission.popped = 0;

  mission.type = "CACHE POP";
  mission.timeLimit = 10.0;
  mission.objective = 20;

  flash = 0;
  lastPopToast = 0;

  spawnCaches();
  setHud();
  toast("MISSION START: CACHE POP");
}

/* ---------------- INPUT ---------------- */
function getLocalXY(e) {
  // WICHTIG: clientX/clientY sind viewport coords.
  // Wir brauchen coords relativ zum Canvas (BoundingRect),
  // sonst passt Hit-Test auf manchen Geräten nicht.
  const canvas = game.canvases.mission;
  if (!canvas) return { x: e.clientX, y: e.clientY };

  const r = canvas.getBoundingClientRect();
  return {
    x: e.clientX - r.left,
    y: e.clientY - r.top
  };
}

function hitCache(x, y) {
  // Best hit (nearest) within ring band
  let best = null;
  let bestD2 = Infinity;

  for (const c of caches) {
    if (!c.alive) continue;
    const dx = x - c.x;
    const dy = y - c.y;
    const d2 = dx * dx + dy * dy;

    if (d2 >= c.ringMin2 && d2 <= c.ringMax2) {
      if (d2 < bestD2) {
        bestD2 = d2;
        best = c;
      }
    }
  }
  return best;
}

function popCache(c) {
  c.alive = false;

  mission.score += 1;
  mission.popped += 1;
  flash = 1.0;

  // Weniger Toast-Spam: max 1 Toast pro 350ms
  const now = performance.now();
  if (now - lastPopToast > 350) {
    toast("CACHE POP!");
    lastPopToast = now;
  }

  // sofort respawn (konstante Anzahl)
  respawnCache(c);

  setHud();
}

export function handleMissionPointer(type, e) {
  if (!mission.active || paused) return;

  if (type === "down") {
    pointerDown = true;

    const { x, y } = getLocalXY(e);
    const c = hitCache(x, y);
    if (c) popCache(c);
    return;
  }

  // Wichtig: auf Tablets wird häufig minimal gezogen statt exakt getippt.
  // Daher auch move verwerten, aber nur solange pointerDown true ist.
  if (type === "move") {
    if (!pointerDown) return;

    const { x, y } = getLocalXY(e);
    const c = hitCache(x, y);
    if (c) popCache(c);
    return;
  }

  if (type === "up" || type === "cancel") {
    pointerDown = false;
  }
}

/* ---------------- RENDER ---------------- */
function draw() {
  const ctx = game.ctx.mission;
  if (!ctx) return;

  const W = window.innerWidth;
  const H = window.innerHeight;

  ctx.clearRect(0, 0, W, H);

  // dark overlay
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, W, H);

  // subtle flash feedback
  if (flash > 0) {
    ctx.fillStyle = `rgba(0,243,255,${0.08 * flash})`;
    ctx.fillRect(0, 0, W, H);
  }

  // caches
  for (const c of caches) {
    if (!c.alive) continue;

    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0,243,255,0.85)";
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.rOuter, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,0,124,0.75)";
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.rInner, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/* ---------------- TICK ---------------- */
export function missionTick(dt, onFinish) {
  if (!mission.active) return;

  // Render immer (auch in Pause)
  draw();
  setHud();

  // Flash decay
  flash = Math.max(0, flash - dt * 4.5);

  if (paused) return;

  mission.timer += dt;

  const done = (mission.popped >= mission.objective) || (mission.timer >= mission.timeLimit);

  if (done) {
    mission.active = false;

    const resultData = {
      apply: (g) => ({
        money: g.money + mission.score * 3,
        frags: g.frags + mission.score,
        heat: Math.min(100, g.heat + 6)
      })
    };

    toast(`MISSION COMPLETE: +${mission.score} FRAGS`);
    onFinish(resultData);
  }
}
