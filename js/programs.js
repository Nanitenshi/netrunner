// js/programs.js — Programme: verbrauchbare Dive-Items (im Gegensatz zu
// Crew-Actives und der Build-Signature, die pro Dive unbegrenzt/1x nutzbar
// sind, ist der Vorrat hier begrenzt und wird mit Eddies im GEAR-Tab
// nachgekauft).
export const PROGRAMS = {
  panic: {
    id: "panic", name: "PANIC.EXE", icon: "🚨",
    desc: "Trace sofort -25.", cost: 50,
    use: (d) => {
      d.trace = Math.max(0, d.trace - 25);
      return "Trace -25";
    }
  },
  boost: {
    id: "boost", name: "BOOST.EXE", icon: "⏱",
    desc: "+8 Sekunden auf den aktuellen Layer.", cost: 60,
    use: (d) => {
      d.mg.addTime?.(8);
      return "+8s";
    }
  },
  decoy: {
    id: "decoy", name: "DECOY.EXE", icon: "🎭",
    desc: "Nächster Fehler in diesem Layer wird vergeben (sonst Trace -6).", cost: 70,
    use: (d) => d.mg.assist?.("forgive")
      ? "Nächster Fehler vergeben"
      : (d.trace = Math.max(0, d.trace - 6), "Trace -6")
  }
};
