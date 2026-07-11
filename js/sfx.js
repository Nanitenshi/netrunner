// js/sfx.js — synthetisierte Sounds über WebAudio, keine Assets nötig
let ac = null;
let enabled = true;
let sfxMaster = null;

function ctx() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (ac.state === "suspended") ac.resume().catch(() => {});
  return ac;
}

// Alle SFX laufen über diesen Bus — Handy-Lautsprecher sind leise,
// Rohwerte hier deutlich höher als "am Rechner richtig" ansetzen
function sfxBus() {
  const a = ctx();
  if (!a) return null;
  if (!sfxMaster) {
    sfxMaster = a.createGain();
    sfxMaster.gain.value = 1.9;
    sfxMaster.connect(a.destination);
  }
  return sfxMaster;
}

// Erst nach erster User-Geste initialisieren (Autoplay-Policy)
export function unlockAudio() {
  ctx();
}

// Gemeinsamer Context für music.js (zwei Contexts pro Seite wären Verschwendung)
export function getAudioCtx() {
  return ctx();
}

export function setSfxEnabled(on) {
  enabled = !!on;
}

export function sfxEnabled() {
  return enabled;
}

function tone({ freq = 440, end = freq, dur = 0.12, type = "square", vol = 0.15, delay = 0 }) {
  if (!enabled) return;
  const a = ctx();
  const bus = sfxBus();
  if (!a || !bus) return;

  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + dur);

  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  osc.connect(gain).connect(bus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.2, vol = 0.2, delay = 0 }) {
  if (!enabled) return;
  const a = ctx();
  const bus = sfxBus();
  if (!a || !bus) return;

  const t0 = a.currentTime + delay;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);

  const src = a.createBufferSource();
  src.buffer = buf;

  const gain = a.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;

  src.connect(filter).connect(gain).connect(bus);
  src.start(t0);
}

export const sfx = {
  tap:      () => tone({ freq: 700, end: 900, dur: 0.05, type: "square", vol: 0.06 }),
  pop:      () => { tone({ freq: 520, end: 1040, dur: 0.09, vol: 0.12 }); tone({ freq: 1560, end: 2080, dur: 0.06, vol: 0.05, delay: 0.03 }); },
  good:     () => { tone({ freq: 660, dur: 0.08, vol: 0.1 }); tone({ freq: 880, dur: 0.1, vol: 0.1, delay: 0.08 }); },
  bad:      () => tone({ freq: 220, end: 110, dur: 0.18, type: "sawtooth", vol: 0.14 }),
  clear:    () => { tone({ freq: 523, dur: 0.09, vol: 0.11 }); tone({ freq: 659, dur: 0.09, vol: 0.11, delay: 0.09 }); tone({ freq: 784, dur: 0.14, vol: 0.11, delay: 0.18 }); },
  jackout:  () => { tone({ freq: 784, dur: 0.08, vol: 0.11 }); tone({ freq: 1046, dur: 0.16, vol: 0.11, delay: 0.09 }); },
  dumped:   () => { noise({ dur: 0.35, vol: 0.25 }); tone({ freq: 180, end: 55, dur: 0.5, type: "sawtooth", vol: 0.16 }); },
  deeper:   () => tone({ freq: 330, end: 165, dur: 0.25, type: "triangle", vol: 0.12 }),
  pullTick: () => tone({ freq: 980, end: 980, dur: 0.03, type: "square", vol: 0.05 }),
  pullHit:  (rare) => {
    if (rare) {
      tone({ freq: 523, dur: 0.1, vol: 0.12 }); tone({ freq: 659, dur: 0.1, vol: 0.12, delay: 0.1 });
      tone({ freq: 784, dur: 0.1, vol: 0.12, delay: 0.2 }); tone({ freq: 1046, dur: 0.25, vol: 0.14, delay: 0.3 });
    } else {
      tone({ freq: 440, dur: 0.08, vol: 0.1 }); tone({ freq: 587, dur: 0.14, vol: 0.1, delay: 0.09 });
    }
  }
};
