import { ProjectStore, createInitialState } from './ProjectStore.js';
import { RendererEngine } from '../render/RendererEngine.js';
import { StudioSystem } from '../studio/StudioSystem.js';
import { CameraRig } from '../camera/CameraRig.js';
import { ModelLoader } from '../model/ModelLoader.js';
import { ProductSession } from '../model/ProductSession.js';
import { MotionController } from '../motion/MotionController.js';
import { FrameExporter } from '../export/FrameExporter.js';
import { ExperienceRuntime } from '../presentation/ExperienceRuntime.js';
import {
  DEFAULT_EXPERIENCE_STATE,
  sanitizeExperienceState,
  sanitizeLogoDataUrl,
  experienceHasArTarget,
} from '../presentation/ExperienceGrammar.js';
import {
  encodeExperienceFile,
  decodeExperienceFile,
  experienceFilename,
  EXPERIENCE_FILE_MIME,
} from '../presentation/ExperienceFileCodec.js';
import { PresentationFrameComposer } from '../presentation/PresentationFrameComposer.js';
import { launchArHandoff } from '../presentation/ARHandoff.js';
import { encodeProjectFile, decodeProjectFile, projectFilename } from '../persistence/ProjectFileCodec.js';
import { sanitizeProjectState, createProjectId } from '../persistence/ProjectMigration.js';
import { SavedLookLibrary } from '../persistence/SavedLookLibrary.js';
import { RecentProjectStore } from '../persistence/RecentProjectStore.js';
import { RecoveryDraftStore } from '../persistence/RecoveryDraftStore.js';
import { analyzeModelPreflight } from '../health/ModelPreflightAnalyzer.js';
import { createSupportReport } from '../health/SupportReport.js';
import { RuntimePerformanceMonitor } from '../runtime/RuntimePerformanceMonitor.js';
import { AnchorOverlay } from '../structure/AnchorOverlay.js';
import { InfographicSystem } from '../configurator/InfographicSystem.js';
import { InfographicOverlay } from '../configurator/InfographicOverlay.js';
import { PresentationStateLibrary } from '../configurator/PresentationStateLibrary.js';
import { StorySystem } from '../story/StorySystem.js';
import { StoryPlayer } from '../story/StoryPlayer.js';
import { resolveChapterRange } from '../story/StoryGrammar.js';
import { UIController } from '../ui/UIController.js';
import { collectDom } from '../ui/dom.js';
import { createDemoProduct } from '../demo/createDemoProduct.js';
import {
  BACKDROP_PRESETS,
  LIGHT_PRESETS,
  CAMERA_PRESETS,
  DEFAULT_BACKDROP_ID,
  DEFAULT_LIGHT_ID,
  DEFAULT_GROUND_OFFSET,
  DEFAULT_CAMERA_TARGET,
  DEFAULT_PROJECT_STATE,
} from '../config/presets.js';
import { formatBytes, stripExtension, cleanErrorMessage, capitalize } from '../utils/format.js';

const EPSILON = 0.0001;
const APP_VERSION = '2.1.0-alpha.1';
const RECOVERY_DEBOUNCE_MS = 1800;
const RECOVERY_MIN_INTERVAL_MS = 8000;
const VARIANT_FINISHES = Object.freeze({
  original: Object.freeze({}),
  satin: Object.freeze({ roughness: 0.42, metalness: 0.12, clearcoat: 0.18 }),
  matte: Object.freeze({ roughness: 0.82, metalness: 0.05, clearcoat: 0.02 }),
  gloss: Object.freeze({ roughness: 0.18, metalness: 0.08, clearcoat: 0.5 }),
  metallic: Object.freeze({ roughness: 0.22, metalness: 0.9, clearcoat: 0.28 }),
});

function nearlyEqual(a, b, epsilon = EPSILON) {
  return Math.abs(Number(a) - Number(b)) <= epsilon;
}

function targetEquals(a, b) {
  return nearlyEqual(a?.x, b?.x)
    && nearlyEqual(a?.y, b?.y)
    && nearlyEqual(a?.z, b?.z);
}

