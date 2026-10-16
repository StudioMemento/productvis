import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ContactShadow, contactShadowPolicy, supportHeight } from '../src/contactShadow.js';
import { DEFAULT_STATE, clone } from '../src/state.js';

const v=(x,y,z)=>new THREE.Vector3(x,y,z);
const bounds=new THREE.Box3(v(-1,.025,-2),v(1,1,2));
function fixture(coarse=false) {
  const scene=new THREE.Scene(), mesh=new THREE.Mesh(new THREE.BoxGeometry(2,1,4),new THREE.MeshPhysicalMaterial());
  mesh.position.set(.4,.525,-.3); mesh.userData.pvBaseMaterials=mesh.material; scene.add(mesh);
  const shadow=new ContactShadow(scene,coarse); shadow.setModel(mesh,[mesh]);
  let calls=0,target='composer',alpha=1,color=new THREE.Color('#343b43');
  scene.background=new THREE.Color('#151a21');
  const renderer={shadowMap:{enabled:true},autoClear:false,getRenderTarget:()=>target,setRenderTarget:v=>{target=v;},getClearColor:c=>c.copy(color),getClearAlpha:()=>alpha,setClearColor:(c,a)=>{color.set(c);alpha=a;},clear(){},render(){calls++;}};
  return {scene,mesh,shadow,renderer,calls:()=>calls,dispose(){shadow.dispose();mesh.geometry.dispose();mesh.material.dispose();}};
}

test('contact follows the actual plane and vanishes in void, alpha, diagnostics, cuts or a lifted product',()=>{
  const state=clone(DEFAULT_STATE);
  for(const preset of ['cubes','ring','studio','cinema','particles']){state.scene.preset=preset;assert.equal(contactShadowPolicy(state,bounds).visible,true);}
  assert.equal(supportHeight('ring'),.018);assert.equal(supportHeight('cubes'),0);
  state.scene.preset='void';assert.equal(contactShadowPolicy(state,bounds).visible,false);
  state.scene.preset='cubes';state.render.alpha=true;assert.equal(contactShadowPolicy(state,bounds).visible,false);
  state.render.alpha=false;state.inspection.view='wire';assert.equal(contactShadowPolicy(state,bounds).visible,false);
  state.inspection.view='pbr';state.section.enabled=true;assert.equal(contactShadowPolicy(state,bounds).visible,false);
  state.section.enabled=false;
  assert.equal(contactShadowPolicy(state,bounds.clone().translate(v(0,1,0))).visible,false);
  assert.ok(contactShadowPolicy(state,bounds.clone().translate(v(0,.07,0))).opacity<contactShadowPolicy(state,bounds).opacity);
});

test('contact is cached at rest, throttled during product motion and aligned to the receiving plane',()=>{
  const f=fixture(true),state=clone(DEFAULT_STATE),{shadow,renderer}=f;
  shadow.update(renderer,state,0);assert.equal(f.calls(),3);assert.equal(shadow.target.width,256);
  assert.equal(shadow.plane.visible,true);assert.equal(shadow.plane.position.y,.012);
  shadow.update(renderer,state,16);assert.equal(f.calls(),3,'camera-only frames reuse the contact map');
  shadow.update(renderer,state,20,true);assert.equal(f.calls(),3);
  f.mesh.rotation.y=.3;shadow.update(renderer,state,100,true);assert.equal(f.calls(),6);
  shadow.invalidate();shadow.update(renderer,state,101);assert.equal(f.calls(),9,'static edits cannot leave a deferred dirty shadow asleep');
  shadow.camera.updateMatrixWorld();shadow.plane.updateMatrixWorld();shadow.target.texture.updateMatrix();
  for(const uv of [new THREE.Vector2(.25,.8),new THREE.Vector2(.8,.3)]) {
    const world=shadow.plane.localToWorld(v(uv.x-.5,uv.y-.5,0));
    const projected=world.project(shadow.camera);
    const sampled=shadow.target.texture.transformUv(uv.clone());
    assert.ok(Math.abs(sampled.x-(projected.x*.5+.5))<1e-8);assert.ok(Math.abs(sampled.y-(projected.y*.5+.5))<1e-8);
  }
  f.dispose();
});

test('contact respects alpha and active UV textures; restores renderer and source materials on failure',()=>{
  const f=fixture(),{shadow,mesh,scene,renderer}=f,state=clone(DEFAULT_STATE),source=mesh.material;
  source.transparent=true;source.opacity=.5;source.transmission=.25;source.alphaTest=.08;source.map=new THREE.DataTexture(new Uint8Array([255,255,255,0]),1,1);source.map.channel=2;
  const depth=shadow.depthMaterial(source);
  assert.equal(depth.map,source.map);assert.equal(depth.map.channel,2);assert.equal(depth.alphaTest,.08);assert.equal(depth.opacity,.375);
  const shader={fragmentShader:THREE.ShaderLib.depth.fragmentShader};depth.onBeforeCompile(shader);
  assert.ok(shader.fragmentShader.includes('pow( 1.0 - fragCoordZ, 2.0 ) * diffuseColor.a'));
  const background=scene.background;
  renderer.render=()=>{assert.ok(mesh.material.isMeshDepthMaterial);throw new Error('GPU unavailable');};
  assert.throws(()=>shadow.update(renderer,state,0),/GPU unavailable/);
  assert.equal(mesh.material,source);assert.equal(scene.background,background);assert.equal(renderer.getRenderTarget(),'composer');assert.equal(renderer.getClearAlpha(),1);assert.equal(renderer.shadowMap.enabled,true);assert.equal(renderer.autoClear,false);
  const texture=source.map;f.dispose();texture.dispose();
});
