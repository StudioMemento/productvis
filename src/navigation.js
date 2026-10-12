export function boundedIndex(index, count) {
  return Math.max(0, Math.min(Math.max(0, count - 1), Math.round(Number.isFinite(index) ? index : 0)));
}

export function pageIndex(scrollLeft, width, count) {
  return width > 0 ? boundedIndex(scrollLeft / width, count) : 0;
}

export function scrubIndex(start, deltaX, count) {
  return boundedIndex(start - deltaX / 64, count);
}

const FAMILIES = [
  ['body', 'Carrozzeria'], ['wheels', 'Ruote'], ['glass', 'Vetri'],
  ['lights', 'Luci'], ['interior', 'Interni'], ['details', 'Dettagli'],
];

export function materialFamily(material) {
  const name = `${material.label || ''} ${material.rawName || ''}`.toLowerCase();
  if (/light|fanali|faro|headlamp|taillamp/.test(name)) return 'lights';
  if (/wheel|\brim|cerch|tire|tyre|pneumatic|caliper|calliper|freni/.test(name)) return 'wheels';
  if (/glass|window|vetri|windshield/.test(name)) return 'glass';
  if (/interior|intern|seat|steer|dashboard|int[._ ]color/.test(name)) return 'interior';
  if (/paint|body|carroz|exterior|vernice/.test(name)) return 'body';
  return 'details';
}

export function groupMaterials(materials) {
  return FAMILIES.map(([id, label]) => ({ id, label, materials: materials.filter(m => materialFamily(m) === id) })).filter(group => group.materials.length);
}

export function locateMaterial(groups, selectedId) {
  const groupIndex = groups.findIndex(group => group.materials.some(m => m.id === selectedId));
  const index = Math.max(0, groupIndex);
  return { groupIndex: index, materialIndex: Math.max(0, groups[index]?.materials.findIndex(m => m.id === selectedId) ?? 0) };
}
