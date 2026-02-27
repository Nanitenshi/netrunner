import { game } from "./core.js";
import { setNpcUI } from "./ui.js";
import { getSelected } from "./world.js";

const NPCS = {
  "NYX": { role: "Fixer // encrypted VOIP", style: "nyx" },
  "GHOST": { role: "Unknown // interference", style: "ghost" },
  "MARA": { role: "Courier // street runner", style: "mara" },
  "DOC K": { role: "Ripperdoc // black clinic", style: "doc" },
  "ARASAKA": { role: "Security AI // corp wall", style: "corp" }
};

const STORY = [
  { title: "PROLOG", text: "Daylight in Night City feels staged. NYX calls you a ‘runner’, but the city calls you a ‘resource’." },
  { title: "FRAGMENT 01", text: "A clean access key. Too clean. Someone wants you inside Arasaka’s perimeter — fast." },
  { title: "FRAGMENT 02", text: "GHOST pings you: ‘NYX isn’t your friend. She’s a door.’" },
  { title: "FRAGMENT 03", text: "MARA mentions the sunset: ‘When the city turns orange, the scanners wake up.’" },
  { title: "FRAGMENT 04", text: "DOC K upgrades your deck and laughs: ‘Everyone wants Arasaka. Nobody wants the price.’" },
  { title: "FRAGMENT 05", text: "A corp signature: ARASAKA MAINFRAME. The route ends where the sky goes dark." }
];

let activeDialog = null;

export function openNpcDialog(node) {
  if (!node) return;

  const npc = NPCS[node.npc] || { role: "Signal", style: "default" };

  // dynamischer Fragment-Unlock (alle 2 Missionen ein neues Snippet)
  const fragIdx = Math.min(STORY.length - 1, Math.floor(game.missionsDone / 2));
  const frag = STORY[fragIdx];

  activeDialog = {
    npcName: node.npc,
    role: npc.role,
    style: npc.style,
    lines: buildLines(node, frag),
    choices: buildChoices(node)
  };

  setNpcUI(activeDialog);
}

export function npcTick(dt) {
  // Platzhalter für zukünftige Typewriter-Effekte oder Ambient-Sounds
}

function buildLines(node, frag) {
  const base = [];
  
  // Header
  base.push(`[ LOCATION: ${node.name.toUpperCase()} ]`);
  
  // Node-spezifischer Text
  if (node.type === "mission") {
    base.push(`NYX: "We do this fast. Grab data. Leave heat behind."`);
  } else if (node.type === "boss") {
    base.push(`ARASAKA: "Unauthorized signal. Containment protocols armed."`);
  } else {
    base.push(`${node.npc}: "${node.tag}"`);
  }

  // Story Fragment
  base.push(`\n— ${frag.title} —`);
  base.push(frag.text);

  // Stimmung / Tageszeit
  const p = game.globalProgress;
  let moodText = "";
  if (p < 0.35) moodText = "Mood: Clean daylight. The dirt is hidden.";
  else if (p < 0.7) moodText = "Mood: Sunset bleed. Neon fights the sun.";
  else moodText = "Mood: Night shift. City gets loud. You get hunted.";
  
  base.push(`\n${moodText}`);

  return base;
}

function buildChoices(node) {
  const c = [];

  if (node.type === "mission") {
    c.push({ id: "START", label: "Start mission [ Risk / Reward ]" });
    c.push({ id: "BARGAIN", label: "Ask for better payout [ Adds Heat ]" });
  } else if (node.type === "npc") {
    c.push({ id: "GOSSIP", label: "Ask about Arasaka route [ Story + ]" });
    c.push({ id: "CALM", label: "Lower heat [ -80 E$ ]" });
  } else if (node.type === "boss") {
    c.push({ id: "START", label: "Break through [ Boss Mission ]" });
    c.push({ id: "RETREAT", label: "Back off [ Reduce Heat slightly ]" });
  }

  return c;
}

export function handleChoice(choiceId) {
  const node = getSelected();
  if (!node) return { action: "NONE", text: "Signal lost." };

  // Aktionen auswerten
  switch (choiceId) {
    case "BARGAIN":
      game.heat = Math.min(100, game.heat + 8);
      // Hier könnte man theoretisch auch einen Multiplikator für den nächsten Payout setzen
      return { action: "TOAST", text: "NYX: 'Fine. But scanners will notice.' [ Heat +8% ]" };
      
    case "GOSSIP":
      game.frags += 1;
      return { action: "TOAST", text: "Fragment gained. [ Story +1 ]" };
      
    case "CALM":
      if (game.money >= 80) {
        game.money -= 80;
        game.heat = Math.max(0, game.heat - 15);
        return { action: "TOAST", text: "Heat cooled down. [ -80 E$, -15% Heat ]" };
      } else {
        return { action: "TOAST", text: "Insufficient funds. Need 80 E$." };
      }
      
    case "RETREAT":
      game.heat = Math.max(0, game.heat - 6);
      return { action: "TOAST", text: "Retreating. [ Heat -6% ]" };
      
    case "START":
      // Wird normalerweise direkt von der UI abgefangen und an core.startMission geschickt.
      // Falls es doch hier landet, geben wir "START" zurück, damit die UI weiß, was zu tun ist.
      return { action: "START", text: "Initializing link..." };
      
    default:
      return { action: "NONE", text: "" };
  }
          }
