// js/archetypes.js — Mission-Archetypen: geben jedem Mission-Node eine echte
// Identität statt nur "Tier + Minigame-Typ". Kein neues Dive-System — jeder
// Archetyp parametrisiert den bestehenden, bereits austarierten Dive-Loop
// (dive.js) mit einem eigenen Twist, statt ihn zu ersetzen.
export const ARCHETYPES = {
  infiltration: {
    id: "infiltration",
    name: "INFILTRATION",
    icon: "🕶",
    brief: "Rein, Loot, raus. Kein Aufsehen erregen."
    // Kein Twist — das ist der Basis-Dive-Loop, so wie er schon ausbalanciert ist.
  },
  sabotage: {
    id: "sabotage",
    name: "SABOTAGE",
    icon: "💣",
    brief: "Ziel: das ICE zerstören. Jeder Wächter-Kill zählt als Treffer — mit Extra-Bonus.",
    bossBonusFrags: 12,
    bossBonusMoney: 20
  },
  heist: {
    id: "heist",
    name: "HEIST",
    icon: "💰",
    brief: "Große Beute, große Aufmerksamkeit. Mehr Loot, aber der Trace steigt schneller.",
    lootMult: 1.35,
    traceMult: 1.25
  },
  escort: {
    id: "escort",
    name: "ESCORT",
    icon: "📦",
    brief: "Fracht sichern. Kein Jack Out vor Layer 3 — die Ladung muss erst stabil sein.",
    minJackoutLayer: 3,
    fragsPerLayerBonus: 3
  },
  intel: {
    id: "intel",
    name: "INTEL",
    icon: "📡",
    brief: "Daten zählen mehr als Eddies. Signal-Relais tauchen häufiger auf.",
    fragMult: 1.5,
    lootMult: 0.75,
    traceTypeBias: 3
  }
};

export function getArchetype(id) {
  return ARCHETYPES[id] || ARCHETYPES.infiltration;
}
