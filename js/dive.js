// js/dive.js — Push-your-luck Dive-Loop mit Layer-Modifikatoren, Events und Crew-Actives
import { game } from "./core.js";
import { toast, bindFastPress } from "./ui.js";
import { createMinigame, MG_TYPES, clearParticles } from "./missions.js";
import { computeMods, banter, banterLine, getChar } from "./crew.js";
import { getBuild } from "./builds.js";
import { ICE_CLASSES, iceLabel } from "./ice.js";
import { PROGRAMS } from "./programs.js";
import { getArchetype } from "./archetypes.js";
import { saveNow } from "./save.js";
import { sfx } from "./sfx.js";

const $ = (id) => document.getElementById(id);

let paused = false;
let dive = null;
// Kurze Eingabesperre nach Layer-Start/Unpause: der Finger, der gerade noch
// GO DEEPER / RESUME gedrückt hat, darf nicht als Spiel-Tap durchschlagen
// (gemeldeter Bug: "random Berührung, die ich nicht getätigt habe")
let inputGraceUntil = 0;

export function diveSetPaused(p) {
  paused = !!p;
  if (!paused) inputGraceUntil = performance.now() + 300;
}
export function diveCancelPointer() {}

// Harter Abbruch aus dem Pausenmenü: Dive verwerfen ohne Reward-Pipeline.
// Buffer ist bewusst weg — der Button sagt das ehrlich dazu.
export function diveAbort() {
  if (!dive) return;
  dive = null;
  hideAbilityBar();
  hideProgramBar();
  clearParticles();
}

/* ---------------- Layer-Modifikatoren ---------------- */
const LAYER_MODS = [
  { id: "none",     name: "STANDARD",       desc: "Nichts Auffälliges.",              loot: 1,   trace: 1,   time: 1,    w: 34 },
  { id: "rich",     name: "FETTE BEUTE",    desc: "+60% Loot.",                       loot: 1.6, trace: 1,   time: 1,    w: 16 },
  { id: "hotline",  name: "HEISSE LEITUNG", desc: "+25% Loot, aber Trace +50%.",      loot: 1.25,trace: 1.5, time: 1,    w: 14 },
  { id: "dark",     name: "DUNKEL-LAYER",   desc: "25% weniger Zeit.",                loot: 1.2, trace: 1,   time: 0.75, w: 12 },
  { id: "unstable", name: "INSTABIL",       desc: "Loot x2, Trace x2. Jackpot oder Absturz.", loot: 2, trace: 2, time: 1, w: 9 },
  { id: "clean",    name: "SAUBERE ROUTE",  desc: "Trace -40%.",                      loot: 1,   trace: 0.6, time: 1,    w: 15 }
];

function rollLayerMod() {
  const total = LAYER_MODS.reduce((s, m) => s + m.w, 0);
  let r = Math.random() * total;
  for (const m of LAYER_MODS) {
    r -= m.w;
    if (r <= 0) return m;
  }
  return LAYER_MODS[0];
}

/* ---------------- Dive-Events (Zufalls-Entscheidungen) ---------------- */
const EVENTS = [
  {
    id: "leak",
    name: "DATENLECK ENTDECKT",
    desc: "Ein ungesicherter Cache direkt neben deiner Route. Schnell abgreifen?",
    a: {
      label: "ABGREIFEN (+E$, +Trace)",
      fn: (d) => {
        const e = Math.round(50 * depthMult(d.layer) * d.mods.lootMult);
        d.bufferE += e;
        d.trace = Math.min(99, d.trace + 10);
        return `+${e} E$ · Trace +10`;
      }
    },
    b: { label: "WEITERGEHEN", fn: () => "Du lässt es liegen." }
  },
  {
    id: "backdoor",
    name: "ALTE BACKDOOR",
    desc: "Eine vergessene Runner-Route. Kühlt den Trace, aber du verlierst Buffer beim Umweg.",
    a: {
      label: "NUTZEN (-25 Trace, -20% Buffer)",
      fn: (d) => {
        const lost = Math.round(d.bufferE * 0.2);
        d.bufferE -= lost;
        d.trace = Math.max(0, d.trace - 25);
        return `Trace -25 · Buffer -${lost} E$`;
      }
    },
    b: { label: "IGNORIEREN", fn: () => "Du bleibst auf der Route." }
  },
  {
    id: "gamble",
    name: "KÖDER-SERVER",
    desc: "Riecht nach Falle. Oder nach Jackpot. 50/50.",
    a: {
      label: "RISKIEREN (Jackpot oder Trace +22)",
      fn: (d) => {
        if (Math.random() < 0.5) {
          const e = Math.round(90 * depthMult(d.layer) * d.mods.lootMult);
          d.bufferE += e;
          sfx.jackout();
          return `JACKPOT! +${e} E$`;
        }
        d.trace = Math.min(99, d.trace + 22);
        sfx.bad();
        return "FALLE! Trace +22.";
      }
    },
    b: { label: "FINGER WEG", fn: () => "Klug. Wahrscheinlich." }
  },
  {
    id: "trader",
    name: "FREMDES SIGNAL",
    desc: "Ein anderer Runner bietet Tausch: Frags gegen einen Teil deiner Eddies.",
    a: {
      label: "TAUSCHEN (+15 ◆, -30 E$ Buffer)",
      fn: (d) => {
        const lost = Math.min(d.bufferE, 30);
        d.bufferE -= lost;
        d.bufferF += 15;
        return `+15 ◆ · -${lost} E$`;
      }
    },
    b: { label: "ABLEHNEN", fn: () => "Das Signal verschwindet." }
  }
];

