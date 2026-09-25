/**
 * Procedural audio: every sound effect, ambience bed and music loop is
 * synthesised with WebAudio at runtime. No audio files.
 */

export type Sfx =
  | 'click' | 'hover' | 'door_roll' | 'door_clank' | 'bolt' | 'gavel' | 'bid' | 'box_open' | 'thud' | 'pickup'
  | 'coin' | 'cash' | 'sparkle' | 'jackpot' | 'fail' | 'levelup' | 'achievement' | 'spray' | 'ratchet' | 'step'
  | 'tick' | 'riser' | 'ooh' | 'truck' | 'notify' | 'error' | 'drawer' | 'secret' | 'tarp' | 'toss' | 'paper';

export type Ambience = 'outdoor' | 'unit' | 'garage' | null;
export type Music = 'menu' | 'auction' | 'search' | 'garage' | 'summary' | null;

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private ambBus!: GainNode;
  private verb!: ConvolverNode;
  private verbSend!: GainNode;
  private noise!: AudioBuffer;
  private ambNodes: AudioNode[] = [];
  private ambKind: Ambience = null;
  private musicKind: Music = null;
  private musicTimer: number | null = null;
  private nextNote = 0;
  private step = 0;
  intensity = 0;
  private volumes = { master: 0.8, music: 0.5, sfx: 0.8 };
  voiceEnabled = true;
  voiceLang = 'en-US';
  private crowdGain: GainNode | null = null;

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture (browsers block audio until then). */
  unlock() {
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctx();
        this.build();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private build() {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.ambBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.ambBus.connect(this.master);
    // Small room reverb from decaying noise.
    this.verb = ctx.createConvolver();
    const len = ctx.sampleRate * 1.6;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.verb.buffer = ir;
    this.verbSend = ctx.createGain();
    this.verbSend.gain.value = 0.22;
    this.verbSend.connect(this.verb);
    this.verb.connect(this.master);
    const n = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
  }

  setVolumes(master: number, music: number, sfx: number) {
    this.volumes = { master, music, sfx };
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.volumes.music * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.volumes.sfx * 0.6, t, 0.05);
  }

  // ── Building blocks ───────────────────────────────────────────────────────

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private osc(type: OscillatorType, freq: number, t: number, dur: number, peak: number, out: AudioNode, attack = 0.005, bend?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, bend), t + dur);
    this.env(g, t, attack, peak, dur);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
    return o;
  }

  private noiseBurst(t: number, dur: number, peak: number, out: AudioNode, filter: BiquadFilterType, freq: number, q = 1, freqEnd?: number, attack = 0.004) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, attack, peak, dur);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t, Math.random());
    src.stop(t + attack + dur + 0.05);
  }

  private metal(t: number, base: number, peak: number, dur: number, out: AudioNode) {
    for (const [ratio, amp] of [[1, 1], [2.76, 0.6], [5.4, 0.4], [8.93, 0.25]] as [number, number][]) {
      this.osc('sine', base * ratio, t, dur / Math.sqrt(ratio), peak * amp * 0.5, out, 0.002);
    }
  }

  // ── Sound effects ──────────────────────────────────────────────────────────

  play(name: Sfx, vol = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.005;
    const out = this.sfxBus;
    const wet = this.verbSend;
    const v = vol;
    switch (name) {
      case 'click': this.osc('square', 1800, t, 0.03, 0.05 * v, out); break;
      case 'hover': this.osc('sine', 2400, t, 0.02, 0.015 * v, out); break;
      case 'tick': this.osc('square', 1200, t, 0.04, 0.05 * v, out); break;
      case 'door_roll': {
        const dur = 1.5;
        for (let i = 0; i < 26; i++) this.noiseBurst(t + i * 0.055 + Math.random() * 0.01, 0.05, 0.16 * v, out, 'bandpass', 900 + Math.random() * 500, 3);
        this.noiseBurst(t, dur, 0.22 * v, out, 'lowpass', 380, 0.7);
        this.metal(t + dur, 160, 0.35 * v, 0.9, out);
        this.metal(t + dur, 160, 0.2 * v, 1.2, wet);
        break;
      }
      case 'door_clank': this.metal(t, 180, 0.45 * v, 1, out); this.metal(t, 180, 0.2 * v, 1.2, wet); this.noiseBurst(t, 0.08, 0.3 * v, out, 'highpass', 2000); break;
      case 'bolt': this.noiseBurst(t, 0.05, 0.4 * v, out, 'highpass', 3000); this.metal(t + 0.02, 700, 0.3 * v, 0.4, out); break;
      case 'gavel':
        this.osc('sine', 190, t, 0.18, 0.7 * v, out, 0.002, 90);
        this.noiseBurst(t, 0.04, 0.5 * v, out, 'bandpass', 1400, 1.5);
        this.osc('sine', 190, t, 0.25, 0.25 * v, wet, 0.002, 90);
        break;
      case 'bid':
        this.noiseBurst(t, 0.12, 0.12 * v, out, 'bandpass', 700, 0.8, 2400);
        this.osc('sine', 320, t + 0.06, 0.08, 0.25 * v, out, 0.002, 160);
        break;
      case 'box_open':
        this.noiseBurst(t, 0.35, 0.25 * v, out, 'bandpass', 900, 0.9, 500);
        for (let i = 0; i < 8; i++) this.noiseBurst(t + Math.random() * 0.4, 0.03, 0.12 * v, out, 'highpass', 2500 + Math.random() * 2000);
        break;
      case 'drawer':
        this.noiseBurst(t, 0.28, 0.2 * v, out, 'bandpass', 500, 1.2, 900);
        this.osc('sine', 140, t + 0.26, 0.1, 0.3 * v, out, 0.002, 90);
        break;
      case 'thud': this.osc('sine', 95, t, 0.25, 0.7 * v, out, 0.002, 45); this.noiseBurst(t, 0.1, 0.3 * v, out, 'lowpass', 600); break;
      case 'pickup': this.noiseBurst(t, 0.22, 0.14 * v, out, 'bandpass', 500, 1.2, 2600); this.osc('sine', 660, t + 0.05, 0.12, 0.08 * v, out, 0.01, 990); break;
      case 'toss': this.noiseBurst(t, 0.25, 0.14 * v, out, 'bandpass', 1600, 1, 400); this.osc('sine', 80, t + 0.2, 0.2, 0.4 * v, out, 0.002, 40); break;
      case 'coin': for (const [i, f] of [1800, 2400, 3150].entries()) this.metal(t + i * 0.07, f, 0.12 * v, 0.5, out); break;
      case 'cash':
        this.metal(t, 2100, 0.25 * v, 0.8, out);
        this.metal(t, 2100, 0.12 * v, 1, wet);
        this.noiseBurst(t + 0.12, 0.2, 0.15 * v, out, 'bandpass', 1500, 2);
        this.osc('sine', 120, t + 0.3, 0.08, 0.3 * v, out, 0.002, 70);
        break;
      case 'sparkle': {
        const notes = [84, 88, 91, 96, 100];
        notes.forEach((n, i) => { this.osc('sine', NOTE(n), t + i * 0.06, 0.5, 0.08 * v, out); this.osc('sine', NOTE(n), t + i * 0.06, 0.8, 0.05 * v, wet); });
        break;
      }
      case 'secret': {
        [60, 63, 67, 72, 75].forEach((n, i) => { this.osc('triangle', NOTE(n), t + i * 0.09, 0.9, 0.09 * v, out); this.osc('sine', NOTE(n + 12), t + i * 0.09, 1.2, 0.05 * v, wet); });
        break;
      }
      case 'jackpot': {
        this.osc('sine', 55, t, 1.6, 0.8 * v, out, 0.002, 38);
        this.noiseBurst(t, 1.2, 0.18 * v, wet, 'lowpass', 3000, 0.7, 400);
        const chord = [60, 64, 67, 72, 76, 79];
        chord.forEach((n, i) => {
          for (const det of [-6, 6]) {
            const o = this.osc('sawtooth', NOTE(n) * Math.pow(2, det / 1200), t + 0.15 + i * 0.05, 2.6, 0.035 * v, wet, 0.4);
            void o;
          }
          this.osc('triangle', NOTE(n + 12), t + 0.15 + i * 0.05, 2.4, 0.04 * v, out, 0.3);
        });
        break;
      }
      case 'fail': this.osc('triangle', 330, t, 0.35, 0.18 * v, out, 0.01, 180); this.osc('triangle', 247, t + 0.2, 0.45, 0.16 * v, out, 0.01, 120); break;
      case 'error': this.osc('square', 140, t, 0.16, 0.08 * v, out); break;
      case 'levelup': [67, 71, 74, 79, 83].forEach((n, i) => this.osc('triangle', NOTE(n), t + i * 0.08, 0.5, 0.12 * v, out)); break;
      case 'achievement': [76, 83, 88].forEach((n, i) => { this.metal(t + i * 0.12, NOTE(n) / 2, 0.14 * v, 1.2, out); }); break;
      case 'spray':
        for (let i = 0; i < 3; i++) this.noiseBurst(t + i * 0.28, 0.2, 0.18 * v, out, 'highpass', 4000);
        for (let i = 0; i < 8; i++) this.noiseBurst(t + 0.9 + i * 0.09, 0.07, 0.12 * v, out, 'bandpass', 1800, 1.4);
        break;
      case 'ratchet': for (let i = 0; i < 10; i++) this.noiseBurst(t + i * 0.06, 0.02, 0.25 * v, out, 'bandpass', 3000, 4); this.metal(t + 0.7, 900, 0.15 * v, 0.3, out); break;
      case 'step': this.noiseBurst(t, 0.06, 0.12 * v, out, 'lowpass', 500 + Math.random() * 200); break;
      case 'riser': this.noiseBurst(t, 1.4, 0.12 * v, out, 'bandpass', 300, 2, 3500, 0.9); this.osc('sawtooth', 110, t, 1.4, 0.04 * v, out, 1.2, 220); break;
      case 'ooh': this.noiseBurst(t, 1.1, 0.16 * v, out, 'bandpass', 600, 4, 900, 0.3); this.noiseBurst(t, 1.1, 0.1 * v, out, 'bandpass', 1500, 5, 1900, 0.3); break;
      case 'truck':
        this.osc('sawtooth', 48, t, 1.8, 0.2 * v, out, 0.2, 70);
        this.noiseBurst(t, 1.8, 0.2 * v, out, 'lowpass', 300, 0.8, 900, 0.3);
        break;
      case 'notify': this.osc('sine', 880, t, 0.1, 0.1 * v, out); this.osc('sine', 1320, t + 0.1, 0.18, 0.1 * v, out); break;
      case 'tarp': this.noiseBurst(t, 0.6, 0.25 * v, out, 'bandpass', 1200, 0.6, 3000); break;
      case 'paper': this.noiseBurst(t, 0.2, 0.14 * v, out, 'highpass', 2500); break;
    }
  }

  // ── Ambience ──────────────────────────────────────────────────────────────

  ambience(kind: Ambience) {
    if (!this.ctx || kind === this.ambKind) return;
    this.ambKind = kind;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (const n of this.ambNodes) {
      try {
        if (n instanceof GainNode) { n.gain.setTargetAtTime(0, t, 0.4); }
        setTimeout(() => { try { (n as AudioScheduledSourceNode).stop?.(); n.disconnect(); } catch { /* already stopped */ } }, 1500);
      } catch { /* ignore */ }
    }
    this.ambNodes = [];
    this.crowdGain = null;
    if (!kind) return;
    const bed = (filter: BiquadFilterType, freq: number, gain: number, lfo = 0.07) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = filter;
      f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(gain, t, 1);
      const l = ctx.createOscillator();
      const lg = ctx.createGain();
      l.frequency.value = lfo;
      lg.gain.value = gain * 0.5;
      l.connect(lg);
      lg.connect(g.gain);
      src.connect(f);
      f.connect(g);
      g.connect(this.ambBus);
      src.start();
      l.start();
      this.ambNodes.push(src, l, g);
      return g;
    };
    const hum = (freq: number, gain: number) => {
      const o = ctx.createOscillator();
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(gain, t, 1);
      o.connect(g);
      g.connect(this.ambBus);
      o.start();
      this.ambNodes.push(o, g);
    };
    if (kind === 'outdoor') {
      bed('lowpass', 420, 0.07, 0.05);
      bed('lowpass', 110, 0.08, 0.02);
      this.crowdGain = bed('bandpass', 700, 0.0, 0.3);
    } else if (kind === 'unit') {
      bed('lowpass', 250, 0.05, 0.04);
      hum(60, 0.012);
      hum(120, 0.006);
    } else if (kind === 'garage') {
      bed('lowpass', 180, 0.04, 0.03);
      hum(120, 0.004);
    }
  }

  /** Crowd murmur level in front of the unit (0..1). */
  crowd(level: number) {
    if (!this.ctx || !this.crowdGain) return;
    this.crowdGain.gain.setTargetAtTime(level * 0.09, this.ctx.currentTime, 0.5);
  }

  // ── Music: tiny generative sequencer ──────────────────────────────────────

  music(kind: Music) {
    if (!this.ctx || kind === this.musicKind) return;
    this.musicKind = kind;
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (!kind) return;
    this.step = 0;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.schedule(), 60);
  }

  private schedule() {
    if (!this.ctx || !this.musicKind) return;
    const kind = this.musicKind;
    const bpm = kind === 'auction' ? 116 + this.intensity * 14 : kind === 'search' ? 70 : kind === 'summary' ? 84 : 78;
    const sixteenth = 60 / bpm / 4;
    while (this.nextNote < this.ctx.currentTime + 0.25) {
      this.playStep(kind, this.step, this.nextNote, sixteenth);
      this.nextNote += sixteenth;
      this.step++;
    }
  }

  private playStep(kind: Music, s: number, t: number, len: number) {
    const out = this.musicBus;
    const wet = this.verbSend;
    const bar = Math.floor(s / 16);
    const pos = s % 16;
    if (kind === 'menu' || kind === 'garage' || kind === 'summary') {
      // Lo-fi chords: Am7 – Fmaj7 – Cmaj7 – G6
      const prog = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 64]];
      const chord = prog[bar % 4];
      if (pos === 0) chord.forEach((n) => { this.osc('triangle', NOTE(n), t, len * 15, 0.028, out, 0.25); this.osc('sine', NOTE(n), t, len * 16, 0.02, wet, 0.4); });
      if (pos === 0 || pos === 10) this.osc('sine', NOTE(chord[0] - 12), t, len * 5, 0.09, out, 0.01, NOTE(chord[0] - 12) * 0.98);
      if (pos === 0 || pos === 8) this.osc('sine', 60, t, 0.18, 0.12, out, 0.002, 40);
      if (pos === 4 || pos === 12) this.noiseBurst(t, 0.09, 0.03, out, 'bandpass', 1800, 0.8);
      if (pos % 2 === 0) this.noiseBurst(t, 0.025, 0.012, out, 'highpass', 7000);
      if (kind === 'garage' && (pos === 3 || pos === 6 || pos === 14) && Math.random() < 0.6) this.osc('triangle', NOTE(chord[(pos / 3) % 4 | 0] + 12), t, len * 3, 0.03, wet);
      if (Math.random() < 0.02) this.noiseBurst(t, 0.01, 0.02, out, 'highpass', 5000);
    } else if (kind === 'auction') {
      const roots = [45, 45, 41, 43];
      const r = roots[bar % 4];
      if (pos % 2 === 0) this.osc('sawtooth', NOTE(r - 12 + (pos % 8 === 6 ? 7 : 0)), t, len * 1.6, 0.05 + this.intensity * 0.02, out, 0.005);
      if (pos % 4 === 0) this.osc('sine', 58, t, 0.16, 0.18, out, 0.002, 38);
      if (pos % 2 === 1 || this.intensity > 0.6) this.noiseBurst(t, 0.03, 0.02 + this.intensity * 0.02, out, 'highpass', 8000);
      if (pos === 4 || pos === 12) this.noiseBurst(t, 0.12, 0.05, out, 'bandpass', 2000, 0.8);
      if (this.intensity > 0.4 && pos % 4 === 2) this.osc('square', NOTE(r + 12 + [0, 3, 7, 10][(s >> 2) % 4]), t, len, 0.012 * this.intensity, out);
    } else if (kind === 'search') {
      if (pos === 0 && bar % 2 === 0) this.osc('sine', NOTE(38), t, len * 30, 0.05, out, 1.5);
      if (Math.random() < 0.18 && pos % 2 === 0) {
        const scale = [62, 65, 67, 69, 72, 74, 77];
        this.osc('triangle', NOTE(scale[Math.floor(Math.random() * scale.length)]), t, len * 6, 0.03, wet, 0.01);
      }
    }
  }

  // ── Auctioneer voice ──────────────────────────────────────────────────────

  speak(text: string, rate = 1.28) {
    if (!this.voiceEnabled) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate;
      u.pitch = 0.85;
      u.volume = this.volumes.master;
      u.lang = this.voiceLang;
      const voice = synth.getVoices().find((v) => v.lang.startsWith(this.voiceLang.slice(0, 2)));
      if (voice) u.voice = voice;
      synth.speak(u);
    } catch { /* speech unavailable */ }
  }

  silenceVoice() {
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  }
}
