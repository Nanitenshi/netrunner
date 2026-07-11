// js/crew.js — Charaktere, Gacha ("Broker"), Perks, Banter, Gear
import { game } from "./core.js?v=3977a132";
import { toast, bindFastPress, setComms, renderStoryLog } from "./ui.js?v=3977a132";
import { saveNow } from "./save.js?v=3977a132";

const $ = (id) => document.getElementById(id);

export const PULL_COST = 20;

export const RARITIES = {
  street:  { label: "STREET",  weight: 58, cls: "r-street" },
  pro:     { label: "PRO",     weight: 28, cls: "r-pro" },
  elite:   { label: "ELITE",   weight: 11, cls: "r-elite" },
  phantom: { label: "PHANTOM", weight: 3,  cls: "r-phantom" }
};

/*
 Perk-Typen (Wert = base * Level, Level 1–5):
  loot        +% Loot
  trace       -% Trace-Anstieg
  time        +Sekunden pro Layer
  peek        +Sekunden Merkzeit (Wire Match)
  ring        größere Ringe (Cache Pop)
  salvage     +% Rettung bei Dump
  frags       +Frags pro Layer
  startTrace  weniger Start-Trace
  forgive     Breach: 1 Fehler vergeben (Level: +0.5s Zeit)
  revive      1 Wiederbelebung pro Dive (Level: +8% Salvage)
  glitch      +Peek und +Loot
*/
export const CHARS = [
  // ---------- STREET ----------
  {
    id: "juno", name: "JUNO", handle: "Ex-Kurierin", rarity: "street",
    perk: { type: "loot", base: 0.06, text: (l) => `+${Math.round(6 * l)}% Loot` },
    bio: "Fuhr früher alles, was Räder hatte. Jetzt fährt sie Daten.",
    lines: {
      pull: "JUNO. Ich fahr alles. Auch dich, wenn's sein muss.",
      start: "Route liegt an. Festhalten.",
      clear: "Paket gesichert. Weiter oder raus?",
      deeper: "Tiefer? Okay. Aber wenn's knallt, war's deine Idee.",
      jackout: "Sauber raus. So mag ich das.",
      dumped: "Mist. Das war knapp. Zu knapp.",
      idle: ["Die Stadt schläft nie. Ich inzwischen auch nicht mehr.", "Früher hab ich Pizza geliefert. Ehrlich? Das war gefährlicher."]
    }
  },
  {
    id: "pixel", name: "PIXEL", handle: "17, ungefragt ehrlich", rarity: "street",
    perk: { type: "ring", base: 0.06, text: (l) => `Cache-Ringe +${Math.round(6 * l)}% größer` },
    bio: "Hackt seit sie zwölf ist. Fragt nicht nach Erlaubnis, nie.",
    lines: {
      pull: "Yo! PIXEL. Du siehst alt aus. Egal, machen wir Geld?",
      start: "Okay okay okay, LOS JETZT!",
      clear: "EASY! Sag nicht, das war's schon?",
      deeper: "TIEFER! Immer tiefer! Was soll schon passieren?",
      jackout: "Buh, Langweiler. Okay, war trotzdem nice.",
      dumped: "Ähm. Das war nicht ich. Das war... der Lag. Voll der Lag.",
      idle: ["Kennst du den Typen vom Alley Market? Der verkauft GARANTIERT geklaute Chips.", "Mir ist laaaangweilig. Hack doch was."]
    }
  },
  {
    id: "moss", name: "MOSS", handle: "Ex-Werkschutz", rarity: "street",
    perk: { type: "trace", base: 0.04, text: (l) => `-${Math.round(4 * l)}% Trace-Anstieg` },
    bio: "Hat zwanzig Jahre lang Türen bewacht. Kennt jede von innen.",
    lines: {
      pull: "Moss. Ich rede nicht viel. Ich arbeite.",
      start: "Bin dabei.",
      clear: "Sauber.",
      deeper: "Hm. Riskant. Aber machbar.",
      jackout: "Gute Entscheidung.",
      dumped: "Passiert. Weitermachen.",
      idle: ["...", "Kaffee wäre gut."]
    }
  },
  {
    id: "lila", name: "LILA V.", handle: "Straßenmusikerin", rarity: "street",
    perk: { type: "time", base: 1, text: (l) => `+${l}s Zeit pro Layer` },
    bio: "Spielt Synth an der Ecke Neon/7te. Hört Muster, wo andere Lärm hören.",
    lines: {
      pull: "Lila. Ich spiele, du zahlst. Oder wir hacken, gleiche Melodie.",
      start: "Hör auf den Rhythmus der Firewall. Eins, zwei...",
      clear: "Siehst du? Alles nur Musik.",
      deeper: "Die nächste Strophe wird lauter. Bereit?",
      jackout: "Und... Schlussakkord. Schön war's.",
      dumped: "Dissonanz. Hässlich. Lass uns das nie wieder tun.",
      idle: ["Jede Stadt hat einen Klang. Diese hier schreit.", "Ich schreib ein Lied über dich. Es wird traurig, glaub ich."]
    }
  },
  {
    id: "crank", name: "CRANK", handle: "Schrauber, 61", rarity: "street",
    perk: { type: "salvage", base: 0.06, text: (l) => `+${Math.round(6 * l)}% Rettung bei Dump` },
    bio: "Repariert alles außer seine eigene Vergangenheit.",
    lines: {
      pull: "Crank. Wenn's kaputt ist, bring's her. Wenn du kaputt bist, auch.",
      start: "Ich hab dir 'nen Puffer eingebaut. Bedank dich später.",
      clear: "Läuft doch. Sag ich doch.",
      deeper: "Tiefer? Junge... na gut. Aber ich hab dich gewarnt.",
      jackout: "Brav. Lieber 'nen halben Sack als gar keinen.",
      dumped: "Siehst du?! SIEHST DU?! ...komm her, ich flick den Buffer.",
      idle: ["Früher war hier alles Chrom. Jetzt ist alles Plastik.", "Mein Knie meldet Regen. Mein Knie irrt nie."]
    }
  },
  {
    id: "sora", name: "SCHWESTER SORA", handle: "Ex-Nonne, Chromauge", rarity: "street",
    perk: { type: "frags", base: 2, text: (l) => `+${2 * l} ◆ pro Layer` },
    bio: "Hat den Glauben nicht verloren. Nur die Kirche.",
    lines: {
      pull: "Sora. Ich bete noch. Nur die Adressaten haben gewechselt.",
      start: "Möge der Datenstrom dich tragen.",
      clear: "Siehst du? Es gibt Gnade. Sogar hier.",
      deeper: "Hochmut, mein Kind. Aber... ich bin neugierig.",
      jackout: "Weise. Gier ist ein Wolf mit Geduld.",
      dumped: "Ich sagte: Gier ist ein Wolf. Er hat dich gehört.",
      idle: ["Ich habe heute für einen Fremden gebetet. Vielleicht warst du das.", "Das Auge? Arasaka. Der Blick? Meiner."]
    }
  },

  // ---------- PRO ----------
  {
    id: "vesper", name: "VESPER", handle: "Fixerin", rarity: "pro",
    perk: { type: "trace", base: 0.06, text: (l) => `-${Math.round(6 * l)}% Trace-Anstieg` },
    bio: "Kennt jeden Preis in der Stadt. Auch deinen.",
    lines: {
      pull: "Vesper. Du kannst mich dir nicht leisten. Aber gut, Probezeit.",
      start: "Ich habe die Route bereinigt. Enttäusch mich nicht.",
      clear: "Akzeptabel.",
      deeper: "Höheres Risiko, höhere Marge. Ich höre zu.",
      jackout: "Vernünftig. Vernunft ist selten hier.",
      dumped: "Das war teuer. Für dich. Ich schreibe es an.",
      idle: ["Jeder in dieser Stadt ist käuflich. Die Ehrlichen sind nur teurer.", "Ich hatte heute drei Angebote für deinen Standort. Ich habe abgelehnt. Diesmal."]
    }
  },
  {
    id: "byte", name: "BYTE", handle: "Hacker, stottert", rarity: "pro",
    perk: { type: "peek", base: 0.4, text: (l) => `+${(0.4 * l).toFixed(1)}s Merkzeit (Wire)` },
    bio: "Sein Mund stolpert. Sein Code nie.",
    lines: {
      pull: "B-B-Byte. Ich... ich bin besser als ich klinge. V-viel besser.",
      start: "Ich m-mapp dir die Leitungen. Vertrau mir.",
      clear: "S-siehst du?! HA! Sorry. Zu laut.",
      deeper: "T-tiefer ist... statistisch schlecht. Aber c-cool.",
      jackout: "G-gut. Mein Puls dankt dir.",
      dumped: "Das w-war meine Schuld. N-nein, deine. Unsere.",
      idle: ["Ich hab die Ampeln an der 7ten gehackt. Jetzt sind sie h-höflich.", "M-manchmal träume ich in Hexcode. Ist das normal?"]
    }
  },
  {
    id: "rook", name: "ROOK", handle: "Ex-Corpo-Anwalt", rarity: "pro",
    perk: { type: "loot", base: 0.10, text: (l) => `+${Math.round(10 * l)}% Loot` },
    bio: "Hat Verträge geschrieben, die Leben ruinierten. Jetzt ruiniert er Verträge.",
    lines: {
      pull: "Rook. Ich kenne die Klauseln, mit denen sie dich besitzen. Wollen wir sie brechen?",
      start: "Paragraph eins: Alles hier drin gehört jetzt uns.",
      clear: "Sauber verhandelt. Sozusagen.",
      deeper: "Die Gewinnspanne rechtfertigt das Risiko. Meistens. Fast immer. Oft.",
      jackout: "Auszahlung bestätigt. Ein Vergnügen.",
      dumped: "Vertragsstrafe. Ich hasse Vertragsstrafen.",
      idle: ["Ich habe mal 400 Seiten Kleingedrucktes geschrieben. Satz für Satz eine Falle.", "Corpos lügen nicht. Sie definieren Wahrheit nur vertraglich neu."]
    }
  },
  {
    id: "sable", name: "SABLE", handle: "Einbrecherin", rarity: "pro",
    perk: { type: "startTrace", base: 4, text: (l) => `Start-Trace -${4 * l}` },
    bio: "Du bemerkst sie erst, wenn dein Zeug weg ist. Manchmal nicht mal dann.",
    lines: {
      pull: "Sable. Ich war schon zweimal in deiner Wohnung. Nettes Sofa.",
      start: "Leise rein. Der Anfang entscheidet alles.",
      clear: "Keiner hat uns gesehen. So bleibt das.",
      deeper: "Tiefer heißt lauter. Deine Entscheidung.",
      jackout: "Raus, bevor sie wissen, dass wir drin waren. Perfekt.",
      dumped: "Zu laut. Viel zu laut. Das nächste Mal hörst du auf mich.",
      idle: ["Schlösser sind Meinungen.", "Ich sammle Schlüssel von Türen, die es nicht mehr gibt."]
    }
  },

  // ---------- ELITE ----------
  {
    id: "widow", name: "WIDOW", handle: "Slum-Legende", rarity: "elite",
    perk: { type: "forgive", base: 1, text: (l) => `Breach: 1 Fehler vergeben, +${(0.5 * (l - 1)).toFixed(1)}s Zeit` },
    bio: "Hat drei Konzernkriege überlebt. Die Konzerne nicht.",
    lines: {
      pull: "Widow. Setz dich. Iss was. Dann reden wir über Krieg.",
      start: "Bleib hinter mir, Kleines. Bildlich gesprochen.",
      clear: "Braves Kind. Weiter.",
      deeper: "Tiefer? Gut. Angst ist nur Information.",
      jackout: "Wer lebt, gewinnt. Merk dir das.",
      dumped: "Schh. Aufstehen. Wer atmet, hat noch nicht verloren.",
      idle: ["Ich habe Enkel in vier Bezirken. Keiner weiß, was Oma beruflich macht.", "Die Slums vergessen nichts. Und niemanden."]
    }
  },
  {
    id: "kuro", name: "KURO", handle: "Ex-Arasaka", rarity: "elite",
    perk: { type: "trace", base: 0.08, text: (l) => `-${Math.round(8 * l)}% Trace-Anstieg` },
    bio: "Hat das ICE mitentwickelt, das dich jagt. Er kennt seine Kinder.",
    lines: {
      pull: "Kuro. Ich habe die Systeme gebaut, die Sie fürchten. Eine Anstellung erscheint... logisch.",
      start: "Protokoll läuft. Bitte exakt meinen Anweisungen folgen.",
      clear: "Wie berechnet. Fahren Sie fort.",
      deeper: "Die nächste Ebene kenne ich persönlich. Ich habe sie entworfen. Seien Sie präzise.",
      jackout: "Korrekte Entscheidung. Emotion hätte Sie getötet.",
      dumped: "Faszinierend. Mein ICE funktioniert also noch. Das ist... unpraktisch.",
      idle: ["Arasaka führt eine Akte über mich. Ich führe eine bessere über Arasaka.", "Loyalität ist ein Konfigurationsfehler. Ich wurde gepatcht."]
    }
  },
  {
    id: "glitch", name: "GLITCH", handle: "hält sich für einen Menschen", rarity: "elite",
    perk: { type: "glitch", base: 0.5, text: (l) => `+${(0.5 * l).toFixed(1)}s Merkzeit, +${4 * l}% Loot` },
    bio: "Ein KI-Fragment aus einem gelöschten Projekt. Bestreitet das. Vehement.",
    lines: {
      pull: "Hi! Ich bin Glitch! Ich bin übrigens ein ganz normaler Mensch. Warum fragen das alle?",
      start: "Ich fühle mich hier drin... komisch wohl. Als wäre ich zuhaus— egal! Los!",
      clear: "Die Daten haben mit mir geredet. Haha! Spaß. ...Sie haben geflüstert.",
      deeper: "Tiefer! Da unten sind Sachen, die ich... die BESTIMMT interessant sind!",
      jackout: "Draußen ist auch schön. Sagt man. Ich mag draußen. Total.",
      dumped: "AU. Das... Menschen spüren sowas, oder? Ich hab's nämlich GESPÜRT.",
      idle: ["Ich habe heute geblinzelt geübt. 4000 Mal. Menschlich, oder?", "Träumst du manchmal in Zahlen? Ich auch nicht! Haha. Ha."]
    }
  },

  // ---------- PHANTOM ----------
  {
    id: "null0", name: "NULL", handle: "Gesicht unbekannt", rarity: "phantom",
    perk: { type: "revive", base: 1, text: (l) => `1 Revive pro Dive, +${8 * l}% Rettung bei Dump` },
    bio: "Es gibt keine Fotos. Keine Akte. Keine Zeugen. Es gibt nur Ergebnisse.",
    lines: {
      pull: "...",
      start: "...",
      clear: "Weiter.",
      deeper: "Gut.",
      jackout: "...",
      dumped: "Ich hatte dich. Deshalb lebst du noch.",
      idle: ["...", "Du redest zu viel."]
    }
  },
  {
    id: "oracle", name: "ORACLE", handle: "Datenhexe", rarity: "phantom",
    perk: { type: "loot", base: 0.16, text: (l) => `+${Math.round(16 * l)}% Loot` },
    bio: "Sieht Muster in allem. In Datenströmen. In Menschen. In dir.",
    lines: {
      pull: "Ich wusste, dass du ziehst. Ich wusste sogar das Datum. Willkommen.",
      start: "Ich sehe drei Wege. Zwei enden gut. Beeindrucke mich.",
      clear: "Wie vorhergesehen. Fast langweilig. Fast.",
      deeper: "Ah. Der mutige Pfad. Der war unwahrscheinlicher. Interessant.",
      jackout: "Der kluge Pfad. Auch gut. Klüger als du aussiehst.",
      dumped: "Das war der dritte Weg. Ich hatte gehofft, du wählst ihn nicht.",
      idle: ["Deine Zukunft hat sich gerade geändert. Um 14:32. Gern geschehen.", "Muster überall. Du zum Beispiel: Du wirst gleich wegschauen. ...Siehst du?"]
    }
  }
];

