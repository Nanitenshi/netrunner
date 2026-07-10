// js/missions.js
import { game } from "./core.js";
import { toast } from "./ui.js";

let paused = false;
let current = null;

export function missionSetPaused(p) { paused = !!p; }
export function missionCancelPointer() {}

function localPos(e) {
  const c = game.canvases.mission;
  const r = c.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function playRect() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  return { x0: 60, y0: 140, x1: W - 60, y1: H - 120, W, H };
}

function setHud(type, objective, timer, timeLimit, score, ability) {
  const t = document.getElementById("mHudType");
  if (t) t.textContent = type;

  const o = document.getElementById("mHudObjective");
  if (o) o.textContent = objective;

  const s = document.getElementById("mHudScore");
  if (s) s.textContent = String(score);

  const timerEl = document.getElementById("mHudTimer");
  if (timerEl) timerEl.textContent = `${Math.max(0, timeLimit - timer).toFixed(1)}s`;

  const a = document.getElementById("mHudAbility");
  if (a) a.textContent = ability;
}

function difficulty() {
  return Math.min(1, game.missionsDone / 10);
}

/* ---------------- CACHE POP (reflex) ---------------- */
function makeCachePop() {
  const diff = difficulty();
  const objective = 16 + Math.round(diff * 6);
  const timeLimit = 12 - diff * 2;

  const caches = [];
  let timer = 0, score = 0, popped = 0;

  function spawn() {
    const r = playRect();
    return {
      x: r.x0 + Math.random() * (r.x1 - r.x0),
      y: r.y0 + Math.random() * (r.y1 - r.y0),
      rOuter: 56 + Math.random() * 20,
      rInner: 22 + Math.random() * 10,
      alive: true
    };
  }

  return {
    start() {
      caches.length = 0;
      for (let i = 0; i < 6; i++) caches.push(spawn());
      toast("MISSION START: CACHE POP");
    },
    pointer(type, e) {
      if (type !== "down") return;
      const p = localPos(e);
      let best = null, bestD = 1e9;

      for (const c of caches) {
        if (!c.alive) continue;
        const d = Math.hypot(p.x - c.x, p.y - c.y);
        const ringMin = c.rInner - 12, ringMax = c.rOuter + 12;
        if (d >= ringMin && d <= ringMax && d < bestD) { bestD = d; best = c; }
      }
      if (!best) return;

      best.alive = false;
      score += 1;
      popped += 1;
      caches.push(spawn());
      toast("CACHE POP!");
    },
    tick(dt, isPaused, finish) {
      const ctx = game.ctx.mission;
      const r = playRect();

      ctx.clearRect(0, 0, r.W, r.H);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, r.W, r.H);

      for (const c of caches) {
        if (!c.alive) continue;
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(0,243,255,0.85)";
        ctx.beginPath(); ctx.arc(c.x, c.y, c.rOuter, 0, Math.PI * 2); ctx.stroke();

        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(255,0,124,0.75)";
        ctx.beginPath(); ctx.arc(c.x, c.y, c.rInner, 0, Math.PI * 2); ctx.stroke();
      }

      setHud("CACHE POP", `${popped} / ${objective}`, timer, timeLimit, score, "TAP THE RINGS");
      if (isPaused) return;

      timer += dt;
      if (popped >= objective || timer >= timeLimit) {
        finish({
          apply: (g) => ({
            money: g.money + score * 3,
            frags: g.frags + score,
            heat: Math.min(100, g.heat + 6)
          })
        });
        toast(`MISSION COMPLETE: +${score} FRAGS`);
      }
    }
  };
}

