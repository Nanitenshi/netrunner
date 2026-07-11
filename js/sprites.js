// js/sprites.js — prozedurale Pixel-Art-Charaktere (16x22 Raster, Kreise/Rechtecke,
// automatisches Outline via Dilation) statt Freihand-Bitmaps. Läuft komplett auf Canvas,
// keine Bild-Assets nötig.

const W = 16;
const H = 22;

export const OUTLINE = "#05070a";

export const PALETTES = {
  player:   { id: "player",   hair: "#e8edf2", skin: "#e0b48c", jacket: "#12202c", jacketShadow: "#0a141c", pants: "#1b2a36", shoe: "#05080a", accent: "#fcee0a" },
  nyx:      { id: "nyx",      hair: "#00d9e8", skin: "#caa07a", jacket: "#161b22", jacketShadow: "#0c0f14", pants: "#20262e", shoe: "#05070a", accent: "#00f3ff" },
  ghost:    { id: "ghost",    hair: "#2a1030", skin: "#e6c2a6", jacket: "#2b0d20", jacketShadow: "#180712", pants: "#241018", shoe: "#05070a", accent: "#ff007c" },
  runner9:  { id: "runner9",  hair: "#dfe6ea", skin: "#8a6a52", jacket: "#1a2438", jacketShadow: "#0f1622", pants: "#232d3e", shoe: "#05070a", accent: "#7dc3ff" },
  iceVoice: { id: "iceVoice", hair: "#c7e6ff", skin: "#d8c8b8", jacket: "#1e2a33", jacketShadow: "#121a20", pants: "#26333d", shoe: "#05070a", accent: "#c8f0ff" },
  rust:     { id: "rust",     hair: "#5a3420", skin: "#b98058", jacket: "#3a2414", jacketShadow: "#231609", pants: "#2c1c10", shoe: "#05070a", accent: "#ff9628" },
  docK:     { id: "docK",     hair: "#454545", skin: "#caa47e", jacket: "#1a2e22", jacketShadow: "#0f1c15", pants: "#22362a", shoe: "#05070a", accent: "#7dff8a" },
  echo:     { id: "echo",     hair: "#1a0a24", skin: "#c9a98c", jacket: "#231030", jacketShadow: "#150a1e", pants: "#1c0f28", shoe: "#05070a", accent: "#b083ff" }
};

const CITIZEN_HAIR = ["#2a1f1a", "#4a3527", "#1a1a1a", "#6b4423", "#8a8a8a"];
const CITIZEN_SKIN = ["#caa07a", "#e0b48c", "#8a6a52", "#d8c8b8"];

export const DISTRICT_ACCENT = {
  neon: "#00f3ff", downtown: "#96aaff", corporate: "#d2ebff",
  industrial: "#ff9628", slums: "#8cdc6e", undercity: "#c85aff"
};

export function makeCitizenPalette(districtId, variant = 0) {
  return {
    id: `citizen_${districtId}_${variant}`,
    hair: CITIZEN_HAIR[variant % CITIZEN_HAIR.length],
    skin: CITIZEN_SKIN[(variant * 3) % CITIZEN_SKIN.length],
    jacket: "#232830",
    jacketShadow: "#151920",
    pants: "#1a1e24",
    shoe: "#05070a",
    accent: DISTRICT_ACCENT[districtId] || "#8aa0b3"
  };
}

function setCircle(grid, cx, cy, r, color) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) grid[y][x] = color;
    }
  }
}

function setRect(grid, x0, y0, w, h, color) {
  for (let y = y0; y < y0 + h; y++) {
    if (y < 0 || y >= H) continue;
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || x >= W) continue;
      grid[y][x] = color;
    }
  }
}