export function getChar(id) {
  return CHARS.find((c) => c.id === id);
}

/* ---------------- MODS (Crew + Gear) ---------------- */
export function computeMods() {
  const m = {
    lootMult: 1, traceMult: 1, timeBonus: 0, peekBonus: 0, ringScale: 1,
    salvage: 0, fragsPerLayer: 0, startTrace: 0, forgive: 0, revive: 0
  };

  for (const id of game.crew.equipped) {
    const c = getChar(id);
    const lvl = game.crew.roster[id] || 0;
    if (!c || !lvl) continue;

    const v = c.perk.base * lvl;
    switch (c.perk.type) {
      case "loot": m.lootMult += v; break;
      case "trace": m.traceMult -= v; break;
      case "time": m.timeBonus += v; break;
      case "peek": m.peekBonus += v; break;
      case "ring": m.ringScale += v; break;
      case "salvage": m.salvage += v; break;
      case "frags": m.fragsPerLayer += v; break;
      case "startTrace": m.startTrace += v; break;
      case "forgive": m.forgive += 1; m.timeBonus += 0.5 * (lvl - 1); break;
      case "revive": m.revive += 1; m.salvage += 0.08 * lvl; break;
      case "glitch": m.peekBonus += 0.5 * lvl; m.lootMult += 0.04 * lvl; break;
    }
  }

  m.lootMult += 0.12 * (game.upgrades.amplifier || 0);
  m.traceMult -= 0.08 * (game.upgrades.pulse || 0);
  m.salvage += 0.15 * (game.upgrades.buffer || 0);

  m.traceMult = Math.max(0.35, m.traceMult);
  m.salvage = Math.min(0.9, m.salvage);
  return m;
}

