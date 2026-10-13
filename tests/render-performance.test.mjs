import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderLoop } from '../src/renderLoop.js';
import { renderPixelRatio } from '../src/renderBudget.js';
import { StudioEngine } from '../src/engine.js';
import { DEFAULT_STATE, clone } from '../src/state.js';
import { PerformanceMonitor } from '../src/performanceMonitor.js';

function clock(render) {
  const queue = new Map(); let id = 0;
  const loop = createRenderLoop({ render, request: fn => { queue.set(++id, fn); return id; }, cancel: key => queue.delete(key) });
  return { loop, queue, frame() { const next = queue.entries().next().value; assert.ok(next, 'a frame is scheduled'); queue.delete(next[0]); next[1](100); } };
}

test('a static scene coalesces changes, renders once, then sleeps until invalidated', () => {
  let renders = 0;
  const c = clock(() => { renders++; return false; });
  for (let i = 0; i < 30; i++) c.loop.invalidate();
  assert.equal(c.queue.size, 1); c.frame();
  assert.equal(renders, 1); assert.equal(c.queue.size, 0);
  c.loop.invalidate(); c.frame(); assert.equal(renders, 2);
});

test('motion keeps scheduling frames and stops after the final frame', () => {
  let moving = true;
  const c = clock(() => moving);
  c.loop.invalidate(); c.frame(); c.frame();
  assert.equal(c.queue.size, 1);
  moving = false; c.frame(); assert.equal(c.queue.size, 0);
});

test('hidden or disposed renderers cancel pending work and hidden changes resume once', () => {
  let renders = 0;
  const c = clock(() => { renders++; return true; });
  c.loop.invalidate(); c.loop.setPaused(true); c.loop.invalidate();
  assert.equal(c.queue.size, 0); assert.equal(renders, 0);
  c.loop.setPaused(false); c.frame(); assert.equal(renders, 1);
  c.loop.dispose(); c.loop.invalidate(); c.loop.setPaused(false);
  assert.equal(c.queue.size, 0);
});

test('render budgets cap physical pixels from phones to 8K and respect quality ordering', () => {
  for (const [width,height] of [[0,0],[390,844],[844,390],[1440,900],[3840,2160],[7680,4320]]) {
    for (const deviceRatio of [1,2,3]) {
      const fluid = renderPixelRatio(width,height,deviceRatio,'fluid');
      const auto = renderPixelRatio(width,height,deviceRatio,'auto');
      const high = renderPixelRatio(width,height,deviceRatio,'high');
      assert.ok(fluid > 0 && fluid <= auto && auto <= high && high <= deviceRatio);
      for (const [ratio,cap] of [[fluid,1_000_000],[auto,2_000_000],[high,4_000_000]]) {
        assert.ok(width * height * ratio ** 2 <= cap + .001);
      }
    }
  }
  assert.equal(renderPixelRatio(390,844,3), 1.3);
  assert.equal(renderPixelRatio(1440,900,1), 1);
});

test('project names and random delta do not touch renderer or material resources', () => {
  const engine = Object.create(StudioEngine.prototype);
  const state = clone(DEFAULT_STATE); engine.config = state; engine.sceneKey = 'initialized';
  let invalidations = 0; engine.invalidate = () => invalidations++;
  const next = { ...state, name: 'Studio 2', randomDelta: 80 };
  engine.setState(next);
  assert.equal(engine.config, next); assert.equal(invalidations, 0);
});

test('engine sleeps with invisible particles, but keeps visible particle motion alive', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { hidden: false };
  try {
    const engine = Object.create(StudioEngine.prototype);
    let renders = 0;
    Object.assign(engine, {
      config: clone(DEFAULT_STATE), ready: true, renderer: { info: { reset() {} } }, transition: false, lastFrame: 0,
      stage: { visible: true }, worldPlanes: [], monitor: new PerformanceMonitor(), reportStats() {},
      controls: { update: () => false }, composer: { render: () => renders++ },
      particles: { visible: true, material: { opacity: 0 }, rotation: { y: 0 } },
    });
    engine.config.motion.playing = false;
    assert.equal(engine.tick(16), false); assert.equal(renders, 1);
    engine.particles.material.opacity = .2;
    assert.equal(engine.tick(32), true); assert.ok(engine.particles.rotation.y > 0);
    engine.particles.visible = false; assert.equal(engine.tick(48), false);
    engine.particles.visible = true; engine.stage.visible = false; assert.equal(engine.tick(64), false);
    engine.controls.update = () => true; engine.manual = true; assert.equal(engine.tick(80), true);
    globalThis.document.hidden = true; const before = renders;
    assert.equal(engine.tick(96), false); assert.equal(renders, before);
  } finally { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; }
});
