// js/missions.js — Minigame-Bibliothek ("ICE-Typen"), orchestriert von dive.js
import { game } from "./core.js?v=11a32f07";
import { sfx } from "./sfx.js?v=11a32f07";

const $ = (id) => document.getElementById(id);

function localPos(e) {
  const c = game.canvases.mission;
  const r = c.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function playRect() {
  const W = window.innerWidth;
  const H = window.innerHeight;

  // Spielfläche beginnt unter dem (evtl. mehrzeiligen) Mission-HUD
  const hud = $("missionHud");
  let top = 170;
  if (hud && !hud.classList.contains("hidden")) {
    top = Math.max(120, hud.getBoundingClientRect().bottom + 34);
  }

  const margin = W < 600 ? 20 : 60;
  return { x0: margin, y0: top, x1: W - margin, y1: H - 150, W, H };
}

// Touch-freundliche Zielgröße relativ zum Screen
function baseRadius() {
  const minDim = Math.min(window.innerWidth, window.innerHeight);
  return Math.max(30, Math.min(42, minDim * 0.05));
}

function setHud(objective, timer, timeLimit, hint) {
  const o = $("mHudObjective");
  if (o) o.textContent = objective;

  const t = $("mHudTimer");
  if (t) t.textContent = `${Math.max(0, timeLimit - timer).toFixed(1)}s`;

  const a = $("mHudAbility");
  if (a) a.textContent = hint;
}

/* ---------------- Partikel (Juice) ---------------- */
const particles = [];

function burst(x, y, color, n = 14, speed = 220) {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.6);
    particles.push({
      x, y,
      vx: Math.cos(ang) * v,
      vy: Math.sin(ang) * v,
      life: 0.5 + Math.random() * 0.3,
      t: 0,
      color
    });
  }
}

function drawParticles(ctx, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += dt;
    if (p.t >= p.life) { particles.splice(i, 1); continue; }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.95;
    p.vy *= 0.95;

    ctx.globalAlpha = 1 - p.t / p.life;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

export function clearParticles() {
  particles.length = 0;
}

/* ---------------- Korruptions-Glitch (Overlay) ---------------- */
function drawGlitch(ctx, r) {
  // flackernde Störbalken
  if (Math.random() < 0.15) {
    ctx.fillStyle = "rgba(255,0,60,.07)";
    ctx.fillRect(0, Math.random() * r.H, r.W, 2 + Math.random() * 26);
  }
  if (Math.random() < 0.08) {
    ctx.fillStyle = "rgba(160,0,255,.05)";
    ctx.fillRect(Math.random() * r.W, 0, 2 + Math.random() * 14, r.H);
  }

  const pulse = 0.5 + Math.sin(performance.now() / 180) * 0.35;
  ctx.fillStyle = `rgba(255,40,80,${0.35 + pulse * 0.3})`;
  ctx.font = "bold 13px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText("⚠ KORRUMPIERT — LOOT x1.8", r.W / 2, r.y0 - 12);
  ctx.textAlign = "start";
}

/* ---------------- CACHE POP (Reflex, mit Köder-Fallen) ---------------- */
function makeCachePop({ diff, mods, timeMult = 1, corrupt = false }) {
  const objective = 14 + Math.round(diff * 8) + (corrupt ? 2 : 0);
  let timeLimit = (Math.max(6, 12 - diff * 2) + mods.timeBonus) * timeMult;
  const trapChance = corrupt ? 0.35 : (diff > 0.25 ? 0.22 : 0);
  const sizeMult = corrupt ? 0.85 : 1;

  const caches = [];
  let timer = 0, popped = 0, misses = 0, finished = false;
  let magnetUntil = -1;

  function spawn(forceTrap = null) {
    const r = playRect();
    const trap = forceTrap !== null ? forceTrap : Math.random() < trapChance;
    const rOuter = (52 + Math.random() * 20) * mods.ringScale * sizeMult;
    const spanX = Math.max(1, r.x1 - r.x0 - rOuter * 2);
    const spanY = Math.max(1, r.y1 - r.y0 - rOuter * 2);
    return {
      x: r.x0 + rOuter + Math.random() * spanX,
      y: r.y0 + rOuter + Math.random() * spanY,
      rOuter,
      rInner: (20 + Math.random() * 10) * mods.ringScale * sizeMult,
      pulse: Math.random() * Math.PI * 2,
      trap,
      alive: true
    };
  }

  const debug = { type: "cache", caches };

  return {
    name: "CACHE POP",
    debug,
    addTime(s) { timeLimit += s; },
    assist(kind) {
      if (kind === "reveal") {
        // 2 echte Caches automatisch poppen
        let n = 0;
        for (const c of caches) {
          if (!c.alive || c.trap || n >= 2) continue;
          c.alive = false;
          popped += 1;
          n += 1;
          burst(c.x, c.y, "#fcee0a");
          caches.push(spawn(false));
        }
        return n > 0;
      }
      if (kind === "magnet") {
        magnetUntil = timer + 6;
        return true;
      }
      return false;
    },
    start() {
      caches.length = 0;
      for (let i = 0; i < 6; i++) caches.push(spawn());
    },
    pointer(type, e) {
      if (type !== "down" || finished) return;
      const p = localPos(e);
      const mag = timer < magnetUntil ? 1.5 : 1;

      let best = null, bestD = 1e9;
      for (const c of caches) {
        if (!c.alive) continue;
        const d = Math.hypot(p.x - c.x, p.y - c.y);
        if (d >= (c.rInner - 14) * mag && d <= (c.rOuter + 14) * mag && d < bestD) { bestD = d; best = c; }
      }
      if (!best) { sfx.tap(); return; }

      best.alive = false;
      if (best.trap) {
        misses += 1;
        burst(best.x, best.y, "#ff3c3c");
        sfx.bad();
      } else {
        popped += 1;
        burst(best.x, best.y, "#00f3ff");
        sfx.pop();
      }
      caches.push(spawn());
    },
    tick(dt, paused, report) {
      const ctx = game.ctx.mission;
      const r = playRect();

      ctx.clearRect(0, 0, r.W, r.H);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, r.W, r.H);

      const mag = timer < magnetUntil ? 1.15 : 1;

      for (const c of caches) {
        if (!c.alive) continue;
        c.pulse += dt * 3;
        const wob = (1 + Math.sin(c.pulse) * 0.05) * mag;

        ctx.lineWidth = 6;
        ctx.strokeStyle = c.trap ? "rgba(255,80,60,0.9)" : "rgba(0,243,255,0.85)";
        ctx.beginPath(); ctx.arc(c.x, c.y, c.rOuter * wob, 0, Math.PI * 2); ctx.stroke();

        ctx.lineWidth = 4;
        ctx.strokeStyle = c.trap ? "rgba(255,150,60,0.8)" : "rgba(255,0,124,0.75)";
        ctx.beginPath(); ctx.arc(c.x, c.y, c.rInner, 0, Math.PI * 2); ctx.stroke();

        if (c.trap) {
          ctx.fillStyle = "rgba(255,90,60,.9)";
          ctx.font = "bold 15px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("✕", c.x, c.y);
          ctx.textAlign = "start";
          ctx.textBaseline = "alphabetic";
        }
      }
      drawParticles(ctx, dt);
      if (corrupt) drawGlitch(ctx, r);

      setHud(`${popped} / ${objective}`, timer, timeLimit, trapChance > 0 ? "RINGE POPPEN — ROTE MEIDEN!" : "TIPP AUF DIE RINGE");
      if (paused || finished) return;

      timer += dt;
      if (popped >= objective) {
        finished = true;
        report({ success: true, score: popped, misses });
      } else if (timer >= timeLimit) {
        finished = true;
        report({ success: false, score: 0, misses });
      }
    }
  };
}

