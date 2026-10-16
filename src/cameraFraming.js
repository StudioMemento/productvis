import { Vector3 } from 'three';

// Fit the projected corners, including depth. A front shot should be sized by
// the visible width of the product, not automatically by its longest side.
export function perspectiveFit(bounds, target, direction, fov, aspect, widthFraction = 1, heightFraction = 1) {
  const right = new Vector3().crossVectors(new Vector3(0,1,0),direction).normalize();
  const up = new Vector3().crossVectors(direction,right).normalize();
  const horizontal = Math.tan(fov/2)*aspect*Math.max(.1,widthFraction)*.84;
  const vertical = Math.tan(fov/2)*Math.max(.1,heightFraction)*.82;
  let distance = .2;
  for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) {
    const point = new Vector3(x,y,z).sub(target), depth = point.dot(direction);
    distance = Math.max(distance,Math.abs(point.dot(right))/horizontal+depth,Math.abs(point.dot(up))/vertical+depth,depth+.2);
  }
  return distance;
}
