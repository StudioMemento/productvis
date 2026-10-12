import { DEFAULT_POST, DEFAULT_RENDER, DEFAULT_INSPECTION, DEFAULT_SECTION, validateLookdev } from './lookdev.js';
import { DEFAULT_TRANSFORM, validateTransform } from './modelTransform.js';
export const TABS = ['product', 'scene', 'lighting', 'camera', 'motion', 'post', 'inspect', 'render', 'project'];
export const TAB_LABELS = { product: 'Prodotto', scene: 'Scena', lighting: 'Luci', camera: 'Camera', motion: 'Movimento', post: 'Post', inspect: 'Ispeziona', render: 'Render', project: 'Progetto' };
export const PRESETS = {
  scene: [
    { id: 'ring', name: 'Ring' }, { id: 'void', name: 'Void' }, { id: 'studio', name: 'Studio' },
    { id: 'cinema', name: 'Cinema' }, { id: 'cubes', name: 'Cubi' }, { id: 'particles', name: 'Particelle' },
  ],
  lighting: [
    { id: 'softbox', name: 'Softbox' }, { id: 'rim', name: 'Rim' }, { id: 'split', name: 'Split' },
    { id: 'top', name: 'Top' }, { id: 'warm', name: 'Warm' }, { id: 'bicolor', name: 'Bicolor' },
  ],
  camera: [
    { id: 'hero', name: 'Hero' }, { id: 'low', name: 'Bassa' }, { id: 'front', name: 'Frontale' },
    { id: 'profile', name: 'Profilo' }, { id: 'top', name: "Dall’alto" }, { id: 'macro', name: 'Macro' },
  ],
  product: [
    { id: 'original', name: 'Originale' }, { id: 'matte', name: 'Opaco' }, { id: 'satin', name: 'Satinato' },
    { id: 'gloss', name: 'Lucido' }, { id: 'metal', name: 'Metallo' }, { id: 'ceramic', name: 'Ceramica' },
  ],
  motion: [
    { id: 'still', name: 'Fermo' }, { id: 'idle', name: 'Idle' }, { id: 'turntable', name: 'Rotazione' },
    { id: 'orbit', name: 'Orbita' }, { id: 'dolly', name: 'Avvicina' },
  ],
};
export const FINISHES = {
  matte: { roughness: .87, metalness: .05, clearcoat: 0 },
  satin: { roughness: .32, metalness: .65, clearcoat: .25 },
  gloss: { roughness: .12, metalness: .25, clearcoat: 1 },
  metal: { roughness: .17, metalness: 1, clearcoat: .3 },
  ceramic: { roughness: .2, metalness: 0, clearcoat: .85 },
};
export const LIGHT_RIGS = {
  softbox: { key: 5, fill: 3, rim: 2, temperature: 6000, tint: 'neutral', softness: 85 },
  rim: { key: 3.3, fill: 1.4, rim: 7, temperature: 4500, tint: 'warm', softness: 60 },
  split: { key: 6, fill: .25, rim: 2.2, temperature: 5200, tint: 'neutral', softness: 35 },
  top: { key: 5, fill: 1.8, rim: 1.8, temperature: 6000, tint: 'neutral', softness: 80 },
  warm: { key: 4.2, fill: 2.5, rim: 4, temperature: 3200, tint: 'warm', softness: 75 },
  bicolor: { key: 3.8, fill: 1.2, rim: 7, temperature: 4400, tint: 'cool', softness: 45 },
};
export const CAMERA_ANGLES = {
  hero: { azimuth: 38, elevation: 13, distance: 1, focal: 50 },
  low: { azimuth: 32, elevation: 5, distance: 1.07, focal: 35 },
  front: { azimuth: 0, elevation: 8, distance: .94, focal: 70 },
  profile: { azimuth: 90, elevation: 8, distance: 1.03, focal: 70 },
  top: { azimuth: 38, elevation: 57, distance: 1.12, focal: 50 },
  macro: { azimuth: 26, elevation: 12, distance: .36, focal: 85 },
};
export const SWATCHES = [
  { color: '#424752', name: 'Grafite' }, { color: '#bc8b33', name: 'Ambra' },
  { color: '#e9e4d7', name: 'Avorio' }, { color: '#922633', name: 'Bordeaux' },
  { color: '#34516b', name: 'Blu' },
];
export const DEFAULT_STATE = {
  name: 'Studio 01',
  scene: { preset: 'cubes', composition: 1, scale: 1, seed: 12, fog: .25, particles: .45, floorRoughness: .4, reflection: .27, ringColor: '#ffb020' },
  lighting: { preset: 'rim', intensity: 1, rotation: 0, ...LIGHT_RIGS.rim },
  camera: { preset: 'hero', ...CAMERA_ANGLES.hero, aperture: 5.6, exposure: -.15, autoFocus: true, focus: 6, focusPoint: null },
  motion: { preset: 'still', playing: false, speed: 1, direction: 1, loop: true, axis: 'y', amplitude: 360, travel: .3 },
  materials: {}, selectedMaterial: '', quality: 'auto', randomDelta: 35,
  transform: { ...DEFAULT_TRANSFORM },
  post: structuredClone(DEFAULT_POST), render: structuredClone(DEFAULT_RENDER), inspection: structuredClone(DEFAULT_INSPECTION), section: structuredClone(DEFAULT_SECTION),
};
export const clone = (v) => structuredClone(v);
export const clamp = (v, low, high) => Math.max(low, Math.min(high, v));

