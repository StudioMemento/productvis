const GENERIC_LABELS = new Set([
  'scene', 'root', 'group', 'object', 'object3d', 'node', 'mesh', 'model', 'asset', 'collection',
]);

function cleanText(value, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

export function structureSlug(value, fallback = 'part') {
  const source = cleanText(value, fallback)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return source
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || fallback;
}

export function hashStructurePath(value) {
  const text = String(value || 'part');
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

export function stablePartId(path) {
  return `part_${hashStructurePath(path)}`;
}

function materialSlotCount(node) {
  if (!node?.isMesh || !node.material) return 0;
  return Array.isArray(node.material) ? node.material.length : 1;
}

function classifyNode(node) {
  if (node?.isSkinnedMesh) return 'skinned-mesh';
  if (node?.isMesh) return 'mesh';
  if (node?.isGroup) return 'group';
  if (node?.isScene) return 'scene';
  return String(node?.type || 'node').toLowerCase();
}

function hasMeaningfulName(node) {
  const normalized = structureSlug(node?.name || '', '');
  return Boolean(normalized) && !GENERIC_LABELS.has(normalized);
}

function displayLabel(node, ordinal, kind) {
  const named = cleanText(node?.name, '');
  if (named) return named.slice(0, 120);
  const title = kind === 'skinned-mesh'
    ? 'Skinned Mesh'
    : kind.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  return `${title} ${ordinal}`;
}

function collectMeshCounts(root) {
  const memo = new WeakMap();
  const visit = (node) => {
    if (!node || typeof node !== 'object') return 0;
    let count = node.isMesh ? 1 : 0;
    const children = Array.isArray(node.children) ? node.children : [];
    children.forEach((child) => { count += visit(child); });
    memo.set(node, count);
    return count;
  };
  visit(root);
  return memo;
}

function shouldIndex(node, meshCount) {
  if (!node || meshCount <= 0) return false;
  if (node.isMesh) return true;
  const children = Array.isArray(node.children) ? node.children : [];
  return node.visible === false || hasMeaningfulName(node) || children.length > 1;
}

export function buildStructureIndex(root) {
  const records = [];
  const objectById = new Map();
  const idByObject = new WeakMap();
  const meshCounts = collectMeshCounts(root);
  const usedIds = new Set();
  let generatedOrdinal = 0;

  const uniqueId = (path) => {
    const base = stablePartId(path);
    if (!usedIds.has(base)) {
      usedIds.add(base);
      return base;
    }
    let suffix = 2;
    while (usedIds.has(`${base}_${suffix}`)) suffix += 1;
    const id = `${base}_${suffix}`;
    usedIds.add(id);
    return id;
  };

  const walk = (node, parentPath = 'product', indexedParentId = null, depth = 0) => {
    const children = Array.isArray(node?.children) ? node.children : [];
    const siblingCounts = new Map();

    children.forEach((child, childIndex) => {
      const kind = classifyNode(child);
      const base = structureSlug(child?.name || kind || 'part', 'part');
      const ordinal = (siblingCounts.get(base) || 0) + 1;
      siblingCounts.set(base, ordinal);
      const path = `${parentPath}/${base}[${ordinal}]`;
      const meshCount = meshCounts.get(child) || 0;
      let nextParentId = indexedParentId;

      if (shouldIndex(child, meshCount)) {
        generatedOrdinal += 1;
        const id = uniqueId(path);
        const record = {
          id,
          label: displayLabel(child, generatedOrdinal, kind),
          path,
          kind,
          depth,
          parentId: indexedParentId,
          childIds: [],
          authoredVisible: child.visible !== false,
          meshCount,
          materialSlots: materialSlotCount(child),
          childIndex,
          searchText: `${cleanText(child?.name, '')} ${path} ${kind}`.toLowerCase(),
          object: child,
        };
        records.push(record);
        objectById.set(id, child);
        idByObject.set(child, id);
        nextParentId = id;
      }

      walk(child, path, nextParentId, depth + 1);
    });
  };

  if (root) walk(root);

  const recordById = new Map(records.map((record) => [record.id, record]));
  records.forEach((record) => {
    if (record.parentId && recordById.has(record.parentId)) {
      recordById.get(record.parentId).childIds.push(record.id);
    }
  });

  return {
    root,
    records,
    recordById,
    objectById,
    idByObject,
    meshCount: records.filter((record) => record.kind.includes('mesh')).length,
    groupCount: records.filter((record) => !record.kind.includes('mesh')).length,
  };
}

export function sanitizeVisibilityOverrides(value, validIds = null, limit = 4096) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  const valid = validIds instanceof Set ? validIds : null;
  Object.entries(value).slice(0, limit).forEach(([id, visible]) => {
    const normalizedId = String(id).slice(0, 96);
    if (!/^part_[a-z0-9_]+$/i.test(normalizedId)) return;
    if (valid && !valid.has(normalizedId)) return;
    if (typeof visible === 'boolean') result[normalizedId] = visible;
  });
  return result;
}

export function filterStructureRecords(records, query = '') {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return [...records];
  const terms = normalized.split(/\s+/).filter(Boolean);
  return records.filter((record) => terms.every((term) => record.searchText.includes(term)));
}