/* ---------------- GACHA ---------------- */
function rollRarity() {
  const total = Object.values(RARITIES).reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * total;
  for (const [key, r] of Object.entries(RARITIES)) {
    roll -= r.weight;
    if (roll <= 0) return key;
  }
  return "street";
}

export function pull() {
  if (game.frags < PULL_COST) {
    toast(`ZU WENIG FRAGS (${PULL_COST} ◆ NÖTIG).`);
    return null;
  }
  game.frags -= PULL_COST;

  let rarity = rollRarity();
  game.crew.pity += 1;

  if (game.crew.pity >= 10 && rarity !== "elite" && rarity !== "phantom") {
    rarity = Math.random() < 0.2 ? "phantom" : "elite";
  }
  if (rarity === "elite" || rarity === "phantom") game.crew.pity = 0;

  const pool = CHARS.filter((c) => c.rarity === rarity);
  const c = pool[Math.floor(Math.random() * pool.length)];

  let dupe = false, maxed = false;
  if (game.crew.roster[c.id]) {
    dupe = true;
    if (game.crew.roster[c.id] >= 5) {
      maxed = true;
      game.frags += 12;
    } else {
      game.crew.roster[c.id] += 1;
    }
  } else {
    game.crew.roster[c.id] = 1;
  }

  saveNow();
  return { char: c, dupe, maxed, level: game.crew.roster[c.id] };
}

