// js/hudPolish.js — clearer resource feedback without touching game balance.

const STYLE_ID = "hud-polish-style";
let previous = null;
let timer = null;

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes resourceGain {
      0% { transform: scale(1); filter: brightness(1); }
      45% { transform: scale(1.18); filter: brightness(1.9); }
      100% { transform: scale(1); filter: brightness(1); }
    }

    @keyframes resourceLoss {
      0% { transform: translateX(0); }
      30% { transform: translateX(-3px); }
      60% { transform: translateX(3px); }
      100% { transform: translateX(0); }
    }

    .resourceGain { animation: resourceGain .42s ease-out; }
    .resourceLoss { animation: resourceLoss .3s ease-out; }

    #hudHeat.heatWarn,
    #hudHeat.heatCritical {
      color: #ff7b45;
      text-shadow: 0 0 12px rgba(255,90,35,.65);
    }

    #hudHeat.heatCritical {
      color: #ff3c3c;
      animation: pulseDangerText .7s infinite alternate;
    }

    @media (prefers-reduced-motion: reduce) {
      .resourceGain, .resourceLoss, #hudHeat.heatCritical { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
}

function pulse(id, direction) {
  const el = document.getElementById(id);
  if (!el) return;
  const cls = direction > 0 ? "resourceGain" : "resourceLoss";
  el.classList.remove("resourceGain", "resourceLoss");
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 500);
}

function state() {
  const game = window.__NEON?.game;
  if (!game) return null;
  return {
    money: Math.round(Number(game.money) || 0),
    frags: Math.round(Number(game.frags) || 0),
    heat: Math.max(0, Math.min(100, Number(game.heat) || 0))
  };
}

function sync() {
  const next = state();
  if (!next) return;

  if (previous) {
    if (next.money !== previous.money) {
      pulse("hudMoney", next.money - previous.money);
      pulse("shopMoney", next.money - previous.money);
    }
    if (next.frags !== previous.frags) {
      pulse("hudFrags", next.frags - previous.frags);
      pulse("shopFrags", next.frags - previous.frags);
    }
  }

  const heat = document.getElementById("hudHeat");
  if (heat) {
    heat.classList.toggle("heatWarn", next.heat >= 60 && next.heat < 85);
    heat.classList.toggle("heatCritical", next.heat >= 85);
    const parent = heat.closest(".stat") || heat;
    parent.setAttribute("role", "progressbar");
    parent.setAttribute("aria-label", "Heat");
    parent.setAttribute("aria-valuemin", "0");
    parent.setAttribute("aria-valuemax", "100");
    parent.setAttribute("aria-valuenow", String(Math.round(next.heat)));
  }

  const money = document.getElementById("hudMoney");
  if (money) money.setAttribute("aria-label", `${next.money} Eddies`);
  const frags = document.getElementById("hudFrags");
  if (frags) frags.setAttribute("aria-label", `${next.frags} Frags`);

  previous = next;
}

function init() {
  installStyles();
  sync();
  window.addEventListener("neon-save-status", sync);
  timer = window.setInterval(sync, 250);
  window.addEventListener("pagehide", () => clearInterval(timer), { once: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
