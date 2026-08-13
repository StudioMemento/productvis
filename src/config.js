export const VERSION = '2.1B';
export const STARTER_URL = '/models/2015-rocket-bunny-honda-nsx.glb';
export const STARTER_NAME = '2015 Rocket Bunny Honda NSX';
export const PROJECT_KEY = 'productvis:v2.1b:project';
export const PRESENTATION_KEY = 'productvis:v2.1b:presentation';

export const CAMERA_PRESETS = ['Hero', 'Front', 'Rear', 'Left', 'Right', 'Top', 'Detail', 'Fit'];
export const LIGHTING_PRESETS = {
  'Soft Studio': { exposure: 1.06, environmentIntensity: 1.18, keyIntensity: 2.2, fillIntensity: 1.15, rimIntensity: 1.55, shadowSoftness: 0.78, keyColor: '#fff1df', rimColor: '#d7e7ff' },
  Balanced: { exposure: 1.02, environmentIntensity: 1.0, keyIntensity: 2.65, fillIntensity: 0.88, rimIntensity: 1.45, shadowSoftness: 0.55, keyColor: '#fff4e8', rimColor: '#c9ddff' },
  Contrast: { exposure: 0.94, environmentIntensity: 0.62, keyIntensity: 3.45, fillIntensity: 0.36, rimIntensity: 2.2, shadowSoftness: 0.28, keyColor: '#ffe7cf', rimColor: '#a8c8ff' },
  'High Key': { exposure: 1.22, environmentIntensity: 1.42, keyIntensity: 3.05, fillIntensity: 1.72, rimIntensity: 1.1, shadowSoftness: 0.88, keyColor: '#ffffff', rimColor: '#eef5ff' },
  Rim: { exposure: 0.9, environmentIntensity: 0.48, keyIntensity: 1.72, fillIntensity: 0.28, rimIntensity: 4.35, shadowSoftness: 0.4, keyColor: '#f3dbc9', rimColor: '#8ab8ff' },
  Night: { exposure: 0.72, environmentIntensity: 0.32, keyIntensity: 1.18, fillIntensity: 0.2, rimIntensity: 3.45, shadowSoftness: 0.33, keyColor: '#8ba9ff', rimColor: '#ff6f8f' }
};

export const STAGE_PRESETS = {
  'Neutral Studio': { background: '#111318', groundVisible: true, contactShadow: 0.52, groundOffset: 0, rotation: 0, backgroundBlur: 0, environmentIntensity: 1.0, backgroundMode: 'neutral' },
  'White Cyclorama': { background: '#e8e9e6', groundVisible: true, contactShadow: 0.32, groundOffset: 0, rotation: 0, backgroundBlur: 2, environmentIntensity: 1.28, backgroundMode: 'white' },
  'Dark Studio': { background: '#08090b', groundVisible: true, contactShadow: 0.66, groundOffset: 0, rotation: -10, backgroundBlur: 1, environmentIntensity: 0.72, backgroundMode: 'dark' },
  'Black Void': { background: '#000000', groundVisible: false, contactShadow: 0, groundOffset: 0, rotation: 0, backgroundBlur: 0, environmentIntensity: 0.54, backgroundMode: 'void' },
  Showroom: { background: '#171b22', groundVisible: true, contactShadow: 0.44, groundOffset: 0, rotation: 14, backgroundBlur: 4, environmentIntensity: 1.12, backgroundMode: 'showroom' },
  'Night Stage': { background: '#050713', groundVisible: true, contactShadow: 0.7, groundOffset: 0, rotation: 22, backgroundBlur: 7, environmentIntensity: 0.4, backgroundMode: 'night' }
};

