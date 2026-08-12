import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA_PRESETS, DEFAULT_CAMERA_TARGET } from '../config/presets.js';
import { easeOutQuint } from '../utils/math.js';
import {
  computeClipRange,
  computeFitDistanceToBounds,
  isFiniteBox3,
  resolveFramingMetrics,
} from './CameraFraming.js';

function cloneTarget(target = DEFAULT_CAMERA_TARGET) {
  return {
    x: Number(target.x) || 0,
    y: Number.isFinite(Number(target.y)) ? Number(target.y) : DEFAULT_CAMERA_TARGET.y,
    z: Number(target.z) || 0,
  };
}

function transitionEase(name, value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  if (name === 'linear') return t;
  if (name === 'ease-in-out') return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
  if (name === 'cinematic') return t * t * t * (t * (6 * t - 15) + 10);
  return easeOutQuint(t);
}

export class CameraRig {
  constructor(engine, getModelMetrics, { onTargetChange } = {}) {
    this.engine = engine;
    this.camera = engine.camera;
    this.canvas = engine.canvas;
    this.getModelMetrics = getModelMetrics;
    this.onTargetChange = onTargetChange;
    this.controls = null;
    this.tween = null;
    this.currentPreset = 'hero';
    this.mode = 'presentation';
    this.horizonLocked = true;
    this.interactionEnabled = true;
    this.targetNormalized = cloneTarget();
    this.safety = {
      minDistance: 0.3,
      maxDistance: 18,
      near: this.camera.near,
      far: this.camera.far,
      insideModel: false,
      clampedToGround: false,
      targetClamped: false,
      boundsValid: false,
      boundsSource: 'uninitialized',
      rejectedPreset: null,
    };
  }

  initialize() {
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.62;
    this.controls.zoomSpeed = 0.78;
    this.controls.panSpeed = 0.55;
    this.controls.screenSpacePanning = true;
    this.controls.target.set(0, 1.2, 0);
    this.#applyOrbitEnvelope();
    this.controls.update();
    this.controls.addEventListener('start', () => {
      this.tween = null;
    });
    this.controls.addEventListener('end', () => {
      this.currentPreset = null;
      this.targetNormalized = this.getTargetNormalized();
      this.onTargetChange?.({
        preset: null,
        target: cloneTarget(this.targetNormalized),
        source: 'orbit',
      });
    });
    return this;
  }

  setPreset(name, { immediate = false } = {}) {
    const preset = CAMERA_PRESETS[name];
    const metrics = this.#readMetrics({ refresh: true, rejectedPreset: name });
    if (!preset || !metrics) return false;

    const normalizedTarget = cloneTarget(preset.target || { x: 0, y: preset.targetY, z: 0 });
    const target = this.#targetFromNormalized(normalizedTarget, metrics.bounds);
    const direction = new THREE.Vector3(...preset.direction).normalize();
    this.updateLimits(metrics.radius, metrics.bounds);
    const baseDistance = computeFitDistanceToBounds(this.camera, metrics.bounds, target, direction, {
      padding: preset.padding || 1.07,
      minDistance: this.safety.minDistance,
    });
    if (!Number.isFinite(baseDistance)) {
      this.safety.boundsValid = false;
      this.safety.rejectedPreset = name;
      return false;
    }
    const distance = THREE.MathUtils.clamp(
      baseDistance * (Number(preset.distance) || 1),
      this.safety.minDistance,
      this.safety.maxDistance,
    );
    const position = target.clone().add(direction.clone().multiplyScalar(distance));
    if (![position.x, position.y, position.z, target.x, target.y, target.z].every(Number.isFinite)) {
      this.safety.boundsValid = false;
      this.safety.rejectedPreset = name;
      return false;
    }

    this.currentPreset = name;
    this.targetNormalized = normalizedTarget;
    this.safety.rejectedPreset = null;
    this.tweenTo(position, target, immediate ? 1 : 820, { normalizedTarget });
    return true;
  }

