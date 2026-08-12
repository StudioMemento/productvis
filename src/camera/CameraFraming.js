import * as THREE from 'three';

const EPSILON = 1e-6;

export function isFiniteBox3(bounds) {
  if (!bounds?.isBox3 || bounds.isEmpty()) return false;
  const finite = [
    bounds.min.x, bounds.min.y, bounds.min.z,
    bounds.max.x, bounds.max.y, bounds.max.z,
  ].every(Number.isFinite);
  if (!finite) return false;
  const size = bounds.getSize(new THREE.Vector3());
  return Math.max(size.x, size.y, size.z) > EPSILON;
}

export function getBoxCorners(bounds) {
  if (!isFiniteBox3(bounds)) return [];
  const { min, max } = bounds;
  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z),
  ];
}

export function resolveFramingMetrics(metrics) {
  if (!metrics?.root || metrics.boundsValid === false) return null;
  const preferred = isFiniteBox3(metrics.framingBounds) ? metrics.framingBounds : metrics.bounds;
  if (!isFiniteBox3(preferred)) return null;
  const sphere = preferred.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(
    Number.isFinite(metrics.framingRadius) ? metrics.framingRadius : sphere.radius,
    0.0001,
  );
  if (!Number.isFinite(radius)) return null;
  return {
    ...metrics,
    bounds: preferred,
    radius,
    boundsSource: metrics.framingSource || (preferred === metrics.framingBounds ? 'framing' : 'full'),
  };
}

function safeDirection(direction) {
  const result = direction?.isVector3 ? direction.clone() : new THREE.Vector3(1, 0.35, 1.4);
  if (![result.x, result.y, result.z].every(Number.isFinite) || result.lengthSq() < EPSILON) {
    result.set(1, 0.35, 1.4);
  }
  return result.normalize();
}

function cameraBasis(camera, direction) {
  const outward = safeDirection(direction);
  const forward = outward.clone().negate();
  let upHint = camera?.up?.isVector3 ? camera.up.clone().normalize() : new THREE.Vector3(0, 1, 0);
  if (Math.abs(upHint.dot(forward)) > 0.985) {
    upHint = Math.abs(forward.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  }
  const right = new THREE.Vector3().crossVectors(forward, upHint).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  return { outward, forward, right, up };
}

export function computeFitDistanceToBounds(camera, bounds, target, direction, {
  padding = 1.07,
  minDistance = 0.1,
} = {}) {
  if (!camera?.isPerspectiveCamera || !isFiniteBox3(bounds) || !target?.isVector3) return null;
  const { outward, right, up } = cameraBasis(camera, direction);
  const verticalFov = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(camera.fov, 1, 179));
  const safeAspect = Math.max(Number(camera.aspect) || 1, 0.01);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * safeAspect);
  const tanVertical = Math.max(Math.tan(verticalFov / 2), 0.001);
  const tanHorizontal = Math.max(Math.tan(horizontalFov / 2), 0.001);

  let required = 0;
  for (const corner of getBoxCorners(bounds)) {
    const relative = corner.sub(target);
    const towardCamera = relative.dot(outward);
    const horizontal = Math.abs(relative.dot(right));
    const vertical = Math.abs(relative.dot(up));
    required = Math.max(
      required,
      towardCamera + horizontal / tanHorizontal,
      towardCamera + vertical / tanVertical,
    );
  }

  const safePadding = THREE.MathUtils.clamp(Number(padding) || 1.07, 0.25, 4);
  const distance = Math.max(required * safePadding, Number(minDistance) || 0.1);
  return Number.isFinite(distance) ? distance : null;
}

export function computeClipRange(camera, bounds, {
  target = null,
  mode = 'presentation',
  fallbackRadius = 0.4,
} = {}) {
  if (!camera?.isPerspectiveCamera || !isFiniteBox3(bounds)) return null;
  const aim = target?.isVector3 ? target : bounds.getCenter(new THREE.Vector3());
  const viewDirection = aim.clone().sub(camera.position);
  const distanceToTarget = viewDirection.length();
  if (!Number.isFinite(distanceToTarget) || distanceToTarget < EPSILON) return null;
  viewDirection.divideScalar(distanceToTarget);

  const depths = getBoxCorners(bounds)
    .map((corner) => corner.sub(camera.position).dot(viewDirection))
    .filter((value) => Number.isFinite(value) && value > EPSILON);
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(Number(fallbackRadius) || 0, sphere.radius, 0.01);
  const minDepth = depths.length ? Math.min(...depths) : Math.max(distanceToTarget - radius, 0.01);
  const maxDepth = depths.length ? Math.max(...depths) : distanceToTarget + radius;
  const nearCap = mode === 'inspect' ? 0.08 : 0.18;
  const nearFloor = mode === 'inspect' ? 0.002 : 0.006;
  const near = THREE.MathUtils.clamp(
    Math.min(minDepth * 0.28, minDepth * 0.5),
    nearFloor,
    Math.max(nearFloor, Math.min(nearCap, minDepth * 0.5)),
  );
  const far = Math.max(near + 12, maxDepth * 1.45, distanceToTarget + radius * 5);
  if (!Number.isFinite(near) || !Number.isFinite(far) || far <= near) return null;
  return { near, far, minDepth, maxDepth };
}
