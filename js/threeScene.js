// js/threeScene.js
import { game } from "./core.js";

let canvas, ctx;
let t = 0;
let mood = 0;

let paused = false;
let dpr = 1;
let perf = true;

export function initThree(c, opts = { dpr: 1, perf: true }) {
  canvas = c;

  // desynchronized hilft auf manchen Android Tablets spürbar (weniger Jank)
  ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });

  setQuality(opts);
  requestAnimationFrame(loop);
}

export function setPaused(p) {
  paused = !!p;
}

export function setQuality(opts = {}) {
  if (!canvas || !ctx) return;

  if (typeof opts.dpr === "number") dpr = Math.max(1, Math.min(2, opts.dpr));
  if (typeof opts.perf === "boolean") perf = opts.perf;

  // Canvas in DevicePixelRatio rendern, aber in CSS-Pixel zeichnen
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);

  // Wichtig: danach in CSS Pixel zeichnen
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function setMoodProgress(p) {
  mood = Math.max(0, Math.min(1, p));
}

function loop() {
  if (!ctx) return;

  // Pause = Hintergrund weiterhin minimal redrawen? -> hier komplett stoppen
  if (!paused) {
    // dt ist nicht nötig, wir laufen stabil mit rAF
    t += 0.016;
    drawCity2D();
  }

  requestAnimationFrame(loop);
}

function drawCity2D() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  // Clear in CSS Pixel (ctx ist auf dpr transformiert)
  ctx.clearRect(0, 0, w, h);

  const layers = perf ? 3 : 5; // etwas aggressiver fürs Tablet
  const count = perf ? 14 : 22;

  // mood colors
  const day = { r: 10, g: 18, b: 32 };
  const dusk = { r: 30, g: 12, b: 42 };
  const night = { r: 5, g: 7, b: 10 };

  const c1 = lerpRGB(day, dusk, Math.min(1, mood * 2));
  const c2 = lerpRGB(dusk, night, Math.max(0, (mood - 0.5) * 2));
  const sky = mixRGB(c1, c2, Math.max(0, (mood - 0.5) * 2));

  // sky gradient
  const grd = ctx.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, `rgb(${sky.r},${sky.g},${sky.b})`);
  grd.addColorStop(1, `rgb(0,0,0)`);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);

  // parallax buildings
  for (let i = 0; i < layers; i++) {
    const depth = layers === 1 ? 0 : i / (layers - 1);
    const baseY = h * (0.38 + depth * 0.34);
    const scroll = (t * (10 + depth * 26)) % 160;

    for (let b = 0; b < count; b++) {
      const bw = 22 + ((b * 13) % 36) + depth * 34;
      const bh = 50 + ((b * 37) % 150) + depth * 240;

      const x = ((b * 95) - scroll) % (w + 240) - 120;
      const y = baseY - bh;

      ctx.fillStyle = `rgba(10,16,24,${0.26 + depth * 0.22})`;
      ctx.fillRect(x, y, bw, bh);

      // Neon windows (super billig)
      // Perf: nur jede 3. Säule, Quality: mehr
      if (!perf || (b % 3 === 0)) {
        const neon = (b % 2 === 0) ? "rgba(0,243,255,0.16)" : "rgba(255,0,124,0.12)";
        ctx.fillStyle = neon;

        const step = perf ? 22 : 18;
        for (let wy = 0; wy < bh; wy += step) {
          if (((wy + b * 7) % (step * 2)) === 0) ctx.fillRect(x + 5, y + wy + 10, Math.max(2, bw - 10), 2);
        }
      }
    }
  }

  // haze
  ctx.fillStyle = perf ? "rgba(0,243,255,0.02)" : "rgba(0,243,255,0.03)";
  ctx.fillRect(0, 0, w, h);
}

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpRGB(a, b, t) {
  return {
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t)),
  };
}
function mixRGB(a, b, t) { return lerpRGB(a, b, t); }
