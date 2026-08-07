export function forEachMaterial(materialOrArray, callback) {
  if (!materialOrArray) return;
  if (Array.isArray(materialOrArray)) materialOrArray.forEach(callback);
  else callback(materialOrArray);
}
