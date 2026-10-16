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
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GradeShader } from './GradeShader.js';
import { effectiveSamples, postPolicy, bloomStrength } from './lookdev.js';
import { ContactShadow, supportHeight } from './contactShadow.js';
import { DEFAULT_TRANSFORM } from './modelTransform.js';
import { applyModelTransform, worldBounds, placementAction, keepModelHeight } from './modelPlacement.js';
import { sectionPlanes, visibleIntersection, topologyOverlay } from './inspection.js';
import { PerformanceMonitor } from './performanceMonitor.js';
import { visibleSurfaceHit } from './surfacePicking.js';
import { normalizeDemoSurface, applySurfacePolicy, geometryUvChannels, sharedUvChannels } from './materialSurface.js';
import { DEFAULT_STATE, clone, clamp, friendlyMaterialName } from './state.js';
import { motionSample } from './motion.js';
import { createRenderLoop } from './renderLoop.js';
import { renderPixelRatio } from './renderBudget.js';
import { perspectiveFit } from './cameraFraming.js';
import { CUSTOM_SCENES, createEnvironmentStage } from './environmentStage.js';
import { canRecordVideo, recordCanvas, videoSettings } from './playblast.js';
import { ModelAnimation } from './modelAnimation.js';
import { ObjectEffects } from './objectEffects.js';

