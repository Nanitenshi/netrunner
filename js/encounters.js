// js/encounters.js — Zufällige Straßen-Begegnungen: macht die Overworld
// reaktiv statt nur hübsch. Pro Bezirk eigener Encounter-Pool (Polizei/
// Militech-Kontrollen, Gang-Wegzoll, Corpo-Scouts, versteckte Funde,
// Straßen-Alltag), ausgelöst mit Cooldown während man in der Stadt läuft.
// Bewusst dieselbe zwei-Optionen-Choice-UI wie die Dive-Events/Firewalls
// (dive.js) — bewährtes, getestetes Muster, nur auf die Overworld gemünzt.
import { game } from "./core.js";
import { toast, bindFastPress, renderStoryLog } from "./ui.js";
import { saveNow } from "./save.js";

const $ = (id) => document.getElementById(id);

const ENCOUNTERS = {
  neon: [
    {
      name: "STRASSENHÄNDLER",
      desc: "„Frische Ware, heute günstig.“ Ein Dealer hält dir die Hand hin. Sieht nach echtem Zeug aus. Vielleicht.",
      a: { label: "KAUFEN (-20 E$)", fn: (g) => {
        if (g.money < 20) return "Zu wenig Eddies. Er zuckt mit den Schultern.";
        g.money -= 20;
        if (Math.random() < 0.6) { g.frags += 6; return "Gutes Zeug. +6 ◆"; }
        return "Fake. Weg sind die Eddies.";
      } },
      b: { label: "WEITERGEHEN", fn: () => "Du gehst weiter. Sicher ist sicher." }
    },
    {
      name: "STRASSENMUSIKERIN",
      desc: "Jemand spielt Synth an der Ecke. Klingt fast wie LILA, aber jünger. Du könntest was dalassen.",
      a: { label: "GEBEN (-10 E$)", fn: (g) => {
        g.money = Math.max(0, g.money - 10);
        g.psychosis = Math.max(0, g.psychosis - 4);
        return "Sie nickt dir zu. Kopf etwas leiser.";
      } },
      b: { label: "WEITERGEHEN", fn: () => "Du gehst weiter." }
    }
  ],
  downtown: [
    {
      name: "NCPD-STREIFE",
      desc: "Eine Streife scannt Passanten routinemäßig. Du fällst nicht sofort auf. Noch nicht.",
      a: { label: "RUHIG BLEIBEN", fn: (g) => {
        if (Math.random() < 0.75) return "Sie scannen durch. Nichts auffällig.";
        g.heat = Math.min(100, g.heat + 6);
        return "Kurzer Blick zu lang gehalten. Heat +6.";
      } },
      b: { label: "SEITENGASSE NEHMEN", fn: (g) => {
        g.heat = Math.max(0, g.heat - 2);
        return "Umweg genommen. Kein Risiko, kleine Verzögerung.";
      } }
    },
    {
      name: "CORPO-SCOUT",
      desc: "Ein Scout in Businesskleidung mustert dich. „Talent wie deins ist gefragt. Interesse?“",
      a: { label: "ZUHÖREN", fn: (g) => {
        const e = 15 + Math.round(Math.random() * 15);
        g.money += e;
        return `Kontaktdaten und etwas Vorschuss. +${e} E$`;
      } },
      b: { label: "ABLEHNEN", fn: () => "Du gehst weiter. Riecht nach Vertrag mit Kleingedrucktem." }
    }
  ],
  corporate: [
    {
      name: "MILITECH DURCHSUCHT PASSANTEN",
      desc: "Sie kontrollieren jeden auf dieser Straße. Verstecken bricht auf, mitmachen bedeutet einen genauen Blick.",
      a: { label: "VERSTECKEN", fn: (g) => {
        if (Math.random() < 0.6) return "Nicht bemerkt. Puls trotzdem hoch.";
        g.heat = Math.min(100, g.heat + 8);
        return "Auffällig weggeduckt. Heat +8.";
      } },
      b: { label: "MITMACHEN", fn: (g) => {
        if (Math.random() < 0.7) return "Sauber durch. Langweiliger Tag für sie.";
        g.heat = Math.min(100, g.heat + 12);
        return "Zu genauer Blick auf dein Deck. Heat +12.";
      } }
    },
    {
      name: "ÜBERWACHUNGS-DROHNE",
      desc: "Eine Drohne kreist tiefer als normal. Vielleicht Zufall.",
      a: { label: "BLICKKONTAKT VERMEIDEN", fn: (g) => {
        g.heat = Math.max(0, g.heat - 3);
        return "Sie zieht weiter.";
      } },
      b: { label: "IGNORIEREN", fn: () => "Wahrscheinlich Zufall." }
    }
  ],
  industrial: [
    {
      name: "GANG-WEGZOLL",
      desc: "Zwei Typen mit improvisierten Werkzeug-Waffen blockieren die Route. „Zoll oder Umweg.“",
      a: { label: "ZAHLEN (-25 E$)", fn: (g) => {
        g.money = Math.max(0, g.money - 25);
        return "Bezahlt. Sie lassen dich durch.";
      } },
      b: { label: "DURCHSCHLAGEN", fn: (g) => {
        if (Math.random() < 0.5) return "Sie weichen zurück.";
        g.psychosis = Math.min(100, g.psychosis + 10);
        return "Kurzes Handgemenge. Nichts Ernstes, aber es nagt.";
      } }
    },
    {
      name: "VERSTECKTER FUND",
      desc: "Zwischen Schrott und Rost liegt eine halb vergrabene Kiste.",
      a: { label: "DURCHSUCHEN", fn: (g) => {
        const e = 20 + Math.round(Math.random() * 25);
        g.money += e;
        return `Alte Vorräte, noch was drin. +${e} E$`;
      } },
      b: { label: "LIEGEN LASSEN", fn: () => "Vielleicht Falle. Du lässt sie liegen." }
    }
  ],
  slums: [
    {
      name: "SCHUTZGELD",
      desc: "„Das ist unser Block.“ Nicht aggressiv, nur... bestimmt.",
      a: { label: "ZAHLEN (-15 E$)", fn: (g) => {
        g.money = Math.max(0, g.money - 15);
        return "Sie nicken. Nächstes Mal auch.";
      } },
      b: { label: "ABLEHNEN", fn: (g) => {
        if (Math.random() < 0.55) return "Sie lassen es diesmal gut sein.";
        g.heat = Math.min(100, g.heat + 5);
        return "Kurzer Wortwechsel. Jemand hat's gemeldet. Heat +5.";
      } }
    },
    {
      name: "VERSTECKTER ORT",
      desc: "Eine lose Bodenplatte hinter einem der Häuser. Jemand hat hier was gebunkert.",
      a: { label: "NACHSEHEN", fn: (g) => {
        const f = 5 + Math.round(Math.random() * 6);
        g.frags += f;
        return `Alte Frag-Cache. +${f} ◆`;
      } },
      b: { label: "IN RUHE LASSEN", fn: () => "Nicht deins. Du lässt es." }
    }
  ],
  undercity: [
    {
      name: "FLÜSTERN IM SIGNAL",
      desc: "Für eine Sekunde hörst du etwas, das keine Stimme sein sollte, im toten Kanal.",
      a: { label: "ZUHÖREN", fn: (g) => {
        g.psychosis = Math.min(100, g.psychosis + 6);
        return "Es hat aufgehört. Du weißt nicht, was es war.";
      } },
      b: { label: "ABSCHALTEN", fn: (g) => {
        g.psychosis = Math.max(0, g.psychosis - 2);
        return "Signal weg. Besser so.";
      } }
    },
    {
      name: "ICE-SUCHTRUPP",
      desc: "Selten hier unten, aber heute patrouilliert jemand mit Konzern-Ausrüstung.",
      a: { label: "SCHATTEN NUTZEN", fn: (g) => {
        if (Math.random() < 0.7) return "Vorbeigezogen. Sie suchen jemand anderen.";
        g.heat = Math.min(100, g.heat + 7);
        return "Kurz erfasst. Heat +7.";
      } },
      b: { label: "WARTEN", fn: (g) => {
        g.heat = Math.max(0, g.heat - 1);
        return "Du wartest, bis es ruhig ist.";
      } }
    }
  ]
};