/* ---------------- WIRE MATCH (Paare merken) ---------------- */
function makeWireMatch({ diff, mods, timeMult = 1, corrupt = false }) {
  const pairCount = Math.min(8, 5 + Math.round(diff * 3) + (corrupt ? 1 : 0));
  const peekTime = (1.6 + mods.peekBonus) * (corrupt ? 0.6 : 1);
  let timeLimit = (Math.max(12, 24 - diff * 6) + mods.timeBonus) * timeMult;

  const colors = ["#00f3ff", "#ff007c", "#fcee0a", "#7dff8a", "#ff9a3c", "#b083ff", "#3cd7ff", "#ff5c8a"];
  const tiles = [];
  let timer = 0, matched = 0, misses = 0, finished = false;
  let selection = [];
  let resolveAt = -1;
  let phase = "peek";
  let revealUntil = -1;

  function layout() {
    const r = playRect();
    const cols = 4;
    const rows = Math.ceil((pairCount * 2) / cols);
    const cw = (r.x1 - r.x0) / cols;
    const ch = (r.y1 - r.y0) / rows;

    const deck = [];
    for (let i = 0; i < pairCount; i++) { deck.push(colors[i]); deck.push(colors[i]); }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    tiles.length = 0;
    for (let i = 0; i < deck.length; i++) {
      tiles.push({
        x: r.x0 + cw * (i % cols) + cw / 2,
        y: r.y0 + ch * Math.floor(i / cols) + ch / 2,
        radius: Math.min(cw, ch) * 0.32,
        color: deck[i],
        revealed: true,
        matched: false
      });
    }
  }

  const debug = { type: "wires", tiles };

  return {
    name: "WIRE MATCH",
    debug,
    addTime(s) { timeLimit += s; },
    assist(kind) {
      if (kind === "reveal" && phase === "play") {
        revealUntil = timer + 1.2;
        return true;
      }
      return false;
    },
    start() { layout(); },
    pointer(type, e) {
      if (type !== "down" || finished || phase !== "play" || selection.length === 2) return;
      const p = localPos(e);

      const hit = tiles.find((t) => !t.matched && !t.revealed && Math.hypot(p.x - t.x, p.y - t.y) <= t.radius);
      if (!hit) { sfx.tap(); return; }

      hit.revealed = true;
      sfx.tap();
      selection.push(hit);
      if (selection.length === 2) resolveAt = timer + 0.45;
    },
    tick(dt, paused, report) {
      const ctx = game.ctx.mission;
      const r = playRect();

      ctx.clearRect(0, 0, r.W, r.H);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, r.W, r.H);

      const scanning = timer < revealUntil;

      for (const t of tiles) {
        const show = t.matched || t.revealed || scanning;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        if (show) {
          ctx.fillStyle = t.color;
          ctx.globalAlpha = (scanning && !t.revealed && !t.matched) ? 0.55 : 1;
          ctx.fill();
          ctx.globalAlpha = 1;
          if (t.matched) { ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.stroke(); }
        } else {
          ctx.fillStyle = "rgba(10,16,24,.9)";
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "rgba(0,243,255,.5)";
          ctx.stroke();
        }
      }
      drawParticles(ctx, dt);
      if (corrupt) drawGlitch(ctx, r);

      setHud(`${matched} / ${pairCount}`, timer, timeLimit, phase === "peek" ? "MERKEN…" : "FINDE DIE PAARE");
      if (paused || finished) return;

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
          matched += 1;
          burst(a.x, a.y, a.color, 10);
          burst(b.x, b.y, b.color, 10);
          sfx.good();
        } else {
          a.revealed = false; b.revealed = false;
          misses += 1;
          sfx.bad();
        }
        selection = [];
      }

      if (matched >= pairCount) {
        finished = true;
        report({ success: true, score: matched * 3, misses });
      } else if (timer >= timeLimit) {
        finished = true;
        report({ success: false, score: 0, misses });
      }
    }
  };
}

