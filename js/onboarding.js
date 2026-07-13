// js/onboarding.js — gestaffelter Einstieg für neue Spieler
//
// Kein zusätzliches Regelwerk, sondern eine dünne Führungsschicht über den
// bestehenden Systemen: immer genau ein sichtbarer Auftrag, klare Sprache und
// schrittweise Freischaltung. Der Fortschritt leitet sich aus `missionsDone`
// ab, damit alte Saves ohne Migration weiterlaufen.
import { game } from "./core.js?v=575e20f0";
import { routeGoal } from "./world.js?v=575e20f0";
import { toast, setComms, bindFastPress } from "./ui.js?v=575e20f0";

const $ = (id) => document.getElementById(id);
const SEEN_KEY = "neonAlley_onboarding_seen_v1";

const TASKS = [
  {
    title: "ERSTER JOB",
    text: "Tipp AUFTRAG. Lauf zum gelben Netzzugang und drück START MISSION. Die Stadt erklärt dir gar nichts — also hör jetzt verdammt gut zu.",
    action: "ZIEL MARKIEREN"
  },
  {
    title: "DU HAST ÜBERLEBT",
    text: "Öffne CREW. JUNO ist schon ausgerüstet und hält deinen Rücken frei. Schau dir ihren Bonus an, dann geh wieder ins Netz.",
    action: "CREW ÖFFNEN"
  },
  {
    title: "WÄHL DEINEN STIL",
    text: "CREW → BUILD. Ghost kontrolliert Trace, Combat verzeiht Fehler, Data macht dich reich und gierig. Such dir aus, wie du scheitern willst.",
    action: "BUILD WÄHLEN"
  },
  {
    title: "KAUF DIR EINEN VORTEIL",
    text: "CREW → SKILLS. Frags sind knapp. Verballer sie nicht blind, sonst stehst du später mit leerem Kopf und vollem Problem da.",
    action: "SKILLS ÖFFNEN"
  },
  {
    title: "RÜSTE AUF",
    text: "CREW → GEAR. Eddies kaufen dauerhafte Cyberware und Programme, die dir im Dive den Arsch retten können.",
    action: "GEAR ÖFFNEN"
  }
];

const TUTORIAL_COPY = [
  {
    title: "DEIN ERSTER JOB",
    text: "Die Stadt schuldet dir keine Erklärung. Der gelbe AUFTRAG-Chip oben ist deine Leine durch den Dreck.\n\nTipp ihn an. Dein Runner läuft zum ersten Netzzugang. Dort drückst du START MISSION. Mehr musst du jetzt noch nicht kapieren."
  },
  {
    title: "IM NETZ",
    text: "Triff die Ziele und zerleg das ICE. Jeder geschaffte Layer füllt deinen BUFFER mit unsicherem Loot. Gleichzeitig steigt TRACE.\n\nNach dem Layer entscheidest du: JACK OUT sichert alles. GO DEEPER macht dich reicher — oder lässt dich mit fast nichts aufwachen."
  },
  {
    title: "DEINE CREW",
    text: "JUNO ist bereits bei dir. Crewmitglieder geben passive Boni und eine Fähigkeit pro Dive. Maximal zwei kommen mit.\n\nFrags kaufen neue Identitätskerne. Duplikate machen vorhandene Leute stärker. Ja, der Schwarzmarkt frisst deine Währung. Überraschung."
  },
  {
    title: "WÄHL, WIE DU KÄMPFST",
    text: "Nach deinem zweiten Dive wird BUILD freigeschaltet. GHOST hält Trace klein. COMBAT bricht ICE mit Gewalt. DATA jagt maximalen Loot.\n\nDer Build ist jederzeit wechselbar. Probier aus, was zu deinem verdammten Überlebensinstinkt passt."
  }
];

let lastStage = -1;
let taskBox = null;

function stage() {
  return Math.min(TASKS.length, Math.max(0, game.missionsDone || 0));
}

function seenStages() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
  } catch {
    return [];
  }
}

function markStageSeen(value) {
  const seen = seenStages();
  if (seen.includes(value)) return;
  seen.push(value);
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch {}
}

function ensureTaskBox() {
  if (taskBox) return taskBox;
  const app = $("app");
  if (!app) return null;

  taskBox = document.createElement("section");
  taskBox.id = "onboardingTask";
  taskBox.className = "panel";
  Object.assign(taskBox.style, {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    width: "min(620px, calc(100vw - 28px))",
    zIndex: "29",
    padding: "10px 12px",
    display: "none",
    boxSizing: "border-box",
    borderColor: "rgba(252,238,10,.65)",
    background: "rgba(5,7,10,.94)"
  });

  const title = document.createElement("div");
  title.id = "onboardingTaskTitle";
  title.className = "sideTitle yellowText";

  const text = document.createElement("div");
  text.id = "onboardingTaskText";
  text.className = "muted small";
  text.style.margin = "5px 0 9px";

  const action = document.createElement("button");
  action.id = "btnOnboardingAction";
  action.type = "button";
  action.className = "btn small yellow";
  bindFastPress(action, runTaskAction);

  taskBox.append(title, text, action);
  app.appendChild(taskBox);
  return taskBox;
}

