// Procedural ASMR & Soft-Body Physics Sound Engine (Web Audio API)

class AsmrAudioEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  public volume: number = 0.75;
  private lastSizzleTime: number = 0;
  private lastFreezeTime: number = 0;
  private lastZapTime: number = 0;
  private lastSquishTime: number = 0;

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Satisfying wet bubble pop
  public playBubblePop(pitchMultiplier = 1.0) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseFreq = (280 + Math.random() * 320) * pitchMultiplier;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 0.55, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.1, now + 0.065);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.28 * this.volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Visceral wet slime squish & stretch
  public playSquish(intensity = 0.6) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const nowMs = performance.now();
    if (nowMs - this.lastSquishTime < 75) return;
    this.lastSquishTime = nowMs;

    const now = ctx.currentTime;
    const clamped = Math.min(1, Math.max(0.15, intensity));

    // Filtered noise burst for wet texture
    const bufferSize = Math.floor(ctx.sampleRate * 0.14);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(6 + Math.random() * 5, now);
    const startFreq = 220 + Math.random() * 180;
    const endFreq = 580 + Math.random() * 450;
    filter.frequency.setValueAtTime(startFreq, now);
    filter.frequency.exponentialRampToValueAtTime(endFreq, now + 0.13);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.32 * clamped * this.volume, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.14);

    // Subtle micro-bubble pop on squish
    if (Math.random() < 0.65) {
      setTimeout(() => this.playBubblePop(0.85 + Math.random() * 0.5), 35);
    }
  }

  // Sharp knife slice + wet split
  public playKnifeSlice() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Metallic blade swoosh
    const bufferSize = Math.floor(ctx.sampleRate * 0.18);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
    }

    const swoosh = ctx.createBufferSource();
    swoosh.buffer = buffer;

    const hpFilter = ctx.createBiquadFilter();
    hpFilter.type = 'bandpass';
    hpFilter.Q.value = 3.5;
    hpFilter.frequency.setValueAtTime(2400, now);
    hpFilter.frequency.exponentialRampToValueAtTime(680, now + 0.16);

    const swooshGain = ctx.createGain();
    swooshGain.gain.setValueAtTime(0.35 * this.volume, now);
    swooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

    swoosh.connect(hpFilter);
    hpFilter.connect(swooshGain);
    swooshGain.connect(ctx.destination);
    swoosh.start(now);

    // 2. Juicy wet visceral cleavage
    const osc = ctx.createOscillator();
    const wetGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now + 0.03);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.19);

    wetGain.gain.setValueAtTime(0.001, now + 0.03);
    wetGain.gain.linearRampToValueAtTime(0.4 * this.volume, now + 0.05);
    wetGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(wetGain);
    wetGain.connect(ctx.destination);
    osc.start(now + 0.03);
    osc.stop(now + 0.21);

    setTimeout(() => this.playBubblePop(1.2), 60);
    setTimeout(() => this.playBubblePop(0.9), 110);
  }

  // Heavy wall / corner splat impact
  public playWallSplat(impactSpeed = 1.0, isCorner = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const strength = Math.min(1.3, Math.max(0.25, impactSpeed));

    // Low thud
    const osc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isCorner ? 135 : 110, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.22);

    thudGain.gain.setValueAtTime(0.55 * strength * this.volume, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(thudGain);
    thudGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);

    // Wet splatter burst
    this.playSquish(strength);
    if (isCorner) {
      setTimeout(() => this.playBubblePop(0.75), 50);
      setTimeout(() => this.playBubblePop(1.15), 95);
      setTimeout(() => this.playBubblePop(1.4), 145);
    }
  }

  // Lighter flame sizzle & boiling slime
  public playBurnSizzle(intensity = 0.8) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const nowMs = performance.now();
    if (nowMs - this.lastSizzleTime < 90) return;
    this.lastSizzleTime = nowMs;

    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.12);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.random());
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // High-pass sizzle
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.2;
    filter.frequency.setValueAtTime(3200 + Math.random() * 1800, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.18 * intensity * this.volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.12);

    if (Math.random() < 0.45) {
      this.playBubblePop(1.35 + Math.random() * 0.6);
    }
  }

  // Liquid Nitrogen Freeze Spray & Crystalline Crackle
  public playFreezeSpray() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const nowMs = performance.now();
    if (nowMs - this.lastFreezeTime < 85) return;
    this.lastFreezeTime = nowMs;

    const now = ctx.currentTime;
    // Crystalline high chime
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const freq = 1600 + Math.random() * 2200;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.15, now + 0.07);

    gain.gain.setValueAtTime(0.08 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  // Shatter frozen slime
  public playIceShatter() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        const c = this.ensureContext();
        if (!c) return;
        const t = c.currentTime;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1400 + Math.random() * 2600, t);
        osc.frequency.exponentialRampToValueAtTime(600 + Math.random() * 800, t + 0.09);
        g.gain.setValueAtTime(0.22 * this.volume, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
        osc.connect(g);
        g.connect(c.destination);
        osc.start(t);
        osc.stop(t + 0.1);
      }, i * 24);
    }
  }

  // High-voltage Tesla shock
  public playElectricZap() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const nowMs = performance.now();
    if (nowMs - this.lastZapTime < 90) return;
    this.lastZapTime = nowMs;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110 + Math.random() * 90, now);
    osc.frequency.linearRampToValueAtTime(55 + Math.random() * 340, now + 0.08);

    gain.gain.setValueAtTime(0.18 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Giant inflation burst or hammer smash
  public playGiantBurst() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.playWallSplat(1.3, true);
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        this.playBubblePop(0.6 + Math.random() * 1.1);
      }, i * 32);
    }
  }
}

export const asmrAudio = new AsmrAudioEngine();
