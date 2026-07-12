// js/music.js — generative Ambient-Musik über WebAudio, keine Audio-Assets.
// A-Moll-Pentatonik-Arpeggio über einem langsamen Pad; MISSION-Modus spielt dichter.

import { getAudioCtx } from "./sfx.js";
import { game } from "./core.js";
import { toast } from "./ui.js";

const SCALE = [110, 130.81, 146.83, 164.81, 196, 220, 261.63, 293.66, 329.63]; // A-Pentatonik
const PAD_ROOTS = [110, 87.31, 130.81, 98]; // A2 → F2 → C3 → G2

const STEP = 60 / 84 / 2; // Achtel bei 84 BPM

// Cyberpsychose: verzerrte Hilferufe unter der Musik, Frequenz skaliert mit
// game.psychosis. Kein echtes Sprachsample — abstrakte Formant-Andeutung,
// passend zum rein synthetisierten Audio-Ansatz dieses Spiels.
const WHISPER_LINES = [
  "...hilf mir...",
  "...zieh mich raus...",
  "...ich bin noch hier...",
  "...der Buffer hält mich fest...",
  "...nicht wieder tauchen...",
  "...hörst du das auch?..."
];

let enabled = false;
let running = false;
let intensity = 0; // 0 = World, 1 = Mission

let master = null;
let nextStep = 0;
let stepCount = 0;
let scaleIdx = 4;
let padIdx = 0;
let nextPadAt = 0;
let nextWhisperAt = 0;
let timer = null;

function ensureGraph(ac) {
  if (master) return;
  master = ac.createGain();
  // Zweite Runde Spieler-Feedback nach 0.11 -> 0.42: immer noch "kaum
  // hörbar". Reines Hochdrehen des Gains stößt hier an eine andere Grenze:
  // die Plucks sind kurze, sparse Transienten (nur 22-42% Trefferchance pro
  // Achtel, ~0.7s Decay) mit viel Stille dazwischen — das bleibt dünn, egal
  // wie laut die Spitzen sind. Deshalb zusätzlich ein Kompressor: der hebt
  // die gefühlte Lautheit (RMS) an, statt nur die ohnehin seltenen Peaks
  // größer zu machen, und schützt gleichzeitig vor Clipping bei master=1.
  master.gain.value = 1.0;

  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -28;
  comp.knee.value = 12;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;

  master.connect(comp);
  comp.connect(ac.destination);
}

function pluck(ac, t, freq, vol) {
  const osc = ac.createOscillator();
  const g = ac.createGain();

  osc.type = "triangle";
  osc.frequency.value = freq;

  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);

  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.8);
}

function pad(ac, t, root) {
  for (const [mult, vol] of [[1, 0.028], [1.5, 0.02], [2, 0.014]]) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    const filter = ac.createBiquadFilter();

    osc.type = "sawtooth";
    osc.frequency.value = root * mult;
    osc.detune.value = (Math.random() - 0.5) * 8;

    filter.type = "lowpass";
    filter.frequency.value = 420;

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 3.5);
    g.gain.linearRampToValueAtTime(0.0001, t + 9);

    osc.connect(filter).connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 9.2);
  }
}

// Ein leiser, unverständlicher "Hilferuf" unter der Musik — gefilterter
// Rauschkörper (Formant-Andeutung) plus ein wehklagender Sinuston darunter
function whisper(ac, t) {
  const dur = 0.9 + Math.random() * 0.6;

  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);

  const src = ac.createBufferSource();
  src.buffer = buf;

  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 5;
  const f0 = 280 + Math.random() * 200;
  const f1 = 550 + Math.random() * 400;
  bp.frequency.setValueAtTime(f0, t);
  bp.frequency.linearRampToValueAtTime(f1, t + dur * 0.5);
  bp.frequency.linearRampToValueAtTime(f0 * 0.8, t + dur);

  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.05, t + dur * 0.25);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);

  src.connect(bp).connect(g).connect(master);
  src.start(t);

  const osc = ac.createOscillator();
  const oscGain = ac.createGain();
  osc.type = "sine";
  const base = 180 + Math.random() * 90;
  osc.frequency.setValueAtTime(base, t);
  osc.frequency.linearRampToValueAtTime(base * 0.7, t + dur);

  oscGain.gain.setValueAtTime(0.0001, t);
  oscGain.gain.linearRampToValueAtTime(0.03, t + dur * 0.3);
  oscGain.gain.linearRampToValueAtTime(0.0001, t + dur);

  osc.connect(oscGain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.1);
}

