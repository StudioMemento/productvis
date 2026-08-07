import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { QUALITY_PROFILES } from '../config/presets.js';

export class RendererEngine {
  constructor(canvas, { onContextLost } = {}) {
    this.canvas = canvas;
    this.onContextLost = onContextLost;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.bloomPass = null;
    this.outputPass = null;
    this.clock = null;
    this.postEnabled = true;
    this.quality = 'quality';
  }

  initialize() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.onContextLost?.(event);
    });

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.02, 250);
    this.camera.setFocalLength(50);
    this.camera.position.set(4.3, 2.7, 6.2);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.18, 0.56, 0.82);
    this.bloomPass.threshold = 0.84;
    this.bloomPass.radius = 0.6;
    this.composer.addPass(this.bloomPass);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.clock = new THREE.Clock();
    return this;
  }

  setAnimationLoop(callback) {
    this.renderer.setAnimationLoop(callback);
  }

  getDelta() {
    return Math.min(this.clock.getDelta(), 0.05);
  }

  setExposure(value) {
    this.renderer.toneMappingExposure = value;
  }

  setBloomStrength(value) {
    this.bloomPass.strength = value;
  }

  setPostEnabled(enabled) {
    this.postEnabled = Boolean(enabled);
  }

  setShadowEnabled(enabled) {
    this.renderer.shadowMap.enabled = Boolean(enabled);
  }

  setQuality(mode) {
    const profile = QUALITY_PROFILES[mode];
    if (!profile) return null;
    this.quality = mode;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const pixelRatio = Math.min(devicePixelRatio, profile.maxPixelRatio);
    this.renderer.setPixelRatio(pixelRatio);
    this.composer.setPixelRatio(pixelRatio);
    return { ...profile, pixelRatio };
  }

  resize(width, height) {
    const safeWidth = Math.max(1, Math.round(width));
    const safeHeight = Math.max(1, Math.round(height));
    this.camera.aspect = safeWidth / safeHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(safeWidth, safeHeight, false);
    this.composer.setSize(safeWidth, safeHeight);
  }

  render() {
    if (this.postEnabled) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  getViewportExportSize(width, height) {
    const maxPixelRatio = this.quality === 'performance' ? 1 : 2;
    const exportDpr = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    return {
      width: Math.round(width * exportDpr),
      height: Math.round(height * exportDpr),
    };
  }
}
