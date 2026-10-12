import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DEFAULT_TRANSFORM, validateTransform } from '../src/modelTransform.js';
import { applyModelTransform, worldBounds, placementAction, keepModelHeight } from '../src/modelPlacement.js';
import { DEFAULT_STATE, TABS, clone, makeProject, validateProject } from '../src/state.js';
import { randomizePresentation } from '../src/presentation.js';
import { boundedIndex, pageIndex, scrubIndex } from '../src/navigation.js';
import { StudioEngine } from '../src/engine.js';
import { contactShadowPolicy, ContactShadow } from '../src/contactShadow.js';

const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function fixture() {
  const scene=new THREE.Scene(),placement=new THREE.Group(),product=new THREE.Group();
  const model=new THREE.Mesh(new THREE.BoxGeometry(2,1,4),new THREE.MeshBasicMaterial());
  model.position.set(.3,.525,-.2);scene.add(placement);placement.add(product);product.add(model);
  return {scene,placement,product,model,dispose(){model.geometry.dispose();model.material.dispose();}};
}

test('model transforms roundtrip, default for older projects, clamp invalid values and survive randomization',()=>{
  const state=clone(DEFAULT_STATE);state.transform={x:1.23,y:.8,z:-2,rx:35,ry:-165,rz:12,scale:1.7};
  const file=makeProject(state,{type:'embedded',name:'Test',data:'data:model/gltf-binary;base64,Z2xURg=='});
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(file))).state,state);
  assert.deepEqual(randomizePresentation(state,[],{delta:100,random:()=>.5}).transform,state.transform);
  delete file.state.transform;assert.deepEqual(validateProject(file).state.transform,DEFAULT_TRANSFORM);
  assert.deepEqual(validateTransform({x:Infinity,y:99,z:-99,rx:999,ry:-999,rz:'5',scale:0}),{x:0,y:10,z:-10,rx:180,ry:-180,rz:0,scale:.1});
});

test('placement is separate from animation and centering/grounding use rotated, scaled world bounds',()=>{
  const f=fixture(),t={...DEFAULT_TRANSFORM,x:1.8,y:1.2,z:-1,rx:28,ry:75,rz:-15,scale:1.6};
  const geometry=f.model.geometry.attributes.position.array.slice();
  applyModelTransform(f.placement,t);f.product.rotation.y=.6;
  const centered=placementAction(t,worldBounds(f.model),'center');
  applyModelTransform(f.placement,centered);
  let bounds=worldBounds(f.model);close(bounds.getCenter(v()).x,0);close(bounds.getCenter(v()).z,0);
  const grounded=placementAction(centered,bounds,'ground',.018);
  applyModelTransform(f.placement,grounded);bounds=worldBounds(f.model);close(bounds.min.y,.043);
  assert.equal(grounded.rx,t.rx);assert.equal(grounded.scale,t.scale);assert.equal(f.product.rotation.y,.6);
  assert.deepEqual(f.model.geometry.attributes.position.array,geometry);
  applyModelTransform(f.placement,DEFAULT_TRANSFORM);f.product.rotation.set(0,0,0);
  close(worldBounds(f.model).min.y,.025);f.dispose();
});

test('animated rotations retain the chosen world-space support height under a tilted scaled parent',()=>{
  const f=fixture();applyModelTransform(f.placement,{...DEFAULT_TRANSFORM,x:2,y:3,z:-1,rx:24,rz:18,scale:1.8});
  const height=worldBounds(f.model).min.y;
  for(const axis of ['x','y','z'])for(const angle of [.2,.7,1.5,2.7]) {
    f.product.rotation[axis]=angle;keepModelHeight(f.product,f.model,height);close(worldBounds(f.model).min.y,height);
  }
  f.dispose();
});

test('framing includes the placed model and scales the camera distance with its real bounds',()=>{
  const f=fixture(),state=clone(DEFAULT_STATE);state.scene.preset='studio';
  const engine=Object.assign(Object.create(StudioEngine.prototype),{config:state,model:f.model,modelSize:v(2,1,4),size:{width:1200,height:800},camera:new THREE.PerspectiveCamera(35,1,.05,200),desiredPosition:v(),desiredTarget:v()});
  engine.frameCamera(state.camera);const distance=engine.desiredPosition.distanceTo(engine.desiredTarget);
  applyModelTransform(f.placement,{...DEFAULT_TRANSFORM,x:2,y:1,z:-3,scale:2});engine.frameCamera(state.camera);
  const center=worldBounds(f.model).getCenter(v());
  close(engine.desiredTarget.x,center.x);close(engine.desiredTarget.z,center.z);close(engine.desiredTarget.y,center.y+.015);
  close(engine.desiredPosition.distanceTo(engine.desiredTarget),distance*2);f.dispose();
});

test('a translated product cannot leave a contact shadow beyond the cube support',()=>{
  const f=fixture(),state=clone(DEFAULT_STATE),shadow=new ContactShadow(f.scene);
  applyModelTransform(f.placement,{...DEFAULT_TRANSFORM,x:8});assert.equal(contactShadowPolicy(state,worldBounds(f.model)).visible,false);
  assert.ok(shadow.plinthPlanes.every(plane=>plane.distanceToPoint(v())>0));
  for(const point of [v(4,0,0),v(-4,0,0),v(0,0,4),v(0,0,-4)])assert.ok(shadow.plinthPlanes.some(plane=>plane.distanceToPoint(point)<0));
  shadow.dispose();f.dispose();
});

test('all dedicated tabs including the final gear are reachable by scroll and scrubbing',()=>{
  assert.equal(TABS.length,9);assert.equal(TABS.at(-1),'project');
  for(const tab of ['post','inspect','render'])assert.ok(TABS.includes(tab));
  for(let i=0;i<TABS.length;i++)assert.equal(pageIndex(i*390,390,TABS.length),i);
  assert.equal(scrubIndex(0,-900,TABS.length),8);assert.equal(boundedIndex(9,TABS.length),8);
});
