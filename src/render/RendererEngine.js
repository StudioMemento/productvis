import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { QUALITY_PROFILES } from '../config/presets.js';

export class RendererEngine {
  constructor(canvas, { onContextLost, onContextRestored } = {}) {
    this.canvas = canvas;
    this.onContextLost = onContextLost;
    this.onContextRestored = onContextRestored;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.bloomPass = null;
    this.outputPass = null;
    this.clock = null;
    this.postEnabled = true;
    this.quality = 'quality';
    this.contextLost = false;
  }

  initialize() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.contextLost = true;
      this.onContextLost?.(event);
    });
    this.canvas.addEventListener('webglcontextrestored', (event) => {
      this.contextLost = false;
      this.resetClock();
      this.onContextRestored?.(event);
    });

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.02, 250);
    this.camera.setFocalLength(50);
    this.camera.position.set(4.3, 2.7, 6.2);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0, 0.42, 0.92);
    this.bloomPass.threshold = 0.92;
    this.bloomPass.radius = 0.42;
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

  resetClock() {
    if (!this.clock) return;
    this.clock.stop();
    this.clock.start();
  }

  getCapabilities() {
    const renderer = this.renderer;
    if (!renderer) return null;
    const gl = renderer.getContext();
    let debug = null;
    try {
      const extension = gl.getExtension('WEBGL_debug_renderer_info');
      if (extension) {
        debug = {
          vendor: String(gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) || 'unknown'),
          renderer: String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) || 'unknown'),
        };
      }
    } catch {
      debug = null;
    }
    return {
      isWebGL2: Boolean(renderer.capabilities.isWebGL2),
      maxTextureSize: renderer.capabilities.maxTextureSize,
      maxCubemapSize: renderer.capabilities.maxCubemapSize,
      maxSamples: renderer.capabilities.maxSamples,
      maxTextures: renderer.capabilities.maxTextures,
      maxVertexTextures: renderer.capabilities.maxVertexTextures,
      precision: renderer.capabilities.precision,
      maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
      currentPixelRatio: renderer.getPixelRatio(),
      quality: this.quality,
      contextLost: this.contextLost,
      debug,
    };
  }

  setExposure(value) {
    this.renderer.toneMappingExposure = THREE.MathUtils.clamp(Number(value) || 0, 0.1, 4);
  }

  setBloomStrength(value) {
    this.bloomPass.strength = THREE.MathUtils.clamp(Number(value) || 0, 0, 2);
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
    const needsPost = this.postEnabled && this.bloomPass.strength > 0.0001;
    if (needsPost) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  async renderOffscreen(width, height, { camera = this.camera } = {}) {
    const safeWidth = Math.max(1, Math.round(Number(width) || 1));
    const safeHeight = Math.max(1, Math.round(Number(height) || 1));
    const maxTextureSize = this.renderer.capabilities.maxTextureSize || 4096;
    if (safeWidth > maxTextureSize || safeHeight > maxTextureSize) {
      throw new Error(`Export exceeds this GPU's ${maxTextureSize}px texture limit.`);
    }

    const renderer = this.renderer;
    const previousTarget = renderer.getRenderTarget();
    const previousViewport = renderer.getViewport(new THREE.Vector4());
    const previousScissor = renderer.getScissor(new THREE.Vector4());
    const previousScissorTest = renderer.getScissorTest();
    const previousXrEnabled = renderer.xr.enabled;
    const renderTarget = new THREE.WebGLRenderTarget(safeWidth, safeHeight, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    });
    renderTarget.texture.colorSpace = THREE.SRGBColorSpace;
    renderTarget.texture.generateMipmaps = false;

    let readTarget = renderTarget;
    let exportComposer = null;
    try {
      renderer.xr.enabled = false;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, safeWidth, safeHeight);
      renderer.setRenderTarget(renderTarget);
      renderer.clear(true, true, true);

      const needsPost = this.postEnabled && this.bloomPass.strength > 0.0001;
      if (needsPost) {
        exportComposer = new EffectComposer(renderer, renderTarget);
        exportComposer.renderToScreen = false;
        exportComposer.setPixelRatio(1);
        exportComposer.setSize(safeWidth, safeHeight);
        exportComposer.addPass(new RenderPass(this.scene, camera));
        const bloom = new UnrealBloomPass(
          new THREE.Vector2(safeWidth, safeHeight),
          this.bloomPass.strength,
          this.bloomPass.radius,
          this.bloomPass.threshold,
        );
        exportComposer.addPass(bloom);
        exportComposer.addPass(new OutputPass());
        exportComposer.render();
        readTarget = exportComposer.readBuffer;
      } else {
        renderer.render(this.scene, camera);
      }

      const pixels = new Uint8Array(safeWidth * safeHeight * 4);
      renderer.readRenderTargetPixels(readTarget, 0, 0, safeWidth, safeHeight, pixels);
      return { width: safeWidth, height: safeHeight, pixels };
    } finally {
      exportComposer?.dispose();
      renderTarget.dispose();
      renderer.setRenderTarget(previousTarget);
      renderer.setViewport(previousViewport);
      renderer.setScissor(previousScissor);
      renderer.setScissorTest(previousScissorTest);
      renderer.xr.enabled = previousXrEnabled;
    }
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
