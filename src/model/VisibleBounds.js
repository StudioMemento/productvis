import * as THREE from 'three';

const SAMPLE_LIMIT = 49152;
const PER_MESH_SAMPLE_LIMIT = 768;
const ROBUST_RATIO_THRESHOLD = 4.5;
const EPSILON = 1e-7;

export function isFiniteBounds(bounds) {
  if (!bounds?.isBox3 || bounds.isEmpty()) return false;
  return [
    bounds.min.x, bounds.min.y, bounds.min.z,
    bounds.max.x, bounds.max.y, bounds.max.z,
  ].every(Number.isFinite);
}

function materialIsRenderable(material) {
  if (!material || material.visible === false) return false;
  const opacity = Number(material.opacity ?? 1);
  return !Number.isFinite(opacity) || opacity > 0.0001;
}

function meshIsRenderable(mesh) {
  if (!mesh?.isMesh || mesh.userData?.__pvExcludeFromBounds === true) return false;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.length === 0 || materials.some(materialIsRenderable);
}

function exactMeshBounds(mesh, target = new THREE.Box3()) {
  target.makeEmpty();
  try {
    target.setFromObject(mesh, true);
  } catch {
    return target.makeEmpty();
  }
  return isFiniteBounds(target) ? target : target.makeEmpty();
}

function appendSampledVertices(mesh, samples) {
  if (samples.x.length >= SAMPLE_LIMIT || mesh.isSkinnedMesh) return;
  const geometry = mesh.geometry;
  const position = geometry?.attributes?.position;
  if (!position || position.count < 1) return;
  if (Array.isArray(mesh.morphTargetInfluences) && mesh.morphTargetInfluences.some((value) => Math.abs(value) > 0.000001)) return;

  const available = SAMPLE_LIMIT - samples.x.length;
  const budget = Math.max(1, Math.min(PER_MESH_SAMPLE_LIMIT, available));
  const stride = Math.max(1, Math.ceil(position.count / budget));
  const point = new THREE.Vector3();
  let lastIndex = -1;
  for (let index = 0; index < position.count && samples.x.length < SAMPLE_LIMIT; index += stride) {
    point.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld);
    if (![point.x, point.y, point.z].every(Number.isFinite)) continue;
    samples.x.push(point.x);
    samples.y.push(point.y);
    samples.z.push(point.z);
    lastIndex = index;
  }
  const finalIndex = position.count - 1;
  if (finalIndex > 0 && finalIndex !== lastIndex && samples.x.length < SAMPLE_LIMIT) {
    point.fromBufferAttribute(position, finalIndex).applyMatrix4(mesh.matrixWorld);
    if ([point.x, point.y, point.z].every(Number.isFinite)) {
      samples.x.push(point.x);
      samples.y.push(point.y);
      samples.z.push(point.z);
    }
  }
}

function quantile(sorted, ratio) {
  if (!sorted.length) return 0;
  const index = THREE.MathUtils.clamp((sorted.length - 1) * ratio, 0, sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const alpha = index - lower;
  return THREE.MathUtils.lerp(sorted[lower], sorted[upper], alpha);
}

function sampledCoreBounds(samples) {
  if (samples.x.length < 96) return null;
  const xs = [...samples.x].sort((a, b) => a - b);
  const ys = [...samples.y].sort((a, b) => a - b);
  const zs = [...samples.z].sort((a, b) => a - b);
  const q = samples.x.length > 2000 ? 0.0025 : 0.01;
  const box = new THREE.Box3(
    new THREE.Vector3(quantile(xs, q), quantile(ys, q), quantile(zs, q)),
    new THREE.Vector3(quantile(xs, 1 - q), quantile(ys, 1 - q), quantile(zs, 1 - q)),
  );
  return isFiniteBounds(box) ? box : null;
}

function chooseFramingBounds(fullBounds, coreBounds, allowRobustTrim) {
  if (!allowRobustTrim || !isFiniteBounds(fullBounds) || !isFiniteBounds(coreBounds)) {
    return { bounds: fullBounds.clone(), source: 'full', trimmed: false, ratio: 1 };
  }
  const fullSize = fullBounds.getSize(new THREE.Vector3());
  const coreSize = coreBounds.getSize(new THREE.Vector3());
  const fullDiagonal = fullSize.length();
  const coreDiagonal = coreSize.length();
  const ratio = coreDiagonal > EPSILON ? fullDiagonal / coreDiagonal : 1;
  if (!Number.isFinite(ratio) || ratio < ROBUST_RATIO_THRESHOLD) {
    return { bounds: fullBounds.clone(), source: 'full', trimmed: false, ratio };
  }

  const expanded = coreBounds.clone();
  const expansion = Math.max(coreDiagonal * 0.045, 0.002);
  expanded.expandByScalar(expansion);
  expanded.min.max(fullBounds.min);
  expanded.max.min(fullBounds.max);
  if (!isFiniteBounds(expanded)) {
    return { bounds: fullBounds.clone(), source: 'full', trimmed: false, ratio };
  }
  return { bounds: expanded, source: 'robust-core', trimmed: true, ratio };
}

export function computeVisibleBounds(root, {
  isVisible = () => true,
  allowRobustTrim = true,
} = {}) {
  const fullBounds = new THREE.Box3().makeEmpty();
  const samples = { x: [], y: [], z: [] };
  let includedMeshes = 0;
  let skippedMeshes = 0;
  let invalidMeshes = 0;

  if (!root) {
    return {
      fullBounds,
      framingBounds: fullBounds.clone(),
      source: 'empty',
      includedMeshes,
      skippedMeshes,
      invalidMeshes,
      sampleCount: 0,
      robustTrimmed: false,
      outlierRatio: 1,
    };
  }

  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!meshIsRenderable(object) || !isVisible(object)) {
      if (object?.isMesh) skippedMeshes += 1;
      return;
    }
    const box = exactMeshBounds(object);
    if (box.isEmpty()) {
      invalidMeshes += 1;
      return;
    }
    fullBounds.union(box);
    includedMeshes += 1;
    appendSampledVertices(object, samples);
  });

  if (fullBounds.isEmpty()) {
    try {
      fullBounds.setFromObject(root, true);
    } catch {
      fullBounds.makeEmpty();
    }
  }

  const coreBounds = sampledCoreBounds(samples);
  const selected = chooseFramingBounds(fullBounds, coreBounds, allowRobustTrim);
  return {
    fullBounds,
    framingBounds: selected.bounds,
    source: selected.source,
    includedMeshes,
    skippedMeshes,
    invalidMeshes,
    sampleCount: samples.x.length,
    robustTrimmed: selected.trimmed,
    outlierRatio: Number.isFinite(selected.ratio) ? selected.ratio : 1,
  };
}
