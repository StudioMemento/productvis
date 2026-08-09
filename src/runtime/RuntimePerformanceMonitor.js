const QUALITY_ORDER = ['performance', 'balanced', 'quality'];

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export class RuntimePerformanceMonitor {
  constructor({
    sampleWindowMs = 2400,
    downThresholdFps = 30,
    upThresholdFps = 54,
    downSustainMs = 2600,
    upSustainMs = 9000,
    cooldownMs = 9000,
  } = {}) {
    this.sampleWindowMs = sampleWindowMs;
    this.downThresholdFps = downThresholdFps;
    this.upThresholdFps = upThresholdFps;
    this.downSustainMs = downSustainMs;
    this.upSustainMs = upSustainMs;
    this.cooldownMs = cooldownMs;
    this.samples = [];
    this.lastFrameAt = null;
    this.lastQualityChangeAt = -Infinity;
    this.lowSince = null;
    this.highSince = null;
    this.suspended = false;
    this.snapshot = {
      fps: 0,
      frameTimeMs: 0,
      p95FrameTimeMs: 0,
      longFramePercent: 0,
      sampleCount: 0,
      state: 'warming',
    };
  }

  sample(now) {
    const timestamp = Number(now);
    if (!Number.isFinite(timestamp)) return this.getSnapshot();
    if (this.suspended) {
      this.lastFrameAt = timestamp;
      return this.getSnapshot();
    }
    if (this.lastFrameAt === null) {
      this.lastFrameAt = timestamp;
      return this.getSnapshot();
    }

    const delta = timestamp - this.lastFrameAt;
    this.lastFrameAt = timestamp;
    if (delta <= 0 || delta > 250) {
      this.samples = [];
      this.lowSince = null;
      this.highSince = null;
      return this.getSnapshot();
    }

    this.samples.push({ at: timestamp, delta });
    const cutoff = timestamp - this.sampleWindowMs;
    while (this.samples.length && this.samples[0].at < cutoff) this.samples.shift();
    this.#updateSnapshot(timestamp);
    return this.getSnapshot();
  }

  #updateSnapshot(now) {
    const deltas = this.samples.map((item) => item.delta);
    if (deltas.length < 8) {
      this.snapshot = { ...this.snapshot, sampleCount: deltas.length, state: 'warming' };
      return;
    }
    const total = deltas.reduce((sum, value) => sum + value, 0);
    const frameTimeMs = total / deltas.length;
    const fps = frameTimeMs > 0 ? 1000 / frameTimeMs : 0;
    const p95 = percentile(deltas, 0.95);
    const longFrames = deltas.filter((value) => value > 33.4).length;
    const longFramePercent = (longFrames / deltas.length) * 100;
    const state = fps < this.downThresholdFps
      ? 'strained'
      : fps < 48
        ? 'stable'
        : 'smooth';

    this.snapshot = {
      fps: Number(fps.toFixed(1)),
      frameTimeMs: Number(frameTimeMs.toFixed(1)),
      p95FrameTimeMs: Number(p95.toFixed(1)),
      longFramePercent: Number(longFramePercent.toFixed(1)),
      sampleCount: deltas.length,
      state,
    };

    if (fps < this.downThresholdFps) {
      this.lowSince ??= now;
    } else {
      this.lowSince = null;
    }
    if (fps > this.upThresholdFps) {
      this.highSince ??= now;
    } else {
      this.highSince = null;
    }
  }

  recommendQuality(currentQuality, {
    now,
    enabled = true,
    minQuality = 'performance',
    maxQuality = 'quality',
    allowUpgrade = true,
  } = {}) {
    if (!enabled || this.suspended || this.snapshot.sampleCount < 8) return null;
    const timestamp = Number.isFinite(Number(now)) ? Number(now) : performance.now();
    if (timestamp - this.lastQualityChangeAt < this.cooldownMs) return null;

    const currentIndex = Math.max(0, QUALITY_ORDER.indexOf(currentQuality));
    const minIndex = Math.max(0, QUALITY_ORDER.indexOf(minQuality));
    const maxIndex = Math.max(minIndex, QUALITY_ORDER.indexOf(maxQuality));

    if (this.lowSince !== null && timestamp - this.lowSince >= this.downSustainMs && currentIndex > minIndex) {
      const quality = QUALITY_ORDER[clamp(currentIndex - 1, minIndex, maxIndex)];
      this.markQualityChange(timestamp);
      return { quality, reason: 'sustained-low-fps', snapshot: this.getSnapshot() };
    }

    if (allowUpgrade && this.highSince !== null && timestamp - this.highSince >= this.upSustainMs && currentIndex < maxIndex) {
      const quality = QUALITY_ORDER[clamp(currentIndex + 1, minIndex, maxIndex)];
      this.markQualityChange(timestamp);
      return { quality, reason: 'sustained-headroom', snapshot: this.getSnapshot() };
    }
    return null;
  }

  markQualityChange(now = performance.now()) {
    this.lastQualityChangeAt = Number(now);
    this.lowSince = null;
    this.highSince = null;
  }

  setSuspended(suspended, now = performance.now()) {
    this.suspended = Boolean(suspended);
    this.lastFrameAt = Number(now);
    this.lowSince = null;
    this.highSince = null;
    if (this.suspended) {
      this.snapshot = { ...this.snapshot, state: 'paused' };
    }
  }

  reset(now = performance.now()) {
    this.samples = [];
    this.lastFrameAt = Number(now);
    this.lowSince = null;
    this.highSince = null;
    this.snapshot = {
      fps: 0,
      frameTimeMs: 0,
      p95FrameTimeMs: 0,
      longFramePercent: 0,
      sampleCount: 0,
      state: this.suspended ? 'paused' : 'warming',
    };
  }

  getSnapshot() {
    return { ...this.snapshot };
  }
}