const D = THREE.MathUtils.degToRad;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const seeded = seed => { let a = seed | 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

export class StudioEngine {
  constructor(canvas, events) {
    this.canvas = canvas; this.events = events; this.config = clone(DEFAULT_STATE);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#11151b');
    this.scene.fog = new THREE.FogExp2('#141820', .026);
    this.backgroundColor = this.scene.background; this.sceneFog = this.scene.fog;
    this.monitor = new PerformanceMonitor(); this.coarse = window.matchMedia('(pointer: coarse)').matches;
    this.localPlanes = []; this.worldPlanes = []; this.hoverTime = 0;
    this.sectionHelpers = new THREE.Group(); this.scene.add(this.sectionHelpers);
    this.camera = new THREE.PerspectiveCamera(35, 1, .05, 200);
    this.camera.position.set(6, 2.5, 7);
    this.target = V(0, .65, 0); this.desiredPosition = this.camera.position.clone(); this.desiredTarget = this.target.clone();
    this.placement = new THREE.Group(); this.scene.add(this.placement);
    this.product = new THREE.Group(); this.placement.add(this.product);
    this.stage = new THREE.Group(); this.scene.add(this.stage);
    this.lights = new THREE.Group(); this.scene.add(this.lights);
    this.model = null; this.materials = new Map(); this.meshes = []; this.modelSize = V(2, 1.3, 4.7);
    this.ready = false; this.disposed = false; this.loadToken = 0;
    this.motionTime = 0; this.transition = true; this.manual = false; this.focusMode = false; this.size = { width: 1200, height: 850 };
    this.selectionColor = new THREE.Color('#603000');
    this.focusPoint = new THREE.Vector3();
    this.lastFrame = performance.now();
    this.pointerDown = e => { this.pointerStart = [e.clientX, e.clientY]; this.hoverTimer && clearTimeout(this.hoverTimer); this.events.onHover?.(null); };
    this.pointerUp = e => {
      if (!this.renderer || !this.pointerStart || Math.hypot(e.clientX - this.pointerStart[0], e.clientY - this.pointerStart[1]) > 7) return;
      if (!this.presentation && !this.recording) this.pick(e, this.focusMode ? 'focus' : 'select'); this.pointerStart = null;
    };
    this.doubleClick = e => { if (!this.presentation && !this.recording) this.pick(e, 'focus'); };
    this.canvas.addEventListener('pointerdown', this.pointerDown);
    this.canvas.addEventListener('pointerup', this.pointerUp);
    this.canvas.addEventListener('dblclick', this.doubleClick);
    this.pointerMove = e => {
      if (e.pointerType !== 'mouse' || e.buttons || this.manual || this.presentation || this.focusMode) return;
      this.events.onPointerPosition?.(e.clientX, e.clientY);
      if (performance.now() - this.hoverTime < 100) return;
      this.hoverTime = performance.now(); this.pick(e, 'hover');
    };
    this.pointerLeave = () => { clearTimeout(this.hoverTimer); this.events.onHover?.(null); };
    this.canvas.addEventListener('pointermove', this.pointerMove); this.canvas.addEventListener('pointerleave', this.pointerLeave);
    this.contextLost = e => { e.preventDefault(); this.contextUnavailable = true; this.loop?.setPaused(true); this.events.onStatus?.('fallback'); this.events.onError?.('Il contesto 3D è stato interrotto. Ricarica l’anteprima per riprovare.'); };
    this.canvas.addEventListener('webglcontextlost', this.contextLost);
    this.setupRenderer(); this.setupLights(); this.setupFloor();
    if (this.renderer) this.contactShadow = new ContactShadow(this.scene,this.coarse);
    this.loader = new GLTFLoader();
    this.loop = createRenderLoop({ render: time => this.tick(time) });
    this.visibilityChanged = () => { this.lastFrame = performance.now(); this.monitor.reset(); this.loop.setPaused(document.hidden || !!this.contextUnavailable || !!this.recording); };
    document.addEventListener('visibilitychange', this.visibilityChanged);
    this.visibilityChanged();
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas.parentElement);
    this.resize();
    this.invalidate();
  }

  setupRenderer() {
    const context = this.canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!context) { this.events.onStatus?.('fallback'); return; }
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, context, antialias: false, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: false });
    this.renderer.localClippingEnabled = true;
    this.renderer.info.autoReset = false;
    // MSAA must be applied to the HDR composer targets, not the default canvas.
    const counts = context.getInternalformatParameter(context.RENDERBUFFER, context.RGBA16F, context.SAMPLES);
    this.supportedSamples = Array.from(counts || []).filter(n => [2,4,8].includes(n));
    this.events.onCapabilities?.({ samples: this.supportedSamples, coarse: this.coarse,recording:canRecordVideo() });
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
    this.controls.addEventListener('start', () => {
      this.interruptedTransition=this.transition;this.transition=false;this.manual=true;this.manualChanged=false;this.settling=false;
      this.clearOrbitInertia();this.invalidate();
    });
    this.controls.addEventListener('change', () => {
      if(this.manual&&!this.clearingInertia&&!this.manualChanged){this.manualChanged=true;this.events.onManualMove?.();}
      if(!this.rendering)this.invalidate();
    });
    this.controls.addEventListener('end', () => {
      this.manual=false;
      if(this.manualChanged){this.settling=true;this.settleStart=performance.now();}
      else if(this.interruptedTransition)this.transition=true;
      this.invalidate();
    });
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bokeh = new BokehPass(this.scene, this.camera, { focus: 8, aperture: .00007, maxblur: .005 });
    this.bloom = new UnrealBloomPass(new THREE.Vector2(800, 600), .06, .3, 1.6);
    this.grade = new ShaderPass(GradeShader);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass); this.composer.addPass(this.bokeh); this.composer.addPass(this.bloom); this.composer.addPass(this.grade); this.composer.addPass(this.outputPass);
    this.events.onStatus?.('loading');
  }

  setupLights() {
    this.hemi = new THREE.HemisphereLight('#dfe8ff', '#1b1510', .85); this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight('#fff4e7', 3.3); this.key.position.set(-4, 7, 5);
    this.key.castShadow = true; this.key.shadow.mapSize.set(1024, 1024);
    Object.assign(this.key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: .1, far: 35 });
    this.key.shadow.bias = -.00015; this.key.shadow.normalBias = .012; this.key.shadow.radius = 4;
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
    // Normalize outside animated glTF nodes; root tracks retain authored transforms.
    wrapper.scale.setScalar(4.7 / largest); wrapper.updateMatrixWorld(true);
    bounds = new THREE.Box3().setFromObject(object); size = bounds.getSize(new THREE.Vector3());
    if (isDemo && size.x > size.z) { wrapper.rotation.y = Math.PI / 2; wrapper.updateMatrixWorld(true); }
    bounds = new THREE.Box3().setFromObject(wrapper); const center = bounds.getCenter(new THREE.Vector3());
    wrapper.position.set(-center.x, -bounds.min.y + .025, -center.z); wrapper.updateMatrixWorld(true);
    this.animations?.dispose();
    if (this.model) { this.effects?.dispose(); this.releaseInspection(); this.product.remove(this.model); this.disposeObject(this.model); }
    this.animations = new ModelAnimation(object,gltf.animations);
    this.materials.clear(); this.meshes = []; this.sectionKey = null; let fallbackIndex = manifest.materials?.length || 0;
    const clones = new Map(); this.selectedKey = null;
    wrapper.traverse(mesh => {
      if (!mesh.isMesh) return;
      this.meshes.push(mesh); mesh.castShadow = true; mesh.receiveShadow = true;
      const process = imported => {
        if (clones.has(imported.uuid)) {
          const shared = clones.get(imported.uuid), entry = this.materials.get(shared.userData.pv.id);
          entry.uvChannels = sharedUvChannels(entry.uvChannels, mesh.geometry);
          return shared;
        }
        const index = gltf.parser.associations.get(imported)?.materials ?? fallbackIndex++;
        const id = `mat-${index}`;
        const material = imported.isMeshStandardMaterial && !imported.isMeshPhysicalMaterial
          ? THREE.MeshStandardMaterial.prototype.copy.call(new THREE.MeshPhysicalMaterial(), imported)
          : imported.clone();
        normalizeDemoSurface(material, index, isDemo);
        const original = {
          color: '#' + material.color.getHexString(), overlay: 0, roughness: material.roughness ?? .5,
          metalness: material.metalness ?? 0, clearcoat: material.clearcoat ?? 0,
          ior: material.ior ?? 1.5, transmission: material.transmission ?? 0, thickness: material.thickness ?? 0,
          emissive: '#' + (material.emissive?.getHexString() || '000000'), emissiveIntensity: material.emissiveIntensity ?? 1,
          alphaMode: material.alphaTest > 0 ? 'mask' : material.transparent ? 'blend' : 'opaque', alphaCutoff: material.alphaTest || .5, doubleSide: material.side === THREE.DoubleSide,
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
        const uvChannels = geometryUvChannels(mesh.geometry);
        const label = isDemo ? friendlyMaterialName(imported.name, index) : (imported.name || `Superficie ${index + 1}`);
        this.materials.set(id, { id, label, rawName: imported.name, material, original, baseColor: material.color.clone(), uvChannels, physical: !!material.isMeshPhysicalMaterial, lit: !!material.isMeshStandardMaterial, hasTexture: !!material.map, hasNormalMap: !!material.normalMap });
        clones.set(imported.uuid, material); imported.dispose(); return material;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(process) : process(mesh.material);
      mesh.userData.pvBaseMaterials = mesh.material;
    });
    applyModelTransform(this.placement, DEFAULT_TRANSFORM);
    this.model = wrapper; this.product.rotation.set(0, 0, 0); this.product.position.set(0, 0, 0); this.product.add(wrapper); this.product.updateMatrixWorld(true);
    this.contactShadow?.setModel(wrapper,this.meshes);
    bounds = new THREE.Box3().setFromObject(wrapper); this.modelSize.copy(bounds.getSize(new THREE.Vector3()));
    this.modelBounds = bounds.clone();
    this.effects = new ObjectEffects(this.scene,this.product,this.meshes,this.modelBounds,{coarse:this.coarse});
    this.triangles = this.meshes.reduce((n,m) => n + (m.geometry.index?.count || m.geometry.attributes.position.count)/3, 0);
    this.target.set(0, this.modelSize.y * .5 + .02, 0); this.desiredTarget.copy(this.target);
    this.ready = true;
    const materials = [...this.materials.values()].map(({ material, baseColor, ...data }) => data);
    const selected = isDemo ? materials.find(m => /PaintTNR/i.test(m.rawName))?.id : materials[0]?.id;
    const initial = Object.fromEntries(materials.map(m => [m.id, { ...m.original }]));
    if (isDemo && selected) initial[selected] = { ...initial[selected], color: '#4c515b', overlay: 1, roughness: .24, metalness: .75, clearcoat: .8, finish: 'satin' };
    this.events.onLoading?.(100);
    this.events.onStatus?.(this.renderer ? 'ready' : 'fallback');
    return { materials, selected, initial, buffer, animations:this.animations.metadata, triangles: this.meshes.reduce((sum, m) => sum + (m.geometry.index?.count || m.geometry.attributes.position.count) / 3, 0), title: manifest.asset?.extras?.title || '' };
  }

  setState(config, { immediate = false } = {}) {
    const previous = this.config; this.config = config;
    const force = immediate || !this.sceneKey;
    // UI-only changes (name, deltas, locks) must not wake a sleeping scene.
    if (!force && ['scene', 'lighting', 'materials', 'camera', 'motion', 'animation', 'effects', 'quality', 'selectedMaterial', 'post', 'render', 'inspection', 'section', 'transform'].every(key => previous[key] === config[key])) return;
    if(force || previous.animation!==config.animation){
      if(this.animations?.setState(config.animation))this.contactShadow?.invalidate();
      if(this.effects)this.effects.forcePose=true;
      this.events?.onAnimationTime?.(this.animations?.cursor||0);
    }
    const placementChanged = force || previous.transform !== config.transform;
    if (placementChanged && this.placement) {
      applyModelTransform(this.placement, config.transform);
      this.contactShadow?.invalidate();
    }
    const sceneKey = JSON.stringify([config.scene.preset, config.scene.composition, config.scene.scale, config.scene.seed,config.scene.density,config.scene.height,config.scene.spread]);
    if (sceneKey !== this.sceneKey) { this.buildStage(config.scene); this.sceneKey = sceneKey; }
    if (force || previous.lighting !== config.lighting) this.applyLights(config.lighting);
    const bg = config.scene.preset === 'cubes' ? '#101722' : config.scene.preset === 'void' ? '#07090c' : config.scene.preset === 'studio' ? '#303741' : '#131820';
    this.backgroundColor.set(config.scene.background||bg); this.sceneFog.color.copy(this.backgroundColor);
    this.scene.background = config.render.alpha ? null : this.backgroundColor;
    this.scene.fog = config.render.alpha ? null : this.sceneFog;
    this.renderer?.setClearColor(0x000000, config.render.alpha ? 0 : 1);
    this.stage.visible = !config.render.alpha;
    this.sceneFog.density = config.scene.preset === 'void' ? .002 + config.scene.fog * .04 : .012 + config.scene.fog * .075;
    this.floorMaterial.roughness = config.scene.floorRoughness;
    this.floorMaterial.color.set(config.scene.groundColor||'#1b1f25');
    this.floor.visible = !config.render.alpha && this.customStage?.floorVisible!==false && !['void', 'cubes','road'].includes(config.scene.preset);
    if (this.cubeBaseMaterial) {this.cubeBaseMaterial.roughness = config.scene.floorRoughness;this.cubeBaseMaterial.color.set(config.scene.groundColor);}
    this.customStage?.update(config.scene,this.environmentTime||0);
    if (this.reflector) {
      this.reflector.visible = !config.render.alpha && config.inspection.view === 'pbr' && !['void','road'].includes(config.scene.preset) && config.scene.reflection > .015 && config.quality !== 'fluid';
      const surfaceScale = config.scene.preset === 'cubes' ? (PLINTH_SIZE - .14) / 90 : (this.customStage?.reflectionSpan||90)/90;
      this.reflector.scale.set(surfaceScale, surfaceScale, 1);
      this.reflector.position.y = config.scene.preset === 'cubes' ? .007 : -.008;
      this.reflector.material.uniforms.pvReflection.value = config.scene.reflection;
    }
    if (this.particles) { this.particles.visible = ['cinema', 'particles', 'cubes'].includes(config.scene.preset) && config.scene.particles > 0; this.particles.material.opacity = config.scene.particles * (config.scene.preset === 'particles' ? .8 : .18); }
    if (this.ring) this.ring.material.color.set(config.scene.ringColor);
    if (this.outerRing) this.outerRing.material.color.set(config.scene.ringColor);
    this.ringLamp.visible = false; this.ringLamp.color.set(config.scene.ringColor);
    for (const [id, entry] of this.materials) {
      if (!force && previous.materials[id] === config.materials[id]) continue;
      const values = config.materials[id] || entry.original, mat = entry.material;
      mat.userData.pv.params.color.set(values.color || entry.original.color);
      mat.userData.pv.params.overlay = values.overlay ?? 0;
      mat.roughness = values.roughness ?? entry.original.roughness;
      mat.metalness = values.metalness ?? entry.original.metalness;
      if ('clearcoat' in mat) mat.clearcoat = values.clearcoat ?? entry.original.clearcoat;
      if (mat.normalScale) mat.normalScale.setScalar(values.normalScale ?? entry.original.normalScale);
      applySurfacePolicy(mat, values, entry.original, this.samples || 0);
      if ('ior' in mat) mat.ior = values.ior ?? entry.original.ior;
      if ('transmission' in mat) {
        const transmission = values.transmission ?? entry.original.transmission;
        if (!!mat.transmission !== !!transmission) mat.needsUpdate = true;
        mat.transmission = transmission; mat.thickness = values.thickness ?? entry.original.thickness;
      }
      if (mat.emissive) {
        mat.emissive.set(values.emissive || entry.original.emissive);
        mat.emissiveIntensity = values.emissiveIntensity ?? entry.original.emissiveIntensity;
        entry.baseEmissive = mat.emissive.clone(); this.selectedKey = null;
      }
      if (mat.map && values.uvChannel != null && entry.uvChannels.includes(values.uvChannel) && mat.map.channel !== values.uvChannel) {
        const oldMap = mat.map; mat.map = mat.map.clone(); mat.map.channel = values.uvChannel; mat.map.needsUpdate = true; mat.needsUpdate = true;
        if (oldMap.userData.pvCloned) oldMap.dispose(); mat.map.userData.pvCloned = true;
      }
    }
    if (this.renderer) this.renderer.toneMappingExposure = Math.pow(2, config.camera.exposure) * 1.05;
    if (this.bokeh) {
      const blur = clamp((16 - config.camera.aperture) / 14.6, 0, 1);
      this.bokeh.uniforms.aperture.value = blur * .00018 * (config.camera.bokeh??.5);
      this.bokeh.uniforms.maxblur.value = blur * .014 * (config.camera.bokeh??.5);
      this.bokeh.enabled = postPolicy(config).dof;
    }
    this.applyPost();
    if (force || previous.inspection !== config.inspection || previous.section !== config.section || previous.render.alpha !== config.render.alpha) this.applyInspection();
    const shadowMaterialsChanged = previous.materials !== config.materials && Object.entries(config.materials).some(([id,values])=>['opacity','alphaMode','alphaCutoff','transmission','uvChannel'].some(key=>values[key]!==previous.materials[id]?.[key]));
    if (force || previous.effects !== config.effects || previous.scene.preset !== config.scene.preset || shadowMaterialsChanged || previous.inspection !== config.inspection || previous.section !== config.section || previous.render.alpha !== config.render.alpha || previous.motion !== config.motion) this.contactShadow?.invalidate();
    if (force || config.render !== previous.render || config.quality !== previous.quality) {
      this.monitor.reset(); this.monitor.scale = 1; this.resize();
    }
    const cameraKey = this.cameraSignature(config.camera);
    const cameraChanged = this.cameraKey !== cameraKey || immediate;
    const resetMotion = force || config.motion.preset !== previous.motion.preset || config.motion.axis !== previous.motion.axis || (cameraChanged && config.motion.playing);
    if (resetMotion || config.motion.preset === 'still') { this.product.rotation.set(0, 0, 0); this.product.position.set(0, 0, 0); }
    if (this.model && (placementChanged || resetMotion)) this.motionGroundY = worldBounds(this.model).min.y;
    if (cameraChanged) { this.frameCamera(config.camera); this.clearOrbitInertia(); this.settling=false; this.transition = true; this.cameraKey = cameraKey; }
    if (immediate) { this.camera.position.copy(this.desiredPosition); this.target.copy(this.desiredTarget); this.controls?.target.copy(this.target); this.camera.lookAt(this.target); this.transition = false; }
    if (resetMotion) {
      this.motionTime = (config.motion.cursor||0)*(config.motion.duration||12); this.motionBaseAngle = 0;
      this.motionPosition = (cameraChanged?this.desiredPosition:this.camera.position).clone(); this.motionTarget = (cameraChanged?this.desiredTarget:this.controls?.target || this.target).clone();
      this.contactShadow?.invalidate();
    } else if (config.motion.direction !== previous.motion.direction || config.motion.amplitude !== previous.motion.amplitude || config.motion.travel !== previous.motion.travel || config.motion.loop !== previous.motion.loop || config.motion.easing !== previous.motion.easing || config.motion.duration !== previous.motion.duration || (config.motion.playing && !previous.motion.playing)) {
      if(config.motion.duration!==previous.motion.duration)this.motionTime=this.motionTime/(previous.motion.duration||12)*(config.motion.duration||12);
      if (config.motion.playing && motionSample(config.motion, this.motionTime).ended) this.motionTime = 0;
      const sample = motionSample(config.motion, this.motionTime);
      this.motionBaseAngle = this.product.rotation[config.motion.axis] - sample.angle;
      this.motionTarget = (this.controls?.target || this.target).clone();
      const offset = this.camera.position.clone().sub(this.motionTarget);
      if (['orbit','idle'].includes(config.motion.preset)) offset.applyAxisAngle(V(0, 1, 0), -sample.angle);
      if (['dolly','idle'].includes(config.motion.preset)) offset.divideScalar(sample.dolly);
      this.motionPosition = this.motionTarget.clone().add(offset);
    }
    if(config.motion.cursor!==previous.motion.cursor){this.motionTime=config.motion.cursor*(config.motion.duration||12);this.scrubPending=true;}
    this.effects?.setState(config,this.worldPlanes);
    if(force||shadowMaterialsChanged)this.effects?.updateCoverage();
    this.events?.onEffectsTime?.(this.effects?.cursor||0);
    if(resetMotion||placementChanged)this.effects?.trails?.clear();
    this.setSelected(config.selectedMaterial, this.activeTab === 'product' && !this.presentation);
    this.invalidate();
  }

  updateSamples() {
    if (!this.composer) return;
    const samples = effectiveSamples(this.config.render.msaa, this.supportedSamples || [], { coarse: this.coarse, quality: this.config.quality });
    if (samples === this.samples) return;
    this.samples = samples;
    for (const target of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      target.samples = samples; target.dispose();
    }
    for (const [id,entry] of this.materials) applySurfacePolicy(entry.material, this.config.materials[id] || entry.original, entry.original, samples);
  }

  applyPost() {
    if (!this.renderer) return;
    const post = this.config.post, policy = postPolicy(this.config);
    this.bloom.enabled = policy.bloom; this.bloom.strength = bloomStrength(post); this.bloom.radius = post.radius; this.bloom.threshold = post.threshold;
    this.bokeh.enabled = policy.dof;
    this.grade.enabled = policy.grade && (post.contrast !== 1 || post.saturation !== 1 || post.vignette !== 0);
    for (const key of ['contrast','saturation','vignette']) this.grade.uniforms[key].value = post[key];
    this.renderer.toneMapping = this.config.inspection.view === 'normals' ? THREE.NoToneMapping : ({ aces: THREE.ACESFilmicToneMapping, neutral: THREE.NeutralToneMapping, agx: THREE.AgXToneMapping }[post.tone]);
  }

  applyInspection() {
    const { inspection, section, render } = this.config;
    const key = JSON.stringify(section);
    if (this.modelBounds && key !== this.sectionKey) {
      this.localPlanes = sectionPlanes(section, this.modelBounds);
      this.worldPlanes = this.localPlanes.map(p => p.clone()); this.sectionKey = key;
      this.disposeObject(this.sectionHelpers); this.sectionHelpers.clear();
      if (section.helpers) for (const plane of this.worldPlanes) {
        const helper = new THREE.PlaneHelper(plane, Math.max(...this.modelSize.toArray())*1.15, 0xffbb4b);
        helper.traverse(node => { if (node.material) { node.material.depthWrite = false; node.material.transparent = true; node.material.opacity = node.isMesh ? .045 : .5; } });
        this.sectionHelpers.add(helper);
      }
    }
    this.sectionHelpers.visible = section.enabled && section.helpers && !render.alpha;
    this.updateSectionTransform();
    for (const mesh of this.meshes) {
      const originals = mesh.userData.pvBaseMaterials;
      const list = Array.isArray(originals) ? originals : [originals];
      for (const mat of list) {
        mat.wireframe = inspection.view === 'wire'; mat.clipShadows = true;
        mat.clippingPlanes = this.worldPlanes;
      }
      if (inspection.view === 'normals' && !mesh.userData.pvNormals) {
        mesh.userData.pvNormals = list.map(() => new THREE.MeshNormalMaterial({ side: THREE.DoubleSide }));
      }
      if (mesh.userData.pvNormals) for (const mat of mesh.userData.pvNormals) mat.clippingPlanes = this.worldPlanes;
      mesh.material = inspection.view === 'normals' ? (Array.isArray(originals) ? mesh.userData.pvNormals : mesh.userData.pvNormals[0]) : originals;
      if (inspection.view === 'overlay' && !mesh.userData.pvWire) {
        const material = new THREE.MeshBasicMaterial({ color: 0xffbb4b, wireframe: true, transparent: true, opacity: inspection.wireOpacity, depthWrite: false, toneMapped: false });
        const wire = topologyOverlay(mesh, material);
        mesh.add(wire); mesh.userData.pvWire = wire;
      }
      if (mesh.userData.pvWire) {
        const wire = mesh.userData.pvWire; wire.visible = inspection.view === 'overlay';
        wire.material.opacity = inspection.wireOpacity; wire.material.clippingPlanes = this.worldPlanes;
      }
    }
  }

  updateSectionTransform() {
    this.product.updateMatrixWorld(true);
    this.localPlanes.forEach((plane,i) => this.worldPlanes[i].copy(plane).applyMatrix4(this.product.matrixWorld));
  }

  releaseInspection() {
    for (const mesh of this.meshes) {
      if (mesh.userData.pvBaseMaterials) mesh.material = mesh.userData.pvBaseMaterials;
      mesh.userData.pvNormals?.forEach(mat => mat.dispose());
      const wire = mesh.userData.pvWire;
      if (wire) { mesh.remove(wire); wire.material.dispose(); }
      delete mesh.userData.pvWire; delete mesh.userData.pvNormals;
    }
  }

  reportStats(report = {}) {
    if (!this.renderer) return;
    this.events.onStats?.({ ...report, samples: this.samples || 0, width: Math.round(this.size.width*(this.effectiveDpr || 1)), height: Math.round(this.size.height*(this.effectiveDpr || 1)), triangles: this.triangles || 0, calls: this.renderer.info.render.calls, scale: this.config.render.resolution*(this.config.render.adaptive ? this.monitor.scale : 1) });
  }

  applyLights(s) {
    const t = clamp((s.temperature - 2000) / 7000, 0, 1);
    const keyColor = new THREE.Color('#ffbe7a').lerp(new THREE.Color('#c3dcff'), t);
    const tint = { warm: '#ffb84f', neutral: '#f2f0e7', cool: '#77aaff' }[s.tint];
    this.key.color.copy(keyColor);if(s.keyColor)this.key.color.set(s.keyColor);this.key.intensity=s.key*s.intensity;
    this.fill.color.set(s.fillColor||(s.preset==='bicolor'?'#65aaff':'#c9d7ef'));this.fill.intensity=s.fill*s.intensity;
    this.rim.color.set(s.rimColor||tint);this.rim.intensity=s.rim*s.intensity;
    const elevation=D(s.elevation??52),radius=9;
    this.key.position.set((s.preset==='split'?-1:-.65)*radius*Math.cos(elevation),radius*Math.sin(elevation),radius*.75*Math.cos(elevation));
    this.lights.rotation.y=D(s.rotation);this.key.shadow.radius=1+s.softness*.085;
    this.hemi.intensity=(s.ambient??.4)*s.intensity;this.scene.environmentIntensity=(s.environment??.65)*s.intensity;
  }

  buildStage(s) {
    while (this.stage.children.length) { const item = this.stage.children[0]; this.stage.remove(item); this.disposeObject(item); }
    this.ring = null; this.outerRing = null; this.particles = null; this.cubeBaseMaterial = null; this.customStage=null;this.environmentTime=0;
    if(CUSTOM_SCENES.includes(s.preset)){this.customStage=createEnvironmentStage(s,this.coarse);this.stage.add(this.customStage.group);}
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
    this.motionFramePending = true;
    const w = this.size.width, h = this.size.height;
    this.camera.aspect = w / h; this.camera.setFocalLength(s.focal);
    const right = this.presentation ? 0 : Math.min(w * .6, this.workspaceInsets?.right || 0);
    const bottom = this.presentation ? 0 : Math.min(h * .65, this.workspaceInsets?.bottom || 0);
    this.camera.setViewOffset(w, h, right / 2, bottom / 2, w, h);
    this.camera.updateProjectionMatrix();
    const bounds = this.model ? worldBounds(this.model) : null;
    const size = bounds ? bounds.getSize(V()) : this.modelSize;
    const center = bounds ? bounds.getCenter(V()) : V(0, size.y*.5+.025, 0);
    const fov = D(this.camera.fov);
    // Framing belongs to CAM. ENV must not change it, including on reload,
    // resize or capture; the same product bounds define every stage's frame.
    const target = center.clone(); target.y += .015;
    if (['macro','detail'].includes(s.preset)) target.copy(center).add(V(size.x * .22, -size.y * .08, size.z * .36));
    if(s.targetPoint)target.fromArray(s.targetPoint);
    const direction = V(Math.sin(D(s.azimuth))*Math.cos(D(s.elevation)),Math.sin(D(s.elevation)),Math.cos(D(s.azimuth))*Math.cos(D(s.elevation)));
    const framingBounds = bounds?.clone() || new THREE.Box3().setFromCenterAndSize(center,size);
    let fit = perspectiveFit(framingBounds,target,direction,fov,this.camera.aspect,(w-right)/w,(h-bottom)/h);
    if (this.config.motion.playing && ['turntable','orbit'].includes(this.config.motion.preset)) {
      // Preserve room for the length revealed by rotation after the initial shot.
      fit = Math.max(fit,Math.max(size.x,size.z)/(2*Math.tan(fov/2)*this.camera.aspect*.8*(w-right)/w));
    }
    const distance = s.orbitRadius || fit * s.distance;
    this.desiredTarget.copy(target);
    this.desiredPosition.copy(direction).multiplyScalar(distance).add(target);
    this.controls && (this.controls.maxDistance = Math.max(30, fit * 2.5));
  }

  cameraSignature(camera) {
    return JSON.stringify([camera.preset,camera.azimuth,camera.elevation,camera.distance,camera.focal,camera.targetPoint,camera.orbitRadius]);
  }

  clearOrbitInertia() {
    if(!this.controls?.update)return;
    const position=this.camera.position.clone(),target=this.controls.target.clone(),damping=this.controls.enableDamping;
    this.clearingInertia=true;this.controls.enableDamping=false;this.controls.update();
    this.camera.position.copy(position);this.controls.target.copy(target);this.controls.update();
    this.controls.enableDamping=damping;this.clearingInertia=false;
  }

  syncManualCamera() {
    this.settling=false;this.clearOrbitInertia();
    const offset=this.camera.position.clone().sub(this.controls.target),length=offset.length();
    if(!length)return;
    const camera={...this.config.camera,azimuth:THREE.MathUtils.radToDeg(Math.atan2(offset.x,offset.z)),
      elevation:THREE.MathUtils.radToDeg(Math.asin(clamp(offset.y/length,-1,1))),orbitRadius:length};
    this.desiredPosition.copy(this.camera.position);this.desiredTarget.copy(this.controls.target);
    this.cameraKey=this.cameraSignature(camera);
    this.events.onCameraChange?.(camera);
  }

  modelPlacementAction(action) {
    if (!this.model) return null;
    return placementAction(this.config.transform, worldBounds(this.model), action, supportHeight(this.config.scene.preset) ?? 0);
  }

  resize() {
    if(this.recording)return;
    const bounds = this.canvas.parentElement.getBoundingClientRect();
    const width = Math.max(1, bounds.width), height = Math.max(1, bounds.height);
    const viewportChanged = !this.resolutionKey || width !== this.size.width || height !== this.size.height;
    this.size = { width, height };
    if (this.renderer) {
      const { width, height } = this.size;
      const dpr = renderPixelRatio(width, height, window.devicePixelRatio, this.config.quality) * this.config.render.resolution * (this.config.render.adaptive ? this.monitor.scale : 1);
      const key = `${width}:${height}:${dpr}`;
      if (this.resolutionKey !== key) {
        this.renderer.setPixelRatio(dpr); this.renderer.setSize(width, height, false);
        this.composer.setPixelRatio(dpr); this.composer.setSize(width, height);
        this.resolutionKey = key;
      }
      this.renderer.shadowMap.enabled = this.config.quality !== 'fluid';
      this.effectiveDpr = dpr;
      this.updateSamples();
    }
    if (viewportChanged) { this.frameCamera(this.config.camera); this.transition = true; }
    this.invalidate();
    this.reportStats();
  }

  invalidate() { this.dirty = true; if (this.renderer && !this.contextUnavailable) this.loop?.invalidate(); }
  setWorkspace(insets) {
    if(this.workspaceInsets&&Math.abs(this.workspaceInsets.right-insets.right)<1&&Math.abs(this.workspaceInsets.bottom-insets.bottom)<1)return;
    this.workspaceInsets = insets;if(this.recording)return;
    if(!this.manual&&!this.settling){this.frameCamera(this.config.camera);this.clearOrbitInertia();this.transition=true;}this.invalidate();
  }
  setTab(tab) { this.activeTab = tab; this.setSelected(this.config.selectedMaterial, tab === 'product'); }
  setPresentation(value) { if(this.presentation===value)return;this.presentation = value; this.events.onHover?.(null); if(this.recording)return;this.frameCamera(this.config.camera);this.clearOrbitInertia();this.transition = true; this.invalidate(); }
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
    if (!this.renderer || !this.ready || this.contextUnavailable) return;
    const rect = this.canvas.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), this.camera);
    const hit = visibleIntersection(ray.intersectObjects(this.meshes, false), this.worldPlanes, this.config.inspection.view === 'normals' ? undefined : visibleSurfaceHit);
    if (!hit) { if (action === 'hover' || action === 'select') this.events.onHover?.(null); if(action==='select')this.events.onEmpty?.(); return; }
    if (action === 'focus') { const offset=this.camera.position.clone().sub(this.controls.target),length=offset.length();this.events.onFocus?.(hit.point.toArray(),length*.85,{azimuth:THREE.MathUtils.radToDeg(Math.atan2(offset.x,offset.z)),elevation:THREE.MathUtils.radToDeg(Math.asin(clamp(offset.y/length,-1,1)))}); this.setFocusMode(false); return; }
    const originals = hit.object.userData.pvBaseMaterials;
    const material = Array.isArray(originals) ? originals[hit.face.materialIndex] : originals;
    const id = material?.userData.pv?.id;
    const localPoint = this.product.worldToLocal(hit.point.clone()).toArray();
    const target = { id, mesh: hit.object.uuid, uvChannel: material?.map?.channel ?? 0, uvChannels: geometryUvChannels(hit.object.geometry), x: event.clientX-rect.left, y: event.clientY-rect.top, point: localPoint };
    if (action === 'hover') this.events.onHover?.(target);
    else this.events.onSelect?.(id, target);
  }

  tick(time) {
    if (this.disposed || !this.renderer || this.contextUnavailable || document.hidden) return false;
    const targetFps = this.config.render.fps === 'auto' ? this.coarse ? 30 : 60 : this.config.render.fps;
    if (!this.dirty && time-this.lastFrame < 1000/targetFps-1) return true;
    this.dirty = false; this.rendering = true;
    const delta = Math.min((time - this.lastFrame) / 1000, .05); this.lastFrame = time;
    if (this.transition) {
      const alpha = 1 - Math.exp(-delta * 9);
      this.camera.position.lerp(this.desiredPosition, alpha); this.controls.target.lerp(this.desiredTarget, alpha);this.camera.lookAt(this.controls.target);
      if (this.camera.position.distanceTo(this.desiredPosition) < .003 && this.controls.target.distanceTo(this.desiredTarget) < .003) {
        this.transition = false;
        if (this.motionFramePending && ['orbit','dolly','idle'].includes(this.config.motion.preset)) {
          this.motionTime = (this.config.motion.cursor||0)*(this.config.motion.duration||12); this.motionPosition = this.camera.position.clone(); this.motionTarget = this.controls.target.clone();
        }
        this.motionFramePending = false;
      }
    }
    const controlsChanged = (this.manual||this.settling) ? this.controls?.update() : false;
    if(this.settling && (!controlsChanged || time-this.settleStart>1800))this.syncManualCamera();
    const motion = this.config.motion;
    const moving = this.ready && motion.playing && motion.preset !== 'still' && !this.manual && !this.settling && !this.transition;
    if (moving || this.scrubPending) {
      if(moving)this.motionTime += delta * motion.speed;
      this.scrubPending=false;
      const sample = motionSample(motion, this.motionTime);
      if (motion.preset === 'turntable') {
        this.product.rotation[motion.axis] = (this.motionBaseAngle || 0) + sample.angle;
        if (this.model && (motion.axis !== 'y' || this.placement?.rotation.x || this.placement?.rotation.z)) {
          keepModelHeight(this.product, this.model, this.motionGroundY ?? .025);
        }
      }
      if (['orbit','idle'].includes(motion.preset)) {
        const offset = (this.motionPosition || this.desiredPosition).clone().sub(this.motionTarget || this.desiredTarget);
        offset.applyAxisAngle(V(0, 1, 0), sample.angle);
        if (motion.preset === 'idle') offset.multiplyScalar(sample.dolly);
        this.camera.position.copy(this.motionTarget || this.desiredTarget).add(offset); this.camera.lookAt(this.controls.target);
      }
      if (motion.preset === 'dolly') {
        const target = this.motionTarget || this.desiredTarget;
        const offset = (this.motionPosition || this.desiredPosition).clone().sub(target).multiplyScalar(sample.dolly);
        this.camera.position.copy(target).add(offset); this.camera.lookAt(target);
      }
      if (sample.ended&&!this.recording) this.events.onMotionEnd?.();
    }
    const animation=this.animations?.update(this.recording?0:delta);
    if(animation?.ended&&!this.recording)this.events?.onAnimationEnd?.(this.animations.cursor);
    if(animation?.moving&&!this.recording&&time-(this.lastAnimationReport||0)>100){this.lastAnimationReport=time;this.events?.onAnimationTime?.(this.animations.cursor);}
    const drifting = this.stage.visible && this.particles?.visible && this.particles.material.opacity > 0;
    if (drifting) this.particles.rotation.y += delta * .007;
    this.environmentTime=(this.environmentTime||0)+delta;
    const environmentMoving=this.stage.visible&&this.customStage?.update(this.config.scene,this.environmentTime);
    if (this.bokeh?.enabled) {
      const point = this.config.camera.focusPoint ? this.focusPoint.fromArray(this.config.camera.focusPoint) : this.controls.target;
      this.bokeh.uniforms.focus.value = this.config.camera.autoFocus ? this.camera.position.distanceTo(point) : this.config.camera.focus;
    }
    if (this.worldPlanes.length) this.updateSectionTransform();
    const effectsMoving=this.effects?.update(delta,{camera:this.camera,height:this.size.height*this.renderer.getPixelRatio(),deforming:!!animation?.moving,
      forcePose:!!this.recording,absoluteTime:this.recording?this.effectsVideoTime:undefined});
    if(this.effects?.enabled&&!this.recording&&time-(this.lastEffectsReport||0)>120){this.lastEffectsReport=time;this.events.onEffectsTime?.(this.effects.cursor);}
    this.renderer.info.reset();
    this.contactShadow?.update(this.renderer,this.config,time,(moving && motion.preset==='turntable')||animation?.moving,!!this.recording&&(motion.preset==='turntable'||!!this.config.animation?.playing));
    this.composer.render(delta);
    this.rendering = false;
    const active = !!(this.transition || this.manual || this.settling || controlsChanged || moving || (animation?.moving&&!animation.ended) || drifting || environmentMoving || effectsMoving);
    const report = this.monitor.sample(time, targetFps, this.config.render.adaptive);
    if (report && !this.recording) { this.reportStats(report); if (report.changed) this.resize(); }
    if (!active) { this.monitor.reset(); this.reportStats({ idle: true }); }
    return active;
  }

  rewindMotion() {
    this.motionTime=0;this.motionBaseAngle=0;this.product.rotation.set(0,0,0);this.product.position.set(0,0,0);
    if(['orbit','dolly','idle'].includes(this.config.motion.preset)&&this.motionPosition){
      this.camera.position.copy(this.motionPosition);this.controls.target.copy(this.motionTarget);this.camera.lookAt(this.controls.target);
    }
    this.scrubPending=true;this.transition=false;this.clearOrbitInertia();this.contactShadow?.invalidate();this.invalidate();
  }

  async captureVideo(options) {
    if(!this.renderer||!this.ready||this.contextUnavailable||this.recording)throw new Error('Il render 3D non è pronto.');
    if(this.config.render.alpha)throw new Error('Disattiva Alpha per il video; PNG conserva la trasparenza.');
    const {width,height,fps}=videoSettings(options);
    const saved={config:this.config,camera:this.camera.clone(),target:this.controls.target.clone(),size:{...this.size},dpr:this.renderer.getPixelRatio(),presentation:this.presentation,
      position:this.product.position.clone(),quaternion:this.product.quaternion.clone(),desiredPosition:this.desiredPosition.clone(),desiredTarget:this.desiredTarget.clone(),
      motionPosition:this.motionPosition?.clone(),motionTarget:this.motionTarget?.clone(),motionTime:this.motionTime,motionBaseAngle:this.motionBaseAngle,animationTime:this.animations?.time,
      transition:this.transition,motionFramePending:this.motionFramePending,helpers:this.sectionHelpers.visible,environmentTime:this.environmentTime,enabled:this.controls.enabled,particleRotation:this.particles?.rotation.y,effects:this.effects?.snapshot()};
    this.recording=true;this.loop.setPaused(true);this.controls.enabled=false;
    try{
      this.clearOrbitInertia();this.manual=false;this.settling=false;this.presentation=true;this.sectionHelpers.visible=false;
      this.config={...saved.config,motion:{...saved.config.motion,playing:saved.config.motion.preset!=='still',cursor:0},render:{...saved.config.render,fps,adaptive:false}};
      this.size={width,height};this.renderer.setPixelRatio(1);this.renderer.setSize(width,height,false);this.composer.setPixelRatio(1);this.composer.setSize(width,height);
      this.product.rotation.set(0,0,0);this.product.position.set(0,0,0);
      this.frameCamera(this.config.camera);this.camera.position.copy(this.desiredPosition);this.controls.target.copy(this.desiredTarget);this.camera.lookAt(this.controls.target);
      this.motionPosition=this.camera.position.clone();this.motionTarget=this.controls.target.clone();this.motionTime=0;this.motionBaseAngle=0;this.product.rotation.set(0,0,0);this.product.position.set(0,0,0);
      this.transition=false;this.motionFramePending=false;this.environmentTime=0;this.setSelected('',false);this.contactShadow?.invalidate();
      this.effects?.trails?.clear();
      const base=performance.now();
      return await recordCanvas(this.canvas,elapsed=>{
        if(this.disposed||this.contextUnavailable)throw new Error('Il contesto 3D è stato interrotto.');
        // Evaluate each requested frame from its timeline position, even if a frame is dropped.
        this.motionTime=Math.max(0,elapsed)*this.config.motion.speed;this.scrubPending=true;
        if(this.config.animation?.playing)this.animations?.sample((saved.animationTime||0)+Math.max(0,elapsed)*this.config.animation.speed);
        const playing=this.config.motion.playing;this.config.motion.playing=false;this.environmentTime=elapsed;if(this.particles)this.particles.rotation.y=elapsed*.007;
        this.effectsVideoTime=(saved.effects?.time||0)+(this.config.effects?.playing?elapsed*this.config.effects.speed:0);
        this.lastFrame=base+elapsed*1000;this.dirty=true;
        try{this.tick(base+elapsed*1000);}finally{this.config.motion.playing=playing;}
      },options);
    }finally{
      this.config=saved.config;this.presentation=saved.presentation;this.size=saved.size;
      this.product.position.copy(saved.position);this.product.quaternion.copy(saved.quaternion);this.camera.copy(saved.camera);this.controls.target.copy(saved.target);
      this.desiredPosition.copy(saved.desiredPosition);this.desiredTarget.copy(saved.desiredTarget);this.motionPosition=saved.motionPosition;this.motionTarget=saved.motionTarget;this.motionTime=saved.motionTime;this.motionBaseAngle=saved.motionBaseAngle;
      this.transition=saved.transition;this.motionFramePending=saved.motionFramePending;this.environmentTime=saved.environmentTime;this.sectionHelpers.visible=saved.helpers;this.controls.enabled=saved.enabled;this.scrubPending=false;if(this.particles)this.particles.rotation.y=saved.particleRotation;
      this.animations?.seek(saved.animationTime||0);
      if(saved.effects)this.effects?.restore(saved.effects);this.effectsVideoTime=undefined;
      this.recording=false;
      if(!this.disposed){
        this.renderer.setPixelRatio(saved.dpr);this.renderer.setSize(saved.size.width,saved.size.height,false);this.composer.setPixelRatio(saved.dpr);this.composer.setSize(saved.size.width,saved.size.height);
        this.setSelected(this.config.selectedMaterial,this.activeTab==='product'&&!this.presentation);this.contactShadow?.invalidate();this.monitor.reset();this.lastFrame=performance.now();this.loop.setPaused(document.hidden||!!this.contextUnavailable);this.invalidate();
      }
    }
  }

  async capture() {
    if (!this.renderer || !this.ready || this.contextUnavailable) throw new Error('L’esportazione richiede il render 3D attivo.');
    // Render and request the snapshot in the same task; no retained drawing buffer.
    const helpers = this.sectionHelpers.visible; this.sectionHelpers.visible = false;
    try {
      this.effects?.update(0,{camera:this.camera,height:this.size.height*this.renderer.getPixelRatio(),forcePose:true});
      this.contactShadow?.update(this.renderer,this.config,performance.now(),false,true);
      this.composer.render(0);
      return new Promise((resolve, reject) => this.canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Esportazione non riuscita.')), 'image/png'));
    } finally { this.sectionHelpers.visible = helpers; this.invalidate(); }
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
    clearTimeout(this.hoverTimer);
    this.canvas.removeEventListener('pointermove', this.pointerMove); this.canvas.removeEventListener('pointerleave', this.pointerLeave);
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.effects?.dispose();this.releaseInspection();
    this.animations?.dispose();this.contactShadow?.dispose();
    this.resizeObserver.disconnect(); this.controls?.dispose(); this.draco?.dispose();
    this.canvas.removeEventListener('pointerdown', this.pointerDown); this.canvas.removeEventListener('pointerup', this.pointerUp); this.canvas.removeEventListener('dblclick', this.doubleClick); this.canvas.removeEventListener('webglcontextlost', this.contextLost);
    this.disposeObject(this.scene); this.reflector?.dispose(); this.composer?.dispose(); this.bokeh?.dispose(); this.bloom?.dispose(); this.grade?.dispose(); this.outputPass?.dispose(); this.environmentTarget?.dispose(); this.key.shadow.dispose(); this.renderer?.dispose();
  }
}
