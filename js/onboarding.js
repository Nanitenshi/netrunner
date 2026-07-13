// js/onboarding.js — gestaffelter Einstieg für neue Spieler
//
// Dünne Führungsschicht über den bestehenden Systemen: immer genau ein
// sichtbarer Auftrag, echte Freischaltungen und ein kontrollierter erster Dive.
// Fortschritt zählt nur saubere Jack Outs — ein Dump ist kein verdammter Sieg.
import { game } from "./core.js";
import { routeGoal } from "./world.js";
import { toast, setComms, bindFastPress } from "./ui.js";

const $ = (id) => document.getElementById(id);
const SEEN_KEY = "neonAlley_onboarding_seen_v2";

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
    text: "Triff die Ziele und zerleg das ICE. Jeder geschaffte Layer füllt deinen BUFFER mit unsicherem Loot. Gleichzeitig steigt TRACE.\n\nDein erster Auftrag endet nach einem Layer: JACK OUT und sichere die Beute. Später darfst du mit GO DEEPER selbst entscheiden, wie gierig du sterben willst."
  },
  {
    title: "DEINE CREW",
    text: "JUNO ist bereits bei dir. Crewmitglieder geben passive Boni und eine Fähigkeit pro Dive. Maximal zwei kommen mit.\n\nFrags kaufen neue Identitätskerne. Duplikate machen vorhandene Leute stärker. Ja, der Schwarzmarkt frisst deine Währung. Überraschung."
  },
  {
    title: "WÄHL, WIE DU KÄMPFST",
    text: "Nach deinem zweiten sauberen Jack Out wird BUILD freigeschaltet. GHOST hält Trace klein. COMBAT bricht ICE mit Gewalt. DATA jagt maximalen Loot.\n\nDer Build ist jederzeit wechselbar. Probier aus, was zu deinem verdammten Überlebensinstinkt passt."
  }
];

let lastStage = -1;
let taskBox = null;
let firstDiveChoiceAnnounced = false;

function successfulDives() {
  const dives = Number(game.stats?.dives || 0);
  const dumps = Number(game.stats?.dumps || 0);
  return Math.max(0, dives - dumps);
}

function stage() {
  return Math.min(TASKS.length, successfulDives());
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
    if (tab && tab.dataset.onboardingLocked !== "1") tab.click();
  }, 80);
}

function gateTab(name, unlocked, message) {
  const tab = document.querySelector(`.tabBtn[data-tab="${name}"]`);
  const page = $("tab" + name.charAt(0).toUpperCase() + name.slice(1));
  if (!tab) return;

  tab.style.display = unlocked ? "" : "none";
  tab.disabled = !unlocked;
  tab.dataset.onboardingLocked = unlocked ? "0" : "1";
  tab.title = unlocked ? "" : message;

  // Falls ein alter UI-Zustand auf einer inzwischen gesperrten Seite steht,
  // diese Seite hart schließen. Nur den Tab zu verstecken wäre keine echte Sperre.
  if (!unlocked) page?.classList.add("hidden");
}

function ensureUnlockedTabVisible() {
  const overlay = $("crewOverlay");
  if (!overlay || overlay.classList.contains("hidden")) return;

  const visiblePage = [...document.querySelectorAll(".tabPage")]
    .find((page) => !page.classList.contains("hidden"));
  const visibleName = visiblePage?.id?.replace(/^tab/, "").toLowerCase();
  const visibleTab = visibleName
    ? document.querySelector(`.tabBtn[data-tab="${visibleName}"]`)
    : null;

  if (visibleTab && visibleTab.dataset.onboardingLocked !== "1") return;

  const fallback = ["broker", "crew", "build", "skills", "gear"]
    .map((name) => document.querySelector(`.tabBtn[data-tab="${name}"]`))
    .find((tab) => tab && tab.dataset.onboardingLocked !== "1");
  fallback?.click();
}

function applyUnlocks() {
  const wins = successfulDives();
  const crewButton = $("btnCrew");
  if (crewButton) {
    crewButton.style.display = wins >= 1 ? "" : "none";
    crewButton.disabled = wins < 1;
  }

  gateTab("broker", wins >= 1, "Nach dem ersten sauberen Jack Out freigeschaltet.");
  gateTab("crew", wins >= 1, "Nach dem ersten sauberen Jack Out freigeschaltet.");
  gateTab("build", wins >= 2, "Schaff zwei saubere Jack Outs. Dann darfst du deinen Stil wählen.");
  gateTab("skills", wins >= 3, "Schaff drei saubere Jack Outs. Dann werden Skills freigeschaltet.");
  gateTab("gear", wins >= 4, "Schaff vier saubere Jack Outs. Dann öffnet der Gear-Markt.");

  const daily = $("dailyInfo");
  if (daily) daily.style.display = wins >= 3 ? "" : "none";
  ensureUnlockedTabVisible();
}

function applyFirstDiveGuidance() {
  const firstRun = successfulDives() === 0;
  const choice = $("diveChoice");
  const deeper = $("btnDeeper");
  const jackOut = $("btnJackOut");
  const hint = $("dcBossHint");
  const choiceVisible = choice && !choice.classList.contains("hidden");

  if (!firstRun) {
    if (deeper) deeper.style.display = "";
    if (jackOut && jackOut.dataset.onboardingLabel === "1") {
      jackOut.textContent = "JACK OUT — sichern";
      delete jackOut.dataset.onboardingLabel;
    }
    return;
  }

  // Der erste Dive lehrt genau eine Entscheidung: Beute sichern. GO DEEPER
  // kommt erst danach. So bekommt ein Neuling erst einen Erfolg, dann Freiheit.
  if (deeper) deeper.style.display = "none";
  if (jackOut) {
    jackOut.textContent = "JACK OUT — ERSTEN JOB ABSCHLIESSEN";
    jackOut.dataset.onboardingLabel = "1";
  }
  if (hint && choiceVisible) {
    hint.textContent = "ERSTER JOB: Sichere jetzt den Buffer. Gier darfst du dir beim nächsten Dive leisten.";
  }

  if (choiceVisible && !firstDiveChoiceAnnounced) {
    firstDiveChoiceAnnounced = true;
    setComms("NYX: „Gut. Jetzt JACK OUT. Erst überleben, dann große Fresse haben.“");
    toast("JACK OUT DRÜCKEN — BEUTE SICHERN");
  }
  if (!choiceVisible) firstDiveChoiceAnnounced = false;
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
        ? "NYX: „Zwei saubere Ausstiege. Reicht für eine Meinung. Wähl jetzt deinen Build.“"
        : s === 3
          ? "GHOST: „Skills sind offen. Kauf mit Hirn, nicht mit diesem nervösen Finger.“"
          : "RUST: „Gear-Markt ist offen. Eddies rein, bessere Überlebenschancen raus.“";

  setComms(line);
  toast(`NEU: ${task.title}`);
  markStageSeen(s);
}

function tick() {
  applyUnlocks();
  applyFirstDiveGuidance();
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