  fit({ immediate = false } = {}) {
    const metrics = this.#readMetrics({ refresh: true, rejectedPreset: 'fit' });
    if (!metrics) return false;
    const normalizedTarget = { x: 0, y: 0.48, z: 0 };
    const target = this.#targetFromNormalized(normalizedTarget, metrics.bounds);
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    if (!Number.isFinite(direction.x) || direction.lengthSq() < 0.001) {
      direction.set(1, 0.35, 1.5).normalize();
    }
    this.updateLimits(metrics.radius, metrics.bounds);
    const desiredDistance = computeFitDistanceToBounds(this.camera, metrics.bounds, target, direction, {
      padding: 1.07,
      minDistance: this.safety.minDistance,
    });
    if (!Number.isFinite(desiredDistance)) {
      this.safety.boundsValid = false;
      this.safety.rejectedPreset = 'fit';
      return false;
    }
    const position = target.clone().add(direction.clone().multiplyScalar(
      THREE.MathUtils.clamp(desiredDistance, this.safety.minDistance, this.safety.maxDistance),
    ));
    this.currentPreset = null;
    this.targetNormalized = normalizedTarget;
    this.safety.rejectedPreset = null;
    this.tweenTo(position, target, immediate ? 1 : 650, { normalizedTarget });
    return true;
  }

