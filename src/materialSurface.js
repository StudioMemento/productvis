import { FrontSide, BackSide, DoubleSide } from 'three';

// This demo's exporter marked masked interior/rim/decal textures as blended.
// Keep their texture alpha, but restore depth occlusion. Glass stays blended.
const DEMO_CUTOUTS = new Set([2,4,9,10,11,12,13,14,15,17,26,29]);
export function normalizeDemoSurface(material, index, isDemo) {
  if (!isDemo || !DEMO_CUTOUTS.has(index) || material.opacity < .999) return;
  material.transparent = false; material.alphaTest = .08; material.depthWrite = true;
}

export function surfacePolicy(values, original, samples = 0) {
  const opacity = values.opacity ?? original.opacity ?? 1;
  const alphaMode = values.alphaMode || (opacity < 1 ? 'blend' : original.alphaMode || 'opaque');
  const sideMode = values.sideMode || ((values.doubleSide ?? original.doubleSide) ? 'double' : 'front');
  const side = sideMode === 'source' ? (original.doubleSide ? DoubleSide : FrontSide)
    : sideMode === 'double' ? DoubleSide : sideMode === 'back' ? BackSide : FrontSide;
  return { opacity, side, transparent: alphaMode === 'blend', depthWrite: alphaMode !== 'blend',
    alphaTest: alphaMode === 'mask' ? values.alphaCutoff ?? original.alphaCutoff ?? .5 : 0,
    alphaToCoverage: alphaMode === 'mask' && samples > 0 };
}

export function applySurfacePolicy(material, values, original, samples) {
  const policy = surfacePolicy(values, original, samples);
  for (const key of ['side','transparent','alphaTest','alphaToCoverage']) if (material[key] !== policy[key]) material.needsUpdate = true;
  Object.assign(material, policy);
}

export const geometryUvChannels = geometry => [0,1,2,3].filter(i=>geometry.getAttribute(i ? `uv${i}` : 'uv'));
export const sharedUvChannels = (current, geometry) => current.filter(i=>geometryUvChannels(geometry).includes(i));