/* ---------------- WIRE MATCH (memory pairs) ---------------- */
function makeWireMatch() {
  const diff = difficulty();
  const pairCount = 5 + Math.round(diff * 2);
  const peekTime = 1.6;
  const timeLimit = 26 - diff * 4;

  const colors = ["#00f3ff", "#ff007c", "#fcee0a", "#7dff8a", "#ff9a3c", "#b083ff", "#3cd7ff", "#ff5c8a"];
  const tiles = [];
  let timer = 0, score = 0, matched = 0;
  let selection = [];
  let resolveAt = -1;
  let phase = "peek";

  function layout() {
    const r = playRect();
    const cols = 4;
    const rows = Math.ceil((pairCount * 2) / cols);
    const cw = (r.x1 - r.x0) / cols;
    const ch = (r.y1 - r.y0) / rows;

    const deck = [];
    for (let i = 0; i < pairCount; i++) { deck.push(colors[i % colors.length]); deck.push(colors[i % colors.length]); }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    tiles.length = 0;
    for (let i = 0; i < deck.length; i++) {
      const cx = i % cols, cy = Math.floor(i / cols);
      tiles.push({
        x: r.x0 + cw * cx + cw / 2,
        y: r.y0 + ch * cy + ch / 2,
        radius: Math.min(cw, ch) * 0.32,
        color: deck[i],
        revealed: true,
        matched: false
      });
    }
  }

  return {
    start() {
      layout();
      timer = 0; score = 0; matched = 0; selection = []; resolveAt = -1; phase = "peek";
      toast("MISSION START: WIRE MATCH");
    },
    pointer(type, e) {
      if (type !== "down" || phase !== "play" || selection.length === 2) return;
      const p = localPos(e);

      const hit = tiles.find((t) => !t.matched && !t.revealed && Math.hypot(p.x - t.x, p.y - t.y) <= t.radius);
      if (!hit) return;

      hit.revealed = true;
      selection.push(hit);
      if (selection.length === 2) resolveAt = timer + 0.5;
    },
    tick(dt, isPaused, finish) {
      const ctx = game.ctx.mission;
      const r = playRect();

      ctx.clearRect(0, 0, r.W, r.H);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, r.W, r.H);

      for (const t of tiles) {
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        if (t.matched || t.revealed) {
          ctx.fillStyle = t.color;
          ctx.fill();
          if (t.matched) { ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.stroke(); }
        } else {
          ctx.fillStyle = "rgba(10,16,24,.9)";
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "rgba(0,243,255,.5)";
          ctx.stroke();
        }
      }

      setHud("WIRE MATCH", `${matched} / ${pairCount}`, timer, timeLimit, score, phase === "peek" ? "MERKEN…" : "FINDE DIE PAARE");
      if (isPaused) return;

      timer += dt;

      if (phase === "peek") {
        if (timer >= peekTime) {
          phase = "play";
          for (const t of tiles) t.revealed = false;
        }
      } else if (selection.length === 2 && timer >= resolveAt) {
        const [a, b] = selection;
        if (a.color === b.color) {
          a.matched = true; b.matched = true;
          matched += 1; score += 2;
        } else {
          a.revealed = false; b.revealed = false;
        }
        selection = [];
      }

      if (matched >= pairCount || timer >= timeLimit) {
        finish({
          apply: (g) => ({
            money: g.money + score * 3,
            frags: g.frags + score,
            heat: Math.min(100, g.heat + 5)
          })
        });
        toast(`MISSION COMPLETE: +${score} FRAGS`);
      }
    }
  };
}

/* ---------------- BREACH SEQUENCE (ordered taps) ---------------- */
function makeBreachSequence() {
  const diff = difficulty();
  const total = 6 + Math.round(diff * 3);
  const timeLimit = 16 - diff * 2;

  const targets = [];
  let timer = 0, score = 0, next = 1, misses = 0;

  function place() {
    const r = playRect();
    targets.length = 0;

    for (let i = 1; i <= total; i++) {
      let x, y, ok, tries = 0;
      do {
        x = r.x0 + 30 + Math.random() * (r.x1 - r.x0 - 60);
        y = r.y0 + 30 + Math.random() * (r.y1 - r.y0 - 60);
        ok = targets.every((t) => Math.hypot(t.x - x, t.y - y) > 70);
        tries++;
      } while (!ok && tries < 30);

      targets.push({ n: i, x, y, radius: 28, done: false, missFlash: 0 });
    }
  }

  return {
    start() {
      place();
      timer = 0; score = 0; next = 1; misses = 0;
      toast("MISSION START: BREACH SEQUENCE");
    },
    pointer(type, e) {
      if (type !== "down") return;
      const p = localPos(e);
      const hit = targets.find((t) => !t.done && Math.hypot(p.x - t.x, p.y - t.y) <= t.radius);
      if (!hit) return;

      if (hit.n === next) {
        hit.done = true;
        score += 1;
        next += 1;
      } else {
        hit.missFlash = 0.25;
        misses += 1;
        toast("FALSCHE REIHENFOLGE!");
      }
    },
    tick(dt, isPaused, finish) {
      const ctx = game.ctx.mission;
      const r = playRect();

      ctx.clearRect(0, 0, r.W, r.H);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, r.W, r.H);

      for (const t of targets) {
        if (t.missFlash > 0) t.missFlash -= dt;

        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        ctx.fillStyle = t.done ? "rgba(120,255,140,.35)" : (t.missFlash > 0 ? "rgba(255,60,60,.55)" : "rgba(0,243,255,.18)");
        ctx.fill();

        ctx.lineWidth = (t.n === next && !t.done) ? 4 : 2;
        ctx.strokeStyle = (t.n === next && !t.done) ? "rgba(255,255,255,.9)" : "rgba(0,243,255,.6)";
        ctx.stroke();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(t.n), t.x, t.y);
      }
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";

      setHud("BREACH SEQUENCE", `${score} / ${total}`, timer, timeLimit, score, `TAP 1→${total}`);
      if (isPaused) return;

      timer += dt;
      if (next > total || timer >= timeLimit) {
        finish({
          apply: (g) => ({
            money: g.money + score * 4,
            frags: g.frags + score,
            heat: Math.min(100, g.heat + 9 + misses)
          })
        });
        toast(`MISSION COMPLETE: +${score} FRAGS`);
      }
    }
  };
}

const FACTORY = { cache: makeCachePop, wires: makeWireMatch, breach: makeBreachSequence };

export function startMission(type = "cache") {
  const factory = FACTORY[type] || FACTORY.cache;
  current = factory();
  current.start();
}

export function handleMissionPointer(type, e) {
  if (!current || paused) return;
  current.pointer(type, e);
}

export function missionTick(dt, onFinish) {
  if (!current) return;
  current.tick(dt, paused, (resultData) => {
    current = null;
    onFinish(resultData);
  });
}