export const CONFIG_OPTIONS = {
  body: {
    label: 'Body finish',
    options: {
      'NSX Red': { color: '#b30816', roughness: 0.24, metalness: 0.44 },
      'Pearl White': { color: '#e7e6df', roughness: 0.2, metalness: 0.3 },
      'Midnight Black': { color: '#08090b', roughness: 0.18, metalness: 0.5 },
      Gunmetal: { color: '#454a50', roughness: 0.28, metalness: 0.68 },
      'Electric Blue': { color: '#164fbd', roughness: 0.22, metalness: 0.52 }
    }
  },
  wheels: {
    label: 'Wheel finish',
    options: {
      'Satin Black': { color: '#121316', roughness: 0.46, metalness: 0.78 },
      Gunmetal: { color: '#4e5358', roughness: 0.31, metalness: 0.82 },
      Silver: { color: '#b8bdc3', roughness: 0.22, metalness: 0.92 },
      Bronze: { color: '#775538', roughness: 0.34, metalness: 0.78 },
      Polished: { color: '#d6d8da', roughness: 0.09, metalness: 1.0 }
    }
  },
  interior: {
    label: 'Interior',
    options: {
      'Black Leather': { color: '#151519', roughness: 0.62, metalness: 0.03 },
      'Warm Tan': { color: '#8a5e3e', roughness: 0.66, metalness: 0.02 },
      'Racing Red': { color: '#7b0d16', roughness: 0.58, metalness: 0.02 },
      Alcantara: { color: '#3a3b3d', roughness: 0.84, metalness: 0 },
      Ivory: { color: '#c9c1ae', roughness: 0.7, metalness: 0 }
    }
  },
  brakes: {
    label: 'Brake / caliper accent',
    options: {
      Red: { color: '#d20d1d', roughness: 0.3, metalness: 0.48 },
      Yellow: { color: '#eabf15', roughness: 0.28, metalness: 0.42 },
      Blue: { color: '#155bc4', roughness: 0.3, metalness: 0.48 },
      Black: { color: '#111216', roughness: 0.36, metalness: 0.58 },
      Silver: { color: '#aeb4ba', roughness: 0.24, metalness: 0.82 }
    }
  },
  glass: {
    label: 'Glass treatment',
    options: {
      Clear: { color: '#dce8ea', opacity: 0.34, transmission: 0.78, roughness: 0.06 },
      Smoke: { color: '#4f5a62', opacity: 0.42, transmission: 0.62, roughness: 0.09 },
      Dark: { color: '#151b22', opacity: 0.56, transmission: 0.45, roughness: 0.11 },
      'Blue Tint': { color: '#5f8fa8', opacity: 0.38, transmission: 0.68, roughness: 0.07 },
      Display: { color: '#a9bbc5', opacity: 0.27, transmission: 0.84, roughness: 0.03 }
    }
  }
};

export const ANIMATION_MODES = ['Still', 'Turntable', 'Float', 'Showcase', 'Detail orbit'];
export const MATERIAL_POLICIES = ['Auto', 'Front', 'Back', 'Double', 'Opaque', 'Cutout', 'Transparent'];
export const SEMANTIC_GROUPS = ['none', 'body', 'wheels', 'interior', 'brakes', 'glass'];

export function createDefaultState() {
  return {
    version: VERSION,
    model: { source: 'starter', name: STARTER_NAME },
    camera: {
      preset: 'Hero', focusLock: true, autoFocus: true,
      focusPointLocal: null, focusPointWorld: null
    },
    dof: { enabled: true, focusDistance: 5, aperture: 4.0, bokeh: 0.42, focusRange: 0.58 },
    lighting: { preset: 'Balanced', ...LIGHTING_PRESETS.Balanced },
    stage: { preset: 'Neutral Studio', ...STAGE_PRESETS['Neutral Studio'] },
    configuration: { body: 'NSX Red', wheels: 'Gunmetal', interior: 'Black Leather', brakes: 'Red', glass: 'Clear' },
    animation: { mode: 'Still', playing: true, speed: 0.42, loop: true, direction: 1, rotationRange: 360, motionIntensity: 0.34, nativeClip: null },
    materialOverrides: {},
    groupAssignments: {},
    cameraSnapshot: null,
    savedAt: null
  };
}

export function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object') return structuredClone(base);
  const output = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base?.[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      output[key] = deepMerge(base[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}