/* ---------------- Firewall (angekündigte Zahlwand vor dem Layer) ---------------- */
function makeFirewallEvent(fw) {
  return {
    id: "firewall",
    name: "FIREWALL ERKANNT",
    desc: `Der nächste Layer ist gesichert. Bezahl ${fw.fee} E$ aus dem Buffer für einen sauberen Durchgang — oder brich mit Gewalt durch (kostenlos, aber Trace +18 sofort).`,
    a: {
      label: `BEZAHLEN (-${fw.fee} E$)`,
      fn: (d) => {
        const pay = Math.min(d.bufferE, fw.fee);
        d.bufferE -= pay;
        return `Firewall bezahlt: -${pay} E$. Sauberer Durchgang.`;
      }
    },
    b: {
      label: "DURCHBRECHEN (Trace +18)",
      fn: (d) => {
        d.trace = Math.min(99, d.trace + 18);
        return "Firewall durchbrochen — Trace +18.";
      }
    }
  };
}

/* ---------------- Crew-Actives (1x pro Dive pro Charakter) ---------------- */
const ACTIVES = {
  loot:       { name: "SIPHON",       desc: "+E$ sofort in den Buffer", use: (d, lvl) => { const e = 30 + 20 * lvl; d.bufferE += e; return `+${e} E$ gezapft`; } },
  trace:      { name: "DÄMPFER",      desc: "Trace senken",             use: (d, lvl) => { const t = 10 + 3 * lvl; d.trace = Math.max(0, d.trace - t); return `Trace -${t}`; } },
  time:       { name: "ZEITDEHNUNG",  desc: "+Sekunden auf den Timer",  use: (d, lvl) => { d.mg.addTime?.(3 + lvl); return `+${3 + lvl}s`; } },
  peek:       { name: "SCAN",         desc: "Zeigt kurz die Lösung",    use: (d) => d.mg.assist?.("reveal") ? "Scan läuft" : (d.mg.addTime?.(2), "+2s (kein Scan hier)") },
  glitch:     { name: "SCAN+",        desc: "Zeigt kurz die Lösung",    use: (d) => d.mg.assist?.("reveal") ? "Scan läuft" : (d.mg.addTime?.(2), "+2s (kein Scan hier)") },
  ring:       { name: "MAGNET",       desc: "Größere Ziele für kurze Zeit", use: (d) => d.mg.assist?.("magnet") ? "Magnet aktiv" : (d.mg.addTime?.(2), "+2s (kein Magnet hier)") },
  salvage:    { name: "STABILISATOR", desc: "Trace -8 und +2s",         use: (d) => { d.trace = Math.max(0, d.trace - 8); d.mg.addTime?.(2); return "Trace -8 · +2s"; } },
  frags:      { name: "KOLLEKTE",     desc: "+◆ in den Buffer",         use: (d, lvl) => { const f = 4 + 2 * lvl; d.bufferF += f; return `+${f} ◆`; } },
  startTrace: { name: "GHOST",        desc: "Trace -12",                use: (d) => { d.trace = Math.max(0, d.trace - 12); return "Trace -12"; } },
  forgive:    { name: "VETO",         desc: "Fehler vergeben / Trace -6", use: (d) => d.mg.assist?.("forgive") ? "Nächster Fehler vergeben" : (d.trace = Math.max(0, d.trace - 6), "Trace -6") },
  revive:     { name: "PHANTOM",      desc: "+4s und Trace -6",         use: (d) => { d.mg.addTime?.(4); d.trace = Math.max(0, d.trace - 6); return "+4s · Trace -6"; } }
};