export function applyPreset(state, category, id, original = null) {
  if (!PRESETS[category]?.some(p => p.id === id)) return state;
  const next = clone(state);
  if (category === 'scene') next.scene = { ...state.scene, preset: id };
  if (category === 'lighting') next.lighting = { ...state.lighting, preset: id, ...LIGHT_RIGS[id] };
  if (category === 'camera') {
    next.camera = { ...state.camera, preset: id, ...CAMERA_ANGLES[id], focusPoint: null, autoFocus: true };
    if (['orbit', 'dolly', 'idle'].includes(state.motion.preset)) next.motion.playing = false;
  }
  if (category === 'motion') next.motion = { ...state.motion, preset: id, playing: id !== 'still', amplitude: id === 'idle' ? 6 : Math.max(15,state.motion.amplitude) };
  if (category === 'product' && state.selectedMaterial) {
    const current = state.materials[state.selectedMaterial] || {};
    next.materials[state.selectedMaterial] = id === 'original'
      ? { ...original, finish: 'original', overlay: 0 }
      : { ...current, ...FINISHES[id], finish: id };
  }
  return next;
}

const isColor = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
export function validateProject(input) {
  if (!input || input.format !== 'productvis' || input.version !== 1 || !input.state) throw new Error('Questo file non è un progetto ProductVis compatibile.');
  if (!input.model || !['demo', 'embedded'].includes(input.model.type)) throw new Error('Il progetto non contiene un modello valido.');
  if (input.model.type === 'embedded' && (typeof input.model.data !== 'string' || !/^data:model\/gltf-binary;base64,[A-Za-z0-9+/=]+$/.test(input.model.data))) throw new Error('Il modello incorporato non è valido.');
  const s = input.state, result = clone(DEFAULT_STATE);
  const ranges = {
    scene: { composition: [0, 2], scale: [.55, 1.5], seed: [0, 100000], fog: [0, 1], particles: [0, 1], floorRoughness: [0, 1], reflection: [0, .8] },
    lighting: { intensity: [0, 2], rotation: [-180, 180], key: [0, 10], fill: [0, 10], rim: [0, 10], temperature: [2000, 9000], softness: [0, 100] },
    camera: { azimuth: [-180, 180], elevation: [1, 85], distance: [.25, 2.5], focal: [18, 150], aperture: [1.4, 16], exposure: [-2, 2], focus: [.2, 50] },
    motion: { speed: [.25, 3], amplitude: [1, 360], travel: [.05, .6] },
  };
  for (const category of Object.keys(ranges)) {
    if (!s[category] || !PRESETS[category].some(p => p.id === s[category].preset)) throw new Error('Un preset del progetto non è valido.');
    result[category].preset = s[category].preset;
    for (const [key, [min, max]] of Object.entries(ranges[category])) {
      if (Number.isFinite(s[category][key])) result[category][key] = clamp(s[category][key], min, max);
    }
  }
  if (isColor(s.scene.ringColor)) result.scene.ringColor = s.scene.ringColor;
  if (['warm', 'neutral', 'cool'].includes(s.lighting.tint)) result.lighting.tint = s.lighting.tint;
  result.camera.autoFocus = s.camera.autoFocus !== false;
  if (Array.isArray(s.camera.focusPoint) && s.camera.focusPoint.length === 3 && s.camera.focusPoint.every(Number.isFinite)) result.camera.focusPoint = s.camera.focusPoint.map(x => clamp(x, -100, 100));
  result.motion.playing = s.motion.playing === true && s.motion.preset !== 'still';
  result.motion.loop = s.motion.loop !== false;
  result.motion.direction = s.motion.direction === -1 ? -1 : 1;
  result.motion.amplitude = result.motion.preset==='idle' ? clamp(result.motion.amplitude,1,15) : Math.max(15,result.motion.amplitude);
  if (['x', 'y', 'z'].includes(s.motion.axis)) result.motion.axis = s.motion.axis;
  if (['auto', 'fluid', 'high'].includes(s.quality)) result.quality = s.quality;
  if (Number.isFinite(s.randomDelta)) result.randomDelta = Math.round(clamp(s.randomDelta, 0, 100));
  validateLookdev(s, result);
  result.transform = validateTransform(s.transform);
  result.name = typeof s.name === 'string' ? s.name.slice(0, 80) : 'Studio 01';
  for (const [key, mat] of Object.entries(s.materials || {}).slice(0, 500)) {
    if (!/^mat-\d+$/.test(key) || !mat || typeof mat !== 'object') continue;
    const m = { finish: PRESETS.product.some(p => p.id === mat.finish) ? mat.finish : 'original' };
    if (isColor(mat.color)) m.color = mat.color;
    for (const k of ['overlay', 'roughness', 'metalness', 'clearcoat', 'opacity']) if (Number.isFinite(mat[k])) m[k] = clamp(mat[k], 0, 1);
    if (Number.isFinite(mat.normalScale)) m.normalScale = clamp(mat.normalScale, 0, 2);
    if (Number.isInteger(mat.uvChannel)) m.uvChannel = clamp(mat.uvChannel, 0, 3);
    for (const [k,min,max] of [['ior',1,2.5],['transmission',0,1],['thickness',0,5],['emissiveIntensity',0,3],['alphaCutoff',0,1]]) if (Number.isFinite(mat[k])) m[k] = clamp(mat[k],min,max);
    if (isColor(mat.emissive)) m.emissive = mat.emissive;
    if (['opaque','blend','mask'].includes(mat.alphaMode)) m.alphaMode = mat.alphaMode;
    if (typeof mat.doubleSide === 'boolean') m.doubleSide = mat.doubleSide;
    if (['source','front','back','double'].includes(mat.sideMode)) m.sideMode = mat.sideMode;
    result.materials[key] = m;
  }
  if (/^mat-\d+$/.test(s.selectedMaterial)) result.selectedMaterial = s.selectedMaterial;
  return { state: result, model: { type: input.model.type, name: String(input.model.name || 'Modello').slice(0, 120), data: input.model.data } };
}

