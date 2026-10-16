import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DEFAULT_STATE, clone, makeProject, validateProject } from '../src/state.js';
import { DEFAULT_EFFECTS, EFFECT_GROUPS, chooseEffect, effectBudget, validateEffects } from '../src/objectEffectsState.js';
import { ObjectEffects } from '../src/objectEffects.js';
import { SurfaceSamples } from '../src/effectSampling.js';
import { patchSurfaceShader, surfaceUniforms } from '../src/objectSurfaceShader.js';
import { randomizePresentation } from '../src/presentation.js';
import { contactShadowPolicy } from '../src/contactShadow.js';

function fixture(coarse=false) {
  const scene=new THREE.Scene(),product=new THREE.Group(),model=new THREE.Group();scene.add(product);product.add(model);
  const map=new THREE.Texture(),mat=new THREE.MeshPhysicalMaterial({map,metalness:.4,roughness:.2,transparent:true,opacity:.8,side:THREE.DoubleSide});
  const meshes=[new THREE.Mesh(new THREE.BoxGeometry(2,1,3),mat),new THREE.Mesh(new THREE.SphereGeometry(.5,12,8),mat)];
  meshes[1].position.set(2,0,0);meshes.forEach(mesh=>{mesh.castShadow=true;mesh.userData.pvBaseMaterials=mat;model.add(mesh);});
  product.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),camera=new THREE.PerspectiveCamera();camera.position.set(5,3,8);
  const effects=new ObjectEffects(scene,product,meshes,bounds,{coarse});
  return {scene,product,model,meshes,mat,map,bounds,camera,effects,dispose(){effects.dispose();meshes.forEach(mesh=>mesh.geometry.dispose());mat.dispose();map.dispose();}};
}

test('all fifteen effects roundtrip, legacy projects stay unchanged and invalid inputs are bounded',()=>{
  assert.equal(Object.values(EFFECT_GROUPS).flat().length,15);
  const state=clone(DEFAULT_STATE);delete state.effects;
  assert.deepEqual(validateProject(makeProject(state,{type:'demo'})).state.effects,DEFAULT_EFFECTS);
  for(const [group,items] of Object.entries(EFFECT_GROUPS))for(const [id] of items) {
    state.effects={...chooseEffect(DEFAULT_EFFECTS,group,id),phase:.37,speed:1.2,reverse:true};
    assert.deepEqual(validateProject(makeProject(state,{type:'demo'})).state.effects,state.effects);
  }
  const safe=validateEffects({surface:'bad',trail:'../../oops',density:1e10,size:-1,phase:Infinity,speed:NaN,color:'javascript:x',solid:-5});
  assert.equal(safe.surface,'none');assert.equal(safe.trail,'none');assert.equal(safe.density,1);assert.equal(safe.solid,0);assert.equal(safe.phase,0);assert.equal(safe.size,.25);
  assert.equal(chooseEffect(DEFAULT_EFFECTS,'particles','scatter',true).playing,false);
});

test('every effect creates finite bounded resources, preserves materials and releases its owned geometry',()=>{
  for(const coarse of [false,true]) {
    const f=fixture(coarse),state=clone(DEFAULT_STATE);let disposedSource=0;f.meshes[0].geometry.addEventListener('dispose',()=>disposedSource++);
    for(const [group,items] of Object.entries(EFFECT_GROUPS))for(const [id] of items) {
      state.effects=chooseEffect(DEFAULT_EFFECTS,group,id);f.effects.setState(state);
      f.effects.update(.2,{camera:f.camera,height:900});
      assert.equal(f.mat.map,f.map);assert.equal(f.mat.opacity,.8);assert.equal(f.mat.side,THREE.DoubleSide);assert.equal(f.mat.roughness,.2);
      if(f.effects.samples){assert.ok(f.effects.samples.count<=effectBudget({coarse}).points);assert.ok(f.effects.samples.positions.every(Number.isFinite));}
      if(f.effects.particle){assert.ok(f.effects.particle.geometry.attributes.position.array.every(Number.isFinite));assert.ok(f.effects.particle.geometry.drawRange.count>0);}
      assert.equal(f.effects.uniforms.pvFxEnabled.value,1);
    }
    state.effects={...DEFAULT_EFFECTS};f.effects.setState(state);
    assert.equal(f.effects.enabled,false);assert.equal(f.effects.samples,null);assert.equal(f.effects.trails,null);
    assert.equal(disposedSource,0);assert.ok(f.meshes.every(mesh=>mesh.castShadow));
    f.effects.dispose();assert.equal(disposedSource,0);assert.equal(f.product.children.length,1);assert.equal(f.scene.children.length,1);
    f.dispose();
  }
});