/* ---------------- Helpers ---------------- */
function depthMult(layer) {
  return 1 + 0.5 * (layer - 1);
}

function layerDiff(tier, layer) {
  return Math.min(1, (tier - 1) * 0.22 + (layer - 1) * 0.13);
}

function traceGainRange(d, mod) {
  const base = (10 + d.tier * 3) * d.mods.traceMult * (mod ? mod.trace : 1);
  return { lo: Math.round(base * 0.75), hi: Math.round(base * 1.35) };
}

function setDiveHud() {
  if (!dive) return;

  const ar = $("mHudArchetype");
  if (ar) ar.textContent = dive.archetype && dive.archetype.id !== "infiltration" ? `${dive.archetype.icon} ${dive.archetype.name} · ` : "";

  const t = $("mHudType");
  if (t) t.textContent = dive.spec ? iceLabel(dive.spec.type, dive.tier, dive.layer) : (dive.mg?.name || "—");

  const l = $("mHudLayer");
  if (l) l.textContent = `${dive.layer} (x${depthMult(dive.layer).toFixed(1)})`;

  const tr = $("mHudTrace");
  if (tr) {
    tr.textContent = `${Math.round(dive.trace)}%`;
    tr.parentElement?.classList.toggle("danger", dive.trace >= 65);
  }

  const b = $("mHudBuffer");
  if (b) b.textContent = `${dive.bufferE} E$ · ${dive.bufferF} ◆`;

  const m = $("mHudMod");
  if (m) {
    if (dive.spec?.boss) m.textContent = dive.spec.boss === "big" ? "⚠⚠ BOSS" : "⚠ BOSS";
    else if (dive.spec?.secret) m.textContent = "??? GEHEIM";
    else if (dive.spec?.corrupt) m.textContent = "⚠ KORRUPT";
    else m.textContent = dive.layerMod?.name || "—";
  }
}

function showChoice(show) {
  const el = $("diveChoice");
  if (el) el.classList.toggle("hidden", !show);
}

/* ---------------- Ability-Bar ---------------- */
function addAbilitySlot(bar, label, prefix, active, lvl) {
  const slot = { used: false, active, lvl };
  dive.abilities.push(slot);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn small yellow abilityBtn";
  btn.textContent = `${prefix} ${label}: ${active.name}`;
  btn.title = active.desc;

  bindFastPress(btn, () => {
    if (!dive || slot.used || dive.phase !== "play" || paused) return;
    slot.used = true;
    btn.classList.add("used");
    btn.disabled = true;

    const msg = active.use(dive, slot.lvl);
    sfx.good();
    toast(`${prefix} ${label}: ${msg}`);
  });

  bar.appendChild(btn);
}

function buildAbilityBar() {
  const bar = $("abilityBar");
  if (!bar) return;
  bar.innerHTML = "";

  dive.abilities = [];
  for (const id of game.crew.equipped) {
    const c = getChar(id);
    const lvl = game.crew.roster[id] || 0;
    if (!c || !lvl) continue;

    const active = ACTIVES[c.perk.type];
    if (!active) continue;

    addAbilitySlot(bar, c.name, "⚡", active, lvl);
  }

  // Build-Signature-Fähigkeit: unabhängig von der Crew, immer verfügbar,
  // solange ein Hacker-Build gewählt ist
  const build = getBuild(game.build);
  if (build?.active) {
    addAbilitySlot(bar, build.name, "🔧", build.active, 1);
  }

  bar.classList.toggle("hidden", dive.abilities.length === 0);
}

function hideAbilityBar() {
  const bar = $("abilityBar");
  if (bar) bar.classList.add("hidden");
}

