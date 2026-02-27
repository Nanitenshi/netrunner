import { game, setMode } from "./core.js";
import { toast } from "./ui.js";

let mission = null;
let tLeft = 0;
let score = 0;
let active = false;

export function startMission(data) {
  mission = { id: data.id, name: data.name || "Mission" };
  tLeft = 8 + game.upgrades.buffer * 2;
  score = 0;
  active = true;

  const nameEl = document.getElementById("missionName");
  if (nameEl) nameEl.textContent = mission.name;

  setMode("MISSION");
  toast("MISSION START.");
}

export function missionTick(dt, onDone) {
  if (!active) return;

  tLeft -= dt;
  if (tLeft < 0) tLeft = 0;

  const timer = document.getElementById("missionTimer");
  const scoreEl = document.getElementById("missionScore");
  if (timer) timer.textContent = `${tLeft.toFixed(1)}s`;
  if (scoreEl) scoreEl.textContent = `${score}`;

  // simple “auto” end
  if (tLeft <= 0) {
    active = false;
    onDone({
      text: `Intrusion done. +E$${20 + score} | +FRAGS ${Math.floor(score / 2)}`,
      apply: () => ({
        money: game.money + 20 + score,
        frags: game.frags + Math.floor(score / 2),
        heat: Math.min(100, game.heat + 12)
      })
    });
  }
}

export function handleMissionPointer(type, e) {
  e.preventDefault();
  if (!active) return;

  if (type === "down") {
    score += 1;
  }
}
