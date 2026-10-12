import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCubeStage, PLINTH_SIZE } from './cubeStage.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { DEFAULT_STATE, clone, clamp, friendlyMaterialName } from './state.js';
import { motionSample } from './motion.js';
import { createRenderLoop } from './renderLoop.js';
import { renderPixelRatio } from './renderBudget.js';

const D = THREE.MathUtils.degToRad;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const seeded = seed => { let a = seed | 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

export class StudioEngine {
  constructor(canvas, events) {
    this.canvas = canvas; this.events = events; this.config = clone(DEFAULT_STATE);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#11151b');
    this.scene.fog = new THREE.FogExp2('#141820', .026);
    this.camera = new THREE.PerspectiveCamera(35, 1, .05, 200);
    this.camera.position.set(6, 2.5, 7);
    this.target = V(0, .65, 0); this.desiredPosition = this.camera.position.clone(); this.desiredTarget = this.target.clone();
    this.product = new THREE.Group(); this.scene.add(this.product);
    this.stage = new THREE.Group(); this.scene.add(this.stage);
    this.lights = new THREE.Group(); this.scene.add(this.lights);
    this.model = null; this.materials = new Map(); this.meshes = []; this.modelSize = V(2, 1.3, 4.7);
    this.ready = false; this.disposed = false; this.loadToken = 0;
    this.motionTime = 0; this.transition = true; this.manual = false; this.focusMode = false; this.size = { width: 1200, height: 850 };
    this.selectionColor = new THREE.Color('#603000');
    this.focusPoint = new THREE.Vector3();
    this.lastFrame = performance.now();
    this.pointerDown = e => { this.pointerStart = [e.clientX, e.clientY]; };
    this.pointerUp = e => {
      if (!this.renderer || !this.pointerStart || Math.hypot(e.clientX - this.pointerStart[0], e.clientY - this.pointerStart[1]) > 7) return;
      this.pick(e, this.focusMode ? 'focus' : 'select');
    };
    this.doubleClick = e => this.pick(e, 'focus');
    this.canvas.addEventListener('pointerdown', this.pointerDown);
    this.canvas.addEventListener('pointerup', this.pointerUp);
    this.canvas.addEventListener('dblclick', this.doubleClick);
    this.contextLost = e => { e.preventDefault(); this.contextUnavailable = true; this.loop?.setPaused(true); this.events.onStatus?.('fallback'); this.events.onError?.('Il contesto 3D è stato interrotto. Ricarica l’anteprima per riprovare.'); };
    this.canvas.addEventListener('webglcontextlost', this.contextLost);
    this.setupRenderer(); this.setupLights(); this.setupFloor();
    this.loader = new GLTFLoader();
    this.loop = createRenderLoop({ render: time => this.tick(time) });
    this.visibilityChanged = () => { this.lastFrame = performance.now(); this.loop.setPaused(document.hidden || !!this.contextUnavailable); };
    document.addEventListener('visibilitychange', this.visibilityChanged);
    this.visibilityChanged();
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas.parentElement);
    this.resize();
    this.invalidate();
  }

  setupRenderer() {
    const context = this.canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!context) { this.events.onStatus?.('fallback'); return; }
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, context, antialias: true, preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environmentTarget = pmrem.fromScene(room, .04);
    this.environment = this.environmentTarget.texture;
    this.scene.environment = this.environment; this.scene.environmentIntensity = .65;
    room.dispose(); pmrem.dispose();
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.copy(this.target); this.controls.enableDamping = true; this.controls.dampingFactor = .08;
    this.controls.minDistance = 1.1; this.controls.maxDistance = 35;
    this.controls.maxPolarAngle = D(88); this.controls.minPolarAngle = D(3);
    this.controls.enablePan = false; this.controls.rotateSpeed = .65;
    this.controls.addEventListener('start', () => { this.transition = false; this.manual = true; this.events.onManualMove?.(); this.invalidate(); });
    this.controls.addEventListener('change', () => { if (!this.rendering) this.invalidate(); });
    this.controls.addEventListener('end', () => {
      this.manual = false;
      const offset = this.camera.position.clone().sub(this.controls.target), length = offset.length();
      const reference = this.desiredPosition.distanceTo(this.desiredTarget);
      this.events.onCameraChange?.({ azimuth: THREE.MathUtils.radToDeg(Math.atan2(offset.x, offset.z)), elevation: THREE.MathUtils.radToDeg(Math.asin(offset.y / length)), distance: clamp(this.config.camera.distance * length / reference, .25, 2.5) });
    });
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bokeh = new BokehPass(this.scene, this.camera, { focus: 8, aperture: .00007, maxblur: .005 });
    this.bloom = new UnrealBloomPass(new THREE.Vector2(800, 600), .2, .3, 1.6);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass); this.composer.addPass(this.bokeh); this.composer.addPass(this.bloom); this.composer.addPass(this.outputPass);
    this.events.onStatus?.('loading');
  }

  setupLights() {
    this.hemi = new THREE.HemisphereLight('#dfe8ff', '#1b1510', .85); this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight('#fff4e7', 3.3); this.key.position.set(-4, 7, 5);
    this.key.castShadow = true; this.key.shadow.mapSize.set(1024, 1024);
    Object.assign(this.key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: .1, far: 35 });
    this.key.shadow.bias = -.0003; this.key.shadow.normalBias = .025; this.key.shadow.radius = 4;
    this.fill = new THREE.DirectionalLight('#dce6ff', 1.4); this.fill.position.set(6, 3, 2);
    this.rim = new THREE.DirectionalLight('#ffbb65', 7); this.rim.position.set(-2, 4, -5);
    this.lights.add(this.key, this.fill, this.rim);
    this.ringLamp = new THREE.PointLight('#ffb020', 4, 6, 2); this.ringLamp.position.set(0, .3, 0); this.scene.add(this.ringLamp);
  }

  setupFloor() {
    this.floorMaterial = new THREE.MeshStandardMaterial({ color: '#202329', metalness: .4, roughness: .4 });
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), this.floorMaterial);
    this.floor.rotation.x = -Math.PI / 2; this.floor.position.y = -.012; this.floor.receiveShadow = true; this.scene.add(this.floor);
    if (this.renderer) {
      this.reflector = new Reflector(new THREE.PlaneGeometry(90, 90), { textureWidth: 512, textureHeight: 512, color: 0x363a40, clipBias: .003 });
      this.reflector.rotation.x = -Math.PI / 2; this.reflector.position.y = -.008;
      this.reflector.material.transparent = true; this.reflector.material.depthWrite = false;
      this.reflector.material.uniforms.pvReflection = { value: .27 };
      this.reflector.material.fragmentShader = this.reflector.material.fragmentShader.replace('uniform vec3 color;', 'uniform vec3 color; uniform float pvReflection;');
      this.reflector.material.fragmentShader = this.reflector.material.fragmentShader.replace('vec4 base = texture2DProj( tDiffuse, vUv );', `vec2 uv = vUv.xy / vUv.w;
        vec4 base = texture2D(tDiffuse, uv) * .4;
        base += texture2D(tDiffuse, uv + vec2(.0015, .002)) * .15;
        base += texture2D(tDiffuse, uv + vec2(-.0015, .002)) * .15;
        base += texture2D(tDiffuse, uv + vec2(.002, -.002)) * .15;
        base += texture2D(tDiffuse, uv + vec2(-.002, -.002)) * .15;`);
      this.reflector.material.fragmentShader = this.reflector.material.fragmentShader.replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );', 'gl_FragColor = vec4( blendOverlay( base.rgb, color ), pvReflection );');
      this.scene.add(this.reflector);
    }
  }

  async loadModel(source, isDemo = false) {
    const token = ++this.loadToken;
    this.loadAbort?.abort();
    this.loadAbort = new AbortController();
    const { signal } = this.loadAbort;
    this.events.onLoading?.(0);
    let buffer;
    if (source instanceof ArrayBuffer) buffer = source;
    else {
      const response = await fetch(source, { signal });
      if (!response.ok) throw new Error('Impossibile caricare il modello demo. Riprova.');
      const total = Number(response.headers.get('Content-Length')) || 12340172;
      if (!response.body) buffer = await response.arrayBuffer();
      else {
        const reader = response.body.getReader(), chunks = []; let length = 0, progress = -1;
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          chunks.push(value); length += value.length;
          const next = Math.min(85, Math.round(length / total * 85));
          if (next !== progress) { progress = next; this.events.onLoading?.(progress); }
        }
        const bytes = new Uint8Array(length); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        buffer = bytes.buffer;
      }
    }
    if (buffer.byteLength < 20 || new DataView(buffer).getUint32(0, true) !== 0x46546c67) throw new Error('Scegli un file GLB valido, con le texture incorporate.');
    const jsonLength = new DataView(buffer).getUint32(12, true);
    let manifest;
    try { manifest = JSON.parse(new TextDecoder().decode(buffer.slice(20, 20 + jsonLength))); } catch { throw new Error('Il file GLB è danneggiato.'); }
    if ([...(manifest.images || []), ...(manifest.buffers || [])].some(x => x.uri && !x.uri.startsWith('data:'))) throw new Error('Questo GLB usa file esterni. Esportalo con texture incorporate.');
    // Most GLBs, including the demo, need no geometry decoder. Load one only on demand.
    const extensions = manifest.extensionsUsed || [];
    if (extensions.includes('KHR_draco_mesh_compression') && !this.draco) {
      const { DRACOLoader, DRACO_GLTF_CONFIG } = await import('three/addons/loaders/DRACOLoader.js');
      if (signal.aborted || this.disposed) return null;
      this.draco = new DRACOLoader().setDecoderPath(DRACO_GLTF_CONFIG).setWorkerLimit(2);
      this.loader.setDRACOLoader(this.draco);
    }
    if (extensions.includes('EXT_meshopt_compression') || extensions.includes('KHR_meshopt_compression')) {
      const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
      if (signal.aborted || this.disposed) return null;
      this.loader.setMeshoptDecoder(MeshoptDecoder);
    }
    if (signal.aborted || this.disposed) return null;
    const gltf = await this.loader.parseAsync(buffer, '');
    if (token !== this.loadToken || this.disposed) { this.disposeObject(gltf.scene); return null; }
    const object = gltf.scene;
    object.updateMatrixWorld(true);
    let bounds = new THREE.Box3().setFromObject(object), size = bounds.getSize(new THREE.Vector3());
    const largest = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(largest) || largest <= 0) { this.disposeObject(object); throw new Error('Il modello non contiene una geometria visibile.'); }
    const wrapper = new THREE.Group(); wrapper.add(object);
    object.scale.multiplyScalar(4.7 / largest); object.updateMatrixWorld(true);
    bounds = new THREE.Box3().setFromObject(object); size = bounds.getSize(new THREE.Vector3());
    if (isDemo && size.x > size.z) { wrapper.rotation.y = Math.PI / 2; wrapper.updateMatrixWorld(true); }
    bounds = new THREE.Box3().setFromObject(wrapper); const center = bounds.getCenter(new THREE.Vector3());
    wrapper.position.set(-center.x, -bounds.min.y + .025, -center.z); wrapper.updateMatrixWorld(true);
    if (this.model) { this.product.remove(this.model); this.disposeObject(this.model); }
    this.materials.clear(); this.meshes = []; let fallbackIndex = manifest.materials?.length || 0;
    const clones = new Map(); this.selectedKey = null;
    wrapper.traverse(mesh => {
      if (!mesh.isMesh) return;
      this.meshes.push(mesh); mesh.castShadow = true; mesh.receiveShadow = true;
      const process = imported => {
        if (clones.has(imported.uuid)) return clones.get(imported.uuid);
        const index = gltf.parser.associations.get(imported)?.materials ?? fallbackIndex++;
        const id = `mat-${index}`;
        const material = imported.isMeshStandardMaterial && !imported.isMeshPhysicalMaterial
          ? THREE.MeshStandardMaterial.prototype.copy.call(new THREE.MeshPhysicalMaterial(), imported)
          : imported.clone();
        const original = {
          color: '#' + material.color.getHexString(), overlay: 0, roughness: material.roughness ?? .5,
          metalness: material.metalness ?? 0, clearcoat: material.clearcoat ?? 0,
          opacity: material.opacity, normalScale: material.normalScale?.x ?? 1, finish: 'original', uvChannel: material.map?.channel ?? 0,
        };
        const params = { color: new THREE.Color(original.color), overlay: 0 };
        material.userData.pv = { id, params };
        material.onBeforeCompile = shader => {
          shader.uniforms.pvColor = { value: params.color }; shader.uniforms.pvOverlay = { get value() { return params.overlay; } };
          shader.fragmentShader = 'uniform vec3 pvColor; uniform float pvOverlay;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
            float pvDetail = 1.0;
            #ifdef USE_MAP
              pvDetail = clamp(dot(sampledDiffuseColor.rgb, vec3(.2126,.7152,.0722)) * 1.5, .25, 1.4);
            #endif
            diffuseColor.rgb = mix(diffuseColor.rgb, pvColor * pvDetail, pvOverlay);`);
        };
        material.customProgramCacheKey = () => 'pv-overlay-v1';
        const uvChannels = [0, 1, 2, 3].filter(i => mesh.geometry.getAttribute(i === 0 ? 'uv' : `uv${i}`));
        const label = isDemo ? friendlyMaterialName(imported.name, index) : (imported.name || `Superficie ${index + 1}`);
        this.materials.set(id, { id, label, rawName: imported.name, material, original, baseColor: material.color.clone(), uvChannels, hasTexture: !!material.map, hasNormalMap: !!material.normalMap });
        clones.set(imported.uuid, material); imported.dispose(); return material;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(process) : process(mesh.material);
    });
    this.model = wrapper; this.product.rotation.set(0, 0, 0); this.product.position.set(0, 0, 0); this.product.add(wrapper);
    bounds = new THREE.Box3().setFromObject(wrapper); this.modelSize.copy(bounds.getSize(new THREE.Vector3()));
    this.target.set(0, this.modelSize.y * .5 + .02, 0); this.desiredTarget.copy(this.target);
    this.ready = true;
    const materials = [...this.materials.values()].map(({ material, baseColor, ...data }) => data);
    const selected = isDemo ? materials.find(m => /PaintTNR/i.test(m.rawName))?.id : materials[0]?.id;
    const initial = Object.fromEntries(materials.map(m => [m.id, { ...m.original }]));
    if (isDemo && selected) initial[selected] = { ...initial[selected], color: '#4c515b', overlay: 1, roughness: .24, metalness: .75, clearcoat: .8, finish: 'satin' };
    this.events.onLoading?.(100);
    this.events.onStatus?.(this.renderer ? 'ready' : 'fallback');
    return { materials, selected, initial, buffer, triangles: this.meshes.reduce((sum, m) => sum + (m.geometry.index?.count || m.geometry.attributes.position.count) / 3, 0), title: manifest.asset?.extras?.title || '' };
  }

  setState(config, { immediate = false } = {}) {
    const previous = this.config; this.config = config;
    const force = immediate || !this.sceneKey;
    // UI-only changes (name, delta) must not touch GPU resources or wake a sleeping scene.
    if (!force && ['scene', 'lighting', 'materials', 'camera', 'motion', 'quality', 'selectedMaterial'].every(key => previous[key] === config[key])) return;
    const sceneKey = JSON.stringify([config.scene.preset, config.scene.composition, config.scene.scale, config.scene.seed]);
    if (sceneKey !== this.sceneKey) { this.buildStage(config.scene); this.sceneKey = sceneKey; }
    if (force || previous.lighting !== config.lighting) this.applyLights(config.lighting);
    const bg = config.scene.preset === 'cubes' ? '#101722' : config.scene.preset === 'void' ? '#07090c' : config.scene.preset === 'studio' ? '#303741' : '#131820';
    this.scene.background.set(bg); this.scene.fog.color.set(bg);
    this.scene.fog.density = config.scene.preset === 'void' ? .035 : .012 + config.scene.fog * .075;
    this.floorMaterial.roughness = config.scene.floorRoughness;
    this.floorMaterial.color.set(config.scene.preset === 'studio' ? '#45494f' : '#1b1f25');
    this.floor.visible = !['void', 'cubes'].includes(config.scene.preset);
    if (this.cubeBaseMaterial) this.cubeBaseMaterial.roughness = config.scene.floorRoughness;
    if (this.reflector) {
      this.reflector.visible = config.scene.preset !== 'void' && config.scene.reflection > .015 && config.quality !== 'fluid';
      const surfaceScale = config.scene.preset === 'cubes' ? (PLINTH_SIZE - .14) / 90 : 1;
      this.reflector.scale.set(surfaceScale, surfaceScale, 1);
      this.reflector.position.y = config.scene.preset === 'cubes' ? .007 : -.008;
      this.reflector.material.uniforms.pvReflection.value = config.scene.reflection;
    }
    if (this.particles) { this.particles.visible = ['cinema', 'particles', 'cubes'].includes(config.scene.preset) && config.scene.particles > 0; this.particles.material.opacity = config.scene.particles * (config.scene.preset === 'particles' ? .8 : .18); }
    if (this.ring) this.ring.material.color.set(config.scene.ringColor);
    if (this.outerRing) this.outerRing.material.color.set(config.scene.ringColor);
    this.ringLamp.visible = config.scene.preset === 'ring'; this.ringLamp.color.set(config.scene.ringColor);
    for (const [id, entry] of this.materials) {
      if (!force && previous.materials[id] === config.materials[id]) continue;
      const values = config.materials[id] || entry.original, mat = entry.material;
      mat.userData.pv.params.color.set(values.color || entry.original.color);
      mat.userData.pv.params.overlay = values.overlay ?? 0;
      mat.roughness = values.roughness ?? entry.original.roughness;
      mat.metalness = values.metalness ?? entry.original.metalness;
      if ('clearcoat' in mat) mat.clearcoat = values.clearcoat ?? entry.original.clearcoat;
      if (mat.normalScale) mat.normalScale.setScalar(values.normalScale ?? entry.original.normalScale);
      const opacity = values.opacity ?? entry.original.opacity;
      if (mat.opacity !== opacity) { mat.opacity = opacity; mat.transparent = opacity < 1 || entry.original.opacity < 1; mat.needsUpdate = true; }
      if (mat.map && values.uvChannel != null && entry.uvChannels.includes(values.uvChannel) && mat.map.channel !== values.uvChannel) {
        const oldMap = mat.map; mat.map = mat.map.clone(); mat.map.channel = values.uvChannel; mat.map.needsUpdate = true; mat.needsUpdate = true;
        if (oldMap.userData.pvCloned) oldMap.dispose(); mat.map.userData.pvCloned = true;
      }
    }
    if (this.renderer) this.renderer.toneMappingExposure = Math.pow(2, config.camera.exposure) * 1.05;
    if (this.bokeh) {
      const blur = clamp((16 - config.camera.aperture) / 14.6, 0, 1);
      this.bokeh.uniforms.aperture.value = blur * .00013;
      this.bokeh.uniforms.maxblur.value = blur * .009;
      this.bokeh.enabled = config.camera.aperture < 14 && config.quality !== 'fluid';
    }
    if (this.bloom) this.bloom.enabled = config.quality !== 'fluid';
    if (config.quality !== previous.quality) this.resize();
    const cameraKey = JSON.stringify([config.camera.preset, config.camera.azimuth, config.camera.elevation, config.camera.distance, config.camera.focal, config.scene.preset]);
    if (this.cameraKey !== cameraKey || immediate) { this.frameCamera(config.camera); this.transition = true; this.cameraKey = cameraKey; }
    if (immediate) { this.camera.position.copy(this.desiredPosition); this.target.copy(this.desiredTarget); this.controls?.target.copy(this.target); this.camera.lookAt(this.target); this.transition = false; }
    if (config.motion.preset !== previous.motion.preset || config.motion.axis !== previous.motion.axis) {
      this.motionTime = 0; this.motionBaseAngle = 0; this.product.rotation.set(0, 0, 0); this.product.position.set(0, 0, 0);
      this.motionPosition = this.camera.position.clone(); this.motionTarget = (this.controls?.target || this.target).clone();
      if (config.motion.preset !== 'still') this.transition = false;
    } else if (config.motion.direction !== previous.motion.direction || config.motion.amplitude !== previous.motion.amplitude || config.motion.travel !== previous.motion.travel || config.motion.loop !== previous.motion.loop || (config.motion.playing && !previous.motion.playing)) {
      if (config.motion.playing && motionSample(config.motion, this.motionTime).ended) this.motionTime = 0;
      const sample = motionSample(config.motion, this.motionTime);
      this.motionBaseAngle = this.product.rotation[config.motion.axis] - sample.angle;
      this.motionTarget = (this.controls?.target || this.target).clone();
      const offset = this.camera.position.clone().sub(this.motionTarget);
      if (config.motion.preset === 'orbit') offset.applyAxisAngle(V(0, 1, 0), -sample.angle);
      if (config.motion.preset === 'dolly') offset.divideScalar(sample.dolly);
      this.motionPosition = this.motionTarget.clone().add(offset);
    }
    if (config.motion.preset === 'still') { this.product.rotation.set(0, 0, 0); this.product.position.set(0, 0, 0); }
    this.setSelected(config.selectedMaterial, this.activeTab === 'product');
    this.invalidate();
  }

  applyLights(s) {
    const t = clamp((s.temperature - 2000) / 7000, 0, 1);
    const keyColor = new THREE.Color('#ffbe7a').lerp(new THREE.Color('#c3dcff'), t);
    const tint = { warm: '#ffb84f', neutral: '#f2f0e7', cool: '#77aaff' }[s.tint];
    this.key.color.copy(keyColor); this.key.intensity = s.key * s.intensity;
    this.fill.color.set(s.preset === 'bicolor' ? '#65aaff' : '#c9d7ef'); this.fill.intensity = s.fill * s.intensity;
    this.rim.color.set(tint); this.rim.intensity = s.rim * s.intensity;
    this.key.position.set(s.preset === 'split' ? -6 : -4, s.preset === 'top' ? 9 : 7, s.preset === 'top' ? .5 : 5);
    this.lights.rotation.y = D(s.rotation);
    this.key.shadow.radius = 1 + s.softness * .085;
    this.hemi.intensity = .28 + s.fill * .18 * s.intensity;
    this.scene.environmentIntensity = .35 + .4 * s.intensity;
  }

  buildStage(s) {
    while (this.stage.children.length) { const item = this.stage.children[0]; this.stage.remove(item); this.disposeObject(item); }
    this.ring = null; this.outerRing = null; this.particles = null; this.cubeBaseMaterial = null;
    if (s.preset === 'ring') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.35, .10, 96), new THREE.MeshStandardMaterial({ color: '#15191f', metalness: .65, roughness: .3 }));
      base.position.y = -.032; base.receiveShadow = true; this.stage.add(base);
      this.ring = new THREE.Mesh(new THREE.TorusGeometry(3.3, .016, 8, 128), new THREE.MeshBasicMaterial({ color: s.ringColor, toneMapped: false }));
      this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = .021; this.stage.add(this.ring);
      const outer = new THREE.Mesh(new THREE.TorusGeometry(3.39, .006, 6, 128), new THREE.MeshBasicMaterial({ color: s.ringColor, transparent: true, opacity: .28 }));
      outer.rotation.x = -Math.PI / 2; outer.position.y = -.004; this.stage.add(outer); this.outerRing = outer;
    }
    if (s.preset === 'cubes') {
      const { group, baseMaterial } = createCubeStage(s);
      this.cubeBaseMaterial = baseMaterial; this.stage.add(group);
    }
    if (!['cinema', 'particles', 'cubes'].includes(s.preset)) return;
    const random = seeded(s.seed + 82), points = new Float32Array(160 * 3);
    for (let i = 0; i < 160; i++) { points[i * 3] = (random() - .5) * 17; points[i * 3 + 1] = random() * 6 + .5; points[i * 3 + 2] = -3 - random() * 10; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(points, 3));
    this.particles = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffc976', size: .022, transparent: true, opacity: .3, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.stage.add(this.particles);
  }

  frameCamera(s) {
    const w = this.size.width, h = this.size.height;
    this.camera.aspect = w / h; this.camera.setFocalLength(s.focal);
    const right = this.presentation ? 0 : Math.min(w * .6, this.workspaceInsets?.right || 0);
    const bottom = this.presentation ? 0 : Math.min(h * .65, this.workspaceInsets?.bottom || 0);
    this.camera.setViewOffset(w, h, right / 2, bottom / 2, w, h);
    this.camera.updateProjectionMatrix();
    const fov = D(this.camera.fov), width = Math.max(this.modelSize.x, this.modelSize.z);
    const cubeDepth = this.config.scene.preset === 'cubes' ? .8 : 0;
    const fit = Math.max(width / (2 * Math.tan(fov / 2) * this.camera.aspect * .8 * (w - right) / w), (this.modelSize.y + cubeDepth) / (2 * Math.tan(fov / 2) * .72 * (h - bottom) / h));
    const distance = fit * s.distance;
    const target = V(0, this.modelSize.y * .5 + .04 - cubeDepth * .25, 0);
    if (s.preset === 'macro') target.set(this.modelSize.x * .22, this.modelSize.y * .42, this.modelSize.z * .36);
    this.desiredTarget.copy(target);
    this.desiredPosition.set(Math.sin(D(s.azimuth)) * Math.cos(D(s.elevation)) * distance, Math.sin(D(s.elevation)) * distance, Math.cos(D(s.azimuth)) * Math.cos(D(s.elevation)) * distance).add(target);
    this.controls && (this.controls.maxDistance = Math.max(30, fit * 2.5));
  }

  resize() {
    const bounds = this.canvas.parentElement.getBoundingClientRect();
    this.size = { width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) };
    if (this.renderer) {
      const { width, height } = this.size;
      const dpr = renderPixelRatio(width, height, window.devicePixelRatio, this.config.quality);
      const key = `${width}:${height}:${dpr}`;
      if (this.resolutionKey !== key) {
        this.renderer.setPixelRatio(dpr); this.renderer.setSize(width, height, false);
        this.composer.setPixelRatio(dpr); this.composer.setSize(width, height);
        this.resolutionKey = key;
      }
      this.renderer.shadowMap.enabled = this.config.quality !== 'fluid';
    }
    this.frameCamera(this.config.camera); this.transition = true; this.invalidate();
  }

  invalidate() { if (this.renderer && !this.contextUnavailable) this.loop?.invalidate(); }
  setWorkspace(insets) { this.workspaceInsets = insets; this.frameCamera(this.config.camera); this.transition = true; this.invalidate(); }
  setTab(tab) { this.activeTab = tab; this.setSelected(this.config.selectedMaterial, tab === 'product'); }
  setPresentation(value) { this.presentation = value; this.frameCamera(this.config.camera); this.transition = true; this.invalidate(); }
  setFocusMode(value) { this.focusMode = value; this.canvas.style.cursor = value ? 'crosshair' : 'grab'; }

  setSelected(id, visible) {
    const key = `${id}:${visible}`;
    if (key === this.selectedKey) return;
    this.selectedKey = key;
    // An unobtrusive emissive accent marks the material without hiding its finish.
    for (const [key, entry] of this.materials) {
      if (!entry.material.emissive) continue;
      if (!entry.baseEmissive) entry.baseEmissive = entry.material.emissive.clone();
      entry.material.emissive.copy(entry.baseEmissive);
      if (visible && key === id) entry.material.emissive.lerp(this.selectionColor, .025);
    }
    this.invalidate();
  }

  pick(event, action) {
    if (!this.renderer || !this.ready || (action === 'select' && this.activeTab !== 'product')) return;
    const rect = this.canvas.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), this.camera);
    const hit = ray.intersectObjects(this.meshes, false)[0]; if (!hit) return;
    if (action === 'focus') { this.events.onFocus?.(hit.point.toArray()); this.setFocusMode(false); return; }
    const material = Array.isArray(hit.object.material) ? hit.object.material[hit.face.materialIndex] : hit.object.material;
    this.events.onSelect?.(material?.userData.pv?.id);
  }

  tick(time) {
    if (this.disposed || !this.renderer || this.contextUnavailable || document.hidden) return false;
    this.rendering = true;
    const delta = Math.min((time - this.lastFrame) / 1000, .05); this.lastFrame = time;
    if (this.transition) {
      const alpha = 1 - Math.exp(-delta * 9);
      this.camera.position.lerp(this.desiredPosition, alpha); this.controls.target.lerp(this.desiredTarget, alpha);
      if (this.camera.position.distanceTo(this.desiredPosition) < .003) this.transition = false;
    }
    const controlsChanged = this.controls?.update();
    const motion = this.config.motion;
    const moving = this.ready && motion.playing && motion.preset !== 'still' && !this.manual;
    if (moving) {
      this.motionTime += delta * motion.speed;
      const sample = motionSample(motion, this.motionTime);
      if (motion.preset === 'turntable') {
        this.product.rotation[motion.axis] = (this.motionBaseAngle || 0) + sample.angle;
        if (motion.axis !== 'y') {
          this.product.updateMatrixWorld(true); const bounds = new THREE.Box3().setFromObject(this.model); this.product.position.y -= bounds.min.y - .025;
        } else this.product.position.y = 0;
      }
      if (motion.preset === 'orbit') {
        const offset = (this.motionPosition || this.desiredPosition).clone().sub(this.motionTarget || this.desiredTarget);
        offset.applyAxisAngle(V(0, 1, 0), sample.angle);
        this.camera.position.copy(this.motionTarget || this.desiredTarget).add(offset); this.camera.lookAt(this.controls.target);
      }
      if (motion.preset === 'dolly') {
        const target = this.motionTarget || this.desiredTarget;
        const offset = (this.motionPosition || this.desiredPosition).clone().sub(target).multiplyScalar(sample.dolly);
        this.camera.position.copy(target).add(offset); this.camera.lookAt(target);
      }
      if (sample.ended) this.events.onMotionEnd?.();
    }
    const drifting = this.particles?.visible && this.particles.material.opacity > 0;
    if (drifting) this.particles.rotation.y += delta * .007;
    if (this.bokeh?.enabled) {
      const point = this.config.camera.focusPoint ? this.focusPoint.fromArray(this.config.camera.focusPoint) : this.controls.target;
      this.bokeh.uniforms.focus.value = this.config.camera.autoFocus ? this.camera.position.distanceTo(point) : this.config.camera.focus;
    }
    this.composer.render(delta);
    this.rendering = false;
    return !!(this.transition || this.manual || controlsChanged || moving || drifting);
  }

  async capture() {
    if (!this.renderer || !this.ready || this.contextUnavailable) throw new Error('L’esportazione richiede il render 3D attivo.');
    // Render and request the snapshot in the same task; no retained drawing buffer.
    this.composer.render(0);
    return new Promise((resolve, reject) => this.canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Esportazione non riuscita.')), 'image/png'));
  }

  disposeObject(root) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    root.traverse(node => {
      if (node.geometry) geometries.add(node.geometry);
      for (const mat of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) {
        materials.add(mat); for (const value of Object.values(mat)) if (value?.isTexture && value !== this.environment) textures.add(value);
      }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
  }

  dispose() {
    this.disposed = true; this.loadToken++; this.loadAbort?.abort(); this.loop?.dispose();
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.resizeObserver.disconnect(); this.controls?.dispose(); this.draco?.dispose();
    this.canvas.removeEventListener('pointerdown', this.pointerDown); this.canvas.removeEventListener('pointerup', this.pointerUp); this.canvas.removeEventListener('dblclick', this.doubleClick); this.canvas.removeEventListener('webglcontextlost', this.contextLost);
    this.disposeObject(this.scene); this.reflector?.dispose(); this.composer?.dispose(); this.bokeh?.dispose(); this.bloom?.dispose(); this.outputPass?.dispose(); this.environmentTarget?.dispose(); this.key.shadow.dispose(); this.renderer?.dispose();
  }
}