/* ---------------- Programm-Leiste (Verbrauchsgüter) ---------------- */
// Anders als Crew-/Build-Actives: begrenzter, dive-übergreifender Vorrat
// (game.programsOwned) statt "1x pro Dive" — deshalb eigene Leiste + eigene
// Render-Logik statt addAbilitySlot().
function renderProgramBar() {
  const bar = $("programBar");
  if (!bar) return;
  bar.innerHTML = "";

  let any = false;
  for (const p of Object.values(PROGRAMS)) {
    const count = game.programsOwned?.[p.id] || 0;
    if (count <= 0) continue;
    any = true;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn small programBtn";
    btn.textContent = `${p.icon} ${p.name} ×${count}`;
    btn.title = p.desc;

    bindFastPress(btn, () => {
      if (!dive || dive.phase !== "play" || paused) return;
      if ((game.programsOwned[p.id] || 0) <= 0) return;
      game.programsOwned[p.id] -= 1;
      const msg = p.use(dive);
      sfx.good();
      toast(`${p.icon} ${p.name}: ${msg}`);
      saveNow();
      renderProgramBar();
    });

    bar.appendChild(btn);
  }

  bar.classList.toggle("hidden", !any);
}

function hideProgramBar() {
  const bar = $("programBar");
  if (bar) bar.classList.add("hidden");
}

/* ---------------- Layer-Lifecycle ---------------- */
// INTEL-Missionen: Signal-Relais (trace-Minigame) tauchen häufiger auf —
// passt zum "Daten sammeln"-Auftrag, ohne den Zufalls-Pool für alle anderen
// Archetypen anzufassen
function pickMgType() {
  const bias = dive.archetype?.traceTypeBias;
  if (!bias) return MG_TYPES[Math.floor(Math.random() * MG_TYPES.length)];
  const weighted = [...MG_TYPES];
  for (let i = 0; i < bias; i++) weighted.push("trace");
  return weighted[Math.floor(Math.random() * weighted.length)];
}

function rollNextLayer(layerNum) {
  // Bosse haben Vorrang: alle 10 Layer der große, alle 5 der kleine
  if (layerNum % 10 === 0) {
    return { type: "boss_big", mod: LAYER_MODS[0], hidden: false, boss: "big" };
  }
  if (layerNum % 5 === 0) {
    return { type: "boss_mini", mod: LAYER_MODS[0], hidden: false, boss: "mini" };
  }

  // 6%: geheimes Signal — immer verdeckt, doppelter Loot
  if (Math.random() < 0.06) {
    return { type: "ghost", mod: LAYER_MODS[0], hidden: true, secret: true };
  }

  // Einsteiger-Schutz: die ersten 3 Dives ohne Korruption und ohne
  // verdeckte Modifikatoren — erst das Grundspiel lernen, dann das Risiko
  const rookie = game.missionsDone < 3;

  const spec = {
    type: pickMgType(),
    mod: rollLayerMod(),
    // 40% der Modifikatoren bleiben verdeckt — Restrisiko
    hidden: !rookie && Math.random() < 0.4,
    // 15%: der Layer ist korrumpiert — deutlich härter, Loot x1.8
    corrupt: !rookie && Math.random() < 0.15
  };

  // Firewall: eine im Voraus sichtbare Zahlwand vor dem Layer — bezahlen
  // (E$ aus dem Buffer) für einen sauberen Durchgang, oder mit Gewalt
  // durchbrechen (kostet stattdessen Trace). Nie zusätzlich zu Korruption,
  // sonst kumulieren sich zwei harte Layer zu einem unfairen.
  if (!rookie && !spec.corrupt && Math.random() < 0.18) {
    spec.firewall = { fee: Math.round(30 + dive.tier * 6 + layerNum * 2.5) };
  }

  return spec;
}

