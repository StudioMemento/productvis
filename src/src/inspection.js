import { Plane, Vector3, Mesh, SkinnedMesh, InstancedMesh } from 'three';

export function topologyOverlay(mesh, material) {
  let wire;
  if (mesh.isSkinnedMesh) {
    wire = new SkinnedMesh(mesh.geometry, material);
    wire.bindMode = mesh.bindMode; wire.bind(mesh.skeleton, mesh.bindMatrix);
  } else if (mesh.isInstancedMesh) {
    wire = new InstancedMesh(mesh.geometry, material, mesh.count);
    wire.instanceMatrix = mesh.instanceMatrix; wire.morphTexture = mesh.morphTexture;
  } else wire = new Mesh(mesh.geometry, material);
  if (mesh.morphTargetInfluences) wire.morphTargetInfluences = mesh.morphTargetInfluences;
  wire.raycast = () => {}; wire.renderOrder = 1;
  return wire;
}

// Planes live in normalized product coordinates and are transformed with the product.
// Positive distance is retained. Slabs keep the intersection of all enabled axis bands.
export function sectionPlanes(section, bounds) {
  if (!section.enabled) return [];
  const planes = [];
  for (const axis of ['x','y','z']) {
    const s = section[axis]; if (!s.enabled) continue;
    const span = bounds.max[axis] - bounds.min[axis];
    const position = bounds.min[axis] + span * s.position;
    const normal = new Vector3(); normal[axis] = 1;
    if (section.mode === 'slab') {
      const half = span * section.thickness / 2;
      planes.push(new Plane(normal.clone(), -(position-half)), new Plane(normal.clone().negate(), position+half));
    } else {
      const direction = s.flip ? 1 : -1;
      planes.push(new Plane(normal.multiplyScalar(direction), -direction * position));
    }
  }
  return planes;
}

export function visibleIntersection(hits, planes, visible = () => true) {
  return hits.find(hit => planes.every(plane => plane.distanceToPoint(hit.point) >= -1e-5) && visible(hit));
}
