// One surface treatment, one particle system and one temporal trail. No image assets.
export const EFFECT_GROUPS = {
  surface: [
    ['rim', 'Rim glow'], ['scan', 'Laser scan'], ['spectral', 'Spectral'],
    ['hologram', 'Hologram'], ['contour', 'Contour lines'], ['wire', 'Wire glow'],
    ['glitch', 'Digital glitch'], ['dissolve', 'Dissolve / Reveal'],
  ],
  particles: [
    ['points', 'Point cloud'], ['scatter', 'Particle scatter'], ['flow', 'Particle flow'],
    ['filaments', 'Energy filaments'], ['streaks', 'Speed streaks'],
  ],
  trail: [['ribbon', 'Ribbon trails'], ['ghost', 'Ghost echo']],
};
export const DEFAULT_EFFECTS = Object.freeze({
  surface: 'none', particles: 'none', trail: 'none', color: '#e4eeff',
  intensity: .7, density: .5, size: .7, spread: .45, length: .45, solid: 1,
  speed: .65, phase: 0, axis: 'y', reverse: false, playing: true, randomize: true, seed: 19,
});
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export function validateEffects(input) {
  const result = { ...DEFAULT_EFFECTS }, value = input && typeof input === 'object' ? input : {};
  for (const group of Object.keys(EFFECT_GROUPS)) if (value[group] === 'none' || EFFECT_GROUPS[group].some(([id]) => id === value[group])) result[group] = value[group];
  for (const [key, min, max] of [['intensity',0,1],['density',.05,1],['size',.25,2],['spread',0,1],['length',0,1],['solid',0,1],['speed',0,2],['phase',0,1],['seed',0,99999]]) {
    if (Number.isFinite(value[key])) result[key] = clamp(value[key], min, max);
  }
  result.seed = Math.round(result.seed);
  if (/^#[0-9a-f]{6}$/i.test(value.color || '')) result.color = value.color;
  if (['x','y','z'].includes(value.axis)) result.axis = value.axis;
  for (const key of ['reverse','playing','randomize']) if (typeof value[key] === 'boolean') result[key] = value[key];
  return result;
}
export const effectsEnabled = fx => !!fx && fx.intensity > 0 && ['surface','particles','trail'].some(key => fx[key] !== 'none');
export const effectsAnimated = fx => effectsEnabled(fx) && fx.playing && fx.speed > 0 &&
  (['scan','hologram','contour','glitch','dissolve'].includes(fx.surface) || ['scatter','flow','filaments','streaks'].includes(fx.particles) || fx.trail !== 'none');
export const effectsAlterCoverage = fx => effectsEnabled(fx) && (['hologram','glitch','dissolve'].includes(fx.surface) || fx.solid < .99);
export const EFFECT_CYCLE = 8;

export function chooseEffect(current, group, id, reducedMotion = false) {
  if (!(group in EFFECT_GROUPS) || (id !== 'none' && !EFFECT_GROUPS[group].some(([key]) => key === id))) return current;
  const next = { ...current, [group]: id, phase: 0 };
  if (group === 'particles') next.solid = ['points','scatter'].includes(id) ? .04 : 1;
  if (id !== 'none' && next.intensity === 0) next.intensity = DEFAULT_EFFECTS.intensity;
  if (reducedMotion) next.playing = false;
  return next;
}

// Fixed upper bounds, independent of the number of model vertices. Deformed
// samples use a smaller budget because their attachment is evaluated on the CPU.
export function effectBudget({ coarse = false, quality = 'auto', deforming = false } = {}) {
  const small = coarse || quality === 'fluid';
  return { points: deforming ? (small ? 1400 : 3600) : (small ? 6000 : 16000),
    streaks: small ? 480 : 1200, ghostPoints: small ? 1000 : 2200,
    ghosts: small ? 2 : 3, ribbons: small ? 4 : 6, segments: 28, updateHz: small ? 24 : 30 };
}

export function sparkleEffects(current, color, amount, random, reducedMotion, movingProduct) {
  const fx = validateEffects(current);
  if (!fx.randomize) return reducedMotion ? { ...fx, playing: false } : fx;
  const pick = items => items[Math.min(items.length - 1, Math.floor(Math.max(0,random()) * items.length))];
  const surfaces = EFFECT_GROUPS.surface.map(([id]) => id).filter(id => id !== fx.surface);
  const particle = amount >= .4 ? pick(['none', ...EFFECT_GROUPS.particles.map(([id]) => id)]) : 'none';
  return { ...fx, surface: pick(surfaces), particles: particle,
    trail: movingProduct && amount >= .7 ? pick(['none','ribbon','ghost']) : 'none',
    color, intensity: .4 + amount * .4, density: .25 + amount * .35,
    solid: ['points','scatter'].includes(particle) ? .04 : 1,
    seed: Math.floor(random()*100000), phase: 0, playing: !reducedMotion };
}
