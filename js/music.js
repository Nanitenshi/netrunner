// js/music.js — generative Ambient-Musik über WebAudio, keine Audio-Assets.
// A-Moll-Pentatonik-Arpeggio über einem langsamen Pad; MISSION-Modus spielt dichter.

import { getAudioCtx } from "./sfx.js?v=e986ddcb";

const SCALE = [110, 130.81, 146.83, 164.81, 196, 220, 261.63, 293.66, 329.63]; // A-Pentatonik
const PAD_ROOTS = [110, 87.31, 130.81, 98]; // A2 → F2 → C3 → G2

const STEP = 60 / 84 / 2; // Achtel bei 84 BPM

let enabled = false;
let running = false;
let intensity = 0; // 0 = World, 1 = Mission

let master = null;
let nextStep = 0;
let stepCount = 0;
let scaleIdx = 4;
let padIdx = 0;
let nextPadAt = 0;
let timer = null;

function ensureGraph(ac) {
  if (master) return;
  master = ac.createGain();
  master.gain.value = 0.11;
  master.connect(ac.destination);
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
    const density = intensity === 1 ? 0.42 : 0.22;

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
