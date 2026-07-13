// js/missions.js — kompatible Hülle um die bestehende Minigame-Bibliothek
//
// Alle bisherigen Minigames bleiben unverändert in missions_core.js. Nur der
// MIND SWEEPER wird hier ersetzt: mehr Denkzeit, sicherer erster Tap und ein
// Abschluss, der aus dem tatsächlichen Feldzustand statt einem fragilen Zähler
// berechnet wird.
export * from "./missions_core.js?v=22ec55a6";

import { game } from "./core.js?v=22ec55a6";
import { sfx } from "./sfx.js?v=22ec55a6";
import {
  createMinigame as createCoreMinigame,
  localPos,
  playRect
} from "./missions_core.js?v=22ec55a6";

const $ = (id) => document.getElementById(id);
const COUNT_COLORS = ["", "#00f3ff", "#7dff8a", "#ff5c8a", "#c792ff", "#ffcf5c", "#ff9628", "#ff3c3c", "#ffffff"];

function setHud(objective, timer, timeLimit, hint) {
  const objectiveEl = $("mHudObjective");
  if (objectiveEl) objectiveEl.textContent = objective;

  const timerEl = $("mHudTimer");
  if (timerEl) timerEl.textContent = `${Math.max(0, timeLimit - timer).toFixed(1)}s`;

  const hintEl = $("mHudAbility");
  if (hintEl) hintEl.textContent = hint;
}

