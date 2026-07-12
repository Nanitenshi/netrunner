// js/npc.js
import { game, checkDailyReset } from "./core.js";
import { toast, renderStoryLog } from "./ui.js";
import { getNodeById } from "./world.js";
import { crewTick } from "./crew.js";
import { saveNow } from "./save.js";

const $ = (id) => document.getElementById(id);

// Jeder NPC hat einen kleinen, festen Dialog-Arc statt zufälliger Zeilen —
// jeder Besuch (nach dem Tagesbonus) rückt eine Stufe weiter, die letzte
// Zeile wiederholt sich danach. So erzählt wiederholtes Ansprechen wirklich
// eine Geschichte statt nur Flavor-Rauschen.
const STORY_ARC = {
  NYX: [
    "Wir starten sauber. Aber die Stadt bleibt nie sauber.",
    "Arasaka lächelt am Tag. Nachts fressen sie.",
    "Halt deinen Buffer voll und deinen Mund leer.",
    "Ich hab auch mal gedivt. Bis ich einen Freund im Buffer gelassen hab. Seitdem sitz ich lieber am Schreibtisch."
  ],
  GHOST: [
    "Wenn du glaubst du steuerst das, hat dich die Stadt schon.",
    "Ich hab was für dich. Frag nicht, woher.",
    "Heat runter, Eddies rauf. So einfach ist das nicht, aber tu so.",
    "Ich handle mit allem außer Namen. Meiner ist auch nicht echt, GHOST tut's."
  ],
  "RUNNER-9": [
    "Der Kaffee hier ist schlechter als meine Firewall. Beides hält trotzdem.",
    "Konzerne merken sich alles. Merk dir das.",
    "Ich war mal Konzern-Analystin. Jetzt verkauf ich, was sie mir beigebracht haben — an alle, die zahlen.",
    "Frag mich nicht, was ich vorher war. Frag, was du als Nächstes brauchst."
  ],
  "ICE-VOICE": [
    "Willkommen im Lobby-Bereich. Ihre Daten gehören jetzt uns.",
    "Sicherheitsstufe steigt mit jedem Ihrer Schritte.",
    "Ich bin nicht hier, um zu urteilen. Nur um zu protokollieren.",
    "Jeder Zugang, den Sie öffnen, öffnet auch einen für mich. Danke für die Zusammenarbeit."
  ],
  RUST: [
    "Schrott ist nur Metall, das noch nicht verkauft wurde.",
    "Die Leitungen hier lügen nicht. Menschen schon.",
    "Ich hab mal für Militech geschraubt. Dann hab ich angefangen, selbst zu zählen, was übrig bleibt.",
    "Jedes Teil hier hat mal wem gehört, der nicht mehr fragt, wo's ist."
  ],
  "DOC-K": [
    "Ich flick dich. Frag nicht wie.",
    "Heat zu hoch, und ich seh dich nicht wieder.",
    "Ich hab keine Lizenz mehr. Dafür bessere Hände.",
    "Jeder, den ich patch, ist einer weniger, den die Stadt behält. Das reicht mir als Grund."
  ],
  ECHO: [
    "Niemand hier war je wirklich hier.",
    "Signale sterben nie. Sie warten nur.",
    "Ich hör Dinge tief unten, die keinen Sender haben sollten.",
    "Je tiefer du gehst, desto lauter wird's. Irgendwann antwortet es dir."
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

    // Antwort direkt im offenen Signal-Panel zeigen, nicht nur im Story-Log
    // (das man extra über NODES aufklappen müsste) — gemeldetes Problem:
    // "kann mit NPCs nicht wirklich interagieren", weil TALK sichtbar
    // nichts tat außer einem kurz aufblitzenden Toast.
    const dlg = $("dialogText");
    if (dlg) dlg.textContent = `⚡ ${line}`;

    renderStoryLog();
    saveNow();
    toast(`⚡ TAGESBONUS: ${npcName}`);
    return;
  }

  const arc = STORY_ARC[npcName] || STORY_ARC.default;
  const stage = Math.min(game.storyStage[npcName] || 0, arc.length - 1);
  const line = arc[stage];
  game.storyStage[npcName] = Math.min(stage + 1, arc.length - 1);

  game.storyLog.unshift(`> ${npcName || "SIGNAL"}: "${line}"`);
  if (game.storyLog.length > 60) game.storyLog.length = 60;

  const dlg = $("dialogText");
  if (dlg) dlg.textContent = `„${line}“`;

  renderStoryLog();
  saveNow();
  toast("COMMS RECEIVED.");
}

export function npcTick(dt = 0) {
  crewTick(dt);
}