function startLayer(spec) {
  dive.spec = spec;
  dive.layerMod = spec.mod;
  dive.mg = createMinigame(spec.type, {
    diff: layerDiff(dive.tier, dive.layer),
    mods: dive.mods,
    timeMult: spec.mod.time,
    corrupt: !!spec.corrupt
  });
  dive.phase = "play";
  inputGraceUntil = performance.now() + 300;
  showChoice(false);

  // HUD erst mit echten Texten füllen, DANN platzieren —
  // sonst misst playRect() eine zu niedrige HUD-Höhe (Mobile: Zeilenumbruch)
  setDiveHud();
  dive.mg.tick(0, true, () => {});
  dive.mg.start();

  if (spec.boss === "big") toast("⚠⚠ ICE-KERN PRIME — 3 PHASEN. ALLES ODER NICHTS.");
  else if (spec.boss === "mini") toast("⚠ ICE-WÄCHTER ERKANNT — ZERSTÖREN SENKT TRACE.");
  else if (spec.secret) toast("??? GEHEIMES SIGNAL — LOOT x2.");
  else if (spec.corrupt) toast(`⚠ ${iceLabel(spec.type, dive.tier, dive.layer)} KORRUMPIERT — HÄRTER, ABER LOOT x1.8.`);
  else {
    // jede reguläre Begegnung nennt ihr ICE beim Namen — das war vorher
    // komplett stumm (gemeldetes Problem: "alles fühlt sich gleich an")
    const label = iceLabel(spec.type, dive.tier, dive.layer);
    const c = ICE_CLASSES[spec.type];
    toast(spec.mod.id !== "none"
      ? `${label} — ${spec.mod.name}: ${spec.mod.desc}`
      : `${label} erkannt${c ? " — " + c.threat : ""}`);
  }
}

export function startDive(firstType, tier = 1, hot = false, special = null, archetypeId = null) {
  const mods = computeMods();
  clearParticles();
  const archetype = getArchetype(archetypeId);

  // Tagesboni von NPC-Besuchen: einmalig, werden hier verbraucht
  const buffs = game.buffs;
  mods.lootMult *= buffs.lootBonus;
  mods.traceMult *= buffs.traceMultCut;

  const buffLines = [];
  if (buffs.lootBonus > 1) buffLines.push(`+${Math.round((buffs.lootBonus - 1) * 100)}% Loot (RUNNER-9)`);
  if (buffs.traceMultCut < 1) buffLines.push(`-${Math.round((1 - buffs.traceMultCut) * 100)}% Trace-Anstieg (ICE-VOICE)`);
  if (buffs.traceCut > 0) buffLines.push(`-${buffs.traceCut} Start-Trace (NYX)`);

  dive = {
    tier: tier + (hot ? 1 : 0),
    hot,
    special,
    archetype,
    layer: 1,
    bufferE: 0,
    bufferF: 0,
    trace: Math.max(0, game.heat * 0.4 - mods.startTrace - buffs.traceCut),
    mods,
    reviveLeft: mods.revive,
    mg: null,
    spec: null,
    layerMod: LAYER_MODS[0],
    next: null,
    event: null,
    phase: "play",
    pending: null,
    abilities: []
  };

  if (hot) dive.mods = { ...mods, lootMult: mods.lootMult * 1.5 };

  // Mission-Archetyp: parametrisiert den bestehenden Dive-Loop statt ihn zu
  // ersetzen — gibt jeder Mission eine eigene Identität (HEIST/SABOTAGE/
  // ESCORT/INTEL/INFILTRATION), siehe archetypes.js
  if (archetype.lootMult) dive.mods.lootMult *= archetype.lootMult;
  if (archetype.traceMult) dive.mods.traceMult *= archetype.traceMult;
  if (archetype.fragsPerLayerBonus) dive.mods.fragsPerLayer += archetype.fragsPerLayerBonus;

  // verbraucht — erst nach dem Kopieren in dive.mods zurücksetzen
  game.buffs.traceCut = 0;
  game.buffs.lootBonus = 1;
  game.buffs.traceMultCut = 1;
  if (buffLines.length) toast(`AKTIVE BONI: ${buffLines.join(" · ")}`);

  buildAbilityBar();
  renderProgramBar();
  startLayer({ type: firstType, mod: LAYER_MODS[0], hidden: false });
  banter("start", true);

  const archetypeTag = archetype.id !== "infiltration" ? ` · ${archetype.icon} ${archetype.name}` : "";
  toast(hot ? `HOT ZONE DIVE — TIER ${dive.tier} · +50% LOOT${archetypeTag}` : `DIVE START — TIER ${dive.tier}${archetypeTag}`);
}