function rotationIsZero(rotation) {
  return nearlyEqual(rotation?.x, 0)
    && nearlyEqual(rotation?.y, 0)
    && nearlyEqual(rotation?.z, 0);
}

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
    this.presentationComposer = null;
    this.experienceRuntime = new ExperienceRuntime({
      onChange: ({ state }) => this.#handleExperienceRuntimeChange(state),
    });
    this.experienceSnapshot = null;
    this.experienceOptionsVisible = false;
    this.experienceSource = 'editor';
    this.anchorOverlay = null;
    this.infographicOverlay = null;
    this.infographics = new InfographicSystem();
    this.presentations = new PresentationStateLibrary();
    this.stories = new StorySystem({
      getLibraries: () => ({
        presentations: this.presentations.getState().presentations,
        explodeStates: this.product?.getExplosionReport()?.explodeStates || [],
        infographics: this.infographics.getState().infographics,
      }),
    });
    this.storyPlayer = new StoryPlayer({
      onApplyStep: (step, context) => this.#applyStoryStep(step, context),
      onStartChapter: (chapterId) => this.#startStoryChapter(chapterId),
      onPauseChapter: () => this.motion?.pauseChapter({ notify: true }),
      onResumeChapter: () => this.motion?.resumeChapter({ notify: true }),
      onStopChapter: () => this.motion?.clearChapter({ pause: true, notify: true }),
      onPauseTransition: ({ now } = {}) => {
        this.cameraRig?.pauseTransition({ now });
        this.product?.pauseExplosionTransition({ now });
      },
      onResumeTransition: ({ now } = {}) => {
        this.cameraRig?.resumeTransition({ now });
        this.product?.resumeExplosionTransition({ now });
      },
      onStopTransition: () => {
        this.cameraRig?.stopTransition({ snapToTarget: false });
        this.product?.stopExplosionTransition({ snapToTarget: false });
      },
      onStateChange: (state) => this.#handleStoryPlayerState(state),
      onComplete: (story) => this.#handleStoryComplete(story),
    });
    this.variantPreviewEnabled = false;
    this.lastDiagnosticsSyncAt = 0;
    this.runtimeDefaultQuality = 'quality';
    this.unsubscribeStore = null;
    this.lookLibrary = new SavedLookLibrary();
    this.recentProjects = new RecentProjectStore({ maxEntries: 3 });
    this.recoveryDrafts = new RecoveryDraftStore();
    this.performanceMonitor = new RuntimePerformanceMonitor();
    this.modelPreflight = null;
    this.recoveryMetadata = null;
    this.recoveryTimer = null;
    this.recoveryBusy = false;
    this.recoveryReady = false;
    this.lastRecoverySavedAt = 0;
    this.runtimeSuspended = false;
    this.lastRuntimeSyncAt = 0;
    this.lastExplosionBoundsSyncAt = 0;
    this.sourceAsset = { kind: 'procedural-demo', name: 'Demo Object', mimeType: null, bytes: null };
    this.currentRecentProjectId = null;
    this.projectCreatedAt = null;
    this.projectUpdatedAt = null;
    this.projectDirty = true;
    this.applyingProject = false;
  }

  boot() {
    try {
      this.engine = new RendererEngine(this.dom.canvas, {
        onContextLost: () => {
          this.runtimeSuspended = true;
          this.performanceMonitor.setSuspended(true);
          this.ui.setSystemFooter('GPU INTERRUPTED', 'Reload if the context does not recover');
          this.ui.showToast('The graphics context was interrupted. Product VIS will resume if the browser restores it.', true, '!');
        },
        onContextRestored: () => {
          this.runtimeSuspended = false;
          this.performanceMonitor.setSuspended(false);
          this.performanceMonitor.reset();
          this.handleResize();
          this.ui.setSystemFooter('GPU RESTORED', 'Realtime rendering resumed');
          this.ui.showToast('Graphics context restored.');
        },
      }).initialize();

      this.studio = new StudioSystem(this.engine).initialize();
      this.product = new ProductSession({
        scene: this.engine.scene,
        renderer: this.engine.renderer,
        getEnvironmentTexture: () => this.studio.environmentTexture,
        onBoundsChanged: (metrics, options) => this.#handleBoundsChanged(metrics, options),
      });
      this.cameraRig = new CameraRig(
        this.engine,
        ({ refresh = false } = {}) => (refresh
          ? this.product.updateBounds({ updateShadowScale: false, notify: false })
          : this.product.getMetrics()),
        { onTargetChange: (change) => this.#handleCameraTargetChange(change) },
      ).initialize();
      this.anchorOverlay = new AnchorOverlay(this.dom.anchorOverlay, this.engine.camera, {
        onSelect: (id) => this.selectAnchor(id),
      });
      this.infographicOverlay = new InfographicOverlay(this.dom.infographicOverlay, this.engine.camera, {
        onSelect: (id) => this.selectInfographic(id),
      });
      this.loader = new ModelLoader(this.engine.renderer);
      this.motion = new MotionController({
        getMotionRoot: () => this.product.motionRoot,
        isTransforming: () => this.product.isDynamic(),
        onStateChange: (state) => this.#handleMotionState(state),
        onChapterComplete: (chapter) => this.#handleAnimationChapterComplete(chapter),
      });
      this.exporter = new FrameExporter({
        engine: this.engine,
        getProjectState: () => this.store.get('project'),
        getModelName: () => this.product.name,
        getViewportRect: () => this.dom.canvas.getBoundingClientRect(),
        onResize: () => this.handleResize(),
        beforeRender: async () => {
          this.product.setStructureHelpersVisible(false);
          await this.studio.renderContactShadow({ force: true });
        },
        afterRender: () => this.product.setStructureHelpersVisible(true),
        onStatus: (status) => this.#handleExportStatus(status),
      });

      this.presentationComposer = new PresentationFrameComposer({
        frameExporter: this.exporter,
        getExperience: () => this.store.get('project.experience'),
        getModelName: () => this.product.name,
        getInfographicState: () => this.infographics.getState(),
        getAnchorMarkers: () => this.product.getAnchorMarkers(),
        getStoryState: () => this.storyPlayer.getState(),
        onStatus: (status) => this.#handleExportStatus(status),
      });

      this.ui.setActions(this.#createActions());
      this.ui.bind();
      this.unsubscribeStore = this.store.subscribe((event) => {
        this.#syncGroupStatuses();
        const ignoredSources = new Set([
          'boot',
          'project-open',
          'project-save',
          'export',
          'adaptive-quality',
          'runtime-status',
          'recovery',
          'story-runtime',
          'experience-runtime',
          'experience-open',
        ]);
        if (!this.applyingProject && !ignoredSources.has(event.source)) {
          this.projectDirty = true;
          this.ui.setProjectStateLabel('UNSAVED CHANGES');
          this.#scheduleRecoveryDraft();
        }
      });

      document.addEventListener('visibilitychange', () => this.#handleVisibilityChange());
      window.addEventListener('pagehide', () => {
        if (this.projectDirty) this.saveRecoveryDraft({ silent: true, force: true });
      });
      window.addEventListener('beforeunload', (event) => {
        const runtime = this.store.get('project.runtime');
        if (this.projectDirty && (!runtime?.recoveryEnabled || !this.recoveryDrafts.available)) {
          event.preventDefault();
          event.returnValue = '';
        }
      });

      const demo = createDemoProduct();
      this.setModel(demo, [], {
        name: 'Demo Object',
        fileSize: null,
        procedural: true,
        immediateCamera: true,
      });

      this.runtimeDefaultQuality = this.ui.shouldStartBalanced() ? 'balanced' : 'quality';
      this.setQuality(this.runtimeDefaultQuality, { showMessage: false });
      this.applyBackdropPreset(DEFAULT_BACKDROP_ID, { immediate: true, showMessage: false });
      this.applyLightingPreset(DEFAULT_LIGHT_ID, { immediate: true, showMessage: false });
      this.setGroundOffset(DEFAULT_GROUND_OFFSET, { showMessage: false });
      this.handleResize();
      this.engine.setAnimationLoop((now) => this.#renderLoop(now));
      this.store.patch('session', { status: 'ready', meta: 'READY' }, { source: 'boot' });
      this.ui.updateSavedLooks(this.lookLibrary.list());
      this.ui.setExportFraming('match');
      this.ui.setProjectStateLabel('DEMO · UNSAVED');
      this.#applyRuntimeState(DEFAULT_PROJECT_STATE.runtime, { source: 'boot' });
      this.refreshRecentProjects();
      this.recoveryReady = true;
      this.#refreshRecoveryDraft();
      this.#syncGroupStatuses();
      this.#syncRuntimeUI(true);
      this.#syncExperienceEditor();
      this.#bootstrapExperienceFromLocation();
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
      saveProject: () => this.saveProject(),
      openProject: (file) => this.openProjectFile(file),
      openExperience: (file) => this.openExperienceFile(file),
      updateExperience: (profile) => this.updateExperience(profile),
      setExperienceLogo: (file) => this.setExperienceLogo(file),
      removeExperienceLogo: () => this.removeExperienceLogo(),
      enterExperience: () => this.enterExperienceMode(),
      startExperience: () => this.startExperience(),
      exitExperience: () => this.exitExperienceMode(),
      restartExperience: () => this.restartExperience(),
      exploreExperience: () => this.exploreExperience(),
      toggleExperienceOptions: () => this.toggleExperienceOptions(),
      publishExperience: (options) => this.publishExperience(options),
      shareExperience: () => this.publishExperience({ share: true }),
      copyExperienceLink: () => this.copyExperienceLink(),
      launchExperienceAr: () => this.launchExperienceAr(),
      exportPresentation: (format) => this.presentationComposer.exportImage(format),
      goToExperienceStep: (stepId) => this.goToExperienceStep(stepId),
      saveCurrentLook: (name) => this.saveCurrentLook(name),
      applySavedLook: (id) => this.applySavedLook(id),
      deleteSavedLook: (id) => this.deleteSavedLook(id),
      refreshRecentProjects: () => this.refreshRecentProjects(),
      openRecentProject: (id) => this.openRecentProject(id),
      removeRecentProject: (id) => this.removeRecentProject(id),
      applyLookPreset: (name) => this.applyBackdropPreset(name),
      applyBackdropPreset: (name) => this.applyBackdropPreset(name),
      applyLightingPreset: (name) => this.applyLightingPreset(name),
      setCameraPreset: (name) => this.setCameraPreset(name),
      setMaterialMode: (mode) => this.setMaterialMode(mode),
      setMaterialSideOverride: (id, mode) => this.setMaterialSideOverride(id, mode),
      setQuality: (mode) => this.setQuality(mode),
      setBackdropTone: (value) => this.setBackdropTone(value),
      setExposure: (value) => this.setExposure(value),
      setEnvironment: (value) => this.setEnvironment(value),
      setEnvironmentRotation: (value) => this.setEnvironmentRotation(value),
      setKey: (value) => this.setKey(value),
      setFill: (value) => this.setFill(value),
      setRim: (value) => this.setRim(value),
      setBloom: (value) => this.setBloom(value),
      setGroundOffset: (value) => this.setGroundOffset(value),
      setShadowOpacity: (value) => this.setShadowOpacity(value),
      setShadowSoftness: (value) => this.setShadowSoftness(value),
      setFloorEnabled: (enabled) => this.setFloorEnabled(enabled),
      setShadowsEnabled: (enabled) => this.setShadowsEnabled(enabled),
      setPostEnabled: (enabled) => this.setPostEnabled(enabled),
      setScale: (value) => this.setScale(value),
      setOffset: (value) => this.setOffset(value),
      rotateObject: (axis) => this.rotateObject(axis),
      centerObject: () => this.centerObject(),
      groundObject: () => this.groundObject(),
      resetTransform: () => this.resetTransform(),
      resetLookGroup: () => this.resetLookGroup(),
      resetObjectGroup: () => this.resetObjectGroup(),
      resetCameraGroup: () => this.resetCameraGroup(),
      resetMotionGroup: () => this.resetMotionGroup(),
      resetStructureGroup: () => this.resetStructureGroup(),
      resetVariantGroup: () => this.resetVariantGroup(),
      selectPart: (id) => this.selectPart(id),
      togglePartVisibility: (id) => this.togglePartVisibility(id),
      showAllParts: () => this.showAllParts(),
      restoreAuthoredVisibility: () => this.restoreAuthoredVisibility(),
      isolateSelectedPart: () => this.isolateSelectedPart(),
      toggleSelectedPart: () => this.toggleSelectedPart(),
      saveVisibilityState: (name) => this.saveVisibilityState(name),
      applyVisibilityState: (id) => this.applyVisibilityState(id),
      deleteVisibilityState: (id) => this.deleteVisibilityState(id),
      createPartAnchor: (name) => this.createPartAnchor(name),
      createTargetAnchor: (name) => this.createTargetAnchor(name),
      setAnchorDisplay: (mode) => this.setAnchorDisplay(mode),
      selectAnchor: (id) => this.selectAnchor(id),
      focusAnchor: (id) => this.focusAnchor(id),
      deleteAnchor: (id) => this.deleteAnchor(id),
      createVariantGroup: (name, required) => this.createVariantGroup(name, required),
      deleteVariantGroup: (id) => this.deleteVariantGroup(id),
      setVariantGroupRequired: (id, required) => this.setVariantGroupRequired(id, required),
      createVariantOption: (payload) => this.createVariantOption(payload),
      deleteVariantOption: (groupId, optionId) => this.deleteVariantOption(groupId, optionId),
      setVariantDefaultOption: (groupId, optionId) => this.setVariantDefaultOption(groupId, optionId),
      activateVariantOption: (groupId, optionId) => this.activateVariantOption(groupId, optionId),
      clearVariantSelection: (groupId) => this.clearVariantSelection(groupId),
      saveVariantConfiguration: (name) => this.saveVariantConfiguration(name),
      applyVariantConfiguration: (id) => this.applyVariantConfiguration(id),
      deleteVariantConfiguration: (id) => this.deleteVariantConfiguration(id),
      setVariantPreviewEnabled: (enabled) => this.setVariantPreviewEnabled(enabled),
      createInfographic: (payload) => this.createInfographic(payload),
      updateInfographic: (id, payload) => this.updateInfographic(id, payload),
      deleteInfographic: (id) => this.deleteInfographic(id),
      selectInfographic: (id) => this.selectInfographic(id),
      setInfographicDisplay: (mode) => this.setInfographicDisplay(mode),
      setInfographicVisible: (id, visible) => this.setInfographicVisible(id, visible),
      focusInfographicAnchor: (id) => this.focusInfographicAnchor(id),
      savePresentation: (name) => this.savePresentation(name),
      applyPresentation: (id) => this.applyPresentation(id),
      deletePresentation: (id) => this.deletePresentation(id),
      setSelectedExplode: (distance, direction) => this.setSelectedExplode(distance, direction),
      clearSelectedExplode: () => this.clearSelectedExplode(),
      clearAllExplode: () => this.clearAllExplode(),
      saveExplodedState: (name) => this.saveExplodedState(name),
      applyExplodedState: (id) => this.applyExplodedState(id),
      deleteExplodedState: (id) => this.deleteExplodedState(id),
      createAnimationChapter: (payload) => this.createAnimationChapter(payload),
      updateAnimationChapter: (id, payload) => this.updateAnimationChapter(id, payload),
      deleteAnimationChapter: (id) => this.deleteAnimationChapter(id),
      previewAnimationChapter: (id) => this.previewAnimationChapter(id),
      createStory: (name, loop) => this.createStory(name, loop),
      updateStory: (id, payload) => this.updateStory(id, payload),
      deleteStory: (id) => this.deleteStory(id),
      selectStory: (id) => this.selectStory(id),
      addStoryStep: (storyId, payload) => this.addStoryStep(storyId, payload),
      updateStoryStep: (storyId, stepId, payload) => this.updateStoryStep(storyId, stepId, payload),
      deleteStoryStep: (storyId, stepId) => this.deleteStoryStep(storyId, stepId),
      moveStoryStep: (storyId, stepId, direction) => this.moveStoryStep(storyId, stepId, direction),
      selectStoryStep: (storyId, stepId) => this.selectStoryStep(storyId, stepId),
      previewStoryStep: (storyId, stepId) => this.previewStoryStep(storyId, stepId),
      toggleStoryPlayback: () => this.toggleStoryPlayback(),
      stopStoryPlayback: () => this.stopStoryPlayback(),
      nextStoryStep: () => this.nextStoryStep(),
      previousStoryStep: () => this.previousStoryStep(),
      setStoryPreviewEnabled: (enabled) => this.setStoryPreviewEnabled(enabled),
      resetStoryGroup: () => this.resetStoryGroup(),
      resetInfographicGroup: () => this.resetInfographicGroup(),
      resetHealthGroup: () => this.resetHealthGroup(),
      resetPublishGroup: () => this.resetPublishGroup(),
      resetAll: () => this.resetAll(),
      fitModel: () => this.fitModel(),
      setFocalLength: (value) => this.setFocalLength(value),
      setCameraTarget: (axis, value) => this.setCameraTarget(axis, value),
      setDamping: (value) => this.setDamping(value),
      setAutoRotate: (enabled) => this.setAutoRotate(enabled),
      setHorizonLocked: (enabled) => this.setHorizonLocked(enabled),
      setInspectMode: (enabled) => this.setInspectMode(enabled),
      setBackfaceRepair: (enabled) => this.setBackfaceRepair(enabled),
      setAutoQuality: (enabled) => this.setAutoQuality(enabled),
      setPauseWhenHidden: (enabled) => this.setPauseWhenHidden(enabled),
      setRecoveryEnabled: (enabled) => this.setRecoveryEnabled(enabled),
      saveRecoveryNow: () => this.saveRecoveryDraft({ force: true }),
      clearRecoveryDraft: () => this.clearRecoveryDraft(),
      restoreRecoveryDraft: () => this.restoreRecoveryDraft(),
      dismissRecoveryDraft: () => this.dismissRecoveryDraft(),
      downloadSupportReport: () => this.downloadSupportReport(),
      selectAnimation: (index) => this.selectAnimation(index),
      toggleAnimationPlayback: () => this.toggleAnimationPlayback(),
      hasAnimations: () => this.motion.clips.length > 0,
      setAnimationLoop: (enabled) => this.setAnimationLoop(enabled),
      setAnimationSpeed: (value) => this.setAnimationSpeed(value),
      setTurntable: (enabled) => this.setTurntable(enabled),
      toggleTurntable: () => this.setTurntable(!this.store.get('project.motion.turntable')),
      setTurntableSpeed: (value) => this.setTurntableSpeed(value),
      setExportFraming: (mode) => this.setExportFraming(mode),
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
      const now = new Date().toISOString();
      const projectId = createProjectId();
      this.sourceAsset = {
        kind: 'embedded-glb',
        name: file.name,
        mimeType: file.type || 'model/gltf-binary',
        file,
        bytes: null,
      };
      this.currentRecentProjectId = null;
      this.projectCreatedAt = now;
      this.projectUpdatedAt = now;
      this.store.patch('project.meta', {
        id: projectId,
        title: stripExtension(file.name),
        createdAt: now,
        updatedAt: now,
      }, { source: 'import' });
      this.#applyPreflightGuardrails({ showMessage: true });
      this.projectDirty = true;
      this.ui.setProjectStateLabel('UNSAVED CHANGES');
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
    this.infographics.reset({ notify: false });
    this.presentations.clear({ notify: false });
    this.stories.clear({ notify: false });
    this.storyPlayer.stop({ notify: false });
    this.variantPreviewEnabled = false;
    this.infographicOverlay?.clear();
    this.motion.setup(animations, result.asset);
    const motionState = this.motion.reset({ notify: false });
    this.modelPreflight = analyzeModelPreflight(result.asset, {
      fileSize: options.fileSize || 0,
      animations,
      maxTextureSize: this.engine.renderer.capabilities.maxTextureSize || 8192,
      deviceMemory: globalThis.navigator?.deviceMemory ?? null,
    });
    const meta = options.procedural ? 'DEMO · READY' : `${formatBytes(options.fileSize)} · READY`;

    this.store.transaction((state) => {
      Object.assign(state.project.model, {
        name: this.product.name,
        fileSize: options.fileSize ?? null,
        procedural: Boolean(options.procedural),
        materialMode: 'original',
        userScale: 1,
        userOffset: 0,
        rotation: { x: 0, y: 0, z: 0 },
        positionXZ: { x: 0, z: 0 },
        backfaceRepairEnabled: false,
        materialSideOverrides: {},
        suggestedMaterialSideOverrideIds: [],
      });
      Object.assign(state.project.motion, {
        clipIndex: motionState.clipIndex,
        playing: motionState.playing,
        loop: motionState.loop,
        speed: motionState.speed,
        time: motionState.time,
        turntable: motionState.turntable,
        turntableSpeed: motionState.turntableSpeed,
        turntableAngle: motionState.turntableAngle,
      });
      state.project.configurator = this.#getConfiguratorState();
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
    this.ui.updateMaterialDiagnostics(result.diagnostics || this.product.getMaterialDiagnostics());
    this.ui.updateStructure(result.structure || this.product.getStructureReport());
    this.ui.updateVariants(result.variants || this.product.getVariantReport(), { previewEnabled: this.variantPreviewEnabled });
    this.#syncInfographicAnchors();
    this.ui.updateInfographics(this.infographics.getReport());
    this.ui.updatePresentations(this.presentations.getReport());
    this.ui.updateStories(this.#getStoryUIReport());
    this.anchorOverlay?.clear();
    this.ui.updatePreflight(this.modelPreflight);
    this.ui.setSystemFooter(
      this.modelPreflight.status === 'ready' ? 'ASSET READY' : this.modelPreflight.status === 'review' ? 'ASSET REVIEW' : 'ASSET HEAVY',
      this.modelPreflight.summary,
    );
    this.ui.updateMotionState(motionState);
    this.studio.markContactShadowDirty();
    this.resetCameraGroup({ showMessage: false, immediate: Boolean(options.immediateCamera) });
    this.#syncDiagnosticsUI(true);
    this.#syncExperienceEditor();
  }

  async saveProject() {
    if (!this.product?.assetRoot) return;
    this.ui.setProjectBusy(true);
    try {
      const now = new Date().toISOString();
      const { blob, project } = await this.#createPortableProjectBlob({ now });
      this.#downloadBlob(blob, projectFilename(project.meta.title || this.product.name));

      this.applyingProject = true;
      this.store.replaceProject(project, { source: 'project-save' });
      this.applyingProject = false;
      this.projectCreatedAt = project.meta.createdAt;
      this.projectUpdatedAt = now;
      this.projectDirty = false;
      this.currentRecentProjectId = project.meta.id;
      this.ui.setProjectStateLabel('SAVED LOCALLY');
      await this.clearRecoveryDraft({ showMessage: false });

      try {
        await this.recentProjects.save({
          id: project.meta.id,
          title: project.meta.title,
          assetName: this.sourceAsset.name,
          blob,
        });
        await this.refreshRecentProjects();
      } catch (recentError) {
        console.warn('Recent-project cache unavailable:', recentError);
      }
      this.ui.showToast('Portable .productvis project saved.');
    } catch (error) {
      console.error(error);
      this.ui.showToast(cleanErrorMessage(error), true, '!');
    } finally {
      this.applyingProject = false;
      this.ui.setProjectBusy(false);
    }
  }

  async openProjectFile(fileOrBlob, { fromRecovery = false } = {}) {
    if (!fileOrBlob) return;
    this.ui.setProjectBusy(true);
    this.ui.showLoading(true, 'Opening project', 12);
    this.applyingProject = true;
    try {
      const decoded = await decodeProjectFile(fileOrBlob);
      if (!decoded.project.meta.id) decoded.project.meta.id = createProjectId();
      if (!decoded.project.meta.title) decoded.project.meta.title = decoded.project.model.name || 'Product VIS Project';
      this.ui.showLoading(true, 'Restoring product', 36);
      let asset;
      let animations = [];
      if (decoded.asset.kind === 'embedded-glb') {
        const glbFile = new File(
          [decoded.asset.bytes],
          decoded.asset.name || 'embedded.glb',
          { type: decoded.asset.mimeType || 'model/gltf-binary' },
        );
        const gltf = await this.loader.loadFile(glbFile, {
          onProgress: (event) => {
            const ratio = event.total ? event.loaded / event.total : 0.5;
            this.ui.showLoading(true, 'Decoding embedded GLB', 36 + Math.round(ratio * 38));
          },
        });
        asset = gltf.scene || gltf.scenes?.[0];
        animations = gltf.animations || [];
        if (!asset) throw new Error('The embedded GLB does not contain a renderable scene.');
        this.sourceAsset = {
          kind: 'embedded-glb',
          name: decoded.asset.name,
          mimeType: decoded.asset.mimeType || 'model/gltf-binary',
          bytes: decoded.asset.bytes,
          file: null,
        };
      } else {
        asset = createDemoProduct();
        this.sourceAsset = { kind: 'procedural-demo', name: 'Demo Object', mimeType: null, bytes: null };
      }

      this.ui.showLoading(true, 'Restoring shot', 82);
      this.setModel(asset, animations, {
        name: decoded.project.model.name,
        fileSize: decoded.project.model.fileSize,
        procedural: decoded.asset.kind !== 'embedded-glb',
        immediateCamera: true,
      });
      this.#applyProjectState(decoded.project);
      this.#applyPreflightGuardrails({ showMessage: false });
      const mergedLooks = this.lookLibrary.merge(decoded.savedLooks);
      this.ui.updateSavedLooks(mergedLooks);
      this.currentRecentProjectId = decoded.project.meta.id;
      this.projectCreatedAt = decoded.project.meta.createdAt;
      this.projectUpdatedAt = decoded.project.meta.updatedAt;
      this.projectDirty = false;
      this.ui.setProjectStateLabel(decoded.migration.migrated ? `MIGRATED V${decoded.migration.sourceVersion} → V10` : 'OPEN · SAVED');
      this.ui.dismissIntro();
      this.store.set('ui.introDismissed', true, { source: 'project-open' });

      const portableBlob = fileOrBlob instanceof Blob ? fileOrBlob : new Blob([fileOrBlob]);
      try {
        await this.recentProjects.save({
          id: decoded.project.meta.id || createProjectId(),
          title: decoded.project.meta.title || decoded.project.model.name,
          assetName: decoded.asset.name,
          blob: portableBlob,
        });
        await this.refreshRecentProjects();
      } catch (recentError) {
        console.warn('Recent-project cache unavailable:', recentError);
      }
      if (!fromRecovery) await this.clearRecoveryDraft({ showMessage: false });
      this.ui.hideRecoveryPrompt();
      this.ui.showToast(decoded.migration.migrated
        ? `Project migrated from schema ${decoded.migration.sourceVersion} to 10.`
        : 'Project restored with its embedded product.');
    } catch (error) {
      console.error(error);
      this.ui.showToast(cleanErrorMessage(error), true, '!');
    } finally {
      this.applyingProject = false;
      this.ui.showLoading(false);
      this.ui.setProjectBusy(false);
    }
  }

  updateExperience(profile, { source = 'publish-control' } = {}) {
    const sanitized = sanitizeExperienceState(profile, this.store.get('project.experience') || DEFAULT_EXPERIENCE_STATE);
    this.store.set('project.experience', sanitized, { source });
    this.#syncExperienceEditor();
    if (this.experienceRuntime.getState().active) this.experienceRuntime.updateProfile(sanitized);
    return sanitized;
  }

  async setExperienceLogo(file) {
    if (!file || !String(file.type || '').startsWith('image/')) {
      this.ui.showToast('Choose a PNG, JPEG, WebP or SVG logo.', true, '!');
      return;
    }
    if (file.size > 768 * 1024) {
      this.ui.showToast('Keep the presentation logo below 768 KB.', true, '!');
      return;
    }
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('The logo could not be read.'));
        reader.readAsDataURL(file);
      });
      const sanitized = sanitizeLogoDataUrl(dataUrl);
      if (!sanitized) throw new Error('The logo format could not be embedded safely.');
      this.updateExperience({ ...this.store.get('project.experience'), logoDataUrl: sanitized });
      this.ui.showToast('Presentation logo embedded locally.');
    } catch (error) {
      this.ui.showToast(cleanErrorMessage(error), true, '!');
    }
  }

  removeExperienceLogo() {
    this.updateExperience({ ...this.store.get('project.experience'), logoDataUrl: null });
    this.ui.showToast('Presentation logo removed.');
  }

  resetPublishGroup({ showMessage = true } = {}) {
    this.updateExperience(DEFAULT_EXPERIENCE_STATE, { source: 'publish-reset' });
    if (showMessage) this.ui.showToast('Publish settings reset.');
  }

  enterExperienceMode({ source = 'editor' } = {}) {
    if (!this.product?.assetRoot) return false;
    const profile = sanitizeExperienceState(this.store.get('project.experience'));
    const story = this.#resolveExperienceStory(profile.entryStoryId);
    if (!this.experienceRuntime.getState().active) this.experienceSnapshot = this.#captureProjectState();
    this.experienceSource = source;
    this.experienceOptionsVisible = Boolean(profile.showOptions);
    this.variantPreviewEnabled = this.experienceOptionsVisible && this.product.getVariantReport().groups.length > 0;
    if (!profile.showInfographics) {
      this.infographics.applyState({ ...this.infographics.getState(), infographicDisplay: 'off' }, { notify: false });
    } else if (profile.infographicMode !== 'inherit') {
      this.infographics.applyState({
        ...this.infographics.getState(),
        infographicDisplay: profile.infographicMode,
      }, { notify: false });
    }
    this.storyPlayer.stop({ notify: false });
    this.cameraRig.setInteractionEnabled(profile.allowOrbit);
    const runtime = this.experienceRuntime.enter(profile, { storyId: story?.id || null, source });
    this.#refreshConfiguratorUI();
    this.ui.closeAdvancedPanel();
    this.ui.toggleProjectMenu(false);
    this.ui.toggleExportMenu(false);
    this.handleResize();
    if (runtime.phase === 'active') this.startExperience();
    return true;
  }

  startExperience({ forcePlay = false } = {}) {
    const runtime = this.experienceRuntime.getState();
    if (!runtime.active) return false;
    this.experienceRuntime.start();
    const profile = sanitizeExperienceState(runtime.profile);
    const story = this.#resolveExperienceStory(runtime.storyId || profile.entryStoryId);
    if (!story?.steps?.length) {
      this.storyPlayer.stop();
      this.experienceRuntime.updateStory(null);
      return true;
    }
    if (forcePlay || profile.autoplay) this.storyPlayer.play(story);
    else this.storyPlayer.preview(story, story.steps[0].id);
    return true;
  }

  restartExperience() {
    if (!this.experienceRuntime.getState().active) return false;
    this.storyPlayer.stop({ notify: false });
    this.experienceRuntime.dismissOutro();
    return this.startExperience({ forcePlay: true });
  }

  exploreExperience() {
    if (!this.experienceRuntime.getState().active) return false;
    this.storyPlayer.stop();
    this.experienceRuntime.dismissOutro();
    this.experienceRuntime.start();
    this.experienceRuntime.updateStory(null);
    this.cameraRig.setInteractionEnabled(this.experienceRuntime.getState().profile.allowOrbit);
    return true;
  }

  exitExperienceMode() {
    if (!this.experienceRuntime.getState().active) return false;
    this.storyPlayer.stop({ notify: false });
    this.experienceRuntime.exit();
    this.cameraRig.setInteractionEnabled(true);
    if (this.experienceSnapshot) {
      const snapshot = this.experienceSnapshot;
      this.experienceSnapshot = null;
      this.#applyProjectState(snapshot);
    }
    this.experienceOptionsVisible = false;
    this.handleResize();
    return true;
  }

  toggleExperienceOptions() {
    const runtime = this.experienceRuntime.getState();
    if (!runtime.active || !runtime.profile.showOptions) return false;
    this.experienceOptionsVisible = !this.experienceOptionsVisible;
    this.variantPreviewEnabled = this.experienceOptionsVisible && this.product.getVariantReport().groups.length > 0;
    this.#refreshConfiguratorUI();
    return this.experienceOptionsVisible;
  }

  goToExperienceStep(stepId) {
    const runtime = this.experienceRuntime.getState();
    const story = this.#resolveExperienceStory(runtime.storyId);
    if (!story || !stepId) return false;
    if (this.storyPlayer.getState().storyId === story.id) return this.storyPlayer.goToStep(stepId, { keepPlaying: false });
    return this.storyPlayer.preview(story, stepId);
  }

  async openExperienceFile(fileOrBlob, { source = 'package' } = {}) {
    if (!fileOrBlob) return;
    this.ui.setProjectBusy(true);
    this.ui.setExperienceBusy(true);
    this.ui.showLoading(true, 'Opening presentation', 12);
    this.applyingProject = true;
    try {
      const decoded = await decodeExperienceFile(fileOrBlob);
      this.ui.showLoading(true, 'Restoring product', 34);
      let asset;
      let animations = [];
      if (decoded.asset.kind === 'embedded-glb') {
        const glbFile = new File([decoded.asset.bytes], decoded.asset.name || 'experience.glb', {
          type: decoded.asset.mimeType || 'model/gltf-binary',
        });
        const gltf = await this.loader.loadFile(glbFile, {
          onProgress: (event) => {
            const ratio = event.total ? event.loaded / event.total : 0.5;
            this.ui.showLoading(true, 'Decoding experience GLB', 34 + Math.round(ratio * 40));
          },
        });
        asset = gltf.scene || gltf.scenes?.[0];
        animations = gltf.animations || [];
        if (!asset) throw new Error('The embedded GLB does not contain a renderable scene.');
        this.sourceAsset = {
          kind: 'embedded-glb',
          name: decoded.asset.name,
          mimeType: decoded.asset.mimeType || 'model/gltf-binary',
          bytes: decoded.asset.bytes,
          file: null,
        };
      } else {
        asset = createDemoProduct();
        this.sourceAsset = { kind: 'procedural-demo', name: 'Demo Object', mimeType: null, bytes: null };
      }
      this.ui.showLoading(true, 'Preparing player', 84);
      this.setModel(asset, animations, {
        name: decoded.project.model.name,
        fileSize: decoded.project.model.fileSize,
        procedural: decoded.asset.kind !== 'embedded-glb',
        immediateCamera: true,
      });
      this.#applyProjectState(decoded.project);
      this.currentRecentProjectId = null;
      this.projectCreatedAt = decoded.project.meta.createdAt;
      this.projectUpdatedAt = decoded.project.meta.updatedAt;
      this.projectDirty = false;
      this.ui.setProjectStateLabel('PUBLISHED EXPERIENCE');
      this.ui.dismissIntro();
      this.enterExperienceMode({ source });
      this.ui.showToast('Branded Product VIS experience opened.');
    } catch (error) {
      console.error(error);
      this.ui.showToast(cleanErrorMessage(error), true, '!');
    } finally {
      this.applyingProject = false;
      this.ui.showLoading(false);
      this.ui.setProjectBusy(false);
      this.ui.setExperienceBusy(false);
    }
  }

  async publishExperience({ share = false } = {}) {
    if (!this.product?.assetRoot) return;
    this.ui.setExperienceBusy(true);
    try {
      const { blob, project } = await this.#createExperienceBlob();
      const filename = experienceFilename(project.experience?.title || project.meta?.title || this.product.name);
      const nav = globalThis.navigator;
      if (share && typeof nav?.share === 'function') {
        const file = new File([blob], filename, { type: EXPERIENCE_FILE_MIME });
        const canShareFiles = typeof nav.canShare !== 'function' || nav.canShare({ files: [file] });
        if (canShareFiles) {
          await nav.share({
            title: project.experience?.title || project.meta?.title || 'Product Experience',
            text: project.experience?.subtitle || 'Interactive Product VIS experience',
            files: [file],
          });
          this.ui.showToast('Experience shared.');
          return;
        }
      }
      this.#downloadBlob(blob, filename);
      this.ui.showToast(share ? 'Sharing is unavailable here, so the experience package was downloaded.' : 'Portable .productvis-show experience downloaded.');
    } catch (error) {
      if (error?.name !== 'AbortError') this.ui.showToast(cleanErrorMessage(error), true, '!');
    } finally {
      this.ui.setExperienceBusy(false);
    }
  }

  async copyExperienceLink() {
    const profile = sanitizeExperienceState(this.store.get('project.experience'));
    if (!profile.share.hostedPackageUrl) {
      this.ui.showToast('Add the hosted .productvis-show URL before copying a player link.', true, '!');
      return;
    }
    try {
      const player = new URL(profile.share.publicPlayerUrl || globalThis.location.href, globalThis.location.href);
      player.search = '';
      player.hash = '';
      player.searchParams.set('experience', new URL(profile.share.hostedPackageUrl, globalThis.location.href).toString());
      const clipboard = globalThis.navigator?.clipboard;
      if (!clipboard?.writeText) throw new Error('Clipboard access is unavailable in this browser.');
      await clipboard.writeText(player.toString());
      this.ui.showToast('Public player link copied.');
    } catch (error) {
      this.ui.showToast(cleanErrorMessage(error), true, '!');
    }
  }

  launchExperienceAr() {
    const profile = sanitizeExperienceState(this.store.get('project.experience'));
    if (!experienceHasArTarget(profile)) {
      this.ui.showToast('Add an Android GLB URL or Apple USDZ URL first.', true, '!');
      return;
    }
    const handoff = launchArHandoff(profile, { baseUrl: globalThis.location?.href });
    if (!handoff.url) this.ui.showToast('No compatible AR handoff is configured for this device.', true, '!');
  }

  saveCurrentLook(name) {
    try {
      const look = this.lookLibrary.add(this.#captureProjectState(), name);
      this.ui.updateSavedLooks(this.lookLibrary.list(), look.id);
      this.ui.clearSavedLookName();
      this.ui.showToast(`${look.name} saved locally.`);
    } catch (error) {
      this.ui.showToast(cleanErrorMessage(error), true, '!');
    }
  }

  applySavedLook(id) {
    const look = this.lookLibrary.get(id);
    if (!look) return;
    this.#applyLookState(look);
    this.ui.showToast(`${look.name} applied.`);
  }

  deleteSavedLook(id) {
    const look = this.lookLibrary.get(id);
    if (!look || !this.lookLibrary.remove(id)) return;
    this.ui.updateSavedLooks(this.lookLibrary.list());
    this.ui.showToast(`${look.name} removed.`);
  }

  async refreshRecentProjects() {
    const projects = await this.recentProjects.list().catch(() => []);
    this.ui.updateRecentProjects(projects);
    return projects;
  }

  async openRecentProject(id) {
    const record = await this.recentProjects.get(id).catch(() => null);
    if (!record?.blob) {
      this.ui.showToast('That recent project is no longer available.', true, '!');
      await this.refreshRecentProjects();
      return;
    }
    await this.openProjectFile(record.blob);
  }

  async removeRecentProject(id) {
    await this.recentProjects.remove(id);
    await this.refreshRecentProjects();
  }

  async saveRecoveryDraft({ silent = false, force = false } = {}) {
    const runtime = this.store.get('project.runtime') || DEFAULT_PROJECT_STATE.runtime;
    if (!this.recoveryReady || !runtime.recoveryEnabled || !this.projectDirty || this.recoveryBusy) return null;
    if (!this.recoveryDrafts.available) {
      this.ui.updateRecoveryStatus(null, { state: 'unavailable' });
      return null;
    }

    const nowMs = Date.now();
    if (!force && nowMs - this.lastRecoverySavedAt < RECOVERY_MIN_INTERVAL_MS) {
      this.#scheduleRecoveryDraft(RECOVERY_MIN_INTERVAL_MS - (nowMs - this.lastRecoverySavedAt));
      return null;
    }

    this.recoveryBusy = true;
    this.ui.updateRecoveryStatus(this.recoveryMetadata, { state: 'saving', message: 'Writing a local browser recovery draft…' });
    try {
      const { blob, project } = await this.#createPortableProjectBlob();
      const metadata = await this.recoveryDrafts.save({
        blob,
        title: project.meta.title,
        assetName: this.sourceAsset.name,
        projectId: project.meta.id,
        schemaVersion: project.schemaVersion,
      });
      this.recoveryMetadata = metadata;
      this.lastRecoverySavedAt = Date.now();
      this.ui.updateRecoveryStatus(metadata, { state: 'saved' });
      if (!silent) this.ui.showToast('Local recovery draft saved.');
      return metadata;
    } catch (error) {
      console.warn('Recovery draft could not be saved:', error);
      this.ui.updateRecoveryStatus(this.recoveryMetadata, { state: 'error', message: cleanErrorMessage(error) });
      if (!silent) this.ui.showToast(cleanErrorMessage(error), true, '!');
      return null;
    } finally {
      this.recoveryBusy = false;
    }
  }

  async clearRecoveryDraft({ showMessage = true } = {}) {
    clearTimeout(this.recoveryTimer);
    this.recoveryTimer = null;
    await this.recoveryDrafts.remove().catch(() => false);
    this.recoveryMetadata = null;
    this.ui.hideRecoveryPrompt();
    const enabled = this.store.get('project.runtime.recoveryEnabled') !== false;
    this.ui.updateRecoveryStatus(null, { state: enabled ? 'idle' : 'disabled' });
    if (showMessage) this.ui.showToast('Local recovery draft cleared.');
  }

  async restoreRecoveryDraft() {
    const record = await this.recoveryDrafts.get().catch(() => null);
    if (!record?.blob) {
      this.ui.hideRecoveryPrompt();
      this.ui.showToast('The recovery draft is no longer available.', true, '!');
      return;
    }
    await this.openProjectFile(record.blob, { fromRecovery: true });
    this.projectDirty = true;
    this.ui.setProjectStateLabel('RECOVERED · UNSAVED');
    this.recoveryMetadata = {
      title: record.title,
      assetName: record.assetName,
      projectId: record.projectId,
      schemaVersion: record.schemaVersion,
      savedAt: record.savedAt,
      size: record.size,
    };
    this.ui.updateRecoveryStatus(this.recoveryMetadata, { state: 'saved' });
    this.ui.hideRecoveryPrompt();
    this.#scheduleRecoveryDraft();
  }

  async dismissRecoveryDraft() {
    await this.clearRecoveryDraft({ showMessage: false });
    this.ui.showToast('Recovery draft dismissed.');
  }

  downloadSupportReport() {
    const rect = this.dom.canvas.getBoundingClientRect();
    const report = createSupportReport({
      appVersion: APP_VERSION,
      project: this.#captureProjectState(),
      modelPreflight: this.modelPreflight,
      materialDiagnostics: this.product.getMaterialDiagnostics(),
      cameraDiagnostics: this.cameraRig.getDiagnostics(),
      performance: this.performanceMonitor.getSnapshot(),
      rendererCapabilities: this.engine.getCapabilities(),
      recovery: this.recoveryMetadata,
      viewport: {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        devicePixelRatio: globalThis.devicePixelRatio || 1,
      },
    });
    const blob = new Blob([`${JSON.stringify(report, null, 2)}
`], { type: 'application/json' });
    const filename = `${projectFilename(this.product.name).replace(/\.productvis$/i, '')}-support.json`;
    this.#downloadBlob(blob, filename);
    this.ui.showToast('Local support report downloaded.');
  }

  setExportFraming(mode, { showMessage = false } = {}) {
    const value = mode === 'fill' ? 'fill' : 'match-viewport';
    this.store.set('project.render.exportFraming', value, { source: 'control' });
    this.ui.setExportFraming(value === 'fill' ? 'fill' : 'match');
    if (showMessage) this.ui.showToast(value === 'fill' ? 'Export will fill the frame.' : 'Export will preserve viewport framing.');
  }

  applyBackdropPreset(name, { immediate = false, showMessage = true } = {}) {
    const preset = BACKDROP_PRESETS[name];
    if (!preset) return;
    this.studio.applyBackdropPreset(preset, { immediate });
    this.store.patch('project.studio', {
      preset: name,
      backdropPreset: name,
      backdropTone: preset.backdropTone,
    }, { source: 'backdrop-preset' });
    this.ui.setBackdropPresetActive(name);
    this.ui.setBackdropToneInput(preset.backdropTone);
    if (showMessage) this.ui.showToast(`${preset.label || capitalize(name)} background active.`);
  }

  // Stable compatibility alias for earlier checkpoints.
  applyLookPreset(name, options = {}) {
    this.applyBackdropPreset(name, options);
  }

  applyLightingPreset(name, { immediate = false, showMessage = true } = {}) {
    const preset = LIGHT_PRESETS[name];
    if (!preset) return;
    this.studio.applyLightingPreset(preset, { immediate });
    this.store.patch('project.studio', {
      lightingPreset: name,
      exposure: preset.exposure,
      environment: preset.environment,
      environmentRotation: preset.environmentRotation,
      key: preset.key,
      fill: preset.fill,
      rim: preset.rim,
      bloom: preset.bloom,
      shadow: preset.shadow,
      shadowSoftness: preset.shadowSoftness,
    }, { source: 'lighting-preset' });
    this.ui.setLightingPresetActive(name);
    this.ui.setLightingInputs(preset);
    if (showMessage) this.ui.showToast(`${preset.label || capitalize(name)} lighting active.`);
  }

  #markBackdropCustom() {
    this.studio.cancelBackdropTween();
    this.store.patch('project.studio', {
      preset: null,
      backdropPreset: null,
    }, { source: 'control' });
    this.ui.clearBackdropPresetActive();
  }

  #markLightingCustom() {
    this.studio.cancelLightingTween();
    this.store.set('project.studio.lightingPreset', null, { source: 'control' });
    this.ui.clearLightingPresetActive();
  }

  setBackdropTone(value) {
    this.#markBackdropCustom();
    this.studio.setBackdropTone(value);
    this.store.set('project.studio.backdropTone', value, { source: 'control' });
    this.ui.setBackdropToneInput(value);
  }

  setExposure(value) {
    this.#markLightingCustom();
    this.studio.setExposure(value);
    this.store.set('project.studio.exposure', value, { source: 'control' });
    this.ui.setLightingControl('exposure', value);
  }

  setEnvironment(value) {
    this.#markLightingCustom();
    this.studio.setEnvironmentIntensity(value);
    this.store.set('project.studio.environment', value, { source: 'control' });
    this.ui.setLightingControl('environment', value);
  }

  setEnvironmentRotation(value) {
    this.#markLightingCustom();
    this.studio.setEnvironmentRotation(value);
    this.store.set('project.studio.environmentRotation', value, { source: 'control' });
    this.ui.setLightingControl('environmentRotation', value);
  }

  setKey(value) {
    this.#markLightingCustom();
    this.studio.setKeyIntensity(value);
    this.store.set('project.studio.key', value, { source: 'control' });
    this.ui.setLightingControl('key', value);
  }

  setFill(value) {
    this.#markLightingCustom();
    this.studio.setFillIntensity(value);
    this.store.set('project.studio.fill', value, { source: 'control' });
    this.ui.setLightingControl('fill', value);
  }

  setRim(value) {
    this.#markLightingCustom();
    this.studio.setRimIntensity(value);
    this.store.set('project.studio.rim', value, { source: 'control' });
    this.ui.setLightingControl('rim', value);
  }

  setBloom(value) {
    this.#markLightingCustom();
    this.studio.setBloom(value);
    this.store.set('project.studio.bloom', value, { source: 'control' });
    this.ui.setLightingControl('bloom', value);
  }

  setGroundOffset(value, { showMessage = false } = {}) {
    this.studio.setGroundOffset(value);
    this.store.set('project.studio.groundOffset', value, { source: 'control' });
    this.ui.setGroundControl('offset', value);
    if (showMessage) this.ui.showToast('Ground offset updated.');
  }

  setShadowOpacity(value) {
    this.#markLightingCustom();
    this.studio.setShadowOpacity(value);
    this.store.set('project.studio.shadow', value, { source: 'control' });
    this.ui.setGroundControl('shadow', value);
  }

  setShadowSoftness(value) {
    this.#markLightingCustom();
    this.studio.setShadowSoftness(value);
    this.store.set('project.studio.shadowSoftness', value, { source: 'control' });
    this.ui.setGroundControl('softness', value);
  }

  setFloorEnabled(enabled) {
    this.studio.setFloorEnabled(enabled);
    this.store.set('project.studio.floorEnabled', Boolean(enabled), { source: 'control' });
    this.ui.setStudioToggle('floor', enabled);
  }

  setShadowsEnabled(enabled) {
    this.studio.setShadowsEnabled(enabled);
    this.product.setShadowsEnabled(enabled);
    this.store.set('project.studio.shadowsEnabled', Boolean(enabled), { source: 'control' });
    this.ui.setStudioToggle('shadow', enabled);
  }

  setPostEnabled(enabled) {
    this.engine.setPostEnabled(enabled);
    this.store.set('project.studio.postEnabled', Boolean(enabled), { source: 'control' });
    this.ui.setStudioToggle('post', enabled);
  }

  setScale(value) {
    this.product.setUserScale(value);
    this.store.set('project.model.userScale', value, { source: 'control' });
    this.ui.updateTransformUI(value, this.product.userOffset);
  }

  setOffset(value) {
    this.product.setUserOffset(value);
    this.store.set('project.model.userOffset', value, { source: 'control' });
    this.ui.updateTransformUI(this.product.userScale, value);
  }

  rotateObject(axis) {
    this.product.rotate(axis, () => {
      const transform = this.product.getTransformState();
      this.store.patch('project.model', { rotation: transform.rotation, positionXZ: transform.positionXZ }, { source: 'action' });
      this.fitModel();
    });
  }

  centerObject() {
    const positionXZ = this.product.center();
    this.store.set('project.model.positionXZ', positionXZ || { x: 0, z: 0 }, { source: 'action' });
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
    this.store.patch('project.model', {
      userScale: 1,
      userOffset: 0,
      rotation: { x: 0, y: 0, z: 0 },
      positionXZ: { x: 0, z: 0 },
    }, { source: 'action' });
    this.ui.updateTransformUI(1, 0);
    this.#syncDiagnosticsUI(true);
    if (showMessage) this.ui.showToast('Object transform reset.');
  }

  setMaterialMode(mode, { showMessage = true } = {}) {
    if (!this.product.setMaterialMode(mode)) return;
    this.store.set('project.model.materialMode', mode, { source: 'control' });
    this.ui.setMaterialMode(mode);
    this.ui.updateMaterialDiagnostics(this.product.getMaterialDiagnostics());
    if (showMessage) this.ui.showToast(`${capitalize(mode)} material treatment applied.`);
  }

  setBackfaceRepair(enabled, { showMessage = true } = {}) {
    const state = this.product.setBackfaceRepairEnabled(enabled);
    this.store.set('project.model.backfaceRepairEnabled', state, { source: 'control' });
    this.store.set('project.model.materialSideOverrides', this.product.getMaterialSideOverrides(), { source: 'material-repair' });
    this.store.set('project.model.suggestedMaterialSideOverrideIds', this.product.getSuggestedMaterialSideOverrideIds(), { source: 'material-repair' });
    this.ui.setBackfaceRepair(state);
    this.ui.updateMaterialDiagnostics(this.product.getMaterialDiagnostics());
    if (showMessage) {
      this.ui.showToast(state
        ? 'Suggested thin-surface repairs applied as explicit Double overrides.'
        : 'Suggested repairs removed; imported side policies restored.');
    }
  }

  setMaterialSideOverride(materialId, mode, { showMessage = true } = {}) {
    if (!this.product.setMaterialSideOverride(materialId, mode)) return;
    const overrides = this.product.getMaterialSideOverrides();
    this.store.set('project.model.materialSideOverrides', overrides, { source: 'material-repair' });
    this.store.set('project.model.suggestedMaterialSideOverrideIds', this.product.getSuggestedMaterialSideOverrideIds(), { source: 'material-repair' });
    this.ui.updateMaterialDiagnostics(this.product.getMaterialDiagnostics());
    if (showMessage) {
      const label = mode === 'auto' ? 'Auto side policy restored.' : `${capitalize(mode)} side override applied.`;
      this.ui.showToast(label);
    }
  }

  setQuality(mode, { showMessage = true, source = 'control' } = {}) {
    const profile = this.engine.setQuality(mode);
    if (!profile) return false;
    this.studio.setShadowQuality(profile);
    this.store.set('project.render.quality', mode, { source });
    this.ui.setQuality(mode);
    this.performanceMonitor.markQualityChange();
    this.handleResize();
    this.#syncRuntimeUI(true);
    if (showMessage) this.ui.showToast(`${capitalize(mode)} render mode active.`);
    return true;
  }

  setAutoQuality(enabled, { showMessage = true } = {}) {
    const value = Boolean(enabled);
    this.store.set('project.runtime.autoQuality', value, { source: 'runtime-control' });
    this.performanceMonitor.reset();
    this.ui.setRuntimePreferences({ autoQuality: value });
    this.#syncRuntimeUI(true);
    if (showMessage) this.ui.showToast(value ? 'Auto quality enabled.' : 'Auto quality disabled.');
  }

  setPauseWhenHidden(enabled, { showMessage = true } = {}) {
    const value = Boolean(enabled);
    this.store.set('project.runtime.pauseWhenHidden', value, { source: 'runtime-control' });
    this.ui.setRuntimePreferences({ pauseWhenHidden: value });
    this.#handleVisibilityChange();
    if (showMessage) this.ui.showToast(value ? 'Hidden-tab rendering will pause.' : 'Hidden-tab rendering will continue.');
  }

  setRecoveryEnabled(enabled, { showMessage = true } = {}) {
    const value = Boolean(enabled);
    this.store.set('project.runtime.recoveryEnabled', value, { source: 'runtime-control' });
    this.ui.setRuntimePreferences({ recoveryEnabled: value });
    if (!value) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
      this.clearRecoveryDraft({ showMessage: false });
      this.ui.updateRecoveryStatus(null, { state: 'disabled' });
    } else {
      this.#refreshRecoveryDraft();
      this.#scheduleRecoveryDraft();
    }
    if (showMessage) this.ui.showToast(value ? 'Local recovery drafts enabled.' : 'Local recovery drafts disabled.');
  }

  setCameraPreset(name, { immediate = false } = {}) {
    this.product.updateBounds({ updateShadowScale: false });
    if (!this.cameraRig.setPreset(name, { immediate })) return;
    const target = { ...this.cameraRig.targetNormalized };
    this.store.patch('project.camera', { preset: name, target }, { source: 'control' });
    this.ui.setCameraButtons(name);
    this.ui.updateCameraTargetUI(target);
    this.#syncDiagnosticsUI(true);
  }

  fitModel({ immediate = false } = {}) {
    this.product.updateBounds({ updateShadowScale: false });
    if (!this.cameraRig.fit({ immediate })) return;
    const target = { ...this.cameraRig.targetNormalized };
    this.store.patch('project.camera', { preset: null, target }, { source: 'action' });
    this.ui.setCameraButtons(null);
    this.ui.updateCameraTargetUI(target);
    this.#syncDiagnosticsUI(true);
  }

  setFocalLength(value) {
    const focal = this.cameraRig.setFocalLength(value);
    this.store.set('project.camera.focalLength', focal, { source: 'control' });
    this.ui.setCameraControl('focal', focal);
    this.#syncDiagnosticsUI(true);
  }

  setCameraTarget(axis, value) {
    const target = this.cameraRig.setTargetAxis(axis, value);
    if (!target) return;
    this.store.patch('project.camera', { preset: null, target }, { source: 'control' });
    this.ui.setCameraButtons(null);
    this.ui.updateCameraTargetUI(target);
    this.#syncDiagnosticsUI(true);
  }

  setDamping(value) {
    const damping = this.cameraRig.setDamping(value);
    this.store.set('project.camera.damping', damping, { source: 'control' });
    this.ui.setCameraControl('damping', damping);
  }

  setAutoRotate(enabled) {
    this.cameraRig.setAutoRotate(enabled);
    this.store.set('project.camera.autoRotate', Boolean(enabled), { source: 'control' });
    this.ui.setCameraToggle('autoRotate', enabled);
  }

  setHorizonLocked(enabled) {
    this.cameraRig.setHorizonLocked(enabled);
    this.store.set('project.camera.horizonLocked', Boolean(enabled), { source: 'control' });
    this.ui.setCameraToggle('horizon', enabled);
  }

  setInspectMode(enabled, { showMessage = true } = {}) {
    const mode = this.cameraRig.setInspectMode(enabled);
    const target = { ...this.cameraRig.targetNormalized };
    this.store.patch('project.camera', { mode, target }, { source: 'control' });
    this.ui.setInspectMode(mode === 'inspect');
    this.ui.updateCameraTargetUI(target);
    this.#syncDiagnosticsUI(true);
    if (showMessage) {
      this.ui.showToast(mode === 'inspect'
        ? 'Inspect mode active. Camera safety is relaxed for close review.'
        : 'Presentation mode active. Camera safety is locked for clean shots.');
    }
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

  selectPart(id) {
    this.product.selectPart(id);
    this.ui.updateStructure(this.product.getStructureReport());
  }

  togglePartVisibility(id) {
    if (!this.product.togglePartVisibility(id)) return;
    this.#commitStructureState('part-visibility');
  }

  showAllParts() {
    this.product.showAllParts();
    this.#commitStructureState('part-visibility');
    this.ui.showToast('All product parts are visible.');
  }

  restoreAuthoredVisibility() {
    this.product.resetPartVisibility();
    this.#commitStructureState('part-visibility');
    this.ui.showToast('Authored GLB visibility restored.');
  }

  isolateSelectedPart() {
    const selected = this.product.getStructureReport().selectedPart;
    if (!selected || !this.product.isolatePart(selected.id)) return;
    this.#commitStructureState('part-isolate');
    this.ui.showToast(`${selected.label} isolated.`);
  }

  toggleSelectedPart() {
    const selected = this.product.getStructureReport().selectedPart;
    if (selected) this.togglePartVisibility(selected.id);
  }

  saveVisibilityState(name) {
    const state = this.product.captureVisibilityState(name);
    if (!state) return;
    this.#commitStructureState('visibility-state');
    this.ui.clearStructureInputs();
    this.ui.showToast(`${state.name} visibility state saved.`);
  }

  applyVisibilityState(id) {
    if (!id || !this.product.applyVisibilityState(id)) return;
    this.#commitStructureState('visibility-state');
    this.ui.showToast('Visibility state applied.');
  }

  deleteVisibilityState(id) {
    if (!id || !this.product.deleteVisibilityState(id)) return;
    this.#commitStructureState('visibility-state');
    this.ui.showToast('Visibility state deleted.');
  }

  createPartAnchor(name) {
    const anchor = this.product.createAnchorAtPart(undefined, name);
    if (!anchor) {
      this.ui.showToast('Select a product part before creating a part anchor.', true, '!');
      return;
    }
    this.#commitStructureState('anchor');
    this.ui.clearStructureInputs();
    this.ui.showToast(`${anchor.name} anchor created.`);
  }

  createTargetAnchor(name) {
    const target = this.cameraRig.getTargetWorld();
    const anchor = this.product.createAnchorAtWorld(target, name);
    if (!anchor) return;
    this.#commitStructureState('anchor');
    this.ui.clearStructureInputs();
    this.ui.showToast(`${anchor.name} anchor created at the camera target.`);
  }

  setAnchorDisplay(mode) {
    this.product.setAnchorDisplay(mode);
    this.#commitStructureState('anchor-display');
  }

  selectAnchor(id) {
    this.product.selectAnchor(id);
    this.#commitStructureState('anchor-select');
  }

  focusAnchor(id) {
    const world = this.product.getAnchorWorldPosition(id);
    if (!world) {
      this.ui.showToast('This anchor could not be resolved on the current product.', true, '!');
      return;
    }
    this.product.selectAnchor(id);
    const target = this.cameraRig.setTargetWorld(world);
    if (target) {
      this.store.patch('project.camera', { preset: null, target }, { source: 'anchor-focus' });
      this.ui.setCameraButtons(null);
      this.ui.updateCameraTargetUI(target);
    }
    this.#commitStructureState('anchor-focus');
    this.ui.showToast('Camera focused on the selected anchor.');
  }

  deleteAnchor(id) {
    if (!id || !this.product.deleteAnchor(id)) return;
    this.#commitStructureState('anchor');
    this.ui.showToast('Product anchor deleted.');
  }

  #getConfiguratorState() {
    return {
      ...this.product.getStructureState(),
      variantPreviewEnabled: this.variantPreviewEnabled,
      ...this.infographics.getState(),
      ...this.presentations.getState(),
      ...this.stories.getState(),
    };
  }

  #syncInfographicAnchors() {
    const markers = this.product.getAnchorMarkers();
    this.infographics.setAnchorMarkers(markers);
    return markers;
  }

  #refreshConfiguratorUI() {
    this.#syncInfographicAnchors();
    this.ui.updateStructure(this.product.getStructureReport());
    this.ui.updateVariants(this.product.getVariantReport(), { previewEnabled: this.variantPreviewEnabled });
    this.ui.updateInfographics(this.infographics.getReport());
    this.ui.updatePresentations(this.presentations.getReport());
    this.ui.updateStories(this.#getStoryUIReport());
    this.#syncExperienceEditor();
  }

  #commitStructureState(source = 'configurator') {
    const state = this.#getConfiguratorState();
    this.store.set('project.configurator', state, { source });
    this.#refreshConfiguratorUI();
    this.studio.markContactShadowDirty();
    this.#syncDiagnosticsUI(true);
  }

  createVariantGroup(name, required = true) {
    const group = this.product.createVariantGroup(name, { required: required !== false });
    if (!group) {
      this.ui.showToast('Variant group limit reached.', true, '!');
      return;
    }
    this.#commitStructureState('variant-group');
    this.ui.selectVariantGroup(group.id);
    this.ui.clearVariantInputs();
    this.ui.showToast(`${group.name} group created.`);
  }

  deleteVariantGroup(id) {
    if (!id || !this.product.deleteVariantGroup(id)) return;
    this.#commitStructureState('variant-group');
    this.ui.showToast('Variant group deleted.');
  }

  setVariantGroupRequired(id, required) {
    if (!id || !this.product.setVariantGroupRequired(id, required)) return;
    this.#commitStructureState('variant-group');
  }

  createVariantOption(payload = {}) {
    const groupId = payload.groupId;
    const selected = this.product.getStructureReport().selectedPart;
    if (!groupId) {
      this.ui.showToast('Create or select an option group first.', true, '!');
      return;
    }
    if (!selected) {
      this.ui.showToast('Select a product part in Parts before creating an option.', true, '!');
      return;
    }
    const finish = VARIANT_FINISHES[payload.finish] || VARIANT_FINISHES.original;
    const appearance = payload.includeAppearance === false
      ? {}
      : { [selected.id]: { color: payload.color || '#ff7950', ...finish } };
    const visibility = payload.visibility === 'show'
      ? { [selected.id]: true }
      : payload.visibility === 'hide'
        ? { [selected.id]: false }
        : {};
    const option = this.product.createVariantOption(groupId, {
      name: payload.name,
      swatch: payload.includeAppearance === false ? null : payload.color,
      appearance,
      visibility,
    });
    if (!option) {
      this.ui.showToast('Choose an appearance or visibility change for this option.', true, '!');
      return;
    }
    this.#commitStructureState('variant-option');
    this.ui.clearVariantInputs();
    this.ui.showToast(`${option.name} option created and activated.`);
  }

  deleteVariantOption(groupId, optionId) {
    if (!groupId || !optionId || !this.product.deleteVariantOption(groupId, optionId)) return;
    this.#commitStructureState('variant-option');
    this.ui.showToast('Variant option deleted.');
  }

  setVariantDefaultOption(groupId, optionId) {
    if (!this.product.setVariantDefaultOption(groupId, optionId)) return;
    this.#commitStructureState('variant-default');
    this.ui.showToast('Default option updated.');
  }

  activateVariantOption(groupId, optionId) {
    if (!this.product.activateVariantOption(groupId, optionId)) return;
    this.#commitStructureState('variant-selection');
  }

  clearVariantSelection(groupId) {
    if (!this.product.clearVariantSelection(groupId)) return;
    this.#commitStructureState('variant-selection');
  }

  saveVariantConfiguration(name) {
    const configuration = this.product.captureVariantConfiguration(name);
    if (!configuration) {
      this.ui.showToast('Configuration limit reached.', true, '!');
      return;
    }
    this.#commitStructureState('variant-configuration');
    this.ui.clearVariantInputs();
    this.ui.showToast(`${configuration.name} configuration saved.`);
  }

  applyVariantConfiguration(id) {
    if (!id || !this.product.applyVariantConfiguration(id)) return;
    this.#commitStructureState('variant-configuration');
    this.ui.showToast('Product configuration applied.');
  }

  deleteVariantConfiguration(id) {
    if (!id || !this.product.deleteVariantConfiguration(id)) return;
    this.#commitStructureState('variant-configuration');
    this.ui.showToast('Product configuration deleted.');
  }

  setVariantPreviewEnabled(enabled, { showMessage = false } = {}) {
    this.variantPreviewEnabled = Boolean(enabled);
    this.#commitStructureState('variant-preview');
    if (showMessage) {
      this.ui.showToast(this.variantPreviewEnabled
        ? 'Viewport option tray enabled.'
        : 'Viewport option tray hidden.');
    }
  }

  resetVariantGroup({ showMessage = true } = {}) {
    this.product.resetVariantSelections();
    this.variantPreviewEnabled = false;
    this.#commitStructureState('variant-reset');
    if (showMessage) this.ui.showToast('Variant selections and viewport tray reset.');
  }

  createInfographic(payload = {}) {
    const markers = this.#syncInfographicAnchors();
    const fallbackAnchorId = this.product.getStructureState().selectedAnchorId;
    const anchorId = payload.anchorId || fallbackAnchorId;
    if (!anchorId || !markers.some((marker) => marker.id === anchorId)) {
      this.ui.showToast('Create or select a product anchor before adding an infographic.', true, '!');
      return;
    }
    const record = this.infographics.create({ ...payload, anchorId });
    if (!record) {
      this.ui.showToast('Infographic limit reached or anchor is invalid.', true, '!');
      return;
    }
    this.#commitStructureState('infographic-create');
    this.ui.selectInfographic(record.id);
    this.ui.showToast(`${record.title} infographic created.`);
  }

  updateInfographic(id, payload = {}) {
    const record = this.infographics.update(id, payload);
    if (!record) return;
    this.#commitStructureState('infographic-update');
    this.ui.showToast(`${record.title} updated.`);
  }

  deleteInfographic(id) {
    if (!this.infographics.delete(id)) return;
    this.#commitStructureState('infographic-delete');
    this.ui.showToast('Infographic deleted.');
  }

  selectInfographic(id) {
    this.infographics.select(id);
    this.#commitStructureState('infographic-select');
  }

  setInfographicDisplay(mode) {
    this.infographics.setDisplay(mode);
    this.#commitStructureState('infographic-display');
  }

  setInfographicVisible(id, visible) {
    if (!id || !this.infographics.setVisible(id, visible)) return;
    this.#commitStructureState('infographic-visibility');
  }

  focusInfographicAnchor(id) {
    const record = this.infographics.get(id);
    if (!record) return;
    this.infographics.select(id);
    this.focusAnchor(record.anchorId);
    this.#commitStructureState('infographic-focus');
  }

  savePresentation(name) {
    const presentation = this.presentations.capture(name, this.#capturePresentationSnapshot());
    if (!presentation) {
      this.ui.showToast('Presentation state limit reached.', true, '!');
      return;
    }
    this.#commitStructureState('presentation-save');
    this.ui.clearPresentationInput();
    this.ui.showToast(`${presentation.name} presentation saved.`);
  }

  applyPresentation(id, { showMessage = true, cameraTransition = null } = {}) {
    if (!id) return false;
    const applied = this.presentations.apply(
      id,
      (snapshot) => this.#applyPresentationSnapshot(snapshot, { cameraTransition }),
    );
    if (!applied) return false;
    if (showMessage) this.ui.showToast('Presentation applied. Motion was left untouched.');
    return true;
  }

  deletePresentation(id) {
    if (!id || !this.presentations.delete(id)) return;
    this.#commitStructureState('presentation-delete');
    this.ui.showToast('Presentation state deleted.');
  }

  setSelectedExplode(distance, direction = 'auto') {
    const selected = this.product.getStructureReport().selectedPart;
    if (!selected) {
      this.ui.showToast('Select a product part before setting an exploded offset.', true, '!');
      return;
    }
    if (!this.product.setPartExplosionDistance(selected.id, distance, direction)) return;
    this.#commitStructureState('story-explode');
    this.ui.showToast(Number(distance) > 0 ? `${selected.label} exploded offset updated.` : `${selected.label} returned to authored position.`);
  }

  clearSelectedExplode() {
    const selected = this.product.getStructureReport().selectedPart;
    if (!selected || !this.product.clearPartExplosion(selected.id)) return;
    this.#commitStructureState('story-explode');
    this.ui.showToast(`${selected.label} returned to authored position.`);
  }

  clearAllExplode() {
    this.product.clearExplosion({ duration: 0 });
    this.#commitStructureState('story-explode');
    this.ui.showToast('All product parts returned to the assembled position.');
  }

  saveExplodedState(name) {
    const state = this.product.captureExplodedState(name);
    if (!state) {
      this.ui.showToast('Exploded-state limit reached.', true, '!');
      return;
    }
    this.#commitStructureState('story-explode-state');
    this.ui.clearStoryInputs?.('explode');
    this.ui.showToast(`${state.name} exploded state saved.`);
  }

  applyExplodedState(id, { duration = 1.2, easing = 'cinematic', showMessage = true } = {}) {
    if (!id || !this.product.applyExplodedState(id, { duration, easing })) return false;
    this.store.set('project.configurator', this.#getConfiguratorState(), { source: 'story-runtime' });
    this.ui.updateStories(this.#getStoryUIReport());
    this.studio.markContactShadowDirty();
    if (showMessage) this.ui.showToast('Exploded state applied.');
    return true;
  }

  deleteExplodedState(id) {
    if (!id || !this.product.deleteExplodedState(id)) return;
    this.#commitStructureState('story-explode-state');
    this.ui.showToast('Exploded state deleted.');
  }

  createAnimationChapter(payload = {}) {
    const chapter = this.stories.createChapter(payload);
    if (!chapter) {
      this.ui.showToast('Animation chapter limit reached.', true, '!');
      return;
    }
    this.#commitStructureState('story-chapter');
    this.ui.clearStoryInputs?.('chapter');
    this.ui.showToast(`${chapter.name} chapter created.`);
  }

  updateAnimationChapter(id, payload = {}) {
    const chapter = this.stories.updateChapter(id, payload);
    if (!chapter) return;
    this.#commitStructureState('story-chapter');
    this.ui.showToast(`${chapter.name} chapter updated.`);
  }

  deleteAnimationChapter(id) {
    if (!id || !this.stories.deleteChapter(id)) return;
    if (this.storyPlayer.getState().playing) this.stopStoryPlayback();
    else this.motion.clearChapter({ pause: true, notify: true });
    this.#commitStructureState('story-chapter');
    this.ui.showToast('Animation chapter deleted.');
  }

  previewAnimationChapter(id) {
    const chapter = this.stories.getChapter(id);
    const clip = chapter ? this.motion.clips[chapter.clipIndex] : null;
    const resolved = chapter && clip ? resolveChapterRange(chapter, clip.duration) : null;
    if (!resolved?.valid || !this.motion.playChapter(resolved)) {
      this.ui.showToast('This chapter cannot play with the current GLB animation set.', true, '!');
      return;
    }
    this.ui.showToast(`${chapter.name} chapter previewing.`);
  }

  createStory(name, loop = false) {
    const story = this.stories.createStory(name, { loop });
    if (!story) {
      this.ui.showToast('Story limit reached.', true, '!');
      return;
    }
    this.#commitStructureState('story-authoring');
    this.ui.showToast(`${story.name} story created.`);
  }

  updateStory(id, payload = {}) {
    const story = this.stories.updateStory(id, payload);
    if (!story) return;
    this.#commitStructureState('story-authoring');
  }

  deleteStory(id) {
    if (!id || !this.stories.deleteStory(id)) return;
    if (this.storyPlayer.getState().storyId === id) this.stopStoryPlayback();
    this.#commitStructureState('story-authoring');
    this.ui.showToast('Story deleted.');
  }

  selectStory(id) {
    this.stories.selectStory(id);
    this.store.set('project.configurator', this.#getConfiguratorState(), { source: 'story-runtime' });
    this.ui.updateStories(this.#getStoryUIReport());
  }

  addStoryStep(storyId, payload = {}) {
    const step = this.stories.addStep(storyId, payload);
    if (!step) {
      this.ui.showToast('Create a story first, or the story has reached its step limit.', true, '!');
      return;
    }
    this.#commitStructureState('story-authoring');
    this.ui.showToast(`${step.name} added to the story.`);
  }

  updateStoryStep(storyId, stepId, payload = {}) {
    const step = this.stories.updateStep(storyId, stepId, payload);
    if (!step) return;
    this.#commitStructureState('story-authoring');
    this.ui.showToast(`${step.name} updated.`);
  }

  deleteStoryStep(storyId, stepId) {
    if (!this.stories.deleteStep(storyId, stepId)) return;
    this.#commitStructureState('story-authoring');
    this.ui.showToast('Story step deleted.');
  }

  moveStoryStep(storyId, stepId, direction) {
    if (!this.stories.moveStep(storyId, stepId, direction)) return;
    this.#commitStructureState('story-authoring');
  }

  selectStoryStep(storyId, stepId) {
    this.stories.selectStep(storyId, stepId);
    this.store.set('project.configurator', this.#getConfiguratorState(), { source: 'story-runtime' });
    this.ui.updateStories(this.#getStoryUIReport());
  }

  previewStoryStep(storyId, stepId) {
    const story = this.stories.getStory(storyId);
    if (!story || !this.storyPlayer.preview(story, stepId)) return;
    this.stories.selectStep(storyId, stepId);
    this.store.set('project.configurator', this.#getConfiguratorState(), { source: 'story-runtime' });
    this.ui.updateStories(this.#getStoryUIReport());
  }

  toggleStoryPlayback() {
    const player = this.storyPlayer.getState();
    if (player.playing) {
      this.storyPlayer.toggle();
      return;
    }
    const experienceState = this.experienceRuntime.getState();
    const story = experienceState.active
      ? this.#resolveExperienceStory(experienceState.storyId)
      : this.stories.getStory();
    if (!story?.steps?.length) {
      this.ui.showToast('Create a story with at least one step before playback.', true, '!');
      return;
    }
    this.stories.selectStory(story.id);
    this.stories.setPreviewEnabled(true);
    this.store.set('project.configurator', this.#getConfiguratorState(), { source: 'story-runtime' });
    this.storyPlayer.play(story, { stepId: this.stories.activeStoryStepId });
  }

  stopStoryPlayback() {
    this.storyPlayer.stop();
    this.product.updateBounds({ updateShadowScale: true });
    this.studio.markContactShadowDirty();
  }

  nextStoryStep() {
    const state = this.storyPlayer.getState();
    if (state.storyId) {
      this.storyPlayer.next({ keepPlaying: state.playing && !state.paused });
      return;
    }
    const story = this.stories.getStory();
    if (!story?.steps?.length) return;
    const current = Math.max(0, story.steps.findIndex((step) => step.id === this.stories.activeStoryStepId));
    const next = story.steps[Math.min(story.steps.length - 1, current + 1)];
    if (next) this.previewStoryStep(story.id, next.id);
  }

  previousStoryStep() {
    const state = this.storyPlayer.getState();
    if (state.storyId) {
      this.storyPlayer.previous({ keepPlaying: state.playing && !state.paused });
      return;
    }
    const story = this.stories.getStory();
    if (!story?.steps?.length) return;
    const current = Math.max(0, story.steps.findIndex((step) => step.id === this.stories.activeStoryStepId));
    const previous = story.steps[Math.max(0, current - 1)];
    if (previous) this.previewStoryStep(story.id, previous.id);
  }

  setStoryPreviewEnabled(enabled) {
    this.stories.setPreviewEnabled(enabled);
    if (!enabled) this.stopStoryPlayback();
    this.#commitStructureState('story-preview');
  }

  resetStoryGroup({ showMessage = true } = {}) {
    this.storyPlayer.stop({ notify: false });
    this.motion.clearChapter({ pause: true, notify: false });
    this.product.resetExplosion({ clearLibrary: true });
    this.stories.clear({ notify: false });
    this.#commitStructureState('story-reset');
    this.ui.updateStoryPlayer(this.storyPlayer.getState());
    if (showMessage) this.ui.showToast('Exploded states, chapters and stories reset.');
  }

  #getStoryUIReport() {
    const storyReport = this.stories.getReport();
    return {
      ...storyReport,
      explosion: this.product?.getExplosionReport?.() || { explodeOffsets: {}, explodeStates: [], offsetCount: 0, stateCount: 0 },
      player: this.storyPlayer.getState(),
      clips: (this.motion?.clips || []).map((clip, index) => ({
        index,
        name: clip.name || `Clip ${index + 1}`,
        duration: Number(clip.duration) || 0,
      })),
      presentations: this.presentations.getState().presentations,
      infographics: this.infographics.getState().infographics,
      selectedPart: this.product?.getStructureReport?.().selectedPart || null,
    };
  }

  #applyStoryStep(step, context = {}) {
    const story = context.story;
    if (story?.id) this.stories.selectStep(story.id, step.id);
    const transition = {
      duration: step.transitionDuration,
      easing: step.easing,
    };

    if (step.presentationId) {
      this.applyPresentation(step.presentationId, {
        showMessage: false,
        cameraTransition: transition,
      });
    }
    if (step.explodeStateId) {
      this.applyExplodedState(step.explodeStateId, {
        ...transition,
        showMessage: false,
      });
    }
    if (step.infographicDisplay !== 'inherit') {
      this.infographics.applyState({
        ...this.infographics.getState(),
        infographicDisplay: step.infographicDisplay,
        selectedInfographicId: step.selectedInfographicId,
      }, { notify: false });
    }

    this.store.set('project.configurator', this.#getConfiguratorState(), { source: 'story-runtime' });
    this.#refreshConfiguratorUI();
    this.ui.updateStoryPlayer(this.storyPlayer.getState());
  }

  #startStoryChapter(chapterId) {
    const chapter = this.stories.getChapter(chapterId);
    const clip = chapter ? this.motion.clips[chapter.clipIndex] : null;
    const resolved = chapter && clip ? resolveChapterRange(chapter, clip.duration) : null;
    if (!resolved?.valid) return false;
    return this.motion.playChapter(resolved);
  }

  #handleAnimationChapterComplete(chapter) {
    if (this.storyPlayer.notifyChapterComplete()) return;
    this.ui.showToast(`${chapter.name || 'Animation'} chapter complete.`);
  }

  #handleStoryPlayerState(state) {
    if (state.storyId && state.stepId) this.stories.selectStep(state.storyId, state.stepId);
    this.store.set('project.configurator', this.#getConfiguratorState(), { source: 'story-runtime' });
    this.ui.updateStoryPlayer(state);
    this.ui.updateStories(this.#getStoryUIReport());
    if (this.experienceRuntime.getState().active) this.experienceRuntime.updateStory(state);
  }

  resetInfographicGroup({ showMessage = true } = {}) {
    this.infographics.reset({ notify: false });
    this.presentations.clear({ notify: false });
    this.infographicOverlay?.clear();
    this.#commitStructureState('infographic-reset');
    if (showMessage) this.ui.showToast('Infographics and presentation states reset.');
  }


  resetStructureGroup({ showMessage = true } = {}) {
    this.product.resetStructure();
    this.#commitStructureState('group-reset');
    this.anchorOverlay?.clear();
    if (showMessage) this.ui.showToast('Parts, states and anchors reset.');
  }

  resetLookGroup({ showMessage = true, immediate = false } = {}) {
    this.applyBackdropPreset(DEFAULT_BACKDROP_ID, { immediate, showMessage: false });
    this.applyLightingPreset(DEFAULT_LIGHT_ID, { immediate, showMessage: false });
    this.setGroundOffset(DEFAULT_GROUND_OFFSET, { showMessage: false });
    this.setFloorEnabled(true);
    this.setShadowsEnabled(true);
    this.setPostEnabled(true);
    this.setQuality(this.runtimeDefaultQuality, { showMessage: false });
    this.setExportFraming('match');
    if (showMessage) this.ui.showToast('Look controls reset.');
  }

  resetObjectGroup({ showMessage = true } = {}) {
    this.resetTransform({ showMessage: false });
    this.setMaterialMode('original', { showMessage: false });
    this.setBackfaceRepair(false, { showMessage: false });
    this.product.clearMaterialSideOverrides();
    this.store.set('project.model.materialSideOverrides', {}, { source: 'group-reset' });
    this.store.set('project.model.suggestedMaterialSideOverrideIds', [], { source: 'group-reset' });
    this.ui.updateMaterialDiagnostics(this.product.getMaterialDiagnostics());
    if (showMessage) this.ui.showToast('Object controls reset.');
  }

  resetCameraGroup({ showMessage = true, immediate = false } = {}) {
    this.setFocalLength(DEFAULT_PROJECT_STATE.camera.focalLength);
    this.setDamping(DEFAULT_PROJECT_STATE.camera.damping);
    this.setAutoRotate(false);
    this.setHorizonLocked(true);
    this.setInspectMode(false, { showMessage: false });
    this.setCameraPreset('hero', { immediate });
    this.ui.updateCameraTargetUI(DEFAULT_CAMERA_TARGET);
    if (showMessage) this.ui.showToast('Camera controls reset.');
  }

  resetMotionGroup({ showMessage = true } = {}) {
    const motionState = this.motion.reset();
    this.ui.updateMotionState(motionState);
    if (showMessage) this.ui.showToast('Motion controls reset.');
  }

  resetHealthGroup({ showMessage = true } = {}) {
    this.#applyRuntimeState(DEFAULT_PROJECT_STATE.runtime, { source: 'group-reset' });
    this.performanceMonitor.reset();
    this.#applyPreflightGuardrails({ showMessage: false });
    this.#syncRuntimeUI(true);
    this.#refreshRecoveryDraft();
    if (showMessage) this.ui.showToast('Health and recovery preferences reset.');
  }

  resetAll() {
    this.resetLookGroup({ showMessage: false });
    this.resetObjectGroup({ showMessage: false });
    this.resetCameraGroup({ showMessage: false });
    this.resetMotionGroup({ showMessage: false });
    this.resetStructureGroup({ showMessage: false });
    this.resetVariantGroup({ showMessage: false });
    this.resetInfographicGroup({ showMessage: false });
    this.resetStoryGroup({ showMessage: false });
    this.resetHealthGroup({ showMessage: false });
    this.resetPublishGroup({ showMessage: false });
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
    this.#syncDiagnosticsUI(true);
  }

  async #createPortableProjectBlob({ now = new Date().toISOString() } = {}) {
    const project = this.#captureProjectState(now);
    let bytes = null;
    if (this.sourceAsset.kind === 'embedded-glb') {
      if (this.sourceAsset.bytes) bytes = this.sourceAsset.bytes;
      else if (this.sourceAsset.file) bytes = new Uint8Array(await this.sourceAsset.file.arrayBuffer());
      if (!bytes?.byteLength) throw new Error('The original GLB is no longer available for embedding.');
      this.sourceAsset.bytes = bytes;
    }

    const rect = this.dom.canvas.getBoundingClientRect();
    const blob = encodeProjectFile({
      project,
      asset: { ...this.sourceAsset, bytes },
      savedLooks: this.lookLibrary.list(),
      appVersion: APP_VERSION,
      sourceViewport: { width: rect.width, height: rect.height },
      createdAt: project.meta.createdAt,
      modifiedAt: now,
    });
    return { blob, project };
  }

  async #createExperienceBlob({ now = new Date().toISOString() } = {}) {
    const project = this.#captureProjectState(now);
    let bytes = null;
    if (this.sourceAsset.kind === 'embedded-glb') {
      if (this.sourceAsset.bytes) bytes = this.sourceAsset.bytes;
      else if (this.sourceAsset.file) bytes = new Uint8Array(await this.sourceAsset.file.arrayBuffer());
      if (!bytes?.byteLength) throw new Error('The original GLB is no longer available for publishing.');
      this.sourceAsset.bytes = bytes;
    }
    const blob = encodeExperienceFile({
      project,
      asset: { ...this.sourceAsset, bytes },
      appVersion: APP_VERSION,
      createdAt: project.meta.createdAt,
      modifiedAt: now,
    });
    return { blob, project };
  }

  #syncExperienceEditor() {
    const project = this.store.get('project') || DEFAULT_PROJECT_STATE;
    const profile = sanitizeExperienceState(project.experience || DEFAULT_EXPERIENCE_STATE);
    const stories = this.stories.getReport().stories || [];
    this.ui.updateExperienceEditor(profile, stories);
  }

  #resolveExperienceStory(requestedId = null) {
    const report = this.stories.getReport();
    const stories = Array.isArray(report.stories) ? report.stories : [];
    return stories.find((story) => story.id === requestedId)
      || stories.find((story) => story.id === report.activeStoryId)
      || stories[0]
      || null;
  }

  #handleExperienceRuntimeChange(state) {
    this.ui.updateExperienceRuntime({ state }, this.stories.getReport());
    if (!state.active) return;
    const profile = sanitizeExperienceState(state.profile);
    this.cameraRig?.setInteractionEnabled(profile.allowOrbit && state.phase === 'active');
    if (this.dom.presentationArButton) {
      this.dom.presentationArButton.disabled = !experienceHasArTarget(profile);
      this.dom.presentationArButton.title = experienceHasArTarget(profile)
        ? 'Open the configured native AR viewer'
        : 'Configure a hosted GLB or USDZ in Publish';
    }
  }

  #handleStoryComplete(story) {
    if (this.experienceRuntime.getState().active) {
      this.experienceRuntime.updateStory({
        playing: false,
        paused: false,
        phase: 'complete',
        storyId: story?.id || null,
        storyName: story?.name || null,
        stepIndex: Math.max(0, (story?.steps?.length || 1) - 1),
        stepCount: story?.steps?.length || 0,
        stepId: story?.steps?.at(-1)?.id || null,
        stepName: story?.steps?.at(-1)?.name || null,
      });
      if (!this.experienceRuntime.showOutro()) this.ui.showToast(`${story.name} story complete.`);
      return;
    }
    this.ui.showToast(`${story.name} story complete.`);
  }

  async #bootstrapExperienceFromLocation() {
    if (typeof location === 'undefined') return;
    const url = new URL(location.href);
    const experienceUrl = url.searchParams.get('experience');
    if (experienceUrl) {
      try {
        this.ui.showLoading(true, 'Loading published experience', 10);
        const response = await fetch(new URL(experienceUrl, location.href).toString(), { credentials: 'omit' });
        if (!response.ok) throw new Error(`The hosted experience returned ${response.status}.`);
        const blob = await response.blob();
        await this.openExperienceFile(blob, { source: 'remote' });
      } catch (error) {
        this.ui.showLoading(false);
        this.ui.showToast(`Published experience could not open: ${cleanErrorMessage(error)}`, true, '!');
      }
      return;
    }
    if (url.searchParams.get('present') === '1') this.enterExperienceMode({ source: 'editor' });
  }

  #applyRuntimeState(runtime, { source = 'runtime' } = {}) {
    const normalized = {
      autoQuality: runtime?.autoQuality !== false,
      pauseWhenHidden: runtime?.pauseWhenHidden !== false,
      recoveryEnabled: runtime?.recoveryEnabled !== false,
    };
    this.store.patch('project.runtime', normalized, { source });
    this.ui.setRuntimePreferences(normalized);
    this.performanceMonitor.reset();
    this.#handleVisibilityChange();
    if (!normalized.recoveryEnabled) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
      this.recoveryMetadata = null;
      this.recoveryDrafts.remove().catch(() => false);
      this.ui.hideRecoveryPrompt();
      this.ui.updateRecoveryStatus(null, { state: 'disabled' });
    } else if (!this.recoveryDrafts.available) {
      this.ui.updateRecoveryStatus(null, { state: 'unavailable' });
    }
  }

  #applyPreflightGuardrails({ showMessage = false } = {}) {
    const report = this.modelPreflight;
    const runtime = this.store.get('project.runtime') || DEFAULT_PROJECT_STATE.runtime;
    if (!report || !runtime.autoQuality) return;
    const current = this.store.get('project.render.quality');
    let target = current;
    if (report.status === 'heavy') target = 'performance';
    else if (report.status === 'review' && Number(globalThis.navigator?.deviceMemory || 8) <= 4) target = 'balanced';
    const rank = { performance: 0, balanced: 1, quality: 2 };
    if ((rank[target] ?? 0) < (rank[current] ?? 0)) {
      this.setQuality(target, { showMessage: false, source: 'adaptive-quality' });
      if (showMessage) {
        this.ui.showToast(report.status === 'heavy'
          ? 'Heavy asset detected. Realtime quality started in Fast mode.'
          : 'Asset and device budget detected. Realtime quality started Balanced.');
      }
    }
    this.ui.setSystemFooter(
      report.status === 'ready' ? 'ASSET READY' : report.status === 'review' ? 'ASSET REVIEW' : 'ASSET HEAVY',
      report.summary,
    );
  }

  #getAdaptiveQualityCeiling() {
    if (this.modelPreflight?.status === 'heavy') return 'performance';
    const lowMemory = Number(globalThis.navigator?.deviceMemory || 8) <= 4;
    if (this.modelPreflight?.status === 'review' || lowMemory || this.ui.shouldStartBalanced()) return 'balanced';
    return 'quality';
  }

  #handleVisibilityChange() {
    if (!this.engine) return;
    const runtime = this.store.get('project.runtime') || DEFAULT_PROJECT_STATE.runtime;
    const shouldPause = Boolean((globalThis.document?.hidden && runtime.pauseWhenHidden) || this.engine.contextLost);
    if (shouldPause === this.runtimeSuspended) {
      this.#syncRuntimeUI(true);
      return;
    }
    this.runtimeSuspended = shouldPause;
    this.performanceMonitor.setSuspended(shouldPause);
    if (!shouldPause) {
      this.engine.resetClock();
      this.performanceMonitor.reset();
      this.studio.markContactShadowDirty();
      const status = this.modelPreflight?.status || 'ready';
      this.ui.setSystemFooter(
        status === 'ready' ? 'ASSET READY' : status === 'review' ? 'ASSET REVIEW' : 'ASSET HEAVY',
        this.modelPreflight?.summary || 'Realtime rendering resumed',
      );
    } else if (!this.engine.contextLost) {
      this.ui.setSystemFooter('RENDER PAUSED', 'Hidden-tab rendering is suspended');
    }
    this.#syncRuntimeUI(true);
  }

  #evaluateAdaptiveQuality(now) {
    if (this.runtimeSuspended || this.store.get('ui.exporting')) return;
    const runtime = this.store.get('project.runtime') || DEFAULT_PROJECT_STATE.runtime;
    const current = this.store.get('project.render.quality') || this.runtimeDefaultQuality;
    const recommendation = this.performanceMonitor.recommendQuality(current, {
      now,
      enabled: runtime.autoQuality,
      maxQuality: this.#getAdaptiveQualityCeiling(),
      allowUpgrade: !this.motion.isDynamic() && !this.product.isDynamic() && !this.storyPlayer.getState().playing,
    });
    if (!recommendation || recommendation.quality === current) return;
    this.setQuality(recommendation.quality, { showMessage: false, source: 'adaptive-quality' });
    this.ui.showToast(recommendation.reason === 'sustained-low-fps'
      ? `Auto quality reduced realtime mode to ${capitalize(recommendation.quality)}.`
      : `Auto quality restored realtime mode to ${capitalize(recommendation.quality)}.`);
  }

  #syncRuntimeUI(force = false, now = performance.now()) {
    if (!force && now - this.lastRuntimeSyncAt < 240) return;
    this.lastRuntimeSyncAt = now;
    const runtime = this.store.get('project.runtime') || DEFAULT_PROJECT_STATE.runtime;
    const quality = this.store.get('project.render.quality') || this.runtimeDefaultQuality;
    this.ui.updateRuntime(this.performanceMonitor.getSnapshot(), quality, {
      autoQuality: runtime.autoQuality,
      suspended: this.runtimeSuspended,
    });
  }

  #scheduleRecoveryDraft(delay = RECOVERY_DEBOUNCE_MS) {
    const runtime = this.store.get('project.runtime') || DEFAULT_PROJECT_STATE.runtime;
    if (!this.recoveryReady || !runtime.recoveryEnabled || !this.recoveryDrafts.available || !this.projectDirty) return;
    clearTimeout(this.recoveryTimer);
    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null;
      this.saveRecoveryDraft({ silent: true });
    }, Math.max(200, Number(delay) || RECOVERY_DEBOUNCE_MS));
  }

  async #refreshRecoveryDraft() {
    const runtime = this.store.get('project.runtime') || DEFAULT_PROJECT_STATE.runtime;
    if (!runtime.recoveryEnabled) {
      this.ui.updateRecoveryStatus(null, { state: 'disabled' });
      return null;
    }
    if (!this.recoveryDrafts.available) {
      this.ui.updateRecoveryStatus(null, { state: 'unavailable' });
      return null;
    }
    const metadata = await this.recoveryDrafts.metadata().catch(() => null);
    this.recoveryMetadata = metadata;
    this.ui.updateRecoveryStatus(metadata, { state: metadata ? 'saved' : 'idle' });
    if (metadata) this.ui.showRecoveryPrompt(metadata);
    return metadata;
  }

  #captureProjectState(now = new Date().toISOString()) {
    const current = this.store.get('project') || DEFAULT_PROJECT_STATE;
    const transform = this.product.getTransformState();
    const camera = this.cameraRig.getSerializableState();
    const motion = this.motion.getSerializableState();
    const project = {
      ...current,
      schemaVersion: 10,
      meta: {
        ...(current.meta || {}),
        id: current.meta?.id || this.currentRecentProjectId || createProjectId(),
        title: current.meta?.title || this.product.name || 'Product VIS Project',
        createdAt: current.meta?.createdAt || this.projectCreatedAt || now,
        updatedAt: now,
      },
      model: {
        ...current.model,
        name: this.product.name,
        fileSize: this.product.fileSize,
        procedural: this.sourceAsset.kind !== 'embedded-glb',
        userScale: transform.userScale,
        userOffset: transform.userOffset,
        rotation: transform.rotation,
        positionXZ: transform.positionXZ,
        materialMode: this.product.materialMode,
        backfaceRepairEnabled: this.product.backfaceRepairEnabled,
        materialSideOverrides: this.product.getMaterialSideOverrides(),
        suggestedMaterialSideOverrideIds: this.product.getSuggestedMaterialSideOverrideIds(),
      },
      configurator: this.#getConfiguratorState(),
      camera,
      motion,
      render: {
        ...current.render,
        exportFraming: current.render?.exportFraming === 'fill' ? 'fill' : 'match-viewport',
      },
      runtime: {
        ...DEFAULT_PROJECT_STATE.runtime,
        ...(current.runtime || {}),
      },
    };
    return sanitizeProjectState(project, { now });
  }

  #applyProjectState(input) {
    const project = sanitizeProjectState(input);
    this.applyingProject = true;
    try {
      this.store.replaceProject(project, { source: 'project-open' });
      this.#applyLookRuntime(project.studio, project.render);
      this.#applyRuntimeState(project.runtime, { source: 'project-open' });

      this.product.applyTransformState(project.model);
      this.product.setMaterialMode(project.model.materialMode);
      this.product.setBackfaceRepairEnabled(project.model.backfaceRepairEnabled);
      this.product.setMaterialSideOverrides(project.model.materialSideOverrides, {
        suggestedIds: project.model.suggestedMaterialSideOverrideIds,
      });
      this.ui.updateTransformUI(project.model.userScale, project.model.userOffset);
      this.ui.setMaterialMode(project.model.materialMode);
      this.ui.setBackfaceRepair(project.model.backfaceRepairEnabled);
      this.ui.updateMaterialDiagnostics(this.product.getMaterialDiagnostics());

      this.product.applyStructureState(project.configurator);
      this.variantPreviewEnabled = Boolean(project.configurator.variantPreviewEnabled);
      this.infographics.applyState(project.configurator, { notify: false });
      this.presentations.applyState(project.configurator, { notify: false });
      this.stories.applyState(project.configurator, { notify: false });
      this.storyPlayer.stop({ notify: false });
      this.#refreshConfiguratorUI();
      this.#syncExperienceEditor();

      this.cameraRig.setDamping(project.camera.damping);
      this.cameraRig.setAutoRotate(project.camera.autoRotate);
      this.cameraRig.setHorizonLocked(project.camera.horizonLocked);
      this.cameraRig.setInspectMode(project.camera.mode === 'inspect');
      this.cameraRig.setFocalLength(project.camera.focalLength);
      if (project.camera.pose) {
        this.cameraRig.setPose(project.camera.pose, { preset: project.camera.preset });
      } else if (project.camera.preset) {
        this.cameraRig.setPreset(project.camera.preset, { immediate: true });
      } else {
        this.cameraRig.setTargetNormalized(project.camera.target);
        this.cameraRig.fit({ immediate: true });
      }
      this.ui.setCameraButtons(project.camera.preset);
      this.ui.setCameraControl('focal', project.camera.focalLength);
      this.ui.setCameraControl('damping', project.camera.damping);
      this.ui.setCameraToggle('autoRotate', project.camera.autoRotate);
      this.ui.setCameraToggle('horizon', project.camera.horizonLocked);
      this.ui.setInspectMode(project.camera.mode === 'inspect');
      this.ui.updateCameraTargetUI(this.cameraRig.getTargetNormalized());

      const motionState = this.motion.applyState(project.motion, { notify: false });
      this.ui.updateMotionState(motionState);
      this.#syncDiagnosticsUI(true);
      this.#syncGroupStatuses();
    } finally {
      this.applyingProject = false;
    }
  }

  #capturePresentationSnapshot() {
    const project = this.#captureProjectState();
    return {
      studio: project.studio,
      model: {
        materialMode: project.model.materialMode,
        userScale: project.model.userScale,
        userOffset: project.model.userOffset,
        rotation: project.model.rotation,
        positionXZ: project.model.positionXZ,
        backfaceRepairEnabled: project.model.backfaceRepairEnabled,
        materialSideOverrides: project.model.materialSideOverrides,
      },
      camera: project.camera,
      configurator: {
        partVisibility: project.configurator.partVisibility,
        variantSelections: project.configurator.variantSelections,
        activeConfigurationId: project.configurator.activeConfigurationId,
        variantPreviewEnabled: project.configurator.variantPreviewEnabled,
        infographicDisplay: project.configurator.infographicDisplay,
        selectedInfographicId: project.configurator.selectedInfographicId,
      },
      render: project.render,
    };
  }

  #applyPresentationSnapshot(snapshot, { cameraTransition = null } = {}) {
    const current = this.#captureProjectState();
    const currentConfigurator = current.configurator || {};
    const requestedConfigurator = snapshot.configurator || {};
    const project = sanitizeProjectState({
      ...current,
      studio: { ...current.studio, ...(snapshot.studio || {}) },
      model: { ...current.model, ...(snapshot.model || {}) },
      camera: { ...current.camera, ...(snapshot.camera || {}) },
      configurator: {
        ...currentConfigurator,
        partVisibility: requestedConfigurator.partVisibility || {},
        variantSelections: requestedConfigurator.variantSelections || {},
        activeConfigurationId: requestedConfigurator.activeConfigurationId || null,
        variantPreviewEnabled: requestedConfigurator.variantPreviewEnabled === true,
        infographicDisplay: requestedConfigurator.infographicDisplay || 'off',
        selectedInfographicId: requestedConfigurator.selectedInfographicId || null,
        ...this.presentations.getState(),
      },
      render: { ...current.render, ...(snapshot.render || {}) },
      // Presentation states are deliberately static. Motion remains live.
      motion: current.motion,
    });

    this.applyingProject = true;
    try {
      this.store.patch('project.studio', project.studio, { source: 'presentation-apply' });
      this.store.patch('project.model', project.model, { source: 'presentation-apply' });
      this.store.patch('project.camera', project.camera, { source: 'presentation-apply' });
      this.store.patch('project.render', project.render, { source: 'presentation-apply' });
      this.#applyLookRuntime(project.studio, project.render);

      this.product.applyTransformState(project.model);
      this.product.setMaterialMode(project.model.materialMode);
      this.product.setBackfaceRepairEnabled(project.model.backfaceRepairEnabled);
      this.product.setMaterialSideOverrides(project.model.materialSideOverrides, {
        suggestedIds: project.model.suggestedMaterialSideOverrideIds,
      });
      this.product.setPartVisibilityOverrides(project.configurator.partVisibility);
      this.product.setVariantSelections(project.configurator.variantSelections, {
        activeConfigurationId: project.configurator.activeConfigurationId,
      });
      this.variantPreviewEnabled = Boolean(project.configurator.variantPreviewEnabled);

      this.infographics.applyState({
        ...this.infographics.getState(),
        infographicDisplay: project.configurator.infographicDisplay,
        selectedInfographicId: project.configurator.selectedInfographicId,
      }, { notify: false });

      this.cameraRig.setDamping(project.camera.damping);
      this.cameraRig.setAutoRotate(project.camera.autoRotate);
      this.cameraRig.setHorizonLocked(project.camera.horizonLocked);
      this.cameraRig.setInspectMode(project.camera.mode === 'inspect');
      if (cameraTransition && project.camera.pose) {
        this.cameraRig.transitionToPose(project.camera.pose, {
          duration: cameraTransition.duration,
          easing: cameraTransition.easing,
          preset: project.camera.preset,
          focalLength: project.camera.focalLength,
        });
      } else {
        this.cameraRig.setFocalLength(project.camera.focalLength);
        if (project.camera.pose) {
          this.cameraRig.setPose(project.camera.pose, { preset: project.camera.preset });
        } else if (project.camera.preset) {
          this.cameraRig.setPreset(project.camera.preset, { immediate: true });
        } else {
          this.cameraRig.setTargetNormalized(project.camera.target);
          this.cameraRig.fit({ immediate: true });
        }
      }

      this.ui.updateTransformUI(project.model.userScale, project.model.userOffset);
      this.ui.setMaterialMode(project.model.materialMode);
      this.ui.setBackfaceRepair(project.model.backfaceRepairEnabled);
      this.ui.updateMaterialDiagnostics(this.product.getMaterialDiagnostics());
      this.ui.setCameraButtons(project.camera.preset);
      this.ui.setCameraControl('focal', project.camera.focalLength);
      this.ui.setCameraControl('damping', project.camera.damping);
      this.ui.setCameraToggle('autoRotate', project.camera.autoRotate);
      this.ui.setCameraToggle('horizon', project.camera.horizonLocked);
      this.ui.setInspectMode(project.camera.mode === 'inspect');
      this.ui.updateCameraTargetUI(this.cameraRig.getTargetNormalized());

      this.store.set('project.configurator', this.#getConfiguratorState(), { source: 'presentation-apply' });
      this.#refreshConfiguratorUI();
      this.studio.markContactShadowDirty();
      this.#syncDiagnosticsUI(true);
      this.#syncGroupStatuses();
    } finally {
      this.applyingProject = false;
    }
  }

  #applyLookState(look) {
    const project = sanitizeProjectState({
      ...this.store.get('project'),
      studio: look.studio,
      render: { ...this.store.get('project.render'), ...look.render },
    });
    this.applyingProject = true;
    try {
      this.store.patch('project.studio', project.studio, { source: 'saved-look' });
      this.store.patch('project.render', project.render, { source: 'saved-look' });
      this.#applyLookRuntime(project.studio, project.render);
    } finally {
      this.applyingProject = false;
    }
  }

  #applyLookRuntime(studio, render) {
    this.studio.cancelPresetTween();
    this.studio.setBackdropTone(studio.backdropTone);
    this.studio.setExposure(studio.exposure);
    this.studio.setEnvironmentIntensity(studio.environment);
    this.studio.setEnvironmentRotation(studio.environmentRotation);
    this.studio.setKeyIntensity(studio.key);
    this.studio.setFillIntensity(studio.fill);
    this.studio.setRimIntensity(studio.rim);
    this.studio.setBloom(studio.bloom);
    this.studio.setGroundOffset(studio.groundOffset);
    this.studio.setShadowOpacity(studio.shadow);
    this.studio.setShadowSoftness(studio.shadowSoftness);
    this.studio.setFloorEnabled(studio.floorEnabled);
    this.studio.setShadowsEnabled(studio.shadowsEnabled);
    this.product.setShadowsEnabled(studio.shadowsEnabled);
    this.engine.setPostEnabled(studio.postEnabled);

    const profile = this.engine.setQuality(render.quality);
    if (profile) this.studio.setShadowQuality(profile);
    this.handleResize();

    if (studio.backdropPreset) this.ui.setBackdropPresetActive(studio.backdropPreset);
    else this.ui.clearBackdropPresetActive();
    if (studio.lightingPreset) this.ui.setLightingPresetActive(studio.lightingPreset);
    else this.ui.clearLightingPresetActive();
    this.ui.setBackdropToneInput(studio.backdropTone);
    this.ui.setLightingInputs(studio);
    this.ui.setGroundControl('offset', studio.groundOffset);
    this.ui.setGroundControl('shadow', studio.shadow);
    this.ui.setGroundControl('softness', studio.shadowSoftness);
    this.ui.setStudioToggle('floor', studio.floorEnabled);
    this.ui.setStudioToggle('shadow', studio.shadowsEnabled);
    this.ui.setStudioToggle('post', studio.postEnabled);
    this.ui.setQuality(render.quality);
    this.ui.setExportFraming(render.exportFraming === 'fill' ? 'fill' : 'match');
  }

  #downloadBlob(blob, filename) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  #handleBoundsChanged(metrics, options) {
    const useRobustFrame = metrics.framingSource === 'robust-core';
    this.studio?.updateForBounds(
      useRobustFrame ? metrics.framingBounds : metrics.bounds,
      useRobustFrame ? metrics.framingRadius : metrics.radius,
      options,
    );
    this.cameraRig?.updateLimits(
      metrics.framingRadius || metrics.radius,
      metrics.framingBounds || metrics.bounds,
    );
    this.#syncDiagnosticsUI(true);
  }

  #handleCameraTargetChange({ target, preset = null } = {}) {
    if (!target) return;
    this.store.patch('project.camera', { preset, target }, { source: 'orbit' });
    this.ui.setCameraButtons(preset);
    this.ui.updateCameraTargetUI(target);
    this.#syncDiagnosticsUI(true);
  }

  #handleMotionState(motionState) {
    this.store.patch('project.motion', {
      clipIndex: motionState.clipIndex,
      playing: motionState.playing,
      loop: motionState.loop,
      speed: motionState.speed,
      time: motionState.time,
      turntable: motionState.turntable,
      turntableSpeed: motionState.turntableSpeed,
      turntableAngle: motionState.turntableAngle,
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

  #syncDiagnosticsUI(force = false, now = performance.now()) {
    if (!force && now - this.lastDiagnosticsSyncAt < 140) return;
    this.lastDiagnosticsSyncAt = now;
    this.ui.updateMaterialDiagnostics(this.product.getMaterialDiagnostics());
    this.ui.updateCameraDiagnostics(this.cameraRig.getDiagnostics());
  }

  #syncGroupStatuses() {
    const project = this.store.get('project');
    if (!project) return;
    const defaults = DEFAULT_PROJECT_STATE;
    const studio = project.studio;
    const model = project.model;
    const camera = project.camera;
    const motion = project.motion;
    const runtime = project.runtime || defaults.runtime;

    const lookCustom = !studio.backdropPreset
      || !studio.lightingPreset
      || !nearlyEqual(studio.groundOffset, defaults.studio.groundOffset)
      || studio.floorEnabled !== defaults.studio.floorEnabled
      || studio.shadowsEnabled !== defaults.studio.shadowsEnabled
      || studio.postEnabled !== defaults.studio.postEnabled
      || project.render.quality !== this.runtimeDefaultQuality
      || project.render.exportFraming !== defaults.render.exportFraming;

    const objectCustom = model.materialMode !== defaults.model.materialMode
      || !nearlyEqual(model.userScale, defaults.model.userScale)
      || !nearlyEqual(model.userOffset, defaults.model.userOffset)
      || !rotationIsZero(model.rotation)
      || !nearlyEqual(model.positionXZ?.x, defaults.model.positionXZ.x)
      || !nearlyEqual(model.positionXZ?.z, defaults.model.positionXZ.z)
      || model.backfaceRepairEnabled
      || Object.keys(model.materialSideOverrides || {}).length > 0;

    const expectedTarget = CAMERA_PRESETS[camera.preset]?.target;
    const cameraCustom = !camera.preset
      || !nearlyEqual(camera.focalLength, defaults.camera.focalLength)
      || !nearlyEqual(camera.damping, defaults.camera.damping)
      || camera.autoRotate !== defaults.camera.autoRotate
      || camera.horizonLocked !== defaults.camera.horizonLocked
      || camera.mode !== defaults.camera.mode
      || (expectedTarget ? !targetEquals(camera.target, expectedTarget) : true);

    const motionActive = Boolean(motion.playing || motion.turntable);
    const motionCustom = motionActive
      || motion.clipIndex !== defaults.motion.clipIndex
      || motion.loop !== defaults.motion.loop
      || !nearlyEqual(motion.speed, defaults.motion.speed)
      || !nearlyEqual(motion.turntableSpeed, defaults.motion.turntableSpeed)
      || !nearlyEqual(motion.time, defaults.motion.time)
      || !nearlyEqual(motion.turntableAngle, defaults.motion.turntableAngle);

    const configurator = project.configurator || defaults.configurator;
    const structureCustom = Object.keys(configurator.partVisibility || {}).length > 0
      || (configurator.states || []).length > 0
      || (configurator.anchors || []).length > 0
      || configurator.anchorDisplay !== defaults.configurator.anchorDisplay;
    const structureLabel = (configurator.anchors || []).length
      ? `${configurator.anchors.length} ANCHOR${configurator.anchors.length === 1 ? '' : 'S'}`
      : Object.keys(configurator.partVisibility || {}).length
        ? 'VISIBILITY'
        : (configurator.states || []).length
          ? `${configurator.states.length} STATE${configurator.states.length === 1 ? '' : 'S'}`
          : 'DEFAULT';

    const variantGroups = configurator.variantGroups || [];
    const variantSelections = configurator.variantSelections || {};
    const variantConfigurations = configurator.configurations || [];
    const variantsCustom = variantGroups.length > 0 || configurator.variantPreviewEnabled === true;
    const variantLabel = variantGroups.length
      ? `${variantGroups.length} GROUP${variantGroups.length === 1 ? '' : 'S'} · ${Object.keys(variantSelections).length} ACTIVE`
      : 'EMPTY';

    const infographicCount = (configurator.infographics || []).length;
    const presentationCount = (configurator.presentations || []).length;
    const infoCustom = infographicCount > 0
      || presentationCount > 0
      || configurator.infographicDisplay !== defaults.configurator.infographicDisplay;
    const infoLabel = infographicCount || presentationCount
      ? `${infographicCount} INFO · ${presentationCount} SHOT${presentationCount === 1 ? '' : 'S'}`
      : 'EMPTY';

    const explodeOffsetCount = Object.keys(configurator.explodeOffsets || {}).length;
    const explodeStateCount = (configurator.explodeStates || []).length;
    const chapterCount = (configurator.animationChapters || []).length;
    const stories = configurator.stories || [];
    const storyStepCount = stories.reduce((total, story) => total + (story.steps?.length || 0), 0);
    const storiesCustom = explodeOffsetCount > 0
      || explodeStateCount > 0
      || chapterCount > 0
      || stories.length > 0
      || configurator.storyPreviewEnabled === true;
    const storyLabel = stories.length
      ? `${stories.length} STOR${stories.length === 1 ? 'Y' : 'IES'} · ${storyStepCount} STEP${storyStepCount === 1 ? '' : 'S'}`
      : explodeStateCount || chapterCount
        ? `${explodeStateCount} EXPLODE · ${chapterCount} CHAPTER${chapterCount === 1 ? '' : 'S'}`
        : explodeOffsetCount
          ? `${explodeOffsetCount} OFFSET${explodeOffsetCount === 1 ? '' : 'S'}`
          : 'EMPTY';

    const experience = sanitizeExperienceState(project.experience || defaults.experience);
    const defaultExperience = sanitizeExperienceState(defaults.experience || DEFAULT_EXPERIENCE_STATE);
    const publishCustom = JSON.stringify(experience) !== JSON.stringify(defaultExperience);
    const publishLabel = experience.entryStoryId
      ? 'STORY READY'
      : (experience.logoDataUrl || experience.title !== defaultExperience.title)
        ? 'BRANDED'
        : 'DRAFT';

    const healthCustom = runtime.autoQuality !== defaults.runtime.autoQuality
      || runtime.pauseWhenHidden !== defaults.runtime.pauseWhenHidden
      || runtime.recoveryEnabled !== defaults.runtime.recoveryEnabled;
    const healthLabel = this.modelPreflight?.status === 'heavy'
      ? 'HEAVY'
      : this.modelPreflight?.status === 'review'
        ? 'REVIEW'
        : this.runtimeSuspended
          ? 'PAUSED'
          : 'READY';

    this.ui.updateGroupStatuses({
      look: {
        custom: lookCustom,
        label: lookCustom
          ? 'CUSTOM'
          : `${studio.backdropPreset || 'CUSTOM'} · ${studio.lightingPreset || 'CUSTOM'}`.toUpperCase(),
      },
      object: {
        custom: objectCustom,
        label: objectCustom ? 'CUSTOM' : 'DEFAULT',
      },
      camera: {
        custom: cameraCustom,
        label: cameraCustom ? 'CUSTOM' : String(camera.preset || 'CUSTOM').toUpperCase(),
      },
      motion: {
        custom: motionCustom,
        label: motionActive ? 'ACTIVE' : motionCustom ? 'CUSTOM' : 'IDLE',
      },
      structure: {
        custom: structureCustom,
        label: structureLabel,
      },
      variants: {
        custom: variantsCustom,
        label: variantConfigurations.length ? `${variantLabel} · ${variantConfigurations.length} SAVED` : variantLabel,
      },
      info: {
        custom: infoCustom,
        label: infoLabel,
      },
      stories: {
        custom: storiesCustom,
        label: storyLabel,
      },
      publish: {
        custom: publishCustom,
        label: publishLabel,
      },
      health: {
        custom: healthCustom,
        label: healthCustom ? `${healthLabel} · CUSTOM` : healthLabel,
      },
    });
  }

  #renderLoop(now) {
    if (this.runtimeSuspended || this.engine.contextLost) {
      this.#syncRuntimeUI(false, now);
      return;
    }

    this.performanceMonitor.sample(now);
    const delta = this.engine.getDelta();
    this.storyPlayer.update(now);
    this.cameraRig.updateTween(now);
    this.product.prepareAnimationFrame();
    this.motion.update(delta);
    this.product.update(now);
    if (this.product.isExplosionDynamic() && now - this.lastExplosionBoundsSyncAt > 90) {
      this.lastExplosionBoundsSyncAt = now;
      this.product.updateBounds({ updateShadowScale: true });
    }
    this.cameraRig.updateControls(delta);
    this.studio.update(now, {
      dynamic: this.product.isDynamic()
        || this.motion.isDynamic()
        || this.cameraRig.isTransitioning()
        || this.storyPlayer.getState().playing,
    });
    this.studio.updateCameraPosition(this.engine.camera.position);
    this.#syncDiagnosticsUI(false, now);
    const markers = this.product.getAnchorMarkers();
    const anchorDisplay = this.store.get('project.configurator.anchorDisplay') || 'off';
    this.anchorOverlay?.update(
      anchorDisplay === 'off' ? [] : markers,
      {
        display: anchorDisplay,
        selectedId: this.store.get('project.configurator.selectedAnchorId'),
      },
    );
    const infographicState = this.infographics.getState();
    this.infographicOverlay?.update(markers, infographicState.infographics, {
      display: infographicState.infographicDisplay,
      selectedId: infographicState.selectedInfographicId,
    });
    this.engine.render();
    this.#evaluateAdaptiveQuality(now);
    this.#syncRuntimeUI(false, now);
  }
}