function runTaskAction() {
  const s = stage();
  if (s === 0) {
    routeGoal?.();
    return;
  }

  $("btnCrew")?.click();
  const wanted = s === 1 ? "crew" : s === 2 ? "build" : s === 3 ? "skills" : "gear";
  setTimeout(() => {
    const tab = document.querySelector(`.tabBtn[data-tab="${wanted}"]`);
    if (tab && tab.style.display !== "none") tab.click();
  }, 80);
}

function gateTab(name, unlocked, message) {
  const tab = document.querySelector(`.tabBtn[data-tab="${name}"]`);
  if (!tab) return;

  tab.style.display = unlocked ? "" : "none";
  tab.dataset.onboardingLocked = unlocked ? "0" : "1";
  if (!unlocked) tab.title = message;
}

function applyUnlocks() {
  const dives = game.missionsDone || 0;
  const crewButton = $("btnCrew");
  if (crewButton) crewButton.style.display = dives >= 1 ? "" : "none";

  // Broker und Crew bilden den ersten Meta-Schritt. Build, Skills und Gear
  // folgen einzeln, damit ein Neuling nie fünf Menüs gleichzeitig erklären
  // soll — genau diese Wand aus Begriffen hat bisher Leute rausgeworfen.
  gateTab("broker", dives >= 1, "Nach dem ersten Dive freigeschaltet.");
  gateTab("crew", dives >= 1, "Nach dem ersten Dive freigeschaltet.");
  gateTab("build", dives >= 2, "Überlebe zwei Dives. Dann darfst du deinen Stil wählen.");
  gateTab("skills", dives >= 3, "Überlebe drei Dives. Dann werden Skills freigeschaltet.");
  gateTab("gear", dives >= 4, "Überlebe vier Dives. Dann öffnet der Gear-Markt.");

  const daily = $("dailyInfo");
  if (daily) daily.style.display = dives >= 3 ? "" : "none";
}

function applyTutorialCopy() {
  const box = $("tutorial");
  if (!box || box.classList.contains("hidden")) return;
  const copy = TUTORIAL_COPY[game.tutorialStep];
  if (!copy) return;

  const title = $("tutTitle");
  const text = $("tutText");
  if (title && title.textContent !== copy.title) title.textContent = copy.title;
  if (text && text.textContent !== copy.text) text.textContent = copy.text;
}

function renderTask() {
  const box = ensureTaskBox();
  if (!box) return;

  const s = stage();
  const overlayOpen = !$("crewOverlay")?.classList.contains("hidden")
    || !$("pauseMenu")?.classList.contains("hidden")
    || !$("tutorial")?.classList.contains("hidden")
    || !$("result")?.classList.contains("hidden");

  if (s >= TASKS.length || game.mode !== "WORLD" || overlayOpen) {
    box.style.display = "none";
    return;
  }

  const task = TASKS[s];
  $("onboardingTaskTitle").textContent = `AUFTRAG 0${s + 1} // ${task.title}`;
  $("onboardingTaskText").textContent = task.text;
  $("btnOnboardingAction").textContent = task.action;

  const hud = $("hudTop");
  const hudBottom = hud ? hud.getBoundingClientRect().bottom : 104;
  box.style.top = `${Math.round(hudBottom + 12)}px`;
  box.style.display = "block";
}

function announceStage() {
  const s = stage();
  if (s === lastStage) return;
  lastStage = s;
  if (s >= TASKS.length || seenStages().includes(s)) return;

  const task = TASKS[s];
  const line = s === 0
    ? "NYX: „Erster Job. Folge dem gelben Auftrag und versuch, nicht schon an der Tür zu verrecken.“"
    : s === 1
      ? "JUNO: „Du lebst noch. Öffne CREW. Ich erklär dir, warum das kein Zufall war.“"
      : s === 2
        ? "NYX: „Zwei Dives. Reicht für eine Meinung. Wähl jetzt deinen Build.“"
        : s === 3
          ? "GHOST: „Skills sind offen. Kauf mit Hirn, nicht mit diesem nervösen Finger.“"
          : "RUST: „Gear-Markt ist offen. Eddies rein, bessere Überlebenschancen raus.“";

  setComms(line);
  toast(`NEU: ${task.title}`);
  markStageSeen(s);
}

function tick() {
  applyUnlocks();
  applyTutorialCopy();
  renderTask();
  announceStage();
}

function init() {
  ensureTaskBox();
  tick();
  window.setInterval(tick, 250);
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
