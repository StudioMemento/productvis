import * as THREE from 'three';

const RX = {
  glass: /(glass|window|windshield|windscreen|screen|visor|glazing)/i,
  alpha: /(grille|grill|mesh|net|perforat|fabric|cloth|carpet|speaker|vent)/i,
  thin: /(interior|trim|liner|lining|panel|seat|dash|cockpit|engine|bay|underbody|inner|shell|fabric|cloth)/i,
  tyre: /(tyre|tire|rubber|tread)/i,
  decal: /(decal|sticker|logo|badge|emblem|plate|license|letter|text)/i,
  emissive: /(emissive|lamp|light|led|headlight|headlamp|taillight|indicator)/i,
  wheel: /(wheel|rim|alloy|spoke)/i,
  brake: /(brake|caliper|disc|rotor)/i,
  interior: /(interior|seat|dashboard|dash|cockpit|cabin|steering|carpet|alcantara|leather|console|doorcard|door_card)/i,
  body: /(body|paint|chassis|bumper|hood|bonnet|fender|door|quarter|roof|trunk|boot|spoiler|wing|mirror|side_skirt|sideskirt|diffuser)/i
};

function snapshotMaterial(material) {
  return {
    transparent: Boolean(material.transparent),
    opacity: Number.isFinite(material.opacity) ? material.opacity : 1,
    alphaTest: Number.isFinite(material.alphaTest) ? material.alphaTest : 0,
    depthWrite: material.depthWrite !== false,
    depthTest: material.depthTest !== false,
    side: material.side,
    color: material.color?.getHex?.() ?? null,
    roughness: Number.isFinite(material.roughness) ? material.roughness : null,
    metalness: Number.isFinite(material.metalness) ? material.metalness : null,
    transmission: Number.isFinite(material.transmission) ? material.transmission : null,
    thickness: Number.isFinite(material.thickness) ? material.thickness : null,
    ior: Number.isFinite(material.ior) ? material.ior : null,
    envMapIntensity: Number.isFinite(material.envMapIntensity) ? material.envMapIntensity : null,
    blending: material.blending,
    premultipliedAlpha: Boolean(material.premultipliedAlpha),
    forceSinglePass: material.forceSinglePass
  };
}

export function restoreMaterial(entry) {
  const { material, original } = entry;
  material.transparent = original.transparent;
  material.opacity = original.opacity;
  material.alphaTest = original.alphaTest;
  material.depthWrite = original.depthWrite;
  material.depthTest = original.depthTest;
  material.side = original.side;
  material.blending = original.blending;
  material.premultipliedAlpha = original.premultipliedAlpha;
  if ('forceSinglePass' in material && original.forceSinglePass !== undefined) material.forceSinglePass = original.forceSinglePass;
  if (original.color !== null && material.color) material.color.setHex(original.color);
  if (original.roughness !== null && 'roughness' in material) material.roughness = original.roughness;
  if (original.metalness !== null && 'metalness' in material) material.metalness = original.metalness;
  if (original.transmission !== null && 'transmission' in material) material.transmission = original.transmission;
  if (original.thickness !== null && 'thickness' in material) material.thickness = original.thickness;
  if (original.ior !== null && 'ior' in material) material.ior = original.ior;
  if (original.envMapIntensity !== null && 'envMapIntensity' in material) material.envMapIntensity = original.envMapIntensity;
  for (const mesh of entry.meshes) mesh.renderOrder = mesh.userData.__pvOriginalRenderOrder ?? 0;
  removeBackfaceProxies(entry);
  material.needsUpdate = true;
}

export function classifyMaterial(material, meshNames = []) {
  const name = `${material.name || ''} ${meshNames.join(' ')}`;
  const opacity = Number.isFinite(material.opacity) ? material.opacity : 1;
  const transmission = Number.isFinite(material.transmission) ? material.transmission : 0;
  if (RX.glass.test(name) || transmission > 0.05 || (material.transparent && opacity < 0.88)) return 'Transparent glass';
  if (material.alphaMap || material.alphaTest > 0.001 || (material.transparent && opacity >= 0.88) || RX.alpha.test(name)) return 'Alpha cutout';
  if (material.side === THREE.DoubleSide || RX.thin.test(name)) return 'Thin-shell candidate';
  return 'Opaque';
}

export function semanticGroupFor(materialName, meshNames = []) {
  const name = `${materialName || ''} ${meshNames.join(' ')}`;
  if (RX.glass.test(name)) return 'glass';
  if (RX.tyre.test(name) || RX.decal.test(name) || RX.emissive.test(name)) return 'none';
  if (RX.brake.test(name)) return 'brakes';
  if (RX.wheel.test(name)) return 'wheels';
  if (RX.interior.test(name)) return 'interior';
  if (RX.body.test(name)) return 'body';
  return 'none';
}

