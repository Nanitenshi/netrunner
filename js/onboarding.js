// js/onboarding.js — eine einzige, dominante Führung für den Mobile-Einstieg
//
// onboarding_core.js besitzt weiterhin Fortschritt, Freischaltungen und Aktionen.
// Diese Präsentationsschicht verwendet dafür ausschließlich das vorhandene
// AUFTRAG-Banner. Die frühere zweite Aufgabenkarte bleibt unsichtbar, damit HUD,
// Tutorial und Quick-Start nicht gleichzeitig verschiedene Befehle ausgeben.
import "./onboarding_core.js";
import { game } from "./core.js?v=8813e241";
import { nearMissionNode } from "./world.js?v=8813e241";

const $ = (id) => document.getElementById(id);

const PRIMARY_GOALS = [
  "ERSTER JOB · ZUM CACHE POP TERMINAL",
  "CREW ÖFFNEN · JUNO PRÜFEN",
  "BUILD WÄHLEN · GHOST / COMBAT / DATA",
  "SKILLS ÖFFNEN · FRAGS INVESTIEREN",
  "GEAR ÖFFNEN · EDDIES INVESTIEREN"
];

let syncTimer = 0;
let lastPrimaryPress = -Infinity;
let goalBound = false;

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

function onboardingStage() {
  const value = window.__NEON_ONBOARDING?.stage?.();
  return Number.isFinite(value) ? value : PRIMARY_GOALS.length;
}

function onboardingActive() {
  return onboardingStage() < PRIMARY_GOALS.length;
}

function injectStyle() {
  if ($("singlePrimaryGoalStyle")) return;

  const style = document.createElement("style");
  style.id = "singlePrimaryGoalStyle";
  style.textContent = `
    #onboardingTask { display: none !important; }

    #hudGoal.onboardingPrimary {
      background: linear-gradient(90deg, rgba(252,238,10,.20), rgba(5,7,10,.90));
      box-shadow: 0 0 24px rgba(252,238,10,.25);
      cursor: pointer;
    }
    #hudGoal.onboardingPrimary #hudGoalText { display: none !important; }
    #hudGoal.onboardingPrimary::after {
      content: attr(data-primary-label);
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #hudGoal.primarySuppressed { display: none !important; }

    #btnDiveNow.primaryDive {
      width: min(560px, calc(100vw - 24px));
      max-width: calc(100vw - 24px);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 13px 16px;
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(252,238,10,.24), rgba(0,0,0,.76));
      box-shadow: 0 0 28px rgba(252,238,10,.34);
    }

    #bottomBar.onboardingSecondary .btn {
      opacity: .62;
      filter: saturate(.72);
    }
    #bottomBar.onboardingSecondary #btnNodes,
    #bottomBar.onboardingSecondary #btnPause {
      opacity: .82;
    }

    @media (max-width: 600px) {
      #hudGoal.onboardingPrimary {
        padding: 10px 13px;
        font-size: 12px;
      }
      #hudGoal.onboardingPrimary .bannerIcon { font-size: 15px; }
    }
  `;
  document.head.appendChild(style);
}

function pressInternalAction(action) {
  if (typeof PointerEvent === "function") {
    action.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true
    }));
    return;
  }
  action.click();
}

function runPrimaryAction() {
  const stage = onboardingStage();
  const action = $("btnOnboardingAction");
  if (stage >= PRIMARY_GOALS.length || !action) return;

  if (stage === 0) {
    const previousMissionsDone = game.missionsDone;
    try {
      game.missionsDone = 0;
      pressInternalAction(action);
    } finally {
      game.missionsDone = previousMissionsDone;
    }
    return;
  }

  pressInternalAction(action);
}

function handlePrimaryPress(event) {
  if (!onboardingActive() || game.mode !== "WORLD" || modalOpen() || nearMissionNode()) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const now = performance.now();
  if (now - lastPrimaryPress < 400) return;
  lastPrimaryPress = now;
  runPrimaryAction();
}

function bindPrimaryGoal() {
  if (goalBound) return;
  const goal = $("hudGoal");
  if (!goal) return;

  goalBound = true;
  goal.addEventListener("pointerup", handlePrimaryPress, { capture: true, passive: false });
  goal.addEventListener("click", handlePrimaryPress, { capture: true, passive: false });
}

function restoreGoal(goal, icon) {
  goal?.classList.remove("onboardingPrimary", "primarySuppressed");
  if (goal) {
    delete goal.dataset.primaryLabel;
    goal.removeAttribute("aria-label");
  }
  if (icon?.dataset.originalIcon) {
    icon.textContent = icon.dataset.originalIcon;
    delete icon.dataset.originalIcon;
  }
}

function sync() {
  bindPrimaryGoal();

  const task = $("onboardingTask");
  if (task) task.style.display = "none";

  const goal = $("hudGoal");
  const icon = goal?.querySelector(".bannerIcon");
  const diveButton = $("btnDiveNow");
  const bottomBar = $("bottomBar");
  const active = onboardingActive();

  if (!active) {
    restoreGoal(goal, icon);
    diveButton?.classList.remove("primaryDive");
    bottomBar?.classList.remove("onboardingSecondary");
    return;
  }

  bottomBar?.classList.add("onboardingSecondary");

  const stage = onboardingStage();
  if (goal) {
    goal.dataset.primaryLabel = PRIMARY_GOALS[stage];
    goal.setAttribute("aria-label", PRIMARY_GOALS[stage]);
    goal.classList.add("onboardingPrimary");
  }
  if (icon) {
    if (!icon.dataset.originalIcon) icon.dataset.originalIcon = icon.textContent;
    icon.textContent = "▶";
  }

  const blocked = game.mode !== "WORLD" || modalOpen();
  const near = !blocked ? nearMissionNode() : null;

  if (blocked) {
    goal?.classList.add("primarySuppressed");
    diveButton?.classList.remove("primaryDive");
    return;
  }

  if (near) {
    goal?.classList.add("primarySuppressed");
    diveButton?.classList.add("primaryDive");
    diveButton?.classList.remove("hidden");

    const hud = $("hudTop");
    const hudBottom = hud ? hud.getBoundingClientRect().bottom : 104;
    diveButton.style.top = `${Math.round(hudBottom + 10)}px`;
    return;
  }

  goal?.classList.remove("primarySuppressed");
  diveButton?.classList.remove("primaryDive");
  diveButton?.classList.add("hidden");
}

function init() {
  injectStyle();
  bindPrimaryGoal();
  sync();
  syncTimer = window.setInterval(sync, 100);

  window.__NEON_PRIMARY_GOAL = {
    sync,
    run: runPrimaryAction,
    stop: () => window.clearInterval(syncTimer)
  };
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  window.setTimeout(init, 0);
}