test('surface sampling covers every mesh at low density and retains exact barycentric attachment for morphs',()=>{
  const product=new THREE.Group(),geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));geo.computeVertexNormals();
  geo.morphAttributes.position=[new THREE.Float32BufferAttribute([0,0,2,1,0,2,0,1,2],3)];
  const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial());product.add(mesh);
  const samples=new SurfaceSamples([mesh],product,150,42),before=samples.positions.slice();
  mesh.morphTargetInfluences[0]=.5;samples.refresh(false,true);
  for(let i=0;i<150;i++){assert.ok(Math.abs(samples.positions[i*3]-before[i*3])<1e-6);assert.ok(Math.abs(samples.positions[i*3+2]-1)<1e-6);}
  mesh.position.x=3;samples.refresh();assert.ok(samples.positions[0]>=3);
  product.rotation.y=1;product.updateMatrixWorld(true);samples.refresh();assert.ok(samples.positions[0]>=3,'sample coordinates stay local to the whole product');
  samples.dispose();geo.dispose();mesh.material.dispose();
  const f=fixture();const a=new SurfaceSamples(f.meshes,f.product,300,7),b=new SurfaceSamples(f.meshes,f.product,300,7);
  assert.deepEqual(a.positions,b.positions);assert.ok(a.positions.slice(0,90).some((x,i)=>i%3===0&&x>1.5));
  a.dispose();b.dispose();f.dispose();
});

test('surface samples follow a real skeleton and instanced transforms without copying the product geometry',()=>{
  const product=new THREE.Group(),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));geo.computeVertexNormals();
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(12),4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
  const mesh=new THREE.SkinnedMesh(geo,new THREE.MeshBasicMaterial()),bone=new THREE.Bone();mesh.add(bone);mesh.bind(new THREE.Skeleton([bone]));product.add(mesh);
  const samples=new SurfaceSamples([mesh],product,60),before=samples.positions.slice();bone.position.z=1.75;product.updateMatrixWorld(true);samples.refresh(false,true);
  for(let i=0;i<60;i++)assert.ok(Math.abs(samples.positions[i*3+2]-before[i*3+2]-1.75)<1e-5);
  const instanced=new THREE.InstancedMesh(geo,mesh.material,2);instanced.setMatrixAt(0,new THREE.Matrix4().makeTranslation(-4,0,0));instanced.setMatrixAt(1,new THREE.Matrix4().makeTranslation(4,0,0));product.add(instanced);
  const instances=new SurfaceSamples([instanced],product,100,4);let left=0,right=0;for(let i=0;i<100;i++){if(instances.positions[i*3]<0)left++;else right++;}assert.ok(left>20&&right>20);
  samples.dispose();instances.dispose();geo.dispose();mesh.material.dispose();
});

test('particles preserve source alpha cutouts and react to changes in material opacity',()=>{
  const product=new THREE.Group(),geometry=new THREE.PlaneGeometry(2,2);
  const map=new THREE.DataTexture(new Uint8Array([255,255,255,0,255,255,255,255]),2,1);map.flipY=false;
  const material=new THREE.MeshBasicMaterial({map,alphaTest:.5,transparent:true}),mesh=new THREE.Mesh(geometry,material);product.add(mesh);
  const samples=new SurfaceSamples([mesh],product,240,5);
  let hidden=0,shown=0;for(let i=0;i<samples.count;i++){if(samples.visibility[i]){shown++;assert.ok(samples.positions[i*3]>=-1e-6);}else{hidden++;assert.ok(samples.positions[i*3]<=1e-6);}}
  assert.ok(hidden>80&&shown>80);material.opacity=0;samples.updateVisibility();assert.ok(samples.visibility.every(v=>v===0));
  samples.dispose();geometry.dispose();material.dispose();map.dispose();
});

