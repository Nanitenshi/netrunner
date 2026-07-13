// js/skills.js — kleine Skilltrees: ein immer aktiver "Allgemein"-Tree plus
// ein Tree pro Hacker-Build (Ghost/Combat/Data), thematisch an das jeweilige
// Build gekoppelt, aber unabhängig vom aktuell gewählten Build wirksam —
// eine dauerhafte Investition on top von Build/Crew/Gear. Jeder Skill hängt
// an einem Stat, den computeMods() in crew.js bereits kennt.
//
// Onboarding und Game-Feel sind optionale Präsentationsmodule. Sie dürfen die
// Kerninitialisierung niemals blockieren. Statische Imports erzeugten hier den
// Zyklus core → skills → onboarding/gamefeel → core und konnten Android schon
// vor boot() mit einer TDZ-Exception stoppen. Deshalb erst nach Abschluss des
// aktuellen Modulladevorgangs nachladen und Fehler ausdrücklich abfangen.
window.setTimeout(() => {
  import("./onboarding.js").catch((error) => {
    console.error("[ONBOARDING] Optionales Modul konnte nicht geladen werden:", error);
  });
  import("./gamefeel.js").catch((error) => {
    console.error("[GAMEFEEL] Optionales Modul konnte nicht geladen werden:", error);
  });
}, 0);

export const SKILL_TREES = {
  general: {
    name: "ALLGEMEIN",
    icon: "◈",
    desc: "Wirkt immer, unabhängig vom gewählten Build.",
    skills: {
      streetSense: { name: "Street Sense", desc: "+4% Loot-Chance pro Stufe", stat: "lootMult", perLevel: 0.04, costs: [10, 20, 35] },
      blackMarket: { name: "Schwarzmarkt Kontakte", desc: "-8% Programmpreise pro Stufe", stat: "programDiscount", perLevel: 0.08, costs: [15, 30, 50] },
      failsafe: { name: "Notfall-Backup", desc: "+5% Buffer-Rettung bei Dump pro Stufe", stat: "salvage", perLevel: 0.05, costs: [15, 30, 50] }
    }
  },
  ghost: {
    name: "GHOST",
    icon: "👻",
    desc: "Passt zum GHOST-RUNNER-Build, wirkt aber bei jedem Build.",
    skills: {
      ghostProtocol: { name: "Ghost Protocol", desc: "-4% Trace-Anstieg pro Stufe", stat: "traceCut", perLevel: 0.04, costs: [20, 40, 70] },
      neuralBoost: { name: "Neural Boost", desc: "+1s Layer-Timer pro Stufe", stat: "timeBonus", perLevel: 1, costs: [15, 30, 50] },
      phantomVeil: { name: "Phantom Veil", desc: "-4 Start-Trace pro Stufe", stat: "startTrace", perLevel: 4, costs: [20, 35, 55] }
    }
  },
  combat: {
    name: "COMBAT",
    icon: "⚔",
    desc: "Passt zum COMBAT-RUNNER-Build, wirkt aber bei jedem Build.",
    skills: {
      reflex: { name: "Reflex Booster", desc: "+6% größere Trefferzonen pro Stufe", stat: "ringScale", perLevel: 0.06, costs: [10, 20, 35] },
      overclockCore: { name: "Overclock Core", desc: "+5 Trace-Abbau pro ICE-Kill, pro Stufe", stat: "bossTraceBonus", perLevel: 5, costs: [25, 45, 70] },
      lastStand: { name: "Last Stand", desc: "+1 vergebener Fehler pro Layer", stat: "forgive", perLevel: 1, costs: [40] }
    }
  },
  data: {
    name: "DATA",
    icon: "💾",
    desc: "Passt zum DATA-THIEF-Build, wirkt aber bei jedem Build.",
    skills: {
      dataMining: { name: "Data Mining", desc: "+1 ◆ pro Layer, pro Stufe", stat: "fragsPerLayer", perLevel: 1, costs: [25, 45] },
      deepCache: { name: "Deep Cache", desc: "+6% Loot-Chance pro Stufe", stat: "lootMult", perLevel: 0.06, costs: [20, 35, 55] },
      failover: { name: "Failover", desc: "+1 Wiederbelebung nach Dump", stat: "revive", perLevel: 1, costs: [45] }
    }
  }
};

export function freshSkillLevels() {
  const out = {};
  for (const [treeId, tree] of Object.entries(SKILL_TREES)) {
    out[treeId] = {};
    for (const skillId of Object.keys(tree.skills)) out[treeId][skillId] = 0;
  }
  return out;
}

// Rein additiv auf ein bereits initialisiertes computeMods()-Objekt — wird
// aus crew.js nach Crew/Gear/Build angewendet, damit alle vier Quellen
// gleichberechtigt stapeln.
export function applySkillMods(m, levels) {
  for (const [treeId, tree] of Object.entries(SKILL_TREES)) {
    const lv = levels?.[treeId];
    if (!lv) continue;
    for (const [skillId, skill] of Object.entries(tree.skills)) {
      const level = lv[skillId] || 0;
      if (!level) continue;
      const v = skill.perLevel * level;
      switch (skill.stat) {
        case "lootMult": m.lootMult += v; break;
        case "programDiscount": m.programDiscount += v; break;
        case "salvage": m.salvage += v; break;
        case "traceCut": m.traceMult -= v; break;
        case "timeBonus": m.timeBonus += v; break;
        case "startTrace": m.startTrace += v; break;
        case "ringScale": m.ringScale += v; break;
        case "bossTraceBonus": m.bossTraceBonus += v; break;
        case "forgive": m.forgive += Math.round(v); break;
        case "fragsPerLayer": m.fragsPerLayer += v; break;
        case "revive": m.revive += Math.round(v); break;
      }
    }
  }
}
