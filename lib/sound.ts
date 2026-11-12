'use client';
// Balloon Party: the free default sound pack, synthesized with the Web Audio API.
// Every sound is generated on the fly, so there is nothing to download and no lag.
// Later packs can swap in recorded audio sprites behind the same play() calls.

export type SoundName =
  | 'type'
  | 'remove'
  | 'shuffle'
  | 'correct'
  | 'wrong'
  | 'repeat'
  | 'full'
  | 'milestone'
  | 'cleared';

type Settings = { muted: boolean; effects: number; celebrations: number };
const KEY = 'ap:sound';
const CELEBRATIONS: SoundName[] = ['full', 'milestone', 'cleared'];

let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
let settings: Settings = { muted: false, effects: 0.8, celebrations: 0.8 };

export function loadSoundSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) settings = { ...settings, ...JSON.parse(raw) };
  } catch {}
  return settings;
}

export function saveSoundSettings(next: Partial<Settings>): Settings {
  settings = { ...settings, ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {}
  return settings;
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    if (!C) return null;
    ctx = new C({ latencyHint: 'interactive' });
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Call on the first tap or key press so iPhone Safari allows audio. */
export function primeAudio() {
  const c = ac();
  if (!c || noiseBuf) return;
  noiseBuf = c.createBuffer(1, c.sampleRate * 1, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function out(c: AudioContext, vol: number): GainNode {
  const g = c.createGain();
  g.gain.value = vol;
  g.connect(c.destination);
  return g;
}

function noise(c: AudioContext, dest: AudioNode, t: number, dur: number, opts: { type: BiquadFilterType; freq: number; q?: number; endFreq?: number; level?: number; attack?: number }) {
  if (!noiseBuf) primeAudio();
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = opts.type;
  f.frequency.setValueAtTime(opts.freq, t);
  if (opts.endFreq) f.frequency.exponentialRampToValueAtTime(opts.endFreq, t + dur);
  f.Q.value = opts.q ?? 1;
  const g = c.createGain();
  const level = opts.level ?? 1;
  const a = opts.attack ?? 0.001;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

function tone(c: AudioContext, dest: AudioNode, t: number, dur: number, opts: { type: OscillatorType; freq: number; endFreq?: number; level?: number; attack?: number; vibrato?: number }) {
  const o = c.createOscillator();
  o.type = opts.type;
  o.frequency.setValueAtTime(opts.freq, t);
  if (opts.endFreq) o.frequency.exponentialRampToValueAtTime(opts.endFreq, t + dur);
  if (opts.vibrato) {
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = opts.vibrato;
    lg.gain.value = opts.freq * 0.03;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.02);
  }
  const g = c.createGain();
  const level = opts.level ?? 0.5;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + (opts.attack ?? 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function pop(c: AudioContext, dest: AudioNode, t: number, size = 1) {
  // Sharp crack plus a low rubbery thump.
  noise(c, dest, t, 0.09 * size, { type: 'highpass', freq: 900 / size, level: 0.9 });
  noise(c, dest, t, 0.05, { type: 'bandpass', freq: 2600, q: 0.8, level: 0.6 });
  tone(c, dest, t, 0.08 * size, { type: 'sine', freq: 170 / size, endFreq: 55, level: 0.7, attack: 0.001 });
}

/** extra: word length for correct sounds, so longer words sound bigger. */
export function play(name: SoundName, extra = 0) {
  if (settings.muted) return;
  const c = ac();
  if (!c) return;
  const vol = CELEBRATIONS.includes(name) ? settings.celebrations : settings.effects;
  if (vol <= 0) return;
  const dest = out(c, vol);
  const t = c.currentTime + 0.005;

  switch (name) {
    case 'type': {
      // Three click variations so fast typing never sounds like a machine gun.
      const v = Math.floor(Math.random() * 3);
      const freq = [2400, 2900, 3400][v];
      noise(c, dest, t, 0.03, { type: 'bandpass', freq, q: 2.5, level: 0.5 });
      tone(c, dest, t, 0.025, { type: 'sine', freq: freq / 2, level: 0.12, attack: 0.001 });
      break;
    }
    case 'remove':
      noise(c, dest, t, 0.035, { type: 'bandpass', freq: 1100, q: 2, level: 0.45 });
      tone(c, dest, t, 0.03, { type: 'sine', freq: 520, endFreq: 380, level: 0.12, attack: 0.001 });
      break;
    case 'shuffle':
      noise(c, dest, t, 0.17, { type: 'bandpass', freq: 700, endFreq: 2600, q: 3, level: 0.35, attack: 0.02 });
      noise(c, dest, t + 0.05, 0.12, { type: 'bandpass', freq: 2200, endFreq: 900, q: 3, level: 0.25, attack: 0.01 });
      break;
    case 'correct': {
      const len = Math.max(4, extra || 4);
      pop(c, dest, t, 0.9 + (len - 4) * 0.05);
      // A short ding that climbs with word length.
      const f = 880 * Math.pow(2, ((len - 4) * 2) / 12);
      tone(c, dest, t + 0.03, 0.22, { type: 'triangle', freq: f, level: 0.22 });
      break;
    }
    case 'wrong':
      // Quick squeaky deflate, snappy like a buzzer.
      tone(c, dest, t, 0.16, { type: 'sawtooth', freq: 260, endFreq: 150, level: 0.18, vibrato: 32 });
      tone(c, dest, t, 0.16, { type: 'square', freq: 130, endFreq: 95, level: 0.08 });
      break;
    case 'repeat':
      tone(c, dest, t, 0.12, { type: 'sine', freq: 170, endFreq: 90, level: 0.45 });
      noise(c, dest, t, 0.05, { type: 'lowpass', freq: 600, level: 0.2 });
      break;
    case 'full':
      pop(c, dest, t, 1.3);
      // Party horn: buzzy rising blare with vibrato.
      tone(c, dest, t + 0.08, 0.55, { type: 'sawtooth', freq: 392, endFreq: 523, level: 0.2, vibrato: 18, attack: 0.03 });
      tone(c, dest, t + 0.08, 0.55, { type: 'square', freq: 196, endFreq: 262, level: 0.07, attack: 0.03 });
      break;
    case 'milestone':
      [1047, 1319, 1568].forEach((f, i) => tone(c, dest, t + i * 0.09, 0.3, { type: 'triangle', freq: f, level: 0.22 }));
      break;
    case 'cleared': {
      for (let i = 0; i < 8; i++) pop(c, dest, t + i * 0.07 + Math.random() * 0.03, 0.8 + Math.random() * 0.5);
      tone(c, dest, t + 0.55, 0.9, { type: 'sawtooth', freq: 392, endFreq: 784, level: 0.18, vibrato: 16, attack: 0.04 });
      [1047, 1319, 1568, 2093].forEach((f, i) => tone(c, dest, t + 0.6 + i * 0.1, 0.45, { type: 'triangle', freq: f, level: 0.18 }));
      // Crowd-ish cheer: wide noise swell.
      noise(c, dest, t + 0.5, 1.4, { type: 'bandpass', freq: 1400, q: 0.5, level: 0.18, attack: 0.3 });
      break;
    }
  }
  setTimeout(() => dest.disconnect(), 2500);
}