/* ---------------- BREACH SEQUENCE (Reihenfolge) ---------------- */
function makeBreachSequence({ diff, mods, timeMult = 1, corrupt = false }) {
  const total = 6 + Math.round(diff * 4);
  let timeLimit = (Math.max(8, 15 - diff * 3) + mods.timeBonus) * timeMult * (corrupt ? 0.9 : 1);
  const NUM_HIDE_AT = 3; // korrumpiert: Zahlen verschwinden nach 3s

  const targets = [];
  let timer = 0, next = 1, misses = 0, finished = false;
  let forgiveLeft = mods.forgive;
  let hintUntil = -1;

  function place() {
    const r = playRect();
    const radius = baseRadius();
    targets.length = 0;

    for (let i = 1; i <= total; i++) {
      let x, y, ok, tries = 0;
      do {
        x = r.x0 + radius + Math.random() * (r.x1 - r.x0 - radius * 2);
        y = r.y0 + radius + Math.random() * (r.y1 - r.y0 - radius * 2);
        ok = targets.every((t) => Math.hypot(t.x - x, t.y - y) > radius * 2.3);
        tries++;
      } while (!ok && tries < 50);

      targets.push({ n: i, x, y, radius, done: false, missFlash: 0 });
    }
  }

  const debug = { type: "breach", targets, get next() { return next; } };

  return {
    name: "BREACH SEQUENCE",
    debug,
    addTime(s) { timeLimit += s; },
    assist(kind) {
      if (kind === "forgive") { forgiveLeft += 1; return true; }
      if (kind === "reveal") { hintUntil = timer + 2.5; return true; }
      return false;
    },
    start() { place(); },
    pointer(type, e) {
      if (type !== "down" || finished) return;
      const p = localPos(e);
      const hit = targets.find((t) => !t.done && Math.hypot(p.x - t.x, p.y - t.y) <= t.radius);
      if (!hit) { sfx.tap(); return; }

      if (hit.n === next) {
        hit.done = true;
        next += 1;
        burst(hit.x, hit.y, "#7dff8a", 10);
        sfx.pop();
      } else if (forgiveLeft > 0) {
        forgiveLeft -= 1;
        hit.missFlash = 0.25;
        sfx.tap();
      } else {
        hit.missFlash = 0.25;
        misses += 1;
        sfx.bad();
      }
    },
    tick(dt, paused, report) {
      const ctx = game.ctx.mission;
      const r = playRect();

      ctx.clearRect(0, 0, r.W, r.H);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, r.W, r.H);

      const hinting = timer < hintUntil;

      for (const t of targets) {
        if (t.missFlash > 0) t.missFlash -= dt;

        const isNextThree = hinting && !t.done && t.n >= next && t.n < next + 3;

        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        ctx.fillStyle = t.done
          ? "rgba(120,255,140,.35)"
          : (t.missFlash > 0 ? "rgba(255,60,60,.55)" : (isNextThree ? "rgba(252,238,10,.25)" : "rgba(0,243,255,.18)"));
        ctx.fill();

        ctx.lineWidth = (t.n === next && !t.done) ? 4 : 2;
        ctx.strokeStyle = (t.n === next && !t.done)
          ? "rgba(255,255,255,.9)"
          : (isNextThree ? "rgba(252,238,10,.8)" : "rgba(0,243,255,.6)");
        ctx.stroke();

        // Korrumpiert: Zahlen verstecken sich nach kurzer Zeit (Reveal/Fehler zeigt sie)
        const numHidden = corrupt && timer > NUM_HIDE_AT && !t.done && !hinting && t.missFlash <= 0;
        ctx.fillStyle = numHidden ? "rgba(255,80,120,.8)" : "#fff";
        ctx.font = "bold 16px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(numHidden ? "?" : String(t.n), t.x, t.y);
      }
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
      drawParticles(ctx, dt);
      if (corrupt) drawGlitch(ctx, r);

      setHud(`${next - 1} / ${total}`, timer, timeLimit,
        corrupt && timer > NUM_HIDE_AT ? "ZAHLEN GEMERKT? DER REIHE NACH!" : `TIPPE 1→${total} DER REIHE NACH`);
      if (paused || finished) return;

      timer += dt;
      if (next > total) {
        finished = true;
        report({ success: true, score: total * 2, misses });
      } else if (timer >= timeLimit) {
        finished = true;
        report({ success: false, score: 0, misses });
      }
    }
  };
}

