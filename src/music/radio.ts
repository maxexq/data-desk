// Data Desk FM: endless lofi / cafe / chill music made live with the Web Audio API.
// Everything here is synthesised (no samples), so it costs no download and has no licence to track.

export interface Chord {
  bass: number; // MIDI note
  notes: number[]; // voicing for keys and pads
}

export interface Station {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  swing: number; // 0 = straight 16ths, 0.33 = triplet feel
  barsPerChord: number;
  chords: Chord[];
  scale: number[]; // MIDI notes the melody may use
  drums: 'boom-bap' | 'brushes' | 'none';
  bass: 'roots' | 'walking' | 'drone';
  keys: 'lazy' | 'comp' | 'arp';
  pad: boolean;
  rain: boolean;
  tone: number; // master low-pass cutoff in Hz: lower = dustier
  melody: number; // chance of a melody note per eighth
}

export const STATIONS: Station[] = [
  {
    id: 'rainy-desk',
    name: 'Rainy Desk',
    genre: 'lofi beats',
    bpm: 74,
    swing: 0.22,
    barsPerChord: 1,
    chords: [
      { bass: 43, notes: [58, 62, 65, 69] }, // Gm9
      { bass: 48, notes: [58, 62, 64, 67] }, // C9
      { bass: 41, notes: [57, 60, 64, 67] }, // Fmaj9
      { bass: 38, notes: [57, 60, 64, 65] }, // Dm9
    ],
    scale: [65, 67, 69, 72, 74, 77, 79, 81],
    drums: 'boom-bap',
    bass: 'roots',
    keys: 'lazy',
    pad: false,
    rain: true,
    tone: 2600,
    melody: 0.22,
  },
  {
    id: 'mango-cafe',
    name: 'Mango Café',
    genre: 'cafe jazz',
    bpm: 112,
    swing: 0.33,
    barsPerChord: 1,
    chords: [
      { bass: 48, notes: [59, 62, 64, 67] }, // Cmaj9
      { bass: 45, notes: [55, 61, 64, 66] }, // A13
      { bass: 38, notes: [57, 60, 64, 65] }, // Dm9
      { bass: 43, notes: [53, 59, 64, 69] }, // G13
    ],
    scale: [72, 74, 76, 79, 81, 84, 86],
    drums: 'brushes',
    bass: 'walking',
    keys: 'comp',
    pad: false,
    rain: false,
    tone: 5200,
    melody: 0.16,
  },
  {
    id: 'server-room',
    name: 'Server Room',
    genre: 'chill ambient',
    bpm: 66,
    swing: 0,
    barsPerChord: 2,
    chords: [
      { bass: 39, notes: [55, 58, 62, 65] }, // Ebmaj9
      { bass: 44, notes: [55, 60, 63, 70] }, // Abmaj9
      { bass: 41, notes: [56, 60, 63, 67] }, // Fm9
      { bass: 46, notes: [53, 58, 60, 65] }, // Bbsus
    ],
    scale: [63, 65, 67, 70, 72, 75, 77],
    drums: 'none',
    bass: 'drone',
    keys: 'arp',
    pad: true,
    rain: false,
    tone: 3400,
    melody: 0.08,
  },
];

/** Bus level before the saturator. Measured to sit around -18 dB RMS with peaks below -3 dB. */
const LEVEL = 0.3;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Small seeded random, so each play-through differs but stays musical. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number, crackle = false) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    if (!crackle) d[i] = Math.random() * 2 - 1;
    else d[i] = Math.random() < 0.0006 ? (Math.random() * 2 - 1) * 0.9 : (Math.random() * 2 - 1) * 0.015;
  }
  return buf;
}

/** One station playing. Call stop() to fade out and release everything. */
export class Radio {
  private bus: GainNode;
  private keysBus: GainNode;
  private delay: DelayNode;
  private noise: AudioBuffer;
  private loops: AudioBufferSourceNode[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private next = 0;
  private rand: () => number;
  private lastMelody = 0;

  constructor(
    private ctx: AudioContext,
    out: AudioNode,
    private st: Station,
  ) {
    this.rand = rng(Date.now());
    this.noise = noiseBuffer(ctx, 2);

    // master: gain → gentle saturation → low-pass (the "dusty" part) → out
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i / 512 - 1) * 1.6) / Math.tanh(1.6);
    shaper.curve = curve;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = st.tone;
    lp.Q.value = 0.5;
    // a slow wobble on the filter, like an old tape
    const lfo = ctx.createOscillator();
    const lfoAmt = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoAmt.gain.value = st.tone * 0.12;
    lfo.connect(lfoAmt).connect(lp.frequency);
    lfo.start();
    this.bus.connect(shaper).connect(lp).connect(out);

