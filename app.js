import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const THREE_VERSION = '0.185.1';
const CDN_ROOT = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/libs`;

const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const dom = {
  viewportShell: $('viewportShell'),
  canvas: $('viewport'),
  fileInput: $('fileInput'),
  dropOverlay: $('dropOverlay'),
  loadingOverlay: $('loadingOverlay'),
  loadingLabel: $('loadingLabel'),
  loadingProgress: $('loadingProgress'),
  modelName: $('modelName'),
  modelMeta: $('modelMeta'),
  modelStatus: document.querySelector('.model-status'),
  statsBadge: $('statsBadge'),
  renderModeBadge: $('renderModeBadge'),
  introHint: $('introHint'),
  dismissIntro: $('dismissIntro'),
  toast: $('toast'),
  toastIcon: $('toastIcon'),
  toastMessage: $('toastMessage'),
  controlPanel: $('controlPanel'),
  panelTitle: $('panelTitle'),
  panelToggle: $('panelToggle'),
  panelClose: $('panelClose'),
  helpButton: $('helpButton'),
  helpDialog: $('helpDialog'),
  exportButton: $('exportButton'),
  exportMenu: $('exportMenu'),
  viewportExportSize: $('viewportExportSize'),
  fullscreenButton: $('fullscreenButton'),
  resetButton: $('resetButton'),
  fitButton: $('fitButton'),
  objectFitButton: $('objectFitButton'),
  centerButton: $('centerButton'),
  groundButton: $('groundButton'),
  resetTransformButton: $('resetTransformButton'),
  cameraResetButton: $('cameraResetButton'),
  exposureInput: $('exposureInput'),
  exposureOutput: $('exposureOutput'),
  environmentInput: $('environmentInput'),
  environmentOutput: $('environmentOutput'),
  keyInput: $('keyInput'),
  keyOutput: $('keyOutput'),
  rimInput: $('rimInput'),
  rimOutput: $('rimOutput'),
  bloomInput: $('bloomInput'),
  bloomOutput: $('bloomOutput'),
  floorToggle: $('floorToggle'),
  shadowToggle: $('shadowToggle'),
  postToggle: $('postToggle'),
  qualityValue: $('qualityValue'),
  materialModeValue: $('materialModeValue'),
  scaleInput: $('scaleInput'),
  scaleOutput: $('scaleOutput'),
  offsetInput: $('offsetInput'),
  offsetOutput: $('offsetOutput'),
  trianglesStat: $('trianglesStat'),
  verticesStat: $('verticesStat'),
  materialsStat: $('materialsStat'),
  texturesStat: $('texturesStat'),
  animationsStat: $('animationsStat'),
  fileSizeStat: $('fileSizeStat'),
  focalInput: $('focalInput'),
  focalOutput: $('focalOutput'),
  dampingInput: $('dampingInput'),
  dampingOutput: $('dampingOutput'),
  autoRotateToggle: $('autoRotateToggle'),
  horizonToggle: $('horizonToggle'),
  animationCount: $('animationCount'),
  animationSelect: $('animationSelect'),
  animationPlayButton: $('animationPlayButton'),
  animationLoopToggle: $('animationLoopToggle'),
  animationSpeedControl: $('animationSpeedControl'),
  animationSpeedInput: $('animationSpeedInput'),
  animationSpeedOutput: $('animationSpeedOutput'),
  turntableSpeedInput: $('turntableSpeedInput'),
  turntableSpeedOutput: $('turntableSpeedOutput'),
  turntableToggle: $('turntableToggle'),
};

const LOOK_PRESETS = {
  studio: {
    top: '#20242a',
    bottom: '#060708',
    accent: '#ff7950',
    accentStrength: 0.13,
    floor: '#111316',
    floorRoughness: 0.7,
    exposure: 1.05,
    environment: 1.25,
    key: 3.4,
    fill: 1.05,
    rim: 5.0,
    keyColor: '#fff7ee',
    fillColor: '#b7c8dd',
    rimColor: '#ff7950',
    bloom: 0.18,
    shadow: 0.48,
  },
  soft: {
    top: '#e9e8e3',
    bottom: '#999b9c',
    accent: '#ffffff',
    accentStrength: 0.1,
    floor: '#c6c6c2',
    floorRoughness: 0.82,
    exposure: 0.94,
    environment: 1.15,
    key: 2.45,
    fill: 1.7,
    rim: 1.65,
    keyColor: '#fffaf3',
    fillColor: '#dce7f0',
    rimColor: '#ffffff',
    bloom: 0.05,
    shadow: 0.27,
  },
  noir: {
    top: '#0b0b0c',
    bottom: '#010101',
    accent: '#e54820',
    accentStrength: 0.08,
    floor: '#050506',
    floorRoughness: 0.48,
    exposure: 0.92,
    environment: 0.52,
    key: 1.25,
    fill: 0.12,
    rim: 7.2,
    keyColor: '#d8e2ef',
    fillColor: '#5f7188',
    rimColor: '#ff5c31',
    bloom: 0.36,
    shadow: 0.62,
  },
  gallery: {
    top: '#29364e',
    bottom: '#080b12',
    accent: '#7aa2ff',
    accentStrength: 0.12,
    floor: '#151a24',
    floorRoughness: 0.58,
    exposure: 1.08,
    environment: 1.6,
    key: 2.85,
    fill: 1.15,
    rim: 2.9,
    keyColor: '#eef4ff',
    fillColor: '#7da6ff',
    rimColor: '#b5caff',
    bloom: 0.13,
    shadow: 0.42,
  },
  sunset: {
    top: '#5a2720',
    bottom: '#120708',
    accent: '#ff9b6b',
    accentStrength: 0.21,
    floor: '#1c0d0b',
    floorRoughness: 0.63,
    exposure: 0.98,
    environment: 0.72,
    key: 3.7,
    fill: 0.58,
    rim: 5.6,
    keyColor: '#ffd2a2',
    fillColor: '#7d4952',
    rimColor: '#ff7950',
    bloom: 0.25,
    shadow: 0.51,
  },
};

const CAMERA_PRESETS = {
  hero: { direction: new THREE.Vector3(1.1, 0.48, 1.65), distance: 1.02, targetY: 0.47 },
  front: { direction: new THREE.Vector3(0, 0.18, 1), distance: 1.02, targetY: 0.48 },
  side: { direction: new THREE.Vector3(1, 0.2, 0), distance: 1.05, targetY: 0.48 },
  top: { direction: new THREE.Vector3(0.32, 1, 0.34), distance: 1.08, targetY: 0.42 },
  detail: { direction: new THREE.Vector3(0.9, 0.34, 1.25), distance: 0.58, targetY: 0.65 },
};

const state = {
  currentPreset: 'studio',
  materialMode: 'original',
  quality: 'quality',
  postEnabled: true,
  floorEnabled: true,
  shadowsEnabled: true,
  currentRoot: null,
  currentAsset: null,
  currentName: 'Demo Object',
  currentFileSize: null,
  modelRadius: 1.8,
  modelHeight: 3,
  modelBounds: new THREE.Box3(),
  userScale: 1,
  userOffset: 0,
  groundY: 0,
  cameraPreset: 'hero',
  cameraTween: null,
  lookTween: null,
  transformTween: null,
  isExporting: false,
  mixer: null,
  clips: [],
  action: null,
  animationPlaying: false,
  turntable: false,
  turntableSpeed: 0.3,
  dragDepth: 0,
  toastTimer: null,
  introDismissed: false,
};

let renderer;
let scene;
let camera;
let controls;
let composer;
let bloomPass;
let outputPass;
let floorMesh;
let contactShadow;
let backgroundSphere;
let backgroundMaterial;
let keyLight;
let fillLight;
let rimLight;
let hemiLight;
let pmremGenerator;
let environmentTexture;
let loader;
let clock;

const protectedMaterials = new Set();
const overrideMaterials = {
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
Object.values(overrideMaterials).forEach((material) => protectedMaterials.add(material));

boot();

function boot() {
  try {
    initRenderer();
    initScene();
    initLoaders();
    bindUI();
    initRangeVisuals();
    const demo = createDemoProduct();
    setModel(demo, [], { name: 'Demo Object', fileSize: null, procedural: true, immediateCamera: true });
    const initialQuality = shouldStartBalanced() ? 'balanced' : 'quality';
    setQuality(initialQuality, false);
    applyLookPreset('studio', true);
    handleResize();
    setCameraPreset('hero', true);
    renderer.setAnimationLoop(renderLoop);
  } catch (error) {
    console.error(error);
    showFatalError(error);
  }
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer({
    canvas: dom.canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  dom.canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    showToast('The graphics context was interrupted. Reload the page to restore it.', true, '!');
  });
}

function initScene() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(35, 1, 0.02, 250);
  camera.setFocalLength(50);
  camera.position.set(4.3, 2.7, 6.2);

  controls = new OrbitControls(camera, dom.canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 0.78;
  controls.panSpeed = 0.55;
  controls.screenSpacePanning = true;
  controls.minPolarAngle = 0.02;
  controls.maxPolarAngle = Math.PI * 0.93;
  controls.target.set(0, 1.2, 0);
  controls.update();

  pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const room = new RoomEnvironment();
  environmentTexture = pmremGenerator.fromScene(room, 0.04).texture;
  room.dispose();
  scene.environment = environmentTexture;
  scene.environmentIntensity = 1.25;

  backgroundMaterial = new THREE.ShaderMaterial({
    name: 'PV Background Gradient',
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color('#20242a') },
      bottomColor: { value: new THREE.Color('#060708') },
      accentColor: { value: new THREE.Color('#ff7950') },
      accentStrength: { value: 0.13 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldDirection;
      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldDirection = worldPosition.xyz - cameraPosition;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vWorldDirection;
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform vec3 accentColor;
      uniform float accentStrength;
      void main() {
        vec3 dir = normalize(vWorldDirection);
        float h = clamp(dir.y * 0.52 + 0.48, 0.0, 1.0);
        float blend = smoothstep(0.0, 1.0, pow(h, 0.72));
        vec3 color = mix(bottomColor, topColor, blend);
        vec2 p = vec2(dir.x * 0.74, dir.y - 0.03);
        float glow = smoothstep(0.72, 0.0, length(p));
        color += accentColor * glow * accentStrength;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  backgroundSphere = new THREE.Mesh(new THREE.SphereGeometry(85, 48, 32), backgroundMaterial);
  backgroundSphere.renderOrder = -1000;
  backgroundSphere.frustumCulled = false;
  scene.add(backgroundSphere);

  floorMesh = createCyclorama();
  scene.add(floorMesh);

  contactShadow = createContactShadow();
  scene.add(contactShadow);

  hemiLight = new THREE.HemisphereLight(0xdce7f5, 0x0c0d10, 0.42);
  scene.add(hemiLight);

  keyLight = new THREE.DirectionalLight(0xfff7ee, 3.4);
  keyLight.position.set(4.8, 7.5, 5.7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.00018;
  keyLight.shadow.normalBias = 0.025;
  keyLight.shadow.radius = 4;
  scene.add(keyLight);
  scene.add(keyLight.target);

  fillLight = new THREE.DirectionalLight(0xb7c8dd, 1.05);
  fillLight.position.set(-5.6, 3.5, 4.5);
  scene.add(fillLight);
  scene.add(fillLight.target);

  rimLight = new THREE.DirectionalLight(0xff7950, 5.0);
  rimLight.position.set(-4.8, 5.6, -5.2);
  scene.add(rimLight);
  scene.add(rimLight.target);

  [keyLight.target, fillLight.target, rimLight.target].forEach((target) => target.position.set(0, 1.25, 0));

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.18, 0.56, 0.82);
  bloomPass.threshold = 0.84;
  bloomPass.radius = 0.6;
  composer.addPass(bloomPass);
  outputPass = new OutputPass();
  composer.addPass(outputPass);

  clock = new THREE.Clock();
}

function initLoaders() {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(`${CDN_ROOT}/draco/`);

  const ktx2Loader = new KTX2Loader();
  ktx2Loader.setTranscoderPath(`${CDN_ROOT}/basis/`);
  ktx2Loader.detectSupport(renderer);

  loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  loader.setKTX2Loader(ktx2Loader);
  loader.setMeshoptDecoder(MeshoptDecoder);
}

function createCyclorama() {
  const width = 44;
  const frontZ = 18;
  const curveStartZ = -7;
  const radius = 7;
  const wallHeight = 26;
  const path = [];

  const floorSegments = 28;
  for (let i = 0; i <= floorSegments; i += 1) {
    const t = i / floorSegments;
    path.push({ y: 0, z: THREE.MathUtils.lerp(frontZ, curveStartZ, t) });
  }

  const curveSegments = 28;
  for (let i = 1; i <= curveSegments; i += 1) {
    const theta = (i / curveSegments) * Math.PI * 0.5;
    path.push({
      y: radius * (1 - Math.cos(theta)),
      z: curveStartZ - radius * Math.sin(theta),
    });
  }

  const wallSegments = 22;
  for (let i = 1; i <= wallSegments; i += 1) {
    const t = i / wallSegments;
    path.push({ y: radius + wallHeight * t, z: curveStartZ - radius });
  }

  const positions = [];
  const uvs = [];
  const indices = [];

  path.forEach((point, row) => {
    positions.push(-width / 2, point.y, point.z, width / 2, point.y, point.z);
    uvs.push(0, row / (path.length - 1), 1, row / (path.length - 1));
  });

  for (let row = 0; row < path.length - 1; row += 1) {
    const a = row * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhysicalMaterial({
    name: 'PV Studio Floor',
    color: new THREE.Color('#111316'),
    roughness: 0.7,
    metalness: 0.02,
    clearcoat: 0.06,
    clearcoatRoughness: 0.72,
    side: THREE.FrontSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Product VIS Cyclorama';
  mesh.receiveShadow = true;
  return mesh;
}

function createContactShadow() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0,0,0,0.82)');
  gradient.addColorStop(0.2, 'rgba(0,0,0,0.58)');
  gradient.addColorStop(0.58, 'rgba(0,0,0,0.18)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: 0.48,
    color: 0x000000,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  mesh.renderOrder = 2;
  return mesh;
}

function createDemoProduct() {
  const group = new THREE.Group();
  group.name = 'Demo Product Camera';

  const graphite = new THREE.MeshPhysicalMaterial({
    name: 'Graphite shell',
    color: 0x1a1d21,
    roughness: 0.3,
    metalness: 0.58,
    clearcoat: 0.38,
    clearcoatRoughness: 0.22,
  });
  const darkGlass = new THREE.MeshPhysicalMaterial({
    name: 'Smoked glass',
    color: 0x06070a,
    roughness: 0.1,
    metalness: 0.05,
    transmission: 0.08,
    thickness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
  });
  const chrome = new THREE.MeshPhysicalMaterial({
    name: 'Machined ring',
    color: 0xbcc3c9,
    roughness: 0.18,
    metalness: 1,
    clearcoat: 0.35,
  });
  const lens = new THREE.MeshPhysicalMaterial({
    name: 'Lens',
    color: 0x111821,
    roughness: 0.06,
    metalness: 0.25,
    transmission: 0.22,
    thickness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    iridescence: 0.28,
    iridescenceIOR: 1.3,
  });
  const accent = new THREE.MeshPhysicalMaterial({
    name: 'Accent',
    color: 0xff7950,
    roughness: 0.28,
    metalness: 0.18,
    emissive: 0x44140a,
    emissiveIntensity: 0.65,
    clearcoat: 0.45,
  });

  const body = new THREE.Mesh(new RoundedBoxGeometry(1.76, 2.18, 0.86, 8, 0.16), graphite);
  body.position.y = 1.19;
  group.add(body);

  const grip = new THREE.Mesh(new RoundedBoxGeometry(0.34, 1.58, 0.94, 6, 0.12), graphite.clone());
  grip.material.roughness = 0.52;
  grip.position.set(0.76, 1.17, -0.015);
  group.add(grip);

  const frontPanel = new THREE.Mesh(new RoundedBoxGeometry(1.34, 1.63, 0.075, 7, 0.09), darkGlass);
  frontPanel.position.set(-0.08, 1.19, 0.468);
  group.add(frontPanel);

  const lensHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.53, 0.34, 72, 1, false), graphite.clone());
  lensHousing.material.roughness = 0.2;
  lensHousing.material.metalness = 0.72;
  lensHousing.rotation.x = Math.PI / 2;
  lensHousing.position.set(-0.08, 1.33, 0.62);
  group.add(lensHousing);

  const lensRing = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.045, 18, 80), chrome);
  lensRing.position.set(-0.08, 1.33, 0.81);
  group.add(lensRing);

  const lensGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.09, 72), lens);
  lensGlass.rotation.x = Math.PI / 2;
  lensGlass.position.set(-0.08, 1.33, 0.83);
  group.add(lensGlass);

  const innerLens = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.25, 0.045, 64), darkGlass.clone());
  innerLens.rotation.x = Math.PI / 2;
  innerLens.position.set(-0.08, 1.33, 0.885);
  group.add(innerLens);

  const topPlate = new THREE.Mesh(new RoundedBoxGeometry(1.34, 0.18, 0.68, 5, 0.07), chrome.clone());
  topPlate.material.roughness = 0.24;
  topPlate.position.set(-0.12, 2.32, -0.01);
  group.add(topPlate);

  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.12, 48), chrome.clone());
  dial.position.set(0.28, 2.48, 0.02);
  group.add(dial);

  const shutter = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.085, 40), accent);
  shutter.position.set(-0.48, 2.44, 0.15);
  group.add(shutter);

  const accentStrip = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.035, 0.05, 3, 0.015), accent.clone());
  accentStrip.position.set(0.48, 0.44, 0.49);
  group.add(accentStrip);

  const badge = new THREE.Mesh(new THREE.RingGeometry(0.055, 0.072, 32), chrome.clone());
  badge.position.set(0.48, 1.9, 0.51);
  group.add(badge);

  group.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return group;
}

function bindUI() {
  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('keydown', handleKeyboardShortcut);

  dom.fileInput.addEventListener('change', () => {
    const file = dom.fileInput.files?.[0];
    if (file) loadGLBFile(file);
    dom.fileInput.value = '';
  });

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((type) => {
    window.addEventListener(type, (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  });

  window.addEventListener('dragenter', () => {
    state.dragDepth += 1;
    dom.dropOverlay.classList.add('is-visible');
    dom.dropOverlay.setAttribute('aria-hidden', 'false');
  });
  window.addEventListener('dragleave', () => {
    state.dragDepth = Math.max(0, state.dragDepth - 1);
    if (state.dragDepth === 0) hideDropOverlay();
  });
  window.addEventListener('drop', (event) => {
    state.dragDepth = 0;
    hideDropOverlay();
    const files = [...(event.dataTransfer?.files || [])];
    const file = files.find((candidate) => candidate.name.toLowerCase().endsWith('.glb'));
    if (!file) {
      showToast('Drop a self-contained .glb file.', true, '!');
      return;
    }
    loadGLBFile(file);
  });

  $$('.scene-preset').forEach((button) => {
    button.addEventListener('click', () => applyLookPreset(button.dataset.preset));
  });

  $$('.panel-tab').forEach((button) => {
    button.addEventListener('click', () => switchPanel(button.dataset.panel));
  });

  $$('.camera-preset, .camera-card').forEach((button) => {
    button.addEventListener('click', () => setCameraPreset(button.dataset.camera));
  });

  $$('.segmented [data-material]').forEach((button) => {
    button.addEventListener('click', () => setMaterialMode(button.dataset.material));
  });

  $$('.segmented [data-quality]').forEach((button) => {
    button.addEventListener('click', () => setQuality(button.dataset.quality));
  });

  bindRange(dom.exposureInput, dom.exposureOutput, (value) => {
    renderer.toneMappingExposure = value;
    dom.exposureOutput.value = value.toFixed(2);
    markLookCustom();
  });
  bindRange(dom.environmentInput, dom.environmentOutput, (value) => {
    scene.environmentIntensity = value;
    dom.environmentOutput.value = value.toFixed(2);
    markLookCustom();
  });
  bindRange(dom.keyInput, dom.keyOutput, (value) => {
    keyLight.intensity = value;
    dom.keyOutput.value = value.toFixed(2);
    markLookCustom();
  });
  bindRange(dom.rimInput, dom.rimOutput, (value) => {
    rimLight.intensity = value;
    dom.rimOutput.value = value.toFixed(2);
    markLookCustom();
  });
  bindRange(dom.bloomInput, dom.bloomOutput, (value) => {
    bloomPass.strength = value;
    dom.bloomOutput.value = value.toFixed(2);
    markLookCustom();
  });

  dom.floorToggle.addEventListener('change', () => {
    state.floorEnabled = dom.floorToggle.checked;
    floorMesh.visible = state.floorEnabled;
    contactShadow.visible = state.floorEnabled;
  });

  dom.shadowToggle.addEventListener('change', () => {
    state.shadowsEnabled = dom.shadowToggle.checked;
    renderer.shadowMap.enabled = state.shadowsEnabled;
    keyLight.castShadow = state.shadowsEnabled;
    if (state.currentRoot) {
      state.currentRoot.traverse((object) => {
        if (object.isMesh) object.castShadow = state.shadowsEnabled;
      });
    }
  });

  dom.postToggle.addEventListener('change', () => {
    state.postEnabled = dom.postToggle.checked;
  });

  dom.scaleInput.addEventListener('input', () => {
    state.userScale = Number(dom.scaleInput.value);
    dom.scaleOutput.value = `${state.userScale.toFixed(2)}×`;
    updateRangeProgress(dom.scaleInput);
    if (state.currentRoot) {
      state.currentRoot.scale.setScalar(state.userScale);
      recomputeGrounding();
      updateModelBoundsAndRig(false);
    }
  });

  dom.offsetInput.addEventListener('input', () => {
    state.userOffset = Number(dom.offsetInput.value);
    dom.offsetOutput.value = state.userOffset.toFixed(2);
    updateRangeProgress(dom.offsetInput);
    if (state.currentRoot) state.currentRoot.position.y = state.groundY + state.userOffset;
  });

  $$('[data-rotate-axis]').forEach((button) => {
    button.addEventListener('click', () => rotateObject(button.dataset.rotateAxis));
  });

  dom.centerButton.addEventListener('click', centerModel);
  dom.groundButton.addEventListener('click', () => {
    state.userOffset = 0;
    dom.offsetInput.value = '0';
    dom.offsetOutput.value = '0.00';
    updateRangeProgress(dom.offsetInput);
    recomputeGrounding();
    showToast('Object grounded.');
  });
  dom.resetTransformButton.addEventListener('click', resetTransform);
  dom.resetButton.addEventListener('click', resetAll);
  dom.fitButton.addEventListener('click', () => fitModel());
  dom.objectFitButton.addEventListener('click', () => fitModel());
  dom.cameraResetButton.addEventListener('click', () => setCameraPreset('hero'));

  dom.focalInput.addEventListener('input', () => {
    const focal = Number(dom.focalInput.value);
    camera.setFocalLength(focal);
    dom.focalOutput.value = `${focal} mm`;
    updateRangeProgress(dom.focalInput);
  });
  dom.focalInput.addEventListener('change', () => fitModel());

  dom.dampingInput.addEventListener('input', () => {
    const value = Number(dom.dampingInput.value);
    controls.dampingFactor = value;
    dom.dampingOutput.value = value.toFixed(2);
    updateRangeProgress(dom.dampingInput);
  });

  dom.autoRotateToggle.addEventListener('change', () => {
    controls.autoRotate = dom.autoRotateToggle.checked;
    controls.autoRotateSpeed = 0.42;
  });

  dom.horizonToggle.addEventListener('change', () => {
    controls.maxPolarAngle = dom.horizonToggle.checked ? Math.PI * 0.93 : Math.PI - 0.001;
  });

  dom.animationSelect.addEventListener('change', () => selectAnimation(Number(dom.animationSelect.value), false));
  dom.animationPlayButton.addEventListener('click', toggleAnimationPlayback);
  dom.animationLoopToggle.addEventListener('change', updateAnimationLoop);
  dom.animationSpeedInput.addEventListener('input', () => {
    const speed = Number(dom.animationSpeedInput.value);
    if (state.mixer) state.mixer.timeScale = speed;
    dom.animationSpeedOutput.value = `${speed.toFixed(2)}×`;
    updateRangeProgress(dom.animationSpeedInput);
  });

  dom.turntableToggle.addEventListener('change', () => {
    state.turntable = dom.turntableToggle.checked;
  });
  dom.turntableSpeedInput.addEventListener('input', () => {
    state.turntableSpeed = Number(dom.turntableSpeedInput.value);
    dom.turntableSpeedOutput.value = `${state.turntableSpeed.toFixed(2)}×`;
    updateRangeProgress(dom.turntableSpeedInput);
  });

  dom.dismissIntro.addEventListener('click', dismissIntro);
  dom.introHint.addEventListener('pointerdown', (event) => event.stopPropagation());

  dom.panelToggle.addEventListener('click', toggleMobilePanel);
  dom.panelClose.addEventListener('click', closeMobilePanel);

  dom.helpButton.addEventListener('click', () => {
    if (typeof dom.helpDialog.showModal === 'function') dom.helpDialog.showModal();
    else dom.helpDialog.setAttribute('open', '');
  });

  dom.exportButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = dom.exportButton.getAttribute('aria-expanded') === 'true';
    toggleExportMenu(!open);
  });

  $$('#exportMenu [data-export]').forEach((button) => {
    button.addEventListener('click', () => {
      toggleExportMenu(false);
      exportImage(button.dataset.export);
    });
  });

  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.export-wrap')) toggleExportMenu(false);
  });

  dom.fullscreenButton.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', updateFullscreenButton);

  controls.addEventListener('start', () => {
    state.cameraTween = null;
  });
}

function bindRange(input, output, callback) {
  input.addEventListener('input', () => {
    const value = Number(input.value);
    updateRangeProgress(input);
    callback(value);
  });
  output.value = Number(input.value).toFixed(2);
}

function initRangeVisuals() {
  $$('input[type="range"]').forEach(updateRangeProgress);
}

function updateRangeProgress(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value);
  const percent = ((value - min) / (max - min)) * 100;
  input.style.setProperty('--range-progress', `${Math.max(0, Math.min(100, percent))}%`);
}

function shouldStartBalanced() {
  const compact = window.matchMedia('(max-width: 720px)').matches;
  const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
  return compact || lowMemory;
}

function hideDropOverlay() {
  dom.dropOverlay.classList.remove('is-visible');
  dom.dropOverlay.setAttribute('aria-hidden', 'true');
}

async function loadGLBFile(file) {
  if (!file?.name?.toLowerCase().endsWith('.glb')) {
    showToast('Please choose a self-contained .glb file.', true, '!');
    return;
  }

  const maxRecommended = 180 * 1024 * 1024;
  if (file.size > maxRecommended) {
    showToast('Large GLB detected. It may exceed mobile GPU memory.', false, 'i');
  }

  showLoading(true, 'Reading geometry', 7);
  setModelStatus('loading', file.name, 'LOADING');
  const objectUrl = URL.createObjectURL(file);

  loader.load(
    objectUrl,
    (gltf) => {
      URL.revokeObjectURL(objectUrl);
      try {
        const asset = gltf.scene || gltf.scenes?.[0];
        if (!asset) throw new Error('This GLB does not contain a renderable scene.');
        showLoading(true, 'Optimizing scene', 92);
        requestAnimationFrame(() => {
          try {
            setModel(asset, gltf.animations || [], {
              name: stripExtension(file.name),
              fileSize: file.size,
              procedural: false,
              immediateCamera: false,
            });
            showLoading(false);
            setModelStatus('ready', stripExtension(file.name), `${formatBytes(file.size)} · READY`);
            dismissIntro();
            showToast(`${stripExtension(file.name)} is ready to render.`);
          } catch (error) {
            console.error(error);
            showLoading(false);
            setModelStatus('error', file.name, 'IMPORT ERROR');
            showToast(cleanErrorMessage(error), true, '!');
          }
        });
      } catch (error) {
        showLoading(false);
        setModelStatus('error', file.name, 'IMPORT ERROR');
        showToast(cleanErrorMessage(error), true, '!');
      }
    },
    (progressEvent) => {
      const total = progressEvent.total || file.size || 0;
      const loaded = progressEvent.loaded || 0;
      const ratio = total > 0 ? loaded / total : 0.32;
      const percent = Math.min(88, Math.max(8, Math.round(ratio * 88)));
      const label = ratio > 0.72 ? 'Decoding textures' : ratio > 0.35 ? 'Building materials' : 'Reading geometry';
      showLoading(true, label, percent);
    },
    (error) => {
      URL.revokeObjectURL(objectUrl);
      console.error(error);
      showLoading(false);
      setModelStatus('error', file.name, 'IMPORT ERROR');
      showToast('The GLB could not be decoded. Check that it is valid and self-contained.', true, '!');
    },
  );
}

function setModel(asset, animations, options) {
  const nextRoot = new THREE.Group();
  nextRoot.name = 'Product VIS Model Root';
  nextRoot.add(asset);

  prepareAsset(asset, nextRoot);

  if (state.currentRoot) {
    scene.remove(state.currentRoot);
    disposeObject(state.currentRoot);
  }

  state.currentRoot = nextRoot;
  state.currentAsset = asset;
  state.currentName = options.name || 'Untitled Product';
  state.currentFileSize = options.fileSize ?? null;
  state.userScale = 1;
  state.userOffset = 0;
  state.transformTween = null;

  scene.add(nextRoot);
  nextRoot.updateMatrixWorld(true);
  recomputeGrounding();
  updateModelBoundsAndRig(true);
  setupAnimations(animations, asset);
  setMaterialMode('original', false);
  updateTransformUI();
  updateModelStats(collectModelStats(nextRoot), options);
  setModelStatus('ready', state.currentName, options.procedural ? 'DEMO · READY' : `${formatBytes(options.fileSize)} · READY`);
  setCameraPreset('hero', Boolean(options.immediateCamera));
}

function prepareAsset(asset, root) {
  let meshCount = 0;
  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  asset.traverse((object) => {
    if (!object.isMesh) return;
    meshCount += 1;
    object.castShadow = state.shadowsEnabled;
    object.receiveShadow = true;
    object.frustumCulled = true;
    object.userData.__pvOriginalMaterial = object.material;

    forEachMaterial(object.material, (material) => {
      material.needsUpdate = true;
      for (const value of Object.values(material)) {
        if (value?.isTexture) value.anisotropy = maxAnisotropy;
      }
    });
  });

  if (meshCount === 0) throw new Error('No mesh geometry was found in this GLB.');

  asset.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(asset);
  if (box.isEmpty()) throw new Error('The model bounds are empty.');

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDimension) || maxDimension <= 0) throw new Error('The model has invalid dimensions.');

  const normalizedSize = 3.15;
  const scale = normalizedSize / maxDimension;
  asset.scale.multiplyScalar(scale);
  asset.position.x -= center.x * scale;
  asset.position.y -= box.min.y * scale;
  asset.position.z -= center.z * scale;

  root.updateMatrixWorld(true);
}

function disposeObject(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  root.traverse((object) => {
    if (!object.isMesh) return;
    if (object.geometry) geometries.add(object.geometry);
    const original = object.userData.__pvOriginalMaterial;
    forEachMaterial(original || object.material, (material) => materials.add(material));
    forEachMaterial(object.material, (material) => materials.add(material));
  });

  materials.forEach((material) => {
    if (!material || protectedMaterials.has(material)) return;
    Object.values(material).forEach((value) => {
      if (value?.isTexture && value !== environmentTexture) textures.add(value);
    });
  });

  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => {
    if (material && !protectedMaterials.has(material)) material.dispose();
  });
  geometries.forEach((geometry) => geometry.dispose());
}

function collectModelStats(root) {
  let triangles = 0;
  let vertices = 0;
  const materials = new Set();
  const textures = new Set();

  root.traverse((object) => {
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

function updateModelStats(stats, options) {
  dom.trianglesStat.textContent = formatNumber(stats.triangles);
  dom.verticesStat.textContent = formatNumber(stats.vertices);
  dom.materialsStat.textContent = String(stats.materials);
  dom.texturesStat.textContent = String(stats.textures);
  dom.animationsStat.textContent = String(state.clips.length);
  dom.fileSizeStat.textContent = options.procedural ? 'Procedural' : formatBytes(options.fileSize);
  dom.statsBadge.textContent = `${formatCompact(stats.triangles)} TRIS · ${stats.materials} MATS`;
}

function setModelStatus(status, name, meta) {
  dom.modelStatus?.classList.remove('is-loading', 'is-error');
  if (status === 'loading') dom.modelStatus?.classList.add('is-loading');
  if (status === 'error') dom.modelStatus?.classList.add('is-error');
  dom.modelName.textContent = name;
  dom.modelMeta.textContent = meta;
}

function updateModelBoundsAndRig(updateShadowScale = true) {
  if (!state.currentRoot) return;
  state.currentRoot.updateMatrixWorld(true);
  state.modelBounds.setFromObject(state.currentRoot);
  const size = state.modelBounds.getSize(new THREE.Vector3());
  const sphere = state.modelBounds.getBoundingSphere(new THREE.Sphere());
  state.modelRadius = Math.max(sphere.radius, 0.4);
  state.modelHeight = Math.max(size.y, 0.5);

  const extent = Math.max(4, state.modelRadius * 2.25);
  const shadowCamera = keyLight.shadow.camera;
  shadowCamera.left = -extent;
  shadowCamera.right = extent;
  shadowCamera.top = extent;
  shadowCamera.bottom = -extent;
  shadowCamera.near = 0.1;
  shadowCamera.far = Math.max(30, extent * 5);
  shadowCamera.updateProjectionMatrix();

  const targetY = state.modelBounds.min.y + size.y * 0.48;
  [keyLight.target, fillLight.target, rimLight.target].forEach((target) => {
    target.position.set(0, targetY, 0);
    target.updateMatrixWorld();
  });

  if (updateShadowScale) {
    const footprint = Math.max(size.x, size.z, 1.2);
    contactShadow.scale.set(footprint * 1.72, footprint * 1.72, 1);
    contactShadow.position.x = (state.modelBounds.min.x + state.modelBounds.max.x) * 0.5;
    contactShadow.position.z = (state.modelBounds.min.z + state.modelBounds.max.z) * 0.5;
  }

  controls.minDistance = Math.max(0.3, state.modelRadius * 0.35);
  controls.maxDistance = Math.max(18, state.modelRadius * 12);
}

function recomputeGrounding() {
  if (!state.currentRoot) return;
  state.currentRoot.position.y = 0;
  state.currentRoot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(state.currentRoot);
  state.groundY = -box.min.y;
  state.currentRoot.position.y = state.groundY + state.userOffset;
  state.currentRoot.updateMatrixWorld(true);
}

function centerModel() {
  if (!state.currentRoot) return;
  state.currentRoot.position.x = 0;
  state.currentRoot.position.z = 0;
  state.currentRoot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(state.currentRoot);
  const center = box.getCenter(new THREE.Vector3());
  state.currentRoot.position.x -= center.x;
  state.currentRoot.position.z -= center.z;
  recomputeGrounding();
  updateModelBoundsAndRig(true);
  showToast('Object centered.');
}

function rotateObject(axis) {
  if (!state.currentRoot || state.transformTween) return;
  const axisVector = axis === 'x'
    ? new THREE.Vector3(1, 0, 0)
    : axis === 'y'
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(0, 0, 1);
  const delta = new THREE.Quaternion().setFromAxisAngle(axisVector, Math.PI / 2);
  const start = state.currentRoot.quaternion.clone();
  const end = start.clone().multiply(delta).normalize();
  state.transformTween = {
    start,
    end,
    startedAt: performance.now(),
    duration: 620,
    onComplete: () => {
      recomputeGrounding();
      updateModelBoundsAndRig(true);
      fitModel();
    },
  };
}

function resetTransform(showMessage = true) {
  if (!state.currentRoot) return;
  state.currentRoot.rotation.set(0, 0, 0);
  state.currentRoot.quaternion.identity();
  state.currentRoot.scale.setScalar(1);
  state.currentRoot.position.set(0, 0, 0);
  state.userScale = 1;
  state.userOffset = 0;
  recomputeGrounding();
  updateModelBoundsAndRig(true);
  updateTransformUI();
  if (showMessage) showToast('Object transform reset.');
}

function updateTransformUI() {
  dom.scaleInput.value = String(state.userScale);
  dom.scaleOutput.value = `${state.userScale.toFixed(2)}×`;
  dom.offsetInput.value = String(state.userOffset);
  dom.offsetOutput.value = state.userOffset.toFixed(2);
  updateRangeProgress(dom.scaleInput);
  updateRangeProgress(dom.offsetInput);
}

function setMaterialMode(mode, showMessage = true) {
  if (!overrideMaterials[mode] && mode !== 'original') return;
  state.materialMode = mode;

  if (state.currentRoot) {
    state.currentRoot.traverse((object) => {
      if (!object.isMesh) return;
      const original = object.userData.__pvOriginalMaterial;
      if (!original) return;
      object.material = mode === 'original' ? original : overrideMaterials[mode];
      object.material.needsUpdate = true;
    });
  }

  $$('[data-material]').forEach((button) => button.classList.toggle('is-active', button.dataset.material === mode));
  dom.materialModeValue.textContent = mode.toUpperCase();
  if (showMessage) showToast(`${capitalize(mode)} material treatment applied.`);
}

function applyLookPreset(name, immediate = false) {
  const preset = LOOK_PRESETS[name];
  if (!preset) return;
  state.currentPreset = name;

  $$('.scene-preset').forEach((button) => {
    const active = button.dataset.preset === name;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  const target = {
    top: new THREE.Color(preset.top),
    bottom: new THREE.Color(preset.bottom),
    accent: new THREE.Color(preset.accent),
    floor: new THREE.Color(preset.floor),
    keyColor: new THREE.Color(preset.keyColor),
    fillColor: new THREE.Color(preset.fillColor),
    rimColor: new THREE.Color(preset.rimColor),
    accentStrength: preset.accentStrength,
    floorRoughness: preset.floorRoughness,
    exposure: preset.exposure,
    environment: preset.environment,
    key: preset.key,
    fill: preset.fill,
    rim: preset.rim,
    bloom: preset.bloom,
    shadow: preset.shadow,
  };

  const from = getCurrentLook();
  state.lookTween = {
    from,
    to: target,
    startedAt: performance.now(),
    duration: immediate ? 1 : 850,
  };

  setLookInputs(preset);
  if (!immediate) showToast(`${capitalize(name)} environment loaded.`);
}

function getCurrentLook() {
  return {
    top: backgroundMaterial.uniforms.topColor.value.clone(),
    bottom: backgroundMaterial.uniforms.bottomColor.value.clone(),
    accent: backgroundMaterial.uniforms.accentColor.value.clone(),
    floor: floorMesh.material.color.clone(),
    keyColor: keyLight.color.clone(),
    fillColor: fillLight.color.clone(),
    rimColor: rimLight.color.clone(),
    accentStrength: backgroundMaterial.uniforms.accentStrength.value,
    floorRoughness: floorMesh.material.roughness,
    exposure: renderer.toneMappingExposure,
    environment: scene.environmentIntensity,
    key: keyLight.intensity,
    fill: fillLight.intensity,
    rim: rimLight.intensity,
    bloom: bloomPass.strength,
    shadow: contactShadow.material.opacity,
  };
}

function setLookInputs(preset) {
  setInputValue(dom.exposureInput, dom.exposureOutput, preset.exposure, 2);
  setInputValue(dom.environmentInput, dom.environmentOutput, preset.environment, 2);
  setInputValue(dom.keyInput, dom.keyOutput, preset.key, 2);
  setInputValue(dom.rimInput, dom.rimOutput, preset.rim, 2);
  setInputValue(dom.bloomInput, dom.bloomOutput, preset.bloom, 2);
}

function setInputValue(input, output, value, decimals = 2) {
  input.value = String(value);
  output.value = Number(value).toFixed(decimals);
  updateRangeProgress(input);
}

function markLookCustom() {
  state.currentPreset = null;
  state.lookTween = null;
  $$('.scene-preset').forEach((button) => {
    button.classList.remove('is-active');
    button.setAttribute('aria-pressed', 'false');
  });
}

function updateLookTween(now) {
  const tween = state.lookTween;
  if (!tween) return;
  const raw = Math.min(1, (now - tween.startedAt) / tween.duration);
  const t = easeInOutCubic(raw);
  const { from, to } = tween;

  backgroundMaterial.uniforms.topColor.value.copy(from.top).lerp(to.top, t);
  backgroundMaterial.uniforms.bottomColor.value.copy(from.bottom).lerp(to.bottom, t);
  backgroundMaterial.uniforms.accentColor.value.copy(from.accent).lerp(to.accent, t);
  floorMesh.material.color.copy(from.floor).lerp(to.floor, t);
  keyLight.color.copy(from.keyColor).lerp(to.keyColor, t);
  fillLight.color.copy(from.fillColor).lerp(to.fillColor, t);
  rimLight.color.copy(from.rimColor).lerp(to.rimColor, t);

  backgroundMaterial.uniforms.accentStrength.value = THREE.MathUtils.lerp(from.accentStrength, to.accentStrength, t);
  floorMesh.material.roughness = THREE.MathUtils.lerp(from.floorRoughness, to.floorRoughness, t);
  renderer.toneMappingExposure = THREE.MathUtils.lerp(from.exposure, to.exposure, t);
  scene.environmentIntensity = THREE.MathUtils.lerp(from.environment, to.environment, t);
  keyLight.intensity = THREE.MathUtils.lerp(from.key, to.key, t);
  fillLight.intensity = THREE.MathUtils.lerp(from.fill, to.fill, t);
  rimLight.intensity = THREE.MathUtils.lerp(from.rim, to.rim, t);
  bloomPass.strength = THREE.MathUtils.lerp(from.bloom, to.bloom, t);
  contactShadow.material.opacity = THREE.MathUtils.lerp(from.shadow, to.shadow, t);

  if (raw >= 1) state.lookTween = null;
}

function setQuality(mode, showMessage = true) {
  if (!['performance', 'balanced', 'quality'].includes(mode)) return;
  state.quality = mode;

  const devicePixelRatio = window.devicePixelRatio || 1;
  const dpr = mode === 'quality'
    ? Math.min(devicePixelRatio, 2)
    : mode === 'balanced'
      ? Math.min(devicePixelRatio, 1.45)
      : Math.min(devicePixelRatio, 1);
  const shadowSize = mode === 'quality' ? 2048 : mode === 'balanced' ? 1536 : 1024;

  renderer.setPixelRatio(dpr);
  composer.setPixelRatio(dpr);
  keyLight.shadow.mapSize.set(shadowSize, shadowSize);
  keyLight.shadow.map?.dispose();
  keyLight.shadow.map = null;
  handleResize();

  $$('[data-quality]').forEach((button) => button.classList.toggle('is-active', button.dataset.quality === mode));
  dom.qualityValue.textContent = mode.toUpperCase();
  dom.renderModeBadge.innerHTML = `<i></i> ${mode.toUpperCase()}`;
  if (showMessage) showToast(`${capitalize(mode)} render mode active.`);
}

function setCameraPreset(name, immediate = false) {
  const preset = CAMERA_PRESETS[name];
  if (!preset || !state.currentRoot) return;
  updateModelBoundsAndRig(false);

  const size = state.modelBounds.getSize(new THREE.Vector3());
  const target = state.modelBounds.getCenter(new THREE.Vector3());
  target.y = state.modelBounds.min.y + size.y * preset.targetY;
  const distance = computeFitDistance() * preset.distance;
  const direction = preset.direction.clone().normalize();
  const position = target.clone().add(direction.multiplyScalar(distance));

  state.cameraPreset = name;
  setCameraButtons(name);
  tweenCamera(position, target, immediate ? 1 : 820);
}

function setCameraButtons(name) {
  $$('.camera-preset, .camera-card').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.camera === name);
  });
}

function computeFitDistance() {
  const radius = Math.max(state.modelRadius, 0.45);
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const limitingFov = Math.min(verticalFov, horizontalFov);
  return (radius / Math.sin(Math.max(0.12, limitingFov / 2))) * 1.12;
}

function fitModel(immediate = false) {
  if (!state.currentRoot) return;
  updateModelBoundsAndRig(false);
  const size = state.modelBounds.getSize(new THREE.Vector3());
  const target = state.modelBounds.getCenter(new THREE.Vector3());
  target.y = state.modelBounds.min.y + size.y * 0.48;
  const direction = camera.position.clone().sub(controls.target).normalize();
  if (!Number.isFinite(direction.x) || direction.lengthSq() < 0.001) direction.set(1, 0.35, 1.5).normalize();
  const position = target.clone().add(direction.multiplyScalar(computeFitDistance()));
  tweenCamera(position, target, immediate ? 1 : 650);
}

function tweenCamera(position, target, duration) {
  state.cameraTween = {
    fromPosition: camera.position.clone(),
    toPosition: position.clone(),
    fromTarget: controls.target.clone(),
    toTarget: target.clone(),
    startedAt: performance.now(),
    duration,
  };
}

function updateCameraTween(now) {
  const tween = state.cameraTween;
  if (!tween) return;
  const raw = Math.min(1, (now - tween.startedAt) / tween.duration);
  const t = easeOutQuint(raw);
  camera.position.copy(tween.fromPosition).lerp(tween.toPosition, t);
  controls.target.copy(tween.fromTarget).lerp(tween.toTarget, t);
  controls.update();
  if (raw >= 1) state.cameraTween = null;
}

function updateTransformTween(now) {
  const tween = state.transformTween;
  if (!tween || !state.currentRoot) return;
  const raw = Math.min(1, (now - tween.startedAt) / tween.duration);
  const t = easeInOutCubic(raw);
  state.currentRoot.quaternion.slerpQuaternions(tween.start, tween.end, t);
  if (raw >= 1) {
    state.currentRoot.quaternion.copy(tween.end);
    state.transformTween = null;
    tween.onComplete?.();
  }
}

function setupAnimations(clips, asset) {
  if (state.mixer) {
    state.mixer.stopAllAction();
  }

  state.clips = clips || [];
  state.action = null;
  state.animationPlaying = false;
  dom.animationSelect.innerHTML = '';
  dom.animationPlayButton.classList.remove('is-playing');
  dom.animationPlayButton.querySelector('span').textContent = 'Play';

  if (state.clips.length === 0) {
    state.mixer = null;
    dom.animationSelect.disabled = true;
    dom.animationSelect.innerHTML = '<option>No animations in this model</option>';
    dom.animationPlayButton.disabled = true;
    dom.animationSpeedInput.disabled = true;
    dom.animationSpeedControl.classList.add('is-disabled');
    dom.animationCount.textContent = '0 CLIPS';
    dom.animationsStat.textContent = '0';
    return;
  }

  state.mixer = new THREE.AnimationMixer(asset);
  state.mixer.addEventListener('finished', () => {
    if (!dom.animationLoopToggle.checked) setAnimationPlaying(false);
  });

  state.clips.forEach((clip, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = clip.name || `Clip ${index + 1}`;
    dom.animationSelect.appendChild(option);
  });

  dom.animationSelect.disabled = false;
  dom.animationPlayButton.disabled = false;
  dom.animationSpeedInput.disabled = false;
  dom.animationSpeedControl.classList.remove('is-disabled');
  dom.animationCount.textContent = `${state.clips.length} ${state.clips.length === 1 ? 'CLIP' : 'CLIPS'}`;
  dom.animationsStat.textContent = String(state.clips.length);
  selectAnimation(0, false);
}

function selectAnimation(index, autoplay = false) {
  if (!state.mixer || !state.clips[index]) return;
  const previous = state.action;
  const next = state.mixer.clipAction(state.clips[index]);
  next.reset();
  next.enabled = true;
  next.clampWhenFinished = true;
  state.action = next;
  dom.animationSelect.value = String(index);
  updateAnimationLoop();

  if (previous && previous !== next) {
    previous.fadeOut(0.25);
    next.fadeIn(0.25);
  }

  next.play();
  next.paused = !autoplay;
  setAnimationPlaying(autoplay);
}

function toggleAnimationPlayback() {
  if (!state.action) return;
  if (state.animationPlaying) {
    state.action.paused = true;
    setAnimationPlaying(false);
  } else {
    if (state.action.time >= state.action.getClip().duration - 0.001) state.action.reset();
    state.action.paused = false;
    state.action.play();
    setAnimationPlaying(true);
  }
}

function setAnimationPlaying(playing) {
  state.animationPlaying = playing;
  dom.animationPlayButton.classList.toggle('is-playing', playing);
  dom.animationPlayButton.querySelector('span').textContent = playing ? 'Pause' : 'Play';
}

function updateAnimationLoop() {
  if (!state.action) return;
  if (dom.animationLoopToggle.checked) {
    state.action.setLoop(THREE.LoopRepeat, Infinity);
    state.action.clampWhenFinished = false;
  } else {
    state.action.setLoop(THREE.LoopOnce, 1);
    state.action.clampWhenFinished = true;
  }
}

function switchPanel(name) {
  const titles = { look: 'Look', object: 'Object', camera: 'Camera', motion: 'Motion' };
  $$('.panel-tab').forEach((button) => {
    const active = button.dataset.panel === name;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  $$('[data-panel-page]').forEach((page) => {
    const active = page.dataset.panelPage === name;
    page.classList.toggle('is-active', active);
    page.hidden = !active;
  });
  dom.panelTitle.textContent = titles[name] || capitalize(name);
}

function toggleMobilePanel() {
  const opening = !dom.controlPanel.classList.contains('is-open');
  dom.controlPanel.classList.toggle('is-open', opening);
  dom.panelToggle.setAttribute('aria-expanded', String(opening));
  document.body.classList.toggle('panel-open', opening);
}

function closeMobilePanel() {
  dom.controlPanel.classList.remove('is-open');
  dom.panelToggle.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('panel-open');
}

function toggleExportMenu(open) {
  dom.exportButton.setAttribute('aria-expanded', String(open));
  dom.exportMenu.hidden = !open;
}

async function exportImage(format) {
  if (state.isExporting) return;
  state.isExporting = true;
  dom.exportButton.disabled = true;

  const rect = dom.canvas.getBoundingClientRect();
  let width;
  let height;
  if (format === 'viewport') {
    const exportDpr = Math.min(window.devicePixelRatio || 1, state.quality === 'performance' ? 1 : 2);
    width = Math.round(rect.width * exportDpr);
    height = Math.round(rect.height * exportDpr);
  } else {
    [width, height] = format.split('x').map(Number);
  }

  const oldPixelRatio = renderer.getPixelRatio();
  const oldAspect = camera.aspect;
  const oldSize = renderer.getSize(new THREE.Vector2());

  try {
    renderer.setPixelRatio(1);
    composer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderScene();

    const blob = await canvasToBlob(dom.canvas, 'image/png');
    if (!blob) throw new Error('The browser could not create the PNG.');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const presetName = state.currentPreset || 'custom';
    link.download = `${slugify(state.currentName)}-${presetName}-${width}x${height}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1500);
    showToast(`PNG exported at ${width} × ${height}.`);
  } catch (error) {
    console.error(error);
    showToast(cleanErrorMessage(error), true, '!');
  } finally {
    renderer.setPixelRatio(oldPixelRatio);
    composer.setPixelRatio(oldPixelRatio);
    renderer.setSize(oldSize.x, oldSize.y, false);
    composer.setSize(oldSize.x, oldSize.y);
    camera.aspect = oldAspect;
    camera.updateProjectionMatrix();
    handleResize();
    state.isExporting = false;
    dom.exportButton.disabled = false;
  }
}