/* ---------------- Choice / Event UI ---------------- */
function renderChoice() {
  const dcB = $("dcBuffer");
  if (dcB) dcB.textContent = `${dive.bufferE} E$ · ${dive.bufferF} ◆`;

  const dcT = $("dcTrace");
  if (dcT) {
    dcT.textContent = `${Math.round(dive.trace)}%`;
    dcT.parentElement?.classList.toggle("danger", dive.trace >= 65);
  }

  // Vorschau auf den nächsten Layer — Modifikator evtl. verdeckt
  const n = dive.next;
  const range = traceGainRange(dive, n.hidden ? null : n.mod);

  const dcN = $("dcNext");
  if (dcN) {
    if (n.boss === "big") dcN.textContent = "⚠⚠ BOSS: ICE-KERN PRIME";
    else if (n.boss === "mini") dcN.textContent = "⚠ BOSS: ICE-WÄCHTER";
    else if (n.secret) dcN.textContent = "??? UNBEKANNTES SIGNAL";
    else dcN.textContent = `${iceLabel(n.type, dive.tier, dive.layer + 1)}${n.corrupt && !n.hidden ? " · ⚠ KORRUMPIERT" : ""} · ${n.hidden ? "??? (VERDECKT)" : n.mod.name}`;
  }

  const dcN2 = $("dcNext2");
  if (dcN2) {
    if (n.boss === "big") dcN2.textContent = "LOOT x4 · Sieg: TRACE -50, +40 ◆ · Niederlage: alles weg";
    else if (n.boss === "mini") dcN2.textContent = "LOOT x2.5 · Sieg: TRACE -30 · Niederlage: alles weg";
    else dcN2.textContent = `LOOT x${depthMult(dive.layer + 1).toFixed(1)}${n.hidden ? "" : (n.mod.loot !== 1 ? ` ·x${n.mod.loot}` : "")}${n.corrupt && !n.hidden ? " ·x1.8" : ""} · TRACE ≈ +${range.lo}–${range.hi}${n.hidden ? "+?" : ""}${n.firewall ? " · ⚠ FIREWALL" : ""}`;
  }

  // Countdown zum nächsten Boss als Anreiz
  const dcBoss = $("dcBossHint");
  if (dcBoss) {
    const nl = dive.layer + 1;
    const toMini = (5 - (nl % 5)) % 5;
    const toBig = (10 - (nl % 10)) % 10;
    dcBoss.textContent = toBig === 0 ? "" : (toMini === 0 ? "" : `Nächster Boss in ${Math.min(toMini, toBig)} Layer${Math.min(toMini, toBig) === 1 ? "" : "n"} — Bosse senken den Trace.`);
  }

  const bant = banterLine("clear");
  const dcBanter = $("dcBanter");
  if (dcBanter) dcBanter.textContent = bant ? `${bant.name}: „${bant.line}“` : "Verbindung stabil. Deine Entscheidung.";

  renderEvent();
  showChoice(true);
}

function renderEvent() {
  const box = $("dcEvent");
  const choiceRow = $("dcChoiceRow");
  if (!box || !choiceRow) return;

  if (dive.event) {
    box.classList.remove("hidden");
    choiceRow.classList.add("hidden");

    const t = $("dcEventTitle");
    if (t) t.textContent = dive.event.name;

    const d = $("dcEventDesc");
    if (d) d.textContent = dive.event.desc;

    const a = $("btnEventA");
    if (a) a.textContent = dive.event.a.label;

    const b = $("btnEventB");
    if (b) b.textContent = dive.event.b.label;
  } else {
    box.classList.add("hidden");
    choiceRow.classList.remove("hidden");
  }
}

function resolveEvent(pick) {
  if (!dive || !dive.event) return;

  const opt = pick === "a" ? dive.event.a : dive.event.b;
  const msg = opt.fn(dive);
  dive.event = null;
  toast(msg);

  if (dive.trace >= 100) {
    dive.trace = 100;
    return dumped("TRACE COMPLETE — VERBINDUNG GEKAPPT");
  }
  renderChoice();
}

