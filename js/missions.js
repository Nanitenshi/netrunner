import { game } from "./core.js";
import { toast } from "./ui.js";

let paused = false;

let mission = {
  active: false,
  name: "CACHE POP",
  timer: 0,
  timeLimit: 10.0,
  score: 0,
  objective: 20,
  popped: 0
};

// Circles (Caches)
const caches = [];
let pointerDown = false;

export function missionSetPaused(p) {
  paused = !!p;
}

export function missionCancelPointer() {
  pointerDown = false;
}

// spawn caches in screen-space but stored as world coords (canvas space)
function spawnCaches() {
  caches.length = 0;
  const W = window.innerWidth;
  const H = window.innerHeight;

  // safe area: oben HUD, unten bottomBar
  const top = 120;
  const bottom = H - 120;

  for (let i = 0; i < 6; i++) {
    caches.push({
      x: 120 + Math.random() * (W - 240),
      y: top + Math.random() * (bottom - top),
      rOuter: 56 + Math.random() * 18,
      rInner: 22 + Math.random() * 10,
      alive: true,
      pulse: 0
    });
  }
}

export function startMission(type = "cache") {
  mission.active = true;
  mission.timer = 0;
  mission.score = 0;
  mission.popped = 0;
  mission.name = "CACHE POP";
  mission.timeLimit = 10.0;
  mission.objective = 20;

  spawnCaches();

  toast("MISSION START: CACHE POP");
}

// Hit test: tap must land near outer ring
function hitCache(x, y) {
  // pick nearest alive
  let best = null;
  let bestD = 1e9;

  for (const c of caches) {
    if (!c.alive) continue;
    const d = Math.hypot(x - c.x, y - c.y);
    // accept if within outer ring thickness region
    const ringMin = c.rInner - 10;
    const ringMax = c.rOuter + 10;
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

  if (type === "down") {
    pointerDown = true;

    const x = e.clientX;
    const y = e.clientY;

    const c = hitCache(x, y);
    if (c) {
      c.alive = false;
      c.pulse = 1;

      mission.score += 1;
      mission.popped += 1;

      // respawn one new cache somewhere else (keeps action going)
      setTimeout(() => {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const top = 120;
        const bottom = H - 120;
        caches.push({
          x: 120 + Math.random() * (W - 240),
          y: top + Math.random() * (bottom - top),
          rOuter: 56 + Math.random() * 18,
          rInner: 22 + Math.random() * 10,
          alive: true,
          pulse: 0
        });
      }, 120);

      toast("CACHE POP!");
    }
  }

  if (type === "up" || type === "cancel") {
    pointerDown = false;
  }
}

function drawMission() {
  const c = game.canvases.mission;
  const ctx = game.ctx.mission;
  if (!c || !ctx) return;

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // subtle vignette
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  // draw caches
  for (const k of caches) {
    if (!k.alive) continue;

    // outer cyan ring
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0,243,255,0.85)";
    ctx.beginPath();
    ctx.arc(k.x, k.y, k.rOuter, 0, Math.PI * 2);
    ctx.stroke();

    // inner pink ring
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,0,124,0.75)";
    ctx.beginPath();
    ctx.arc(k.x, k.y, k.rInner, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function missionTick(dt, onFinish) {
  if (!mission.active) return;

  // Render immer (auch wenn paused), aber Timer nur wenn nicht paused
  drawMission();

  // HUD
  const elMission = document.getElementById("hudMission");
  if (elMission) elMission.textContent = mission.name;

  const elObj = document.getElementById("hudObjective");
  if (elObj) elObj.textContent = `${mission.popped} / ${mission.objective}`;

  const elScore = document.getElementById("hudScore") || document.getElementById("hudFrags");
  if (elScore) elScore.textContent = String(mission.score);

  const elTimer = document.getElementById("hudTimer");
  if (elTimer) {
    const left = Math.max(0, mission.timeLimit - mission.timer);
    elTimer.textContent = `${left.toFixed(1)}s`;
  }

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
