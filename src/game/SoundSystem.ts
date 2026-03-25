// SoundSystem.ts — procedural audio via Web Audio API, no external files

export class SoundSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _muted = false;

  get muted(): boolean { return this._muted; }

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    if (this.master) {
      this.master.gain.value = this._muted ? 0 : 0.35;
    }
    return this._muted;
  }

  // --- Utility helpers ---

  private osc(type: OscillatorType, freq: number, duration: number, gain: number, delay = 0): void {
    if (this._muted) return;
    const ctx = this.ensure();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, ctx.currentTime + delay);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    o.connect(g);
    g.connect(this.master!);
    o.start(ctx.currentTime + delay);
    o.stop(ctx.currentTime + delay + duration + 0.01);
  }

  private noise(duration: number, gain: number, delay = 0): void {
    if (this._muted) return;
    const ctx = this.ensure();
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime + delay);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    // Bandpass for texture
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 0.8;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master!);
    src.start(ctx.currentTime + delay);
    src.stop(ctx.currentTime + delay + duration + 0.01);
  }

  // --- Sound effects ---

  /** Opening a long position */
  openLong(): void {
    this.osc('sine', 440, 0.08, 0.4);
    this.osc('sine', 660, 0.1, 0.3, 0.05);
    this.osc('sine', 880, 0.12, 0.2, 0.1);
  }

  /** Opening a short position */
  openShort(): void {
    this.osc('sine', 880, 0.08, 0.4);
    this.osc('sine', 660, 0.1, 0.3, 0.05);
    this.osc('sine', 440, 0.12, 0.2, 0.1);
  }

  /** Closing a profitable trade */
  closeProfit(magnitude: number): void {
    const vol = Math.min(0.5, 0.2 + magnitude / 1000);
    // Ascending arpeggio
    this.osc('sine', 523, 0.08, vol);
    this.osc('sine', 659, 0.08, vol * 0.9, 0.06);
    this.osc('sine', 784, 0.08, vol * 0.8, 0.12);
    this.osc('sine', 1047, 0.15, vol * 0.6, 0.18);
    // Sparkle
    this.osc('triangle', 2093, 0.06, 0.1, 0.15);
  }

  /** Closing a losing trade */
  closeLoss(magnitude: number): void {
    const vol = Math.min(0.4, 0.15 + magnitude / 1000);
    this.osc('sawtooth', 220, 0.15, vol * 0.3);
    this.osc('sine', 185, 0.2, vol * 0.5, 0.05);
    this.osc('sine', 147, 0.25, vol * 0.3, 0.1);
  }

  /** LIQUIDATED — dramatic impact */
  liquidation(): void {
    // Impact thud
    this.osc('sine', 60, 0.4, 0.6);
    this.osc('sine', 45, 0.5, 0.5, 0.05);
    // Noise crash
    this.noise(0.35, 0.4);
    // Descending tones
    this.osc('sawtooth', 400, 0.15, 0.25, 0.05);
    this.osc('sawtooth', 300, 0.15, 0.2, 0.12);
    this.osc('sawtooth', 200, 0.2, 0.15, 0.2);
    this.osc('sawtooth', 100, 0.3, 0.1, 0.3);
  }

  /** Leverage change click */
  leverageClick(): void {
    this.osc('square', 1200, 0.03, 0.12);
    this.osc('sine', 800, 0.04, 0.08, 0.02);
  }

  /** Buy bot */
  buyBot(): void {
    this.osc('sine', 600, 0.06, 0.2);
    this.osc('triangle', 900, 0.08, 0.15, 0.04);
    this.osc('sine', 1200, 0.06, 0.1, 0.08);
  }

  /** Buy upgrade */
  buyUpgrade(): void {
    this.osc('triangle', 500, 0.06, 0.2);
    this.osc('triangle', 750, 0.06, 0.18, 0.05);
    this.osc('sine', 1000, 0.1, 0.15, 0.1);
    this.osc('sine', 1500, 0.08, 0.08, 0.15);
  }

  /** Rank up available — triumphant chime */
  rankReady(): void {
    // Rising three-note fanfare
    this.osc('sine', 523, 0.12, 0.35);
    this.osc('sine', 659, 0.12, 0.3, 0.1);
    this.osc('sine', 784, 0.14, 0.28, 0.2);
    this.osc('sine', 1047, 0.18, 0.35, 0.32);
    // Sparkle layer
    this.osc('triangle', 2093, 0.08, 0.15, 0.3);
    this.osc('triangle', 2637, 0.06, 0.12, 0.4);
    // Soft shimmer
    this.noise(0.12, 0.04, 0.28);
  }

  /** Prestige — epic ascending chord */
  prestige(): void {
    // Deep sweep
    this.osc('sine', 130, 0.5, 0.3);
    // Chord build
    this.osc('sine', 262, 0.3, 0.2, 0.1);
    this.osc('sine', 330, 0.3, 0.2, 0.15);
    this.osc('sine', 392, 0.3, 0.2, 0.2);
    this.osc('sine', 523, 0.4, 0.25, 0.3);
    // Sparkle top
    this.osc('triangle', 1047, 0.15, 0.1, 0.35);
    this.osc('triangle', 1318, 0.15, 0.08, 0.4);
    this.osc('triangle', 1568, 0.2, 0.06, 0.45);
    // Shimmer noise
    this.noise(0.2, 0.06, 0.35);
  }

  /** Market event: pump */
  eventPump(): void {
    this.osc('sine', 330, 0.08, 0.15);
    this.osc('sine', 440, 0.08, 0.12, 0.06);
    this.osc('sine', 550, 0.1, 0.1, 0.12);
  }

  /** Market event: crash */
  eventCrash(): void {
    this.osc('sawtooth', 300, 0.12, 0.15);
    this.osc('sawtooth', 200, 0.15, 0.12, 0.08);
    this.noise(0.12, 0.1, 0.05);
  }

  /** Market event: volatility spike */
  eventVolatility(): void {
    this.osc('square', 600, 0.04, 0.1);
    this.osc('square', 800, 0.04, 0.08, 0.05);
    this.osc('square', 600, 0.04, 0.06, 0.1);
  }

  /** Bot earned significant profit — subtle cha-ching */
  botProfit(): void {
    this.osc('sine', 1200, 0.03, 0.06);
    this.osc('sine', 1600, 0.04, 0.04, 0.03);
  }

  /** Liquidation warning tick (heartbeat) */
  liqWarningTick(): void {
    this.osc('sine', 80, 0.12, 0.15);
    this.osc('sine', 70, 0.08, 0.1, 0.15);
  }

  /** Restart from liquidation */
  restart(): void {
    this.osc('sine', 330, 0.08, 0.15);
    this.osc('sine', 440, 0.1, 0.12, 0.06);
    this.osc('sine', 660, 0.12, 0.1, 0.12);
  }

  /** Tab switch click */
  tabClick(): void {
    this.osc('sine', 900, 0.025, 0.08);
  }

  /** Flash news — bullish shock (broadcast alert + ascending tones) */
  flashNewsBullish(): void {
    // Sharp alert noise burst
    this.noise(0.06, 0.25);
    // Broadcast beep pattern: short-short-long
    this.osc('square', 1000, 0.05, 0.3, 0.04);
    this.osc('square', 1000, 0.05, 0.3, 0.12);
    this.osc('square', 1200, 0.18, 0.35, 0.22);
    // Ascending confirmation tones
    this.osc('sine', 523, 0.06, 0.12, 0.42);
    this.osc('sine', 659, 0.08, 0.12, 0.52);
    this.osc('sine', 880, 0.1,  0.18, 0.62);
  }

  /** Flash news — bearish/danger shock (alarm + descending tones) */
  flashNewsDanger(): void {
    // Hard noise impact
    this.noise(0.12, 0.4);
    // Alarm pattern: alternating tones
    this.osc('sawtooth', 880, 0.07, 0.3, 0.02);
    this.osc('sawtooth', 660, 0.07, 0.3, 0.12);
    this.osc('sawtooth', 880, 0.07, 0.3, 0.22);
    this.osc('sawtooth', 440, 0.12, 0.4, 0.34);
    // Deep rumble
    this.osc('sine', 55,  0.35, 0.5, 0.05);
    this.osc('sine', 45,  0.3,  0.4, 0.15);
  }
}
