import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeHexColor,
  sanitizeVariantState,
  resolveVariantSelection,
} from '../src/configurator/VariantGrammar.js';
import { ProductVariants } from '../src/configurator/ProductVariants.js';

const BODY = 'part_body';
const BODY_MESH = 'part_body_mesh';
const TRIM = 'part_trim';

test('variant grammar normalizes colors, required defaults and invalid targets', () => {
  assert.equal(sanitizeHexColor('#f80'), '#ff8800');
  const state = sanitizeVariantState({
    variantGroups: [{
      id: 'group_finish',
      name: 'Finish',
      required: true,
      options: [{
        id: 'option_red',
        name: 'Red',
        appearance: {
          [BODY]: { color: '#f00', roughness: 4, metalness: -2 },
          invalid: { color: '#fff' },
        },
      }],
    }],
    variantSelections: {},
  }, { validPartIds: new Set([BODY]) });

  assert.equal(state.variantGroups.length, 1);
  assert.equal(state.variantGroups[0].options.length, 1);
  assert.equal(state.variantGroups[0].options[0].changes.appearance[BODY].color, '#ff0000');
  assert.equal(state.variantGroups[0].options[0].changes.appearance[BODY].roughness, 1);
  assert.equal(state.variantGroups[0].options[0].changes.appearance[BODY].metalness, 0);
  assert.equal(state.variantSelections.group_finish, 'option_red');
});

test('variant resolution is ordered, expands group targets and reports conflicts', () => {
  const groups = [
    {
      id: 'group_paint',
      name: 'Paint',
      required: true,
      defaultOptionId: 'option_red',
      options: [{
        id: 'option_red',
        name: 'Red',
        changes: {
          appearance: { [BODY]: { color: '#ff0000', roughness: 0.25 } },
          visibility: { [TRIM]: true },
        },
      }],
    },
    {
      id: 'group_pack',
      name: 'Pack',
      required: true,
      defaultOptionId: 'option_black',
      options: [{
        id: 'option_black',
        name: 'Black pack',
        changes: {
          appearance: { [BODY_MESH]: { color: '#111111' } },
          visibility: { [TRIM]: false },
        },
      }],
    },
  ];

  const result = resolveVariantSelection({
    groups,
    selections: {},
    validPartIds: new Set([BODY, BODY_MESH, TRIM]),
    expandAppearanceTarget: (partId) => partId === BODY ? [BODY_MESH] : [partId],
  });

  assert.deepEqual(result.selections, {
    group_pack: 'option_black',
    group_paint: 'option_red',
  });
  assert.equal(result.appearanceByMesh[BODY_MESH].color, '#111111');
  assert.equal(result.appearanceByMesh[BODY_MESH].roughness, 0.25);
  assert.equal(result.visibility[TRIM], false);
  assert.equal(result.conflicts.length, 2);
  assert.deepEqual(result.conflicts.map((item) => item.type).sort(), ['appearance', 'visibility']);
});

test('ProductVariants preserves mutually exclusive groups and configurations', () => {
  const applied = [];
  const variants = new ProductVariants({
    getValidPartIds: () => new Set([BODY, BODY_MESH, TRIM]),
    expandAppearanceTarget: (partId) => partId === BODY ? [BODY_MESH] : [partId],
    onApply: (resolution) => applied.push(resolution),
  });

  variants.attach();
  const group = variants.createGroup('Body color');
  const red = variants.createOption(group.id, {
    name: 'Red',
    swatch: '#f00',
    appearance: { [BODY]: { color: '#f00', roughness: 0.2 } },
  });
  const blue = variants.createOption(group.id, {
    name: 'Blue',
    swatch: '#00f',
    appearance: { [BODY]: { color: '#00f', roughness: 0.3 } },
  });

  assert.equal(variants.getReport().optionCount, 2);
  assert.equal(variants.getSelections()[group.id], blue.id);
  variants.setDefaultOption(group.id, red.id);
  variants.resetSelectionsToDefaults();
  assert.equal(variants.getSelections()[group.id], red.id);

  const configuration = variants.captureConfiguration('Launch');
  variants.activateOption(group.id, blue.id);
  assert.equal(variants.getSelections()[group.id], blue.id);
  variants.applyConfiguration(configuration.id);
  assert.equal(variants.getSelections()[group.id], red.id);
  assert.equal(applied.at(-1).appearanceByMesh[BODY_MESH].color, '#ff0000');
});