/* ---------------- BANTER ---------------- */
let idleTimer = 30;

export function banterLine(event) {
  const ids = game.crew.equipped.filter((id) => game.crew.roster[id]);
  if (!ids.length) return null;

  const id = ids[Math.floor(Math.random() * ids.length)];
  const c = getChar(id);
  if (!c) return null;

  const line = (event === "idle")
    ? c.lines.idle[Math.floor(Math.random() * c.lines.idle.length)]
    : c.lines[event];

  if (!line) return null;
  return { name: c.name, line };
}

export function banter(event, log = false) {
  const b = banterLine(event);
  if (!b) return;

  setComms(`${b.name}: „${b.line}“`);
  if (log) {
    game.storyLog.unshift(`> ${b.name}: „${b.line}“`);
    if (game.storyLog.length > 60) game.storyLog.length = 60;
    renderStoryLog();
  }
}

export function crewTick(dt) {
  if (game.mode !== "WORLD") return;
  idleTimer -= dt;
  if (idleTimer <= 0) {
    idleTimer = 45 + Math.random() * 30;
    banter("idle");
  }
}

/* ---------------- GEAR ---------------- */
const GEAR = [
  { id: "amplifier", name: "SIGNAL AMP", desc: "+12% Loot pro Stufe", costs: [80, 200, 480, 1000, 2000] },
  { id: "pulse", name: "PULSE FILTER", desc: "-8% Trace-Anstieg pro Stufe", costs: [80, 200, 480, 1000, 2000] },
  { id: "buffer", name: "BUFFER GUARD", desc: "+15% Rettung bei Dump pro Stufe", costs: [60, 160, 400, 900, 1800] }
];

