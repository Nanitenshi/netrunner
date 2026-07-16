// js/minigameRules.js — gemeinsame Fairness- und Belohnungsregeln
// Denkspiele scheitern nicht mehr am Countdown. Ihre Uhr misst nur Leistung;
// drei Fehler (+ Vergebungsboni) beenden den Layer. Reflexspiele behalten Zeitdruck.

export const THINKING_TYPES = new Set(["wires", "breach", "echo", "sweep"]);

const THINKING_PAR = { wires: 30, breach: 20, echo: 46, sweep: 48 };
const MAX_SPEED_BONUS = { thinking: 0.20, reflex: 0.30 };

const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;

function reflexWindow(type, options) {
  const diff = clamp(num(options?.diff));
  const timeBonus = Math.max(0, num(options?.mods?.timeBonus));
  const timeMult = Math.max(0.25, num(options?.timeMult, 1));
  const base = {
    cache: Math.max(6, 12 - diff * 2),
    pulse: Math.max(9, 16 - diff * 3),
    trace: Math.max(10, 17 - diff * 3),
    stream: Math.max(16, 24 - diff * 2),
    ghost: Math.max(10, 16 - diff * 3),
    boss_mini: 17,
    boss_big: 28
  }[type] ?? 16;
  return Math.max(4, (base + timeBonus) * timeMult);
}

function thinkingPar(type, options) {
  const diff = clamp(num(options?.diff));
  const timeMult = Math.max(0.5, num(options?.timeMult, 1));
  const corruptFactor = options?.corrupt ? 1.12 : 1;
  return (THINKING_PAR[type] ?? 30) * (1 + diff * 0.22) * corruptFactor * timeMult;
}

function localPoint(event, game) {
  const canvas = game?.canvases?.mission;
  if (!canvas || !event) return null;
  const rect = canvas.getBoundingClientRect();
  return { x: num(event.clientX) - rect.left, y: num(event.clientY) - rect.top };
}

function hitCircle(point, target) {
  if (!point || !target) return false;
  const radius = num(target.radius, num(target.rOuter));
  return Math.hypot(point.x - target.x, point.y - target.y) <= radius;
}

function panelIndex(point, rect) {
  if (!point || !rect) return -1;
  if (point.x < rect.x0 || point.x >= rect.x1 || point.y < rect.y0 || point.y >= rect.y1) return -1;
  const midX = (rect.x0 + rect.x1) / 2;
  const midY = (rect.y0 + rect.y1) / 2;
  return (point.x >= midX ? 1 : 0) + (point.y >= midY ? 2 : 0);
}

function ensurePerformanceLine() {
  let line = document.getElementById("dcPerformance");
  if (line?.isConnected) return line;
  const anchor = document.getElementById("dcBossHint");
  if (!anchor?.parentElement) return null;
  line = document.createElement("div");
  line.id = "dcPerformance";
  line.className = "muted small yellowText";
  line.style.margin = "6px 0";
  line.setAttribute("aria-live", "polite");
  anchor.insertAdjacentElement("afterend", line);
  return line;
}

function showPerformance(perf) {
  window.setTimeout(() => {
    const line = ensurePerformanceLine();
    if (!line) return;
    const parts = [perf.speedPercent > 0 ? `TEMPO +${perf.speedPercent}%` : "TEMPO: BASISLOOT"];
    if (perf.perfect) parts.push("FEHLERFREI +15%");
    parts.push(`${perf.elapsed.toFixed(1)}s`);
    line.textContent = `LEISTUNG // ${parts.join(" · ")}`;
  }, 0);
}