function canvasToBlob(canvas, type) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 1));
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) await dom.viewportShell.requestFullscreen();
    else await document.exitFullscreen();
  } catch (error) {
    showToast('Fullscreen is not available in this browser.', true, '!');
  }
}

function updateFullscreenButton() {
  dom.fullscreenButton.classList.toggle('is-active', Boolean(document.fullscreenElement));
  setTimeout(handleResize, 80);
}

function resetAll() {
  resetTransform(false);
  applyLookPreset('studio', false);
  setMaterialMode('original', false);
  setCameraPreset('hero');
  controls.autoRotate = false;
  dom.autoRotateToggle.checked = false;
  state.turntable = false;
  dom.turntableToggle.checked = false;
  showToast('Render reset to studio defaults.');
}

function dismissIntro() {
  if (state.introDismissed) return;
  state.introDismissed = true;
  dom.introHint.classList.add('is-dismissed');
}

function handleKeyboardShortcut(event) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
  if (dom.helpDialog.open) return;

  const key = event.key.toLowerCase();
  if (key === 'i') dom.fileInput.click();
  if (key === 'f') fitModel();
  if (key === 'r') resetAll();
  if (key === ' ') {
    if (state.clips.length > 0) {
      event.preventDefault();
      toggleAnimationPlayback();
    }
  }

  const cameraKeys = { '1': 'hero', '2': 'front', '3': 'side', '4': 'top', '5': 'detail' };
  if (cameraKeys[event.key]) setCameraPreset(cameraKeys[event.key]);
}

