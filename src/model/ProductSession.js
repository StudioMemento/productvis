import * as THREE from 'three';
import { forEachMaterial } from '../utils/materials.js';
import { easeInOutCubic } from '../utils/math.js';

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
    this.groundY = 0;
    this.modelRadius = 1.8;
    this.modelHeight = 3;
    this.modelBounds = new THREE.Box3();
    this.shadowsEnabled = true;
    this.materialMode = 'original';
    this.transformTween = null;

    this.protectedMaterials = new Set();
    this.overrideMaterials = {
      clay: new THREE.MeshPhysicalMaterial({
        name: 'PV Clay',
        color: 0xd9d4cb,
        roughness: 0.57,
        metalness: 0.04,
        clearcoat: 0.12,
        clearcoatRoughness: 0.5,
      }),
      chrome: new THREE.MeshPhysicalMaterial({
        name: 'PV Chrome',
        color: 0xc7cdd2,
        roughness: 0.16,
        metalness: 1,
        clearcoat: 0.4,
        clearcoatRoughness: 0.12,
      }),
      matte: new THREE.MeshPhysicalMaterial({
        name: 'PV Matte',
        color: 0x17191d,
        roughness: 0.93,
        metalness: 0.02,
        clearcoat: 0.02,
      }),
    };
    Object.values(this.overrideMaterials).forEach((material) => this.protectedMaterials.add(material));
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
    this.materialMode = 'original';
    this.transformTween = null;

    this.scene.add(this.sessionRoot);
    this.sessionRoot.updateMatrixWorld(true);
    this.recomputeGrounding();
    this.updateBounds({ updateShadowScale: true });
    this.setMaterialMode('original');

    return {
      stats: this.collectStats(),
      metrics: this.getMetrics(),
      asset: this.assetRoot,
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
      object.frustumCulled = true;
      object.userData.__pvOriginalMaterial = object.material;

      forEachMaterial(object.material, (material) => {
        material.needsUpdate = true;
        Object.values(material).forEach((value) => {
          if (value?.isTexture) value.anisotropy = maxAnisotropy;
        });
      });
    });

    if (meshCount === 0) throw new Error('No mesh geometry was found in this GLB.');

    asset.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(asset);
    if (box.isEmpty()) throw new Error('The model bounds are empty.');

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
      throw new Error('The model has invalid dimensions.');
    }

    const normalizedSize = 3.15;
    const scale = normalizedSize / maxDimension;
    return { box, center, scale };
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

  updateBounds({ updateShadowScale = true } = {}) {
    if (!this.sessionRoot) return null;
    this.sessionRoot.updateMatrixWorld(true);
    this.modelBounds.setFromObject(this.sessionRoot);
    const size = this.modelBounds.getSize(new THREE.Vector3());
    const sphere = this.modelBounds.getBoundingSphere(new THREE.Sphere());
    this.modelRadius = Math.max(sphere.radius, 0.4);
    this.modelHeight = Math.max(size.y, 0.5);

    const metrics = this.getMetrics();
    this.onBoundsChanged?.(metrics, { updateShadowScale });
    return metrics;
  }

  getMetrics() {
    return {
      root: this.sessionRoot,
      bounds: this.modelBounds,
      radius: this.modelRadius,
      height: this.modelHeight,
    };
  }

  recomputeGrounding() {
    if (!this.sessionRoot) return;
    this.sessionRoot.position.y = 0;
    this.sessionRoot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.sessionRoot);
    this.groundY = -box.min.y;
    this.sessionRoot.position.y = this.groundY + this.userOffset;
    this.sessionRoot.updateMatrixWorld(true);
  }

  center() {
    if (!this.sessionRoot) return;
    this.sessionRoot.position.x = 0;
    this.sessionRoot.position.z = 0;
    this.sessionRoot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.sessionRoot);
    const center = box.getCenter(new THREE.Vector3());
    this.sessionRoot.position.x -= center.x;
    this.sessionRoot.position.z -= center.z;
    this.recomputeGrounding();
    this.updateBounds({ updateShadowScale: true });
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

  update(now) {
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

  resetTransform() {
    if (!this.sessionRoot) return;
    this.userTransformRoot.rotation.set(0, 0, 0);
    this.userTransformRoot.quaternion.identity();
    this.userTransformRoot.scale.setScalar(1);
    this.motionRoot.rotation.set(0, 0, 0);
    this.sessionRoot.position.set(0, 0, 0);
    this.userScale = 1;
    this.userOffset = 0;
    this.transformTween = null;
    this.recomputeGrounding();
    this.updateBounds({ updateShadowScale: true });
  }

  setMaterialMode(mode) {
    if (!this.overrideMaterials[mode] && mode !== 'original') return false;
    this.materialMode = mode;

    this.sessionRoot?.traverse((object) => {
      if (!object.isMesh) return;
      const original = object.userData.__pvOriginalMaterial;
      if (!original) return;
      object.material = mode === 'original' ? original : this.overrideMaterials[mode];
      forEachMaterial(object.material, (material) => {
        material.needsUpdate = true;
      });
    });
    return true;
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
}
