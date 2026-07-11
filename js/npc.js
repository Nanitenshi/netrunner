// js/npc.js
import { game, checkDailyReset } from "./core.js";
import { toast, renderStoryLog } from "./ui.js";
import { getNodeById } from "./world.js";
import { crewTick } from "./crew.js";
import { saveNow } from "./save.js";

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

// Einmal pro Tag pro NPC: ein echter Spieleffekt statt nur Flavor-Text.
// apply() darf game direkt verändern; der Rückgabewert ist die Comms-Zeile.
const DAILY_PERKS = {
  NYX: (g) => {
    g.buffs.traceCut = Math.max(g.buffs.traceCut, 20);
    return "NYX rootet dir eine saubere Route: nächster Dive startet mit -20 Trace.";
  },
  GHOST: (g) => {
    const e = 15 + Math.floor(Math.random() * 26);
    g.money += e;
    return `GHOST schiebt dir was zu: +${e} E$ vom Schwarzmarkt.`;
  },
  "RUNNER-9": (g) => {
    g.buffs.lootBonus = Math.max(g.buffs.lootBonus, 1.15);
    return "RUNNER-9 flüstert einen Insider-Tipp: nächster Dive +15% Loot.";
  },
  "ICE-VOICE": (g) => {
    g.buffs.traceMultCut = Math.min(g.buffs.traceMultCut, 0.8);
    return "ICE-VOICE leiht dir Zugangsdaten: nächster Dive baut 20% langsamer Trace auf.";
  },
  RUST: (g) => {
    g.buffs.gearDiscount = Math.max(g.buffs.gearDiscount, 0.2);
    return "RUST legt was zurück: -20% auf dein nächstes Gear-Upgrade.";
  },
  "DOC-K": (g) => {
    const cut = Math.min(g.heat, 15);
    g.heat = Math.max(0, g.heat - 15);
    return cut > 0 ? `DOC-K patcht dich kostenlos: Heat -${cut}.` : "DOC-K nickt: „Sauber genug für heute.“";
  },
  ECHO: (g) => {
    const f = 4 + Math.floor(Math.random() * 7);
    g.frags += f;
    return `ECHO gibt dir ein altes Signal weiter: +${f} ◆.`;
  }
};

export function openNpcDialog(nodeId) {
  if (!nodeId) return toast("NO NODE SELECTED.");
  checkDailyReset();

  const node = getNodeById(nodeId);
  const npcName = node?.npc;

  const perk = DAILY_PERKS[npcName];
  if (perk && !game.daily.npcs[npcName]) {
    game.daily.npcs[npcName] = true;
    const line = perk(game);

    game.storyLog.unshift(`> ${npcName}: ${line}`);
    if (game.storyLog.length > 60) game.storyLog.length = 60;

    renderStoryLog();
    saveNow();
    toast(`⚡ TAGESBONUS: ${npcName}`);
    return;
  }

  const pool = LINES[npcName] || LINES.default;
  const line = pool[Math.floor(Math.random() * pool.length)];

  game.storyLog.unshift(`> ${npcName || "SIGNAL"}: "${line}"`);
  if (game.storyLog.length > 60) game.storyLog.length = 60;

  renderStoryLog();
  toast("COMMS RECEIVED.");
}

export function npcTick(dt = 0) {
  crewTick(dt);
}
