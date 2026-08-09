const TEXTURE_KEYS = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'gradientMap',
  'iridescenceMap',
  'iridescenceThicknessMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
  'sheenColorMap',
  'sheenRoughnessMap',
  'specularColorMap',
  'specularIntensityMap',
  'thicknessMap',
  'transmissionMap',
];

const UV_TEXTURE_KEYS = TEXTURE_KEYS.filter((key) => key !== 'envMap' && key !== 'gradientMap');
const MEBIBYTE = 1024 * 1024;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function materialArray(material) {
  if (!material) return [];
  return Array.isArray(material) ? material.filter(Boolean) : [material];
}

function imageDimensions(texture) {
  const source = texture?.source?.data ?? texture?.image ?? null;
  if (!source) return { width: 0, height: 0, layers: 1 };

  if (Array.isArray(source)) {
    const first = source.find(Boolean);
    const width = finite(first?.width ?? first?.naturalWidth ?? first?.videoWidth, 0);
    const height = finite(first?.height ?? first?.naturalHeight ?? first?.videoHeight, 0);
    return { width, height, layers: Math.max(1, source.length) };
  }

  const width = finite(source.width ?? source.naturalWidth ?? source.videoWidth, 0);
  const height = finite(source.height ?? source.naturalHeight ?? source.videoHeight, 0);
  const depth = finite(source.depth, 1);
  return { width, height, layers: Math.max(1, depth) };
}

function estimateTextureBytes(texture, width, height, layers) {
  if (Array.isArray(texture?.mipmaps) && texture.mipmaps.length > 0) {
    const encoded = texture.mipmaps.reduce((total, mip) => total + finite(mip?.data?.byteLength, 0), 0);
    if (encoded > 0) return encoded;
  }
  if (!width || !height) return 0;
  const bytesPerPixel = texture?.format === 1021 ? 3 : 4;
  const mipFactor = texture?.generateMipmaps === false ? 1 : 4 / 3;
  return Math.round(width * height * Math.max(1, layers) * bytesPerPixel * mipFactor);
}

function geometryTriangleCount(geometry) {
  if (!geometry) return 0;
  const position = geometry.getAttribute?.('position');
  if (geometry.index?.count) return Math.floor(geometry.index.count / 3);
  if (position?.count) return Math.floor(position.count / 3);
  return 0;
}

function geometryVertexCount(geometry) {
  return Math.max(0, Math.floor(finite(geometry?.getAttribute?.('position')?.count, 0)));
}

function hasUvTexture(material) {
  return UV_TEXTURE_KEYS.some((key) => Boolean(material?.[key]));
}

function addIssue(issues, id, severity, title, detail, recommendation) {
  issues.push({ id, severity, title, detail, recommendation });
}

function issuePenalty(issue) {
  if (issue.severity === 'critical') return 26;
  if (issue.severity === 'warning') return 11;
  return 2;
}

function statusFromIssues(issues) {
  if (issues.some((issue) => issue.severity === 'critical')) return 'heavy';
  if (issues.some((issue) => issue.severity === 'warning')) return 'review';
  return 'ready';
}

