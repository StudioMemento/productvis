import * as THREE from 'three';
import { forEachMaterial } from '../utils/materials.js';
import { easeInOutCubic } from '../utils/math.js';
import { CONTACT_SHADOW_LAYER } from '../config/runtime.js';
import { analyzeMaterialDiagnostics, materialSideName } from './MaterialDiagnostics.js';
import { computeVisibleBounds, isFiniteBounds } from './VisibleBounds.js';
import { ProductStructure } from '../structure/ProductStructure.js';
import { ProductVariants } from '../configurator/ProductVariants.js';
import { ProductExplosion } from '../story/ProductExplosion.js';

function mapMaterials(materialOrArray, mapper) {
  if (Array.isArray(materialOrArray)) return materialOrArray.map((material) => mapper(material));
  return mapper(materialOrArray);
}

export class ProductSession {
  constructor({ scene, renderer, getEnvironmentTexture, onBoundsChanged } = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.getEnvironmentTexture = getEnvironmentTexture;
    this.onBoundsChanged = onBoundsChanged;

    this.sessionRoot = null;
    this.userTransformRoot = null;
    this.motionRoot = null;
    this.normalizationRoot = null;
    this.assetRoot = null;

    this.name = 'Demo Object';
    this.fileSize = null;
    this.userScale = 1;
    this.userOffset = 0;
    this.userPositionXZ = { x: 0, z: 0 };
    this.groundY = 0;
    this.modelRadius = 1.8;
    this.framingRadius = 1.8;
    this.modelHeight = 3;
    this.modelBounds = new THREE.Box3();
    this.framingBounds = new THREE.Box3();
    this.boundsValid = false;
    this.boundsReport = null;
    this.shadowsEnabled = true;
    this.materialMode = 'original';
    this.transformTween = null;
    this.backfaceRepairEnabled = false;
    this.materialSideOverrides = new Map();
    this.suggestedSideOverrideIds = new Set();
    this.variantAppearanceByMesh = {};
    this.variantMaterialInstances = new Set();
    this.materialDiagnostics = {
      totalSlots: 0,
      uniqueMaterials: 0,
      doubleSided: 0,
      transparent: 0,
      alphaMasked: 0,
      alphaBlended: 0,
      depthWriteRisks: 0,
      transparentDoubleSided: 0,
      glass: 0,
      backfaceCandidates: 0,
      health: 'safe',
      materials: [],
      notes: [],
    };
    this.structure = new ProductStructure({
      scene: this.scene,
      onChange: ({ boundsChanged }) => {
        if (!this.sessionRoot) return;
        if (boundsChanged) {
          this.recomputeGrounding();
          this.updateBounds({ updateShadowScale: true });
        }
      },
    });
    this.variants = new ProductVariants({
      getValidPartIds: () => this.structure.getValidPartIds(),
      expandAppearanceTarget: (partId) => this.structure.expandPartToMeshIds(partId),
      onApply: ({ visibility, appearanceByMesh }) => {
        this.variantAppearanceByMesh = appearanceByMesh || {};
        this.structure.setVariantVisibilityOverrides(visibility || {});
        this.applyMaterialPresentation();
      },
    });
    this.explosion = new ProductExplosion({
      getRoot: () => this.assetRoot,
      getPart: (partId) => this.structure.getPart(partId),
      getValidPartIds: () => this.structure.getValidPartIds(),
      getVisibleBounds: (target) => this.structure.getVisibleBounds(target),
      onChange: ({ boundsChanged }) => {
        if (boundsChanged && this.sessionRoot) this.updateBounds({ updateShadowScale: true });
      },
    });

    this.protectedMaterials = new Set();
    this.overrideMaterialVariants = this.#createOverrideMaterialVariants();
    Object.values(this.overrideMaterialVariants).forEach((variants) => {
      Object.values(variants).forEach((material) => this.protectedMaterials.add(material));
    });
  }

  #createOverrideMaterialVariants() {
    const definitions = {
      clay: {
        color: 0xd9d4cb,
        roughness: 0.57,
        metalness: 0.04,
        clearcoat: 0.12,
        clearcoatRoughness: 0.5,
      },
      chrome: {
        color: 0xc7cdd2,
        roughness: 0.16,
        metalness: 1,
        clearcoat: 0.4,
        clearcoatRoughness: 0.12,
      },
      matte: {
        color: 0x17191d,
        roughness: 0.93,
        metalness: 0.02,
        clearcoat: 0.02,
      },
    };