function makeMindSweeper({ diff, mods, timeMult = 1, corrupt = false }) {
  const cols = 5;
  const rows = 5;
  const total = cols * rows;
  const trapCount = Math.min(9, 3 + Math.round(diff * 3) + (corrupt ? 2 : 0));
  const safeGoal = total - trapCount;

  // Ein Logikspiel braucht Denkzeit. Der alte Wert von ungefähr 14–22 Sekunden
  // war für 25 Felder faktisch ein Reflexspiel. Selbst DUNKEL-LAYER behalten
  // jetzt ein spielbares Minimum, ohne Zeit-Boni zu entwerten.
  const scaledTime = (40 - diff * 6 + mods.timeBonus + (corrupt ? 4 : 0)) * timeMult;
  let timeLimit = Math.max(28, scaledTime);

  const cells = [];
  let timer = 0;
  let misses = 0;
  let finished = false;
  let solved = false;
  let timerStarted = false;
  let firstPick = true;
  let forgiveLeft = mods.forgive;
  let flash = 0;

  function neighborIdxs(index) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const result = [];

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nextCol = col + dc;
        const nextRow = row + dr;
        if (nextCol < 0 || nextCol >= cols || nextRow < 0 || nextRow >= rows) continue;
        result.push(nextRow * cols + nextCol);
      }
    }
    return result;
  }

  function recalculateCounts() {
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      cell.count = cell.trap
        ? 0
        : neighborIdxs(i).filter((neighbor) => cells[neighbor].trap).length;
    }
  }

  function layout() {
    const rect = playRect();
    const size = Math.min((rect.x1 - rect.x0) / cols, (rect.y1 - rect.y0) / rows) * 0.86;
    const gridWidth = size * cols;
    const gridHeight = size * rows;
    const offsetX = rect.x0 + ((rect.x1 - rect.x0) - gridWidth) / 2;
    const offsetY = rect.y0 + ((rect.y1 - rect.y0) - gridHeight) / 2;

    const traps = new Set();
    while (traps.size < trapCount) traps.add(Math.floor(Math.random() * total));

    cells.length = 0;
    for (let i = 0; i < total; i++) {
      cells.push({
        x: offsetX + (i % cols) * size + size / 2,
        y: offsetY + Math.floor(i / cols) * size + size / 2,
        size,
        trap: traps.has(i),
        revealed: false,
        knownTrap: false,
        flashBad: 0,
        count: 0
      });
    }
    recalculateCounts();
  }

  function safeRevealed() {
    return cells.reduce((sum, cell) => sum + (!cell.trap && cell.revealed ? 1 : 0), 0);
  }

  function safeRemaining() {
    return cells.reduce((sum, cell) => sum + (!cell.trap && !cell.revealed ? 1 : 0), 0);
  }

  function updateSolvedState() {
    // Nicht der hochgezählte Wert entscheidet, sondern der reale Zustand des
    // Feldes. Damit endet das Spiel auch nach Flood-Fills und Assists zuverlässig.
    solved = cells.length > 0 && safeRemaining() === 0;
  }

  function revealFrom(startIndex) {
    const stack = [startIndex];
    const visited = new Set();

    while (stack.length) {
      const index = stack.pop();
      if (visited.has(index)) continue;
      visited.add(index);

      const cell = cells[index];
      if (!cell || cell.revealed || cell.trap) continue;
      cell.revealed = true;
      cell.knownTrap = false;

      if (cell.count === 0) {
        for (const neighbor of neighborIdxs(index)) {
          if (!cells[neighbor].trap && !cells[neighbor].revealed) stack.push(neighbor);
        }
      }
    }
    updateSolvedState();
  }

  function protectFirstPick(index) {
    const hit = cells[index];
    if (!firstPick || !hit?.trap) return;

    // Der erste Tap ist garantiert sicher. Die Mine wird auf ein anderes,
    // geschlossenes Feld verschoben und die Zahlen werden neu berechnet.
    const candidates = cells
      .map((cell, candidateIndex) => ({ cell, candidateIndex }))
      .filter(({ cell, candidateIndex }) => candidateIndex !== index && !cell.trap && !cell.revealed);

    const target = candidates[Math.floor(Math.random() * candidates.length)];
    if (!target) return;

    hit.trap = false;
    target.cell.trap = true;
    recalculateCounts();
  }

  function drawCorruptOverlay(ctx, rect) {
    if (!corrupt) return;
    if (Math.random() < 0.12) {
      ctx.fillStyle = "rgba(255,0,70,.07)";
      ctx.fillRect(0, Math.random() * rect.H, rect.W, 3 + Math.random() * 16);
    }
  }

  const debug = {
    type: "sweep",
    cells,
    get timer() { return timer; },
    get timeLimit() { return timeLimit; },
    get solved() { return solved; },
    get remaining() { return safeRemaining(); }
  };

  return {
    name: "MIND SWEEPER",
    debug,
    addTime(seconds) { timeLimit += seconds; },
    assist(kind) {
      if (kind === "reveal") {
        timerStarted = true;
        let opened = 0;
        for (let i = 0; i < cells.length && opened < 2; i++) {
          if (cells[i].revealed || cells[i].trap) continue;
          revealFrom(i);
          opened += 1;
        }
        return opened > 0;
      }
      if (kind === "forgive") {
        forgiveLeft += 1;
        return true;
      }
      return false;
    },
    start() {
      layout();
    },
    pointer(type, event) {
      if (type !== "down" || finished) return;
      const point = localPos(event);
      const index = cells.findIndex((cell) =>
        !cell.revealed
        && Math.abs(point.x - cell.x) < cell.size / 2
        && Math.abs(point.y - cell.y) < cell.size / 2
      );
      if (index < 0) {
        sfx.tap();
        return;
      }

      protectFirstPick(index);
      firstPick = false;
      timerStarted = true;
      const hit = cells[index];

      if (hit.trap) {
        // Eine bereits entdeckte Falle ist bekanntes Terrain. Wiederholtes
        // Tippen darf nicht erneut Fehler stapeln oder Sounds spammen.
        if (hit.knownTrap) {
          sfx.tap();
          return;
        }

        hit.knownTrap = true;
        hit.flashBad = 0.55;
        flash = 0.2;
        if (forgiveLeft > 0) {
          forgiveLeft -= 1;
          sfx.tap();
        } else {
          misses += 1;
          sfx.bad();
        }
        return;
      }

      revealFrom(index);
      sfx.pop();
    },
    tick(dt, paused, report) {
      const ctx = game.ctx.mission;
      const rect = playRect();
      if (!ctx) return;

      ctx.clearRect(0, 0, rect.W, rect.H);
      ctx.fillStyle = flash > 0 ? "rgba(255,30,60,.10)" : "rgba(0,0,0,.25)";
      ctx.fillRect(0, 0, rect.W, rect.H);
      if (flash > 0) flash -= dt;

      for (const cell of cells) {
        if (cell.flashBad > 0) cell.flashBad -= dt;

        const left = cell.x - cell.size / 2 + 2;
        const top = cell.y - cell.size / 2 + 2;
        const drawSize = cell.size - 4;

        if (cell.revealed) ctx.fillStyle = "rgba(0,243,255,.26)";
        else if (cell.knownTrap) ctx.fillStyle = "rgba(255,45,80,.20)";
        else if (cell.flashBad > 0) ctx.fillStyle = "rgba(255,60,60,.52)";
        else ctx.fillStyle = "rgba(255,255,255,.055)";
        ctx.fillRect(left, top, drawSize, drawSize);

        ctx.strokeStyle = cell.revealed
          ? "rgba(0,243,255,.72)"
          : (cell.knownTrap ? "rgba(255,60,90,.75)" : "rgba(255,255,255,.26)");
        ctx.lineWidth = cell.knownTrap ? 2.5 : 1.5;
        ctx.strokeRect(left, top, drawSize, drawSize);

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (cell.knownTrap && !cell.revealed) {
          ctx.fillStyle = "#ff3c5f";
          ctx.font = `900 ${Math.round(cell.size * 0.34)}px ui-monospace, monospace`;
          ctx.fillText("×", cell.x, cell.y + 1);
        } else if (cell.revealed && cell.count > 0) {
          ctx.fillStyle = COUNT_COLORS[cell.count] || "#fff";
          ctx.font = `900 ${Math.round(cell.size * 0.44)}px ui-monospace, monospace`;
          ctx.fillText(String(cell.count), cell.x, cell.y + 1);
        } else if (cell.revealed) {
          ctx.fillStyle = "rgba(0,243,255,.55)";
          ctx.beginPath();
          ctx.arc(cell.x, cell.y, cell.size * 0.07, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
      drawCorruptOverlay(ctx, rect);

      const revealed = safeRevealed();
      const hint = timerStarted
        ? "ZAHLEN = FALLEN IM UMKREIS · NUR SICHERE FELDER ÖFFNEN"
        : "ERSTER TAP IST SICHER · DANN LÄUFT DIE ZEIT";
      setHud(`${revealed} / ${safeGoal}`, timer, timeLimit, hint);

      if (paused || finished) return;
      if (timerStarted) timer += dt;
      updateSolvedState();

      if (solved) {
        finished = true;
        report({ success: true, score: safeGoal * 3, misses });
      } else if (timer >= timeLimit) {
        finished = true;
        report({ success: false, score: 0, misses });
      }
    }
  };
}

export function createMinigame(type, options) {
  const instance = type === "sweep"
    ? makeMindSweeper(options)
    : createCoreMinigame(type, options);

  // Gleicher Debug-Hook wie bisher, auch für die ersetzte Variante.
  window.__NEON_MG = instance.debug;
  return instance;
}
