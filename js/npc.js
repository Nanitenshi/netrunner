import { toast, pushStoryLog, setTicker } from "./ui.js";

export function openNpcDialog(node) {
  if (!node) return;

  const lines = {
    NYX: [
      "Wir sind drin. Bleib ruhig. Jeder Fehler zieht Heat.",
      "Ich mag Runner mit Tempo. Lass mich nicht hängen.",
      "Arasaka wirkt heute… nervös."
    ],
    GHOST: [
      "Nyx erzählt dir die halbe Wahrheit.",
      "Wenn du reich werden willst: mach’s dreckig.",
      "Ich sehe ein Echo im Signal. Das bist nicht du."
    ],
    DOC: [
      "Dein Deck ist heiß. Upgrades wären schlau.",
      "Du spielst mit Black ICE. Trag’s nicht ins echte Leben."
    ]
  };

  const who = node.npc || "SYSTEM";
  const pool = lines[who] || ["Signal rauscht…"];
  const msg = pool[Math.floor(Math.random() * pool.length)];

  setTicker(`${who}: ${msg}`);
  pushStoryLog(`${who}: ${msg}`);
  toast("COMMS RECEIVED");
}

export function npcTick() {
  // reserved for future: NPC patrols, events
}
