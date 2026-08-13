import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  VERSION, STARTER_URL, STARTER_NAME, PROJECT_KEY, PRESENTATION_KEY,
  CAMERA_PRESETS, LIGHTING_PRESETS, STAGE_PRESETS, CONFIG_OPTIONS,
  ANIMATION_MODES, MATERIAL_POLICIES, SEMANTIC_GROUPS,
  createDefaultState, deepMerge
} from './config.js';
import {
  buildMaterialEntries, applyMaterialPolicy, applyEnvironmentIntensity,
  applyConfigurationToEntries, materialStats
} from './materials.js';

const clamp = THREE.MathUtils.clamp;
const rad = THREE.MathUtils.degToRad;
const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const copyVector = (value) => Array.isArray(value) && value.length === 3 ? new THREE.Vector3().fromArray(value) : null;
const formatNumber = (value, digits = 2) => Number(value).toFixed(digits);

function isVisibleInHierarchy(object, stopAt) {
  let node = object;
  while (node) {
    if (!node.visible) return false;
    if (node === stopAt) break;
    node = node.parent;
  }
  return true;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

export class ProductVisApp {
  constructor() {
    this.dom = {
      canvas: document.querySelector('#viewport'),
      shell: document.querySelector('#viewport-shell'),
      background: document.querySelector('#stage-background'),
      status: document.querySelector('#model-status'),
      loading: document.querySelector('#loading-overlay'),
      loadingBar: document.querySelector('#loading-bar'),
      loadingLabel: document.querySelector('#loading-label'),
      loadingPercent: document.querySelector('#loading-percent'),
      empty: document.querySelector('#empty-state'),
      focusReadout: document.querySelector('#focus-readout'),
      nativeBadge: document.querySelector('#native-clip-badge'),
      panel: document.querySelector('#studio-panel'),
      global: document.querySelector('#global-studio'),
      advanced: document.querySelector('#advanced-panel'),
      advancedContent: document.querySelector('#advanced-content'),
      toast: document.querySelector('#toast'),
      file: document.querySelector('#model-file')
    };

    this.state = createDefaultState();
    this.activePanel = null;
    this.productContainer = new THREE.Group();
    this.productContainer.name = 'Product root';
    this.productObject = null;
    this.productMeshes = [];
    this.materialEntries = [];
    this.materialByUuid = new Map();
    this.semanticGroups = { body: [], wheels: [], interior: [], brakes: [], glass: [], none: [] };
    this.modelBounds = new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
    this.modelSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, 0), 1.5);
    this.modelSize = new THREE.Vector3(2, 1, 2);
    this.nativeClips = [];
    this.nativeActions = new Map();
    this.mixer = null;
    this.loadingToken = 0;
    this.modelLoadPromise = Promise.resolve();
    this.currentObjectUrl = null;
    this.cameraTweenToken = 0;
    this.cameraAnimating = false;
    this.lastInteractionEndedAt = 0;
    this.pointerSession = null;
    this.lastTap = null;
    this.focusMarkerLife = 0;
    this.lastFocusObject = null;
    this.animationPhase = 0;
    this.detailOrbitPhase = 0;
    this.interactionGuard = { gizmo: false, annotation: false };
    this.clock = new THREE.Clock();
    this.readyDeferred = createDeferred();
    this.ready = this.readyDeferred.promise;
    this.initialReadyResolved = false;

    this.setupScene();
    this.setupRenderer();
    this.setupCamera();
    this.setupLightsAndStage();
    this.setupPostProcessing();
    this.setupFocusMarker();
    this.setupLoaders();
    this.bindStaticUi();
    this.bindViewportInput();
    this.applyLightingState();
    this.applyStageState();
    this.resize();
    this.renderAdvancedPanel();
    this.installDebugApi();
    this.animate();
  }

  async init() {
    await this.loadStarterModel({ initial: true, animateCamera: false });
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.name = 'Product VIS V2.1B Studio';
    this.scene.add(this.productContainer);
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.dom.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.state.lighting.exposure;
    this.renderer.setClearColor(0x000000, 0);
    if ('outputColorSpace' in this.renderer) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environmentTexture = pmrem.fromScene(room, 0.04).texture;
    this.scene.environment = this.environmentTexture;
    room.dispose?.();
    pmrem.dispose();
  }

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
    this.camera.position.set(5.5, 3.3, 6.4);
    this.camera.up.set(0, 1, 0);
    this.controls = new OrbitControls(this.camera, this.dom.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.rotateSpeed = 0.58;
    this.controls.zoomSpeed = 0.78;
    this.controls.panSpeed = 0.58;
    this.controls.screenSpacePanning = true;
    this.controls.target.set(0, 0.65, 0);
    this.controls.addEventListener('start', () => {
      this.cancelCameraTween();
    });
    this.controls.addEventListener('end', () => {
      this.lastInteractionEndedAt = performance.now();
      this.captureCameraSnapshot();
      if (this.state.camera.focusLock && this.state.camera.focusPointLocal) this.updateLockedFocus(true);
    });
  }

  setupLightsAndStage() {
    this.lightRig = new THREE.Group();
    this.lightRig.name = 'Lighting rig';
    this.scene.add(this.lightRig);

    this.hemiLight = new THREE.HemisphereLight(0xdde7ff, 0x292019, 0.72);
    this.keyLight = new THREE.DirectionalLight(0xfff3e8, 2.65);
    this.fillLight = new THREE.DirectionalLight(0xbdd4ff, 0.88);
    this.rimLight = new THREE.DirectionalLight(0xc9ddff, 1.45);
    this.keyLight.position.set(6, 9, 7);
    this.fillLight.position.set(-7, 4, 5);
    this.rimLight.position.set(-5, 6, -8);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 0.1;
    this.keyLight.shadow.camera.far = 80;
    this.lightRig.add(this.hemiLight, this.keyLight, this.fillLight, this.rimLight);

    this.stageGroup = new THREE.Group();
    this.stageGroup.name = 'Stage helpers';
    this.scene.add(this.stageGroup);
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x121419, roughness: 0.93, metalness: 0.02 });
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.name = 'Studio ground';
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.ground.userData.__pvStage = true;
    this.stageGroup.add(this.ground);

    const shadowMaterial = new THREE.ShadowMaterial({ color: 0x000000, transparent: true, opacity: 0.52, depthWrite: false });
    this.contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(45, 45), shadowMaterial);
    this.contactShadow.name = 'Contact shadow receiver';
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.002;
    this.contactShadow.receiveShadow = true;
    this.contactShadow.userData.__pvStage = true;
    this.contactShadow.renderOrder = -1;
    this.stageGroup.add(this.contactShadow);
  }

  setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bokehPass = new BokehPass(this.scene, this.camera, { focus: 5, aperture: 0.00008, maxblur: 0.006, width: 1, height: 1 });
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bokehPass);
    this.composer.addPass(this.outputPass);
    this.applyDofState();
  }

  setupFocusMarker() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, 128, 128);
    context.strokeStyle = '#e9fe73';
    context.lineWidth = 5;
    context.beginPath();
    context.arc(64, 64, 33, 0, Math.PI * 2);
    context.stroke();
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(64, 13); context.lineTo(64, 31);
    context.moveTo(64, 97); context.lineTo(64, 115);
    context.moveTo(13, 64); context.lineTo(31, 64);
    context.moveTo(97, 64); context.lineTo(115, 64);
    context.stroke();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
    this.focusMarker = new THREE.Sprite(material);
    this.focusMarker.name = 'Focus point marker';
    this.focusMarker.visible = false;
    this.focusMarker.renderOrder = 999;
    this.scene.add(this.focusMarker);
  }

  setupLoaders() {
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('/draco/');
    this.dracoLoader.setDecoderConfig({ type: 'wasm' });
    this.ktx2Loader = new KTX2Loader();
    this.ktx2Loader.setTranscoderPath('/basis/');
    this.ktx2Loader.detectSupport(this.renderer);
    this.loader = new GLTFLoader();
    this.loader.setDRACOLoader(this.dracoLoader);
    this.loader.setKTX2Loader(this.ktx2Loader);
    this.loader.setMeshoptDecoder(MeshoptDecoder);
  }

  showLoading(label, percent = 0, starter = false) {
    this.dom.loading.classList.remove('hidden');
    const kicker = this.dom.loading.querySelector('.loading-kicker');
    const title = this.dom.loading.querySelector('strong');
    if (kicker) kicker.textContent = starter ? 'BUNDLED STARTER MODEL' : 'CUSTOM PRODUCT';
    if (title) title.textContent = label;
    this.setLoadingProgress(percent, percent > 0 ? `Loading ${label}…` : `Requesting ${label}…`);
  }

  setLoadingProgress(percent, label = null) {
    const value = clamp(Math.round(number(percent)), 0, 100);
    this.dom.loadingBar.style.width = `${value}%`;
    this.dom.loadingPercent.textContent = `${value}%`;
    if (label) this.dom.loadingLabel.textContent = label;
  }

  hideLoading() {
    this.setLoadingProgress(100, 'Product ready');
    setTimeout(() => this.dom.loading.classList.add('hidden'), 220);
  }

  async loadStarterModel({ initial = false, animateCamera = true } = {}) {
    this.state.model = { source: 'starter', name: STARTER_NAME, transform: { scale: 1, pivot: [0, 0, 0] } };
    return this.loadModelFromUrl(STARTER_URL, STARTER_NAME, { starter: true, initial, animateCamera });
  }

  async loadCustomFile(file) {
    if (!(file instanceof File) || !/\.glb$/i.test(file.name)) {
      this.toast('Choose a binary .GLB file.', true);
      return false;
    }
    const objectUrl = URL.createObjectURL(file);
    try {
      const result = await this.loadModelFromUrl(objectUrl, file.name, { starter: false, initial: false, animateCamera: true });
      if (result) {
        if (this.currentObjectUrl) URL.revokeObjectURL(this.currentObjectUrl);
        this.currentObjectUrl = objectUrl;
      } else {
        URL.revokeObjectURL(objectUrl);
      }
      return result;
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
  }

  loadModelFromUrl(url, name, options = {}) {
    const token = ++this.loadingToken;
    const deferred = createDeferred();
    this.modelLoadPromise = deferred.promise;
    this.showLoading(name, 0, options.starter);
    this.dom.status.textContent = `Loading ${name} · 0%`;
    const startedAt = performance.now();

    this.loader.load(
      url,
      async (gltf) => {
        if (token !== this.loadingToken) {
          this.disposeObject(gltf.scene);
          deferred.resolve(false);
          return;
        }
        try {
          this.setLoadingProgress(96, 'Preparing materials, bounds and controls…');
          await this.installLoadedGltf(gltf, name, options);
          const elapsed = Math.round(performance.now() - startedAt);
          this.dom.status.textContent = `${name} · ${this.productMeshes.length} meshes · ${this.materialEntries.length} materials · ${elapsed} ms`;
          this.state.model.source = options.starter ? 'starter' : 'custom';
          this.state.model.name = name;
          this.hideLoading();
          deferred.resolve(true);
          if (!this.initialReadyResolved) {
            this.initialReadyResolved = true;
            this.readyDeferred.resolve(true);
          }
        } catch (error) {
          console.error(error);
          this.dom.loadingLabel.textContent = 'Model preparation failed';
          this.dom.status.textContent = `Load failed · ${name}`;
          this.toast(`Unable to prepare ${name}: ${error.message}`, true);
          deferred.reject(error);
          if (!this.initialReadyResolved) this.readyDeferred.reject(error);
        }
      },
      (event) => {
        if (token !== this.loadingToken) return;
        let percent = 0;
        if (event.lengthComputable && event.total > 0) percent = (event.loaded / event.total) * 92;
        else if (event.loaded > 0) percent = Math.min(88, 8 + Math.log10(event.loaded + 10) * 12);
        this.setLoadingProgress(percent, `Loading real GLB · ${this.formatBytes(event.loaded)}${event.total ? ` / ${this.formatBytes(event.total)}` : ''}`);
        this.dom.status.textContent = `Loading ${name} · ${Math.round(percent)}%`;
      },
      (error) => {
        if (token !== this.loadingToken) return;
        console.error(error);
        const message = error?.message || 'Unknown GLB error';
        this.dom.loadingLabel.textContent = `Load failed · ${message}`;
        this.dom.status.textContent = `Load failed · ${name}`;
        this.toast(`Unable to load ${name}.`, true);
        deferred.reject(error);
        if (!this.initialReadyResolved) this.readyDeferred.reject(error);
      }
    );
    return deferred.promise;
  }

  async installLoadedGltf(gltf, name, options) {
    const root = gltf.scene || gltf.scenes?.[0];
    if (!root) throw new Error('The GLB contains no scene.');
    root.name ||= name;
    root.updateWorldMatrix(true, true);

    const rawBox = this.computeVisibleBoundsForRoot(root);
    if (rawBox.isEmpty()) throw new Error('The GLB contains no visible mesh bounds.');
    const rawCenter = rawBox.getCenter(new THREE.Vector3());
    root.position.x -= rawCenter.x;
    root.position.z -= rawCenter.z;
    root.position.y -= rawBox.min.y;
    root.updateWorldMatrix(true, true);

    this.clearProduct();
    this.productObject = root;
    this.productContainer.position.set(0, this.state.stage.groundOffset || 0, 0);
    this.productContainer.rotation.set(0, 0, 0);
    this.productContainer.scale.setScalar(this.state.model?.transform?.scale || 1);
    this.productContainer.add(root);
    this.productContainer.updateWorldMatrix(true, true);

    const built = buildMaterialEntries(this.productContainer, this.state.groupAssignments);
    this.productMeshes = built.productMeshes;
    this.materialEntries = built.entries;
    this.materialByUuid = new Map(this.materialEntries.map((entry) => [entry.material.uuid, entry]));
    this.rebuildSemanticGroups();

    for (const mesh of this.productMeshes) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.__pvProductMesh = true;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    }

    this.nativeClips = gltf.animations || [];
    this.nativeActions.clear();
    if (this.mixer) this.mixer.stopAllAction();
    this.mixer = this.nativeClips.length ? new THREE.AnimationMixer(root) : null;
    if (this.mixer) {
      for (const clip of this.nativeClips) this.nativeActions.set(clip.name || `Clip ${this.nativeActions.size + 1}`, this.mixer.clipAction(clip));
    }

    this.applyAllMaterialPolicies();
    this.applyAllConfigurations();
    this.applyEnvironmentIntensity();
    this.updateProductBounds();
    this.updateStageScale();
    this.applyAnimationState(true);
    this.renderAdvancedPanel();
    if (this.activePanel) this.renderStudioPanel(this.activePanel);
    this.dom.empty.hidden = true;
    this.dom.nativeBadge.hidden = !this.nativeClips.length;
    this.dom.nativeBadge.textContent = this.nativeClips.length ? `${this.nativeClips.length} native animation clip${this.nativeClips.length === 1 ? '' : 's'} detected` : '';

    if (options.animateCamera === false) this.applyCameraPreset('Hero', { immediate: true });
    else await this.applyCameraPreset('Hero', { duration: 520 });
    this.captureCameraSnapshot();
  }

  clearProduct() {
    if (this.productObject) {
      this.productObject.removeFromParent();
      this.disposeObject(this.productObject);
    }
    this.productObject = null;
    this.productMeshes = [];
    this.materialEntries = [];
    this.materialByUuid.clear();
    this.semanticGroups = { body: [], wheels: [], interior: [], brakes: [], glass: [], none: [] };
    this.nativeClips = [];
    this.nativeActions.clear();
    if (this.mixer) this.mixer.stopAllAction();
    this.mixer = null;
    this.state.camera.focusPointLocal = null;
    this.state.camera.focusPointWorld = null;
    this.lastFocusObject = null;
  }

  resetToEmpty() {
    this.cancelCameraTween();
    this.clearProduct();
    this.state = createDefaultState();
    this.applyLightingState();
    this.applyStageState();
    this.dom.empty.hidden = false;
    this.dom.status.textContent = 'No product loaded · starter model remains available';
    this.dom.focusReadout.hidden = true;
    this.dom.nativeBadge.hidden = true;
    this.renderAdvancedPanel();
    if (this.activePanel) this.renderStudioPanel(this.activePanel);
    this.toast('Studio reset. Load the bundled starter model or import a GLB.');
  }

  disposeObject(root) {
    const materials = new Set();
    const textures = new Set();
    root.traverse((object) => {
      if (object.geometry) object.geometry.dispose?.();
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.filter(Boolean).forEach((material) => {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      });
    });
    textures.forEach((texture) => texture.dispose?.());
    materials.forEach((material) => material.dispose?.());
  }

  computeVisibleBoundsForRoot(root) {
    const box = new THREE.Box3().makeEmpty();
    root.updateWorldMatrix(true, true);
    root.traverse((object) => {
      if (!object.isMesh || object.userData.__pvStage || object.userData.__pvBackfaceProxy || !isVisibleInHierarchy(object, root)) return;
      if (!object.geometry?.attributes?.position) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      if (!object.geometry.boundingBox) return;
      const meshBox = object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
      if (Number.isFinite(meshBox.min.x) && Number.isFinite(meshBox.max.x)) box.union(meshBox);
    });
    return box;
  }

  computeProductBounds() {
    const box = new THREE.Box3().makeEmpty();
    if (!this.productObject) return box;
    this.productContainer.updateWorldMatrix(true, true);
    for (const mesh of this.productMeshes) {
      if (!isVisibleInHierarchy(mesh, this.productContainer) || !mesh.geometry?.attributes?.position) continue;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      if (!mesh.geometry.boundingBox) continue;
      const meshBox = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      if (Number.isFinite(meshBox.min.x) && Number.isFinite(meshBox.max.x)) box.union(meshBox);
    }
    return box;
  }

  updateProductBounds() {
    const box = this.computeProductBounds();
    if (box.isEmpty()) return false;
    this.modelBounds.copy(box);
    box.getBoundingSphere(this.modelSphere);
    box.getSize(this.modelSize);
    this.modelSphere.radius = Math.max(this.modelSphere.radius, 0.001);
    return true;
  }

  updateStageScale() {
    const radius = Math.max(this.modelSphere.radius, 1);
    const groundScale = clamp(radius / 8, 0.2, 12);
    this.ground.scale.setScalar(groundScale);
    this.contactShadow.scale.setScalar(clamp(radius / 4, 0.16, 9));
    const extent = radius * 3.4;
    this.keyLight.shadow.camera.left = -extent;
    this.keyLight.shadow.camera.right = extent;
    this.keyLight.shadow.camera.top = extent;
    this.keyLight.shadow.camera.bottom = -extent;
    this.keyLight.shadow.camera.far = radius * 14 + 20;
    this.keyLight.shadow.camera.updateProjectionMatrix();
  }

  rebuildSemanticGroups() {
    this.semanticGroups = { body: [], wheels: [], interior: [], brakes: [], glass: [], none: [] };
    for (const entry of this.materialEntries) {
      const assigned = this.state.groupAssignments[entry.key] || entry.group || entry.detectedGroup || 'none';
      entry.group = SEMANTIC_GROUPS.includes(assigned) ? assigned : 'none';
      this.semanticGroups[entry.group].push(entry);
    }

    // Geometry-aware fallback keeps unnamed custom GLBs useful without overriding explicit/manual names.
    const fullBounds = this.computeProductBounds();
    if (fullBounds.isEmpty()) return;
    const fullCenter = fullBounds.getCenter(new THREE.Vector3());
    const fullSize = fullBounds.getSize(new THREE.Vector3());
    const safe = new THREE.Vector3(Math.max(fullSize.x, 1e-4), Math.max(fullSize.y, 1e-4), Math.max(fullSize.z, 1e-4));
    const stats = new Map();
    for (const entry of this.materialEntries) {
      const box = new THREE.Box3().makeEmpty();
      for (const mesh of entry.meshes) {
        if (!mesh.geometry?.boundingBox) mesh.geometry?.computeBoundingBox?.();
        if (mesh.geometry?.boundingBox) box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
      }
      if (box.isEmpty()) continue;
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const normalized = center.clone().sub(fullCenter).divide(safe);
      const volume = (size.x * size.y * size.z) / Math.max(fullSize.x * fullSize.y * fullSize.z, 1e-8);
      const material = entry.material;
      const name = `${entry.name} ${entry.meshNames.join(' ')}`.toLowerCase();
      stats.set(entry, {
        center, size, normalized, volume,
        roughness: Number.isFinite(material.roughness) ? material.roughness : 0.5,
        metalness: Number.isFinite(material.metalness) ? material.metalness : 0,
        protected: /(tyre|tire|rubber|decal|sticker|logo|badge|emblem|plate|license|lamp|light|led|emissive)/i.test(name)
      });
    }
    const move = (entry, group) => {
      if (!entry || entry.group !== 'none') return false;
      this.semanticGroups.none = this.semanticGroups.none.filter((item) => item !== entry);
      entry.group = group;
      this.semanticGroups[group].push(entry);
      return true;
    };
    const best = (score) => this.semanticGroups.none
      .filter((entry) => stats.has(entry) && !stats.get(entry).protected)
      .map((entry) => ({ entry, score: score(stats.get(entry), entry) }))
      .sort((a, b) => b.score - a.score)[0]?.entry;

    if (!this.semanticGroups.glass.length) {
      const glass = this.semanticGroups.none.find((entry) => entry.classification === 'Transparent glass');
      move(glass, 'glass');
    }
    if (!this.semanticGroups.wheels.length) {
      move(best((item) => Math.hypot(item.normalized.x, item.normalized.z) * 2.2 - item.normalized.y * 1.7 + item.metalness * 1.2 - item.volume * 0.2), 'wheels');
    }
    if (!this.semanticGroups.brakes.length) {
      move(best((item) => Math.hypot(item.normalized.x, item.normalized.z) * 1.8 - item.normalized.y * 1.3 + item.metalness - item.volume * 1.8), 'brakes');
    }
    if (!this.semanticGroups.interior.length) {
      move(best((item, entry) => (entry.classification === 'Thin-shell candidate' ? 1.4 : 0) + item.roughness - Math.hypot(item.normalized.x, item.normalized.z) * 1.4 - Math.abs(item.normalized.y) * 0.5 - item.volume * 0.3), 'interior');
    }
    if (!this.semanticGroups.body.length) {
      const first = best((item, entry) => item.volume * 8 + entry.meshes.length * 0.12 + item.metalness * 0.45 - (entry.classification === 'Opaque' ? 0 : 1));
      move(first, 'body');
      const second = best((item, entry) => item.volume * 7 + entry.meshes.length * 0.1 + item.metalness * 0.35 - (entry.classification === 'Opaque' ? 0 : 1));
      if (second && stats.get(second).volume > 0.005) move(second, 'body');
    }
  }

  applyAllMaterialPolicies() {
    for (const entry of this.materialEntries) applyMaterialPolicy(entry, this.state.materialOverrides[entry.key] || 'Auto');
  }

  applyEnvironmentIntensity() {
    applyEnvironmentIntensity(this.materialEntries, this.state.stage.environmentIntensity ?? this.state.lighting.environmentIntensity ?? 1);
  }

  applyAllConfigurations() {
    for (const group of Object.keys(CONFIG_OPTIONS)) this.applyConfiguration(group, this.state.configuration[group], false);
  }

  applyConfiguration(group, optionName, announce = true) {
    const groupConfig = CONFIG_OPTIONS[group];
    const values = groupConfig?.options?.[optionName];
    if (!values) return;
    this.state.configuration[group] = optionName;
    applyConfigurationToEntries(this.materialEntries, group, values);
    if (announce) this.toast(`${groupConfig.label}: ${optionName}`);
  }

  formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
  }

  getCameraBasis() {
    this.updateProductBounds();
    const size = this.modelSize;
    const y = new THREE.Vector3(0, 1, 0);
    const lengthAlongX = size.x >= size.z;
    const front = lengthAlongX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    const side = lengthAlongX ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    return { up: y, front, side, lengthAlongX };
  }

  getPresetFrame(name) {
    this.updateProductBounds();
    const center = this.modelSphere.center.clone();
    const radius = Math.max(this.modelSphere.radius, 0.001);
    const { up, front, side } = this.getCameraBasis();
    const currentDirection = this.camera.position.clone().sub(this.controls.target);
    if (currentDirection.lengthSq() < 1e-8) currentDirection.copy(front).add(side);
    currentDirection.normalize();
    let direction;
    let target = center.clone();
    let frameRadius = radius;
    let margin = 1.12;
    let cameraUp = new THREE.Vector3(0, 1, 0);

    switch (name) {
      case 'Front': direction = front.clone(); margin = 1.08; break;
      case 'Rear': direction = front.clone().negate(); margin = 1.08; break;
      case 'Left': direction = side.clone().negate(); margin = 1.08; break;
      case 'Right': direction = side.clone(); margin = 1.08; break;
      case 'Top':
        direction = up.clone();
        cameraUp = front.clone().negate();
        margin = 1.12;
        break;
      case 'Detail':
        direction = currentDirection;
        frameRadius = radius * 0.38;
        target = center.clone();
        margin = 1.02;
        break;
      case 'Fit': direction = currentDirection; margin = 1.14; break;
      case 'Hero':
      default:
        direction = front.clone().multiplyScalar(0.9).add(side.clone().multiplyScalar(0.78)).add(up.clone().multiplyScalar(0.42)).normalize();
        margin = 1.15;
        break;
    }

    direction.normalize();
    const verticalFov = rad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(this.camera.aspect, 0.01));
    const limitingFov = Math.max(0.05, Math.min(verticalFov, horizontalFov));
    const distance = (frameRadius / Math.sin(limitingFov / 2)) * margin;
    const position = target.clone().addScaledVector(direction, distance);
    const clippingRadius = name === 'Detail' ? radius : frameRadius;
    const near = Math.max(0.005, distance - clippingRadius * 3.2);
    const far = Math.max(near + 20, distance + radius * 9 + 20);
    return { position, target, up: cameraUp, distance, near, far, radius: frameRadius, modelCenter: center, modelRadius: radius };
  }

  async applyCameraPreset(name, options = {}) {
    if (!CAMERA_PRESETS.includes(name) || !this.productObject) return false;
    const frame = this.getPresetFrame(name);
    this.state.camera.preset = name;
    this.camera.near = frame.near;
    this.camera.far = frame.far;
    this.camera.up.copy(frame.up);
    this.camera.updateProjectionMatrix();
    const duration = options.immediate ? 0 : number(options.duration, 480);
    if (duration <= 0) {
      this.cancelCameraTween();
      this.camera.position.copy(frame.position);
      this.controls.target.copy(frame.target);
      this.state.dof.focusDistance = frame.position.distanceTo(frame.target);
      this.applyDofState();
      this.controls.update();
      this.captureCameraSnapshot();
    } else {
      await this.animateCamera(frame.position, frame.target, frame.position.distanceTo(frame.target), duration, frame.up);
    }
    if (this.activePanel === 'camera') this.renderStudioPanel('camera');
    return true;
  }

  cancelCameraTween() {
    this.cameraTweenToken += 1;
    this.cameraAnimating = false;
  }

  animateCamera(position, target, focusDistance, duration = 480, up = null) {
    const token = ++this.cameraTweenToken;
    this.cameraAnimating = true;
    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const startUp = this.camera.up.clone();
    const endUp = up ? up.clone() : startUp.clone();
    const startFocus = this.state.dof.focusDistance;
    const startedAt = performance.now();
    return new Promise((resolve) => {
      const step = (now) => {
        if (token !== this.cameraTweenToken) {
          resolve(false);
          return;
        }
        const progress = clamp((now - startedAt) / Math.max(duration, 1), 0, 1);
        const eased = easeInOutCubic(progress);
        this.camera.position.lerpVectors(startPosition, position, eased);
        this.controls.target.lerpVectors(startTarget, target, eased);
        this.camera.up.lerpVectors(startUp, endUp, eased).normalize();
        this.state.dof.focusDistance = THREE.MathUtils.lerp(startFocus, focusDistance, eased);
        this.applyDofState();
        this.controls.update();
        if (progress < 1) requestAnimationFrame(step);
        else {
          this.cameraAnimating = false;
          this.camera.position.copy(position);
          this.controls.target.copy(target);
          this.camera.up.copy(endUp).normalize();
          this.state.dof.focusDistance = focusDistance;
          this.applyDofState();
          this.controls.update();
          this.captureCameraSnapshot();
          resolve(true);
        }
      };
      requestAnimationFrame(step);
    });
  }

  captureCameraSnapshot() {
    this.state.cameraSnapshot = {
      position: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      up: this.camera.up.toArray(),
      fov: this.camera.fov,
      near: this.camera.near,
      far: this.camera.far
    };
  }

  restoreCameraSnapshot(snapshot, animate = true) {
    if (!snapshot) return Promise.resolve(false);
    const position = copyVector(snapshot.position);
    const target = copyVector(snapshot.target);
    const up = copyVector(snapshot.up) || new THREE.Vector3(0, 1, 0);
    if (!position || !target) return Promise.resolve(false);
    this.camera.fov = clamp(number(snapshot.fov, 38), 8, 95);
    this.camera.near = Math.max(0.001, number(snapshot.near, 0.01));
    this.camera.far = Math.max(this.camera.near + 10, number(snapshot.far, 1000));
    this.camera.updateProjectionMatrix();
    if (animate) return this.animateCamera(position, target, position.distanceTo(target), 460, up);
    this.camera.position.copy(position);
    this.controls.target.copy(target);
    this.camera.up.copy(up);
    this.controls.update();
    this.state.dof.focusDistance = position.distanceTo(target);
    this.applyDofState();
    return Promise.resolve(true);
  }

  pickProductIntersection(clientX, clientY) {
    if (!this.productMeshes.length) return null;
    const rect = this.dom.canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    const intersections = raycaster.intersectObjects(this.productMeshes.filter((mesh) => isVisibleInHierarchy(mesh, this.productContainer)), false);
    if (!intersections.length) return null;
    const nonGlass = intersections.find((hit) => {
      const material = Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material;
      const entry = material ? this.materialByUuid.get(material.uuid) : null;
      return entry?.classification !== 'Transparent glass';
    });
    return nonGlass || intersections[0];
  }

  async focusFromClient(clientX, clientY, source = 'double-click') {
    if (!this.productObject || !this.state.camera.autoFocus || this.interactionGuard.gizmo || this.interactionGuard.annotation) return false;
    const hit = this.pickProductIntersection(clientX, clientY);
    if (!hit) {
      this.toast('No visible product surface at that point.');
      return false;
    }
    await this.focusIntersection(hit, source);
    return true;
  }

  async focusIntersection(hit, source = 'double-click') {
    const point = hit.point.clone();
    const currentView = this.camera.position.clone().sub(this.controls.target);
    if (currentView.lengthSq() < 1e-8) currentView.set(1, 0.35, 1);
    currentView.normalize();
    this.updateProductBounds();
    let surfaceRadius = this.modelSphere.radius * 0.12;
    if (hit.object?.geometry) {
      if (!hit.object.geometry.boundingSphere) hit.object.geometry.computeBoundingSphere();
      const localSphere = hit.object.geometry.boundingSphere;
      if (localSphere) {
        const scale = new THREE.Vector3();
        hit.object.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
        surfaceRadius = localSphere.radius * Math.max(scale.x, scale.y, scale.z);
      }
    }
    const currentDistance = this.camera.position.distanceTo(this.controls.target);
    const desiredDistance = clamp(
      Math.max(surfaceRadius * 2.1, currentDistance * 0.48),
      this.modelSphere.radius * 0.075,
      this.modelSphere.radius * 1.35
    );
    const position = point.clone().addScaledVector(currentView, desiredDistance);
    const local = this.productContainer.worldToLocal(point.clone());
    this.state.camera.focusPointLocal = local.toArray();
    this.state.camera.focusPointWorld = point.toArray();
    this.lastFocusObject = hit.object || null;
    this.showFocusMarker(point);
    this.updateFocusReadout(source, hit.object?.name || 'Product surface');
    const transition = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 480;
    await this.animateCamera(position, point, desiredDistance, transition, this.camera.up);
    this.state.dof.focusDistance = this.camera.position.distanceTo(point);
    this.applyDofState();
    if (this.activePanel === 'camera') this.renderStudioPanel('camera');
  }

  showFocusMarker(point) {
    this.focusMarker.position.copy(point);
    const scale = clamp(this.modelSphere.radius * 0.055, 0.015, 1.4);
    this.focusMarker.scale.setScalar(scale);
    this.focusMarker.material.opacity = 1;
    this.focusMarker.visible = true;
    this.focusMarkerLife = 1.25;
  }

  updateFocusReadout(source, objectName) {
    const point = copyVector(this.state.camera.focusPointWorld);
    if (!point) {
      this.dom.focusReadout.hidden = true;
      return;
    }
    this.dom.focusReadout.hidden = false;
    this.dom.focusReadout.innerHTML = `<b>FOCUS LOCKED</b> · ${escapeHtml(objectName)} · ${escapeHtml(source)}<br>X ${formatNumber(point.x)} · Y ${formatNumber(point.y)} · Z ${formatNumber(point.z)} · ${formatNumber(this.state.dof.focusDistance)} units`;
  }

  updateLockedFocus(force = false) {
    if (!this.state.camera.focusLock || !this.state.camera.focusPointLocal || !this.productObject) return;
    const local = copyVector(this.state.camera.focusPointLocal);
    if (!local) return;
    const world = this.productContainer.localToWorld(local.clone());
    const delta = world.clone().sub(this.controls.target);
    if (force || delta.lengthSq() > 1e-10) {
      this.controls.target.copy(world);
      this.state.camera.focusPointWorld = world.toArray();
      this.state.dof.focusDistance = this.camera.position.distanceTo(world);
      this.applyDofState();
      this.controls.update();
      this.updateFocusReadout('tracked', this.lastFocusObject?.name || 'Product surface');
    }
  }

  resetFocus() {
    this.state.camera.focusPointLocal = null;
    this.state.camera.focusPointWorld = null;
    this.lastFocusObject = null;
    this.focusMarker.visible = false;
    this.dom.focusReadout.hidden = true;
    return this.applyCameraPreset('Fit', { duration: 480 });
  }

  applyDofState() {
    if (!this.bokehPass) return;
    this.bokehPass.enabled = Boolean(this.state.dof.enabled);
    const uniforms = this.bokehPass.uniforms || this.bokehPass.materialBokeh?.uniforms;
    if (!uniforms) return;
    const focus = Math.max(0.001, number(this.state.dof.focusDistance, 5));
    const apertureUi = clamp(number(this.state.dof.aperture, 4), 0.1, 16);
    const range = clamp(number(this.state.dof.focusRange, 0.58), 0.05, 2);
    const bokeh = clamp(number(this.state.dof.bokeh, 0.42), 0, 1.5);
    if (uniforms.focus) uniforms.focus.value = focus;
    if (uniforms.aperture) uniforms.aperture.value = (apertureUi / range) * 0.000018;
    if (uniforms.maxblur) uniforms.maxblur.value = bokeh * 0.021;
  }

  applyLightingPreset(name, announce = true) {
    const preset = LIGHTING_PRESETS[name];
    if (!preset) return;
    this.state.lighting = { preset: name, ...preset };
    this.state.stage.environmentIntensity = preset.environmentIntensity;
    this.applyLightingState();
    if (this.activePanel === 'lighting') this.renderStudioPanel('lighting');
    if (announce) this.toast(`Lighting: ${name}`);
  }

  applyLightingState() {
    const lighting = this.state.lighting;
    this.renderer.toneMappingExposure = clamp(number(lighting.exposure, 1), 0.2, 3);
    this.keyLight.intensity = clamp(number(lighting.keyIntensity, 2.5), 0, 8);
    this.fillLight.intensity = clamp(number(lighting.fillIntensity, 0.8), 0, 5);
    this.rimLight.intensity = clamp(number(lighting.rimIntensity, 1.4), 0, 8);
    this.hemiLight.intensity = clamp(number(lighting.environmentIntensity, 1), 0, 3) * 0.7;
    this.keyLight.color.set(lighting.keyColor || '#fff3e8');
    this.rimLight.color.set(lighting.rimColor || '#c9ddff');
    this.keyLight.shadow.radius = clamp(number(lighting.shadowSoftness, 0.55) * 7, 0, 8);
    this.keyLight.shadow.bias = -0.0002;
    this.applyEnvironmentIntensity();
  }

  applyStagePreset(name, announce = true) {
    const preset = STAGE_PRESETS[name];
    if (!preset) return;
    this.state.stage = { preset: name, ...preset };
    this.state.lighting.environmentIntensity = preset.environmentIntensity;
    this.applyStageState();
    if (this.activePanel === 'stage') this.renderStudioPanel('stage');
    if (announce) this.toast(`Stage: ${name}`);
  }

  applyStageState() {
    const stage = this.state.stage;
    this.ground.visible = Boolean(stage.groundVisible);
    this.contactShadow.visible = Boolean(stage.groundVisible) && number(stage.contactShadow, 0) > 0;
    this.contactShadow.material.opacity = clamp(number(stage.contactShadow, 0.5), 0, 1);
    const offset = number(stage.groundOffset, 0);
    this.stageGroup.position.y = offset;
    if (this.productObject && this.state.model?.transform?.pivot) {
      const pivot = copyVector(this.state.model.transform.pivot) || new THREE.Vector3();
      this.productContainer.position.set(pivot.x, offset + pivot.y, pivot.z);
    } else {
      this.productContainer.position.y = offset;
    }
    this.lightRig.rotation.y = rad(number(stage.rotation, 0));
    this.hemiLight.intensity = clamp(number(stage.environmentIntensity, 1), 0, 3) * 0.7;
    document.documentElement.style.setProperty('--background-blur', `${clamp(number(stage.backgroundBlur, 0), 0, 24)}px`);
    document.documentElement.style.setProperty('--stage-rotation', `${number(stage.rotation, 0) * 0.18}deg`);
    this.applyBackgroundMode(stage.backgroundMode, stage.background);
    this.applyEnvironmentIntensity();
    if (this.productObject) {
      this.productContainer.updateWorldMatrix(true, true);
      this.updateProductBounds();
      this.updateStageScale();
      if (this.state.camera.focusLock) this.updateLockedFocus(true);
    }
  }

  applyBackgroundMode(mode, color) {
    const base = color || '#111318';
    const backgrounds = {
      white: `radial-gradient(ellipse at 50% 72%, rgba(255,255,255,.96), rgba(232,233,230,.95) 42%, ${base} 84%), linear-gradient(145deg,#fff,${base})`,
      dark: `radial-gradient(ellipse at 48% 68%, rgba(103,113,130,.17), transparent 38%), linear-gradient(145deg,#17191d 0%,${base} 64%,#020203 100%)`,
      void: `linear-gradient(${base},${base})`,
      showroom: `radial-gradient(ellipse at 50% 72%, rgba(215,228,247,.2), transparent 35%), linear-gradient(110deg,#0d1118 0%,${base} 48%,#090b0e 100%)`,
      night: `radial-gradient(circle at 72% 30%,rgba(40,78,170,.25),transparent 30%),radial-gradient(circle at 20% 64%,rgba(160,22,76,.16),transparent 28%),linear-gradient(145deg,#050713,${base})`,
      neutral: `radial-gradient(ellipse at 50% 68%,rgba(180,190,205,.18),transparent 38%),linear-gradient(145deg,#17191d 0%,${base} 62%,#050506 100%)`
    };
    this.dom.background.style.background = backgrounds[mode] || backgrounds.neutral;
    this.ground.material.color.set(mode === 'white' ? '#d5d6d3' : mode === 'night' ? '#070914' : base);
  }

  applyAnimationState(resetPose = false) {
    if (!this.productObject) return;
    if (resetPose) this.resetPose(false);
    for (const action of this.nativeActions.values()) action.stop();
    if (this.state.animation.nativeClip && this.nativeActions.has(this.state.animation.nativeClip)) {
      const action = this.nativeActions.get(this.state.animation.nativeClip);
      action.reset();
      action.setLoop(this.state.animation.loop ? THREE.LoopRepeat : THREE.LoopOnce, this.state.animation.loop ? Infinity : 1);
      action.clampWhenFinished = !this.state.animation.loop;
      action.timeScale = this.state.animation.speed * this.state.animation.direction;
      if (this.state.animation.playing) action.play();
    }
  }

  resetPose(announce = true) {
    if (!this.productContainer) return;
    const pivot = copyVector(this.state.model?.transform?.pivot) || new THREE.Vector3();
    this.productContainer.position.set(pivot.x, number(this.state.stage.groundOffset, 0) + pivot.y, pivot.z);
    this.productContainer.rotation.set(0, 0, 0);
    const scale = clamp(number(this.state.model?.transform?.scale, 1), 0.01, 100);
    this.productContainer.scale.setScalar(scale);
    this.animationPhase = 0;
    this.detailOrbitPhase = 0;
    this.productContainer.updateWorldMatrix(true, true);
    this.updateProductBounds();
    if (this.state.camera.focusLock) this.updateLockedFocus(true);
    if (announce) this.toast('Product pose reset.');
  }

  setAnimationMode(mode) {
    if (!ANIMATION_MODES.includes(mode)) return;
    this.state.animation.mode = mode;
    this.state.animation.nativeClip = null;
    this.applyAnimationState(mode === 'Still');
    if (this.activePanel === 'animation') this.renderStudioPanel('animation');
    this.toast(`Animation: ${mode}`);
  }

  playNativeClip(name) {
    if (!this.nativeActions.has(name)) return;
    this.state.animation.nativeClip = name;
    this.state.animation.mode = 'Still';
    this.applyAnimationState(true);
    if (this.activePanel === 'animation') this.renderStudioPanel('animation');
    this.toast(`Native clip: ${name}`);
  }

  updateAnimation(delta, elapsed) {
    if (!this.productObject) return;
    const animation = this.state.animation;
    const playing = Boolean(animation.playing);
    if (this.mixer && animation.nativeClip && playing) {
      const action = this.nativeActions.get(animation.nativeClip);
      if (action) action.timeScale = animation.speed * animation.direction;
      this.mixer.update(delta);
    }
    if (!playing || animation.nativeClip) return;

    const speed = clamp(number(animation.speed, 0.42), 0.01, 3.5);
    const direction = number(animation.direction, 1) >= 0 ? 1 : -1;
    const intensity = clamp(number(animation.motionIntensity, 0.34), 0, 1.5);
    const range = rad(clamp(number(animation.rotationRange, 360), 5, 360));
    this.animationPhase += delta * speed * direction;
    const pivot = copyVector(this.state.model?.transform?.pivot) || new THREE.Vector3();
    const baseY = number(this.state.stage.groundOffset, 0) + pivot.y;
    const floatAmount = this.modelSphere.radius * 0.032 * intensity;

    if (animation.mode === 'Still') return;
    if (animation.mode === 'Turntable') {
      this.productContainer.position.y = baseY;
      this.productContainer.rotation.y = animation.loop ? this.animationPhase : Math.sin(this.animationPhase) * range * 0.5;
    } else if (animation.mode === 'Float') {
      this.productContainer.rotation.y = 0;
      this.productContainer.position.y = baseY + Math.sin(this.animationPhase * 1.35) * floatAmount;
    } else if (animation.mode === 'Showcase') {
      this.productContainer.rotation.y = animation.loop ? this.animationPhase * 0.68 : Math.sin(this.animationPhase) * range * 0.5;
      this.productContainer.position.y = baseY + Math.sin(this.animationPhase * 1.55) * floatAmount;
      this.productContainer.rotation.z = Math.sin(this.animationPhase * 0.72) * 0.018 * intensity;
    } else if (animation.mode === 'Detail orbit' && !this.cameraAnimating) {
      const target = this.controls.target.clone();
      const offset = this.camera.position.clone().sub(target);
      const angle = delta * speed * direction * 0.34 * Math.max(intensity, 0.08);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      this.camera.position.copy(target).add(offset);
      this.controls.update();
    }
    this.productContainer.updateWorldMatrix(true, true);
  }

  applyModelTransform() {
    if (!this.productObject) return;
    this.resetPose(false);
    this.applyStageState();
    this.updateProductBounds();
    this.updateStageScale();
    this.captureCameraSnapshot();
  }

  bindStaticUi() {
    const importButtons = [document.querySelector('#import-model'), document.querySelector('#empty-import')];
    importButtons.forEach((button) => button?.addEventListener('click', () => this.dom.file.click()));
    [document.querySelector('#load-starter'), document.querySelector('#empty-load-starter')].forEach((button) => button?.addEventListener('click', () => this.loadStarterModel()));
    document.querySelector('#save-project')?.addEventListener('click', () => this.saveState(PROJECT_KEY, 'Project'));
    document.querySelector('#open-project')?.addEventListener('click', () => this.openState(PROJECT_KEY, 'Project'));
    document.querySelector('#save-presentation')?.addEventListener('click', () => this.saveState(PRESENTATION_KEY, 'Presentation'));
    document.querySelector('#open-presentation')?.addEventListener('click', () => this.openState(PRESENTATION_KEY, 'Presentation'));
    document.querySelector('#reset-studio')?.addEventListener('click', () => this.resetToEmpty());
    document.querySelector('#advanced-toggle')?.addEventListener('click', () => this.setAdvancedOpen(!document.body.classList.contains('advanced-open')));
    document.querySelector('#advanced-close')?.addEventListener('click', () => this.setAdvancedOpen(false));
    this.dom.file.addEventListener('change', async () => {
      const file = this.dom.file.files?.[0];
      if (!file) return;
      try { await this.loadCustomFile(file); }
      catch (error) { console.error(error); }
      finally { this.dom.file.value = ''; }
    });

    this.dom.global.querySelectorAll('[data-studio]').forEach((button) => {
      button.addEventListener('click', () => {
        const category = button.dataset.studio;
        if (this.activePanel === category && !this.dom.panel.hidden) this.closeStudioPanel();
        else this.openStudioPanel(category);
      });
    });

    document.querySelectorAll('[data-ui]').forEach((element) => {
      ['pointerdown', 'pointerup', 'click', 'dblclick', 'touchstart', 'touchend'].forEach((type) => {
        element.addEventListener(type, (event) => event.stopPropagation());
      });
    });

    window.addEventListener('resize', () => this.resize(), { passive: true });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.closeStudioPanel();
        this.setAdvancedOpen(false);
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.clock.getDelta();
    });
  }

  bindViewportInput() {
    const canvas = this.dom.canvas;
    canvas.addEventListener('pointerdown', (event) => {
      this.pointerSession = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, startedAt: performance.now(), type: event.pointerType };
    }, { passive: true });
    canvas.addEventListener('pointermove', (event) => {
      const session = this.pointerSession;
      if (!session || session.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - session.x, event.clientY - session.y) > 7) session.moved = true;
    }, { passive: true });
    canvas.addEventListener('pointercancel', () => { this.pointerSession = null; }, { passive: true });
    canvas.addEventListener('pointerup', (event) => {
      const session = this.pointerSession;
      this.pointerSession = null;
      if (!session || session.id !== event.pointerId || session.moved) {
        this.lastInteractionEndedAt = performance.now();
        return;
      }
      if (event.pointerType === 'touch') {
        const now = performance.now();
        if (this.lastTap && now - this.lastTap.time <= 330 && Math.hypot(event.clientX - this.lastTap.x, event.clientY - this.lastTap.y) <= 28) {
          this.lastTap = null;
          event.preventDefault();
          this.focusFromClient(event.clientX, event.clientY, 'double-tap');
        } else {
          this.lastTap = { time: now, x: event.clientX, y: event.clientY };
        }
      }
    });
    canvas.addEventListener('dblclick', (event) => {
      if (performance.now() - this.lastInteractionEndedAt < 110 || this.pointerSession?.moved) return;
      event.preventDefault();
      this.focusFromClient(event.clientX, event.clientY, 'double-click');
    });
  }

  setAdvancedOpen(open) {
    document.body.classList.toggle('advanced-open', Boolean(open));
    const button = document.querySelector('#advanced-toggle');
    button?.setAttribute('aria-expanded', String(Boolean(open)));
    this.dom.advanced.setAttribute('aria-hidden', String(!open));
    if (open) this.renderAdvancedPanel();
    setTimeout(() => this.resize(), 290);
  }

  openStudioPanel(category) {
    this.activePanel = category;
    this.renderStudioPanel(category);
    this.dom.panel.hidden = false;
    this.dom.global.querySelectorAll('[data-studio]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.studio === category)));
  }

  closeStudioPanel() {
    this.activePanel = null;
    this.dom.panel.hidden = true;
    this.dom.global.querySelectorAll('[data-studio]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
  }

  panelHeader(index, title, description) {
    return `<div class="panel-head"><div><span>${index} · ${escapeHtml(description)}</span><strong>${escapeHtml(title)}</strong></div><button type="button" data-close-panel>Close</button></div>`;
  }

  renderStudioPanel(category) {
    const renderers = {
      camera: () => this.renderCameraPanel(),
      lighting: () => this.renderLightingPanel(),
      stage: () => this.renderStagePanel(),
      configurator: () => this.renderConfiguratorPanel(),
      animation: () => this.renderAnimationPanel()
    };
    this.dom.panel.innerHTML = renderers[category]?.() || '';
    this.dom.panel.querySelector('[data-close-panel]')?.addEventListener('click', () => this.closeStudioPanel());
    this.bindPanelControls(category);
  }

  buttonGrid(items, active, attribute) {
    return `<div class="button-grid">${items.map((item) => `<button type="button" data-${attribute}="${escapeHtml(item)}" class="${item === active ? 'active' : ''}">${escapeHtml(item)}</button>`).join('')}</div>`;
  }

  rangeRow(id, label, value, min, max, step, suffix = '', digits = 2) {
    return `<div class="control-row"><label for="${id}">${escapeHtml(label)}</label><input id="${id}" data-range="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><output data-output="${id}">${formatNumber(value, digits)}${escapeHtml(suffix)}</output></div>`;
  }

  toggleRow(id, label, checked) {
    return `<div class="control-row"><label for="${id}">${escapeHtml(label)}</label><label class="toggle"><input id="${id}" data-toggle="${id}" type="checkbox" ${checked ? 'checked' : ''}><span>${checked ? 'On' : 'Off'}</span></label><output>${checked ? 'ON' : 'OFF'}</output></div>`;
  }

  renderCameraPanel() {
    const radius = Math.max(this.modelSphere.radius, 1);
    const focusPoint = this.state.camera.focusPointWorld ? copyVector(this.state.camera.focusPointWorld) : null;
    return `${this.panelHeader('01', 'Camera', 'Framing and optical focus')}
      <div class="panel-grid">
        <section class="panel-card wide"><div class="card-label"><span>Camera presets · world bounds</span><output>${escapeHtml(this.state.camera.preset)}</output></div>${this.buttonGrid(CAMERA_PRESETS, this.state.camera.preset, 'camera-preset')}</section>
        <section class="panel-card"><div class="card-label"><span>Focus behavior</span><output>${focusPoint ? 'SURFACE' : 'MODEL'}</output></div>
          ${this.toggleRow('focus-lock', 'Focus lock', this.state.camera.focusLock)}
          ${this.toggleRow('auto-focus', 'Auto focus on double-click', this.state.camera.autoFocus)}
          <div class="button-grid"><button type="button" data-action="reset-focus">Reset focus</button></div>
        </section>
        <section class="panel-card"><div class="card-label"><span>Depth of field</span><output>${this.state.dof.enabled ? 'ACTIVE' : 'OFF'}</output></div>
          ${this.toggleRow('dof-enabled', 'DOF on/off', this.state.dof.enabled)}
          ${this.rangeRow('focus-distance', 'Focus distance', this.state.dof.focusDistance, 0.01, radius * 12, Math.max(radius / 500, 0.01), '', 2)}
        </section>
        <section class="panel-card wide"><div class="card-label"><span>Bokeh controls</span><output>PHYSICAL RESPONSE</output></div>
          ${this.rangeRow('aperture', 'Aperture', this.state.dof.aperture, 0.1, 16, 0.1, '', 1)}
          ${this.rangeRow('bokeh', 'Bokeh strength', this.state.dof.bokeh, 0, 1.5, 0.01, '', 2)}
          ${this.rangeRow('focus-range', 'Focus range', this.state.dof.focusRange, 0.05, 2, 0.01, '', 2)}
        </section>
        <section class="panel-card full"><div class="card-label"><span>Current focus point</span><output>${focusPoint ? `${formatNumber(focusPoint.x)} / ${formatNumber(focusPoint.y)} / ${formatNumber(focusPoint.z)}` : 'Model centre'}</output></div><div style="color:var(--muted);font-size:10px;line-height:1.55">Double-click a visible exterior, interior, wheel or wing surface. Camera position, OrbitControls target and DOF distance animate together for 480 ms while preserving the current viewing direction.</div></section>
      </div>`;
  }

  renderLightingPanel() {
    const light = this.state.lighting;
    return `${this.panelHeader('02', 'Lighting', 'Coherent studio looks')}
      <div class="panel-grid">
        <section class="panel-card wide"><div class="card-label"><span>Lighting presets</span><output>${escapeHtml(light.preset)}</output></div>${this.buttonGrid(Object.keys(LIGHTING_PRESETS), light.preset, 'lighting-preset')}</section>
        <section class="panel-card wide"><div class="card-label"><span>Quick controls</span><output>${light.preset === 'Custom' ? 'CUSTOM' : 'LINKED LOOK'}</output></div>
          ${this.rangeRow('exposure', 'Exposure', light.exposure, 0.35, 2, 0.01, '', 2)}
          ${this.rangeRow('environment-intensity-light', 'Environment intensity', light.environmentIntensity, 0, 2.5, 0.01, '', 2)}
          ${this.rangeRow('key-intensity', 'Key intensity', light.keyIntensity, 0, 6, 0.01, '', 2)}
          ${this.rangeRow('rim-intensity', 'Rim intensity', light.rimIntensity, 0, 7, 0.01, '', 2)}
          ${this.rangeRow('shadow-softness', 'Shadow softness', light.shadowSoftness, 0, 1, 0.01, '', 2)}
        </section>
        <section class="panel-card full"><div class="card-label"><span>Look logic</span><output>KEY + FILL + RIM + ENV</output></div><div style="color:var(--muted);font-size:10px;line-height:1.55">Each preset updates exposure, environment contribution, key, fill, rim colour/intensity and shadow softness as one coordinated lighting design.</div></section>
      </div>`;
  }

  renderStagePanel() {
    const stage = this.state.stage;
    return `${this.panelHeader('03', 'Stage', 'Environment and presentation space')}
      <div class="panel-grid">
        <section class="panel-card wide"><div class="card-label"><span>Stage presets</span><output>${escapeHtml(stage.preset)}</output></div>${this.buttonGrid(Object.keys(STAGE_PRESETS), stage.preset, 'stage-preset')}</section>
        <section class="panel-card"><div class="card-label"><span>Background</span><output>INDEPENDENT</output></div>
          <div class="control-row"><label for="background-color">Background</label><input id="background-color" data-color="background-color" type="color" value="${escapeHtml(stage.background)}"><output>${escapeHtml(stage.background)}</output></div>
          ${this.rangeRow('background-blur', 'Background blur', stage.backgroundBlur, 0, 24, 0.5, 'px', 1)}
          ${this.rangeRow('stage-rotation', 'Stage rotation', stage.rotation, -180, 180, 1, '°', 0)}
        </section>
        <section class="panel-card"><div class="card-label"><span>Ground</span><output>${stage.groundVisible ? 'VISIBLE' : 'HIDDEN'}</output></div>
          ${this.toggleRow('ground-visible', 'Ground visibility', stage.groundVisible)}
          ${this.rangeRow('contact-shadow', 'Contact shadow', stage.contactShadow, 0, 1, 0.01, '', 2)}
          ${this.rangeRow('ground-offset', 'Ground offset', stage.groundOffset, -Math.max(this.modelSphere.radius,1), Math.max(this.modelSphere.radius,1), Math.max(this.modelSphere.radius / 250, 0.005), '', 2)}
        </section>
        <section class="panel-card"><div class="card-label"><span>Environment</span><output>LIGHT ONLY</output></div>
          ${this.rangeRow('environment-intensity-stage', 'Environment intensity', stage.environmentIntensity, 0, 2.5, 0.01, '', 2)}
          <div style="color:var(--muted);font-size:9px;line-height:1.5;margin-top:8px">Visible background and reflection lighting remain independently controllable.</div>
        </section>
      </div>`;
  }

  renderConfiguratorPanel() {
    const groupCards = Object.entries(CONFIG_OPTIONS).map(([group, definition]) => {
      const count = this.semanticGroups[group]?.length || 0;
      const active = this.state.configuration[group];
      const swatches = Object.entries(definition.options).map(([name, values]) => {
        const swatch = values.color || '#777';
        return `<button type="button" class="swatch ${name === active ? 'active' : ''}" style="--swatch:${escapeHtml(swatch)}" data-config-group="${group}" data-config-option="${escapeHtml(name)}"><span>${escapeHtml(name)}</span></button>`;
      }).join('');
      return `<section class="config-group"><header><strong>${escapeHtml(definition.label)}</strong><span>${count} material${count === 1 ? '' : 's'}</span></header><div class="swatches">${swatches}</div></section>`;
    }).join('');
    return `${this.panelHeader('04', 'Configurator', 'Semantic material variants')}
      <div class="panel-grid">${groupCards}
        <section class="panel-card full"><div class="card-label"><span>Imported model grouping</span><output>AUTO + MANUAL</output></div><div style="color:var(--muted);font-size:10px;line-height:1.55">Mesh and material names are scanned for body, wheels, interior, brakes and glass. Tyres, decals, emissive surfaces and lights remain protected. Use Advanced for manual regrouping; existing texture maps are never removed when colour or finish changes.</div></section>
      </div>`;
  }

  renderAnimationPanel() {
    const animation = this.state.animation;
    const native = this.nativeClips.length ? `<section class="panel-card full"><div class="card-label"><span>Native GLB clips</span><output>${this.nativeClips.length} FOUND</output></div><div class="button-grid">${this.nativeClips.map((clip) => `<button type="button" data-native-clip="${escapeHtml(clip.name)}" class="${animation.nativeClip === clip.name ? 'active' : ''}">${escapeHtml(clip.name || 'Unnamed clip')}</button>`).join('')}</div></section>` : '';
    return `${this.panelHeader('05', 'Animation', 'Procedural and embedded motion')}
      <div class="panel-grid">
        <section class="panel-card wide"><div class="card-label"><span>Procedural modes</span><output>${escapeHtml(animation.nativeClip || animation.mode)}</output></div>${this.buttonGrid(ANIMATION_MODES, animation.mode, 'animation-mode')}</section>
        <section class="panel-card"><div class="card-label"><span>Playback</span><output>${animation.playing ? 'PLAYING' : 'PAUSED'}</output></div>
          ${this.toggleRow('animation-playing', 'Play / pause', animation.playing)}
          ${this.toggleRow('animation-loop', 'Loop', animation.loop)}
          <div class="button-grid"><button type="button" data-direction="1" class="${animation.direction > 0 ? 'active' : ''}">Forward</button><button type="button" data-direction="-1" class="${animation.direction < 0 ? 'active' : ''}">Reverse</button></div>
        </section>
        <section class="panel-card"><div class="card-label"><span>Motion controls</span><output>PROCEDURAL</output></div>
          ${this.rangeRow('animation-speed', 'Speed', animation.speed, 0.05, 2.5, 0.01, '×', 2)}
          ${this.rangeRow('rotation-range', 'Rotation range', animation.rotationRange, 5, 360, 1, '°', 0)}
          ${this.rangeRow('motion-intensity', 'Motion intensity', animation.motionIntensity, 0, 1.5, 0.01, '', 2)}
          <div class="button-grid"><button type="button" data-action="reset-pose">Reset pose</button></div>
        </section>
        ${native}
      </div>`;
  }

  bindPanelControls(category) {
    this.dom.panel.querySelectorAll('[data-camera-preset]').forEach((button) => button.addEventListener('click', () => this.applyCameraPreset(button.dataset.cameraPreset)));
    this.dom.panel.querySelectorAll('[data-lighting-preset]').forEach((button) => button.addEventListener('click', () => this.applyLightingPreset(button.dataset.lightingPreset)));
    this.dom.panel.querySelectorAll('[data-stage-preset]').forEach((button) => button.addEventListener('click', () => this.applyStagePreset(button.dataset.stagePreset)));
    this.dom.panel.querySelectorAll('[data-animation-mode]').forEach((button) => button.addEventListener('click', () => this.setAnimationMode(button.dataset.animationMode)));
    this.dom.panel.querySelectorAll('[data-native-clip]').forEach((button) => button.addEventListener('click', () => this.playNativeClip(button.dataset.nativeClip)));
    this.dom.panel.querySelectorAll('[data-config-group]').forEach((button) => button.addEventListener('click', () => {
      this.applyConfiguration(button.dataset.configGroup, button.dataset.configOption);
      this.renderStudioPanel('configurator');
    }));
    this.dom.panel.querySelectorAll('[data-direction]').forEach((button) => button.addEventListener('click', () => {
      this.state.animation.direction = number(button.dataset.direction, 1);
      this.applyAnimationState();
      this.renderStudioPanel('animation');
    }));
    this.dom.panel.querySelector('[data-action="reset-focus"]')?.addEventListener('click', () => this.resetFocus());
    this.dom.panel.querySelector('[data-action="reset-pose"]')?.addEventListener('click', () => this.resetPose());

    const rangeActions = {
      'focus-distance': (value) => { this.state.dof.focusDistance = value; this.applyDofState(); },
      aperture: (value) => { this.state.dof.aperture = value; this.applyDofState(); },
      bokeh: (value) => { this.state.dof.bokeh = value; this.applyDofState(); },
      'focus-range': (value) => { this.state.dof.focusRange = value; this.applyDofState(); },
      exposure: (value) => { this.state.lighting.preset = 'Custom'; this.state.lighting.exposure = value; this.applyLightingState(); },
      'environment-intensity-light': (value) => { this.state.lighting.preset = 'Custom'; this.state.lighting.environmentIntensity = value; this.state.stage.environmentIntensity = value; this.applyLightingState(); },
      'key-intensity': (value) => { this.state.lighting.preset = 'Custom'; this.state.lighting.keyIntensity = value; this.applyLightingState(); },
      'rim-intensity': (value) => { this.state.lighting.preset = 'Custom'; this.state.lighting.rimIntensity = value; this.applyLightingState(); },
      'shadow-softness': (value) => { this.state.lighting.preset = 'Custom'; this.state.lighting.shadowSoftness = value; this.applyLightingState(); },
      'background-blur': (value) => { this.state.stage.preset = 'Custom'; this.state.stage.backgroundBlur = value; this.applyStageState(); },
      'stage-rotation': (value) => { this.state.stage.preset = 'Custom'; this.state.stage.rotation = value; this.applyStageState(); },
      'contact-shadow': (value) => { this.state.stage.preset = 'Custom'; this.state.stage.contactShadow = value; this.applyStageState(); },
      'ground-offset': (value) => { this.state.stage.preset = 'Custom'; this.state.stage.groundOffset = value; this.applyStageState(); },
      'environment-intensity-stage': (value) => { this.state.stage.preset = 'Custom'; this.state.stage.environmentIntensity = value; this.state.lighting.environmentIntensity = value; this.applyStageState(); },
      'animation-speed': (value) => { this.state.animation.speed = value; this.applyAnimationState(); },
      'rotation-range': (value) => { this.state.animation.rotationRange = value; },
      'motion-intensity': (value) => { this.state.animation.motionIntensity = value; }
    };
    this.dom.panel.querySelectorAll('[data-range]').forEach((input) => {
      input.addEventListener('input', () => {
        const value = number(input.value);
        const output = this.dom.panel.querySelector(`[data-output="${input.dataset.range}"]`);
        if (output) {
          const suffix = input.id.includes('rotation') || input.id === 'stage-rotation' ? '°' : input.id === 'background-blur' ? 'px' : input.id === 'animation-speed' ? '×' : '';
          output.textContent = `${formatNumber(value, input.step === '1' ? 0 : 2)}${suffix}`;
        }
        rangeActions[input.dataset.range]?.(value);
      });
    });

    const toggleActions = {
      'focus-lock': (checked) => { this.state.camera.focusLock = checked; if (checked) this.updateLockedFocus(true); },
      'auto-focus': (checked) => { this.state.camera.autoFocus = checked; },
      'dof-enabled': (checked) => { this.state.dof.enabled = checked; this.applyDofState(); },
      'ground-visible': (checked) => { this.state.stage.preset = 'Custom'; this.state.stage.groundVisible = checked; this.applyStageState(); },
      'animation-playing': (checked) => { this.state.animation.playing = checked; this.applyAnimationState(); },
      'animation-loop': (checked) => { this.state.animation.loop = checked; this.applyAnimationState(); }
    };
    this.dom.panel.querySelectorAll('[data-toggle]').forEach((input) => input.addEventListener('change', () => {
      toggleActions[input.dataset.toggle]?.(input.checked);
      const row = input.closest('.control-row');
      if (row) {
        const span = row.querySelector('.toggle span');
        const output = row.querySelector('output');
        if (span) span.textContent = input.checked ? 'On' : 'Off';
        if (output) output.textContent = input.checked ? 'ON' : 'OFF';
      }
    }));
    this.dom.panel.querySelector('[data-color="background-color"]')?.addEventListener('input', (event) => {
      this.state.stage.preset = 'Custom';
      this.state.stage.background = event.target.value;
      this.state.stage.backgroundMode = 'neutral';
      this.applyStageState();
      event.target.closest('.control-row')?.querySelector('output')?.replaceChildren(event.target.value);
    });
  }

  renderAdvancedPanel() {
    const stats = materialStats(this.materialEntries);
    const transform = this.state.model.transform ||= { scale: 1, pivot: [0, 0, 0] };
    const pivot = copyVector(transform.pivot) || new THREE.Vector3();
    const materialRows = this.materialEntries.length ? this.materialEntries.map((entry) => {
      const policy = this.state.materialOverrides[entry.key] || 'Auto';
      const group = this.state.groupAssignments[entry.key] || entry.group || 'none';
      return `<div class="material-row">
        <div class="material-name"><b title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</b><span>${escapeHtml(entry.classification)} · ${entry.meshes.length} mesh${entry.meshes.length === 1 ? '' : 'es'}</span></div>
        <select data-material-policy="${escapeHtml(entry.key)}" aria-label="Material side and alpha policy">${MATERIAL_POLICIES.map((item) => `<option value="${item}" ${item === policy ? 'selected' : ''}>${item}</option>`).join('')}</select>
        <select data-material-group="${escapeHtml(entry.key)}" aria-label="Configurator semantic group">${SEMANTIC_GROUPS.map((item) => `<option value="${item}" ${item === group ? 'selected' : ''}>${item}</option>`).join('')}</select>
      </div>`;
    }).join('') : '<div style="color:var(--muted);font-size:10px">Load a product to inspect materials.</div>';

    this.dom.advancedContent.innerHTML = `
      <section class="advanced-section"><header><strong>Model diagnostics</strong><span>WORLD SPACE</span></header><div class="advanced-body"><div class="stat-list">
        <span>Model</span><b>${escapeHtml(this.state.model.name || 'None')}</b>
        <span>Source</span><b>${escapeHtml(this.state.model.source || 'none')}</b>
        <span>Visible product meshes</span><b>${this.productMeshes.length}</b>
        <span>Materials</span><b>${this.materialEntries.length}</b>
        <span>Opaque</span><b>${stats.Opaque || 0}</b>
        <span>Alpha cutout</span><b>${stats['Alpha cutout'] || 0}</b>
        <span>Transparent glass</span><b>${stats['Transparent glass'] || 0}</b>
        <span>Thin-shell candidates</span><b>${stats['Thin-shell candidate'] || 0}</b>
        <span>Bounds size</span><b>${formatNumber(this.modelSize.x)} × ${formatNumber(this.modelSize.y)} × ${formatNumber(this.modelSize.z)}</b>
        <span>Native clips</span><b>${this.nativeClips.length}</b>
      </div></div></section>
      <section class="advanced-section"><header><strong>Product transform</strong><span>PRESET SAFE</span></header><div class="advanced-body">
        ${this.rangeRow('model-scale', 'Scale', transform.scale || 1, 0.1, 4, 0.01, '×', 2)}
        ${this.rangeRow('pivot-x', 'Pivot X', pivot.x, -Math.max(this.modelSphere.radius,1), Math.max(this.modelSphere.radius,1), Math.max(this.modelSphere.radius / 300, .005), '', 2)}
        ${this.rangeRow('pivot-y', 'Pivot Y', pivot.y, -Math.max(this.modelSphere.radius,1), Math.max(this.modelSphere.radius,1), Math.max(this.modelSphere.radius / 300, .005), '', 2)}
        ${this.rangeRow('pivot-z', 'Pivot Z', pivot.z, -Math.max(this.modelSphere.radius,1), Math.max(this.modelSphere.radius,1), Math.max(this.modelSphere.radius / 300, .005), '', 2)}
        <div class="button-grid" style="margin-top:9px"><button type="button" data-advanced-fit>Fit transformed model</button><button type="button" data-advanced-reset-transform>Reset transform</button></div>
      </div></section>
      <section class="advanced-section"><header><strong>Material repair overrides</strong><span>AUTO IS REVERSIBLE</span></header><div class="advanced-body"><div style="color:var(--muted);font-size:9px;line-height:1.5;margin-bottom:8px">Each override first restores the imported GLB values, then applies Auto, Front, Back, Double, Opaque, Cutout or Transparent. Group assignment controls configurator targeting without deleting maps.</div>${materialRows}</div></section>`;

    this.dom.advancedContent.querySelectorAll('[data-material-policy]').forEach((select) => select.addEventListener('change', () => {
      const entry = this.materialEntries.find((item) => item.key === select.dataset.materialPolicy);
      if (!entry) return;
      if (select.value === 'Auto') delete this.state.materialOverrides[entry.key];
      else this.state.materialOverrides[entry.key] = select.value;
      applyMaterialPolicy(entry, select.value);
      this.applyAllConfigurations();
      this.applyEnvironmentIntensity();
      this.toast(`${entry.name}: ${select.value}`);
    }));
    this.dom.advancedContent.querySelectorAll('[data-material-group]').forEach((select) => select.addEventListener('change', () => {
      const entry = this.materialEntries.find((item) => item.key === select.dataset.materialGroup);
      if (!entry) return;
      if (select.value === entry.detectedGroup) delete this.state.groupAssignments[entry.key];
      else this.state.groupAssignments[entry.key] = select.value;
      entry.group = select.value;
      this.rebuildSemanticGroups();
      this.applyAllMaterialPolicies();
      this.applyAllConfigurations();
      this.applyEnvironmentIntensity();
      if (this.activePanel === 'configurator') this.renderStudioPanel('configurator');
      this.toast(`${entry.name} assigned to ${select.value}.`);
    }));

    const modelRanges = {
      'model-scale': (value) => { this.state.model.transform.scale = value; },
      'pivot-x': (value) => { const p = copyVector(this.state.model.transform.pivot) || new THREE.Vector3(); p.x = value; this.state.model.transform.pivot = p.toArray(); },
      'pivot-y': (value) => { const p = copyVector(this.state.model.transform.pivot) || new THREE.Vector3(); p.y = value; this.state.model.transform.pivot = p.toArray(); },
      'pivot-z': (value) => { const p = copyVector(this.state.model.transform.pivot) || new THREE.Vector3(); p.z = value; this.state.model.transform.pivot = p.toArray(); }
    };
    this.dom.advancedContent.querySelectorAll('[data-range]').forEach((input) => input.addEventListener('input', () => {
      const value = number(input.value);
      modelRanges[input.dataset.range]?.(value);
      const output = this.dom.advancedContent.querySelector(`[data-output="${input.dataset.range}"]`);
      if (output) output.textContent = `${formatNumber(value, 2)}${input.dataset.range === 'model-scale' ? '×' : ''}`;
      this.applyModelTransform();
    }));
    this.dom.advancedContent.querySelector('[data-advanced-fit]')?.addEventListener('click', () => this.applyCameraPreset('Fit'));
    this.dom.advancedContent.querySelector('[data-advanced-reset-transform]')?.addEventListener('click', () => {
      this.state.model.transform = { scale: 1, pivot: [0, 0, 0] };
      this.applyModelTransform();
      this.renderAdvancedPanel();
      this.applyCameraPreset('Fit');
    });
  }

  buildSerializableState() {
    this.captureCameraSnapshot();
    if (this.state.camera.focusPointLocal && this.productObject) {
      const local = copyVector(this.state.camera.focusPointLocal);
      if (local) this.state.camera.focusPointWorld = this.productContainer.localToWorld(local.clone()).toArray();
    }
    return JSON.parse(JSON.stringify({ ...this.state, savedAt: new Date().toISOString(), version: VERSION }));
  }

  saveState(key, label) {
    try {
      const state = this.buildSerializableState();
      const payload = key === PRESENTATION_KEY ? { type: 'Product VIS Presentation', version: VERSION, views: [{ id: 'hero', label: 'Saved view', state }], state } : state;
      localStorage.setItem(key, JSON.stringify(payload));
      this.toast(`${label} saved locally with camera focus, DOF, stage, configuration and animation.`);
      return payload;
    } catch (error) {
      console.error(error);
      this.toast(`${label} could not be saved.`, true);
      return null;
    }
  }

  async openState(key, label) {
    const raw = localStorage.getItem(key);
    if (!raw) {
      this.toast(`No saved ${label.toLowerCase()} found.`, true);
      return false;
    }
    try {
      const parsed = JSON.parse(raw);
      const restored = parsed.state || parsed;
      await this.applyRestoredState(restored);
      this.toast(`${label} reopened.`);
      return true;
    } catch (error) {
      console.error(error);
      this.toast(`${label} is invalid or incompatible.`, true);
      return false;
    }
  }

  async applyRestoredState(restored) {
    const next = deepMerge(createDefaultState(), restored || {});
    const needsStarter = next.model?.source === 'starter' && (!this.productObject || this.state.model?.source !== 'starter');
    if (needsStarter) await this.loadStarterModel({ animateCamera: false });
    if (next.model?.source === 'custom' && (!this.productObject || this.state.model?.source !== 'custom')) {
      this.toast('This saved state references a custom GLB. Import that GLB, then reopen the state.', true);
      return false;
    }
    this.state = next;
    this.state.model.transform ||= { scale: 1, pivot: [0, 0, 0] };
    this.applyLightingState();
    this.applyStageState();
    this.rebuildSemanticGroups();
    this.applyAllMaterialPolicies();
    this.applyAllConfigurations();
    this.applyEnvironmentIntensity();
    this.applyModelTransform();
    this.applyAnimationState(true);
    const localFocus = copyVector(this.state.camera.focusPointLocal);
    if (localFocus && this.productObject) {
      const world = this.productContainer.localToWorld(localFocus.clone());
      this.state.camera.focusPointWorld = world.toArray();
      this.showFocusMarker(world);
      this.updateFocusReadout('restored', this.lastFocusObject?.name || 'Saved surface');
    } else {
      this.dom.focusReadout.hidden = true;
    }
    await this.restoreCameraSnapshot(this.state.cameraSnapshot, true);
    this.applyDofState();
    this.renderAdvancedPanel();
    if (this.activePanel) this.renderStudioPanel(this.activePanel);
    return true;
  }

  meshMatchesCategory(mesh, category) {
    if (!mesh) return false;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const entries = materials.map((material) => material ? this.materialByUuid.get(material.uuid) : null).filter(Boolean);
    const name = `${mesh.name || ''} ${materials.map((material) => material?.name || '').join(' ')}`.toLowerCase();
    if (category === 'exterior' || category === 'body') return entries.some((entry) => entry.group === 'body') || /(body|paint|fender|hood|bonnet|door|bumper|chassis)/i.test(name);
    if (category === 'wheel') return entries.some((entry) => entry.group === 'wheels') || /(wheel|rim|alloy|spoke)/i.test(name);
    if (category === 'interior') return entries.some((entry) => entry.group === 'interior') || /(interior|seat|dash|cockpit|cabin|steering|console)/i.test(name);
    if (category === 'wing') {
      if (/(wing|spoiler)/i.test(name)) return true;
      if (!entries.some((entry) => entry.group === 'body') || !mesh.geometry) return false;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      if (!mesh.geometry.boundingBox) return false;
      const worldBox = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      const center = worldBox.getCenter(new THREE.Vector3());
      const basis = this.getCameraBasis();
      const lengthAxis = basis.lengthAlongX ? 'x' : 'z';
      const high = center.y > this.modelBounds.min.y + this.modelSize.y * 0.55;
      const rearExtreme = Math.abs(center[lengthAxis] - this.modelSphere.center[lengthAxis]) > this.modelSize[lengthAxis] * 0.24;
      return high && rearExtreme;
    }
    return true;
  }

  setCameraDirectionImmediate(direction) {
    this.updateProductBounds();
    const target = this.modelSphere.center.clone();
    const verticalFov = rad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(this.camera.aspect, 0.01));
    const distance = this.modelSphere.radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2) * 1.1;
    this.camera.up.set(0, 1, 0);
    this.camera.position.copy(target).addScaledVector(direction.clone().normalize(), distance);
    this.controls.target.copy(target);
    this.camera.near = Math.max(0.005, distance - this.modelSphere.radius * 3.2);
    this.camera.far = distance + this.modelSphere.radius * 9 + 20;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  candidateClientPointsForMesh(mesh) {
    if (!mesh.geometry?.boundingBox) mesh.geometry?.computeBoundingBox?.();
    const box = mesh.geometry?.boundingBox;
    if (!box) return [];
    const min = box.min, max = box.max;
    const localPoints = [
      box.getCenter(new THREE.Vector3()),
      new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(max.x, min.y, min.z),
      new THREE.Vector3(min.x, max.y, min.z), new THREE.Vector3(max.x, max.y, min.z),
      new THREE.Vector3(min.x, min.y, max.z), new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(min.x, max.y, max.z), new THREE.Vector3(max.x, max.y, max.z)
    ];
    const rect = this.dom.canvas.getBoundingClientRect();
    return localPoints.map((point) => {
      const world = mesh.localToWorld(point.clone());
      const ndc = world.project(this.camera);
      return { x: rect.left + (ndc.x + 1) * 0.5 * rect.width, y: rect.top + (1 - (ndc.y + 1) * 0.5) * rect.height, ndc };
    }).filter((point) => Math.abs(point.ndc.x) <= 1 && Math.abs(point.ndc.y) <= 1 && point.ndc.z >= -1 && point.ndc.z <= 1);
  }

  findVisibleSurfacePoint(category) {
    const candidates = this.productMeshes.filter((mesh) => this.meshMatchesCategory(mesh, category) && isVisibleInHierarchy(mesh, this.productContainer));
    for (const mesh of candidates) {
      for (const point of this.candidateClientPointsForMesh(mesh)) {
        const hit = this.pickProductIntersection(point.x, point.y);
        if (hit && this.meshMatchesCategory(hit.object, category)) return { ...point, hit };
      }
    }
    const rect = this.dom.canvas.getBoundingClientRect();
    for (let iy = 1; iy < 12; iy += 1) {
      for (let ix = 1; ix < 20; ix += 1) {
        const x = rect.left + rect.width * (ix / 20);
        const y = rect.top + rect.height * (iy / 12);
        const hit = this.pickProductIntersection(x, y);
        if (hit && this.meshMatchesCategory(hit.object, category)) return { x, y, hit };
      }
    }
    return null;
  }

  async debugDoubleFocus(category) {
    if (!this.productObject) throw new Error('No product loaded.');
    const { front, side, up } = this.getCameraBasis();
    const views = category === 'interior'
      ? [front.clone().addScaledVector(up, .24), front.clone().negate().addScaledVector(up, .22), side.clone().addScaledVector(up, .26), up.clone().addScaledVector(front, .22)]
      : category === 'wheel'
        ? [side.clone(), side.clone().negate(), front.clone().addScaledVector(side, .65)]
        : category === 'wing'
          ? [front.clone().negate().addScaledVector(up, .18), side.clone().addScaledVector(front, -.5).addScaledVector(up, .2), front.clone().addScaledVector(up, .2)]
          : [front.clone().add(side).addScaledVector(up, .35), front.clone(), side.clone()];
    let selected = null;
    for (const direction of views) {
      this.setCameraDirectionImmediate(direction);
      await sleep(40);
      selected = this.findVisibleSurfacePoint(category);
      if (selected) break;
    }
    if (!selected) {
      const candidates = this.productMeshes.filter((mesh) => this.meshMatchesCategory(mesh, category));
      const categoryBox = new THREE.Box3().makeEmpty();
      for (const mesh of candidates) {
        if (!mesh.geometry?.boundingBox) mesh.geometry?.computeBoundingBox?.();
        if (mesh.geometry?.boundingBox) categoryBox.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
      }
      if (!categoryBox.isEmpty()) {
        const categorySphere = categoryBox.getBoundingSphere(new THREE.Sphere());
        const detailDirections = category === 'interior'
          ? [front.clone().addScaledVector(up, .18), front.clone().negate().addScaledVector(up, .18), side.clone().addScaledVector(up, .2), side.clone().negate().addScaledVector(up, .2), up.clone()]
          : views;
        for (const direction of detailDirections) {
          const distance = Math.max(categorySphere.radius * 3.2, this.modelSphere.radius * 0.12);
          this.camera.up.set(0, 1, 0);
          this.camera.position.copy(categorySphere.center).addScaledVector(direction.clone().normalize(), distance);
          this.controls.target.copy(categorySphere.center);
          this.camera.near = Math.max(0.002, distance - categorySphere.radius * 2.5);
          this.camera.far = distance + this.modelSphere.radius * 8 + 20;
          this.camera.updateProjectionMatrix();
          this.controls.update();
          await sleep(35);
          selected = this.findVisibleSurfacePoint(category);
          if (selected) break;
        }
      }
    }
    if (!selected) throw new Error(`No visible ${category} raycast surface found.`);
    const previous = this.state.camera.focusPointWorld ? [...this.state.camera.focusPointWorld] : null;
    this.dom.canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: selected.x, clientY: selected.y, view: window }));
    await sleep(640);
    if (!this.state.camera.focusPointWorld || !this.lastFocusObject) throw new Error(`${category} double-click did not produce a focus point.`);
    if (!this.meshMatchesCategory(this.lastFocusObject, category)) throw new Error(`${category} focus resolved to ${this.lastFocusObject.name || 'another mesh'}.`);
    if (previous && this.state.camera.focusPointWorld.every((value, index) => Math.abs(value - previous[index]) < 1e-6)) throw new Error(`${category} focus point did not change.`);
    return { category, object: this.lastFocusObject.name, point: [...this.state.camera.focusPointWorld], focusDistance: this.state.dof.focusDistance, raycast: true };
  }

  async debugDoubleTap(category = 'exterior') {
    if (!this.productObject) throw new Error('No product loaded.');
    const { front, side, up } = this.getCameraBasis();
    this.setCameraDirectionImmediate(front.clone().add(side).addScaledVector(up, .3));
    await sleep(40);
    const selected = this.findVisibleSurfacePoint(category);
    if (!selected) throw new Error(`No visible ${category} surface found for double-tap.`);
    const before = this.state.camera.focusPointWorld ? [...this.state.camera.focusPointWorld] : null;
    const dispatch = (type, pointerId) => this.dom.canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, clientX: selected.x, clientY: selected.y,
      pointerId, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerdown' ? 1 : 0
    }));
    const controlsWereEnabled = this.controls.enabled;
    this.controls.enabled = false;
    dispatch('pointerdown', 31); dispatch('pointerup', 31);
    await sleep(105);
    dispatch('pointerdown', 32); dispatch('pointerup', 32);
    this.controls.enabled = controlsWereEnabled;
    await sleep(640);
    if (!this.state.camera.focusPointWorld) throw new Error('Double-tap did not create a focus point.');
    if (before && this.state.camera.focusPointWorld.every((value, index) => Math.abs(value - before[index]) < 1e-6)) throw new Error('Double-tap focus point did not change.');
    return { category, point: [...this.state.camera.focusPointWorld], object: this.lastFocusObject?.name || null };
  }

  validatePreset(name) {
    this.updateProductBounds();
    const center = this.modelSphere.center.clone();
    const targetError = this.controls.target.distanceTo(center);
    const ndc = center.clone().project(this.camera);
    const distance = this.camera.position.distanceTo(this.controls.target);
    const clippingOk = this.camera.near > 0 && this.camera.far > distance + this.modelSphere.radius;
    const centered = Math.abs(ndc.x) < 0.08 && Math.abs(ndc.y) < 0.08;
    const targetOk = targetError < Math.max(this.modelSphere.radius * 0.02, 0.005);
    const distanceOk = distance > this.modelSphere.radius * 0.25 && distance < this.modelSphere.radius * 20;
    return { name, centered, targetOk, distanceOk, clippingOk, targetError, ndc: ndc.toArray(), distance, near: this.camera.near, far: this.camera.far };
  }

  async debugReplaceWithStarterFile() {
    const response = await fetch(STARTER_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Starter fetch failed: ${response.status}`);
    const blob = await response.blob();
    const file = new File([blob], 'browser-check-custom-replacement.glb', { type: 'model/gltf-binary' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    this.dom.file.files = transfer.files;
    this.dom.file.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(0);
    await this.modelLoadPromise;
    if (this.state.model.source !== 'custom') throw new Error('Custom GLB replacement did not complete through the file input.');
    return { source: this.state.model.source, name: this.state.model.name, meshes: this.productMeshes.length };
  }

  getLayoutDiagnostics() {
    const globalRect = this.dom.global.getBoundingClientRect();
    const canvasRect = this.dom.canvas.getBoundingClientRect();
    const categories = [...this.dom.global.querySelectorAll('[data-studio]')].map((button) => ({ label: button.textContent.trim(), rect: button.getBoundingClientRect().toJSON?.() || { left: button.getBoundingClientRect().left, right: button.getBoundingClientRect().right } }));
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      globalVisible: globalRect.width > 0 && globalRect.height > 0 && globalRect.bottom <= window.innerHeight + 1,
      canvasVisible: canvasRect.width > 0 && canvasRect.height > 0,
      categories: categories.length,
      advancedOpen: document.body.classList.contains('advanced-open'),
      bodyOverflow: getComputedStyle(document.body).overflow
    };
  }

  installDebugApi() {
    window.__PRODUCT_VIS__ = {
      version: VERSION,
      ready: this.ready,
      snapshot: () => this.buildSerializableState(),
      stats: () => ({ meshes: this.productMeshes.length, materials: this.materialEntries.length, nativeClips: this.nativeClips.length, classifications: materialStats(this.materialEntries), groups: Object.fromEntries(Object.entries(this.semanticGroups).map(([key, entries]) => [key, entries.length])) }),
      applyCameraPreset: (name, immediate = false) => this.applyCameraPreset(name, { immediate, duration: immediate ? 0 : 430 }),
      validatePreset: (name) => this.validatePreset(name),
      doubleFocus: (category) => this.debugDoubleFocus(category),
      doubleTap: (category) => this.debugDoubleTap(category),
      setDof: (patch) => { Object.assign(this.state.dof, patch); this.applyDofState(); return { ...this.state.dof }; },
      dofUniforms: () => {
        const uniforms = this.bokehPass.uniforms || this.bokehPass.materialBokeh?.uniforms;
        return { enabled: this.bokehPass.enabled, focus: uniforms?.focus?.value, aperture: uniforms?.aperture?.value, maxblur: uniforms?.maxblur?.value };
      },
      applyLightingPreset: (name) => { this.applyLightingPreset(name, false); return { ...this.state.lighting }; },
      applyStagePreset: (name) => { this.applyStagePreset(name, false); return { ...this.state.stage }; },
      selectConfiguration: (group, option) => { this.applyConfiguration(group, option, false); return this.state.configuration[group]; },
      setAnimation: (mode, playing = true) => { this.setAnimationMode(mode); this.state.animation.playing = playing; return { ...this.state.animation }; },
      resetPose: () => this.resetPose(false),
      saveProject: () => this.saveState(PROJECT_KEY, 'Project'),
      openProject: () => this.openState(PROJECT_KEY, 'Project'),
      savePresentation: () => this.saveState(PRESENTATION_KEY, 'Presentation'),
      openPresentation: () => this.openState(PRESENTATION_KEY, 'Presentation'),
      replaceCustom: () => this.debugReplaceWithStarterFile(),
      loadStarter: () => this.loadStarterModel({ animateCamera: false }),
      layout: () => this.getLayoutDiagnostics(),
      materialPolicies: () => this.materialEntries.map((entry) => ({ name: entry.name, classification: entry.classification, policy: this.state.materialOverrides[entry.key] || 'Auto', group: entry.group })),
      setAdvanced: (open) => this.setAdvancedOpen(open),
      app: this
    };
  }

  resize() {
    const width = Math.max(1, this.dom.shell.clientWidth);
    const height = Math.max(1, this.dom.shell.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 760 ? 1.5 : 2));
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  toast(message, error = false) {
    clearTimeout(this.toastTimer);
    this.dom.toast.textContent = message;
    this.dom.toast.classList.toggle('error', error);
    this.dom.toast.classList.add('show');
    this.toastTimer = setTimeout(() => this.dom.toast.classList.remove('show'), 2800);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;
    this.updateAnimation(delta, elapsed);
    if (this.state.camera.focusLock && this.state.camera.focusPointLocal && !this.cameraAnimating) this.updateLockedFocus();
    if (this.focusMarkerLife > 0) {
      this.focusMarkerLife -= delta;
      const opacity = clamp(this.focusMarkerLife / 0.35, 0, 1);
      this.focusMarker.material.opacity = opacity;
      if (this.focusMarkerLife <= 0) this.focusMarker.visible = false;
    }
    this.controls.update();
    this.composer.render();
  }
}
