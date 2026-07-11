// js/npc.js
import { game } from "./core.js?v=3977a132";
import { toast, renderStoryLog } from "./ui.js?v=3977a132";
import { getNodeById } from "./world.js?v=3977a132";
import { crewTick } from "./crew.js?v=3977a132";

const LINES = {
  NYX: [
    "Wir starten sauber. Aber die Stadt bleibt nie sauber.",
    "Arasaka lächelt am Tag. Nachts fressen sie.",
    "Halt deinen Buffer voll und deinen Mund leer."
  ],
  GHOST: [
    "Wenn du glaubst du steuerst das, hat dich die Stadt schon.",
    "Ich hab was für dich. Frag nicht, woher.",
    "Heat runter, Eddies rauf. So einfach ist das nicht, aber tu so."
  ],
  "RUNNER-9": [
    "Der Kaffee hier ist schlechter als meine Firewall. Beides hält trotzdem.",
    "Konzerne merken sich alles. Merk dir das."
  ],
  "ICE-VOICE": [
    "Willkommen im Lobby-Bereich. Ihre Daten gehören jetzt uns.",
    "Sicherheitsstufe steigt mit jedem Ihrer Schritte."
  ],
  RUST: [
    "Schrott ist nur Metall, das noch nicht verkauft wurde.",
    "Die Leitungen hier lügen nicht. Menschen schon."
  ],
  "DOC-K": [
    "Ich flick dich. Frag nicht wie.",
    "Heat zu hoch, und ich seh dich nicht wieder."
  ],
  ECHO: [
    "Niemand hier war je wirklich hier.",
    "Signale sterben nie. Sie warten nur."
  ],
  default: ["...Verbindung instabil..."]
};

export function openNpcDialog(nodeId) {
  if (!nodeId) return toast("NO NODE SELECTED.");

  const node = getNodeById(nodeId);
  const pool = LINES[node?.npc] || LINES.default;
  const line = pool[Math.floor(Math.random() * pool.length)];

  game.storyLog.unshift(`> ${node?.npc || "SIGNAL"}: "${line}"`);
  if (game.storyLog.length > 60) game.storyLog.length = 60;

  renderStoryLog();
  toast("COMMS RECEIVED.");
}

export function npcTick(dt = 0) {
  crewTick(dt);
}