function buyGear(gid) {
  const g = GEAR.find((x) => x.id === gid);
  const lvl = game.upgrades[gid] || 0;

  if (lvl >= g.costs.length) return toast("MAX-STUFE ERREICHT.");
  const cost = g.costs[lvl];
  if (game.money < cost) return toast(`ZU WENIG EDDIES (${cost} E$).`);

  game.money -= cost;
  game.upgrades[gid] = lvl + 1;
  saveNow();
  toast(`${g.name} → STUFE ${lvl + 1}`);
  renderGear();
}

/* ---------------- UI ---------------- */
let overlayOpen = false;

export function openCrewOverlay() {
  const el = $("crewOverlay");
  if (!el) return;
  overlayOpen = true;
  el.classList.remove("hidden");
  renderBroker();
  renderCrewGrid();
  renderGear();
}

export function closeCrewOverlay() {
  const el = $("crewOverlay");
  if (el) el.classList.add("hidden");
  overlayOpen = false;
}

function switchTab(tab) {
  for (const t of ["broker", "crew", "gear"]) {
    const page = $("tab" + t.charAt(0).toUpperCase() + t.slice(1));
    if (page) page.classList.toggle("hidden", t !== tab);
  }
  document.querySelectorAll(".tabBtn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
}

function renderBroker() {
  const info = $("pityInfo");
  if (info) {
    const left = Math.max(0, 10 - game.crew.pity);
    info.textContent = `Garantiert ELITE+ in: ${left} Pull${left === 1 ? "" : "s"} · Dein Guthaben: ${game.frags} ◆`;
  }
}

function renderPullResult(res) {
  const wrap = $("pullResult");
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!res) return;

  const r = RARITIES[res.char.rarity];
  const card = document.createElement("div");
  card.className = `pullCard ${r.cls}`;

  const mono = document.createElement("div");
  mono.className = "monogram";
  mono.textContent = res.char.name.charAt(0);

  const body = document.createElement("div");
  body.className = "pullBody";

  const title = document.createElement("div");
  title.className = "name";
  title.textContent = `${res.char.name} · ${r.label}`;

  const sub = document.createElement("div");
  sub.className = "meta";
  sub.textContent = res.maxed
    ? "Bereits MAX — +12 ◆ zurück"
    : (res.dupe ? `Duplikat → Level ${res.level}` : res.char.handle);

  const quote = document.createElement("div");
  quote.className = "quote";
  quote.textContent = `„${res.char.lines.pull}“`;

  const perk = document.createElement("div");
  perk.className = "perkText";
  perk.textContent = "PERK: " + res.char.perk.text(res.level || 1);

  body.append(title, sub, quote, perk);
  card.append(mono, body);

  // Reveal-Animation neu triggern
  wrap.appendChild(card);
  void card.offsetWidth;
  card.classList.add("reveal");
}

