import { game } from "./core.js";
import { toast } from "./ui.js";
import { getSelected } from "./world.js";

let m = null;
let dragging = false;
let lastPos = { x: 0, y: 0 };
let dist = 0;
let pointerId = null;

function rand(a, b) { return a + Math.random() * (b - a); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export function startMission() {
  const node = getSelected();
  if (!node) return;

  // Typen rotieren
  const types = ["TRACE", "SHARD_HUNT", "DRIFT_RUN"];
  const type = node.type === "boss" ? "BOSS_TRACE" : types[game.missionsDone % types.length];

  // Schwierigkeit und Zeit basierend auf Fortschritt und Upgrades
  const baseTime = 18 + (game.upgrades?.buffer || 0) * 2;
  const difficulty = 1 + game.missionsDone * 0.08 + (node.type === "boss" ? 0.8 : 0);

  m = {
    type,
    t: baseTime,
    score: 0,
    objective: 0,
    objectiveMax: 0,
    difficulty,
    hitBonus: (game.upgrades?.amplifier || 0) * 6,
    slowActive: false,
    slowLeft: 0,
    slowCooldown: 0,
    nodes: [],
    trail: [],
    particles: [], // Für Treffer-Feedback
    ended: false   // Wichtig, um mehrfache Callbacks zu verhindern
  };

  const w = window.innerWidth;
  const h = window.innerHeight;
  const safeMargin = 80;

  // --- MISSION: TRACE (Finde die richtigen Daten, meide rotes ICE) ---
  if (type === "TRACE" || type === "BOSS_TRACE") {
    m.objectiveMax = type === "BOSS_TRACE" ? 16 : 12;
    for (let i = 0; i < m.objectiveMax + 8; i++) { // +8 für Fallen/Gold
      m.nodes.push({
        x: rand(safeMargin, w - safeMargin),
        y: rand(safeMargin + 60, h - safeMargin),
        r: type === "BOSS_TRACE" ? 18 : 16,
        hit: false,
        fade: 1, // Für Pop-Animation
        kind: (Math.random() < 0.25) ? "ICE" : (Math.random() < 0.15 ? "GOLD" : "DATA"),
      });
    }
  } 
  // --- MISSION: SHARD HUNT (Finde den versteckten Shard unter Dummies) ---
  else if (type === "SHARD_HUNT") {
    m.objectiveMax = 8;
    for (let i = 0; i < 16; i++) {
      m.nodes.push({
        x: rand(safeMargin, w - safeMargin),
        y: rand(safeMargin + 60, h - safeMargin),
        r: 15,
        hit: false,
        fade: 1,
        kind: (i < m.objectiveMax) ? "SHARD" : "DECOY"
      });
    }
    m.nodes.sort(() => Math.random() - 0.5); // Durchmischen
  } 
  // --- MISSION: DRIFT RUN (Treffe Tore in der richtigen Reihenfolge/Höhe) ---
  else if (type === "DRIFT_RUN") {
    m.objectiveMax = 10;
    const spacingY = (h - 260) / Math.max(1, m.objectiveMax - 1);
    for (let i = 0; i < m.objectiveMax; i++) {
      m.nodes.push({
        x: rand(safeMargin, w - safeMargin),
        y: 130 + (i * spacingY),
        r: 22,
        hit: false,
        fade: 1,
        kind: "GATE"
      });
    }
  }

  toast(`MISSION TYPE: ${m.type}`);
  return m;
}

export function missionTick(dt, onEnd) {
  if (!m || m.ended) return;

  const ctx = game.ctx.mission;
  const w = window.innerWidth, h = window.innerHeight;
  
  // Background Wipe
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(0,0,0,0.45)"; // Etwas dunkler für besseren Kontrast
  ctx.fillRect(0, 0, w, h);

  // --- TIME HANDLING ---
  const slowFactor = m.slowActive ? 0.35 : 1.0;
  m.t -= dt * slowFactor;

  if (m.slowCooldown > 0) m.slowCooldown -= dt;
  if (m.slowActive) {
    m.slowLeft -= dt;
    if (m.slowLeft <= 0) m.slowActive = false;
  }

  // Scanner Band für DRIFT_RUN
  let bandY = -100;
  if (m.type === "DRIFT_RUN") {
    bandY = (performance.now() * 0.12) % (h + 100);
    ctx.fillStyle = "rgba(255,0,124,0.15)";
    ctx.fillRect(0, bandY, w, 60);
    ctx.strokeStyle = "rgba(255,0,124,0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, bandY, w, 60);
  }

  const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.006);

  // --- RENDER NODES ---
  for (let i = m.nodes.length - 1; i >= 0; i--) {
    const n = m.nodes[i];
    
    // Treffer-Animation (ausblenden und wachsen)
    if (n.hit) {
      n.fade -= dt * 4;
      n.r += dt * 30;
      if (n.fade <= 0) {
        m.nodes.splice(i, 1); // Komplett löschen, wenn Animation fertig
        continue;
      }
    }

    let col = "rgba(0,243,255,0.9)";
    if (n.kind === "ICE") col = "rgba(255,0,124,0.9)";
    if (n.kind === "GOLD") col = "rgba(252,238,10,0.9)";
    if (n.kind === "SHARD") col = "rgba(182,0,255,0.9)";
    if (n.kind === "DECOY") col = "rgba(160,170,180,0.55)";
    if (n.kind === "GATE") col = "rgba(0,243,255,0.9)";

    const radius = n.hit ? n.r : n.r * (0.8 + pulse * 0.2);
    
    ctx.globalAlpha = n.fade;
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    
    ctx.beginPath();
    ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.globalAlpha = n.fade * 0.2;
    ctx.fillStyle = col;
    ctx.fill();
    ctx.globalAlpha = 1.0; // Reset
  }

  // --- TRAIL (Maus-Spur) ---
  if (m.trail.length > 1) {
    ctx.strokeStyle = "rgba(255,0,124,0.8)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    ctx.beginPath();
    ctx.moveTo(m.trail[0].x, m.trail[0].y);
    for (let i = 1; i < m.trail.length; i++) {
      ctx.lineTo(m.trail[i].x, m.trail[i].y);
    }
    ctx.stroke();
  }

  // Trail abbauen, wenn nicht mehr gezogen wird
  if (!dragging && m.trail.length > 0) {
    m.trail.shift(); // Vorne abschneiden
    m.trail.shift(); // Doppelt so schnell abbauen
  }

  // --- END BEDINGUNG ---
  if (m.t <= 0 || m.objective >= m.objectiveMax) {
    m.ended = true; // Blockiert weitere Updates
    const win = (m.objective >= m.objectiveMax);
    
    // Kurze Verzögerung, damit man den letzten Treffer sieht
    setTimeout(() => {
      const resultData = calculateResult(win);
      const callback = onEnd;
      m = null;
      callback(resultData);
    }, 400);
  }
}