/* ---------------- Report / Finish ---------------- */
function onReport(res) {
  if (!dive) return;

  if (!res.success) {
    if (dive.reviveLeft > 0) {
      dive.reviveLeft -= 1;
      toast("NULL ZIEHT DICH ZURÜCK — NOCH EIN VERSUCH.");
      sfx.good();
      startLayer(dive.spec);
      return;
    }
    return dumped(dive.spec.boss ? "DER BOSS HAT DICH ZERLEGT" : "ICE HAT DICH ERWISCHT");
  }

  const spec = dive.spec;
  const mod = dive.layerMod;
  const mult = depthMult(dive.layer);

  // Perfekter Layer: kein einziger Fehltritt — belohnt präzises Spiel
  // zusätzlich zum reinen Tempo/Score
  const perfect = res.misses === 0;

  // Sonder-Multiplikatoren: korrumpiert x1.8, geheim x2, Bosse x2.5 / x4, perfekt x1.12
  let special = 1;
  if (spec.corrupt) special *= 1.8;
  if (spec.secret) special *= 2;
  if (spec.boss === "mini") special *= 2.5;
  if (spec.boss === "big") special *= 4;
  if (perfect) special *= 1.12;

  const e = Math.round(res.score * 3 * mult * dive.mods.lootMult * mod.loot * special);
  let f = Math.round((res.score * 0.8 + dive.mods.fragsPerLayer) * (1 + 0.25 * (dive.layer - 1)) * (spec.boss ? 1.5 : 1));
  if (dive.archetype?.fragMult) f = Math.round(f * dive.archetype.fragMult);
  dive.bufferE += e;
  dive.bufferF += f;

  // Trace mit Varianz: gleiche Basis, aber ±Zufall — man weiß nie genau
  const base = (10 + dive.tier * 3 + res.misses * 3) * dive.mods.traceMult * mod.trace;
  dive.trace += base * (0.75 + Math.random() * 0.6);
  if (perfect) dive.trace = Math.max(0, dive.trace - 3);

  // Boss zerstört = Verbindung bereinigt: Trace sinkt deutlich
  // (Werte per Simulation kalibriert: -30/-50 macht Layer 10+ erreichbar,
  //  ohne dass Neulinge endlos loopen können)
  const bossBonus = dive.mods.bossTraceBonus || 0;
  const sabBonusF = dive.archetype?.bossBonusFrags || 0;
  const sabBonusE = dive.archetype?.bossBonusMoney || 0;
  if (spec.boss === "mini") {
    dive.trace = Math.max(0, dive.trace - 30 - bossBonus);
    if (sabBonusF || sabBonusE) { dive.bufferF += sabBonusF; dive.bufferE += sabBonusE; }
    toast(`WÄCHTER ZERSTÖRT — TRACE -${30 + bossBonus}.${sabBonusF ? ` SABOTAGE-BONUS +${sabBonusF} ◆` : ""}`);
    sfx.jackout();
  } else if (spec.boss === "big") {
    dive.trace = Math.max(0, dive.trace - 50 - bossBonus);
    dive.bufferF += 40;
    if (sabBonusF || sabBonusE) { dive.bufferF += sabBonusF; dive.bufferE += sabBonusE; }
    toast(`ICE-KERN VERNICHTET — TRACE -${50 + bossBonus}, +40 ◆!${sabBonusF ? ` SABOTAGE-BONUS +${sabBonusF} ◆` : ""}`);
    sfx.jackout();
  } else if (perfect) {
    toast("✨ PERFEKT — kein Fehler. +12% Loot, Trace -3.");
  }

  if (dive.trace >= 100) {
    dive.trace = 100;
    return dumped("TRACE COMPLETE — VERBINDUNG GEKAPPT");
  }

  dive.phase = "choice";
  dive.next = rollNextLayer(dive.layer + 1);

  // Firewall hat Vorrang vor dem normalen Zufalls-Event — beide gleichzeitig
  // wäre unfair und würde den einen an den anderen "verschwenden"
  if (dive.next.firewall) {
    dive.event = makeFirewallEvent(dive.next.firewall);
  } else {
    // Ab Layer 2: 35% Chance auf ein Event (Testhook: __NEON_FORCE_EVENT)
    const evtChance = window.__NEON_FORCE_EVENT ? 1 : 0.35;
    dive.event = (dive.layer >= 2 && Math.random() < evtChance)
      ? EVENTS[Math.floor(Math.random() * EVENTS.length)]
      : null;
  }

  sfx.clear();
  banter("clear");
  renderChoice();
}