let cooldown = 40 + Math.random() * 30;
let active = null;

function overlayOpen() {
  return !$("crewOverlay")?.classList.contains("hidden")
    || !$("pauseMenu")?.classList.contains("hidden")
    || !$("tutorial")?.classList.contains("hidden")
    || $("rightPanel")?.classList.contains("open")
    || $("leftPanel")?.classList.contains("open");
}

export function encounterActive() {
  return !!active;
}

export function encounterTick(dt, districtId) {
  if (active || game.mode !== "WORLD" || game.paused) return;

  cooldown -= dt;
  if (cooldown > 0) return;
  // ~55–110s bis zum nächsten Check, und selbst dann nur 50% Trefferchance —
  // die Stadt soll reagieren, nicht nerven
  cooldown = 55 + Math.random() * 55;
  if (Math.random() < 0.5) return;
  if (overlayOpen()) return;

  const pool = ENCOUNTERS[districtId];
  if (!pool || !pool.length) return;

  active = pool[Math.floor(Math.random() * pool.length)];
  render();
}

function render() {
  const box = $("worldEncounter");
  if (!box || !active) return;

  const t = $("weTitle");
  if (t) t.textContent = active.name;
  const d = $("weDesc");
  if (d) d.textContent = active.desc;
  const a = $("btnWeA");
  if (a) a.textContent = active.a.label;
  const b = $("btnWeB");
  if (b) b.textContent = active.b.label;

  box.classList.remove("hidden");
}

function resolve(pick) {
  if (!active) return;

  const opt = pick === "a" ? active.a : active.b;
  const msg = opt.fn(game);

  game.storyLog.unshift(`> ${active.name}: ${msg}`);
  if (game.storyLog.length > 60) game.storyLog.length = 60;
  renderStoryLog();
  toast(msg);

  active = null;
  $("worldEncounter")?.classList.add("hidden");
  saveNow();
}

export function initEncounters() {
  bindFastPress($("btnWeA"), () => resolve("a"));
  bindFastPress($("btnWeB"), () => resolve("b"));

  // Debug-/Test-Zugriff
  window.__NEON_ENCOUNTER = {
    active: () => active,
    force: (districtId) => {
      const pool = ENCOUNTERS[districtId];
      if (!pool || !pool.length) return false;
      active = pool[Math.floor(Math.random() * pool.length)];
      render();
      return true;
    }
  };
}
