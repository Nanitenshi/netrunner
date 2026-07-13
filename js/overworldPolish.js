// js/overworldPolish.js — mobile-first visual and usability pass for Night City.
// Runs as a separate overlay so the core world renderer stays untouched.

const FX_ID = "worldFxCanvas";
const INTRO_ID = "districtIntro";
const STYLE_ID = "overworld-polish-style";

const DISTRICTS = [
  { id: "neon", name: "NEON-VIERTEL", x: 0, y: 0, accent: "0,243,255", weather: "rain" },
  { id: "downtown", name: "INNENSTADT", x: 950, y: -150, accent: "150,170,255", weather: "rain" },
  { id: "corporate", name: "KONZERNBEZIRK", x: 1750, y: -700, accent: "220,235,255", weather: "scan" },
  { id: "industrial", name: "INDUSTRIEGEBIET", x: 750, y: 950, accent: "255,150,60", weather: "smoke" },
  { id: "slums", name: "SLUMS", x: -850, y: 750, accent: "140,220,110", weather: "dust" },
  { id: "undercity", name: "UNDERCITY", x: -250, y: 1550, accent: "190,90,255", weather: "glitch" }
];

const ARASAKA = { x: 1750, y: -700 };
const rain = [];
const motes = [];
let canvas = null;
let ctx = null;
let dpr = 1;
let lastTime = performance.now();
let currentDistrict = null;
let introTimer = 0;
let initialZoomApplied = false;

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${FX_ID} {
      position: absolute;
      inset: 0;
      z-index: 6;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    #${INTRO_ID} {
      position: absolute;
      left: 50%;
      top: clamp(112px, 17vh, 160px);
      z-index: 18;
      transform: translate(-50%, -10px);
      min-width: min(330px, 76vw);
      padding: 8px 16px;
      border-top: 1px solid rgba(var(--district-accent, 0,243,255), .7);
      border-bottom: 1px solid rgba(var(--district-accent, 0,243,255), .35);
      background: linear-gradient(90deg, transparent, rgba(5,9,14,.84) 18%, rgba(5,9,14,.84) 82%, transparent);
      color: rgba(var(--district-accent, 0,243,255), .95);
      font: 900 13px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      text-align: center;
      letter-spacing: 3px;
      opacity: 0;
      pointer-events: none;
      transition: opacity .22s ease, transform .22s ease;
      text-shadow: 0 0 14px rgba(var(--district-accent, 0,243,255), .55);
    }

    #${INTRO_ID}.show {
      opacity: 1;
      transform: translate(-50%, 0);
    }

    @media (max-width: 900px) {
      #bottomBar {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        align-items: stretch;
        gap: 7px;
      }

      #bottomBar #commsTicker {
        grid-column: 1 / -1;
        min-width: 0;
        width: 100%;
        padding: 8px 11px;
        font-size: 11px;
        line-height: 1.25;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #bottomBar #btnNodes,
      #bottomBar #btnCrew,
      #bottomBar #btnPause {
        width: 100%;
        min-width: 0;
        padding: 10px 6px;
      }

      #bottomBar #btnMusic,
      #bottomBar #btnQuality,
      #bottomBar #btnSave {
        display: none !important;
      }

      #hudTop .hudStats {
        gap: 5px 12px;
        padding: 8px 12px;
      }

      #hudTop .hudMeta {
        flex-basis: 100%;
        width: 100%;
        margin-left: 0;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #hudTop .banner {
        padding: 10px 13px;
        font-size: 12px;
      }
    }
  `;
  document.head.appendChild(style);
}

function compactMobileControls() {
  const nodes = document.getElementById("btnNodes");
  const crew = document.getElementById("btnCrew");
  if (nodes) nodes.textContent = "MAP";
  if (crew) crew.textContent = "CREW";
}

function createOverlay() {
  const host = document.getElementById("canvas-container");
  if (!host) return false;

  canvas = document.getElementById(FX_ID);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = FX_ID;
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
  }
  ctx = canvas.getContext("2d");

  let intro = document.getElementById(INTRO_ID);
  if (!intro) {
    intro = document.createElement("div");
    intro.id = INTRO_ID;
    intro.setAttribute("aria-live", "polite");
    document.getElementById("ui")?.appendChild(intro);
  }

  resize();
  seedParticles();
  return true;
}

function resize() {
  if (!canvas || !ctx) return;
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function seedParticles() {
  rain.length = 0;
  motes.length = 0;
  const rainCount = window.innerWidth <= 900 ? 38 : 62;
  const moteCount = window.innerWidth <= 900 ? 18 : 28;

  for (let i = 0; i < rainCount; i++) {
    rain.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      len: 8 + Math.random() * 18,
      speed: 260 + Math.random() * 330,
      drift: -45 - Math.random() * 45,
      alpha: 0.08 + Math.random() * 0.16
    });
  }

  for (let i = 0; i < moteCount; i++) {
    motes.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: -8 + Math.random() * 16,
      vy: -6 - Math.random() * 12,
      r: 0.8 + Math.random() * 1.8,
      phase: Math.random() * Math.PI * 2
    });
  }
}

function isWorldVisible() {
  const hud = document.getElementById("hudTop");
  const world = document.getElementById("worldCanvas");
  return !!hud && !hud.classList.contains("hidden") && world?.style.display !== "none";
}

function getCam() {
  try {
    return typeof window.__NEON_CAM === "function" ? window.__NEON_CAM() : null;
  } catch {
    return null;
  }
}

function preferredBaseZoom() {
  if (window.innerWidth <= 600) return 0.84;
  if (window.innerWidth <= 900) return 0.76;
  return 0.68;
}

function applyInitialZoom() {
  if (initialZoomApplied) return;
  const cam = getCam();
  if (!cam) return;
  if (Math.abs(cam.zoom - 0.62) < 0.03) cam.zoom = preferredBaseZoom();
  initialZoomApplied = true;
}

function bindFocusZoom() {
  const btn = document.getElementById("btnFocus");
  if (!btn || btn.dataset.polishZoomBound) return;
  btn.dataset.polishZoomBound = "1";

  const normalize = () => setTimeout(() => {
    const cam = getCam();
    if (!cam) return;
    if (Math.abs(cam.zoom - 0.62) < 0.04) cam.zoom = preferredBaseZoom();
    else if (Math.abs(cam.zoom - 1.05) < 0.06) cam.zoom = window.innerWidth <= 900 ? 1.18 : 1.12;
  }, 0);

  btn.addEventListener("pointerup", normalize, { passive: true });
  btn.addEventListener("click", normalize, { passive: true });
}

function nearestDistrict(cam) {
  let best = DISTRICTS[0];
  let bestD = Infinity;
  for (const district of DISTRICTS) {
    const d = Math.hypot(cam.x - district.x, cam.y - district.y);
    if (d < bestD) {
      best = district;
      bestD = d;
    }
  }
  return best;
}

function showDistrictIntro(district) {
  const intro = document.getElementById(INTRO_ID);
  if (!intro) return;
  intro.textContent = `// ${district.name} //`;
  intro.style.setProperty("--district-accent", district.accent);
  intro.classList.add("show");
  introTimer = 2.2;
}

