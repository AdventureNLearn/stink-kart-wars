/** Procedural hilarious kart SFX via Web Audio (no asset files). */

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private unlocked = false;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private musicNodes: AudioNode[] = [];
  private musicPlaying = false;

  masterVol = 0.8;
  sfxVol = 0.9;
  musicVol = 0.45;
  mute = false;

  unlock() {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AC({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx.connect(this.master);
      this.music.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applyVolumes();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    this.unlocked = true;
  }

  setVolumes(opts: {
    master?: number;
    sfx?: number;
    music?: number;
    mute?: boolean;
  }) {
    if (opts.master != null) this.masterVol = opts.master;
    if (opts.sfx != null) this.sfxVol = opts.sfx;
    if (opts.music != null) this.musicVol = opts.music;
    if (opts.mute != null) this.mute = opts.mute;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.master || !this.sfx || !this.music || !this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.mute ? 0 : this.masterVol * this.masterVol;
    this.master.gain.setTargetAtTime(m, t, 0.02);
    this.sfx.gain.setTargetAtTime(this.sfxVol * this.sfxVol, t, 0.02);
    this.music.gain.setTargetAtTime(this.musicVol * this.musicVol, t, 0.02);
  }

  private bus() {
    return this.sfx!;
  }

  private now() {
    return this.ctx!.currentTime;
  }

  private noise(duration: number, gain = 0.3): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const n = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(this.bus());
    return src;
  }

  /** Wet honk-fart stink cloud. */
  playFart(variant: "small" | "big" | "wet" = "wet") {
    if (!this.unlocked || !this.ctx || !this.sfx) return;
    const t = this.now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    o.type = "sawtooth";
    const base =
      variant === "small" ? 90 : variant === "big" ? 55 : 70;
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * 0.45, t + 0.28);
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 0.3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(
      variant === "big" ? 0.55 : 0.35,
      t + 0.02,
    );
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(f);
    f.connect(g);
    g.connect(this.bus());
    o.start(t);
    o.stop(t + 0.4);
    // bubble noise
    const n = this.noise(0.25, 0.12);
    const ng = this.ctx.createGain();
    const nf = this.ctx.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.value = 200;
    n.disconnect();
    n.connect(nf);
    nf.connect(ng);
    ng.gain.setValueAtTime(0.2, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    ng.connect(this.bus());
    n.start(t);
    n.stop(t + 0.25);
  }

  playStinkBomb() {
    if (!this.unlocked || !this.ctx) return;
    this.playFart("big");
    const t = this.now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g);
    g.connect(this.bus());
    o.start(t);
    o.stop(t + 0.6);
  }

  playExplosion() {
    if (!this.unlocked || !this.ctx) return;
    const t = this.now();
    const n = this.noise(0.5, 0.5);
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(1200, t);
    f.frequency.exponentialRampToValueAtTime(80, t + 0.45);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    n.disconnect();
    n.connect(f);
    f.connect(g);
    g.connect(this.bus());
    n.start(t);
    n.stop(t + 0.5);
    // thud
    const o = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.3);
    og.gain.setValueAtTime(0.5, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(og);
    og.connect(this.bus());
    o.start(t);
    o.stop(t + 0.35);
  }

  playItemGet() {
    if (!this.unlocked || !this.ctx) return;
    const t = this.now();
    [523, 659, 784].forEach((freq, i) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = "square";
      o.frequency.value = freq;
      const start = t + i * 0.06;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
      o.connect(g);
      g.connect(this.bus());
      o.start(start);
      o.stop(start + 0.16);
    });
  }

  playBoost() {
    if (!this.unlocked || !this.ctx) return;
    const t = this.now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(480, t + 0.25);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g);
    g.connect(this.bus());
    o.start(t);
    o.stop(t + 0.32);
  }

  playHop() {
    if (!this.unlocked || !this.ctx) return;
    const t = this.now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(440, t + 0.08);
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g);
    g.connect(this.bus());
    o.start(t);
    o.stop(t + 0.13);
  }

  playLand() {
    if (!this.unlocked || !this.ctx) return;
    const t = this.now();
    const n = this.noise(0.08, 0.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    n.disconnect();
    n.connect(g);
    g.connect(this.bus());
    n.start(t);
    n.stop(t + 0.09);
  }

  playCountdown(n: number) {
    if (!this.unlocked || !this.ctx) return;
    const t = this.now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "square";
    o.frequency.value = n <= 0 ? 660 : 330;
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (n <= 0 ? 0.4 : 0.15));
    o.connect(g);
    g.connect(this.bus());
    o.start(t);
    o.stop(t + 0.45);
  }

  playWipeout() {
    if (!this.unlocked || !this.ctx) return;
    this.playExplosion();
    this.playFart("wet");
  }

  playUiClick() {
    if (!this.unlocked || !this.ctx) return;
    const t = this.now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(g);
    g.connect(this.bus());
    o.start(t);
    o.stop(t + 0.07);
  }

  /** Continuous engine loop — call updateEngine each frame. */
  startEngine() {
    if (!this.unlocked || !this.ctx || this.engineOsc) return;
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineFilter = ctx.createBiquadFilter();
    this.engineGain = ctx.createGain();
    this.engineOsc.type = "sawtooth";
    this.engineOsc.frequency.value = 70;
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 400;
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.bus());
    this.engineOsc.start();
  }

  updateEngine(speed: number, throttle: number) {
    if (!this.engineOsc || !this.engineGain || !this.engineFilter || !this.ctx)
      return;
    const t = this.ctx.currentTime;
    const rpm = 55 + Math.abs(speed) * 4.2 + Math.max(0, throttle) * 30;
    this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(
      280 + Math.abs(speed) * 12,
      t,
      0.05,
    );
    const vol =
      this.phaseRacing() && Math.abs(speed) + Math.abs(throttle) > 0.1
        ? 0.06 + Math.min(0.18, Math.abs(speed) * 0.004)
        : 0;
    this.engineGain.gain.setTargetAtTime(vol, t, 0.08);
  }

  private racing = false;
  setRacing(on: boolean) {
    this.racing = on;
    if (on) this.startEngine();
  }
  private phaseRacing() {
    return this.racing;
  }

  startMusic(seed = 0) {
    if (!this.unlocked || !this.ctx || !this.music || this.musicPlaying) return;
    this.stopMusic();
    this.musicPlaying = true;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.05;
    // Silly chiptune loop: slimey arpeggio
    const notes = [130.81, 164.81, 196.0, 246.94, 261.63, 196.0, 164.81, 130.81];
    const beat = 0.22;
    const loopBars = 8;
    for (let bar = 0; bar < 64; bar++) {
      for (let i = 0; i < notes.length; i++) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = bar % 2 === 0 ? "triangle" : "square";
        const freq = notes[(i + seed) % notes.length]! * (1 + (bar % 4) * 0.01);
        const start = t0 + bar * notes.length * beat + i * beat;
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.05, start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, start + beat * 0.9);
        o.connect(g);
        g.connect(this.music!);
        o.start(start);
        o.stop(start + beat);
        this.musicNodes.push(o, g);
      }
      if (bar >= loopBars * 4) break;
    }
  }

  stopMusic() {
    for (const n of this.musicNodes) {
      try {
        if ("stop" in n) (n as OscillatorNode).stop();
      } catch {
        /* */
      }
    }
    this.musicNodes = [];
    this.musicPlaying = false;
  }

  dispose() {
    this.stopMusic();
    try {
      this.engineOsc?.stop();
    } catch {
      /* */
    }
    this.engineOsc = null;
    void this.ctx?.close();
    this.ctx = null;
  }
}

export const gameAudio = new GameAudio();