/* ---------------- PULSE LOCK (Timing) ---------------- */
function makePulseLock({ diff, mods, timeMult = 1, corrupt = false }) {
  const hits = 5 + Math.round(diff * 3);
  let timeLimit = (Math.max(9, 16 - diff * 3) + mods.timeBonus) * timeMult;

  let timer = 0, done = 0, misses = 0, finished = false;
  let angle = 0;
  const speedBase = (2.2 + diff * 1.6) * (corrupt ? 1.3 : 1);
  let speed = speedBase;
  let arcWidth = (0.9 - diff * 0.35) * (corrupt ? 0.8 : 1);
  let zoneStart = Math.random() * Math.PI * 2;
  let zoneShuffleAt = 2.5;
  let flash = 0, flashColor = "#7dff8a";
  let widenUntil = -1;

  function nextZone() {
    zoneStart = Math.random() * Math.PI * 2;
    speed = speedBase * (1 + done * 0.06);
    zoneShuffleAt = timer + 2.5;
  }

  function norm(a) {
    return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  }

  const debug = {
    type: "pulse",
    get angle() { return angle; },
    get zoneStart() { return zoneStart; },
    get arcWidth() { return arcWidth * (timer < widenUntil ? 1.7 : 1); },
    get done() { return done; }
  };

  return {
    name: "PULSE LOCK",
    debug,
    addTime(s) { timeLimit += s; },
    assist(kind) {
      if (kind === "reveal" || kind === "magnet") {
        widenUntil = timer + 5;
        return true;
      }
      return false;
    },
    start() { nextZone(); },
    pointer(type) {
      if (type !== "down" || finished) return;

      const w = arcWidth * (timer < widenUntil ? 1.7 : 1);
      const rel = norm(angle - zoneStart);
      if (rel <= w) {
        done += 1;
        flash = 0.25; flashColor = "#7dff8a";
        sfx.pop();
        nextZone();
      } else {
        misses += 1;
        flash = 0.25; flashColor = "#ff3c3c";
        sfx.bad();
      }
    },
    tick(dt, paused, report) {
      const ctx = game.ctx.mission;
      const r = playRect();

      ctx.clearRect(0, 0, r.W, r.H);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, r.W, r.H);

      const cx = r.W / 2;
      const cy = (r.y0 + r.y1) / 2;
      const radius = Math.min(r.x1 - r.x0, r.y1 - r.y0) * 0.32;
      const w = arcWidth * (timer < widenUntil ? 1.7 : 1);

      if (flash > 0) {
        flash -= dt;
        ctx.fillStyle = flashColor === "#7dff8a" ? "rgba(120,255,140,.08)" : "rgba(255,60,60,.10)";
        ctx.fillRect(0, 0, r.W, r.H);
      }

      // Basisring
      ctx.lineWidth = 10;
      ctx.strokeStyle = "rgba(0,243,255,.18)";
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Trefferzone
      ctx.lineWidth = 14;
      ctx.strokeStyle = timer < widenUntil ? "rgba(252,238,10,.85)" : "rgba(255,0,124,.8)";
      ctx.beginPath();
      ctx.arc(cx, cy, radius, zoneStart, zoneStart + w);
      ctx.stroke();

      // Läufer
      const mx = cx + Math.cos(angle) * radius;
      const my = cy + Math.sin(angle) * radius;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(mx, my, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,243,255,.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mx, my, 15, 0, Math.PI * 2);
      ctx.stroke();

      // Fortschritt in der Mitte
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.font = "bold 26px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${done}/${hits}`, cx, cy);
      ctx.font = "11px ui-monospace, monospace";
      ctx.fillStyle = "rgba(160,180,200,.8)";
      ctx.fillText("TIPP, WENN DER LÄUFER IN DER ZONE IST", cx, cy + 28);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";

      drawParticles(ctx, dt);
      if (corrupt) drawGlitch(ctx, r);

      setHud(`${done} / ${hits}`, timer, timeLimit, corrupt ? "ZONE SPRINGT — TIMING!" : "TIMING IST ALLES");
      if (paused || finished) return;

      timer += dt;
      angle = norm(angle + speed * dt);

      // Korrumpiert: Zone springt regelmäßig von selbst
      if (corrupt && timer >= zoneShuffleAt) nextZone();

      if (done >= hits) {
        finished = true;
        report({ success: true, score: hits * 3, misses });
      } else if (timer >= timeLimit) {
        finished = true;
        report({ success: false, score: 0, misses });
      }
    }
  };
}