function worldToScreen(wx, wy, cam) {
  return {
    x: window.innerWidth / 2 + (wx - cam.x) * cam.zoom,
    y: window.innerHeight / 2 + (wy - cam.y) * cam.zoom
  };
}

function drawArasakaBeacon(cam, time) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const p = worldToScreen(ARASAKA.x, ARASAKA.y, cam);
  const safe = { left: 26, right: W - 26, top: 105, bottom: H - 112 };
  const onScreen = p.x >= safe.left && p.x <= safe.right && p.y >= safe.top && p.y <= safe.bottom;
  const pulse = 0.55 + Math.sin(time * 2.2) * 0.2;

  if (onScreen) {
    const beamH = Math.min(190, Math.max(70, p.y - safe.top));
    const beam = ctx.createLinearGradient(p.x, p.y, p.x, p.y - beamH);
    beam.addColorStop(0, `rgba(255,38,55,${0.22 + pulse * 0.18})`);
    beam.addColorStop(1, "rgba(255,38,55,0)");
    ctx.fillStyle = beam;
    ctx.fillRect(p.x - 2, p.y - beamH, 4, beamH);

    ctx.fillStyle = "rgba(255,70,82,.9)";
    ctx.font = "900 10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("ARASAKA", p.x, p.y - beamH - 7);
    ctx.textAlign = "start";
    return;
  }

  const dx = p.x - W / 2;
  const dy = p.y - H / 2;
  const angle = Math.atan2(dy, dx);
  const ex = Math.max(safe.left, Math.min(safe.right, W / 2 + Math.cos(angle) * 10000));
  const ey = Math.max(safe.top, Math.min(safe.bottom, H / 2 + Math.sin(angle) * 10000));

  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(angle);
  ctx.fillStyle = `rgba(255,55,70,${0.55 + pulse * 0.35})`;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-7, -6);
  ctx.lineTo(-7, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const distance = Math.max(0, Math.round(Math.hypot(cam.x - ARASAKA.x, cam.y - ARASAKA.y) / 10));
  ctx.fillStyle = "rgba(255,100,110,.78)";
  ctx.font = "800 9px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`ARASAKA · ${distance}m`, ex, ey + 17);
  ctx.textAlign = "start";
}

