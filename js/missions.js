import { game } from "./core.js";
import { toast } from "./ui.js";

let mission = {
  active: false,
  name: "Quick Intrusion",
  timer: 0,
  timeLimit: 12,
  score: 0,
  lastTapAt: 0
};

export function startMission(type = "quick") {
  mission.active = true;
  mission.timer = 0;
  mission.score = 0;
  mission.lastTapAt = 0;

  toast("MISSION START: QUICK INTRUSION");
}

export function handleMissionPointer(type, e) {
  if (!mission.active) return;

  // FIX: Tablets schicken oft pointercancel / kein pointerup -> wir verwerten down und move
  if (type === "down" || type === "move") {
    const now = performance.now();

    // kleiner Throttle, sonst explodiert Score bei move
    if (now - mission.lastTapAt > 60) {
      mission.score += 1;
      mission.lastTapAt = now;
    }
  }
}

export function missionTick(dt, onFinish) {
  if (!mission.active) return;

  mission.timer += dt;

  // HUD updaten falls vorhanden
  const elScore = document.getElementById("hudFrags") || document.getElementById("hudScore");
  if (elScore) elScore.textContent = String(mission.score);

  const elIntr = document.getElementById("hudIntrusion");
  if (elIntr) elIntr.textContent = `${Math.max(0, (mission.timeLimit - mission.timer)).toFixed(1)}s`;

  if (mission.timer >= mission.timeLimit) {
    mission.active = false;

    const resultData = {
      apply: (g) => ({
        money: g.money + mission.score * 2,
        frags: g.frags + mission.score
      })
    };

    toast(`MISSION COMPLETE: +${mission.score} FRAGS`);
    onFinish(resultData);
  }
}
