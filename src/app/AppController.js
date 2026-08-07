import { ProjectStore, createInitialState } from './ProjectStore.js';
import { RendererEngine } from '../render/RendererEngine.js';
import { StudioSystem } from '../studio/StudioSystem.js';
import { CameraRig } from '../camera/CameraRig.js';
import { ModelLoader } from '../model/ModelLoader.js';
import { ProductSession } from '../model/ProductSession.js';
import { MotionController } from '../motion/MotionController.js';
import { FrameExporter } from '../export/FrameExporter.js';
import { UIController } from '../ui/UIController.js';
import { collectDom } from '../ui/dom.js';
import { createDemoProduct } from '../demo/createDemoProduct.js';
import { LOOK_PRESETS } from '../config/presets.js';
import { formatBytes, stripExtension, cleanErrorMessage, capitalize } from '../utils/format.js';

export class AppController {
  constructor() {
    this.store = new ProjectStore(createInitialState());
    this.dom = collectDom();
    this.ui = new UIController(this.dom);
    this.engine = null;
    this.studio = null;
    this.cameraRig = null;
    this.loader = null;
    this.product = null;
    this.motion = null;
    this.exporter = null;
  }

  boot() {
    try {
      this.engine = new RendererEngine(this.dom.canvas, {
        onContextLost: () => this.ui.showToast(
          'The graphics context was interrupted. Reload the page to restore it.',
          true,
          '!',
        ),
      }).initialize();

      this.studio = new StudioSystem(this.engine).initialize();
      this.product = new ProductSession({
        scene: this.engine.scene,
        renderer: this.engine.renderer,
        getEnvironmentTexture: () => this.studio.environmentTexture,
        onBoundsChanged: (metrics, options) => this.#handleBoundsChanged(metrics, options),
      });
      this.cameraRig = new CameraRig(this.engine, () => this.product.getMetrics()).initialize();
      this.loader = new ModelLoader(this.engine.renderer);
      this.motion = new MotionController({
        getMotionRoot: () => this.product.motionRoot,
        isTransforming: () => this.product.hasTransformTween(),
        onStateChange: (state) => this.#handleMotionState(state),
      });
      this.exporter = new FrameExporter({
        engine: this.engine,
        getProjectState: () => this.store.get('project'),
        getModelName: () => this.product.name,
        getViewportRect: () => this.dom.canvas.getBoundingClientRect(),
        onResize: () => this.handleResize(),
        onStatus: (status) => this.#handleExportStatus(status),
      });

      this.ui.setActions(this.#createActions());
      this.ui.bind();

      const demo = createDemoProduct();
      this.setModel(demo, [], {
        name: 'Demo Object',
        fileSize: null,
        procedural: true,
        immediateCamera: true,
      });

      const initialQuality = this.ui.shouldStartBalanced() ? 'balanced' : 'quality';
      this.setQuality(initialQuality, { showMessage: false });
      this.applyLookPreset('studio', { immediate: true, showMessage: false });
      this.handleResize();
      this.setCameraPreset('hero', { immediate: true });
      this.engine.setAnimationLoop((now) => this.#renderLoop(now));
      this.store.patch('session', { status: 'ready', meta: 'READY' }, { source: 'boot' });
      return this;
    } catch (error) {
      console.error(error);
      this.ui.showFatalError(error);
      throw error;
    }
  }

  #createActions() {
    return {
      importFile: (file) => this.loadGLBFile(file),
      applyLookPreset: (name) => this.applyLookPreset(name),
      setCameraPreset: (name) => this.setCameraPreset(name),
      setMaterialMode: (mode) => this.setMaterialMode(mode),
      setQuality: (mode) => this.setQuality(mode),
      setExposure: (value) => this.setExposure(value),
      setEnvironment: (value) => this.setEnvironment(value),
      setKey: (value) => this.setKey(value),
      setRim: (value) => this.setRim(value),
      setBloom: (value) => this.setBloom(value),
      setFloorEnabled: (enabled) => this.setFloorEnabled(enabled),
      setShadowsEnabled: (enabled) => this.setShadowsEnabled(enabled),
      setPostEnabled: (enabled) => this.setPostEnabled(enabled),
      setScale: (value) => this.setScale(value),
      setOffset: (value) => this.setOffset(value),
      rotateObject: (axis) => this.rotateObject(axis),
      centerObject: () => this.centerObject(),
      groundObject: () => this.groundObject(),
      resetTransform: () => this.resetTransform(),
      resetAll: () => this.resetAll(),
      fitModel: () => this.fitModel(),
      setFocalLength: (value) => this.setFocalLength(value),
      setDamping: (value) => this.setDamping(value),
      setAutoRotate: (enabled) => this.setAutoRotate(enabled),
      setHorizonLocked: (enabled) => this.setHorizonLocked(enabled),
      selectAnimation: (index) => this.selectAnimation(index),
      toggleAnimationPlayback: () => this.toggleAnimationPlayback(),
      hasAnimations: () => this.motion.clips.length > 0,
      setAnimationLoop: (enabled) => this.setAnimationLoop(enabled),
      setAnimationSpeed: (value) => this.setAnimationSpeed(value),
      setTurntable: (enabled) => this.setTurntable(enabled),
      setTurntableSpeed: (value) => this.setTurntableSpeed(value),
      exportImage: (format) => this.exporter.exportImage(format),
      toggleFullscreen: () => this.toggleFullscreen(),
      resize: () => this.handleResize(),
    };
  }

  async loadGLBFile(file) {
    if (!file?.name?.toLowerCase().endsWith('.glb')) {
      this.ui.showToast('Please choose a self-contained .glb file.', true, '!');
      return;
    }

    const maxRecommended = 180 * 1024 * 1024;
    if (file.size > maxRecommended) {
      this.ui.showToast('Large GLB detected. It may exceed mobile GPU memory.', false, 'i');
    }

    this.ui.showLoading(true, 'Reading geometry', 7);
    this.ui.setModelStatus('loading', file.name, 'LOADING');
    this.store.patch('session', { status: 'loading', meta: 'LOADING' }, { source: 'import' });

    try {
      const gltf = await this.loader.loadFile(file, {
        onProgress: (progressEvent) => {
          const total = progressEvent.total || file.size || 0;
          const loaded = progressEvent.loaded || 0;
          const ratio = total > 0 ? loaded / total : 0.32;
          const percent = Math.min(88, Math.max(8, Math.round(ratio * 88)));
          const label = ratio > 0.72
            ? 'Decoding textures'
            : ratio > 0.35
              ? 'Building materials'
              : 'Reading geometry';
          this.ui.showLoading(true, label, percent);
        },
      });

      const asset = gltf.scene || gltf.scenes?.[0];
      if (!asset) throw new Error('This GLB does not contain a renderable scene.');
      this.ui.showLoading(true, 'Optimizing scene', 92);
      await new Promise((resolve) => requestAnimationFrame(resolve));

      this.setModel(asset, gltf.animations || [], {
        name: stripExtension(file.name),
        fileSize: file.size,
        procedural: false,
        immediateCamera: false,
      });
      this.ui.showLoading(false);
      this.ui.dismissIntro();
      this.store.set('ui.introDismissed', true, { source: 'import' });
      this.ui.showToast(`${stripExtension(file.name)} is ready to render.`);
    } catch (error) {
      console.error(error);
      this.ui.showLoading(false);
      this.ui.setModelStatus('error', file.name, 'IMPORT ERROR');
      this.store.patch('session', { status: 'error', meta: 'IMPORT ERROR' }, { source: 'import' });
      const message = error?.message
        ? cleanErrorMessage(error)
        : 'The GLB could not be decoded. Check that it is valid and self-contained.';
      this.ui.showToast(message, true, '!');
    }
  }

  setModel(asset, animations, options) {
    const result = this.product.setModel(asset, options);
    const motionState = this.motion.setup(animations, result.asset);
    const meta = options.procedural ? 'DEMO · READY' : `${formatBytes(options.fileSize)} · READY`;

    this.store.transaction((state) => {
      Object.assign(state.project.model, {
        name: this.product.name,
        fileSize: options.fileSize ?? null,
        procedural: Boolean(options.procedural),
        materialMode: 'original',
        userScale: 1,
        userOffset: 0,
      });
      Object.assign(state.session, {
        status: 'ready',
        meta,
        stats: {
          ...result.stats,
          animations: motionState.clips.length,
        },
      });
    }, { source: 'model' });

    this.ui.updateModelStats(result.stats, {
      procedural: Boolean(options.procedural),
      fileSize: options.fileSize,
      animations: motionState.clips.length,
    });
    this.ui.setModelStatus('ready', this.product.name, meta);
    this.ui.setMaterialMode('original');
    this.ui.updateTransformUI(1, 0);
    this.setCameraPreset('hero', { immediate: Boolean(options.immediateCamera) });
  }

  applyLookPreset(name, { immediate = false, showMessage = true } = {}) {
    const preset = LOOK_PRESETS[name];
    if (!preset) return;
    this.studio.applyPreset(preset, { immediate });
    this.store.patch('project.studio', {
      preset: name,
      exposure: preset.exposure,
      environment: preset.environment,
      key: preset.key,
      rim: preset.rim,
      bloom: preset.bloom,
    }, { source: 'preset' });
    this.ui.setLookPresetActive(name);
    this.ui.setLookInputs(preset);
    if (showMessage) this.ui.showToast(`${capitalize(name)} environment loaded.`);
  }

  #markLookCustom() {
    this.studio.cancelPresetTween();
    this.store.set('project.studio.preset', null, { source: 'control' });
    this.ui.clearLookPresetActive();
  }