function renderCrewGrid() {
  const wrap = $("crewGrid");
  if (!wrap) return;
  wrap.innerHTML = "";

  const order = ["phantom", "elite", "pro", "street"];
  const sorted = [...CHARS].sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity));

  for (const c of sorted) {
    const owned = game.crew.roster[c.id] || 0;
    const equipped = game.crew.equipped.includes(c.id);
    const r = RARITIES[c.rarity];

    const card = document.createElement("div");
    card.className = `charCard ${r.cls}` + (owned ? "" : " locked") + (equipped ? " equipped" : "");

    const mono = document.createElement("div");
    mono.className = "monogram";
    mono.textContent = owned ? c.name.charAt(0) : "?";

    const body = document.createElement("div");
    body.className = "charBody";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = owned ? c.name : "SIGNAL UNBEKANNT";

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = owned ? `${c.handle} · ${r.label} · LVL ${owned}` : `${r.label} · noch nicht entschlüsselt`;

    const perk = document.createElement("div");
    perk.className = "perkText";
    perk.textContent = owned ? c.perk.text(owned) : "PERK: ???";

    body.append(name, meta, perk);

    if (owned) {
      const bio = document.createElement("div");
      bio.className = "meta bio";
      bio.textContent = c.bio;
      body.appendChild(bio);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn small" + (equipped ? " pink" : " yellow");
      btn.textContent = equipped ? "ABLEGEN" : "AUSRÜSTEN";
      bindFastPress(btn, () => toggleEquip(c.id));
      body.appendChild(btn);
    }

    card.append(mono, body);
    wrap.appendChild(card);
  }
}

