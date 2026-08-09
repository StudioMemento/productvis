const THIN_SHELL_HINTS = [
  'leaf', 'fabric', 'cloth', 'strap', 'paper', 'card', 'plane', 'shell', 'thin',
  'label', 'decal', 'screen', 'flag', 'fin', 'wing', 'blade', 'panel',
];

const GLASS_HINTS = [
  'glass', 'window', 'windscreen', 'windshield', 'visor', 'lens', 'light',
  'lamp', 'cover', 'canopy',
];

function getNameTokens(mesh, material) {
  return `${mesh?.name || ''} ${material?.name || ''}`.trim().toLowerCase();
}

function hasHint(tokens, hints) {
  return hints.some((hint) => tokens.includes(hint));
}

export function materialSideName(side) {
  if (side === 2) return 'double';
  if (side === 1) return 'back';
  return 'front';
}

function classifyMaterial(mesh, material, materialId) {
  const tokens = getNameTokens(mesh, material);
  const alphaTest = Number(material?.alphaTest || 0);
  const opacity = Number(material?.opacity ?? 1);
  const transmission = Number(material?.transmission || 0);
  const transparent = Boolean(material?.transparent) || opacity < 0.999;
  const alphaMasked = alphaTest > 0.001;
  const alphaBlended = transparent && !alphaMasked && transmission <= 0.001;
  const originalSide = materialSideName(material?.side);
  const doubleSided = originalSide === 'double';
  const glassLike = transmission > 0.001 || hasHint(tokens, GLASS_HINTS);
  const thinShellLike = alphaMasked || hasHint(tokens, THIN_SHELL_HINTS);
  const safeBackfaceCandidate = !doubleSided && thinShellLike && !glassLike;

  const issues = [];
  if (doubleSided) issues.push('double-sided');
  if (alphaMasked) issues.push('alpha-mask');
  if (alphaBlended) issues.push('alpha-blend');
  if (glassLike) issues.push('glass');
  if (safeBackfaceCandidate) issues.push('backface-candidate');

  return {
    id: materialId,
    meshName: mesh?.name || 'Mesh',
    materialName: material?.name || `Material ${materialId}`,
    originalSide,
    transparent,
    alphaMasked,
    alphaBlended,
    doubleSided,
    glassLike,
    thinShellLike,
    safeBackfaceCandidate,
    issues,
    recommendedSide: safeBackfaceCandidate ? 'double' : originalSide,
  };
}

export function analyzeMaterialDiagnostics(asset, { forEachMaterial } = {}) {
  if (!asset || typeof forEachMaterial !== 'function') {
    return {
      totalSlots: 0,
      uniqueMaterials: 0,
      doubleSided: 0,
      transparent: 0,
      alphaMasked: 0,
      alphaBlended: 0,
      glass: 0,
      backfaceCandidates: 0,
      health: 'safe',
      materials: [],
      notes: [],
    };
  }

  const byMaterial = new Map();
  let slotCount = 0;
  let materialId = 0;

  asset.traverse((mesh) => {
    if (!mesh?.isMesh) return;
    forEachMaterial(mesh.material, (material) => {
      slotCount += 1;
      if (!material) return;
      let existing = byMaterial.get(material);
      if (!existing) {
        materialId += 1;
        existing = classifyMaterial(mesh, material, materialId);
        byMaterial.set(material, existing);
        material.userData = material.userData || {};
        material.userData.pvDiagnosticId = materialId;
        material.userData.pvBackfaceCandidate = existing.safeBackfaceCandidate;
        material.userData.pvGlassLike = existing.glassLike;
      }
    });
  });

  const materials = [...byMaterial.values()];
  const summary = {
    totalSlots: slotCount,
    uniqueMaterials: materials.length,
    doubleSided: materials.filter((item) => item.doubleSided).length,
    transparent: materials.filter((item) => item.transparent).length,
    alphaMasked: materials.filter((item) => item.alphaMasked).length,
    alphaBlended: materials.filter((item) => item.alphaBlended).length,
    glass: materials.filter((item) => item.glassLike).length,
    backfaceCandidates: materials.filter((item) => item.safeBackfaceCandidate).length,
    health: 'safe',
    materials,
    notes: [],
  };

  if (summary.backfaceCandidates > 0) {
    summary.health = 'review';
    summary.notes.push('Thin-shell or alpha-cutout materials can benefit from targeted backface repair.');
  }
  if (summary.alphaBlended > 0 || summary.glass > 0) {
    if (summary.health === 'safe') summary.health = 'watch';
    summary.notes.push('Transparent and glass materials are reported for review but are not forced double-sided.');
  }
  if (summary.health === 'safe') {
    summary.notes.push('No backface-sensitive materials were detected.');
  }

  return summary;
}