  setExposure(value) {
    this.#markLookCustom();
    this.studio.setExposure(value);
    this.store.set('project.studio.exposure', value, { source: 'control' });
  }

  setEnvironment(value) {
    this.#markLookCustom();
    this.studio.setEnvironmentIntensity(value);
    this.store.set('project.studio.environment', value, { source: 'control' });
  }

  setKey(value) {
    this.#markLookCustom();
    this.studio.setKeyIntensity(value);
    this.store.set('project.studio.key', value, { source: 'control' });
  }

  setRim(value) {
    this.#markLookCustom();
    this.studio.setRimIntensity(value);
    this.store.set('project.studio.rim', value, { source: 'control' });
  }

  setBloom(value) {
    this.#markLookCustom();
    this.studio.setBloom(value);
    this.store.set('project.studio.bloom', value, { source: 'control' });
  }

  setFloorEnabled(enabled) {
    this.studio.setFloorEnabled(enabled);
    this.store.set('project.studio.floorEnabled', Boolean(enabled), { source: 'control' });
  }

  setShadowsEnabled(enabled) {
    this.studio.setShadowsEnabled(enabled);
    this.product.setShadowsEnabled(enabled);
    this.store.set('project.studio.shadowsEnabled', Boolean(enabled), { source: 'control' });
  }

