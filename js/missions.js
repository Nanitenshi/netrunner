// js/missions.js
import { game } from "./core.js";
import { toast } from "./ui.js";

let paused = false;

const mission = {
  active: false,
  type: "CACHE POP",
  timer: 0,
  timeLimit: 10.0,
  score: 0,
  popped: 0,
  objective: 20
};

const caches = [];

export function missionSetPaused(p) {
  paused = !!p;
}

export function missionCancelPointer() {
  // nothing persistent needed, but keep API
}

function localPos(e) {
  const c = game.canvases.mission;
  const r = c.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

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

function spawnCaches() {
  caches.length = 0;

  const W = window.innerWidth;
  const H = window.innerHeight;

  // playable area (avoid HUD + bottom bar)
  const top = 140;
  const bottom = H - 120;

  for (let i = 0; i < 6; i++) {
    caches.push(makeCache(
      120 + Math.random() * (W - 240),
      top + Math.random() * (bottom - top)
    ));
  }
}

function makeCache(x, y) {
  return {
    x, y,
    rOuter: 56 + Math.random() * 20,
    rInner: 22 + Math.random() * 10,
    alive: true
  };
}

export function startMission(type = "cache") {
  mission.active = true;
  mission.timer = 0;
  mission.score = 0;
  mission.popped = 0;
  mission.type = "CACHE POP";
  mission.timeLimit = 10.0;
  mission.objective = 20;

  spawnCaches();
  setHud();
  toast("MISSION START: CACHE POP");
}

function hitCache(x, y) {
  let best = null;
  let bestD = 1e9;

  for (const c of caches) {
    if (!c.alive) continue;
    const d = Math.hypot(x - c.x, y - c.y);

    const ringMin = c.rInner - 12;
    const ringMax = c.rOuter + 12;

    if (d >= ringMin && d <= ringMax) {
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
  }
  return best;
}

export function handleMissionPointer(type, e) {
  if (!mission.active || paused) return;

  // we score on "down" only (so it feels like popping)
  if (type !== "down") return;

  const p = localPos(e);
  const c = hitCache(p.x, p.y);
  if (!c) return;

  c.alive = false;
  mission.score += 1;
  mission.popped += 1;

  // quick respawn
  const W = window.innerWidth;
  const H = window.innerHeight;
  const top = 140;
  const bottom = H - 120;

  caches.push(makeCache(
    120 + Math.random() * (W - 240),
    top + Math.random() * (bottom - top)
  ));

  setHud();
  toast("CACHE POP!");
}

function draw() {
  const ctx = game.ctx.mission;
  if (!ctx) return;

  const W = window.innerWidth;
  const H = window.innerHeight;

  ctx.clearRect(0, 0, W, H);

  // subtle dark overlay
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, W, H);

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

export function missionTick(dt, onFinish) {
  if (!mission.active) return;

  // always render + HUD
  draw();
  setHud();

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
