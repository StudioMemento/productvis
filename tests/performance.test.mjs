import test from 'node:test';
import assert from 'node:assert/strict';
import { RuntimePerformanceMonitor } from '../src/runtime/RuntimePerformanceMonitor.js';

function feed(monitor, { start = 0, frames = 30, delta = 16.67 } = {}) {
  let now = start;
  monitor.sample(now);
  for (let index = 0; index < frames; index += 1) {
    now += delta;
    monitor.sample(now);
  }
  return now;
}

test('performance monitor reports a stable rolling frame window', () => {
  const monitor = new RuntimePerformanceMonitor({ sampleWindowMs: 1000 });
  feed(monitor, { frames: 40, delta: 16.67 });
  const snapshot = monitor.getSnapshot();
  assert.ok(snapshot.fps > 59 && snapshot.fps < 61);
  assert.ok(snapshot.frameTimeMs > 16 && snapshot.frameTimeMs < 17);
  assert.equal(snapshot.state, 'smooth');
});

test('adaptive recommendation steps down only after sustained pressure', () => {
  const monitor = new RuntimePerformanceMonitor({
    sampleWindowMs: 1000,
    downThresholdFps: 45,
    downSustainMs: 180,
    cooldownMs: 0,
  });
  const now = feed(monitor, { frames: 24, delta: 30 });
  const recommendation = monitor.recommendQuality('quality', { now, enabled: true });
  assert.equal(recommendation?.quality, 'balanced');
  assert.equal(recommendation?.reason, 'sustained-low-fps');
});

test('adaptive recommendation respects the quality ceiling and pause state', () => {
  const monitor = new RuntimePerformanceMonitor({
    sampleWindowMs: 1000,
    upThresholdFps: 50,
    upSustainMs: 120,
    cooldownMs: 0,
  });
  let now = feed(monitor, { frames: 30, delta: 12 });
  assert.equal(monitor.recommendQuality('balanced', { now, maxQuality: 'balanced' }), null);
  monitor.setSuspended(true, now);
  now += 500;
  monitor.sample(now);
  assert.equal(monitor.getSnapshot().state, 'paused');
  assert.equal(monitor.recommendQuality('performance', { now, maxQuality: 'quality' }), null);
});