export function applyMinigameRules(instance, type, options, helpers) {
  if (!instance) return instance;

  const game = helpers?.game;
  const playRect = helpers?.playRect;
  const thinking = THINKING_TYPES.has(type);
  const category = thinking ? "thinking" : "reflex";

  const originalStart = instance.start?.bind(instance);
  const originalPointer = instance.pointer?.bind(instance);
  const originalTick = instance.tick?.bind(instance);
  const originalAddTime = instance.addTime?.bind(instance);
  const originalAssist = instance.assist?.bind(instance);

  let elapsed = 0;
  let graceSeconds = 0;
  let started = false;
  let finished = false;
  let pendingFailure = false;
  let errors = 0;
  let errorLimit = Math.max(1, 3 + Math.round(num(options?.mods?.forgive)));

  let wireSelection = [];
  let wireLockedUntil = 0;
  let echoIndex = 0;
  let lastEchoPhase = instance.debug?.phase;
  let sweepFirstPick = true;

  const effectiveElapsed = () => Math.max(0, elapsed - graceSeconds);

  function registerError() {
    if (!thinking || pendingFailure || finished) return;
    errors += 1;
    if (errors >= errorLimit) pendingFailure = true;
  }

  function inspectThinkingPointer(event) {
    const debug = instance.debug;
    const point = localPoint(event, game);
    if (!debug || !point) return;

    if (type === "wires") {
      if (performance.now() < wireLockedUntil) return;
      const tile = debug.tiles?.find((t) => !t.matched && !t.revealed && hitCircle(point, t));
      if (!tile) return;
      started = true;
      wireSelection.push(tile.color);
      if (wireSelection.length === 2) {
        if (wireSelection[0] !== wireSelection[1]) registerError();
        wireSelection = [];
        wireLockedUntil = performance.now() + 520;
      }
      return;
    }

    if (type === "breach") {
      const next = num(debug.next, 1);
      const target = debug.targets?.find((t) => !t.done && hitCircle(point, t));
      if (!target) return;
      started = true;
      if (num(target.n) !== next) registerError();
      return;
    }

    if (type === "echo") {
      if (debug.phase !== "play") return;
      const hit = panelIndex(point, typeof playRect === "function" ? playRect() : null);
      if (hit < 0) return;
      started = true;
      const sequence = debug.sequence || [];
      if (hit === sequence[echoIndex]) {
        echoIndex += 1;
        if (echoIndex >= sequence.length) echoIndex = 0;
      } else {
        registerError();
        echoIndex = 0;
      }
      return;
    }

    if (type === "sweep") {
      const cell = debug.cells?.find((c) => !c.revealed
        && Math.abs(point.x - c.x) < c.size / 2
        && Math.abs(point.y - c.y) < c.size / 2);
      if (!cell) return;
      started = true;
      if (sweepFirstPick) {
        sweepFirstPick = false;
        return;
      }
      if (cell.trap && !cell.knownTrap) registerError();
    }
  }

  function decorateHud() {
    if (!thinking) return;
    const timer = document.getElementById("mHudTimer");
    if (timer) timer.textContent = `${effectiveElapsed().toFixed(1)}s`;
    const timerBox = document.getElementById("mHudTimerBox");
    if (timerBox) timerBox.title = "Leistungszeit — kein automatisches Scheitern";
    const hint = document.getElementById("mHudAbility");
    if (hint) {
      const clean = String(hint.textContent || "").replace(/\s*·\s*FEHLER\s+\d+\s*\/\s*\d+.*$/i, "");
      hint.textContent = `${clean} · FEHLER ${errors}/${errorLimit}`;
    }
  }

  function enrich(result) {
    const measured = effectiveElapsed();
    const perfect = num(result?.misses) === 0;
    const maxBonus = MAX_SPEED_BONUS[category];
    const speedFactor = thinking
      ? clamp((thinkingPar(type, options) - measured) / (thinkingPar(type, options) * 0.67))
      : clamp((reflexWindow(type, options) - measured) / reflexWindow(type, options));
    const speedBonus = maxBonus * speedFactor;
    // dive.js gibt perfekt bereits x1.12; der Korrekturfaktor ergibt zusammen x1.15.
    const precisionCorrection = perfect ? 1.15 / 1.12 : 1;
    const scoreFactor = (1 + speedBonus) * precisionCorrection;
    return {
      ...result,
      score: num(result?.score) * scoreFactor,
      performance: {
        category,
        elapsed: measured,
        errors,
        errorLimit: thinking ? errorLimit : null,
        speedBonus,
        speedPercent: Math.round(speedBonus * 100),
        perfect,
        scoreFactor
      }
    };
  }

  instance.start = (...args) => {
    elapsed = 0;
    graceSeconds = 0;
    errors = 0;
    pendingFailure = false;
    finished = false;
    wireSelection = [];
    wireLockedUntil = 0;
    echoIndex = 0;
    sweepFirstPick = true;
    started = !thinking;
    return originalStart?.(...args);
  };

  instance.pointer = (pointerType, event) => {
    if (finished || pendingFailure) return;
    if (thinking && pointerType === "down") inspectThinkingPointer(event);
    return originalPointer?.(pointerType, event);
  };

  instance.addTime = (seconds) => {
    const amount = Math.max(0, num(seconds));
    if (thinking) graceSeconds += amount;
    else originalAddTime?.(amount);
  };

  instance.assist = (kind) => {
    const used = originalAssist?.(kind) ?? false;
    if (thinking && used && kind === "forgive") errorLimit += 1;
    return used;
  };

  instance.tick = (dt, paused, report) => {
    if (finished) return;

    if (pendingFailure) {
      finished = true;
      report({
        success: false,
        score: 0,
        misses: errors,
        reason: "ERROR_LIMIT",
        performance: { category, elapsed: effectiveElapsed(), errors, errorLimit, speedBonus: 0, speedPercent: 0, perfect: false, scoreFactor: 1 }
      });
      return;
    }

    if (!paused && started) elapsed += Math.max(0, num(dt));
    if (thinking && !paused) originalAddTime?.(Math.max(0, num(dt)) + 0.02);

    const wrappedReport = (result) => {
      if (finished) return;
      finished = true;
      if (!result?.success) {
        report(result);
        return;
      }
      const enriched = enrich(result);
      window.__NEON_LAST_PERFORMANCE = enriched.performance;
      showPerformance(enriched.performance);
      report(enriched);
    };

    originalTick?.(dt, paused, wrappedReport);

    if (type === "echo") {
      const phase = instance.debug?.phase;
      if (phase !== lastEchoPhase) {
        if (phase === "play") echoIndex = 0;
        lastEchoPhase = phase;
      }
    }
    decorateHud();
  };

  instance.debug = instance.debug || {};
  instance.debug.rules = {
    category,
    get elapsed() { return effectiveElapsed(); },
    get errors() { return errors; },
    get errorLimit() { return thinking ? errorLimit : null; },
    get pendingFailure() { return pendingFailure; }
  };

  return instance;
}