function toggleEquip(id) {
  const i = game.crew.equipped.indexOf(id);
  if (i >= 0) {
    game.crew.equipped.splice(i, 1);
  } else {
    if (game.crew.equipped.length >= 2) return toast("MAX 2 IM EINSATZ.");
    game.crew.equipped.push(id);
    banter("pull");
  }
  saveNow();
  renderCrewGrid();
}

function renderGear() {
  const wrap = $("gearList");
  if (!wrap) return;
  wrap.innerHTML = "";

  for (const g of GEAR) {
    const lvl = game.upgrades[g.id] || 0;
    const maxed = lvl >= g.costs.length;

    const row = document.createElement("div");
    row.className = "gearRow";

    const body = document.createElement("div");
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = `${g.name} · STUFE ${lvl}/${g.costs.length}`;

    const desc = document.createElement("div");
    desc.className = "meta";
    desc.textContent = g.desc;

    body.append(name, desc);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn small yellow";
    btn.textContent = maxed ? "MAX" : `KAUFEN ${g.costs[lvl]} E$`;
    if (!maxed) bindFastPress(btn, () => buyGear(g.id));

    row.append(body, btn);
    wrap.appendChild(row);
  }
}

export function initCrewUI() {
  bindFastPress($("btnCrew"), () => (overlayOpen ? closeCrewOverlay() : openCrewOverlay()));
  bindFastPress($("btnCloseCrew"), closeCrewOverlay);

  document.querySelectorAll(".tabBtn").forEach((b) => {
    bindFastPress(b, () => switchTab(b.dataset.tab));
  });

  bindFastPress($("btnPull"), () => {
    const res = pull();
    renderBroker();
    if (res) {
      renderPullResult(res);
      renderCrewGrid();
      toast(res.dupe ? "DUPLIKAT → PERK VERBESSERT" : `NEU IM NETZ: ${res.char.name}`);
    }
  });
}
