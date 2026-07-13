// js/onboarding.js — kompakte Mobile-Hülle um das bestehende Onboarding
//
// Die eigentliche Fortschritts- und Freischaltlogik bleibt in onboarding_core.js.
// Diese Datei koordiniert nur die Darstellung mit dem kontextuellen DIVE-Button:
// niemals zwei große Flächen übereinander und kein Textblock über der Spielwelt.
import "./onboarding_core.js";
import { game } from "./core.js";
import { nearMissionNode } from "./world.js";

const $ = (id) => document.getElementById(id);
let syncTimer = 0;

function isVisible(id) {
  const el = $(id);
  return !!el && !el.classList.contains("hidden");
}

function modalOpen() {
  return isVisible("crewOverlay")
    || isVisible("pauseMenu")
    || isVisible("tutorial")
    || isVisible("result")
    || isVisible("worldEncounter");
}

function injectStyle() {
  if ($("compactOnboardingStyle")) return;
  const style = document.createElement("style");
  style.id = "compactOnboardingStyle";
  style.textContent = `
    #onboardingTask.onboardingCompact {
      left: 50% !important;
      right: auto !important;
      transform: translateX(-50%) !important;
      width: min(620px, calc(100vw - 24px)) !important;
      min-height: 44px;
      align-items: center;
      gap: 8px;
      border-radius: 999px !important;
      background: linear-gradient(90deg, rgba(5,9,14,.96), rgba(15,17,12,.92)) !important;
      box-shadow: 0 0 16px rgba(252,238,10,.16) !important;
    }
    #onboardingTask.onboardingCompact.forceHidden { display: none !important; }
    #onboardingTask.onboardingCompact #onboardingTaskText { display: none !important; }
    #onboardingTask.onboardingCompact #onboardingTaskTitle {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 11px;
      letter-spacing: 1.2px;
      padding-left: 4px;
    }
    #onboardingTask.onboardingCompact #btnOnboardingAction {
      flex: 0 0 auto;
      min-width: 72px;
      padding: 8px 11px;
      border-radius: 999px;
    }
    #btnDiveNow {
      width: min(560px, calc(100vw - 24px));
      max-width: calc(100vw - 24px);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 12px 16px;
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(252,238,10,.18), rgba(0,0,0,.72));
      box-shadow: 0 0 24px rgba(252,238,10,.28);
    }
  `;
  document.head.appendChild(style);
}

function compactActionLabel(action) {
  const labels = {
    "ZIEL MARKIEREN": "ZIEL",
    "CREW ÖFFNEN": "CREW",
    "BUILD WÄHLEN": "BUILD",
    "SKILLS ÖFFNEN": "SKILLS",
    "GEAR ÖFFNEN": "GEAR"
  };

  // onboarding_core schreibt bei einem neuen Abschnitt wieder die lange Form.
  // Genau dann den gespeicherten Wert aktualisieren; die bereits gekürzte Form
  // darf den nächsten Abschnitt nicht versehentlich auf „ZIEL“ festnageln.
  const current = action.textContent.trim();
  if (labels[current]) action.dataset.fullOnboardingLabel = current;

  const full = action.dataset.fullOnboardingLabel || current;
  action.textContent = labels[full] || full;
}

function sync() {
  const task = $("onboardingTask");
  if (!task) return;

  task.classList.add("onboardingCompact");
  const action = $("btnOnboardingAction");
  if (action) compactActionLabel(action);

  const hud = $("hudTop");
  const hudBottom = hud ? hud.getBoundingClientRect().bottom : 104;
  task.style.top = `${Math.round(hudBottom + 10)}px`;

  const diveButton = $("btnDiveNow");
  const near = game.mode === "WORLD" && !modalOpen() ? nearMissionNode() : null;

  // onboarding_core nutzt inline display:block/none. Wenn es die Aufgabe zeigen
  // will, hier bewusst auf flex wechseln; wenn es sie versteckt, bleibt none.
  if (task.style.display !== "none") task.style.display = "flex";

  // Am Netzzugang gehört die Bühne dem Start-Button. Die Auftrags-Pille
  // verschwindet vollständig, statt denselben Bereich optisch zuzukleistern.
  task.classList.toggle("forceHidden", !!near);

  // Zweite Verteidigungslinie: Der normale UI-Tick macht dasselbe, aber das
  // Onboarding darf den Button nie wieder verdecken oder durch Timing verlieren.
  if (diveButton && near) {
    diveButton.classList.remove("hidden");
    diveButton.textContent = `▶ DIVE: ${near.name.toUpperCase()} · TIER ${(near.tier || 1) + (near.hot ? 1 : 0)}${near.hot ? " 🔥" : ""}`;
    diveButton.style.top = `${Math.round(hudBottom + 10)}px`;
  }
}

function init() {
  injectStyle();
  sync();
  syncTimer = window.setInterval(sync, 100);
  window.__NEON_COMPACT_ONBOARDING = {
    sync,
    stop: () => window.clearInterval(syncTimer)
  };
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  window.setTimeout(init, 0);
}