  setPostEnabled(enabled) {
    this.engine.setPostEnabled(enabled);
    this.store.set('project.studio.postEnabled', Boolean(enabled), { source: 'control' });
  }

  setScale(value) {
    this.product.setUserScale(value);
    this.store.set('project.model.userScale', value, { source: 'control' });
  }

  setOffset(value) {
    this.product.setUserOffset(value);
    this.store.set('project.model.userOffset', value, { source: 'control' });
  }

  rotateObject(axis) {
    this.product.rotate(axis, () => this.fitModel());
  }

  centerObject() {
    this.product.center();
    this.ui.showToast('Object centered.');
  }

  groundObject() {
    this.product.ground();
    this.store.set('project.model.userOffset', 0, { source: 'action' });
    this.ui.updateTransformUI(this.product.userScale, 0);
    this.ui.showToast('Object grounded.');
  }

  resetTransform({ showMessage = true } = {}) {
    this.product.resetTransform();
    this.store.patch('project.model', { userScale: 1, userOffset: 0 }, { source: 'action' });
    this.ui.updateTransformUI(1, 0);
    if (showMessage) this.ui.showToast('Object transform reset.');
  }

  setMaterialMode(mode, { showMessage = true } = {}) {
    if (!this.product.setMaterialMode(mode)) return;
    this.store.set('project.model.materialMode', mode, { source: 'control' });
    this.ui.setMaterialMode(mode);
    if (showMessage) this.ui.showToast(`${capitalize(mode)} material treatment applied.`);
  }