function handleResize() {
  if (!renderer || !camera || !composer) return;
  const width = Math.max(1, dom.viewportShell.clientWidth);
  const height = Math.max(1, dom.viewportShell.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  composer.setSize(width, height);
  const exportDpr = Math.min(window.devicePixelRatio || 1, state.quality === 'performance' ? 1 : 2);
  dom.viewportExportSize.textContent = `${Math.round(width * exportDpr)} × ${Math.round(height * exportDpr)}`;

  if (window.innerWidth > 720) {
    dom.controlPanel.classList.remove('is-open');
    document.body.classList.remove('panel-open');
    dom.panelToggle.setAttribute('aria-expanded', 'true');
  } else if (!dom.controlPanel.classList.contains('is-open')) {
    dom.panelToggle.setAttribute('aria-expanded', 'false');
  }
}

function renderLoop(now) {
  const delta = Math.min(clock.getDelta(), 0.05);
  updateLookTween(now);
  updateCameraTween(now);
  updateTransformTween(now);

  if (state.mixer) state.mixer.update(delta);
  if (state.turntable && state.currentRoot && !state.transformTween) {
    state.currentRoot.rotation.y += delta * state.turntableSpeed * 0.7;
  }

  controls.update(delta);
  backgroundSphere.position.copy(camera.position);
  renderScene();
}

function renderScene() {
  if (state.postEnabled) composer.render();
  else renderer.render(scene, camera);
}

function showLoading(show, label = 'Preparing model', percent = 8) {
  dom.loadingOverlay.hidden = !show;
  if (show) {
    dom.loadingLabel.textContent = label;
    dom.loadingProgress.style.width = `${Math.max(4, Math.min(100, percent))}%`;
  }
}

function showToast(message, isError = false, icon = '✓') {
  clearTimeout(state.toastTimer);
  dom.toast.hidden = false;
  dom.toastMessage.textContent = message;
  dom.toastIcon.textContent = icon;
  dom.toast.classList.toggle('is-error', isError);
  requestAnimationFrame(() => dom.toast.classList.add('is-visible'));
  state.toastTimer = setTimeout(() => {
    dom.toast.classList.remove('is-visible');
    setTimeout(() => { dom.toast.hidden = true; }, 280);
  }, isError ? 5200 : 2800);
}

function showFatalError(error) {
  console.error('Product VIS failed to initialize:', error);
  const message = document.createElement('div');
  message.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:28px;background:#08090a;color:#f4f4f0;font:14px/1.5 Inter,system-ui,sans-serif;text-align:center;';
  message.innerHTML = `<div style="max-width:520px"><div style="color:#ff7950;font-size:10px;font-weight:800;letter-spacing:.16em;margin-bottom:18px">PRODUCT VIS / RENDERER ERROR</div><h1 style="margin:0 0 14px;font-size:32px;line-height:1;font-weight:520;letter-spacing:-.04em">WebGL could not start.</h1><p style="margin:0;color:rgba(255,255,255,.55)">Use a current Chrome, Edge, Safari or Firefox build with hardware acceleration enabled, then reload the page.</p></div>`;
  document.body.appendChild(message);
}

function forEachMaterial(materialOrArray, callback) {
  if (!materialOrArray) return;
  if (Array.isArray(materialOrArray)) materialOrArray.forEach(callback);
  else callback(materialOrArray);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Math.round(value || 0));
}

function formatCompact(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return String(Math.round(value || 0));
}

function stripExtension(filename) {
  return filename.replace(/\.[^/.]+$/, '');
}

function slugify(value) {
  return String(value || 'product-vis')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'product-vis';
}

function cleanErrorMessage(error) {
  const message = error?.message || String(error || 'Unknown renderer error.');
  return message.replace(/^Error:\s*/i, '').slice(0, 180);
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function easeOutQuint(t) {
  return 1 - ((1 - t) ** 5);
}
