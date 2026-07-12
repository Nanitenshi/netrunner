// js/builds.js — Hacker-Builds: einmal wählbare, jederzeit wechselbare
// Spielstil-Identität, unabhängig von Crew und Gear. Jeder Build gibt einen
// passiven Bonus (fließt in computeMods() ein) und eine exklusive
// Signature-Fähigkeit in der Dive-Ability-Leiste.
export const BUILDS = {
  ghost: {
    id: "ghost",
    name: "GHOST RUNNER",
    tag: "Langsam entdeckt, hohe Kontrolle",
    desc: "Tarnung statt Tempo: deutlich weniger Trace-Anstieg in jedem Dive.",
    passiveText: "-18% Trace-Anstieg (dauerhaft)",
    mods: { traceCut: 0.18 },
    active: {
      name: "CLOAK",
      desc: "Trace sofort -20, einmal pro Dive.",
      use: (d) => {
        d.trace = Math.max(0, d.trace - 20);
        return "Trace -20 (CLOAK)";
      }
    }
  },
  combat: {
    id: "combat",
    name: "COMBAT RUNNER",
    tag: "Aggressiv, zerstört ICE",
    desc: "Bricht sich mit Gewalt durch: ein Fehler bei BREACH wird verziehen, und ICE-Kerne senken den Trace beim Zerstören stärker.",
    passiveText: "Breach: 1 Fehler verziehen · ICE-Kills: -15 Trace extra",
    mods: { forgive: 1, bossTraceBonus: 15 },
    active: {
      name: "OVERCLOCK",
      desc: "+6 Sekunden auf den aktuellen Layer-Timer.",
      use: (d) => {
        d.mg.addTime?.(6);
        return "+6s (OVERCLOCK)";
      }
    }
  },
  data: {
    id: "data",
    name: "DATA THIEF",
    tag: "Mehr Loot, mehr Risiko",
    desc: "Reines Loot-Build: deutlich mehr Eddies und Frags pro Layer. Der Trace steigt dabei ganz normal weiter.",
    passiveText: "+18% Loot · +1 ◆ pro Layer (dauerhaft)",
    mods: { lootMult: 0.18, fragsPerLayer: 1 },
    active: {
      name: "BIG SIPHON",
      desc: "Sofortiger Loot-Schub in den Buffer.",
      use: (d) => {
        const e = Math.round(60 * (1 + 0.3 * (d.layer - 1)));
        d.bufferE += e;
        return `+${e} E$ (SIPHON)`;
      }
    }
  }
};

export function getBuild(id) {
  return BUILDS[id] || null;
}
