import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { easeInOutCubic } from '../utils/math.js';

export class StudioSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.renderer = engine.renderer;
    this.environmentTexture = null;
    this.pmremGenerator = null;
    this.backgroundMaterial = null;
    this.backgroundSphere = null;
    this.floorMesh = null;
    this.contactShadow = null;
    this.hemiLight = null;
    this.keyLight = null;
    this.fillLight = null;
    this.rimLight = null;
    this.lookTween = null;
    this.floorEnabled = true;
    this.shadowsEnabled = true;
  }

  initialize() {
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();
    const room = new RoomEnvironment();
    this.environmentTexture = this.pmremGenerator.fromScene(room, 0.04).texture;
    room.dispose();
    this.scene.environment = this.environmentTexture;
    this.scene.environmentIntensity = 1.25;

    this.backgroundMaterial = new THREE.ShaderMaterial({
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
    this.backgroundSphere = new THREE.Mesh(new THREE.SphereGeometry(85, 48, 32), this.backgroundMaterial);
    this.backgroundSphere.renderOrder = -1000;
    this.backgroundSphere.frustumCulled = false;
    this.scene.add(this.backgroundSphere);

    this.floorMesh = this.#createCyclorama();
    this.scene.add(this.floorMesh);

    this.contactShadow = this.#createContactShadow();
    this.scene.add(this.contactShadow);

    this.hemiLight = new THREE.HemisphereLight(0xdce7f5, 0x0c0d10, 0.42);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff7ee, 3.4);
    this.keyLight.position.set(4.8, 7.5, 5.7);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.bias = -0.00018;
    this.keyLight.shadow.normalBias = 0.025;
    this.keyLight.shadow.radius = 4;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    this.fillLight = new THREE.DirectionalLight(0xb7c8dd, 1.05);
    this.fillLight.position.set(-5.6, 3.5, 4.5);
    this.scene.add(this.fillLight);
    this.scene.add(this.fillLight.target);

    this.rimLight = new THREE.DirectionalLight(0xff7950, 5.0);
    this.rimLight.position.set(-4.8, 5.6, -5.2);
    this.scene.add(this.rimLight);
    this.scene.add(this.rimLight.target);

    [this.keyLight.target, this.fillLight.target, this.rimLight.target]
      .forEach((target) => target.position.set(0, 1.25, 0));

    return this;
  }

  applyPreset(preset, { immediate = false } = {}) {
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

    this.lookTween = {
      from: this.getCurrentLook(),
      to: target,
      startedAt: performance.now(),
      duration: immediate ? 1 : 850,
    };
  }

  cancelPresetTween() {
    this.lookTween = null;
  }

  getCurrentLook() {
    return {
      top: this.backgroundMaterial.uniforms.topColor.value.clone(),
      bottom: this.backgroundMaterial.uniforms.bottomColor.value.clone(),
      accent: this.backgroundMaterial.uniforms.accentColor.value.clone(),
      floor: this.floorMesh.material.color.clone(),
      keyColor: this.keyLight.color.clone(),
      fillColor: this.fillLight.color.clone(),
      rimColor: this.rimLight.color.clone(),
      accentStrength: this.backgroundMaterial.uniforms.accentStrength.value,
      floorRoughness: this.floorMesh.material.roughness,
      exposure: this.renderer.toneMappingExposure,
      environment: this.scene.environmentIntensity,
      key: this.keyLight.intensity,
      fill: this.fillLight.intensity,
      rim: this.rimLight.intensity,
      bloom: this.engine.bloomPass.strength,
      shadow: this.contactShadow.material.opacity,
    };
  }

  update(now) {
    const tween = this.lookTween;
    if (!tween) return;
    const raw = Math.min(1, (now - tween.startedAt) / tween.duration);
    const t = easeInOutCubic(raw);
    const { from, to } = tween;

    this.backgroundMaterial.uniforms.topColor.value.copy(from.top).lerp(to.top, t);
    this.backgroundMaterial.uniforms.bottomColor.value.copy(from.bottom).lerp(to.bottom, t);
    this.backgroundMaterial.uniforms.accentColor.value.copy(from.accent).lerp(to.accent, t);
    this.floorMesh.material.color.copy(from.floor).lerp(to.floor, t);
    this.keyLight.color.copy(from.keyColor).lerp(to.keyColor, t);
    this.fillLight.color.copy(from.fillColor).lerp(to.fillColor, t);
    this.rimLight.color.copy(from.rimColor).lerp(to.rimColor, t);

    this.backgroundMaterial.uniforms.accentStrength.value = THREE.MathUtils.lerp(from.accentStrength, to.accentStrength, t);
    this.floorMesh.material.roughness = THREE.MathUtils.lerp(from.floorRoughness, to.floorRoughness, t);
    this.engine.setExposure(THREE.MathUtils.lerp(from.exposure, to.exposure, t));
    this.scene.environmentIntensity = THREE.MathUtils.lerp(from.environment, to.environment, t);
    this.keyLight.intensity = THREE.MathUtils.lerp(from.key, to.key, t);
    this.fillLight.intensity = THREE.MathUtils.lerp(from.fill, to.fill, t);
    this.rimLight.intensity = THREE.MathUtils.lerp(from.rim, to.rim, t);
    this.engine.setBloomStrength(THREE.MathUtils.lerp(from.bloom, to.bloom, t));
    this.contactShadow.material.opacity = THREE.MathUtils.lerp(from.shadow, to.shadow, t);

    if (raw >= 1) this.lookTween = null;
  }

  setExposure(value) {
    this.engine.setExposure(value);
  }

  setEnvironmentIntensity(value) {
    this.scene.environmentIntensity = value;
  }

  setKeyIntensity(value) {
    this.keyLight.intensity = value;
  }

  setRimIntensity(value) {
    this.rimLight.intensity = value;
  }

  setBloom(value) {
    this.engine.setBloomStrength(value);
  }

  setFloorEnabled(enabled) {
    this.floorEnabled = Boolean(enabled);
    this.floorMesh.visible = this.floorEnabled;
    this.contactShadow.visible = this.floorEnabled;
  }

  setShadowsEnabled(enabled) {
    this.shadowsEnabled = Boolean(enabled);
    this.engine.setShadowEnabled(this.shadowsEnabled);
    this.keyLight.castShadow = this.shadowsEnabled;
  }

  setShadowQuality(size) {
    this.keyLight.shadow.mapSize.set(size, size);
    this.keyLight.shadow.map?.dispose();
    this.keyLight.shadow.map = null;
  }

  updateForBounds(bounds, radius, { updateShadowScale = true } = {}) {
    if (!bounds || bounds.isEmpty()) return;
    const size = bounds.getSize(new THREE.Vector3());
    const extent = Math.max(4, radius * 2.25);
    const shadowCamera = this.keyLight.shadow.camera;
    shadowCamera.left = -extent;
    shadowCamera.right = extent;
    shadowCamera.top = extent;
    shadowCamera.bottom = -extent;
    shadowCamera.near = 0.1;
    shadowCamera.far = Math.max(30, extent * 5);
    shadowCamera.updateProjectionMatrix();

    const targetY = bounds.min.y + size.y * 0.48;
    [this.keyLight.target, this.fillLight.target, this.rimLight.target].forEach((target) => {
      target.position.set(0, targetY, 0);
      target.updateMatrixWorld();
    });

    if (updateShadowScale) {
      const footprint = Math.max(size.x, size.z, 1.2);
      this.contactShadow.scale.set(footprint * 1.72, footprint * 1.72, 1);
      this.contactShadow.position.x = (bounds.min.x + bounds.max.x) * 0.5;
      this.contactShadow.position.z = (bounds.min.z + bounds.max.z) * 0.5;
    }
  }

  updateCameraPosition(position) {
    this.backgroundSphere.position.copy(position);
  }

  #createCyclorama() {
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

  #createContactShadow() {
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
}
