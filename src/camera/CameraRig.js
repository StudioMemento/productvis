import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA_PRESETS } from '../config/presets.js';
import { easeOutQuint } from '../utils/math.js';

export class CameraRig {
  constructor(engine, getModelMetrics) {
    this.engine = engine;
    this.camera = engine.camera;
    this.canvas = engine.canvas;
    this.getModelMetrics = getModelMetrics;
    this.controls = null;
    this.tween = null;
    this.currentPreset = 'hero';
  }

  initialize() {
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.62;
    this.controls.zoomSpeed = 0.78;
    this.controls.panSpeed = 0.55;
    this.controls.screenSpacePanning = true;
    this.controls.minPolarAngle = 0.02;
    this.controls.maxPolarAngle = Math.PI * 0.93;
    this.controls.target.set(0, 1.2, 0);
    this.controls.update();
    this.controls.addEventListener('start', () => {
      this.tween = null;
    });
    return this;
  }

  setPreset(name, { immediate = false } = {}) {
    const preset = CAMERA_PRESETS[name];
    const metrics = this.getModelMetrics();
    if (!preset || !metrics?.root) return false;

    const size = metrics.bounds.getSize(new THREE.Vector3());
    const target = metrics.bounds.getCenter(new THREE.Vector3());
    target.y = metrics.bounds.min.y + size.y * preset.targetY;
    const distance = this.computeFitDistance(metrics.radius) * preset.distance;
    const direction = new THREE.Vector3(...preset.direction).normalize();
    const position = target.clone().add(direction.multiplyScalar(distance));

    this.currentPreset = name;
    this.tweenTo(position, target, immediate ? 1 : 820);
    return true;
  }

  fit({ immediate = false } = {}) {
    const metrics = this.getModelMetrics();
    if (!metrics?.root) return false;
    const size = metrics.bounds.getSize(new THREE.Vector3());
    const target = metrics.bounds.getCenter(new THREE.Vector3());
    target.y = metrics.bounds.min.y + size.y * 0.48;
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    if (!Number.isFinite(direction.x) || direction.lengthSq() < 0.001) {
      direction.set(1, 0.35, 1.5).normalize();
    }
    const position = target.clone().add(direction.multiplyScalar(this.computeFitDistance(metrics.radius)));
    this.tweenTo(position, target, immediate ? 1 : 650);
    return true;
  }

  computeFitDistance(radius) {
    const safeRadius = Math.max(radius, 0.45);
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.camera.aspect);
    const limitingFov = Math.min(verticalFov, horizontalFov);
    return (safeRadius / Math.sin(Math.max(0.12, limitingFov / 2))) * 1.12;
  }

  updateLimits(radius) {
    this.controls.minDistance = Math.max(0.3, radius * 0.35);
    this.controls.maxDistance = Math.max(18, radius * 12);
  }

  tweenTo(position, target, duration) {
    this.tween = {
      fromPosition: this.camera.position.clone(),
      toPosition: position.clone(),
      fromTarget: this.controls.target.clone(),
      toTarget: target.clone(),
      startedAt: performance.now(),
      duration,
    };
  }

  updateTween(now) {
    const tween = this.tween;
    if (!tween) return;
    const raw = Math.min(1, (now - tween.startedAt) / tween.duration);
    const t = easeOutQuint(raw);
    this.camera.position.copy(tween.fromPosition).lerp(tween.toPosition, t);
    this.controls.target.copy(tween.fromTarget).lerp(tween.toTarget, t);
    this.controls.update();
    if (raw >= 1) this.tween = null;
  }

  updateControls(delta) {
    this.controls.update(delta);
  }

  setFocalLength(value) {
    this.camera.setFocalLength(value);
  }

  setDamping(value) {
    this.controls.dampingFactor = value;
  }

  setAutoRotate(enabled) {
    this.controls.autoRotate = Boolean(enabled);
    this.controls.autoRotateSpeed = 0.42;
  }

  setHorizonLocked(enabled) {
    this.controls.maxPolarAngle = enabled ? Math.PI * 0.93 : Math.PI - 0.001;
  }
}