export function buildMaterialEntries(productRoot, savedAssignments = {}) {
  const byMaterial = new Map();
  const productMeshes = [];
  productRoot.updateWorldMatrix(true, true);
  productRoot.traverse((object) => {
    if (!object.isMesh || object.userData.__pvBackfaceProxy) return;
    object.userData.__pvOriginalRenderOrder ??= object.renderOrder || 0;
    productMeshes.push(object);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      let data = byMaterial.get(material.uuid);
      if (!data) {
        data = { material, meshes: [], meshNames: new Set(), firstIndex: byMaterial.size };
        byMaterial.set(material.uuid, data);
      }
      data.meshes.push(object);
      data.meshNames.add(object.name || `mesh-${object.id}`);
    });
  });
  const entries = [...byMaterial.values()].map((data, index) => {
    const meshNames = [...data.meshNames];
    const name = data.material.name?.trim() || `Material ${index + 1}`;
    const key = `${index}:${name}`;
    const detectedGroup = semanticGroupFor(name, meshNames);
    return {
      key, index, name, material: data.material, meshes: data.meshes, meshNames,
      original: snapshotMaterial(data.material),
      classification: classifyMaterial(data.material, meshNames),
      group: savedAssignments[key] || detectedGroup,
      detectedGroup
    };
  });
  return { entries, productMeshes };
}

function removeBackfaceProxies(entry) {
  for (const mesh of entry.meshes) {
    const proxies = mesh.userData.__pvBackfaceProxies;
    if (!proxies) continue;
    const proxy = proxies[entry.key];
    if (proxy) {
      proxy.removeFromParent();
      if (Array.isArray(proxy.material)) proxy.material.forEach((m) => m?.dispose?.());
      else proxy.material?.dispose?.();
      delete proxies[entry.key];
    }
  }
}

function addBackfaceProxy(entry) {
  for (const mesh of entry.meshes) {
    if (mesh.isSkinnedMesh || Array.isArray(mesh.material) || mesh.material !== entry.material) {
      entry.material.side = THREE.DoubleSide;
      continue;
    }
    mesh.userData.__pvBackfaceProxies ||= {};
    if (mesh.userData.__pvBackfaceProxies[entry.key]) continue;
    const backMaterial = entry.material.clone();
    backMaterial.name = `${entry.material.name || 'glass'} · backface`;
    backMaterial.side = THREE.BackSide;
    backMaterial.transparent = true;
    backMaterial.depthWrite = false;
    backMaterial.depthTest = true;
    backMaterial.opacity = Math.min(entry.material.opacity, 0.45);
    backMaterial.needsUpdate = true;
    const proxy = new THREE.Mesh(mesh.geometry, backMaterial);
    proxy.name = `${mesh.name || 'mesh'} · transparent backface`;
    proxy.userData.__pvBackfaceProxy = true;
    proxy.frustumCulled = mesh.frustumCulled;
    proxy.renderOrder = 19;
    proxy.raycast = () => {};
    mesh.add(proxy);
    mesh.userData.__pvBackfaceProxies[entry.key] = proxy;
  }
}

function applyAutomatic(entry) {
  const { material, classification } = entry;
  if (classification === 'Opaque') {
    material.transparent = false;
    material.alphaTest = 0;
    material.depthWrite = true;
    material.depthTest = true;
    material.side = THREE.FrontSide;
    entry.meshes.forEach((mesh) => { mesh.renderOrder = 0; });
  } else if (classification === 'Alpha cutout') {
    material.transparent = false;
    material.alphaTest = Math.max(entry.original.alphaTest, 0.35);
    material.depthWrite = true;
    material.depthTest = true;
    material.side = RX.thin.test(`${entry.name} ${entry.meshNames.join(' ')}`) ? THREE.DoubleSide : THREE.FrontSide;
    entry.meshes.forEach((mesh) => { mesh.renderOrder = 4; });
  } else if (classification === 'Transparent glass') {
    material.transparent = true;
    material.opacity = Math.min(entry.original.opacity || 0.38, 0.52);
    material.alphaTest = 0;
    material.depthWrite = false;
    material.depthTest = true;
    material.side = THREE.FrontSide;
    material.premultipliedAlpha = false;
    if ('forceSinglePass' in material) material.forceSinglePass = false;
    if ('transmission' in material) material.transmission = Math.max(entry.original.transmission || 0, 0.55);
    if ('roughness' in material) material.roughness = Math.min(entry.original.roughness ?? 0.12, 0.16);
    entry.meshes.forEach((mesh) => { mesh.renderOrder = 20; });
    addBackfaceProxy(entry);
  } else {
    material.transparent = entry.original.transparent;
    material.alphaTest = entry.original.alphaTest;
    material.depthWrite = true;
    material.depthTest = true;
    material.side = THREE.DoubleSide;
    entry.meshes.forEach((mesh) => { mesh.renderOrder = entry.original.transparent ? 8 : 2; });
  }
}

