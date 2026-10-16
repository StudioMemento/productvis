import { Box3, Matrix4, Vector3, MathUtils } from 'three';
import { validateTransform } from './modelTransform.js';

export function applyModelTransform(group, transform) {
  const t = validateTransform(transform);
  group.position.set(t.x, t.y, t.z);
  group.rotation.set(MathUtils.degToRad(t.rx), MathUtils.degToRad(t.ry), MathUtils.degToRad(t.rz));
  group.scale.setScalar(t.scale);
  group.updateWorldMatrix(true, true);
}

export function worldBounds(model) {
  model.updateWorldMatrix(true, true);
  return new Box3().setFromObject(model);
}

export function placementAction(transform, bounds, action, ground = 0) {
  const t = validateTransform(transform);
  if (!bounds || bounds.isEmpty()) return t;
  if (action === 'center') {
    const center = bounds.getCenter(new Vector3());
    t.x -= center.x; t.z -= center.z;
  }
  if (action === 'ground') t.y += ground + .025 - bounds.min.y;
  return validateTransform(t);
}

// Apply a world-space vertical correction in the animated group's parent space.
// This keeps the chosen support height even with a rotated, scaled placement.
export function keepModelHeight(product, model, height) {
  const delta = height - worldBounds(model).min.y;
  const inverse = product.parent ? product.parent.matrixWorld.clone().invert() : new Matrix4();
  const origin = new Vector3().applyMatrix4(inverse);
  product.position.add(new Vector3(0, delta, 0).applyMatrix4(inverse).sub(origin));
  product.updateWorldMatrix(true, true);
}