  setQuality(mode, { showMessage = true } = {}) {
    const profile = this.engine.setQuality(mode);
    if (!profile) return;
    this.studio.setShadowQuality(profile.shadowMapSize);
    this.store.set('project.render.quality', mode, { source: 'control' });
    this.ui.setQuality(mode);
    this.handleResize();
    if (showMessage) this.ui.showToast(`${capitalize(mode)} render mode active.`);
  }

  setCameraPreset(name, { immediate = false } = {}) {
    this.product.updateBounds({ updateShadowScale: false });
    if (!this.cameraRig.setPreset(name, { immediate })) return;
    this.store.set('project.camera.preset', name, { source: 'control' });
    this.ui.setCameraButtons(name);
  }

  fitModel({ immediate = false } = {}) {
    this.product.updateBounds({ updateShadowScale: false });
    this.cameraRig.fit({ immediate });
  }

  setFocalLength(value) {
    this.cameraRig.setFocalLength(value);
    this.store.set('project.camera.focalLength', value, { source: 'control' });
  }

  setDamping(value) {
    this.cameraRig.setDamping(value);
    this.store.set('project.camera.damping', value, { source: 'control' });
  }

  setAutoRotate(enabled) {
    this.cameraRig.setAutoRotate(enabled);
    this.store.set('project.camera.autoRotate', Boolean(enabled), { source: 'control' });
  }

  setHorizonLocked(enabled) {
    this.cameraRig.setHorizonLocked(enabled);
    this.store.set('project.camera.horizonLocked', Boolean(enabled), { source: 'control' });
  }

  selectAnimation(index) {
    this.motion.select(index, { autoplay: false });
  }

  toggleAnimationPlayback() {
    this.motion.togglePlayback();
  }

  setAnimationLoop(enabled) {
    this.motion.setLoop(enabled);
  }

  setAnimationSpeed(value) {
    this.motion.setSpeed(value);
  }

  setTurntable(enabled) {
    this.motion.setTurntable(enabled);
  }

  setTurntableSpeed(value) {
    this.motion.setTurntableSpeed(value);
  }

  resetAll() {
    this.resetTransform({ showMessage: false });
    this.applyLookPreset('studio', { immediate: false, showMessage: false });
    this.setMaterialMode('original', { showMessage: false });
    this.setCameraPreset('hero');
    this.setAutoRotate(false);
    this.dom.autoRotateToggle.checked = false;
    this.setTurntable(false);
    this.ui.showToast('Render reset to studio defaults.');
  }

  async toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await this.dom.viewportShell.requestFullscreen();
      else await document.exitFullscreen();
    } catch (error) {
      this.ui.showToast('Fullscreen is not available in this browser.', true, '!');
    }
  }

  handleResize() {
    if (!this.engine || !this.cameraRig) return;
    const width = Math.max(1, this.dom.viewportShell.clientWidth);
    const height = Math.max(1, this.dom.viewportShell.clientHeight);
    this.engine.resize(width, height);
    const exportSize = this.engine.getViewportExportSize(width, height);
    this.ui.setViewportExportSize(exportSize.width, exportSize.height);
    this.ui.handleResponsivePanel();
  }

  #handleBoundsChanged(metrics, options) {
    this.studio?.updateForBounds(metrics.bounds, metrics.radius, options);
    this.cameraRig?.updateLimits(metrics.radius);
  }

  #handleMotionState(motionState) {
    this.store.patch('project.motion', {
      clipIndex: motionState.clipIndex,
      playing: motionState.playing,
      loop: motionState.loop,
      speed: motionState.speed,
      turntable: motionState.turntable,
      turntableSpeed: motionState.turntableSpeed,
    }, { source: 'motion' });
    this.ui.updateMotionState(motionState);
  }

  #handleExportStatus(status) {
    if ('exporting' in status) {
      this.store.set('ui.exporting', status.exporting, { source: 'export' });
      this.ui.setExporting(status.exporting);
    }
    if (status.message) this.ui.showToast(status.message);
    if (status.error) this.ui.showToast(status.error, true, '!');
  }

  #renderLoop(now) {
    const delta = this.engine.getDelta();
    this.studio.update(now);
    this.cameraRig.updateTween(now);
    this.product.update(now);
    this.motion.update(delta);
    this.cameraRig.updateControls(delta);
    this.studio.updateCameraPosition(this.engine.camera.position);
    this.engine.render();
  }
}