export function applyMaterialPolicy(entry, policy = 'Auto') {
  restoreMaterial(entry);
  const { material } = entry;
  switch (policy) {
    case 'Front':
      material.side = THREE.FrontSide;
      break;
    case 'Back':
      material.side = THREE.BackSide;
      break;
    case 'Double':
      material.side = THREE.DoubleSide;
      break;
    case 'Opaque':
      material.transparent = false;
      material.opacity = 1;
      material.alphaTest = 0;
      material.depthWrite = true;
      material.depthTest = true;
      material.side = THREE.FrontSide;
      entry.meshes.forEach((mesh) => { mesh.renderOrder = 0; });
      break;
    case 'Cutout':
      material.transparent = false;
      material.opacity = 1;
      material.alphaTest = Math.max(entry.original.alphaTest, 0.35);
      material.depthWrite = true;
      material.depthTest = true;
      material.side = THREE.DoubleSide;
      entry.meshes.forEach((mesh) => { mesh.renderOrder = 4; });
      break;
    case 'Transparent':
      material.transparent = true;
      material.opacity = Math.min(entry.original.opacity || 0.42, 0.58);
      material.alphaTest = 0;
      material.depthWrite = false;
      material.depthTest = true;
      material.side = THREE.FrontSide;
      if ('transmission' in material) material.transmission = Math.max(entry.original.transmission || 0, 0.5);
      entry.meshes.forEach((mesh) => { mesh.renderOrder = 20; });
      addBackfaceProxy(entry);
      break;
    default:
      applyAutomatic(entry);
      break;
  }
  material.needsUpdate = true;
}

export function applyEnvironmentIntensity(entries, intensity) {
  for (const entry of entries) {
    if ('envMapIntensity' in entry.material) entry.material.envMapIntensity = intensity;
    entry.material.needsUpdate = true;
    for (const mesh of entry.meshes) {
      const proxy = mesh.userData.__pvBackfaceProxies?.[entry.key];
      if (proxy?.material && !Array.isArray(proxy.material) && 'envMapIntensity' in proxy.material) {
        proxy.material.envMapIntensity = intensity;
        proxy.material.needsUpdate = true;
      }
    }
  }
}

export function applyConfigurationToEntries(entries, group, values) {
  for (const entry of entries) {
    if (entry.group !== group) continue;
    const material = entry.material;
    if (values.color && material.color) material.color.set(values.color);
    if (Number.isFinite(values.roughness) && 'roughness' in material) material.roughness = values.roughness;
    if (Number.isFinite(values.metalness) && 'metalness' in material) material.metalness = values.metalness;
    if (Number.isFinite(values.opacity)) {
      material.opacity = values.opacity;
      material.transparent = values.opacity < 0.999 || material.transparent;
    }
    if (Number.isFinite(values.transmission) && 'transmission' in material) material.transmission = values.transmission;
    material.needsUpdate = true;
    for (const mesh of entry.meshes) {
      const proxy = mesh.userData.__pvBackfaceProxies?.[entry.key];
      const proxyMaterial = proxy?.material;
      if (!proxyMaterial || Array.isArray(proxyMaterial)) continue;
      if (values.color && proxyMaterial.color) proxyMaterial.color.set(values.color);
      if (Number.isFinite(values.roughness) && 'roughness' in proxyMaterial) proxyMaterial.roughness = values.roughness;
      if (Number.isFinite(values.metalness) && 'metalness' in proxyMaterial) proxyMaterial.metalness = values.metalness;
      if (Number.isFinite(values.opacity)) proxyMaterial.opacity = Math.min(values.opacity, 0.5);
      if (Number.isFinite(values.transmission) && 'transmission' in proxyMaterial) proxyMaterial.transmission = values.transmission;
      proxyMaterial.needsUpdate = true;
    }
  }
}

export function materialStats(entries) {
  const stats = { Opaque: 0, 'Alpha cutout': 0, 'Transparent glass': 0, 'Thin-shell candidate': 0 };
  for (const entry of entries) stats[entry.classification] = (stats[entry.classification] || 0) + 1;
  return stats;
}