function drawRain(dt, accent) {
  ctx.lineWidth = 1;
  for (const drop of rain) {
    drop.x += drop.drift * dt;
    drop.y += drop.speed * dt;
    if (drop.y > window.innerHeight + 30 || drop.x < -30) {
      drop.x = Math.random() * (window.innerWidth + 80);
      drop.y = -30 - Math.random() * 100;
    }
    ctx.strokeStyle = `rgba(${accent},${drop.alpha})`;
    ctx.beginPath();
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(drop.x + drop.drift * 0.035, drop.y + drop.len);
    ctx.stroke();
  }
}

function drawMotes(dt, accent, mode, time) {
  for (const mote of motes) {
    mote.x += mote.vx * dt;
    mote.y += mote.vy * dt;
    if (mote.y < -10 || mote.x < -10 || mote.x > window.innerWidth + 10) {
      mote.x = Math.random() * window.innerWidth;
      mote.y = window.innerHeight + 10;
    }

    const pulse = 0.35 + Math.sin(time * 1.6 + mote.phase) * 0.2;
    const alpha = mode === "dust" ? 0.12 + pulse * 0.12 : 0.08 + pulse * 0.1;
    ctx.fillStyle = `rgba(${accent},${alpha})`;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDistrictAtmosphere(district, dt, time) {
  const W = window.innerWidth;
  const H = window.innerHeight;

  if (district.weather === "rain") drawRain(dt, district.accent);
  if (district.weather === "dust" || district.weather === "smoke") drawMotes(dt, district.accent, district.weather, time);

  if (district.weather === "scan") {
    const y = ((time * 42) % (H + 120)) - 60;
    const scan = ctx.createLinearGradient(0, y - 28, 0, y + 28);
    scan.addColorStop(0, "rgba(220,235,255,0)");
    scan.addColorStop(0.5, "rgba(220,235,255,.055)");
    scan.addColorStop(1, "rgba(220,235,255,0)");
    ctx.fillStyle = scan;
    ctx.fillRect(0, y - 28, W, 56);
  }

  if (district.weather === "glitch" && Math.random() < 0.05) {
    const y = Math.random() * H;
    ctx.fillStyle = "rgba(190,90,255,.08)";
    ctx.fillRect(0, y, W, 1 + Math.random() * 5);
  }

  const edge = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.72);
  edge.addColorStop(0, "rgba(0,0,0,0)");
  edge.addColorStop(1, `rgba(${district.accent},.045)`);
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, W, H);
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!ctx || !canvas) return;

  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  applyInitialZoom();
  bindFocusZoom();

  if (!isWorldVisible()) return;
  const cam = getCam();
  if (!cam) return;

  const district = nearestDistrict(cam);
  if (district.id !== currentDistrict) {
    currentDistrict = district.id;
    showDistrictIntro(district);
  }

  if (introTimer > 0) {
    introTimer -= dt;
    if (introTimer <= 0) document.getElementById(INTRO_ID)?.classList.remove("show");
  }

  drawDistrictAtmosphere(district, dt, now / 1000);
  drawArasakaBeacon(cam, now / 1000);
}

function init() {
  installStyles();
  compactMobileControls();
  if (!createOverlay()) return;

  window.addEventListener("resize", () => {
    resize();
    seedParticles();
  }, { passive: true });

  // Register after the core boot listener so this overlay paints on top.
  setTimeout(() => requestAnimationFrame(frame), 0);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