export function analyzeModelPreflight(asset, {
  fileSize = 0,
  animations = [],
  maxTextureSize = 8192,
  deviceMemory = null,
} = {}) {
  if (!asset?.traverse) throw new TypeError('A traversable 3D asset is required for preflight.');

  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const metrics = {
    meshes: 0,
    visibleMeshes: 0,
    skinnedMeshes: 0,
    instancedMeshes: 0,
    drawCalls: 0,
    triangles: 0,
    renderedTriangles: 0,
    vertices: 0,
    geometries: 0,
    materials: 0,
    textures: 0,
    maxTextureWidth: 0,
    maxTextureHeight: 0,
    maxTextureDimension: 0,
    estimatedTextureBytes: 0,
    missingNormals: 0,
    missingUvs: 0,
    morphTargetMeshes: 0,
    skeletonBones: 0,
    negativeScaleNodes: 0,
    nonUniformScaleNodes: 0,
    importedLights: 0,
    importedCameras: 0,
    animations: Array.isArray(animations) ? animations.length : 0,
    fileSize: Math.max(0, Math.floor(finite(fileSize, 0))),
  };

  asset.traverse((object) => {
    if (object?.isLight) metrics.importedLights += 1;
    if (object?.isCamera) metrics.importedCameras += 1;

    const sx = finite(object?.scale?.x, 1);
    const sy = finite(object?.scale?.y, 1);
    const sz = finite(object?.scale?.z, 1);
    if (sx < 0 || sy < 0 || sz < 0) metrics.negativeScaleNodes += 1;
    const maxScale = Math.max(Math.abs(sx), Math.abs(sy), Math.abs(sz));
    const minScale = Math.min(Math.abs(sx), Math.abs(sy), Math.abs(sz));
    if (maxScale > 0 && maxScale - minScale > maxScale * 0.001) metrics.nonUniformScaleNodes += 1;

    if (!object?.isMesh) return;
    metrics.meshes += 1;
    if (object.visible !== false) metrics.visibleMeshes += 1;
    if (object.isSkinnedMesh) {
      metrics.skinnedMeshes += 1;
      metrics.skeletonBones += Math.max(0, Math.floor(finite(object.skeleton?.bones?.length, 0)));
    }
    if (object.isInstancedMesh) metrics.instancedMeshes += 1;
    if (object.morphTargetInfluences?.length) metrics.morphTargetMeshes += 1;

    const geometry = object.geometry;
    if (geometry) geometries.add(geometry);
    const vertices = geometryVertexCount(geometry);
    const triangles = geometryTriangleCount(geometry);
    const instanceCount = object.isInstancedMesh ? Math.max(1, Math.floor(finite(object.count, 1))) : 1;
    metrics.vertices += vertices;
    metrics.triangles += triangles;
    metrics.renderedTriangles += triangles * instanceCount;

    if (geometry && !geometry.getAttribute?.('normal')) metrics.missingNormals += 1;

    const meshMaterials = materialArray(object.material);
    metrics.drawCalls += Math.max(1, meshMaterials.length);
    meshMaterials.forEach((material) => {
      materials.add(material);
      if (geometry && hasUvTexture(material) && !geometry.getAttribute?.('uv')) metrics.missingUvs += 1;
      TEXTURE_KEYS.forEach((key) => {
        const texture = material?.[key];
        if (texture?.isTexture) textures.add(texture);
      });
    });
  });

  textures.forEach((texture) => {
    const { width, height, layers } = imageDimensions(texture);
    metrics.maxTextureWidth = Math.max(metrics.maxTextureWidth, width);
    metrics.maxTextureHeight = Math.max(metrics.maxTextureHeight, height);
    metrics.maxTextureDimension = Math.max(metrics.maxTextureDimension, width, height);
    metrics.estimatedTextureBytes += estimateTextureBytes(texture, width, height, layers);
  });

  metrics.geometries = geometries.size;
  metrics.materials = materials.size;
  metrics.textures = textures.size;
  metrics.estimatedTextureMegabytes = Number((metrics.estimatedTextureBytes / MEBIBYTE).toFixed(1));

  const issues = [];
  if (metrics.fileSize > 250 * MEBIBYTE) {
    addIssue(issues, 'file-size-critical', 'critical', 'Very large GLB', `${Math.round(metrics.fileSize / MEBIBYTE)} MB can exceed mobile memory limits.`, 'Reduce texture resolution, remove unused meshes, and compress the GLB before publishing.');
  } else if (metrics.fileSize > 120 * MEBIBYTE) {
    addIssue(issues, 'file-size-warning', 'warning', 'Large GLB', `${Math.round(metrics.fileSize / MEBIBYTE)} MB is heavy for mobile delivery.`, 'Target a smaller portable GLB for public experiences.');
  }

  if (metrics.renderedTriangles > 2_000_000) {
    addIssue(issues, 'triangles-critical', 'critical', 'Extremely dense geometry', `${metrics.renderedTriangles.toLocaleString()} rendered triangles may stall mobile GPUs.`, 'Create lower-detail geometry or use a presentation LOD.');
  } else if (metrics.renderedTriangles > 750_000) {
    addIssue(issues, 'triangles-warning', 'warning', 'High triangle count', `${metrics.renderedTriangles.toLocaleString()} rendered triangles require review.`, 'Decimate hidden and imperceptible geometry.');
  }

  if (metrics.drawCalls > 320) {
    addIssue(issues, 'draw-calls-critical', 'critical', 'Excessive draw calls', `${metrics.drawCalls} material slots create a costly render submission load.`, 'Merge compatible meshes and atlas materials.');
  } else if (metrics.drawCalls > 140) {
    addIssue(issues, 'draw-calls-warning', 'warning', 'High draw-call count', `${metrics.drawCalls} draw calls can limit mobile frame rate.`, 'Consolidate materials and repeated mesh parts.');
  }

  if (metrics.maxTextureDimension > maxTextureSize) {
    addIssue(issues, 'texture-limit-critical', 'critical', 'Texture exceeds this GPU limit', `${metrics.maxTextureDimension}px exceeds the reported ${maxTextureSize}px maximum.`, 'Resize the source texture below the device limit.');
  } else if (metrics.maxTextureDimension > 4096) {
    addIssue(issues, 'texture-dimension-warning', 'warning', 'Oversized texture', `${metrics.maxTextureDimension}px textures are costly and fragile on mobile.`, 'Use 2K or 4K only where the shot truly needs it.');
  } else if (metrics.maxTextureDimension > 2048) {
    addIssue(issues, 'texture-dimension-info', 'info', 'Large texture present', `${metrics.maxTextureDimension}px is acceptable for hero detail but should be intentional.`, 'Keep large maps only on visually important surfaces.');
  }

  const textureBudgetMb = Number.isFinite(Number(deviceMemory)) && Number(deviceMemory) <= 4 ? 160 : 320;
  if (metrics.estimatedTextureMegabytes > textureBudgetMb * 1.7) {
    addIssue(issues, 'texture-memory-critical', 'critical', 'Texture memory pressure', `Estimated uncompressed texture memory is about ${metrics.estimatedTextureMegabytes} MB.`, 'Reduce map count and dimensions or use KTX2/Basis compression.');
  } else if (metrics.estimatedTextureMegabytes > textureBudgetMb) {
    addIssue(issues, 'texture-memory-warning', 'warning', 'High texture memory', `Estimated uncompressed texture memory is about ${metrics.estimatedTextureMegabytes} MB.`, 'Compress textures and remove duplicate maps before mobile release.');
  }

  if (metrics.textures > 48) {
    addIssue(issues, 'texture-count-warning', 'warning', 'Many texture resources', `${metrics.textures} textures increase memory and upload cost.`, 'Atlas small maps and remove unused channels.');
  }
  if (metrics.missingNormals > 0) {
    addIssue(issues, 'missing-normals-warning', 'warning', 'Missing surface normals', `${metrics.missingNormals} mesh${metrics.missingNormals === 1 ? '' : 'es'} may shade incorrectly.`, 'Generate or export vertex normals from the source DCC.');
  }
  if (metrics.missingUvs > 0) {
    addIssue(issues, 'missing-uv-warning', 'warning', 'Textured mesh without UVs', `${metrics.missingUvs} textured mesh assignment${metrics.missingUvs === 1 ? '' : 's'} lack UV coordinates.`, 'Repair UVs or remove maps that cannot be sampled correctly.');
  }
  if (metrics.skinnedMeshes > 8 || metrics.skeletonBones > 240) {
    addIssue(issues, 'skin-warning', 'warning', 'Heavy skinning rig', `${metrics.skinnedMeshes} skinned meshes and ${metrics.skeletonBones} bones require review.`, 'Reduce bone influences and remove unused bones for realtime delivery.');
  }
  if (metrics.animations > 20) {
    addIssue(issues, 'animations-info', 'info', 'Many animation clips', `${metrics.animations} embedded clips may be more than the experience needs.`, 'Export only controlled presentation clips.');
  }
  if (metrics.negativeScaleNodes > 0) {
    addIssue(issues, 'negative-scale-info', 'info', 'Negative scale detected', `${metrics.negativeScaleNodes} node${metrics.negativeScaleNodes === 1 ? '' : 's'} use mirrored transforms.`, 'Apply transforms in the source file if normals or animation behave unexpectedly.');
  }
  if (metrics.importedLights > 0 || metrics.importedCameras > 0) {
    addIssue(issues, 'embedded-scene-info', 'info', 'Embedded scene helpers found', `${metrics.importedLights} light${metrics.importedLights === 1 ? '' : 's'} and ${metrics.importedCameras} camera${metrics.importedCameras === 1 ? '' : 's'} are not used by the Product VIS studio.`, 'Remove unused helpers when optimizing the delivery asset.');
  }

  const score = clamp(100 - issues.reduce((total, issue) => total + issuePenalty(issue), 0), 0, 100);
  const status = statusFromIssues(issues);
  const summary = status === 'ready'
    ? 'Ready for a realtime product presentation.'
    : status === 'review'
      ? 'Usable, with optimization items worth reviewing.'
      : 'Heavy asset: optimize before public mobile delivery.';

  return {
    version: 1,
    status,
    score,
    summary,
    issues,
    metrics,
    generatedAt: new Date().toISOString(),
  };
}
