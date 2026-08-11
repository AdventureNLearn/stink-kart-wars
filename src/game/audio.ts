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
  /** OST playlist URLs (loop Rider → Carousel → …). */
  private readonly ostUrls = [
    "/audio/Slime_Rider.mp3",
    "/audio/Slime_Carousel.mp3",
  ];
  private ostBuffers: AudioBuffer[] = [];
  private ostLoading: Promise<void> | null = null;
  private ostSource: AudioBufferSourceNode | null = null;
  private ostIdx = 0;
  /** HTMLAudio fallback when decode fails. */
  private trackEls: HTMLAudioElement[] = [];
  private trackIdx = 0;
  private musicWanted = false;

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
    if (this.master && this.sfx && this.music && this.ctx) {
      const t = this.ctx.currentTime;
      const m = this.mute ? 0 : this.masterVol * this.masterVol;
      this.master.gain.setTargetAtTime(m, t, 0.02);
      this.sfx.gain.setTargetAtTime(this.sfxVol * this.sfxVol, t, 0.02);
      // Music bus stays near-unity; track volume = master * musicVol
      this.music.gain.setTargetAtTime(this.mute ? 0 : 1, t, 0.02);
    }
    this.applyTrackVolumes();
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

  private applyTrackVolumes() {
    const vol = this.mute
      ? 0
      : Math.max(0, Math.min(1, this.masterVol * this.musicVol));
    for (const a of this.trackEls) {
      a.volume = vol;
    }
  }

  private ostBlobUrls: string[] = [];
  /** True while a startMusic kick is in flight — blocks double-starts. */
  private musicStartLock = false;
  /** Index of the single currently audible track, or -1 if none. */
  private activeTrack = -1;

  /** Brighten OST through a light presence shelf (keeps MP3 decode pristine). */
  private wireMediaGraph(el: HTMLAudioElement) {
    if (!this.ctx || !this.music) return;
    try {
      // One MediaElementSource per element, once.
      if ((el as unknown as { __wired?: boolean }).__wired) return;
      const src = this.ctx.createMediaElementSource(el);
      const presence = this.ctx.createBiquadFilter();
      presence.type = "peaking";
      presence.frequency.value = 3800;
      presence.Q.value = 0.85;
      presence.gain.value = 3.5;
      const air = this.ctx.createBiquadFilter();
      air.type = "highshelf";
      air.frequency.value = 6500;
      air.gain.value = 2.5;
      const lowcut = this.ctx.createBiquadFilter();
      lowcut.type = "lowshelf";
      lowcut.frequency.value = 90;
      lowcut.gain.value = -2;
      src.connect(lowcut);
      lowcut.connect(presence);
      presence.connect(air);
      air.connect(this.music);
      (el as unknown as { __wired?: boolean }).__wired = true;
      el.volume = this.mute
        ? 0
        : Math.max(0, Math.min(1, this.masterVol * this.musicVol));
    } catch (err) {
      console.warn("[ost] media graph wire failed", err);
    }
  }

  /** Hard-stop every OST element so nothing can layer. */
  private silenceAllTracks() {
    this.activeTrack = -1;
    for (const a of this.trackEls) {
      a.onended = null;
      try {
        a.pause();
        a.currentTime = 0;
      } catch {
        /* */
      }
    }
    this.stopOstSource();
  }

  private async preloadOstAssets(): Promise<void> {
    if (this.trackEls.length === this.ostUrls.length && this.ostBlobUrls.length) {
      return;
    }
    if (this.ostLoading) return this.ostLoading;
    this.unlock();
    this.ostLoading = (async () => {
      // Pause anything currently playing before swapping elements
      this.silenceAllTracks();
      for (const u of this.ostBlobUrls) {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* */
        }
      }
      this.ostBlobUrls = [];
      for (const old of this.trackEls) {
        try {
          old.pause();
          old.removeAttribute("src");
          old.load();
          old.remove();
        } catch {
          /* */
        }
      }
      this.trackEls = [];

      const els: HTMLAudioElement[] = [];
      for (const url of this.ostUrls) {
        try {
          const res = await fetch(url, { cache: "force-cache" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const raw = await res.arrayBuffer();
          const blob = new Blob([raw], { type: "audio/mpeg" });
          const blobUrl = URL.createObjectURL(blob);
          this.ostBlobUrls.push(blobUrl);
          const a = new Audio();
          a.preload = "auto";
          a.loop = false; // each song plays once, then advance
          a.crossOrigin = "anonymous";
          a.src = blobUrl;
          a.setAttribute("playsinline", "true");
          a.style.display = "none";
          document.body.appendChild(a);
          await new Promise<void>((resolve) => {
            const done = () => resolve();
            if (a.readyState >= 3) done();
            else {
              a.addEventListener("canplaythrough", done, { once: true });
              a.addEventListener("error", done, { once: true });
              a.load();
            }
          });
          this.wireMediaGraph(a);
          els.push(a);
        } catch (err) {
          console.warn("[ost] preload failed", url, err);
        }
      }
      this.trackEls = els;
      this.ostBuffers = [];
      this.applyTrackVolumes();
    })();
    return this.ostLoading;
  }

  private ensureHtmlTracks() {
    if (this.trackEls.length) return;
    this.trackEls = this.ostUrls.map((src) => {
      const a = new Audio(src);
      a.preload = "auto";
      a.loop = false;
      a.crossOrigin = "anonymous";
      a.setAttribute("playsinline", "true");
      return a;
    });
  }

  private stopOstSource() {
    if (this.ostSource) {
      try {
        this.ostSource.onended = null;
        this.ostSource.stop();
      } catch {
        /* */
      }
      try {
        this.ostSource.disconnect();
      } catch {
        /* */
      }
      this.ostSource = null;
    }
  }

  /**
   * Play exactly one track. Always silences every other element first
   * so Rider and Carousel never layer.
   */
  private playHtmlTrackAt(idx: number) {
    if (!this.musicWanted) return;
    if (!this.trackEls.length) this.ensureHtmlTracks();
    if (!this.trackEls.length) return;

    const n = this.trackEls.length;
    const next = ((idx % n) + n) % n;

    // Exclusive: stop all, then start only `next`
    for (let i = 0; i < n; i++) {
      const el = this.trackEls[i]!;
      el.onended = null;
      if (i === next) continue;
      try {
        el.pause();
        el.currentTime = 0;
      } catch {
        /* */
      }
    }

    this.trackIdx = next;
    this.activeTrack = next;
    const a = this.trackEls[next]!;
    this.applyTrackVolumes();
    try {
      a.currentTime = 0;
    } catch {
      /* */
    }

    // When this song ends, advance to the other (playlist loop)
    a.onended = () => {
      if (!this.musicWanted) return;
      // Only advance if this element is still the active one
      if (this.activeTrack !== next) return;
      this.playHtmlTrackAt(next + 1);
    };

    void a
      .play()
      .then(() => {
        this.musicPlaying = true;
        // Belt-and-suspenders: if any sibling started somehow, kill it
        for (let i = 0; i < this.trackEls.length; i++) {
          if (i === next) continue;
          const other = this.trackEls[i]!;
          if (!other.paused) {
            try {
              other.pause();
              other.currentTime = 0;
            } catch {
              /* */
            }
          }
        }
      })
      .catch((err) => {
        console.warn("[ost] play blocked", err);
        window.setTimeout(() => {
          if (!this.musicWanted || this.activeTrack !== next) return;
          void a.play().then(() => {
            this.musicPlaying = true;
          });
        }, 80);
      });
  }

  /**
   * OST playlist: Slime_Rider → Slime_Carousel → Slime_Rider …
   * One song at a time — never overlapping.
   */
  startMusic(_seed = 0) {
    this.musicWanted = true;
    this.unlock();
    void this.ctx?.resume();
    if (this.music && this.ctx) {
      this.music.gain.setTargetAtTime(
        this.mute ? 0 : 1,
        this.ctx.currentTime,
        0.02,
      );
    }
    this.applyVolumes();

    // Already playing a single track cleanly — do not re-kick (prevents layering)
    if (
      this.musicPlaying &&
      this.activeTrack >= 0 &&
      this.trackEls[this.activeTrack] &&
      !this.trackEls[this.activeTrack]!.paused
    ) {
      return;
    }

    if (this.musicStartLock) return;
    this.musicStartLock = true;

    // Prefer preloaded blob tracks; only one start after assets ready
    void this.preloadOstAssets()
      .catch(() => {
        /* fall through to URL tracks */
      })
      .then(() => {
        if (!this.musicWanted) return;
        if (!this.trackEls.length) this.ensureHtmlTracks();
        // Wire URL fallbacks if preload didn't
        for (const el of this.trackEls) this.wireMediaGraph(el);
        this.silenceAllTracks();
        this.playHtmlTrackAt(0); // Rider only; Carousel waits for onended
      })
      .finally(() => {
        this.musicStartLock = false;
      });
  }

  /** Force restart OST from track 0 (Rider). */
  restartMusic() {
    this.stopMusic();
    this.startMusic();
  }

  stopMusic() {
    this.musicWanted = false;
    this.musicPlaying = false;
    this.musicStartLock = false;
    this.silenceAllTracks();
    for (const n of this.musicNodes) {
      try {
        if ("stop" in n) (n as OscillatorNode).stop();
      } catch {
        /* */
      }
    }
    this.musicNodes = [];
  }

  isMusicPlaying() {
    if (this.activeTrack >= 0) {
      const a = this.trackEls[this.activeTrack];
      if (a && !a.paused && a.currentTime > 0) return true;
    }
    // Any non-paused track counts (debug + settings nudge)
    if (this.trackEls.some((a) => !a.paused && a.currentTime > 0)) return true;
    return this.musicPlaying && this.musicWanted;
  }

  debugMusic() {
    return {
      wanted: this.musicWanted,
      playing: this.musicPlaying,
      unlocked: this.unlocked,
      ctx: this.ctx?.state ?? null,
      buffers: this.ostBuffers.length,
      ostIdx: this.ostIdx,
      activeTrack: this.activeTrack,
      trackIdx: this.trackIdx,
      hasSource: !!this.ostSource,
      html: this.trackEls.map((a, i) => ({
        i,
        src: a.src.split("/").pop()?.slice(0, 40),
        paused: a.paused,
        t: Math.round(a.currentTime * 10) / 10,
        dur: Number.isFinite(a.duration) ? Math.round(a.duration) : null,
        vol: a.volume,
        err: a.error?.message ?? a.error?.code ?? null,
        rs: a.readyState,
      })),
      mute: this.mute,
      musicVol: this.musicVol,
      masterVol: this.masterVol,
    };
  }

  dispose() {
    this.stopMusic();
    for (const a of this.trackEls) {
      try {
        a.remove();
      } catch {
        /* */
      }
    }
    this.trackEls = [];
    for (const u of this.ostBlobUrls) {
      try {
        URL.revokeObjectURL(u);
      } catch {
        /* */
      }
    }
    this.ostBlobUrls = [];
    this.ostBuffers = [];
    this.ostLoading = null;
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
