export const DEFAULT_TRANSFORM = Object.freeze({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 });
export const TRANSFORM_LIMITS = Object.freeze({ x: [-10, 10], y: [-10, 10], z: [-10, 10], rx: [-180, 180], ry: [-180, 180], rz: [-180, 180], scale: [.1, 3] });

export function validateTransform(source) {
  const result = { ...DEFAULT_TRANSFORM };
  for (const [key, [min, max]] of Object.entries(TRANSFORM_LIMITS)) {
    if (Number.isFinite(source?.[key])) result[key] = Math.max(min, Math.min(max, source[key]));
  }
  return result;
}