// Häufigkeit skaliert mit game.psychosis (0-100): selten und kaum wahrnehmbar
// bei niedrigem Wert, spürbar öfter, je schlechter der Spieler gerade läuft
function maybeScheduleWhisper(ac, now) {
  const p = game.psychosis || 0;
  if (p <= 0) { nextWhisperAt = now + 5; return; }
  if (nextWhisperAt >= now + 0.35) return;

  const t0 = Math.max(nextWhisperAt, now + 0.5);
  whisper(ac, t0);
  // Bildstörung im Weltcanvas fällt (grob) mit dem hörbaren Moment zusammen —
  // world.js pollt performance.now() gegen glitchUntil, kein extra Timer nötig
  setTimeout(() => { game.glitchUntil = performance.now() + 700 + Math.random() * 400; }, 500);
  if (Math.random() < 0.4) {
    const line = WHISPER_LINES[Math.floor(Math.random() * WHISPER_LINES.length)];
    toast(`▓▓ ${line} ▓▓`);
  }

  const t = Math.min(1, p / 100);
  const minGap = 150 - t * 130; // ~150s bei niedriger Psychose, ~20s bei 100
  const maxGap = 260 - t * 200; // ~260s bei niedriger Psychose, ~60s bei 100
  nextWhisperAt = now + minGap + Math.random() * (maxGap - minGap);
}

function schedule() {
  const ac = getAudioCtx();
  if (!ac || !enabled) return;
  ensureGraph(ac);

  const now = ac.currentTime;
  if (nextStep < now) nextStep = now + 0.05;
  if (nextPadAt < now) nextPadAt = now + 0.1;

  // Arpeggio-Steps im 0.35s-Lookahead-Fenster planen
  while (nextStep < now + 0.35) {
    stepCount += 1;
    // Dichter als vorher — bei niedriger Trefferchance blieben zu große
    // stille Lücken zwischen den Plucks, was leise wirkt, egal wie laut
    // die einzelne Note ist
    const density = intensity === 1 ? 0.6 : 0.34;

    if (Math.random() < density) {
      // Random Walk über die Skala, bleibt melodisch statt chaotisch
      scaleIdx += Math.random() < 0.5 ? -1 : 1;
      scaleIdx = Math.max(1, Math.min(SCALE.length - 1, scaleIdx));

      pluck(ac, nextStep, SCALE[scaleIdx], intensity === 1 ? 0.05 : 0.035);
      // Echo eine punktierte Achtel später, leiser — billiger Delay-Effekt
      pluck(ac, nextStep + STEP * 1.5, SCALE[scaleIdx], 0.015);
    }
    nextStep += STEP;
  }

  // Pad-Akkord alle ~8s
  if (nextPadAt < now + 0.35) {
    pad(ac, nextPadAt, PAD_ROOTS[padIdx % PAD_ROOTS.length]);
    padIdx += 1;
    nextPadAt += 8;
  }

  maybeScheduleWhisper(ac, now);
}

function startLoop() {
  if (running) return;
  running = true;
  timer = setInterval(schedule, 120);
}

function stopLoop() {
  running = false;
  if (timer) { clearInterval(timer); timer = null; }
  if (master) {
    const ac = getAudioCtx();
    if (ac) master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.2);
    setTimeout(() => {
      if (!running && master) { master.disconnect(); master = null; }
    }, 800);
  }
}

export function musicSetEnabled(on) {
  enabled = !!on;
  if (enabled) startLoop(); else stopLoop();
}

export function musicEnabled() {
  return enabled;
}

export function musicSetIntensity(i) {
  intensity = i;
}
