import { CAMERA_ANGLES, FINISHES, LIGHT_RIGS, clamp, clone } from './state.js';
import { materialFamily } from './navigation.js';
import { snapValue } from './controlMath.js';

// Pair environments with lighting, a full-product view and a restrained palette.
// Variations use the existing renderer once; no preview images are generated.
const LOOKS = [
  { scene: 'cubes', lighting: 'rim', camera: 'hero', colors: ['#34516b', '#bc8b33', '#424752'], finishes: ['satin', 'metal'] },
  { scene: 'cubes', lighting: 'top', camera: 'low', colors: ['#e9e4d7', '#68796d', '#424752'], finishes: ['matte', 'ceramic'] },
  { scene: 'ring', lighting: 'bicolor', camera: 'low', colors: ['#34516b', '#aab4c2', '#424752'], finishes: ['metal', 'gloss'] },
  { scene: 'ring', lighting: 'rim', camera: 'front', colors: ['#922633', '#bc8b33', '#e9e4d7'], finishes: ['gloss', 'satin'] },
  { scene: 'void', lighting: 'split', camera: 'profile', colors: ['#922633', '#aab4c2', '#424752'], finishes: ['satin', 'metal'] },
  { scene: 'void', lighting: 'softbox', camera: 'hero', colors: ['#e9e4d7', '#68796d', '#34516b'], finishes: ['ceramic', 'matte'] },
  { scene: 'studio', lighting: 'softbox', camera: 'hero', colors: ['#e9e4d7', '#34516b', '#922633'], finishes: ['ceramic', 'gloss'] },
  { scene: 'studio', lighting: 'top', camera: 'front', colors: ['#424752', '#68796d', '#aab4c2'], finishes: ['satin', 'matte'] },
  { scene: 'cinema', lighting: 'warm', camera: 'hero', colors: ['#bc8b33', '#922633', '#424752'], finishes: ['satin', 'gloss'] },
  { scene: 'cinema', lighting: 'bicolor', camera: 'low', colors: ['#34516b', '#aab4c2', '#424752'], finishes: ['metal', 'satin'] },
  { scene: 'particles', lighting: 'rim', camera: 'profile', colors: ['#e9e4d7', '#aab4c2', '#bc8b33'], finishes: ['ceramic', 'metal'] },
  { scene: 'particles', lighting: 'bicolor', camera: 'top', colors: ['#34516b', '#e9e4d7', '#922633'], finishes: ['gloss', 'satin'] },
];

const mix = (a, b, amount) => Number((a + (b - a) * amount).toFixed(6));
const mixColor = (a, b, amount) => '#' + [1, 3, 5].map(index => Math.round(mix(parseInt(a.slice(index, index + 2), 16), parseInt(b.slice(index, index + 2), 16), amount)).toString(16).padStart(2, '0')).join('');

function nearbyShot(state, amount, random) {
  const next = clone(state);
  const vary = (value, range, min, max, step) => {
    const sample = random() * 2 - 1;
    const offset = (sample < 0 ? -1 : 1) * (.35 + Math.abs(sample) * .65) * range * amount;
    const candidate = snapValue(value + offset, min, max, step);
    return candidate === value ? snapValue(value - offset, min, max, step) : candidate;
  };
  const ranges = {
    scene: { fog: [.18, 0, 1, .01], particles: [.25, 0, 1, .01], reflection: [.2, 0, .8, .01], floorRoughness: [.25, 0, 1, .01] },
    lighting: { intensity: [.4, 0, 2, .01], rotation: [40, -180, 180, 1], temperature: [1200, 2000, 9000, 100], softness: [30, 0, 100, 1], key: [2, 0, 10, .1], fill: [1, 0, 10, .1], rim: [2, 0, 10, .1] },
    camera: { azimuth: [40, -180, 180, .1], elevation: [12, 1, 85, .1], focal: [20, 18, 150, 1], distance: [.18, .25, 2.5, .01], aperture: [3, 1.4, 16, .2], exposure: [.4, -2, 2, .01] },
  };
  for (const [category, values] of Object.entries(ranges)) {
    for (const [key, range] of Object.entries(values)) next[category][key] = vary(state[category][key], ...range);
  }
  next.camera.autoFocus = true; next.camera.focusPoint = null;
  next.motion = { ...state.motion, preset: 'still', playing: false };
  return next;
}

