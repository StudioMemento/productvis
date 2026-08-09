import * as THREE from 'three';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';
import { CONTACT_SHADOW_LAYER } from '../config/runtime.js';

const DEFAULT_QUALITY = Object.freeze({
  contactShadowSize: 512,
  contactShadowBlurPasses: 1,
  contactShadowDynamicFps: 24,
});

/**
 * Geometry-aware, cached contact shadow based on the official Three.js depth +
 * separable blur technique. Only meshes on CONTACT_SHADOW_LAYER are rendered.
 */
export class ContactShadowRenderer {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'Product VIS Invisible Ground';
    this.baseGroundY = -0.012;
    this.groundOffset = 0;
    this.group.position.y = this.baseGroundY;

    this.renderTarget = null;
    this.renderTargetBlur = null;
    this.shadowCamera = null;
    this.shadowPlane = null;
    this.blurPlane = null;
    this.depthMaterial = null;
    this.horizontalBlurMaterial = null;
    this.verticalBlurMaterial = null;

    this.enabled = true;
    this.opacity = 0.52;
    this.softness = 0.58;
    this.darkness = 2.15;
    this.dirty = true;
    this.lastDynamicRender = -Infinity;
    this.quality = { ...DEFAULT_QUALITY };
    this.clearColor = new THREE.Color();
  }

  initialize() {
    const planeGeometry = new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2);

    this.shadowPlane = new THREE.Mesh(
      planeGeometry,
      new THREE.MeshBasicMaterial({
        name: 'PV Contact Shadow Surface',
        color: 0x000000,
        transparent: true,
        opacity: this.opacity,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
      }),
    );
    this.shadowPlane.name = 'Product VIS Contact Shadow';
    this.shadowPlane.scale.set(4, -1, 4);
    this.shadowPlane.renderOrder = 2;
    this.shadowPlane.frustumCulled = false;
    this.group.add(this.shadowPlane);

    this.blurPlane = new THREE.Mesh(planeGeometry);
    this.blurPlane.name = 'Product VIS Contact Shadow Blur Surface';
    this.blurPlane.scale.set(4, 1, 4);
    this.blurPlane.visible = false;
    this.blurPlane.frustumCulled = false;
    this.blurPlane.layers.set(CONTACT_SHADOW_LAYER);
    this.group.add(this.blurPlane);

    this.shadowCamera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0, 8);
    this.shadowCamera.name = 'Product VIS Contact Shadow Camera';
    this.shadowCamera.rotation.x = Math.PI / 2;
    this.shadowCamera.layers.set(CONTACT_SHADOW_LAYER);
    this.group.add(this.shadowCamera);

    this.depthMaterial = new THREE.MeshDepthMaterial({
      name: 'PV Contact Shadow Depth',
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    this.depthMaterial.userData.darkness = { value: this.darkness };
    this.depthMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.darkness = this.depthMaterial.userData.darkness;
      shader.fragmentShader = /* glsl */`
        uniform float darkness;
        ${shader.fragmentShader.replace(
          'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
          'gl_FragColor = vec4( vec3( 0.0 ), clamp( ( 1.0 - fragCoordZ ) * darkness, 0.0, 1.0 ) );',
        )}
      `;
    };

    this.horizontalBlurMaterial = new THREE.ShaderMaterial(HorizontalBlurShader);
    this.horizontalBlurMaterial.name = 'PV Contact Shadow Horizontal Blur';
    this.horizontalBlurMaterial.depthTest = false;
    this.horizontalBlurMaterial.depthWrite = false;

    this.verticalBlurMaterial = new THREE.ShaderMaterial(VerticalBlurShader);
    this.verticalBlurMaterial.name = 'PV Contact Shadow Vertical Blur';
    this.verticalBlurMaterial.depthTest = false;
    this.verticalBlurMaterial.depthWrite = false;

    this.#createRenderTargets(this.quality.contactShadowSize);
    this.scene.add(this.group);
    return this;
  }

  #createRenderTargets(size) {
    this.renderTarget?.dispose();
    this.renderTargetBlur?.dispose();

    const resolution = Math.max(128, Math.min(1024, Math.round(size)));
    const targetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: true,
      stencilBuffer: false,
    };
    this.renderTarget = new THREE.WebGLRenderTarget(resolution, resolution, targetOptions);
    this.renderTarget.texture.name = 'PV Contact Shadow Texture';
    this.renderTarget.texture.generateMipmaps = false;

    this.renderTargetBlur = new THREE.WebGLRenderTarget(resolution, resolution, targetOptions);
    this.renderTargetBlur.texture.name = 'PV Contact Shadow Blur Texture';
    this.renderTargetBlur.texture.generateMipmaps = false;

    if (this.shadowPlane) {
      this.shadowPlane.material.map = this.renderTarget.texture;
      this.shadowPlane.material.needsUpdate = true;
    }
    this.dirty = true;
  }

  setQuality(profile = DEFAULT_QUALITY) {
    const next = {
      contactShadowSize: profile.contactShadowSize ?? DEFAULT_QUALITY.contactShadowSize,
      contactShadowBlurPasses: profile.contactShadowBlurPasses ?? DEFAULT_QUALITY.contactShadowBlurPasses,
      contactShadowDynamicFps: profile.contactShadowDynamicFps ?? DEFAULT_QUALITY.contactShadowDynamicFps,
    };
    const sizeChanged = next.contactShadowSize !== this.quality.contactShadowSize;
    this.quality = next;
    if (sizeChanged) this.#createRenderTargets(next.contactShadowSize);
    this.markDirty();
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.shadowPlane) this.shadowPlane.visible = this.enabled;
    if (this.enabled) this.markDirty();
  }

  setOpacity(value) {
    const next = THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
    if (Math.abs(next - this.opacity) < 0.0001) return;
    this.opacity = next;
    if (this.shadowPlane) this.shadowPlane.material.opacity = this.opacity;
  }

  setSoftness(value) {
    const next = THREE.MathUtils.clamp(Number(value) || 0, 0.05, 1);
    if (Math.abs(next - this.softness) < 0.0001) return;
    this.softness = next;
    this.markDirty();
  }

  setGroundOffset(value) {
    const next = THREE.MathUtils.clamp(Number(value) || 0, -0.75, 0.75);
    if (Math.abs(next - this.groundOffset) < 0.0001) return false;
    this.groundOffset = next;
    this.group.position.y = this.baseGroundY + this.groundOffset;
    this.group.updateMatrixWorld(true);
    this.markDirty();
    return true;
  }

  setDarkness(value) {
    const next = THREE.MathUtils.clamp(Number(value) || 0, 0.5, 5);
    if (Math.abs(next - this.darkness) < 0.0001) return;
    this.darkness = next;
    if (this.depthMaterial) this.depthMaterial.userData.darkness.value = this.darkness;
    this.markDirty();
  }

  updateForBounds(bounds, radius) {
    if (!bounds || bounds.isEmpty()) return;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const sphereDiameter = Math.max(radius * 2, 1);
    const width = Math.max(size.x * 1.3, sphereDiameter * 1.08, 1.6);
    const depth = Math.max(size.z * 1.3, sphereDiameter * 1.08, 1.6);
    const heightAboveGround = Math.max(
      bounds.max.y - this.group.position.y,
      size.y,
      sphereDiameter,
    );
    const cameraFar = Math.max(heightAboveGround * 1.18, 1.2);

    this.group.position.x = center.x;
    this.group.position.z = center.z;
    this.shadowPlane.scale.set(width, -1, depth);
    this.blurPlane.scale.set(width, 1, depth);

    this.shadowCamera.left = -width / 2;
    this.shadowCamera.right = width / 2;
    this.shadowCamera.top = depth / 2;
    this.shadowCamera.bottom = -depth / 2;
    this.shadowCamera.near = 0;
    this.shadowCamera.far = cameraFar;
    this.shadowCamera.updateProjectionMatrix();
    this.group.updateMatrixWorld(true);
    this.markDirty();
  }

  markDirty() {
    this.dirty = true;
  }

  render({ dynamic = false, force = false, now = performance.now() } = {}) {
    if (!this.enabled || !this.renderTarget || !this.shadowCamera) return false;

    const interval = 1000 / Math.max(1, this.quality.contactShadowDynamicFps);
    if (dynamic && !force && now - this.lastDynamicRender < interval) return false;
    if (!dynamic && !force && !this.dirty) return false;

    const previousTarget = this.renderer.getRenderTarget();
    const previousBackground = this.scene.background;
    const previousOverride = this.scene.overrideMaterial;
    const previousClearAlpha = this.renderer.getClearAlpha();
    this.renderer.getClearColor(this.clearColor);

    const previousShadowVisible = this.shadowPlane.visible;
    const previousBlurVisible = this.blurPlane.visible;

    try {
      this.shadowPlane.visible = false;
      this.blurPlane.visible = false;
      this.scene.background = null;
      this.scene.overrideMaterial = this.depthMaterial;
      this.renderer.setClearColor(0x000000, 0);

      this.renderer.setRenderTarget(this.renderTarget);
      this.renderer.clear(true, true, true);
      this.renderer.render(this.scene, this.shadowCamera);

      this.scene.overrideMaterial = previousOverride;
      this.#blur(this.#getBlurAmount());
      if (this.quality.contactShadowBlurPasses > 1) {
        this.#blur(Math.max(0.42, this.#getBlurAmount() * 0.42));
      }

      this.dirty = false;
      if (dynamic || force) this.lastDynamicRender = now;
      return true;
    } finally {
      this.renderer.setRenderTarget(previousTarget);
      this.renderer.setClearColor(this.clearColor, previousClearAlpha);
      this.scene.background = previousBackground;
      this.scene.overrideMaterial = previousOverride;
      this.shadowPlane.visible = this.enabled && previousShadowVisible;
      this.blurPlane.visible = previousBlurVisible;
    }
  }

  #getBlurAmount() {
    return THREE.MathUtils.lerp(1.35, 6.2, this.softness);
  }

  #blur(amount) {
    this.blurPlane.visible = true;

    this.blurPlane.material = this.horizontalBlurMaterial;
    this.horizontalBlurMaterial.uniforms.tDiffuse.value = this.renderTarget.texture;
    this.horizontalBlurMaterial.uniforms.h.value = amount / 256;
    this.renderer.setRenderTarget(this.renderTargetBlur);
    this.renderer.clear(true, true, true);
    this.renderer.render(this.blurPlane, this.shadowCamera);

    this.blurPlane.material = this.verticalBlurMaterial;
    this.verticalBlurMaterial.uniforms.tDiffuse.value = this.renderTargetBlur.texture;
    this.verticalBlurMaterial.uniforms.v.value = amount / 256;
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.clear(true, true, true);
    this.renderer.render(this.blurPlane, this.shadowCamera);

    this.blurPlane.visible = false;
  }

  dispose() {
    this.scene.remove(this.group);
    this.renderTarget?.dispose();
    this.renderTargetBlur?.dispose();
    this.shadowPlane?.geometry.dispose();
    this.shadowPlane?.material.dispose();
    this.depthMaterial?.dispose();
    this.horizontalBlurMaterial?.dispose();
    this.verticalBlurMaterial?.dispose();
    this.group.clear();
  }
}