function dumped(reason) {
  const lostE = dive.bufferE;
  const lostF = dive.bufferF;
  const salvageE = Math.round(lostE * dive.mods.salvage);
  // Frags überleben einen Dump zu mindestens 25% — sonst ist die Hälfte
  // aller Runs null Gacha-Fortschritt (Simulation: tötet die Motivation)
  const salvageF = Math.round(lostF * Math.max(0.25, dive.mods.salvage));
  const layer = dive.layer;

  dive.pending = {
    apply: (g) => ({
      money: g.money + salvageE,
      frags: g.frags + salvageF,
      heat: Math.min(100, g.heat + 12)
    }),
    meta: { layer, jackout: false },
    text:
      `${reason}.\n\n` +
      `Buffer verloren: ${lostE - salvageE} E$ · ${lostF - salvageF} ◆\n` +
      `Gerettet: ${salvageE} E$ · ${salvageF} ◆\n` +
      `Heat +12\n\n` +
      `Layer erreicht: ${layer}`
  };
  dive.phase = "done";
  showChoice(false);
  hideAbilityBar();
  hideProgramBar();
  sfx.dumped();
  banter("dumped", true);
  shakeScreen();
}

function jackOut() {
  if (!dive || dive.phase !== "choice" || dive.event) return;

  // ESCORT: die Fracht muss erst eine Mindesttiefe erreichen, bevor ein
  // sauberer Ausstieg überhaupt möglich ist
  const minLayer = dive.archetype?.minJackoutLayer;
  if (minLayer && dive.layer < minLayer) {
    toast(`📦 FRACHT NOCH NICHT STABIL — mind. Layer ${minLayer} nötig.`);
    return;
  }

  const heatAdd = Math.ceil(dive.trace / 12);
  const e = dive.bufferE, f = dive.bufferF, layer = dive.layer;

  // Finale des Void-Signal-Dives: einmalige Auflösung der Hauptstory
  let finaleText = "";
  if (dive.special === "void" && !game.stats.voidCompleted) {
    game.stats.voidCompleted = true;
    game.psychosis = Math.max(0, game.psychosis - 40);
    game.storyLog.unshift(`> ECHO: „Du hast sie gehört. Alle, die im Buffer geblieben sind. Sie wollten nur, dass jemand zurückkommt und es sagt. Jetzt weißt du's.“`);
    finaleText =
      `\n\n— — —\n\n` +
      `Das Signal war kein Fremdes. Es waren die Stimmen der Runner, die nie zurückkamen — ` +
      `im Buffer gefangen, seit Jahren. Kein Countdown, kein Boss. Nur ein letztes „hier“.\n\n` +
      `Du jackst aus. Diesmal hören sie es auch.`;
  }

  dive.pending = {
    apply: (g) => ({
      money: g.money + e,
      frags: g.frags + f,
      heat: Math.min(100, g.heat + heatAdd)
    }),
    meta: { layer, jackout: true, special: dive.special },
    text:
      `JACK OUT ERFOLGREICH.\n\n` +
      `Gesichert: ${e} E$ · ${f} ◆\n` +
      `Heat +${heatAdd}\n\n` +
      `Tiefster Layer: ${layer}` + finaleText
  };
  dive.phase = "done";
  showChoice(false);
  hideAbilityBar();
  hideProgramBar();
  sfx.jackout();
  banter("jackout", true);
}

function goDeeper() {
  if (!dive || dive.phase !== "choice" || dive.event) return;

  dive.layer += 1;
  sfx.deeper();
  banter("deeper");
  startLayer(dive.next);
}

function shakeScreen() {
  const app = $("app");
  if (!app) return;
  app.classList.remove("shake");
  void app.offsetWidth;
  app.classList.add("shake");
}

/* ---------------- Public API ---------------- */
export function handleDivePointer(type, e) {
  if (!dive || paused || dive.phase !== "play") return;
  if (type === "down" && performance.now() < inputGraceUntil) return;
  dive.mg.pointer(type, e);
}

export function diveTick(dt, onFinish) {
  if (!dive) return;

  if (dive.phase === "play") {
    dive.mg.tick(paused ? 0 : dt, paused, onReport);
  }

  setDiveHud();

  if (dive.pending) {
    const p = dive.pending;
    dive = null;
    hideAbilityBar();
    hideProgramBar();
    onFinish(p);
  }
}

export function initDive() {
  bindFastPress($("btnJackOut"), jackOut);
  bindFastPress($("btnDeeper"), goDeeper);
  bindFastPress($("btnEventA"), () => resolveEvent("a"));
  bindFastPress($("btnEventB"), () => resolveEvent("b"));

  // Debug-/Test-Zugriff
  window.__NEON_DIVE = () => dive;
}
