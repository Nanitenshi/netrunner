import { game } from "./core.js";
import { toast } from "./ui.js";

export function openNpcDialog(nodeId) {
  if (!nodeId) return toast("NO NODE SELECTED.");

  // minimalist: “Talk” just drops a story line into archive
  const line = (Math.random() > 0.5)
    ? `Nyx: “Arasaka lächelt am Tag. Nachts fressen sie.”`
    : `Ghost: “Wenn du glaubst du steuerst das, hat dich die Stadt schon.”`;

  game.storyLog.unshift(`> ${line}`);
  toast("COMMS RECEIVED.");
}

export function npcTick() {
  // reserved for later (NPC movement, timed comms etc.)
}
