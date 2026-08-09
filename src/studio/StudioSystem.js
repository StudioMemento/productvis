import * as THREE from 'three';
import { easeInOutCubic } from '../utils/math.js';
import { EnvironmentManager } from './EnvironmentManager.js';
import { BackdropManager } from './BackdropManager.js';
import { LightRig } from './LightRig.js';
import { GroundSystem } from './GroundSystem.js';

/**
 * Studio orchestration.
 *
 * Environment / IBL  -> material reflections and ambient illumination
 * Backdrop            -> visible white-to-black field
 * Ground              -> Y=0 contract and geometry-aware contact shadow
 * Light rig           -> restrained neutral edge definition
 *
 * V1.4 keeps backdrop and lighting presets as independent tween channels so a
 * simple background choice can never overwrite the selected light character.
 */
export class StudioSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.renderer = engine.renderer;

    this.environment = null;
    this.backdrop = null;
    this.lightRig = null;
    this.ground = null;
    this.environmentTexture = null;
    this.backdropTween = null;
    this.lightingTween = null;
    this.floorEnabled = true;
    this.shadowsEnabled = true;
  }

  initialize() {
    this.environment = new EnvironmentManager(this.renderer, this.scene).initialize();
    this.environmentTexture = this.environment.texture;
    this.backdrop = new BackdropManager(this.scene).initialize(0.48);
    this.lightRig = new LightRig(this.scene).initialize();
    this.ground = new GroundSystem(this.renderer, this.scene).initialize();

    // Contact shadows are rendered into a cached texture. Native directional
    // shadow maps remain disabled so the two systems cannot double up.
    this.engine.setShadowEnabled(false);
    this.engine.setBloomStrength(0);
    return this;
  }

  applyBackdropPreset(preset, { immediate = false } = {}) {
    const targetTone = Number(preset?.backdropTone);
    if (!Number.isFinite(targetTone)) return false;

    if (immediate) {
      this.backdrop.setTone(targetTone);
      this.backdropTween = null;
      return true;
    }

    this.backdropTween = {
      from: this.backdrop.getTone(),
      to: targetTone,
      startedAt: performance.now(),
      duration: 520,
    };
    return true;
  }

  applyLightingPreset(preset, { immediate = false } = {}) {
    if (!preset) return false;
    const target = {
      exposure: preset.exposure,
      environment: preset.environment,
      environmentRotation: preset.environmentRotation ?? this.environment.rotation,
      key: preset.key,
      fill: preset.fill,
      rim: preset.rim,
      bloom: preset.bloom,
      shadow: preset.shadow,
      shadowSoftness: preset.shadowSoftness,
    };

    if (immediate) {
      this.#applyLighting(target);
      this.lightingTween = null;
      return true;
    }

    this.lightingTween = {
      from: this.getCurrentLighting(),
      to: target,
      startedAt: performance.now(),
      duration: 720,
    };
    return true;
  }

  // Stable compatibility method for V1.2 / V1.3 callers.
  applyPreset(preset, options = {}) {
    this.applyBackdropPreset(preset, options);
    this.applyLightingPreset(preset, options);
  }

  cancelBackdropTween() {
    this.backdropTween = null;
  }

  cancelLightingTween() {
    this.lightingTween = null;
  }

  cancelPresetTween() {
    this.cancelBackdropTween();
    this.cancelLightingTween();
  }

  getCurrentLighting() {
    const lights = this.lightRig.getCurrent();
    return {
      exposure: this.renderer.toneMappingExposure,
      environment: this.environment.intensity,
      environmentRotation: this.environment.rotation,
      key: lights.key,
      fill: lights.fill,
      rim: lights.rim,
      bloom: this.engine.bloomPass.strength,
      shadow: this.ground.contactShadow.opacity,
      shadowSoftness: this.ground.contactShadow.softness,
    };
  }

  getCurrentLook() {
    return {
      backdropTone: this.backdrop.getTone(),
      ...this.getCurrentLighting(),
    };
  }

  update(now, { dynamic = false } = {}) {
    if (this.backdropTween) {
      const tween = this.backdropTween;
      const raw = Math.min(1, (now - tween.startedAt) / tween.duration);
      const t = easeInOutCubic(raw);
      this.backdrop.setTone(THREE.MathUtils.lerp(tween.from, tween.to, t));
      if (raw >= 1) this.backdropTween = null;
    }

    if (this.lightingTween) {
      const tween = this.lightingTween;
      const raw = Math.min(1, (now - tween.startedAt) / tween.duration);
      const t = easeInOutCubic(raw);
      const { from, to } = tween;
      this.#applyLighting({
        exposure: THREE.MathUtils.lerp(from.exposure, to.exposure, t),
        environment: THREE.MathUtils.lerp(from.environment, to.environment, t),
        environmentRotation: THREE.MathUtils.lerp(from.environmentRotation, to.environmentRotation, t),
        key: THREE.MathUtils.lerp(from.key, to.key, t),
        fill: THREE.MathUtils.lerp(from.fill, to.fill, t),
        rim: THREE.MathUtils.lerp(from.rim, to.rim, t),
        bloom: THREE.MathUtils.lerp(from.bloom, to.bloom, t),
        shadow: THREE.MathUtils.lerp(from.shadow, to.shadow, t),
        shadowSoftness: THREE.MathUtils.lerp(from.shadowSoftness, to.shadowSoftness, t),
      });
      if (raw >= 1) this.lightingTween = null;
    }

    this.ground.update({ dynamic, now });
  }

  #applyLighting(look) {
    this.engine.setExposure(look.exposure);
    this.environment.setIntensity(look.environment);
    this.environment.setRotation(look.environmentRotation);
    this.lightRig.setKeyIntensity(look.key);
    this.lightRig.setFillIntensity(look.fill);
    this.lightRig.setRimIntensity(look.rim);
    this.engine.setBloomStrength(look.bloom);
    this.ground.setOpacity(look.shadow);
    this.ground.setSoftness(look.shadowSoftness);
  }

  setBackdropTone(value) {
    this.backdrop.setTone(value);
  }

  setExposure(value) {
    this.engine.setExposure(value);
  }

  setEnvironmentIntensity(value) {
    this.environment.setIntensity(value);
  }

  setEnvironmentRotation(value) {
    this.environment.setRotation(value);
  }

  setKeyIntensity(value) {
    this.lightRig.setKeyIntensity(value);
  }

  setFillIntensity(value) {
    this.lightRig.setFillIntensity(value);
  }

  setRimIntensity(value) {
    this.lightRig.setRimIntensity(value);
  }

  setGroundOffset(value) {
    this.ground.setGroundOffset(value);
  }

  setShadowOpacity(value) {
    this.ground.setOpacity(value);
  }

  setShadowSoftness(value) {
    this.ground.setSoftness(value);
  }

  setBloom(value) {
    this.engine.setBloomStrength(value);
  }

  setFloorEnabled(enabled) {
    this.floorEnabled = Boolean(enabled);
    this.ground.setEnabled(this.floorEnabled);
  }

  setShadowsEnabled(enabled) {
    this.shadowsEnabled = Boolean(enabled);
    this.ground.setShadowsEnabled(this.shadowsEnabled);
  }

  setShadowQuality(profile) {
    this.ground.setQuality(profile);
  }

  updateForBounds(bounds, radius) {
    if (!bounds || bounds.isEmpty()) return;
    this.lightRig.updateForBounds(bounds);
    this.ground.updateForBounds(bounds, radius);
  }

  markContactShadowDirty() {
    this.ground.markDirty();
  }

  renderContactShadow({ force = true } = {}) {
    return this.ground.update({ force, now: performance.now() });
  }

  // Stable no-op for legacy camera-following backdrop callers.
  updateCameraPosition() {}

  dispose() {
    this.ground?.dispose();
    this.lightRig?.dispose();
    this.environment?.dispose();
    this.scene.background = null;
  }
}
