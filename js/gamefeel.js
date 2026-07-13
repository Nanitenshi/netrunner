// js/gamefeel.js — visuelle und sprachliche Rückmeldung für zentrale Dive-Momente
//
// Bewusst als dünne Präsentationsschicht gebaut: keine Balanceänderungen, keine
// Save-Felder, kein Eingriff in die Dive-State-Maschine. Das Modul beobachtet
// bereits vorhandene HUD-/Result-Elemente und verstärkt nur deren Wirkung.
import { game } from "./core.js";
import { setComms } from "./ui.js";

const $ = (id) => document.getElementById(id);

const CREW_LINES = {
  juno: {
    clean: ["Sauber. Genau so.", "Paket sitzt. Kein Kratzer."],
    close: ["Noch einmal so und ich fahr dich direkt zur Klinik.", "Das war enger als nötig."],
    boss: ["Das Ding war teuer. Jetzt ist es Schrott."],
    highTrace: ["Wir werden gesehen. Beweg deinen Arsch."],
    jackout: ["Sauber raus. Beute lebt, du auch."]
  },
  pixel: {
    clean: ["EASY. Sag bloß nicht, du wirst besser."],
    close: ["Okay, wow. Das war fast richtig dumm."],
    boss: ["HA! Der große Klotz ist geplatzt!"],
    highTrace: ["TRACE IST ROT. ROT IST SCHLECHT. RAUS DA!"],
    jackout: ["Buh, vernünftig. Aber reich vernünftig."]
  },
  moss: {
    clean: ["Sauber."],
    close: ["Zu knapp."],
    boss: ["Ziel zerstört."],
    highTrace: ["Raus. Jetzt."],
    jackout: ["Gute Entscheidung."]
  },
  lila: {
    clean: ["Perfekter Takt. Kein Ton daneben."],
    close: ["Das war Dissonanz mit Glück."],
    boss: ["Schlussakkord. Laut, aber schön."],
    highTrace: ["Der Rhythmus kippt. Wir müssen raus."],
    jackout: ["Und Schluss. Beute im Takt gesichert."]
  },
  crank: {
    clean: ["Läuft. Fass bloß nichts an."],
    close: ["Das Deck riecht schon verbrannt, du Genie."],
    boss: ["Großes Teil, großer Knall. So gehört sich das."],
    highTrace: ["Die Leitung glüht. RAUS, bevor du mitglühst."],
    jackout: ["Brav. Lieber Beute als Beerdigung."]
  },
  sora: {
    clean: ["Gnade im Datenstrom. Selten genug."],
    close: ["Hochmut hatte heute schlechte Augen."],
    boss: ["Selbst Monster fallen, wenn man hart genug glaubt."],
    highTrace: ["Der Wolf hat deine Spur. Geh."],
    jackout: ["Weise. Gier kann warten."]
  }
};

const FALLBACK_LINES = {
  clean: ["ICE gebrochen. Keine Spur hinterlassen."],
  close: ["Geschafft. Frag nicht, wie knapp."],
  boss: ["Kern zerstört. Das Netz hat's gespürt."],
  highTrace: ["TRACE kritisch. Noch ein Fehler und du bist Fleischabfall."],
  jackout: ["Verbindung getrennt. Buffer gesichert."]
};

let lastChoiceVisible = false;
let lastResultVisible = false;
let traceBand = 0;
let pulse = null;

function randomOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function equippedSpeaker(kind) {
  const ids = game.crew?.equipped?.filter((id) => game.crew?.roster?.[id]) || [];
  for (const id of ids) {
    const pool = CREW_LINES[id]?.[kind];
    if (pool?.length) return { name: id.toUpperCase(), line: randomOf(pool) };
  }
  return { name: "NYX", line: randomOf(FALLBACK_LINES[kind] || FALLBACK_LINES.clean) };
}

function injectStyle() {
  if ($("gameFeelStyle")) return;
  const style = document.createElement("style");
  style.id = "gameFeelStyle";
  style.textContent = `
    #gameFeelPulse {
      position:absolute; inset:0; z-index:55; pointer-events:none; display:none;
      align-items:center; justify-content:center; overflow:hidden;
    }
    #gameFeelPulse.show { display:flex; animation:gfFade .72s ease-out both; }
    #gameFeelPulse .gfRing {
      width:48vmin; height:48vmin; max-width:420px; max-height:420px;
      border:2px solid rgba(252,238,10,.9); border-radius:50%;
      box-shadow:0 0 40px rgba(252,238,10,.4), inset 0 0 40px rgba(252,238,10,.18);
      animation:gfRing .62s ease-out both;
    }
    #gameFeelPulse.boss .gfRing {
      border-color:rgba(255,0,124,.95);
      box-shadow:0 0 70px rgba(255,0,124,.55), inset 0 0 50px rgba(255,0,124,.25);
    }
    #gameFeelPulse .gfText {
      position:absolute; text-align:center; font-weight:900; letter-spacing:.16em;
      font-size:clamp(24px,7vw,58px); text-shadow:0 0 18px currentColor;
      color:#fcee0a; transform:skew(-4deg);
    }
    #gameFeelPulse.boss .gfText { color:#ff007c; }
    #gameFeelPulse .gfSub {
      display:block; margin-top:8px; font-size:clamp(11px,2.5vw,16px);
      letter-spacing:.08em; color:#d9e0e8; text-shadow:none;
    }
    #diveChoice.gfChoiceHit .overlayCard { animation:gfChoice .38s ease-out both; }
    #result.gfResultHit .card { animation:gfResult .5s ease-out both; }
    #mHudTrace.gfWarn { animation:gfTrace .55s ease-in-out 2; }
    @keyframes gfRing { from{transform:scale(.15);opacity:1} to{transform:scale(1.8);opacity:0} }
    @keyframes gfFade { 0%{background:rgba(252,238,10,.12)} 100%{background:rgba(0,0,0,0)} }
    @keyframes gfChoice { 0%{transform:scale(.96);filter:brightness(1.8)} 100%{transform:scale(1);filter:none} }
    @keyframes gfResult { 0%{transform:translateY(14px) scale(.97);filter:brightness(1.7)} 100%{transform:none;filter:none} }
    @keyframes gfTrace { 50%{color:#ff315f;text-shadow:0 0 18px #ff003c} }
    @media (prefers-reduced-motion: reduce) {
      #gameFeelPulse.show, #gameFeelPulse .gfRing, #diveChoice.gfChoiceHit .overlayCard,
      #result.gfResultHit .card, #mHudTrace.gfWarn { animation:none !important; }
    }
  `;
  document.head.appendChild(style);
}