    const variants = {};
    Object.entries(definitions).forEach(([mode, params]) => {
      const front = new THREE.MeshPhysicalMaterial({ name: `PV ${mode} front`, ...params, side: THREE.FrontSide });
      const back = front.clone();
      back.name = `PV ${mode} back`;
      back.side = THREE.BackSide;
      const double = front.clone();
      double.name = `PV ${mode} double`;
      double.side = THREE.DoubleSide;
      variants[mode] = { front, back, double };
    });
    return variants;
  }

  setModel(asset, options = {}) {
    if (!asset) throw new Error('A renderable asset is required.');
    const normalization = this.#prepareAsset(asset);
    const nextRig = this.#createRig(asset, normalization);

    this.disposeCurrent();

    this.sessionRoot = nextRig.sessionRoot;
    this.userTransformRoot = nextRig.userTransformRoot;
    this.motionRoot = nextRig.motionRoot;
    this.normalizationRoot = nextRig.normalizationRoot;
    this.assetRoot = asset;
    this.name = options.name || 'Untitled Product';
    this.fileSize = options.fileSize ?? null;
    this.userScale = 1;
    this.userOffset = 0;
    this.userPositionXZ = { x: 0, z: 0 };
    this.materialMode = 'original';
    this.transformTween = null;
    this.backfaceRepairEnabled = false;
    this.materialSideOverrides.clear();
    this.suggestedSideOverrideIds.clear();
    this.variantAppearanceByMesh = {};

    this.scene.add(this.sessionRoot);
    this.sessionRoot.updateMatrixWorld(true);
    this.structure.attach(this.assetRoot);
    this.variants.attach();
    this.explosion.attach();
    this.recomputeGrounding();
    this.updateBounds({ updateShadowScale: true });
    this.applyMaterialPresentation();

    return {
      stats: this.collectStats(),
      metrics: this.getMetrics(),
      asset: this.assetRoot,
      diagnostics: this.getMaterialDiagnostics(),
      structure: this.getStructureReport(),
      variants: this.getVariantReport(),
      explosion: this.getExplosionReport(),
    };
  }

  #prepareAsset(asset) {
    let meshCount = 0;
    const maxAnisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    asset.traverse((object) => {
      if (!object.isMesh) return;
      meshCount += 1;
      object.castShadow = this.shadowsEnabled;
      object.receiveShadow = true;
      object.layers.enable(CONTACT_SHADOW_LAYER);
      object.frustumCulled = true;
      object.userData.__pvOriginalMaterial = object.material;

      forEachMaterial(object.material, (material) => {
        material.needsUpdate = true;
        material.userData = material.userData || {};
        if (!('pvOriginalSide' in material.userData)) material.userData.pvOriginalSide = material.side;
        Object.values(material).forEach((value) => {
          if (value?.isTexture) value.anisotropy = maxAnisotropy;
        });
      });
    });

    if (meshCount === 0) throw new Error('No mesh geometry was found in this GLB.');

    this.materialDiagnostics = analyzeMaterialDiagnostics(asset, { forEachMaterial });

    asset.updateMatrixWorld(true);
    const initialBounds = computeVisibleBounds(asset, {
      allowRobustTrim: true,
      isVisible: (object) => {
        let current = object;
        while (current) {
          if (current.visible === false) return false;
          if (current === asset) return true;
          current = current.parent;
        }
        return false;
      },
    });
    // A single malformed export vertex can otherwise normalize the real product
    // down to a speck before the camera even gets a chance to frame it. Use the
    // robust core only for extreme outliers; retain exact bounds for normal assets.
    const useRobustNormalization = initialBounds.robustTrimmed && initialBounds.outlierRatio >= 8;
    const box = (useRobustNormalization ? initialBounds.framingBounds : initialBounds.fullBounds).clone();
    if (!isFiniteBounds(box)) throw new Error('The model bounds are empty or invalid.');

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
      throw new Error('The model has invalid dimensions.');
    }

    const normalizedSize = 3.15;
    const scale = normalizedSize / maxDimension;
    return {
      box,
      center,
      scale,
      boundsSource: useRobustNormalization ? 'robust-core' : 'full',
      outlierRatio: initialBounds.outlierRatio,
    };
  }

  #createRig(asset, normalization) {
    const sessionRoot = new THREE.Group();
    sessionRoot.name = 'Product VIS Session Root';

    const userTransformRoot = new THREE.Group();
    userTransformRoot.name = 'Product VIS User Transform Root';

    const motionRoot = new THREE.Group();
    motionRoot.name = 'Product VIS Motion Root';

    const normalizationRoot = new THREE.Group();
    normalizationRoot.name = 'Product VIS Normalization Root';
    normalizationRoot.scale.setScalar(normalization.scale);
    normalizationRoot.position.set(
      -normalization.center.x * normalization.scale,
      -normalization.box.min.y * normalization.scale,
      -normalization.center.z * normalization.scale,
    );

    normalizationRoot.add(asset);
    motionRoot.add(normalizationRoot);
    userTransformRoot.add(motionRoot);
    sessionRoot.add(userTransformRoot);

    return { sessionRoot, userTransformRoot, motionRoot, normalizationRoot };
  }

  disposeCurrent() {
    if (!this.sessionRoot) return;
    this.explosion.detach();
    this.variants.detach();
    this.#disposeVariantMaterials();
    this.structure.detach();
    this.scene.remove(this.sessionRoot);

    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    const environmentTexture = this.getEnvironmentTexture?.();

    this.sessionRoot.traverse((object) => {
      if (!object.isMesh) return;
      if (object.geometry) geometries.add(object.geometry);
      const original = object.userData.__pvOriginalMaterial;
      forEachMaterial(original || object.material, (material) => materials.add(material));
      forEachMaterial(object.material, (material) => materials.add(material));
    });

    materials.forEach((material) => {
      if (!material || this.protectedMaterials.has(material)) return;
      Object.values(material).forEach((value) => {
        if (value?.isTexture && value !== environmentTexture) textures.add(value);
      });
    });

    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => {
      if (material && !this.protectedMaterials.has(material)) material.dispose();
    });
    geometries.forEach((geometry) => geometry.dispose());

    this.sessionRoot = null;
    this.userTransformRoot = null;
    this.motionRoot = null;
    this.normalizationRoot = null;
    this.assetRoot = null;
  }

  collectStats() {
    let triangles = 0;
    let vertices = 0;
    const materials = new Set();
    const textures = new Set();

    this.sessionRoot?.traverse((object) => {
      if (!object.isMesh || !object.geometry) return;
      const geometry = object.geometry;
      const position = geometry.getAttribute('position');
      if (position) vertices += position.count;
      if (geometry.index) triangles += geometry.index.count / 3;
      else if (position) triangles += position.count / 3;

      const original = object.userData.__pvOriginalMaterial || object.material;
      forEachMaterial(original, (material) => {
        materials.add(material);
        Object.values(material).forEach((value) => {
          if (value?.isTexture) textures.add(value);
        });
      });
    });

    return {
      triangles: Math.round(triangles),
      vertices: Math.round(vertices),
      materials: materials.size,
      textures: textures.size,
    };
  }

  updateBounds({ updateShadowScale = true, notify = true } = {}) {
    if (!this.sessionRoot) return null;
    this.sessionRoot.updateMatrixWorld(true);
    const explosionOffsets = this.explosion?.getState?.().explodeOffsets || {};
    const boundsReport = this.structure.getVisibleBoundsReport({
      allowRobustTrim: Object.keys(explosionOffsets).length === 0 && !this.explosion?.isDynamic?.(),
    });
    const visibleBounds = boundsReport.fullBounds;
    if (isFiniteBounds(visibleBounds)) this.modelBounds.copy(visibleBounds);
    else this.modelBounds.setFromObject(this.sessionRoot, true);
    if (isFiniteBounds(boundsReport.framingBounds)) this.framingBounds.copy(boundsReport.framingBounds);
    else this.framingBounds.copy(this.modelBounds);
    const size = this.modelBounds.getSize(new THREE.Vector3());
    const sphere = this.modelBounds.getBoundingSphere(new THREE.Sphere());
    const framingSphere = this.framingBounds.getBoundingSphere(new THREE.Sphere());
    this.modelRadius = Math.max(sphere.radius, 0.4);
    this.framingRadius = Math.max(framingSphere.radius, 0.4);
    this.modelHeight = Math.max(size.y, 0.5);
    this.boundsValid = isFiniteBounds(this.modelBounds) && isFiniteBounds(this.framingBounds);
    this.boundsReport = {
      ...boundsReport,
      fullBounds: undefined,
      framingBounds: undefined,
    };

    const metrics = this.getMetrics();
    if (notify) this.onBoundsChanged?.(metrics, { updateShadowScale });
    return metrics;
  }

  getMetrics() {
    return {
      root: this.sessionRoot,
      bounds: this.modelBounds,
      radius: this.modelRadius,
      framingBounds: this.framingBounds,
      framingRadius: this.framingRadius,
      framingSource: this.boundsReport?.source || 'full',
      boundsValid: this.boundsValid,
      boundsReport: this.boundsReport,
      height: this.modelHeight,
    };
  }

  recomputeGrounding() {
    if (!this.sessionRoot) return;
    this.sessionRoot.position.y = 0;
    this.sessionRoot.updateMatrixWorld(true);
    const box = this.structure.getVisibleBounds(new THREE.Box3());
    if (box.isEmpty()) box.setFromObject(this.sessionRoot, true);
    this.groundY = -box.min.y;
    this.sessionRoot.position.y = this.groundY + this.userOffset;
    this.userPositionXZ = { x: this.sessionRoot.position.x, z: this.sessionRoot.position.z };
    this.sessionRoot.updateMatrixWorld(true);
  }

  center() {
    if (!this.sessionRoot) return;
    this.sessionRoot.position.x = 0;
    this.sessionRoot.position.z = 0;
    this.sessionRoot.updateMatrixWorld(true);
    const box = this.structure.getVisibleBounds(new THREE.Box3());
    if (box.isEmpty()) box.setFromObject(this.sessionRoot, true);
    const center = box.getCenter(new THREE.Vector3());
    this.sessionRoot.position.x -= center.x;
    this.sessionRoot.position.z -= center.z;
    this.recomputeGrounding();
    this.updateBounds({ updateShadowScale: true });
    return { ...this.userPositionXZ };
  }

  ground() {
    if (!this.sessionRoot) return;
    this.userOffset = 0;
    this.recomputeGrounding();
    this.updateBounds({ updateShadowScale: false });
  }

  setUserScale(value) {
    if (!this.userTransformRoot) return;
    this.userScale = value;
    this.userTransformRoot.scale.setScalar(value);
    this.recomputeGrounding();
    this.updateBounds({ updateShadowScale: false });
  }

  setUserOffset(value) {
    if (!this.sessionRoot) return;
    this.userOffset = value;
    this.sessionRoot.position.y = this.groundY + value;
    this.sessionRoot.updateMatrixWorld(true);
    this.updateBounds({ updateShadowScale: false });
  }

  setPositionXZ(value = {}) {
    if (!this.sessionRoot) return null;
    const x = Number.isFinite(Number(value.x)) ? Number(value.x) : 0;
    const z = Number.isFinite(Number(value.z)) ? Number(value.z) : 0;
    this.sessionRoot.position.x = x;
    this.sessionRoot.position.z = z;
    this.userPositionXZ = { x, z };
    this.sessionRoot.updateMatrixWorld(true);
    this.updateBounds({ updateShadowScale: true });
    return { ...this.userPositionXZ };
  }

  applyTransformState(state = {}) {
    if (!this.sessionRoot || !this.userTransformRoot) return null;
    const scale = Number.isFinite(Number(state.userScale ?? state.scale))
      ? Number(state.userScale ?? state.scale)
      : 1;
    const offset = Number.isFinite(Number(state.userOffset ?? state.offset))
      ? Number(state.userOffset ?? state.offset)
      : 0;
    const rotation = state.rotation || {};
    const positionXZ = state.positionXZ || {};

    this.transformTween = null;
    this.userScale = scale;
    this.userOffset = offset;
    this.userTransformRoot.scale.setScalar(scale);
    this.userTransformRoot.rotation.set(
      Number(rotation.x) || 0,
      Number(rotation.y) || 0,
      Number(rotation.z) || 0,
      'XYZ',
    );
    this.sessionRoot.position.x = Number(positionXZ.x) || 0;
    this.sessionRoot.position.z = Number(positionXZ.z) || 0;
    this.userPositionXZ = { x: this.sessionRoot.position.x, z: this.sessionRoot.position.z };
    this.recomputeGrounding();
    this.updateBounds({ updateShadowScale: true });
    return this.getTransformState();
  }

  setTransformState(state = {}) {
    return this.applyTransformState(state);
  }

  getTransformState() {
    return {
      userScale: this.userScale,
      userOffset: this.userOffset,
      rotation: this.getUserRotation(),
      positionXZ: { ...this.userPositionXZ },
    };
  }

  rotate(axis, onComplete) {
    if (!this.userTransformRoot || this.transformTween) return false;
    const axisVector = axis === 'x'
      ? new THREE.Vector3(1, 0, 0)
      : axis === 'y'
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1);
    const delta = new THREE.Quaternion().setFromAxisAngle(axisVector, Math.PI / 2);
    const start = this.userTransformRoot.quaternion.clone();
    const end = start.clone().multiply(delta).normalize();
    this.transformTween = {
      start,
      end,
      startedAt: performance.now(),
      duration: 620,
      onComplete,
    };
    return true;
  }

  prepareAnimationFrame() {
    this.explosion.prepareFrame();
  }

  update(now) {
    this.structure.update(now);
    this.explosion.update(now);
    const tween = this.transformTween;
    if (!tween || !this.userTransformRoot) return;
    const raw = Math.min(1, (now - tween.startedAt) / tween.duration);
    const t = easeInOutCubic(raw);
    this.userTransformRoot.quaternion.slerpQuaternions(tween.start, tween.end, t);
    if (raw >= 1) {
      this.userTransformRoot.quaternion.copy(tween.end);
      this.transformTween = null;
      this.recomputeGrounding();
      this.updateBounds({ updateShadowScale: true });
      tween.onComplete?.();
    }
  }

  getUserRotation() {
    if (!this.userTransformRoot) return { x: 0, y: 0, z: 0 };
    const euler = new THREE.Euler().setFromQuaternion(this.userTransformRoot.quaternion, 'XYZ');
    return { x: euler.x, y: euler.y, z: euler.z };
  }

  resetTransform() {
    if (!this.sessionRoot) return;
    this.userTransformRoot.rotation.set(0, 0, 0);
    this.userTransformRoot.quaternion.identity();
    this.userTransformRoot.scale.setScalar(1);
    this.motionRoot.rotation.set(0, 0, 0);
    this.sessionRoot.position.set(0, 0, 0);
    this.userScale = 1;
    this.userOffset = 0;
    this.userPositionXZ = { x: 0, z: 0 };
    this.transformTween = null;
    this.recomputeGrounding();
    this.updateBounds({ updateShadowScale: true });
  }

  #resolveSide(originalMaterial) {
    const originalSide = originalMaterial?.userData?.pvOriginalSide ?? originalMaterial?.side ?? THREE.FrontSide;
    const diagnosticId = String(originalMaterial?.userData?.pvDiagnosticId ?? '');
    const override = this.materialSideOverrides.get(diagnosticId) || 'auto';

    if (override === 'auto' || override === 'original') return originalSide;
    if (override === 'front') return THREE.FrontSide;
    if (override === 'flip' || override === 'back') return THREE.BackSide;
    if (override === 'double') return THREE.DoubleSide;
    return originalSide;
  }

  #resolveOverrideMaterial(mode, originalMaterial) {
    const variants = this.overrideMaterialVariants[mode];
    if (!variants) return originalMaterial;
    const side = this.#resolveSide(originalMaterial);
    if (side === THREE.DoubleSide) return variants.double;
    if (side === THREE.BackSide) return variants.back;
    return variants.front;
  }

  #disposeVariantMaterials() {
    this.variantMaterialInstances.forEach((material) => material?.dispose?.());
    this.variantMaterialInstances.clear();
  }

  #applyVariantStyle(baseMaterial, style, objectName = 'mesh') {
    if (!baseMaterial || !style || !Object.keys(style).length) return baseMaterial;
    const material = baseMaterial.clone();
    material.name = `${baseMaterial.name || 'Material'} · ${objectName} variant`;
    if (style.color && material.color?.set) material.color.set(style.color);
    if ('roughness' in style && 'roughness' in material) material.roughness = style.roughness;
    if ('metalness' in style && 'metalness' in material) material.metalness = style.metalness;
    if ('clearcoat' in style && 'clearcoat' in material) material.clearcoat = style.clearcoat;
    material.needsUpdate = true;
    this.variantMaterialInstances.add(material);
    return material;
  }

  applyMaterialPresentation() {
    if (!this.sessionRoot) return;
    this.#disposeVariantMaterials();
    this.sessionRoot.traverse((object) => {
      if (!object.isMesh) return;
      const original = object.userData.__pvOriginalMaterial;
      if (!original) return;

      const partId = object.userData.__pvStructureId || null;
      const variantStyle = partId ? this.variantAppearanceByMesh[partId] : null;
      if (this.materialMode === 'original') {
        object.material = mapMaterials(original, (material) => {
          material.side = this.#resolveSide(material);
          material.needsUpdate = true;
          return this.#applyVariantStyle(material, variantStyle, object.name || partId || 'mesh');
        });
      } else {
        object.material = mapMaterials(original, (material) => {
          const base = this.#resolveOverrideMaterial(this.materialMode, material);
          return this.#applyVariantStyle(base, variantStyle, object.name || partId || 'mesh');
        });
      }
    });
  }

  setMaterialMode(mode) {
    if (!this.overrideMaterialVariants[mode] && mode !== 'original') return false;
    this.materialMode = mode;
    this.applyMaterialPresentation();
    return true;
  }

  setBackfaceRepairEnabled(enabled) {
    const next = Boolean(enabled);
    if (next) {
      this.materialDiagnostics.materials.forEach((item) => {
        const id = String(item.id);
        if (!item.safeBackfaceCandidate || this.materialSideOverrides.has(id)) return;
        this.materialSideOverrides.set(id, 'double');
        this.suggestedSideOverrideIds.add(id);
      });
    } else {
      this.suggestedSideOverrideIds.forEach((id) => {
        if (this.materialSideOverrides.get(id) === 'double') this.materialSideOverrides.delete(id);
      });
      this.suggestedSideOverrideIds.clear();
    }
    this.backfaceRepairEnabled = next;
    this.applyMaterialPresentation();
    return this.backfaceRepairEnabled;
  }

  setMaterialSideOverride(materialId, mode) {
    const id = String(materialId);
    const normalizedMode = mode === 'back' ? 'flip' : mode === 'original' ? 'auto' : mode;
    const allowed = new Set(['auto', 'front', 'flip', 'double']);
    if (!allowed.has(normalizedMode)) return false;
    const diagnostic = this.materialDiagnostics.materials.find((item) => String(item.id) === id);
    if (!diagnostic) return false;
    this.suggestedSideOverrideIds.delete(id);
    if (normalizedMode === 'auto') {
      // Auto is an explicit, portable user choice: it preserves the imported
      // glTF side policy and remains an opt-out if suggestions are re-enabled.
      this.materialSideOverrides.set(id, 'auto');
    } else this.materialSideOverrides.set(id, normalizedMode);
    this.applyMaterialPresentation();
    return true;
  }

  setMaterialSideOverrides(overrides = {}, { suggestedIds = [] } = {}) {
    this.materialSideOverrides.clear();
    this.suggestedSideOverrideIds.clear();
    Object.entries(overrides).forEach(([id, mode]) => {
      const normalizedMode = mode === 'back' ? 'flip' : mode === 'original' ? 'auto' : mode;
      if (['auto', 'front', 'flip', 'double'].includes(normalizedMode)) this.materialSideOverrides.set(String(id), normalizedMode);
    });
    const restoredSuggestions = new Set(
      (Array.isArray(suggestedIds) ? suggestedIds : [])
        .map((id) => String(id).replace(/[^0-9]/g, '').slice(0, 8))
        .filter(Boolean),
    );
    this.materialDiagnostics.materials.forEach((item) => {
      const id = String(item.id);
      if (item.safeBackfaceCandidate
        && this.materialSideOverrides.get(id) === 'double'
        && restoredSuggestions.has(id)) {
        this.suggestedSideOverrideIds.add(id);
      }
    });
    if (this.backfaceRepairEnabled) {
      this.materialDiagnostics.materials.forEach((item) => {
        const id = String(item.id);
        if (!item.safeBackfaceCandidate || this.materialSideOverrides.has(id)) return;
        this.materialSideOverrides.set(id, 'double');
        this.suggestedSideOverrideIds.add(id);
      });
    }
    this.applyMaterialPresentation();
    return this.getMaterialSideOverrides();
  }

  clearMaterialSideOverrides() {
    this.materialSideOverrides.clear();
    this.suggestedSideOverrideIds.clear();
    this.backfaceRepairEnabled = false;
    this.applyMaterialPresentation();
  }

  getMaterialSideOverrides() {
    return Object.fromEntries([...this.materialSideOverrides.entries()].sort(([a], [b]) => Number(a) - Number(b)));
  }

  getSuggestedMaterialSideOverrideIds() {
    return [...this.suggestedSideOverrideIds].sort((a, b) => Number(a) - Number(b));
  }

  getMaterialDiagnostics() {
    const materialById = new Map();
    this.assetRoot?.traverse((object) => {
      if (!object.isMesh) return;
      forEachMaterial(object.userData.__pvOriginalMaterial || object.material, (material) => {
        const id = String(material?.userData?.pvDiagnosticId ?? '');
        if (id && !materialById.has(id)) materialById.set(id, material);
      });
    });

    const materials = this.materialDiagnostics.materials.map((item) => {
      const id = String(item.id);
      const material = materialById.get(id);
      const sideOverride = this.materialSideOverrides.get(id) || 'auto';
      const effectiveSide = material ? materialSideName(this.#resolveSide(material)) : item.originalSide;
      return {
        ...item,
        sideOverride,
        effectiveSide,
        repairActive: effectiveSide !== item.originalSide,
        suggestedRepair: this.suggestedSideOverrideIds.has(id),
      };
    });

    return {
      ...this.materialDiagnostics,
      materials,
      backfaceRepairEnabled: this.backfaceRepairEnabled,
      manualOverrides: Math.max(0, this.materialSideOverrides.size - this.suggestedSideOverrideIds.size),
      totalOverrides: this.materialSideOverrides.size,
      suggestedOverrides: this.suggestedSideOverrideIds.size,
      materialSideOverrides: this.getMaterialSideOverrides(),
    };
  }

  getStructureReport(query = '') {
    return this.structure.getReport(query);
  }

  getStructureState() {
    return {
      ...this.structure.getState(),
      ...this.variants.getState(),
      ...this.explosion.getState(),
    };
  }

  applyStructureState(state = {}) {
    this.structure.applyState(state);
    this.variants.applyState(state);
    this.explosion.applyState(state, { notify: false, immediate: true });
    this.updateBounds({ updateShadowScale: true });
    return this.getStructureState();
  }

  resetStructure() {
    this.structure.reset();
    return this.getStructureState();
  }

  getVariantReport() {
    return this.variants.getReport();
  }

  createVariantGroup(name, options) {
    return this.variants.createGroup(name, options);
  }

  deleteVariantGroup(id) {
    return this.variants.deleteGroup(id);
  }

  setVariantGroupRequired(id, required) {
    return this.variants.setGroupRequired(id, required);
  }

  createVariantOption(groupId, option) {
    return this.variants.createOption(groupId, option);
  }

  deleteVariantOption(groupId, optionId) {
    return this.variants.deleteOption(groupId, optionId);
  }

  setVariantDefaultOption(groupId, optionId) {
    return this.variants.setDefaultOption(groupId, optionId);
  }

  activateVariantOption(groupId, optionId) {
    return this.variants.activateOption(groupId, optionId);
  }

  clearVariantSelection(groupId) {
    return this.variants.clearSelection(groupId);
  }

  resetVariantSelections() {
    return this.variants.resetSelectionsToDefaults();
  }

  setVariantSelections(selections = {}, options = {}) {
    return this.variants.setSelections(selections, options);
  }

  captureVariantConfiguration(name) {
    return this.variants.captureConfiguration(name);
  }

  applyVariantConfiguration(id) {
    return this.variants.applyConfiguration(id);
  }

  deleteVariantConfiguration(id) {
    return this.variants.deleteConfiguration(id);
  }

  getExplosionReport() {
    return this.explosion.getReport();
  }

  setPartExplosionDistance(partId, distance, direction = 'auto') {
    const changed = this.explosion.setPartDistance(partId, distance, direction);
    if (changed) this.updateBounds({ updateShadowScale: true });
    return changed;
  }

  clearPartExplosion(partId) {
    const changed = this.explosion.clearPart(partId);
    if (changed) this.updateBounds({ updateShadowScale: true });
    return changed;
  }

  clearExplosion({ duration = 0, easing = 'cinematic' } = {}) {
    this.explosion.clearOffsets({ duration, easing });
    if (duration <= 0) this.updateBounds({ updateShadowScale: true });
  }

  captureExplodedState(name) {
    return this.explosion.captureState(name);
  }

  applyExplodedState(id, options = {}) {
    return this.explosion.applyExplodedState(id, options);
  }

  deleteExplodedState(id) {
    return this.explosion.deleteState(id);
  }

  resetExplosion({ clearLibrary = true } = {}) {
    this.explosion.reset({ clearLibrary });
    this.updateBounds({ updateShadowScale: true });
    return this.explosion.getState();
  }

  pauseExplosionTransition(options = {}) {
    return this.explosion.pauseTransition(options);
  }

  resumeExplosionTransition(options = {}) {
    return this.explosion.resumeTransition(options);
  }

  stopExplosionTransition(options = {}) {
    return this.explosion.stopTransition(options);
  }

  isExplosionDynamic() {
    return this.explosion.isDynamic();
  }

  selectPart(id) {
    return this.structure.selectPart(id);
  }

  togglePartVisibility(id) {
    return this.structure.togglePartVisibility(id);
  }

  setPartVisibility(id, visible) {
    return this.structure.setPartVisibility(id, visible);
  }

  applyPartVisibilityPatch(patch = {}) {
    return this.structure.applyVisibilityPatch(patch);
  }

  setPartVisibilityOverrides(overrides = {}) {
    return this.structure.setVisibilityOverrides(overrides);
  }

  isolatePart(id) {
    return this.structure.isolatePart(id);
  }

  showAllParts() {
    this.structure.showAllParts();
  }

  resetPartVisibility() {
    this.structure.resetVisibility();
  }

  captureVisibilityState(name) {
    return this.structure.captureVisibilityState(name);
  }

  applyVisibilityState(id) {
    return this.structure.applyVisibilityState(id);
  }

  deleteVisibilityState(id) {
    return this.structure.deleteVisibilityState(id);
  }

  createAnchorAtPart(partId, name) {
    return this.structure.createAnchorAtPart(partId, name);
  }

  createAnchorAtWorld(worldPosition, name) {
    return this.structure.createAnchorAtWorld(worldPosition, name);
  }

  deleteAnchor(id) {
    return this.structure.deleteAnchor(id);
  }

  selectAnchor(id) {
    return this.structure.selectAnchor(id);
  }

  setAnchorDisplay(mode) {
    return this.structure.setAnchorDisplay(mode);
  }

  getAnchorMarkers() {
    return this.structure.getAnchorMarkers();
  }

  getAnchorWorldPosition(id) {
    return this.structure.getAnchorWorldPosition(id);
  }

  setStructureHelpersVisible(enabled) {
    this.structure.setSelectionHelperVisible(enabled);
  }

  dispose() {
    this.disposeCurrent();
    this.variants.detach();
    this.#disposeVariantMaterials();
    this.structure.dispose();
    Object.values(this.overrideMaterialVariants).forEach((variants) => {
      Object.values(variants).forEach((material) => material.dispose());
    });
  }

  setShadowsEnabled(enabled) {
    this.shadowsEnabled = Boolean(enabled);
    this.sessionRoot?.traverse((object) => {
      if (object.isMesh) object.castShadow = this.shadowsEnabled;
    });
  }

  hasTransformTween() {
    return Boolean(this.transformTween);
  }

  isDynamic() {
    return Boolean(this.transformTween || this.explosion.isDynamic());
  }
}
