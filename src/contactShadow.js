import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';
import { PLINTH_SIZE } from './cubeStage.js';
import { effectsAlterCoverage } from './objectEffectsState.js';

const SHADOW_LAYER = 30;
export const supportHeight = preset => preset === 'void' ? null : preset === 'ring' ? .018 : preset === 'cubes' ? 0 : -.012;
export function contactShadowPolicy(state, bounds) {
  const ground = supportHeight(state.scene.preset);
  const gap = ground == null || !bounds ? Infinity : bounds.min.y - ground;
  const half = PLINTH_SIZE / 2;
  const supported = state.scene.preset !== 'cubes' || (bounds && bounds.max.x > -half && bounds.min.x < half && bounds.max.z > -half && bounds.min.z < half);
  return { ground, visible: ground != null && !!bounds && supported && gap < .18 && gap > -.08 && !state.render.alpha && state.inspection.view === 'pbr' && !state.section.enabled && !effectsAlterCoverage(state.effects),
    opacity: .82 * Math.max(0,1 - Math.max(0,gap-.04)/.14) };
}

// A cached, low-resolution projection of the real underside, not a generic blob.
// Only product geometry is rendered. Camera/light changes reuse the texture.
export class ContactShadow {
  constructor(scene, coarse = false) {
    this.scene = scene; this.coarse = coarse; this.meshes = []; this.depthMaterials = new Map();
    this.bounds = new THREE.Box3(); this.camera = new THREE.OrthographicCamera(-3,3,3,-3,.01,1);
    this.camera.layers.set(SHADOW_LAYER); this.camera.up.set(0,0,1);
    this.target = new THREE.WebGLRenderTarget(coarse?256:512,coarse?256:512,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:false});
    this.blurTarget = this.target.clone(); this.blurTarget.depthBuffer = false;
    this.horizontal = new THREE.ShaderMaterial({...HorizontalBlurShader,uniforms:THREE.UniformsUtils.clone(HorizontalBlurShader.uniforms),depthTest:false,depthWrite:false});
    this.vertical = new THREE.ShaderMaterial({...VerticalBlurShader,uniforms:THREE.UniformsUtils.clone(VerticalBlurShader.uniforms),depthTest:false,depthWrite:false});
    this.quad = new FullScreenQuad(this.horizontal);
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:this.target.texture,color:0x000000,transparent:true,opacity:.82,depthWrite:false,toneMapped:false,fog:false}));
    this.plane.name = 'Contact shadow'; this.plane.rotation.x = -Math.PI/2; this.plane.visible = false;
    this.plinthPlanes = [new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)].map(normal=>new THREE.Plane(normal,PLINTH_SIZE/2-.02));
    // The underside camera sees +Z upward; the receiving plane's V points -Z.
    this.target.texture.repeat.y = -1; this.target.texture.offset.y = 1;
    this.scene.add(this.plane); this.dirty = true; this.lastRender = -Infinity;
  }

  setModel(model, meshes) {
    this.depthMaterials.forEach(material=>material.dispose()); this.depthMaterials.clear();
    this.model = model; this.meshes = meshes;
    meshes.forEach(mesh=>mesh.layers.enable(SHADOW_LAYER)); this.dirty = true;
  }

  invalidate() { this.dirty = true; }

  depthMaterial(source) {
    let material = this.depthMaterials.get(source);
    if (!material) {
      material = new THREE.MeshDepthMaterial({depthPacking:THREE.BasicDepthPacking,side:THREE.DoubleSide,blending:THREE.NoBlending});
      material.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace('gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
          'gl_FragColor = vec4( vec3( 0.0 ), pow( 1.0 - fragCoordZ, 2.0 ) * diffuseColor.a );');
      };
      material.customProgramCacheKey = () => 'pv-contact-height-v1'; this.depthMaterials.set(source,material);
    }
    const masked = source.alphaTest > 0 || source.transparent;
    const map = masked ? source.map : null, alphaMap = masked ? source.alphaMap : null;
    const cutoff = source.alphaTest || (source.transparent ? .025 : 0);
    if (material.map !== map || material.alphaMap !== alphaMap || !!material.alphaTest !== !!cutoff) material.needsUpdate = true;
    material.map = map; material.alphaMap = alphaMap; material.alphaTest = cutoff;
    material.opacity = (source.transparent ? source.opacity : 1) * (1-(source.transmission || 0));
    return material;
  }

  update(renderer, state, time, movingProduct = false, force = false) {
    if (!this.model) return;
    if (movingProduct && !this.dirty && !force && time-this.lastRender < (this.coarse?80:50)) return;
    if (movingProduct) this.dirty = true;
    if (!this.dirty && !force) return;
    this.model.updateWorldMatrix(true,true); this.bounds.setFromObject(this.model);
    const policy = contactShadowPolicy(state,this.bounds);
    this.plane.visible = policy.visible; this.plane.material.opacity = policy.opacity;
    this.plane.material.clippingPlanes = state.scene.preset === 'cubes' ? this.plinthPlanes : null;
    if (!policy.visible) { this.dirty = false; return; }
    const size = this.bounds.getSize(new THREE.Vector3()), center = this.bounds.getCenter(new THREE.Vector3());
    const width = Math.max(.15,size.x)+.5, depth = Math.max(.15,size.z)+.5;
    this.camera.left = -width/2; this.camera.right = width/2; this.camera.top = depth/2; this.camera.bottom = -depth/2;
    this.camera.far = Math.max(.35,Math.min(1.25,size.y*.6))+.04;
    this.camera.position.set(center.x,policy.ground-.04,center.z); this.camera.lookAt(center.x,policy.ground+1,center.z); this.camera.updateProjectionMatrix();
    this.plane.position.set(center.x,policy.ground+.012,center.z); this.plane.scale.set(width,depth,1);
    const previousTarget = renderer.getRenderTarget(), color = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
    const background = this.scene.background, shadows = renderer.shadowMap.enabled, autoClear = renderer.autoClear;
    const originals = this.meshes.map(mesh=>mesh.material);
    try {
      this.scene.background = null; renderer.shadowMap.enabled = false; renderer.autoClear = true; renderer.setClearColor(0x000000,0);
      this.meshes.forEach(mesh=>{const source=mesh.userData.pvBaseMaterials || mesh.material;mesh.material=Array.isArray(source)?source.map(mat=>this.depthMaterial(mat)):this.depthMaterial(source);});
      renderer.setRenderTarget(this.target); renderer.clear(); renderer.render(this.scene,this.camera);
      this.horizontal.uniforms.tDiffuse.value = this.target.texture;
      this.horizontal.uniforms.h.value = .016/width;
      this.quad.material = this.horizontal; renderer.setRenderTarget(this.blurTarget); this.quad.render(renderer);
      this.vertical.uniforms.tDiffuse.value = this.blurTarget.texture;
      this.vertical.uniforms.v.value = .016/depth;
      this.quad.material = this.vertical; renderer.setRenderTarget(this.target); this.quad.render(renderer);
      this.dirty = false; this.lastRender = time;
    } finally {
      this.meshes.forEach((mesh,i)=>{mesh.material=originals[i];});
      this.scene.background = background; renderer.shadowMap.enabled = shadows; renderer.autoClear = autoClear;
      renderer.setClearColor(color,alpha); renderer.setRenderTarget(previousTarget);
    }
  }

  dispose() {
    this.scene.remove(this.plane); this.plane.geometry.dispose(); this.plane.material.dispose();
    this.depthMaterials.forEach(material=>material.dispose()); this.depthMaterials.clear();
    this.target.dispose(); this.blurTarget.dispose(); this.horizontal.dispose(); this.vertical.dispose(); this.quad.dispose();
  }
}
