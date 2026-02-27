import { game } from "./core.js";
import { toast } from "./ui.js";

let mission = {
  active: false,
  type: "cache",
  nodeId: null,
  timer: 0,
  timeLimit: 12,
  score: 0,
  targets: [],
  lastSpawn: 0
};

export function startMission(type = "cache", nodeId = null) {
  mission.active = true;
  mission.type = type;
  mission.nodeId = nodeId;
  mission.timer = 0;
  mission.score = 0;
  mission.targets = [];
  mission.lastSpawn = 0;

  // HUD init
  setHud(`CACHE POP`, `0 / 20`, `${mission.timeLimit.toFixed(1)}s`, `0`, `—`);

  // Sofort 2 targets
  spawnTarget(); spawnTarget();
  toast("MISSION STARTED.");
}

export function handleMissionPointer(kind, e) {
  if (!mission.active) return;
  if (kind !== "down") return;

  const ctx = game.ctx.mission;
  const c = game.canvases.mission;
  if (!ctx || !c) return;

  const rect = c.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // hit test
  for (let i = mission.targets.length - 1; i >= 0; i--) {
    const t = mission.targets[i];
    const d = Math.hypot(x - t.x, y - t.y);
    if (d <= t.r) {
      mission.score += 1;
      mission.targets.splice(i, 1);
      toast("+1");
      break;
    }
  }
}

export function missionTick(dt, onFinish) {
  if (!mission.active) return;

  mission.timer += dt;
  mission.lastSpawn += dt;

  // spawn cadence (etwas schneller, aber capped)
  const spawnEvery = Math.max(0.28, 0.55 - game.globalProgress * 0.22);
  if (mission.lastSpawn >= spawnEvery) {
    mission.lastSpawn = 0;
    if (mission.targets.length < 6) spawnTarget();
  }

  drawMission();

  const remain = Math.max(0, mission.timeLimit - mission.timer);
  setHud(`CACHE POP`, `${mission.score} / 20`, `${remain.toFixed(1)}s`, `${mission.score}`, `—`);

  // finish conditions
  if (mission.score >= 20 || mission.timer >= mission.timeLimit) {
    mission.active = false;

    const gainedMoney = mission.score * 6;
    const gainedFrags = Math.max(1, Math.floor(mission.score / 2));

    const storyLine = (mission.score >= 20)
      ? `> Fragment secured. Nyx: "Sauber. Das war ein echter Slice."`
      : `> Partial dump. Ghost: "Nicht perfekt, aber brauchbar."`;

    const report = `Result: ${mission.score} caches\nPayout: E$ ${gainedMoney}\nFrags: +${gainedFrags}`;

    const resultData = {
      storyLine,
      report,
      apply: (g) => ({
        money: g.money + gainedMoney,
        frags: g.frags + gainedFrags,
        heat: Math.min(100, g.heat + 6)
      })
    };

    toast("MISSION COMPLETE.");
    onFinish(resultData);
  }
}

function spawnTarget() {
  const c = game.canvases.mission;
  if (!c) return;

  const pad = 60;
  const x = pad + Math.random() * (window.innerWidth - pad * 2);
  const y = pad + Math.random() * (window.innerHeight - pad * 2);
  const r = 26 + Math.random() * 10;

  mission.targets.push({ x, y, r, life: 1.0 });
}

function drawMission() {
  const ctx = game.ctx.mission;
  if (!ctx) return;

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // subtle vignette
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(0,0,window.innerWidth, window.innerHeight);

  // targets
  for (const t of mission.targets) {
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,243,255,0.9)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r * 0.55, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,0,124,0.65)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // center hint
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "12px ui-monospace, monospace";
  ctx.fillText("TIP: TAP THE CACHES", 16, window.innerHeight - 18);
}

function setHud(type, obj, timer, score, ability) {
  const a = document.getElementById("mHudType"); if (a) a.textContent = type;
  const b = document.getElementById("mHudObjective"); if (b) b.textContent = obj;
  const c = document.getElementById("mHudTimer"); if (c) c.textContent = timer;
  const d = document.getElementById("mHudScore"); if (d) d.textContent = score;
  const e = document.getElementById("mHudAbility"); if (e) e.textContent = ability;

  const box = document.getElementById("mHudTimerBox");
  if (box) box.classList.toggle("warnPulse", parseFloat(timer) <= 3.5);
}
