export const HALO_DEFAULTS = { haloRadius: 3.7, haloIntensity: .65, wetness: .55, microDetail: .7 };
export const HALO_RANGES = { haloRadius: [3, 5], haloIntensity: [0, 1], wetness: [0, 1], microDetail: [0, 1] };
export function haloSettings(scene) {
  return Object.fromEntries(Object.entries(HALO_RANGES).map(([key, [min, max]]) => [key,
    Math.min(max, Math.max(min, Number.isFinite(scene[key]) ? scene[key] : HALO_DEFAULTS[key]))]));
}
export function haloBudget(quality = 'auto', coarse = false) {
  return {
    reflectionSize: quality === 'high' ? (coarse ? 512 : 1024) : (coarse ? 256 : 512),
    reflectionInterval: quality === 'high' ? 16 : coarse ? 66 : 33,
    fogCount: quality === 'fluid' ? 8 : coarse ? 12 : 20,
    reflection: quality !== 'fluid',
  };
}