/* ---------------- GHOST NET (geheimes Minigame: flackernde Ziele fangen) ---------------- */
function makeGhostNet({ diff, mods, timeMult = 1 }) {
  const objective = 7 + Math.round(diff * 3);
  let timeLimit = (Math.max(10, 16 - diff * 3) + mods.timeBonus) * timeMult;

  const ghosts = [];
  let timer = 0, caught = 0, misses = 0, finished = false;
  let revealUntil = -1, magnetUntil = -1;

  function spawn() {
    const r = playRect();
    const ang = Math.random() * Math.PI * 2;
    const sp = 50 + Math.random() * 70 + diff * 60;
    const rad = baseRadius() * 0.9;
    return {
      x: r.x0 + rad + Math.random() * Math.max(1, r.x1 - r.x0 - rad * 2),
      y: r.y0 + rad + Math.random() * Math.max(1, r.y1 - r.y0 - rad * 2),
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      r: rad,
      phase: Math.random() * Math.PI * 2,
      alive: true
    };
  }

  const debug = { type: "ghost", ghosts };

  return {
    name: "GHOST NET",
    debug,
    addTime(s) { timeLimit += s; },
    assist(kind) {
      if (kind === "reveal") { revealUntil = timer + 2.5; return true; }
      if (kind === "magnet") { magnetUntil = timer + 5; return true; }
      return false;
    },
    start() {
      ghosts.length = 0;
      for (let i = 0; i < 5; i++) ghosts.push(spawn());
    },
    pointer(type, e) {
      if (type !== "down" || finished) return;
      const p = localPos(e);
      const mag = timer < magnetUntil ? 1.4 : 1.15;

      const hit = ghosts.find((g) => g.alive && Math.hypot(p.x - g.x, p.y - g.y) <= g.r * mag);
      if (!hit) { sfx.tap(); return; }

      hit.alive = false;
      caught += 1;
      burst(hit.x, hit.y, "#b083ff");
      sfx.pop();
      ghosts.push(spawn());
    },
    tick(dt, paused, report) {
      const ctx = game.ctx.mission;
      const r = playRect();

      ctx.clearRect(0, 0, r.W, r.H);
      ctx.fillStyle = "rgba(4,0,12,0.45)";
      ctx.fillRect(0, 0, r.W, r.H);

      const revealed = timer < revealUntil;

      for (const g of ghosts) {
        if (!g.alive) continue;

        if (!paused && !finished) {
          g.x += g.vx * dt;
          g.y += g.vy * dt;
          if (g.x < r.x0 || g.x > r.x1) g.vx *= -1;
          if (g.y < r.y0 || g.y > r.y1) g.vy *= -1;
          g.phase += dt * 3;
        }

        // Geister flackern — mal fast unsichtbar, mal klar
        const alpha = revealed ? 0.95 : 0.15 + Math.max(0, Math.sin(g.phase)) * 0.55;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#b083ff";
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = Math.min(1, alpha + 0.2);
        ctx.strokeStyle = "#e2ccff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      drawParticles(ctx, dt);

      ctx.fillStyle = "rgba(176,131,255,.75)";
      ctx.font = "bold 13px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("??? GEHEIMES SIGNAL — LOOT x2", r.W / 2, r.y0 - 12);
      ctx.textAlign = "start";

      setHud(`${caught} / ${objective}`, timer, timeLimit, "FANG DIE GEISTER IM FLACKERN");
      if (paused || finished) return;

      timer += dt;
      if (caught >= objective) {
        finished = true;
        report({ success: true, score: caught * 3, misses });
      } else if (timer >= timeLimit) {
        finished = true;
        report({ success: false, score: 0, misses });
      }
    }
  };
}

/* ---------------- Boss-Helfer: HP-Leiste ---------------- */
function drawBossBar(ctx, r, name, fraction, big = false) {
  const w = Math.min(420, r.W * 0.6);
  const x = (r.W - w) / 2;
  const y = r.y0 - 26;

  ctx.fillStyle = big ? "rgba(255,40,80,.95)" : "rgba(255,120,60,.95)";
  ctx.font = `bold ${big ? 15 : 13}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`${big ? "⚠⚠" : "⚠"} ${name}`, r.W / 2, y - 8);
  ctx.textAlign = "start";

  ctx.fillStyle = "rgba(0,0,0,.6)";
  ctx.fillRect(x, y, w, 10);
  ctx.fillStyle = big ? "#ff2850" : "#ff7838";
  ctx.fillRect(x, y, w * Math.max(0, fraction), 10);
  ctx.strokeStyle = "rgba(255,255,255,.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, 10);
}

/* ---------------- ICE-WÄCHTER (Mini-Boss: wandernde Sequenz) ---------------- */
function makeBossGuard({ diff, mods, timeMult = 1 }) {
  const total = 8;
  let timeLimit = (17 + mods.timeBonus) * timeMult;

  const targets = [];
  let timer = 0, next = 1, misses = 0, finished = false;
  let forgiveLeft = mods.forgive;
  let hintUntil = -1;

  function place() {
    const r = playRect();
    const radius = baseRadius();
    targets.length = 0;

    for (let i = 1; i <= total; i++) {
      let x, y, ok, tries = 0;
      do {
        x = r.x0 + radius + Math.random() * (r.x1 - r.x0 - radius * 2);
        y = r.y0 + radius + Math.random() * (r.y1 - r.y0 - radius * 2);
        ok = targets.every((t) => Math.hypot(t.x - x, t.y - y) > radius * 2.3);
        tries++;
      } while (!ok && tries < 50);

      const ang = Math.random() * Math.PI * 2;
      const sp = 24 + Math.random() * 26 + diff * 20;
      targets.push({
        n: i, x, y, radius,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        done: false, missFlash: 0
      });
    }
  }

  const debug = { type: "boss_mini", targets, get next() { return next; } };

  return {
    name: "ICE-WÄCHTER",
    debug,
    addTime(s) { timeLimit += s; },
    assist(kind) {
      if (kind === "forgive") { forgiveLeft += 1; return true; }
      if (kind === "reveal") { hintUntil = timer + 2.5; return true; }
      return false;
    },
    start() { place(); },
    pointer(type, e) {
      if (type !== "down" || finished) return;
      const p = localPos(e);
      const hit = targets.find((t) => !t.done && Math.hypot(p.x - t.x, p.y - t.y) <= t.radius);
      if (!hit) { sfx.tap(); return; }

      if (hit.n === next) {
        hit.done = true;
        next += 1;
        burst(hit.x, hit.y, "#ff7838", 16);
        sfx.pop();
      } else if (forgiveLeft > 0) {
        forgiveLeft -= 1;
        hit.missFlash = 0.25;
        sfx.tap();
      } else {
        hit.missFlash = 0.25;
        misses += 1;
        sfx.bad();
      }
    },
    tick(dt, paused, report) {
      const ctx = game.ctx.mission;
      const r = playRect();

      ctx.clearRect(0, 0, r.W, r.H);
      ctx.fillStyle = "rgba(20,4,4,0.4)";
      ctx.fillRect(0, 0, r.W, r.H);

      const hinting = timer < hintUntil;

      for (const t of targets) {
        if (t.missFlash > 0) t.missFlash -= dt;

        if (!paused && !finished && !t.done) {
          t.x += t.vx * dt;
          t.y += t.vy * dt;
          if (t.x < r.x0 + t.radius || t.x > r.x1 - t.radius) t.vx *= -1;
          if (t.y < r.y0 + t.radius || t.y > r.y1 - t.radius) t.vy *= -1;
        }

        const isNextThree = hinting && !t.done && t.n >= next && t.n < next + 3;

        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        ctx.fillStyle = t.done
          ? "rgba(120,255,140,.3)"
          : (t.missFlash > 0 ? "rgba(255,60,60,.55)" : (isNextThree ? "rgba(252,238,10,.25)" : "rgba(255,120,60,.22)"));
        ctx.fill();

        ctx.lineWidth = (t.n === next && !t.done) ? 4 : 2;
        ctx.strokeStyle = (t.n === next && !t.done) ? "rgba(255,255,255,.9)" : "rgba(255,120,60,.7)";
        ctx.stroke();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(t.n), t.x, t.y);
      }
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
      drawParticles(ctx, dt);
      drawBossBar(ctx, r, "ICE-WÄCHTER", (total - next + 1) / total);

      setHud(`${next - 1} / ${total}`, timer, timeLimit, "DIE ZIELE WANDERN — 1→8!");
      if (paused || finished) return;

      timer += dt;
      if (next > total) {
        finished = true;
        report({ success: true, score: total * 3, misses });
      } else if (timer >= timeLimit) {
        finished = true;
        report({ success: false, score: 0, misses });
      }
    }
  };
}

/* ---------------- ICE-KERN PRIME (großer Boss: 3 Phasen) ---------------- */
function makeBossCore({ diff, mods, timeMult = 1 }) {
  let timeLimit = (28 + mods.timeBonus) * timeMult;

  let timer = 0, misses = 0, finished = false;
  let phase = 0; // 0: Kerne poppen, 1: Sequenz, 2: Puls
  let forgiveLeft = mods.forgive;

  // Phase 0: Kerne
  const cores = [];
  let popped = 0;
  const CORE_GOAL = 6;

  // Phase 1: Sequenz
  const seq = [];
  let next = 1;
  const SEQ_GOAL = 5;
  let hintUntil = -1;

  // Phase 2: Puls
  let angle = 0, pulseDone = 0;
  const PULSE_GOAL = 3;
  let speed = 3.0 + diff;
  let arcWidth = 0.7;
  let zoneStart = Math.random() * Math.PI * 2;
  let widenUntil = -1;

  function norm(a) { return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); }

  function placeCores() {
    const r = playRect();
    cores.length = 0;
    for (let i = 0; i < CORE_GOAL; i++) {
      cores.push({
        x: r.x0 + 60 + Math.random() * (r.x1 - r.x0 - 120),
        y: r.y0 + 60 + Math.random() * (r.y1 - r.y0 - 120),
        rOuter: 58, rInner: 24, pulse: Math.random() * 6,
        alive: true
      });
    }
  }

  function placeSeq() {
    const r = playRect();
    const radius = baseRadius();
    seq.length = 0;
    for (let i = 1; i <= SEQ_GOAL; i++) {
      let x, y, ok, tries = 0;
      do {
        x = r.x0 + radius + Math.random() * (r.x1 - r.x0 - radius * 2);
        y = r.y0 + radius + Math.random() * (r.y1 - r.y0 - radius * 2);
        ok = seq.every((t) => Math.hypot(t.x - x, t.y - y) > radius * 2.4);
        tries++;
      } while (!ok && tries < 50);
      seq.push({ n: i, x, y, radius, done: false, missFlash: 0 });
    }
  }

  const debug = {
    type: "boss_big",
    cores, seq,
    get phase() { return phase; },
    get next() { return next; },
    get angle() { return angle; },
    get zoneStart() { return zoneStart; },
    get arcWidth() { return arcWidth * (timer < widenUntil ? 1.6 : 1); }
  };

  return {
    name: "ICE-KERN PRIME",
    debug,
    addTime(s) { timeLimit += s; },
    assist(kind) {
      if (kind === "forgive") { forgiveLeft += 1; return true; }
      if (kind === "reveal") {
        if (phase === 0) {
          const c = cores.find((c) => c.alive);
          if (c) { c.alive = false; popped += 1; burst(c.x, c.y, "#fcee0a"); return true; }
        }
        if (phase === 1) { hintUntil = timer + 2.5; return true; }
        if (phase === 2) { widenUntil = timer + 5; return true; }
      }
      if (kind === "magnet") { widenUntil = timer + 5; return true; }
      return false;
    },
    start() { placeCores(); },
    pointer(type, e) {
      if (type !== "down" || finished) return;
      const p = localPos(e);

      if (phase === 0) {
        const hit = cores.find((c) => c.alive &&
          Math.hypot(p.x - c.x, p.y - c.y) >= c.rInner - 14 &&
          Math.hypot(p.x - c.x, p.y - c.y) <= c.rOuter + 14);
        if (!hit) { sfx.tap(); return; }
        hit.alive = false;
        popped += 1;
        burst(hit.x, hit.y, "#ff2850", 16);
        sfx.pop();
        if (popped >= CORE_GOAL) { phase = 1; placeSeq(); sfx.deeper(); }
        return;
      }

      if (phase === 1) {
        const hit = seq.find((t) => !t.done && Math.hypot(p.x - t.x, p.y - t.y) <= t.radius);
        if (!hit) { sfx.tap(); return; }
        if (hit.n === next) {
          hit.done = true;
          next += 1;
          burst(hit.x, hit.y, "#ff2850", 14);
          sfx.pop();
          if (next > SEQ_GOAL) { phase = 2; zoneStart = Math.random() * Math.PI * 2; sfx.deeper(); }
        } else if (forgiveLeft > 0) {
          forgiveLeft -= 1;
          hit.missFlash = 0.25;
          sfx.tap();
        } else {
          hit.missFlash = 0.25;
          misses += 1;
          sfx.bad();
        }
        return;
      }

      // Phase 2: Puls
      const w = arcWidth * (timer < widenUntil ? 1.6 : 1);
      const rel = norm(angle - zoneStart);
      if (rel <= w) {
        pulseDone += 1;
        sfx.pop();
        zoneStart = Math.random() * Math.PI * 2;
        speed *= 1.12;
      } else {
        misses += 1;
        sfx.bad();
      }
    },
    tick(dt, paused, report) {
      const ctx = game.ctx.mission;
      const r = playRect();

      ctx.clearRect(0, 0, r.W, r.H);
      ctx.fillStyle = "rgba(24,2,8,0.5)";
      ctx.fillRect(0, 0, r.W, r.H);

      const phaseNames = ["PHASE 1/3: KERNE POPPEN", "PHASE 2/3: SEQUENZ 1→5", "PHASE 3/3: PULS TREFFEN (3x)"];

      if (phase === 0) {
        for (const c of cores) {
          if (!c.alive) continue;
          c.pulse += dt * 3;
          const wob = 1 + Math.sin(c.pulse) * 0.06;
          ctx.lineWidth = 7;
          ctx.strokeStyle = "rgba(255,40,80,.9)";
          ctx.beginPath(); ctx.arc(c.x, c.y, c.rOuter * wob, 0, Math.PI * 2); ctx.stroke();
          ctx.lineWidth = 4;
          ctx.strokeStyle = "rgba(255,150,60,.8)";
          ctx.beginPath(); ctx.arc(c.x, c.y, c.rInner, 0, Math.PI * 2); ctx.stroke();
        }
      } else if (phase === 1) {
        const hinting = timer < hintUntil;
        for (const t of seq) {
          if (t.missFlash > 0) t.missFlash -= dt;
          const isNextThree = hinting && !t.done && t.n >= next && t.n < next + 3;

          ctx.beginPath();
          ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
          ctx.fillStyle = t.done
            ? "rgba(120,255,140,.3)"
            : (t.missFlash > 0 ? "rgba(255,60,60,.55)" : (isNextThree ? "rgba(252,238,10,.25)" : "rgba(255,40,80,.2)"));
          ctx.fill();
          ctx.lineWidth = (t.n === next && !t.done) ? 4 : 2;
          ctx.strokeStyle = (t.n === next && !t.done) ? "rgba(255,255,255,.9)" : "rgba(255,40,80,.7)";
          ctx.stroke();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 16px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(t.n), t.x, t.y);
        }
        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
      } else {
        const cx = r.W / 2;
        const cy = (r.y0 + r.y1) / 2;
        const radius = Math.min(r.x1 - r.x0, r.y1 - r.y0) * 0.3;
        const w = arcWidth * (timer < widenUntil ? 1.6 : 1);

        ctx.lineWidth = 10;
        ctx.strokeStyle = "rgba(255,40,80,.2)";
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();

        ctx.lineWidth = 14;
        ctx.strokeStyle = "rgba(255,40,80,.9)";
        ctx.beginPath(); ctx.arc(cx, cy, radius, zoneStart, zoneStart + w); ctx.stroke();

        const mx = cx + Math.cos(angle) * radius;
        const my = cy + Math.sin(angle) * radius;
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,.9)";
        ctx.font = "bold 24px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${pulseDone}/${PULSE_GOAL}`, cx, cy);
        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";

        if (!paused && !finished) angle = norm(angle + speed * dt);
      }

      drawParticles(ctx, dt);

      const progress = 1 - (phase + (phase === 0 ? popped / CORE_GOAL : phase === 1 ? (next - 1) / SEQ_GOAL : pulseDone / PULSE_GOAL)) / 3;
      drawBossBar(ctx, r, "ICE-KERN PRIME", progress, true);

      const objective = phase === 0 ? `${popped} / ${CORE_GOAL}` : phase === 1 ? `${next - 1} / ${SEQ_GOAL}` : `${pulseDone} / ${PULSE_GOAL}`;
      setHud(objective, timer, timeLimit, phaseNames[phase]);
      if (paused || finished) return;

      timer += dt;
      if (phase === 2 && pulseDone >= PULSE_GOAL) {
        finished = true;
        report({ success: true, score: 30, misses });
      } else if (timer >= timeLimit) {
        finished = true;
        report({ success: false, score: 0, misses });
      }
    }
  };
}

const FACTORY = {
  cache: makeCachePop,
  wires: makeWireMatch,
  breach: makeBreachSequence,
  pulse: makePulseLock,
  ghost: makeGhostNet,
  boss_mini: makeBossGuard,
  boss_big: makeBossCore
};

// Nur diese Typen werden zufällig für normale Layer gewürfelt
export const MG_TYPES = ["cache", "wires", "breach", "pulse"];

export function createMinigame(type, opts) {
  const f = FACTORY[type] || FACTORY.cache;
  const inst = f(opts);
  // Debug-/Test-Zugriff
  window.__NEON_MG = inst.debug;
  return inst;
}