export function randomizePresentation(state, materials = [], { delta = state.randomDelta ?? 35, random = Math.random } = {}) {
  const amount = clamp(Number.isFinite(delta) ? delta : 35, 0, 100) / 100;
  if (amount === 0) return clone(state);
  // Small deltas retain the set, rig, material and viewpoint; only nearby values vary.
  if (amount < .4) return nearbyShot(state, amount, random);
  const pick = values => values[Math.min(values.length - 1, Math.floor(random() * values.length))];
  // Mid deltas explore the same environment; large deltas open up a new set.
  const look = pick(LOOKS.filter(item => amount >= .7 ? item.scene !== state.scene.preset : item.scene === state.scene.preset));
  const next = clone(state);
  next.scene = {
    ...state.scene, preset: look.scene,
    composition: pick([0, 1, 2]), scale: pick([.8, .9, 1, 1.1]), seed: Math.floor(random() * 100000),
    fog: pick([.08, .14, .2, .26]), particles: pick([.15, .25, .4]),
    floorRoughness: pick([.25, .4, .55]), reflection: pick([.15, .25, .35]),
    ringColor: look.lighting === 'bicolor' ? pick(['#799fff', '#e6eeff']) : pick(['#ffb020', '#ff887c', '#e6eeff']),
  };
  next.lighting = {
    ...state.lighting, preset: look.lighting, ...LIGHT_RIGS[look.lighting],
    intensity: pick([.9, 1, 1.1]), rotation: pick([-30, -15, 0, 15, 30]),
  };
  const angle = CAMERA_ANGLES[look.camera];
  next.camera = {
    ...state.camera, preset: look.camera, ...angle,
    azimuth: angle.azimuth + pick([-6, 0, 6]),
    aperture: pick([4, 5.6, 8]), exposure: pick([-.2, -.1, 0, .1]), autoFocus: true, focusPoint: null,
  };
  // Stop motion so an orbit or tilted product cannot override the new composition.
  next.motion = { ...state.motion, preset: 'still', playing: false };

  const target = materials.find(material => material.id === state.selectedMaterial);
  const current = state.materials[state.selectedMaterial];
  if (target && current && !['glass', 'lights'].includes(materialFamily(target))
      && (target.original?.opacity ?? 1) >= .98 && (current.opacity ?? 1) >= .98) {
    const finish = pick(look.finishes.filter(value => value !== current.finish));
    next.materials[state.selectedMaterial] = {
      ...current, ...FINISHES[finish], finish,
      color: pick(look.colors.filter(color => color.toLowerCase() !== current.color?.toLowerCase())),
      overlay: pick([.65, .8, .95]),
    };
  }
  if (amount < 1) {
    const continuous = {
      scene: ['scale', 'fog', 'particles', 'floorRoughness', 'reflection'],
      lighting: ['intensity', 'rotation', 'key', 'fill', 'rim', 'temperature', 'softness'],
      camera: ['azimuth', 'elevation', 'distance', 'focal', 'aperture', 'exposure'],
    };
    for (const [category, keys] of Object.entries(continuous)) {
      for (const key of keys) next[category][key] = mix(state[category][key], next[category][key], amount);
    }
    next.scene.ringColor = mixColor(state.scene.ringColor, next.scene.ringColor, amount);
    const material = next.materials[state.selectedMaterial];
    if (material && current && material.color !== current.color) {
      material.color = mixColor(current.color || target.original.color, material.color, amount);
      for (const key of ['roughness', 'metalness', 'clearcoat', 'overlay']) material[key] = mix(current[key] ?? target.original[key] ?? 0, material[key], amount);
      if (amount < .7) material.finish = current.finish;
    }
  }
  // Even identical RNG samples yield a visible variation in the same environment.
  if (next.camera.azimuth === state.camera.azimuth) {
    const offset = amount * (state.camera.azimuth > 175 ? -3 : 3);
    next.camera.azimuth = clamp(mix(state.camera.azimuth, state.camera.azimuth + offset, 1), -180, 180);
  }
  return next;
}