function calculateResult(win) {
  const basePay = 120 + Math.floor(game.missionsDone * 18);
  const pay = win ? Math.floor(basePay * (1 + m.difficulty * 0.12)) : 0;

  const fragGain = win && (Math.random() < 0.45) ? 1 : 0;
  const heatGain = win ? Math.floor(8 + m.difficulty * 4) : 6;

  return {
    win,
    pay,
    fragGain,
    heatGain,
    type: m.type,
    score: m.score,
    objective: m.objective,
    objectiveMax: m.objectiveMax,
    storyTag: fragGain > 0 ? "FRAGMENT RECOVERED" : "—",
    
    // Diese Funktion wird in core.js aufgerufen: Object.assign(game, result.apply(game))
    apply: (g) => {
      return {
        money: g.money + pay,
        frags: g.frags + fragGain,
        heat: clamp(g.heat + heatGain, 0, 100),
        // missionsDone wird in core.js erhöht
      };
    }
  };
}

export function handleMissionPointer(type, e) {
  const canvas = game.canvases.mission;
  if (!m || m.ended) return;

  if (type === "down") {
    e.preventDefault();
    pointerId = e.pointerId;
    canvas.setPointerCapture(pointerId);
    dragging = true;
    lastPos = { x: e.clientX, y: e.clientY };
    dist = 0;
    
    m.trail = []; // Trail zurücksetzen
    m.trail.push({ x: e.clientX, y: e.clientY });

    // Active Ability: Pulse (Oben links tippen)
    if (game.upgrades?.pulse > 0 && m.slowCooldown <= 0) {
      if (e.clientX < 100 && e.clientY < 150) {
        m.slowActive = true;
        m.slowLeft = 3.0;
        m.slowCooldown = 12;
        toast("ABILITY: TIME DILATION ACTIVE");
        return; // Verhindert, dass das Tippen auf den Button als Hit zählt
      }
    }
    
    hitTest(e.clientX, e.clientY);
    return;
  }

  if (type === "move") {
    if (!dragging) return;
    const dx = e.clientX - lastPos.x, dy = e.clientY - lastPos.y;
    dist += Math.hypot(dx, dy);
    lastPos = { x: e.clientX, y: e.clientY };

    m.trail.push({ x: e.clientX, y: e.clientY });
    if (m.trail.length > 30) m.trail.shift();

    hitTest(e.clientX, e.clientY);
    return;
  }

  if (type === "up" || type === "cancel") {
    dragging = false;
    try { canvas.releasePointerCapture(pointerId); } catch {}
    
    if (type === "up" && dist < 15) {
      hitTest(e.clientX, e.clientY);
    }
    return;
  }
}

function hitTest(sx, sy) {
  if (!m || m.ended) return;
  const bonus = m.hitBonus;
  
  for (const n of m.nodes) {
    if (n.hit) continue;
    
    const hitR = n.r + 20 + bonus; // Großzügige Touch-Hitbox
    if (Math.hypot(sx - n.x, sy - n.y) <= hitR) {
      n.hit = true;

      if (n.kind === "ICE") {
        m.t -= 2.5; // Strafe
        toast("WARNING: ICE ENCOUNTERED", true);
      } else if (n.kind === "GOLD") {
        m.t += 1.5;
        m.score += 80;
      } else if (n.kind === "DECOY") {
        m.t -= 1.0;
      } else {
        m.score += 50;
        m.objective++; // Ziel erreicht!
      }

      // Drift Run: Scanner-Band Strafe
      if (m.type === "DRIFT_RUN") {
        const bandY = (performance.now() * 0.12) % (window.innerHeight + 100);
        if (sy > bandY && sy < bandY + 60) {
          m.t -= 1.5;
          toast("CAUGHT IN SCANNER!", true);
        }
      }
    }
  }
}

export function getMissionState() {
  return m;
  }
                                          
