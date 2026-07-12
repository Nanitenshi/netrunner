// js/ice.js — ICE-Klassen: gibt den 5 Minigame-Typen (+ Sonderfällen) eine
// erkennbare Gegner-Identität, statt dass sich jeder Layer wie derselbe
// generische Ring-Tipp-Test anfühlt.
export const ICE_CLASSES = {
  cache:     { icon: "💰", enemy: "SCAVENGER-ICE", threat: "Reflex-Wächter. Jagt schnelle Ziele, streut Köder." },
  wires:     { icon: "🧠", enemy: "MEMORY-ICE",    threat: "Merkt sich Muster. Bricht nur bei perfektem Gedächtnis." },
  breach:    { icon: "🔐", enemy: "BARRIER-ICE",   threat: "Exakte Reihenfolge — oder Reset." },
  pulse:     { icon: "📡", enemy: "SENTRY-ICE",    threat: "Reagiert nur im perfekten Timing-Fenster." },
  trace:     { icon: "👁", enemy: "WATCHER-ICE",   threat: "Aktive Verfolgung, wird mit der Tiefe schneller." },
  ghost:     { icon: "👻", enemy: "PHANTOM-SIGNAL", threat: "Kein reguläres ICE — unbekanntes Muster." },
  boss_mini: { icon: "⚠",  enemy: "ICE-WÄCHTER",   threat: "Boss-ICE. Zerstören senkt den Trace deutlich." },
  boss_big:  { icon: "⚠⚠", enemy: "ICE-KERN PRIME", threat: "Kern-ICE. Alles oder nichts, drei Phasen." }
};

// Rang skaliert sichtbar mit der Tiefe — dasselbe ICE fühlt sich in Layer 20
// spürbar bedrohlicher an als in Layer 1, auch wenn's mechanisch dasselbe
// Minigame bleibt.
export function iceRank(tier, layer) {
  const eff = (tier || 1) + (layer || 1) * 0.4;
  if (eff >= 9) return "MK4";
  if (eff >= 6) return "MK3";
  if (eff >= 3.5) return "MK2";
  return "MK1";
}

export function iceLabel(type, tier, layer) {
  const c = ICE_CLASSES[type];
  if (!c) return (type || "?").toUpperCase();
  return `${c.icon} ${c.enemy} ${iceRank(tier, layer)}`;
}
