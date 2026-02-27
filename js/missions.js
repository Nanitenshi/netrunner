import { game } from "./core.js";
import { toast } from "./ui.js";

let mission = null;

// simple target objects
let targets = [];
let held = false;
let holdPower = 0;

export function startMission(type = "quick", node = null) {
  const baseTime = 12 + (game.upgrades.buffer * 1.5);
  mission = {
    active: true,
    type,
    name: node?.name || "Mission",
    timer: 0,
    timeLimit: baseTime,
    score: 0,
    objective: (type === "trace") ? 100 : (type === "burst" ? 6 : 30),
    progress: 0,
    lastHitAt: 0,
  };

  targets = [];
  held = false;
  holdPower = 0;

  // show in HUD
  const nm = document.getElementById("hudMissionName"); if (nm) nm.textContent = mission.name;
  const ab = document.getElementById("hudAbility"); if (ab) ab.textContent = (game.upgrades.pulse > 0 ? "PULSE" : "NONE");

  toast(`MISSION START: ${mission.type.toUpperCase()}`);
}

export function handleMissionPointer(type, e) {
  if (!mission?.active) return;

  const canvas = game.canvases.mission;
  if (!canvas) return;
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left);
  const y = (e.clientY - r.top);

  if (mission.type === "quick") {
    // tap targets
    if (type === "down") {
      hitTargets(x, y);
    }
  }

  if (mission.type === "trace") {
    // “stay on line”: moving increases progress, but misses cost time
    if (type === "move") {
      mission.progress = Math.min(mission.objective, mission.progress + 1);
      mission.score += 1;
      // if you drag too fast -> penalty (adds skill)
      // (very cheap check)
      if (e.movementX * e.movementX + e.movementY * e.movementY > 900) mission.timer += 0.03;
    }
  }

  if (mission.type === "burst") {
    // hold to charge, release to score
    if (type === "down") held = true;
    if (type === "up" || type === "cancel") {
      held = false;
      // score if near sweet spot
      const sweet = 0.78;
      const diff = Math.abs(holdPower - sweet);
      if (diff < 0.10) {
        mission.progress += 1;
        mission.score += 20;
        toast("PERFECT BURST!");
      } else if (diff < 0.18) {
        mission.progress += 1;
        mission.score += 10;
        toast("GOOD BURST");
      } else {
        mission.timer += 0.6;
        toast("BAD TIMING");
      }
      holdPower = 0;
    }
  }
}

function spawnTarget() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  targets.push({
    x: 80 + Math.random() * (w - 160),
    y: 120 + Math.random() * (h - 220),
    r: 26,
    life: 1.0
  });
  if (targets.length > 6) targets.shift();
}

function hitTargets(px, py) {
  let hit = false;
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    const d = Math.hypot(px - t.x, py - t.y);
    const hitbox = t.r + 10 + (game.upgrades.amplifier * 2);
    if (d <= hitbox) {
      targets.splice(i, 1);
      mission.progress += 1;
      mission.score += 10;
      hit = true;
      break;
    }
  }
  if (!hit) mission.timer += 0.25; // miss penalty
}

export function missionTick(dt, onFinish) {
  if (!mission?.active) return;

  mission.timer += dt;

  // ability: pulse -> slow time for a moment
  if (game.upgrades.pulse > 0 && mission.timer < 2.0) {
    // tiny help at start
    mission.timer -= dt * 0.12;
  }

  // update objective
  const obj = document.getElementById("hudObjective");
  const sc = document.getElementById("hudScore");
  const ti = document.getElementById("hudTimer");
  if (obj) obj.textContent = `${mission.progress} / ${mission.objective}`;
  if (sc) sc.textContent = String(mission.score);
  if (ti) ti.textContent = `${Math.max(0, (mission.timeLimit - mission.timer)).toFixed(1)}s`;

  // render
  drawMission(dt);

  // win/lose
  const finished = (mission.progress >= mission.objective);
  const timeout = (mission.timer >= mission.timeLimit);

  if (finished || timeout) {
    mission.active = false;

    const success = finished && !timeout;
    const fr = success ? Math.max(1, Math.floor(mission.score / 20)) : 0;
    const cash = success ? (120 + Math.floor(mission.score * 0.8)) : 20;

    const result = {
      title: success ? "SUCCESS" : "FAILED",
      frags: fr,
      cash,
      storyLine: success
        ? (mission.type === "trace"
            ? "Du hast einen versteckten Arasaka-Pfad gesehen. Nyx wird nervös."
            : "Datenpakete secured. Aber da ist ein Echo im Signal…")
        : "ICE drückt dich raus. Beim nächsten Run klüger spielen.",
      apply: (g) => ({
        money: g.money + cash,
        frags: g.frags + fr,
        heat: Math.min(100, g.heat + (success ? 6 : 3))
      })
    };

    toast(success ? "MISSION COMPLETE" : "MISSION FAILED");
    onFinish(result);
  }
}

function drawMission(dt) {
  const ctx = game.ctx.mission;
  if (!ctx) return;

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // subtle background
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  // type-specific visuals
  if (mission.type === "quick") {
    // spawn rate
    if (Math.random() < 0.07) spawnTarget();

    // decay
    targets.forEach(t => t.life -= dt * 0.8);
    targets = targets.filter(t => t.life > 0);

    // draw targets
    for (const t of targets) {
      const r = t.r * (0.7 + t.life * 0.6);

      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,243,255,0.95)";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(t.x, t.y, r * 0.45, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,0,124,0.85)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // hint
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText("TIP: Tap the rings. Miss = time penalty.", 14, window.innerHeight - 20);
  }

  if (mission.type === "trace") {
    // draw “signal lane”
    const midY = window.innerHeight * 0.55;
    ctx.fillStyle = "rgba(255,0,124,0.10)";
    ctx.fillRect(0, midY - 38, window.innerWidth, 76);
    ctx.strokeStyle = "rgba(0,243,255,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, midY - 38, window.innerWidth, 76);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText("TRACE: Drag steadily. Too fast = penalty.", 14, window.innerHeight - 20);
  }

  if (mission.type === "burst") {
    if (held) {
      holdPower = Math.min(1, holdPower + dt * 0.9);
    } else {
      holdPower = Math.max(0, holdPower - dt * 0.6);
    }

    const cx = window.innerWidth * 0.5;
    const cy = window.innerHeight * 0.55;

    // ring
    ctx.beginPath();
    ctx.arc(cx, cy, 80, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,243,255,0.45)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // sweet spot
    ctx.beginPath();
    ctx.arc(cx, cy, 80, -Math.PI/2, -Math.PI/2 + Math.PI * 2 * 0.78);
    ctx.strokeStyle = "rgba(252,238,10,0.55)";
    ctx.lineWidth = 6;
    ctx.stroke();

    // power indicator
    ctx.beginPath();
    ctx.arc(cx, cy, 80, -Math.PI/2, -Math.PI/2 + Math.PI * 2 * holdPower);
    ctx.strokeStyle = "rgba(255,0,124,0.95)";
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText("BURST: Hold → release near yellow mark.", 14, window.innerHeight - 20);
  }
                                           }
