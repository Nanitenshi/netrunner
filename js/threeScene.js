import { game } from "./core.js";

let canvas, ctx;
let t = 0;
let perfGetter = null;
let mood = 0;

export function initThree(c, getPerfMode) {
  canvas = c;
  ctx = canvas.getContext("2d", { alpha: true });
  perfGetter = getPerfMode;
  requestAnimationFrame(loop);
}

export function setPerfMode(mode) {
  // nothing needed here (core.js resizes DPR already)
}

export function setMoodProgress(p) {
  mood = Math.max(0, Math.min(1, p));
}

function loop() {
  if (!ctx) return;

  t += 0.016;

  // 2D “Night City” background render: very fast
  drawCity2D();

  requestAnimationFrame(loop);
}

function drawCity2D() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  ctx.clearRect(0,0,w,h);

  const isPerf = (perfGetter?.() === "perf");
  const layers = isPerf ? 4 : 6;

  // mood colors
  const day = { r: 10, g: 18, b: 32 };
  const dusk = { r: 30, g: 12, b: 42 };
  const night = { r: 5, g: 7, b: 10 };

  const c1 = lerpRGB(day, dusk, Math.min(1, mood*2));
  const c2 = lerpRGB(dusk, night, Math.max(0, (mood-0.5)*2));
  const sky = mixRGB(c1, c2, Math.max(0, (mood-0.5)*2));

  // sky gradient
  const grd = ctx.createLinearGradient(0,0,0,h);
  grd.addColorStop(0, `rgb(${sky.r},${sky.g},${sky.b})`);
  grd.addColorStop(1, `rgb(0,0,0)`);
  ctx.fillStyle = grd;
  ctx.fillRect(0,0,w,h);

  // parallax buildings
  for (let i=0; i<layers; i++) {
    const depth = i / (layers-1);
    const baseY = h * (0.35 + depth * 0.35);
    const scroll = (t * (10 + depth*30)) % 160;

    const count = isPerf ? 18 : 28;
    for (let b=0; b<count; b++) {
      const bw = 22 + (b*13 % 40) + depth*40;
      const bh = 50 + ((b*37) % 160) + depth*260;
      const x = ((b * 90) - scroll) % (w + 200) - 100;
      const y = baseY - bh;

      ctx.fillStyle = `rgba(10,16,24,${0.28 + depth*0.22})`;
      ctx.fillRect(x, y, bw, bh);

      // neon windows (cheap)
      if (!isPerf || (b%3===0)) {
        const neon = (b%2===0) ? "rgba(0,243,255,0.18)" : "rgba(255,0,124,0.14)";
        ctx.fillStyle = neon;
        for (let wy=0; wy<bh; wy+=18) {
          if ((wy + b*7) % 36 === 0) ctx.fillRect(x+4, y+wy+8, Math.max(2, bw-8), 2);
        }
      }
    }
  }

  // soft haze
  ctx.fillStyle = "rgba(0,243,255,0.03)";
  ctx.fillRect(0,0,w,h);
}

function lerp(a,b,t){ return a + (b-a)*t; }
function lerpRGB(a,b,t){
  return { r: Math.round(lerp(a.r,b.r,t)), g: Math.round(lerp(a.g,b.g,t)), b: Math.round(lerp(a.b,b.b,t)) };
}
function mixRGB(a,b,t){ return lerpRGB(a,b,t); }
