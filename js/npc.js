import { game } from "./core.js";
import { toast } from "./ui.js";
import { startMission } from "./missions.js";

export function npcTick() {}

export function openNpcDialog(nodeId) {
  if (!nodeId) { toast("NO NODE SELECTED."); return; }

  const choices = document.getElementById("choices");
  if (!choices) return;
  choices.innerHTML = "";

  const b1 = document.createElement("button");
  b1.className = "btn";
  b1.textContent = "Ask for info";
  b1.onclick = () => toast("Signal is noisy. But useful.");

  const b2 = document.createElement("button");
  b2.className = "btn yellow";
  b2.textContent = "Start mission";
  b2.onclick = () => {
    if (game.mode !== "WORLD") return;
    startMission({ id: "M_AUTO", name: "Quick Intrusion" });
  };

  choices.appendChild(b1);
  choices.appendChild(b2);
}