export function makeProject(state, model) {
  return { format: 'productvis', version: 1, state: clone(state), model };
}

export function friendlyMaterialName(name, index) {
  if (/Coloured/i.test(name)) return 'Inserti colorati';
  if (/TexturedA/i.test(name)) return 'Dettagli texture';
  if (/LightA/i.test(name)) return 'Luci anteriori';
  if (/PaintTNR/i.test(name)) return 'Carrozzeria';
  if (/windows/i.test(name)) return 'Vetri';
  if (/carbon/i.test(name)) return 'Carbonio';
  if (/glass.light/i.test(name)) return 'Fanali';
  if (/red.glass/i.test(name)) return 'Fanali posteriori';
  if (/golden.rim/i.test(name)) return 'Bordo cerchi';
  if (/rim|wheel/i.test(name)) return `Cerchi · ${index + 1}`;
  if (/calliper|caliper/i.test(name)) return `Freni · ${index + 1}`;
  if (/interior|int.color/i.test(name)) return `Interni · ${index + 1}`;
  if (/engine/i.test(name)) return 'Motore';
  if (/grille/i.test(name)) return `Griglie · ${index + 1}`;
  if (/badge|plate/i.test(name)) return `Dettagli · ${index + 1}`;
  if (/1992base/i.test(name)) return 'Pneumatici e base';
  const cleaned = name?.replace(/_Material\d*/g, '').replace(/[_:]+/g, ' ').trim();
  return cleaned?.length && cleaned.length < 38 ? cleaned : `Superficie ${index + 1}`;
}