    // keys go through a soft echo
    this.keysBus = ctx.createGain();
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = (60 / st.bpm) * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = st.keys === 'arp' ? 0.4 : 0.22;
    const wet = ctx.createGain();
    wet.gain.value = st.keys === 'arp' ? 0.35 : 0.18;
    this.keysBus.connect(this.bus);
    this.keysBus.connect(this.delay);
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(wet).connect(this.bus);

    // vinyl crackle, always there
    this.loop(noiseBuffer(ctx, 4, true), 0.5, (n) => n);
    if (st.rain) {
      this.loop(this.noise, 0.05, (n) => {
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 500;
        const lo = ctx.createBiquadFilter();
        lo.type = 'lowpass';
        lo.frequency.value = 1800;
        n.connect(hp).connect(lo);
        return lo;
      });
    }
  }

  private loop(buf: AudioBuffer, level: number, route: (n: AudioNode) => AudioNode) {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = level;
    route(src).connect(g).connect(this.bus);
    src.start();
    this.loops.push(src);
  }

  start() {
    const t = this.ctx.currentTime;
    this.bus.gain.setValueAtTime(0, t);
    this.bus.gain.linearRampToValueAtTime(LEVEL, t + 1.2);
    this.next = t + 0.08;
    this.step = 0;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(0, t + 0.25);
    setTimeout(() => {
      this.loops.forEach((l) => l.stop());
      this.bus.disconnect();
    }, 400);
  }

  private schedule() {
    const sixteenth = 60 / this.st.bpm / 4;
    while (this.next < this.ctx.currentTime + 0.15) {
      const swing = this.step % 2 === 1 ? this.st.swing * sixteenth : 0;
      this.play(this.step, this.next + swing, sixteenth);
      this.next += sixteenth;
      this.step++;
    }
  }

  private play(step: number, t: number, s16: number) {
    const st = this.st;
    const inBar = step % 16;
    const bar = Math.floor(step / 16);
    const chord = st.chords[Math.floor(bar / st.barsPerChord) % st.chords.length];
    const nextChord = st.chords[Math.floor((bar + 1) / st.barsPerChord) % st.chords.length];
    const newChord = inBar === 0 && bar % st.barsPerChord === 0;
    const r = this.rand;

    // ---- drums
    if (st.drums === 'boom-bap') {
      if (inBar === 0 || inBar === 10 || (inBar === 7 && r() < 0.35)) this.kick(t, inBar === 0 ? 1 : 0.75);
      if (inBar === 4 || inBar === 12) this.snare(t, 0.55);
      if (inBar % 2 === 0) this.hat(t, inBar % 4 === 2 ? 0.16 : 0.1);
      else if (r() < 0.15) this.hat(t, 0.05);
    } else if (st.drums === 'brushes') {
      if (inBar === 0 || inBar === 8) this.kick(t, 0.35);
      if (inBar % 4 === 0) this.brush(t, inBar === 4 || inBar === 12 ? 0.22 : 0.12, 0.28);
      if (inBar % 4 === 0 || inBar % 4 === 3) this.ride(t, inBar % 4 === 3 ? 0.05 : 0.08);
    }

    // ---- bass
    if (st.bass === 'roots') {
      if (newChord || inBar === 0) this.bassNote(t, chord.bass, s16 * 9, 0.5);
      if (inBar === 10 && r() < 0.6) this.bassNote(t, chord.bass + (r() < 0.5 ? 7 : 12), s16 * 4, 0.35);
    } else if (st.bass === 'walking' && inBar % 4 === 0) {
      const beat = inBar / 4;
      const tones = [chord.bass, chord.bass + (r() < 0.5 ? 3 : 4), chord.bass + 7, nextChord.bass + (r() < 0.5 ? -1 : 1)];
      this.bassNote(t, tones[beat], s16 * 3.6, 0.42);
    } else if (st.bass === 'drone' && newChord) {
      this.bassNote(t, chord.bass, s16 * 16 * st.barsPerChord, 0.3, 1.2);
    }

    // ---- keys
    if (st.keys === 'lazy') {
      if (inBar === 0) this.chord(t, chord.notes, s16 * 12, 0.16, 0.025);
      if (inBar === 14 && r() < 0.3) this.chord(t, nextChord.notes, s16 * 4, 0.1, 0.02);
    } else if (st.keys === 'comp') {
      if (inBar === 0 || inBar === 6 || (inBar === 11 && r() < 0.5)) this.chord(t, chord.notes, s16 * 2.5, 0.12, 0.008);
    } else if (st.keys === 'arp' && inBar % 2 === 0) {
      const n = chord.notes[(inBar / 2 + bar) % chord.notes.length] + (inBar >= 8 ? 12 : 0);
      this.ep(t, n, 0.07, s16 * 3);
    }
    if (st.pad && newChord) this.pad(t, chord.notes, s16 * 16 * st.barsPerChord);

    // ---- melody: a few pentatonic notes, mostly stepwise
    if (inBar % 2 === 0 && r() < st.melody) {
      let i = this.lastMelody + Math.round((r() - 0.5) * 4);
      i = Math.max(0, Math.min(st.scale.length - 1, i));
      this.lastMelody = i;
      this.ep(t, st.scale[i], 0.1, s16 * (r() < 0.5 ? 2 : 4));
    }
  }

  // ---------- instruments ----------

  private env(t: number, peak: number, attack: number, decay: number) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  private kick(t: number, vel: number) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = this.env(t, 0.9 * vel, 0.004, 0.38);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.45);
  }

  private noiseHit(t: number, level: number, attack: number, decay: number, type: BiquadFilterType, freq: number, q = 0.8) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.env(t, level, attack, decay);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + decay + 0.05);
  }

  private snare(t: number, vel: number) {
    this.noiseHit(t, 0.45 * vel, 0.002, 0.2, 'bandpass', 1900, 0.7);
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(190, t);
    const g = this.env(t, 0.25 * vel, 0.002, 0.08);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.12);
  }

  private hat(t: number, vel: number) {
    this.noiseHit(t, vel, 0.001, 0.035, 'highpass', 7500);
  }

  private ride(t: number, vel: number) {
    this.noiseHit(t, vel, 0.002, 0.25, 'highpass', 6000);
  }

  private brush(t: number, vel: number, len: number) {
    this.noiseHit(t, vel, 0.03, len, 'bandpass', 3200, 0.5);
  }

  private bassNote(t: number, midi: number, len: number, vel: number, attack = 0.01) {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = hz(midi);
    const sub = this.ctx.createOscillator();
    sub.frequency.value = hz(midi);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + attack);
    g.gain.setTargetAtTime(0.0001, t + len * 0.8, len * 0.15);
    o.connect(g);
    sub.connect(g);
    g.connect(this.bus);
    o.start(t);
    sub.start(t);
    o.stop(t + len + 0.3);
    sub.stop(t + len + 0.3);
  }

  /** Electric piano: a two-operator FM voice whose brightness fades as the note decays. */
  private ep(t: number, midi: number, vel: number, len: number) {
    const f = hz(midi);
    const car = this.ctx.createOscillator();
    car.frequency.value = f;
    const mod = this.ctx.createOscillator();
    mod.frequency.value = f;
    const idx = this.ctx.createGain();
    idx.gain.setValueAtTime(f * 1.6, t);
    idx.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.5);
    mod.connect(idx).connect(car.frequency);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.6);
    g.gain.setTargetAtTime(0.0001, t + len, 0.25);
    car.connect(g).connect(this.keysBus);
    const end = t + len + 1.4;
    car.start(t);
    mod.start(t);
    car.stop(end);
    mod.stop(end);
  }

  private chord(t: number, notes: number[], len: number, vel: number, strum: number) {
    notes.forEach((n, i) => this.ep(t + i * strum, n, vel * (0.85 + Math.random() * 0.3), len));
  }

  private pad(t: number, notes: number[], len: number) {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + len * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + len + 0.6);
    lp.connect(g).connect(this.bus);
    for (const n of notes) {
      for (const detune of [-7, 7]) {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(n);
        o.detune.value = detune;
        o.connect(lp);
        o.start(t);
        o.stop(t + len + 0.7);
      }
    }
  }
}
