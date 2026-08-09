import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeInfographicState,
  sanitizeInfographics,
} from '../src/configurator/InfographicGrammar.js';
import { InfographicSystem } from '../src/configurator/InfographicSystem.js';
import {
  layoutInfographicCards,
  createInfographicConnector,
} from '../src/configurator/InfographicLayout.js';

test('infographic grammar sanitizes content, display modes and duplicate IDs', () => {
  const state = sanitizeInfographicState({
    infographics: [
      {
        id: 'feature one',
        anchorId: 'anchor one',
        eyebrow: '  BENEFIT  ',
        title: '  Precision edge  ',
        body: 'One   clear sentence.\nSecond line.',
        accent: '#f70',
        side: 'right',
      },
      {
        id: 'feature one',
        anchorId: 'anchor-two',
        title: 'Second',
        accent: 'invalid',
        side: 'diagonal',
      },
      { id: 'invalid', title: 'Missing anchor' },
    ],
    infographicDisplay: 'all',
    selectedInfographicId: 'feature-one',
  });

  assert.equal(state.infographics.length, 2);
  assert.equal(state.infographics[0].id, 'feature-one');
  assert.equal(state.infographics[1].id, 'feature-one-2');
  assert.equal(state.infographics[0].anchorId, 'anchor-one');
  assert.equal(state.infographics[0].accent, '#ff7700');
  assert.equal(state.infographics[1].accent, '#ff7950');
  assert.equal(state.infographics[1].side, 'auto');
  assert.equal(state.infographicDisplay, 'all');
  assert.equal(state.selectedInfographicId, 'feature-one');
});

test('InfographicSystem manages local anchored cards and reports unresolved anchors', () => {
  const changes = [];
  const system = new InfographicSystem({ onChange: (event) => changes.push(event.reason) });
  system.setAnchorMarkers([
    { id: 'anchor-one', name: 'Tip', resolved: true, worldPosition: [0, 1, 0] },
  ]);

  const first = system.create({
    anchorId: 'anchor-one',
    eyebrow: 'FEATURE',
    title: 'Precision tip',
    body: 'A controlled product-local callout.',
    accent: '#12c9b2',
  });
  const missing = system.create({ anchorId: 'missing-anchor', title: 'Fallback note' });
  assert.ok(first?.id.startsWith('info_'));
  assert.ok(missing?.id.startsWith('info_'));
  assert.equal(system.getState().infographicDisplay, 'selected');

  let report = system.getReport();
  assert.equal(report.infographicCount, 2);
  assert.equal(report.unresolvedCount, 1);
  assert.equal(report.infographics.find((item) => item.id === first.id).anchorName, 'Tip');

  system.update(first.id, { title: 'Updated tip', side: 'left' });
  system.setVisible(missing.id, false);
  system.setDisplay('all');
  system.select(first.id);
  report = system.getReport();
  assert.equal(report.selectedInfographic.title, 'Updated tip');
  assert.equal(report.selectedInfographic.side, 'left');
  assert.equal(system.get(missing.id).visible, false);
  assert.equal(system.getState().infographicDisplay, 'all');
  assert.ok(changes.includes('create'));
  assert.ok(changes.includes('update'));

  assert.equal(system.delete(first.id), true);
  assert.equal(system.getReport().infographicCount, 1);
  system.reset();
  assert.deepEqual(system.getState(), {
    infographics: [],
    infographicDisplay: 'off',
    selectedInfographicId: null,
  });
});

test('infographic layout keeps same-side cards separated and connectors deterministic', () => {
  const items = [
    { id: 'a', side: 'right', anchorX: 260, anchorY: 110, cardWidth: 220, cardHeight: 100, idealY: 60 },
    { id: 'b', side: 'right', anchorX: 280, anchorY: 130, cardWidth: 220, cardHeight: 100, idealY: 70 },
    { id: 'c', side: 'left', anchorX: 680, anchorY: 520, cardWidth: 220, cardHeight: 110, idealY: 465 },
  ];
  const layout = layoutInfographicCards(items, { width: 960, height: 640 });
  const a = layout.find((item) => item.id === 'a');
  const b = layout.find((item) => item.id === 'b');
  const c = layout.find((item) => item.id === 'c');

  assert.ok(b.cardY >= a.cardY + a.cardHeight + 14);
  for (const item of layout) {
    assert.ok(item.cardX >= 18);
    assert.ok(item.cardX + item.cardWidth <= 942);
    assert.ok(item.cardY >= 54);
    assert.ok(item.cardY + item.cardHeight <= 572);
  }
  assert.ok(c.cardX < c.anchorX);
  const path = createInfographicConnector(a);
  assert.match(path, /^M \d+\.\d{2} \d+\.\d{2} C /);
  assert.match(path, new RegExp(`${a.edgeX.toFixed(2)} ${a.edgeY.toFixed(2)}$`));
});

test('standalone infographic sanitization caps invalid records without mutating input', () => {
  const source = [{ anchorId: 'anchor-one', title: 'Original' }];
  const result = sanitizeInfographics(source);
  result[0].title = 'Changed';
  assert.equal(source[0].title, 'Original');
});