function ensurePulse() {
  if (pulse) return pulse;
  const app = $("app");
  if (!app) return null;
  pulse = document.createElement("div");
  pulse.id = "gameFeelPulse";
  pulse.innerHTML = '<div class="gfRing"></div><div class="gfText"><span id="gfMain">ICE GEBROCHEN</span><span class="gfSub" id="gfSub">BUFFER EXTRAHIERT</span></div>';
  app.appendChild(pulse);
  return pulse;
}

function playPulse(main, sub, boss = false) {
  const el = ensurePulse();
  if (!el) return;
  $("gfMain").textContent = main;
  $("gfSub").textContent = sub;
  el.classList.remove("show", "boss");
  if (boss) el.classList.add("boss");
  void el.offsetWidth;
  el.classList.add("show");
  window.setTimeout(() => el.classList.remove("show", "boss"), 760);
}

function announce(kind) {
  const speaker = equippedSpeaker(kind);
  setComms(`${speaker.name}: „${speaker.line}“`);
}

function parsePercent(text) {
  const m = String(text || "").match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function onChoiceShown() {
  const trace = parsePercent($("dcTrace")?.textContent);
  // mHudType beschreibt den gerade abgeschlossenen Gegner. dcNext beschreibt
  // bereits den nächsten Layer und darf deshalb keinen verfrühten Boss-Sieg
  // auslösen.
  const clearedType = $("mHudType")?.textContent || "";
  const boss = /ICE-KERN PRIME|ICE-WÄCHTER|BOSS/i.test(clearedType);
  const dangerous = trace >= 75;

  const choice = $("diveChoice");
  choice?.classList.remove("gfChoiceHit");
  void choice?.offsetWidth;
  choice?.classList.add("gfChoiceHit");

  if (boss) {
    playPulse("KERN GEBROCHEN", "TRACE GEREINIGT · BEUTE HOCH", true);
    announce("boss");
  } else if (dangerous) {
    playPulse("ICE GEBROCHEN", `TRACE ${trace}% · NOCH AM LEBEN`);
    announce("close");
  } else {
    playPulse("ICE GEBROCHEN", "BUFFER ERWEITERT");
    announce("clean");
  }
}

function onTraceChanged() {
  const el = $("mHudTrace");
  if (!el || game.mode !== "MISSION") return;
  const trace = parsePercent(el.textContent);
  const band = trace >= 90 ? 3 : trace >= 75 ? 2 : trace >= 50 ? 1 : 0;
  if (band <= traceBand) return;
  traceBand = band;

  el.classList.remove("gfWarn");
  void el.offsetWidth;
  el.classList.add("gfWarn");

  if (band === 1) setComms("NYX: „Erste Suchroutinen sind wach. Werd nicht übermütig.“");
  if (band === 2) announce("highTrace");
  if (band === 3) setComms("NYX: „Neunzig Prozent. RAUS DA, bevor sie dich aus dem Netz kratzen.“");
}

function onResultShown() {
  const text = $("resText")?.textContent || "";
  if (!/JACK OUT ERFOLGREICH|Gesichert:/i.test(text)) return;

  const result = $("result");
  result?.classList.remove("gfResultHit");
  void result?.offsetWidth;
  result?.classList.add("gfResultHit");

  playPulse("VERBINDUNG GETRENNT", "BUFFER GESICHERT");
  announce("jackout");
}

function tick() {
  const choiceVisible = !$("diveChoice")?.classList.contains("hidden");
  if (choiceVisible && !lastChoiceVisible) onChoiceShown();
  lastChoiceVisible = choiceVisible;

  const resultVisible = !$("result")?.classList.contains("hidden");
  if (resultVisible && !lastResultVisible) onResultShown();
  lastResultVisible = resultVisible;

  if (game.mode !== "MISSION") traceBand = 0;
  else onTraceChanged();
}

function init() {
  injectStyle();
  ensurePulse();
  window.setInterval(tick, 120);
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
