// js/gamefeel.js — visuelle und sprachliche Rückmeldung für zentrale Dive-Momente
//
// Reine Präsentationsschicht: keine Balanceänderungen, keine Save-Felder und
// kein Eingriff in die Dive-State-Maschine. Bestehende Banter-/Tutorial-Texte
// behalten Vorrang; dieses Modul ergänzt nur dort Sprache, wo sie Mehrwert hat.
import { game } from "./core.js?v=0767b400";
import { setComms } from "./ui.js?v=0767b400";

const $ = (id) => document.getElementById(id);

const CREW_LINES = {
  juno: {
    close: ["Noch einmal so und ich fahr dich direkt zur Klinik.", "Das war enger als nötig."],
    boss: ["Das Ding war teuer. Jetzt ist es Schrott."],
    highTrace: ["Wir werden gesehen. Beweg deinen Arsch."]
  },
  pixel: {
    close: ["Okay, wow. Das war fast richtig dumm."],
    boss: ["HA! Der große Klotz ist geplatzt!"],
    highTrace: ["TRACE IST ROT. ROT IST SCHLECHT. RAUS DA!"]
  },
  moss: {
    close: ["Zu knapp."],
    boss: ["Ziel zerstört."],
    highTrace: ["Raus. Jetzt."]
  },
  lila: {
    close: ["Das war Dissonanz mit Glück."],
    boss: ["Schlussakkord. Laut, aber schön."],
    highTrace: ["Der Rhythmus kippt. Wir müssen raus."]
  },
  crank: {
    close: ["Das Deck riecht schon verbrannt, du Genie."],
    boss: ["Großes Teil, großer Knall. So gehört sich das."],
    highTrace: ["Die Leitung glüht. RAUS, bevor du mitglühst."]
  },
  sora: {
    close: ["Hochmut hatte heute schlechte Augen."],
    boss: ["Selbst Monster fallen, wenn man hart genug glaubt."],
    highTrace: ["Der Wolf hat deine Spur. Geh."]
  }
};

const FALLBACK_LINES = {
  close: ["Geschafft. Frag nicht, wie knapp."],
  boss: ["Kern zerstört. Das Netz hat's gespürt."],
  highTrace: ["TRACE kritisch. Noch ein Fehler und du bist Fleischabfall."]
};

let initialized = false;
let lastChoiceVisible = false;
let lastResultVisible = false;
let traceBand = 0;
let pulse = null;
let pulseTimer = 0;
let tickTimer = 0;

function successfulDives() {
  const dives = Number(game.stats?.dives || 0);
  const dumps = Number(game.stats?.dumps || 0);
  if (dives === 0 && dumps === 0 && Number(game.missionsDone || 0) > 0) {
    return Math.max(0, Number(game.missionsDone || 0));
  }
  return Math.max(0, dives - dumps);
}

function randomOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function equippedSpeaker(kind) {
  const ids = game.crew?.equipped?.filter((id) => game.crew?.roster?.[id]) || [];
  for (const id of ids) {
    const pool = CREW_LINES[id]?.[kind];
    if (pool?.length) return { name: id.toUpperCase(), line: randomOf(pool) };
  }
  return { name: "NYX", line: randomOf(FALLBACK_LINES[kind] || FALLBACK_LINES.close) };
}

function announce(kind) {
  const speaker = equippedSpeaker(kind);
  setComms(`${speaker.name}: „${speaker.line}“`);
}

function isVisible(id) {
  const el = $(id);
  return !!el && !el.classList.contains("hidden");
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
  if (pulse?.isConnected) return pulse;
  const app = $("app");
  if (!app) return null;

  pulse = document.createElement("div");
  pulse.id = "gameFeelPulse";
  pulse.innerHTML = '<div class="gfRing"></div><div class="gfText"><span id="gfMain">ICE GEBROCHEN</span><span class="gfSub" id="gfSub">BUFFER ERWEITERT</span></div>';
  app.appendChild(pulse);
  return pulse;
}

function playPulse(main, sub, boss = false) {
  const el = ensurePulse();
  if (!el) return;

  const mainEl = $("gfMain");
  const subEl = $("gfSub");
  if (mainEl) mainEl.textContent = main;
  if (subEl) subEl.textContent = sub;

  window.clearTimeout(pulseTimer);
  el.classList.remove("show", "boss");
  if (boss) el.classList.add("boss");
  void el.offsetWidth;
  el.classList.add("show");
  pulseTimer = window.setTimeout(() => el.classList.remove("show", "boss"), 760);
}

function parsePercent(text) {
  const match = String(text || "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function onChoiceShown() {
  const trace = parsePercent($("dcTrace")?.textContent);
  const clearedType = $("mHudType")?.textContent || "";
  const boss = /ICE-KERN PRIME|ICE-WÄCHTER|BOSS/i.test(clearedType);
  const dangerous = trace >= 75;

  const choice = $("diveChoice");
  if (choice) {
    choice.classList.remove("gfChoiceHit");
    void choice.offsetWidth;
    choice.classList.add("gfChoiceHit");
  }

  if (boss) {
    playPulse("KERN GEBROCHEN", "TRACE GEREINIGT · BEUTE HOCH", true);
    announce("boss");
    return;
  }

  if (dangerous) {
    playPulse("ICE GEBROCHEN", `TRACE ${trace}% · NOCH AM LEBEN`);
    // Beim ersten Dive besitzt das Onboarding die Funkfrequenz. Sonst würden
    // zwei Module gleichzeitig unterschiedliche Anweisungen ausgeben.
    if (successfulDives() > 0) announce("close");
    return;
  }

  // Der bestehende Dive-Code zeigt bereits Crew-Banter im Choice-Panel und im
  // Comms-Ticker. Hier nur der visuelle Impuls, damit keine Zeile dreifach läuft.
  playPulse("ICE GEBROCHEN", "BUFFER ERWEITERT");
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

  // dive.js warnt bereits bei 50% und 80% mit Toast + Sound. Keine zweite
  // identische Textmeldung bei 50%; nur ergänzende Crew-Reaktion bei Gefahr.
  if (band === 2) announce("highTrace");
  if (band === 3) setComms("NYX: „Neunzig Prozent. RAUS DA, bevor sie dich aus dem Netz kratzen.“");
}

function onResultShown() {
  const text = $("resText")?.textContent || "";
  if (!/JACK OUT ERFOLGREICH/i.test(text)) return;

  const result = $("result");
  if (result) {
    result.classList.remove("gfResultHit");
    void result.offsetWidth;
    result.classList.add("gfResultHit");
  }

  // Jack-Out-Banter existiert bereits in dive.js und wird im Story-Log erfasst.
  // Hier nur die visuelle Abschlussmarke, damit nichts überschrieben wird.
  playPulse("VERBINDUNG GETRENNT", "BUFFER GESICHERT");
}

function tick() {
  const choiceVisible = isVisible("diveChoice");
  if (choiceVisible && !lastChoiceVisible) onChoiceShown();
  lastChoiceVisible = choiceVisible;

  const resultVisible = isVisible("result");
  if (resultVisible && !lastResultVisible) onResultShown();
  lastResultVisible = resultVisible;

  if (game.mode !== "MISSION") traceBand = 0;
  else onTraceChanged();
}

function init() {
  if (initialized) return;
  initialized = true;
  injectStyle();
  ensurePulse();
  tickTimer = window.setInterval(tick, 120);

  window.__NEON_GAMEFEEL = {
    tick,
    pulse: playPulse,
    stop: () => window.clearInterval(tickTimer)
  };
}

function scheduleInit() {
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    window.setTimeout(init, 0);
  }
}

scheduleInit();