test('particle parameters do not resample; native animation, pause, phase and diagnostic views are independent',()=>{
  const f=fixture(),state=clone(DEFAULT_STATE);state.effects={...DEFAULT_EFFECTS,surface:'scan',particles:'scatter'};f.effects.setState(state);
  f.effects.update(1,{camera:f.camera});assert.ok(f.effects.time>0);const samples=f.effects.samples;
  state.effects={...state.effects,density:.2,color:'#ffbb4b',size:1.2};f.effects.setState(state);assert.equal(f.effects.samples,samples);
  state.effects={...state.effects,playing:false};f.effects.setState(state);const time=f.effects.time;assert.equal(f.effects.update(2,{camera:f.camera}),false);assert.equal(f.effects.time,time);
  state.effects={...state.effects,phase:.625};f.effects.setState(state);assert.equal(f.effects.cursor,.625);
  state.inspection.view='normals';f.effects.setState(state);assert.equal(f.effects.uniforms.pvFxEnabled.value,0);assert.equal(f.effects.group.visible,false);
  state.inspection.view='pbr';f.effects.setState(state);assert.equal(f.effects.uniforms.pvFxEnabled.value,1);assert.equal(f.effects.cursor,.625);
  f.effects.update(0,{camera:f.camera,absoluteTime:19.7});const shaderTime=f.effects.uniforms.pvFxTime.value;
  const reopened=validateProject(makeProject({...state,effects:{...state.effects,phase:f.effects.cursor}},{type:'demo'})).state;
  const g=fixture();g.effects.setState(reopened);g.effects.update(0,{camera:g.camera});assert.ok(Math.abs(g.effects.uniforms.pvFxTime.value-shaderTime)<1e-9,'save/open reproduces shader phase even after several cycles');g.dispose();
  f.dispose();
});

test('Ribbon and Ghost track only actual object poses, freeze on pause, restore after capture and expire at rest',()=>{
  for(const kind of ['ribbon','ghost']) {
    const f=fixture(true),state=clone(DEFAULT_STATE);state.effects={...DEFAULT_EFFECTS,trail:kind,speed:1,length:.6};f.effects.setState(state);
    f.effects.update(.1,{camera:f.camera});f.camera.position.x+=2;f.effects.update(.2,{camera:f.camera});
    assert.equal(f.effects.trails.history.length,1,'camera-only movement cannot emit another world-space pose');
    for(let i=0;i<15;i++){f.product.rotation.y+=.1;f.effects.update(.12,{camera:f.camera});}
    assert.ok(f.effects.trails.history.length>1);assert.ok(f.effects.trails.objects.some(object=>object.visible));
    const snapshot=f.effects.snapshot();state.effects={...state.effects,playing:false};f.effects.setState(state);f.product.position.x+=3;f.effects.update(1,{camera:f.camera});assert.deepEqual(f.effects.snapshot(),snapshot);
    f.effects.restart();assert.equal(f.effects.trails.history.length,0);f.effects.restore(snapshot);assert.deepEqual(f.effects.snapshot(),snapshot);
    state.effects={...state.effects,playing:true};f.effects.setState(state);
    for(let i=0;i<50;i++)f.effects.update(.1,{camera:f.camera});
    assert.equal(f.effects.trails.history.length,0);assert.equal(f.effects.update(.1,{camera:f.camera}),false);
    f.dispose();
  }
});

test('surface hooks retain imported texture, skin, morph and alpha shader chunks for lit and unlit models',()=>{
  for(const name of ['physical','basic']) {
    const source=THREE.ShaderLib[name],shader={vertexShader:source.vertexShader,fragmentShader:source.fragmentShader,uniforms:{}};
    patchSurfaceShader(shader,surfaceUniforms());
    for(const chunk of ['skinning_vertex','morphtarget_vertex','project_vertex'])assert.ok(shader.vertexShader.includes(`#include <${chunk}>`));
    for(const chunk of ['map_fragment','alphatest_fragment','clipping_planes_fragment','opaque_fragment'])assert.ok(shader.fragmentShader.includes(`#include <${chunk}>`));
    assert.ok(shader.fragmentShader.indexOf('float fxShade')<shader.fragmentShader.indexOf('vec3 outgoingLight'));
    assert.ok(!shader.fragmentShader.includes('texture2D(tDiffuse'),'no fullscreen effect texture');
  }
});

test('Sparkle effects are optional, preserve material state, respect reduced motion and never create heavy contact silhouettes',()=>{
  let state=clone(DEFAULT_STATE);state.effects={...DEFAULT_EFFECTS,surface:'rim',particles:'points',solid:.04,randomize:false};
  const next=randomizePresentation(state,[],{delta:100,random:()=>.7});assert.deepEqual(next.effects,state.effects);assert.deepEqual(next.materials,state.materials);
  state.effects.randomize=true;const random=randomizePresentation(state,[],{delta:100,random:()=>.7,reducedMotion:true});assert.equal(random.effects.playing,false);assert.notEqual(random.effects.surface,'none');
  const bounds=new THREE.Box3(new THREE.Vector3(-1,.025,-1),new THREE.Vector3(1,1,1));assert.equal(contactShadowPolicy(state,bounds).visible,false);
  state.effects={...DEFAULT_EFFECTS};assert.equal(contactShadowPolicy(state,bounds).visible,true);
});