function buildFrame(dir, frame, pal) {
  const grid = Array.from({ length: H }, () => new Array(W).fill(null));
  const cx = 8;

  if (dir === "down" || dir === "up") {
    setCircle(grid, cx, 6.3, 4.6, pal.hair);
    if (dir === "down") {
      setCircle(grid, cx, 7.8, 4.0, pal.skin);
      setRect(grid, 5, 8, 6, 2, pal.accent);
    }
    setRect(grid, 6, 12, 4, 2, pal.skin);
    setRect(grid, 4, 14, 8, 6, pal.jacket);
    setRect(grid, 4, 14, 2, 6, pal.jacketShadow);
    setRect(grid, 2, 15, 2, 5, pal.jacket);
    setRect(grid, 12, 15, 2, 5, pal.jacket);
    setRect(grid, 2, 20, 2, 1, pal.skin);
    setRect(grid, 12, 20, 2, 1, pal.skin);

    const lx = frame === 0 ? 4 : 5, rx = frame === 0 ? 9 : 8;
    setRect(grid, lx, 20, 3, 2, pal.pants);
    setRect(grid, rx, 20, 3, 2, pal.pants);
    setRect(grid, lx, 21, 3, 1, pal.shoe);
    setRect(grid, rx, 21, 3, 1, pal.shoe);
  } else {
    // side, facing right (mirrored at draw-time for left)
    setCircle(grid, 7, 6.3, 4.6, pal.hair);
    setCircle(grid, 10, 7.6, 3.2, pal.skin);
    setRect(grid, 10, 7, 3, 2, pal.accent);
    setRect(grid, 7, 12, 3, 2, pal.skin);
    setRect(grid, 5, 14, 7, 6, pal.jacket);
    setRect(grid, 5, 14, 2, 6, pal.jacketShadow);
    setRect(grid, 10, 15, 2, 5, pal.jacket);
    setRect(grid, 10, 20, 2, 1, pal.skin);

    const fx = frame === 0 ? 10 : 9, bx = frame === 0 ? 5 : 6;
    setRect(grid, fx, 20, 3, 2, pal.pants);
    setRect(grid, bx, 20, 3, 2, pal.pants);
    setRect(grid, fx - 1, 21, 4, 1, pal.shoe);
    setRect(grid, bx - 1, 21, 4, 1, pal.shoe);
  }

  // Outline: dilate the silhouette by 1px, keep only the newly-added rim
  const outline = Array.from({ length: H }, () => new Array(W).fill(false));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!grid[y][x]) continue;
      const nbrs = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      for (const [nx, ny] of nbrs) {
        if (nx >= 0 && nx < W && ny >= 0 && ny < H && !grid[ny][nx]) outline[ny][nx] = true;
      }
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (outline[y][x]) { ctx.fillStyle = OUTLINE; ctx.fillRect(x, y, 1, 1); }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x]) { ctx.fillStyle = grid[y][x]; ctx.fillRect(x, y, 1, 1); }
    }
  }

  return canvas;
}

const cache = {};

export function getSprites(pal) {
  if (cache[pal.id]) return cache[pal.id];
  const set = {
    down: [buildFrame("down", 0, pal), buildFrame("down", 1, pal)],
    up: [buildFrame("up", 0, pal), buildFrame("up", 1, pal)],
    side: [buildFrame("side", 0, pal), buildFrame("side", 1, pal)]
  };
  cache[pal.id] = set;
  return set;
}

export function facingToDir(angle) {
  const a = Math.atan2(Math.sin(angle), Math.cos(angle));
  if (a >= -Math.PI / 4 && a < Math.PI / 4) return { dir: "side", mirror: false };
  if (a >= Math.PI / 4 && a < (3 * Math.PI) / 4) return { dir: "down", mirror: false };
  if (a >= -(3 * Math.PI) / 4 && a < -Math.PI / 4) return { dir: "up", mirror: false };
  return { dir: "side", mirror: true };
}

// screenX/screenY = Fußpunkt (Boden-Mitte) des Charakters
export function drawCharacterAt(ctx, screenX, screenY, scale, dir, mirror, frameCanvas) {
  const w = W * scale, h = H * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (mirror) {
    ctx.translate(screenX, screenY);
    ctx.scale(-1, 1);
    ctx.drawImage(frameCanvas, -w / 2, -h, w, h);
  } else {
    ctx.drawImage(frameCanvas, screenX - w / 2, screenY - h, w, h);
  }
  ctx.restore();
}

export const SPRITE_W = W;
export const SPRITE_H = H;
