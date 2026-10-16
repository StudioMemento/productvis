export const BLOOM_LIMIT = .1;
export const DEFAULT_POST = { enabled: true, bloom: true, bloomOverride: false, strength: .06, radius: .3, threshold: 1.6, dof: true, vignette: 0, contrast: 1, saturation: 1, tone: 'aces' };
export const DEFAULT_RENDER = { msaa: 'auto', resolution: 1, adaptive: true, fps: 'auto', stats: false, alpha: false };
export const DEFAULT_INSPECTION = { view: 'pbr', wireOpacity: .55 };
export const DEFAULT_SECTION = { enabled: false, mode: 'cut', thickness: .25, helpers: true, x: { enabled: true, position: .5, flip: false }, y: { enabled: false, position: .5, flip: false }, z: { enabled: false, position: .5, flip: false } };
export const POST_LOOKS = [
  { id: 'clean', name: 'Clean', values: { ...DEFAULT_POST, bloom: false, dof: false, tone: 'neutral' } },
  { id: 'studio', name: 'Studio', values: { ...DEFAULT_POST, strength: .06, threshold: 1.8, dof: false, contrast: 1.04 } },
  { id: 'cinema', name: 'Cinema', values: { ...DEFAULT_POST, strength: .085, threshold: 1.4, vignette: .22, contrast: 1.1, saturation: .86 } },
  { id: 'soft', name: 'Soft', values: { ...DEFAULT_POST, strength: .1, radius: .65, threshold: 1.3, contrast: .95, saturation: .92 } },
];

const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export function bloomStrength(post) {
  return clamp(Number.isFinite(post.strength)?post.strength:DEFAULT_POST.strength,0,BLOOM_LIMIT);
}
export function validateLookdev(source, target) {
  const ranges = { post: { strength:[0,1], radius:[0,1], threshold:[0,3], vignette:[0,1], contrast:[.5,1.5], saturation:[0,2] }, render: { resolution:[.5,1] }, inspection: { wireOpacity:[.05,1] }, section: { thickness:[.02,1] } };
  for (const [group, fields] of Object.entries(ranges)) for (const [key,[min,max]] of Object.entries(fields)) {
    if (Number.isFinite(source[group]?.[key])) target[group][key] = clamp(source[group][key],min,max);
  }
  for (const [group,keys] of Object.entries({post:['enabled','bloom','dof'],render:['adaptive','stats','alpha'],section:['enabled','helpers']})) for (const key of keys) {
    if (typeof source[group]?.[key] === 'boolean') target[group][key] = source[group][key];
  }
  target.post.strength = bloomStrength(target.post);
  target.post.bloomOverride = false; // Legacy file flag is retained only for compatibility.
  for (const [group,key,options] of [['post','tone',['aces','neutral','agx']],['render','msaa',['auto',0,2,4,8]],['render','fps',['auto',30,60]],['inspection','view',['pbr','wire','overlay','normals']],['section','mode',['cut','slab']]]) {
    if (options.includes(source[group]?.[key])) target[group][key] = source[group][key];
  }
  for (const axis of ['x','y','z']) {
    const item = source.section?.[axis]; if (!item) continue;
    if (Number.isFinite(item.position)) target.section[axis].position = clamp(item.position,0,1);
    for (const key of ['enabled','flip']) if (typeof item[key] === 'boolean') target.section[axis][key] = item[key];
  }
}

export function effectiveSamples(requested, supported, { coarse = false, quality = 'auto' } = {}) {
  const count = requested === 'auto' ? quality === 'fluid' ? 0 : coarse ? 2 : 4 : requested;
  return Math.max(0, ...supported.filter(n => n <= count && [2,4,8].includes(n)));
}

export function postPolicy(state) {
  const inspection = state.inspection.view !== 'pbr';
  const transparent = state.render.alpha;
  const full = state.post.enabled && state.quality !== 'fluid';
  return {
    bloom: full && state.post.bloom && state.post.strength > 0 && !transparent && !inspection,
    dof: full && state.post.dof && (state.camera.bokeh??.5)>0 && state.camera.aperture < 16 && !transparent && !inspection && !state.section.enabled,
    grade: state.post.enabled && !inspection,
  };
}