  computeFitDistance(radius) {
    const safeRadius = Math.max(radius, 0.45);
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.camera.aspect);
    const limitingFov = Math.min(verticalFov, horizontalFov);
    return (safeRadius / Math.sin(Math.max(0.12, limitingFov / 2))) * 1.04;
  }

  #readMetrics({ refresh = false, rejectedPreset = null } = {}) {
    const raw = this.getModelMetrics?.({ refresh });
    const metrics = resolveFramingMetrics(raw);
    if (!metrics) {
      this.safety.boundsValid = false;
      this.safety.boundsSource = raw?.framingSource || 'invalid';
      if (rejectedPreset) this.safety.rejectedPreset = rejectedPreset;
      return null;
    }
    this.safety.boundsValid = true;
    this.safety.boundsSource = metrics.boundsSource || 'full';
    return metrics;
  }

  updateLimits(radius, bounds) {
    if (!this.controls || !isFiniteBox3(bounds)) {
      this.safety.boundsValid = false;
      return false;
    }
    const safeRadius = Math.max(radius, 0.4);
    const size = bounds.getSize(new THREE.Vector3());
    const minDistance = this.mode === 'inspect'
      ? Math.max(0.14, safeRadius * 0.18, size.length() * 0.04)
      : Math.max(0.48, safeRadius * 0.62, size.length() * 0.14);
    const maxDistance = Math.max(18, safeRadius * 12);
    this.safety.minDistance = minDistance;
    this.safety.maxDistance = maxDistance;
    this.controls.minDistance = minDistance;
    this.controls.maxDistance = maxDistance;
    this.#applyOrbitEnvelope();

    // The normalized target is the state contract. When product bounds change
    // after scale, offset, centering, rotation or an exploded transition, keep
    // the active camera path attached to the product instead of jumping the
    // current frame. Story pose tweens carry a normalized endpoint so their
    // final distance can expand with the changing product radius.
    if (bounds && this.controls) {
      const normalizedTarget = this.tween?.normalizedTarget || this.targetNormalized;
      const nextTarget = this.#targetFromNormalized(normalizedTarget, bounds);
      if (this.tween) {
        if (this.tween.poseDirection && Number.isFinite(this.tween.distanceFactor)) {
          const finalDistance = THREE.MathUtils.clamp(
            this.tween.distanceFactor * safeRadius,
            this.safety.minDistance,
            this.safety.maxDistance,
          );
          this.tween.toTarget.copy(nextTarget);
          this.tween.toPosition.copy(nextTarget).add(
            this.tween.poseDirection.clone().multiplyScalar(finalDistance),
          );
        } else {
          const delta = nextTarget.clone().sub(this.tween.toTarget);
          this.tween.toTarget.add(delta);
          this.tween.toPosition.add(delta);
        }
      } else {
        const delta = nextTarget.clone().sub(this.controls.target);
        this.controls.target.copy(nextTarget);
        this.camera.position.add(delta);
        this.controls.update();
      }
    }

    this.enforceSafety();
    this.updateClipping();
    return true;
  }

  tweenTo(position, target, duration, {
    easing = 'ease-out',
    focalLength = null,
    up = null,
    preset = this.currentPreset,
    normalizedTarget = null,
    poseDirection = null,
    distanceFactor = null,
  } = {}) {
    const safeDuration = Math.max(1, Number(duration) || 1);
    this.currentPreset = preset;
    this.tween = {
      fromPosition: this.camera.position.clone(),
      toPosition: position.clone(),
      fromTarget: this.controls.target.clone(),
      toTarget: target.clone(),
      fromFocalLength: this.camera.getFocalLength(),
      toFocalLength: Number.isFinite(Number(focalLength)) ? Number(focalLength) : this.camera.getFocalLength(),
      fromUp: this.camera.up.clone(),
      toUp: up?.isVector3 ? up.clone().normalize() : this.camera.up.clone(),
      startedAt: performance.now(),
      duration: safeDuration,
      easing,
      pausedAt: 0,
      normalizedTarget: normalizedTarget ? cloneTarget(normalizedTarget) : null,
      poseDirection: poseDirection?.isVector3 ? poseDirection.clone().normalize() : null,
      distanceFactor: Number.isFinite(Number(distanceFactor)) ? Number(distanceFactor) : null,
    };
  }

  updateTween(now) {
    const tween = this.tween;
    if (!tween || tween.pausedAt) return;
    const raw = Math.min(1, (now - tween.startedAt) / tween.duration);
    const t = transitionEase(tween.easing, raw);
    this.camera.position.copy(tween.fromPosition).lerp(tween.toPosition, t);
    this.controls.target.copy(tween.fromTarget).lerp(tween.toTarget, t);
    this.camera.up.copy(tween.fromUp).lerp(tween.toUp, t).normalize();
    this.camera.setFocalLength(THREE.MathUtils.lerp(tween.fromFocalLength, tween.toFocalLength, t));
    this.controls.update();
    if (raw >= 1) {
      this.controls.target.copy(tween.toTarget);
      this.camera.position.copy(tween.toPosition);
      this.camera.up.copy(tween.toUp);
      this.camera.setFocalLength(tween.toFocalLength);
      this.controls.update();
      this.targetNormalized = this.getTargetNormalized();
      this.tween = null;
    }
  }

  updateControls(delta) {
    this.controls.update(delta);
    this.enforceSafety();
    this.updateClipping();
  }

  setFocalLength(value) {
    const focal = THREE.MathUtils.clamp(Number(value) || 50, 18, 160);
    this.camera.setFocalLength(focal);
    this.updateClipping();
    return focal;
  }

  setDamping(value) {
    const damping = THREE.MathUtils.clamp(Number(value) || 0.08, 0.01, 0.3);
    this.controls.dampingFactor = damping;
    return damping;
  }

  setAutoRotate(enabled) {
    this.controls.autoRotate = Boolean(enabled);
    this.controls.autoRotateSpeed = 0.42;
  }

  setInteractionEnabled(enabled) {
    this.interactionEnabled = Boolean(enabled);
    if (this.controls) this.controls.enabled = this.interactionEnabled;
    return this.interactionEnabled;
  }

  setHorizonLocked(enabled) {
    this.horizonLocked = Boolean(enabled);
    this.#applyOrbitEnvelope();
  }

  setInspectMode(enabled) {
    this.mode = enabled ? 'inspect' : 'presentation';
    this.#applyOrbitEnvelope();
    const metrics = this.#readMetrics();
    if (metrics) this.updateLimits(metrics.radius, metrics.bounds);
    this.enforceSafety();
    this.updateClipping();
    return this.mode;
  }

  setTargetNormalized(nextTarget, { notify = false } = {}) {
    const metrics = this.#readMetrics();
    if (!metrics) return null;
    const target = {
      x: THREE.MathUtils.clamp(Number(nextTarget?.x) || 0, -1, 1),
      y: THREE.MathUtils.clamp(Number(nextTarget?.y), 0, 1),
      z: THREE.MathUtils.clamp(Number(nextTarget?.z) || 0, -1, 1),
    };
    if (!Number.isFinite(target.y)) target.y = DEFAULT_CAMERA_TARGET.y;
    this.targetNormalized = target;
    this.currentPreset = null;
    this.tween = null;
    this.controls.target.copy(this.#targetFromNormalized(target, metrics.bounds));
    this.enforceSafety();
    this.updateClipping();
    this.targetNormalized = this.getTargetNormalized();
    if (notify) {
      this.onTargetChange?.({
        preset: null,
        target: cloneTarget(this.targetNormalized),
        source: 'control',
      });
    }
    return cloneTarget(this.targetNormalized);
  }

  setTargetAxis(axis, value, options = {}) {
    if (!['x', 'y', 'z'].includes(axis)) return null;
    return this.setTargetNormalized({ ...this.getTargetNormalized(), [axis]: value }, options);
  }

  getTargetWorld() {
    return this.controls?.target?.clone?.() || null;
  }

  worldPointToNormalized(worldPoint) {
    const metrics = this.#readMetrics();
    if (!metrics || !worldPoint) return null;
    const point = worldPoint.isVector3
      ? worldPoint
      : new THREE.Vector3(Number(worldPoint[0]) || 0, Number(worldPoint[1]) || 0, Number(worldPoint[2]) || 0);
    const bounds = metrics.bounds;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    return {
      x: THREE.MathUtils.clamp((point.x - center.x) / Math.max(size.x * 0.5, 0.0001), -1, 1),
      y: THREE.MathUtils.clamp((point.y - bounds.min.y) / Math.max(size.y, 0.0001), 0, 1),
      z: THREE.MathUtils.clamp((point.z - center.z) / Math.max(size.z * 0.5, 0.0001), -1, 1),
    };
  }

  setTargetWorld(worldPoint, { notify = true } = {}) {
    const normalized = this.worldPointToNormalized(worldPoint);
    if (!normalized) return null;
    return this.setTargetNormalized(normalized, { notify });
  }

  getTargetNormalized() {
    const metrics = this.#readMetrics();
    if (!metrics || !this.controls) return cloneTarget(this.targetNormalized);
    const bounds = metrics.bounds;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const halfX = Math.max(size.x * 0.5, 0.0001);
    const halfZ = Math.max(size.z * 0.5, 0.0001);
    const height = Math.max(size.y, 0.0001);
    return {
      x: THREE.MathUtils.clamp((this.controls.target.x - center.x) / halfX, -1, 1),
      y: THREE.MathUtils.clamp((this.controls.target.y - bounds.min.y) / height, 0, 1),
      z: THREE.MathUtils.clamp((this.controls.target.z - center.z) / halfZ, -1, 1),
    };
  }

  #targetFromNormalized(target, bounds) {
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    return new THREE.Vector3(
      center.x + target.x * size.x * 0.5,
      bounds.min.y + target.y * size.y,
      center.z + target.z * size.z * 0.5,
    );
  }

  getPose() {
    const metrics = this.#readMetrics();
    if (!metrics || !this.controls) return null;
    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = offset.length();
    if (!Number.isFinite(distance) || distance < 0.000001) return null;
    return {
      target: this.getTargetNormalized(),
      direction: offset.normalize().toArray(),
      distance: distance / Math.max(metrics.radius, 0.0001),
      up: this.camera.up.clone().normalize().toArray(),
      sourceAspect: this.camera.aspect,
    };
  }

  setPose(pose, { preset = null } = {}) {
    const metrics = this.#readMetrics({ refresh: true });
    if (!metrics || !this.controls || !pose) return false;
    this.updateLimits(metrics.radius, metrics.bounds);
    const targetNormalized = {
      x: THREE.MathUtils.clamp(Number(pose.target?.x) || 0, -1, 1),
      y: THREE.MathUtils.clamp(
        Number.isFinite(Number(pose.target?.y)) ? Number(pose.target.y) : DEFAULT_CAMERA_TARGET.y,
        0,
        1,
      ),
      z: THREE.MathUtils.clamp(Number(pose.target?.z) || 0, -1, 1),
    };
    const direction = Array.isArray(pose.direction)
      ? new THREE.Vector3(Number(pose.direction[0]), Number(pose.direction[1]), Number(pose.direction[2]))
      : new THREE.Vector3(1.12, 0.45, 1.65);
    if (!Number.isFinite(direction.lengthSq()) || direction.lengthSq() < 0.000001) {
      direction.set(1.12, 0.45, 1.65);
    }
    direction.normalize();
    const radius = Math.max(metrics.radius, 0.4);
    const factor = THREE.MathUtils.clamp(Number(pose.distance) || 2.8, 0.05, 100);
    const distance = THREE.MathUtils.clamp(factor * radius, this.safety.minDistance, this.safety.maxDistance);
    const target = this.#targetFromNormalized(targetNormalized, metrics.bounds);
    const up = Array.isArray(pose.up)
      ? new THREE.Vector3(Number(pose.up[0]), Number(pose.up[1]), Number(pose.up[2]))
      : new THREE.Vector3(0, 1, 0);
    if (!Number.isFinite(up.lengthSq()) || up.lengthSq() < 0.000001) up.set(0, 1, 0);

    this.tween = null;
    this.targetNormalized = targetNormalized;
    this.currentPreset = preset;
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(direction.multiplyScalar(distance));
    this.camera.up.copy(up.normalize());
    this.controls.update();
    this.enforceSafety();
    this.updateClipping();
    this.targetNormalized = this.getTargetNormalized();
    return true;
  }

  transitionToPose(pose, {
    duration = 1.2,
    easing = 'cinematic',
    preset = null,
    focalLength = null,
  } = {}) {
    const metrics = this.#readMetrics({ refresh: true });
    if (!metrics || !this.controls || !pose) return false;
    this.updateLimits(metrics.radius, metrics.bounds);
    const targetNormalized = {
      x: THREE.MathUtils.clamp(Number(pose.target?.x) || 0, -1, 1),
      y: THREE.MathUtils.clamp(
        Number.isFinite(Number(pose.target?.y)) ? Number(pose.target.y) : DEFAULT_CAMERA_TARGET.y,
        0,
        1,
      ),
      z: THREE.MathUtils.clamp(Number(pose.target?.z) || 0, -1, 1),
    };
    const direction = Array.isArray(pose.direction)
      ? new THREE.Vector3(Number(pose.direction[0]), Number(pose.direction[1]), Number(pose.direction[2]))
      : new THREE.Vector3(1.12, 0.45, 1.65);
    if (!Number.isFinite(direction.lengthSq()) || direction.lengthSq() < 0.000001) direction.set(1.12, 0.45, 1.65);
    direction.normalize();
    const radius = Math.max(metrics.radius, 0.4);
    const factor = THREE.MathUtils.clamp(Number(pose.distance) || 2.8, 0.05, 100);
    const distance = THREE.MathUtils.clamp(factor * radius, this.safety.minDistance, this.safety.maxDistance);
    const target = this.#targetFromNormalized(targetNormalized, metrics.bounds);
    const position = target.clone().add(direction.multiplyScalar(distance));
    const up = Array.isArray(pose.up)
      ? new THREE.Vector3(Number(pose.up[0]), Number(pose.up[1]), Number(pose.up[2]))
      : new THREE.Vector3(0, 1, 0);
    if (!Number.isFinite(up.lengthSq()) || up.lengthSq() < 0.000001) up.set(0, 1, 0);

    this.targetNormalized = targetNormalized;
    this.tweenTo(position, target, Math.max(0, Number(duration) || 0) * 1000, {
      easing,
      focalLength,
      up,
      preset,
      normalizedTarget: targetNormalized,
      poseDirection: direction,
      distanceFactor: factor,
    });
    return true;
  }

  pauseTransition({ now = performance.now() } = {}) {
    if (!this.tween || this.tween.pausedAt) return false;
    this.tween.pausedAt = now;
    return true;
  }

  resumeTransition({ now = performance.now() } = {}) {
    if (!this.tween?.pausedAt) return false;
    this.tween.startedAt += Math.max(0, now - this.tween.pausedAt);
    this.tween.pausedAt = 0;
    return true;
  }

  stopTransition({ snapToTarget = true } = {}) {
    if (!this.tween) return false;
    const tween = this.tween;
    if (snapToTarget) {
      this.controls.target.copy(tween.toTarget);
      this.camera.position.copy(tween.toPosition);
      this.camera.up.copy(tween.toUp);
      this.camera.setFocalLength(tween.toFocalLength);
      this.controls.update();
      this.targetNormalized = this.getTargetNormalized();
    } else {
      // A cancelled partial move is a custom camera, not the destination preset.
      this.currentPreset = null;
      this.targetNormalized = this.getTargetNormalized();
    }
    this.tween = null;
    return true;
  }

  isTransitioning() {
    return Boolean(this.tween);
  }

  getSerializableState() {
    return {
      preset: this.currentPreset,
      focalLength: this.camera.getFocalLength(),
      target: this.getTargetNormalized(),
      pose: this.getPose(),
      damping: this.controls?.dampingFactor ?? 0.08,
      autoRotate: Boolean(this.controls?.autoRotate),
      horizonLocked: this.horizonLocked,
      mode: this.mode,
    };
  }

  #applyOrbitEnvelope() {
    if (!this.controls) return;
    this.controls.minPolarAngle = this.mode === 'inspect' ? 0.01 : 0.05;
    this.controls.maxPolarAngle = this.horizonLocked
      ? (this.mode === 'inspect' ? Math.PI * 0.96 : Math.PI * 0.48)
      : Math.PI - 0.001;
    this.controls.enablePan = true;
  }

  enforceSafety() {
    const metrics = this.#readMetrics();
    if (!metrics || !this.controls) return;

    const bounds = metrics.bounds;
    const target = this.controls.target;
    const position = this.camera.position;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());

    const direction = position.clone().sub(target);
    let distance = direction.length();
    if (!Number.isFinite(distance) || distance < 0.0001) {
      direction.set(1, 0.35, 1.2).normalize();
      distance = this.safety.minDistance;
    } else {
      direction.divideScalar(distance);
    }

    const clampedDistance = THREE.MathUtils.clamp(distance, this.safety.minDistance, this.safety.maxDistance);
    if (clampedDistance !== distance) {
      position.copy(target).add(direction.multiplyScalar(clampedDistance));
      distance = clampedDistance;
    }

    let clampedToGround = false;
    const minCameraY = this.mode === 'inspect'
      ? bounds.min.y + size.y * 0.03
      : Math.max(0.04, bounds.min.y + size.y * 0.14);
    if (position.y < minCameraY) {
      position.y = minCameraY;
      clampedToGround = true;
    }

    let insideModel = false;
    const paddedBounds = bounds.clone().expandByScalar(Math.max(0.02, metrics.radius * 0.04));
    if (this.mode === 'presentation' && paddedBounds.containsPoint(position)) {
      insideModel = true;
      const outward = position.clone().sub(center);
      if (outward.lengthSq() < 0.0001) outward.copy(direction);
      outward.normalize();
      const escapeDistance = Math.max(this.safety.minDistance, metrics.radius * 1.18);
      position.copy(target).add(outward.multiplyScalar(escapeDistance));
      if (position.y < minCameraY) position.y = minCameraY;
    }

    const previousTarget = target.clone();
    const horizontalFactor = this.mode === 'inspect' ? 1 : 0.65;
    target.x = THREE.MathUtils.clamp(
      target.x,
      center.x - size.x * 0.5 * horizontalFactor,
      center.x + size.x * 0.5 * horizontalFactor,
    );
    target.z = THREE.MathUtils.clamp(
      target.z,
      center.z - size.z * 0.5 * horizontalFactor,
      center.z + size.z * 0.5 * horizontalFactor,
    );
    target.y = THREE.MathUtils.clamp(
      target.y,
      bounds.min.y + size.y * (this.mode === 'inspect' ? 0.03 : 0.18),
      bounds.min.y + size.y * (this.mode === 'inspect' ? 0.96 : 0.82),
    );

    this.controls.target.copy(target);
    this.camera.position.copy(position);
    this.controls.update();

    this.safety.insideModel = insideModel;
    this.safety.clampedToGround = clampedToGround;
    this.safety.targetClamped = previousTarget.distanceToSquared(target) > 0.0000001;
    this.targetNormalized = this.getTargetNormalized();
  }

  updateClipping() {
    const metrics = this.#readMetrics();
    if (!metrics || !this.controls) return;
    const range = computeClipRange(this.camera, metrics.bounds, {
      target: this.controls.target,
      mode: this.mode,
      fallbackRadius: metrics.radius,
    });
    if (!range) return;
    const { near, far } = range;
    if (Math.abs(this.camera.near - near) > 0.0001 || Math.abs(this.camera.far - far) > 0.01) {
      this.camera.near = near;
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    }
    this.safety.near = near;
    this.safety.far = far;
  }

  getDiagnostics() {
    return {
      mode: this.mode,
      preset: this.currentPreset,
      target: this.getTargetNormalized(),
      minDistance: this.safety.minDistance,
      maxDistance: this.safety.maxDistance,
      near: this.safety.near,
      far: this.safety.far,
      insideModel: this.safety.insideModel,
      clampedToGround: this.safety.clampedToGround,
      targetClamped: this.safety.targetClamped,
      currentDistance: this.camera.position.distanceTo(this.controls.target),
      transitioning: this.isTransitioning(),
      interactionEnabled: this.interactionEnabled,
      boundsValid: this.safety.boundsValid,
      boundsSource: this.safety.boundsSource,
      rejectedPreset: this.safety.rejectedPreset,
    };
  }
}
