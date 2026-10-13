import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { clone, DEFAULT_STATE, makeProject, validateProject } from '../src/state.js';
import { effectiveSamples, postPolicy } from '../src/lookdev.js';
import { sectionPlanes, visibleIntersection, topologyOverlay } from '../src/inspection.js';
import { PerformanceMonitor } from '../src/performanceMonitor.js';
import { usesBottomDock } from '../src/workspaceLayout.js';
import { StudioEngine } from '../src/engine.js';

const v = (x,y,z) => new THREE.Vector3(x,y,z);
const bounds = new THREE.Box3(v(-2,0,-3),v(2,2,3));
const retained = (planes,point) => planes.every(p=>p.distanceToPoint(point)>=-1e-8);

test('old projects get lookdev defaults; new shader, render and section values survive save/open', () => {
  const state = clone(DEFAULT_STATE), old = makeProject(state,{type:'demo',name:'NSX'});
  for (const key of ['post','render','section','inspection']) delete old.state[key];
  assert.deepEqual(validateProject(old).state, state);
  Object.assign(state.post,{tone:'agx',contrast:1.24,vignette:.4});
  Object.assign(state.render,{msaa:8,alpha:true,fps:30,resolution:.75});
  Object.assign(state.section,{enabled:true,mode:'slab'}); state.section.z.enabled=true; state.section.y.position=.2;
  state.inspection.view='overlay';
  state.materials={'mat-1':{finish:'original',ior:1.73,transmission:.9,thickness:2,emissive:'#ffbb22',emissiveIntensity:2.1,alphaMode:'mask',alphaCutoff:.35,doubleSide:true}};
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(makeProject(state,{type:'demo',name:'NSX'})))).state,state);
});

test('invalid lookdev files cannot request unsupported samples, frame rates or non-finite shader values', () => {
  const p = makeProject(clone(DEFAULT_STATE),{type:'demo'});
  Object.assign(p.state.render,{msaa:64,fps:240,resolution:-3,adaptive:'false'});
  Object.assign(p.state.post,{tone:'arbitrary',strength:99,contrast:NaN});
  p.state.section.x={enabled:'true',position:Infinity,flip:1}; p.state.section.thickness=-5;
  p.state.materials={'mat-1':{ior:99,transmission:-1,emissive:'red',alphaMode:'custom',doubleSide:'true'}};
  const result=validateProject(p).state;
  assert.deepEqual(result.render,{...DEFAULT_STATE.render,resolution:.5});
  assert.equal(result.post.strength,.1); assert.equal(result.post.contrast,1); assert.equal(result.post.tone,'aces');
  assert.deepEqual(result.section.x,DEFAULT_STATE.section.x); assert.equal(result.section.thickness,.02);
  assert.deepEqual(result.materials['mat-1'],{finish:'original',ior:2.5,transmission:0});
});

test('MSAA uses only reported HDR sample counts and Auto scales by device/quality', () => {
  assert.equal(effectiveSamples(8,[4,2]),4); assert.equal(effectiveSamples(2,[4]),0);
  assert.equal(effectiveSamples('auto',[8,4,2]),4);
  assert.equal(effectiveSamples('auto',[8,4,2],{coarse:true}),2);
  assert.equal(effectiveSamples('auto',[8,4,2],{quality:'fluid'}),0);
  assert.equal(effectiveSamples(4,[]),0); assert.equal(effectiveSamples(0,[8,4,2]),0);
  assert.equal(effectiveSamples(4,[8,4,2],{quality:'fluid'}),4);
});

test('alpha, inspection and sections suspend incompatible passes without destroying the saved look', () => {
  const state=clone(DEFAULT_STATE), saved=clone(state.post);
  assert.deepEqual(postPolicy(state),{bloom:true,dof:true,grade:true});
  state.render.alpha=true; assert.deepEqual(postPolicy(state),{bloom:false,dof:false,grade:true});
  state.render.alpha=false; state.section.enabled=true;
  assert.deepEqual(postPolicy(state),{bloom:true,dof:false,grade:true});
  state.inspection.view='wire'; assert.deepEqual(postPolicy(state),{bloom:false,dof:false,grade:false});
  state.inspection.view='pbr'; state.section.enabled=false; state.quality='fluid';
  assert.deepEqual(postPolicy(state),{bloom:false,dof:false,grade:true});
  assert.deepEqual(state.post,saved);
  state.quality='auto'; assert.deepEqual(postPolicy(state),{bloom:true,dof:true,grade:true});
  state.post.enabled=false; assert.deepEqual(postPolicy(state),{bloom:false,dof:false,grade:false});
});

test('XYZ cuts respect model bounds, independent offsets, flips and combined intersection', () => {
  const section=clone(DEFAULT_STATE.section); section.enabled=true;
  for(const axis of ['x','y','z']) {
    for(const item of ['x','y','z']) section[item].enabled=item===axis;
    section[axis].position=.25;
    const lower=bounds.min.clone(), upper=bounds.max.clone();
    let planes=sectionPlanes(section,bounds);
    assert.ok(retained(planes,lower)); assert.ok(!retained(planes,upper));
    section[axis].flip=true; planes=sectionPlanes(section,bounds);
    assert.ok(!retained(planes,lower)); assert.ok(retained(planes,upper));
    section[axis].flip=false;
  }
  for(const axis of ['x','y','z']) section[axis]={enabled:true,position:.5,flip:false};
  const planes=sectionPlanes(section,bounds);
  assert.equal(planes.length,3); assert.ok(retained(planes,v(-1,.5,-1)));
  for(const p of [v(1,.5,-1),v(-1,1.5,-1),v(-1,.5,1)]) assert.ok(!retained(planes,p));
  section.enabled=false; assert.deepEqual(sectionPlanes(section,bounds),[]);
});

test('multisection bands keep only their shared volume; cut-away geometry cannot be picked', () => {
  const section=clone(DEFAULT_STATE.section); section.enabled=true; section.mode='slab'; section.thickness=.5;
  section.y.enabled=true; section.z.enabled=true;
  const planes=sectionPlanes(section,bounds);
  assert.equal(planes.length,6); assert.ok(retained(planes,v(0,1,0)));
  for(const p of [v(-1.1,1,0),v(1.1,1,0),v(0,.4,0),v(0,1.6,0),v(0,1,-1.6),v(0,1,1.6)]) assert.ok(!retained(planes,p));
  const hidden={point:v(1.1,1,0)}, visible={point:v(0,1,0)};
  assert.equal(visibleIntersection([hidden,visible],planes),visible);
  let sampled=0;
  assert.equal(visibleIntersection([hidden,visible,visible],planes,()=>{sampled++;return true;}),visible);
  assert.equal(sampled,1,'skip clipped surfaces and stop sampling at the first visible hit');
  assert.equal(visibleIntersection([hidden],planes),undefined);
  const matrix=new THREE.Matrix4().makeRotationY(Math.PI/2).setPosition(3,2,1);
  const transformed=planes.map(p=>p.clone().applyMatrix4(matrix));
  assert.ok(retained(transformed,visible.point.clone().applyMatrix4(matrix)));
  assert.ok(!retained(transformed,hidden.point.clone().applyMatrix4(matrix)));
});

test('wire and normal inspection restore original materials and never dispose shared geometry', () => {
  const engine=Object.create(StudioEngine.prototype), material=new THREE.MeshPhysicalMaterial(), geometry=new THREE.BoxGeometry();
  const mesh=new THREE.Mesh(geometry,material); mesh.userData.pvBaseMaterials=material;
  let geometryDisposals=0, wireDisposals=0, normalDisposals=0;
  geometry.addEventListener('dispose',()=>geometryDisposals++);
  Object.assign(engine,{config:clone(DEFAULT_STATE),meshes:[mesh],modelBounds:bounds,modelSize:v(4,2,6),product:new THREE.Group(),sectionHelpers:new THREE.Group(),localPlanes:[],worldPlanes:[]});
  engine.product.add(mesh); engine.config.inspection.view='overlay'; engine.config.section.enabled=true;
  engine.applyInspection(); const wire=mesh.userData.pvWire;
  assert.equal(wire.geometry,geometry); assert.equal(wire.material.clippingPlanes.length,1);
  wire.material.addEventListener('dispose',()=>wireDisposals++);
  engine.applyInspection(); assert.equal(mesh.userData.pvWire,wire);
  engine.config.inspection.view='normals'; engine.applyInspection();
  const normal=mesh.material; assert.ok(normal.isMeshNormalMaterial); assert.equal(wire.visible,false);
  normal.addEventListener('dispose',()=>normalDisposals++);
  engine.config.inspection.view='wire'; engine.applyInspection(); assert.equal(mesh.material,material); assert.equal(material.wireframe,true);
  engine.config.inspection.view='pbr'; engine.applyInspection(); assert.equal(material.wireframe,false);
  engine.releaseInspection(); assert.equal(mesh.material,material); assert.equal(mesh.children.length,0);
  assert.equal(wireDisposals,1); assert.equal(normalDisposals,1); assert.equal(geometryDisposals,0);
  engine.disposeObject(engine.sectionHelpers); geometry.dispose(); material.dispose();
});

test('instanced and skinned topology share the original transforms without duplicate geometry', () => {
  const geometry=new THREE.BoxGeometry(), material=new THREE.MeshBasicMaterial();
  const instance=new THREE.InstancedMesh(geometry,material,2), overlay=topologyOverlay(instance,material);
  assert.ok(overlay.isInstancedMesh); assert.equal(overlay.instanceMatrix,instance.instanceMatrix); assert.equal(overlay.geometry,geometry);
  const skin=new THREE.SkinnedMesh(geometry,material), skeleton=new THREE.Skeleton([new THREE.Bone()]); skin.bind(skeleton);
  const skinOverlay=topologyOverlay(skin,material); assert.ok(skinOverlay.isSkinnedMesh); assert.equal(skinOverlay.skeleton,skeleton);
  geometry.dispose();material.dispose();skeleton.dispose();
});

test('both composer targets reallocate when MSAA changes, and remain intact for duplicate changes', () => {
  const engine=Object.create(StudioEngine.prototype); let count=0;
  Object.assign(engine,{config:clone(DEFAULT_STATE),supportedSamples:[4,2],materials:new Map(),composer:{renderTarget1:{dispose(){count++;}},renderTarget2:{dispose(){count++;}}}});
  engine.updateSamples(); assert.equal(count,2); assert.equal(engine.composer.renderTarget2.samples,4);
  engine.updateSamples(); assert.equal(count,2);
  engine.config.render.msaa=2;engine.updateSamples();assert.equal(count,4);assert.equal(engine.composer.renderTarget1.samples,2);
});

test('adaptive resolution never reframes a manually positioned camera', () => {
  const previousWindow=globalThis.window;globalThis.window={devicePixelRatio:2};
  try {
    const engine=Object.create(StudioEngine.prototype);let frames=0;
    Object.assign(engine,{config:clone(DEFAULT_STATE),size:{width:1200,height:800},resolutionKey:'existing',canvas:{parentElement:{getBoundingClientRect:()=>({width:1200,height:800})}},monitor:{scale:.7},renderer:{setPixelRatio(){},setSize(){},shadowMap:{}},composer:{setPixelRatio(){},setSize(){}},updateSamples(){},frameCamera(){frames++;},invalidate(){},reportStats(){},transition:false});
    engine.resize();assert.equal(frames,0);assert.equal(engine.transition,false);
    engine.canvas.parentElement.getBoundingClientRect=()=>({width:800,height:1200}); engine.resize();assert.equal(frames,1);assert.equal(engine.transition,true);
  } finally { if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow; }
});

test('PNG capture hides guides only for the snapshot and restores them even if rendering fails', async () => {
  const engine=Object.create(StudioEngine.prototype), blob=new Blob(['png']);let invalidations=0;
  Object.assign(engine,{renderer:{},ready:true,sectionHelpers:{visible:true},composer:{render(){assert.equal(engine.sectionHelpers.visible,false);}},canvas:{toBlob(fn){assert.equal(engine.sectionHelpers.visible,false);fn(blob);}},invalidate(){invalidations++;}});
  assert.equal(await engine.capture(),blob);assert.equal(engine.sectionHelpers.visible,true);assert.equal(invalidations,1);
  engine.composer.render=()=>{throw new Error('GPU lost');};await assert.rejects(engine.capture(),/GPU lost/);assert.equal(engine.sectionHelpers.visible,true);assert.equal(invalidations,2);
});

test('adaptive delivery monitor degrades, recovers gradually, stays bounded and excludes idle gaps', () => {
  const monitor=new PerformanceMonitor();let time=0,report;
  for(let i=0;i<600;i++){time+=50;report=monitor.sample(time,60,true)||report;}
  assert.ok(monitor.scale>=.6&&monitor.scale<.7);assert.equal(report.fps,20);
  for(let i=0;i<5000;i++){time+=1000/60;monitor.sample(time,60,true);}
  assert.equal(monitor.scale,1);
  monitor.reset();assert.equal(monitor.sample(time+60000,60,true),null);assert.equal(monitor.frames.length,0);
  const capped=new PerformanceMonitor();for(let i=0;i<300;i++)capped.sample(i*1000/30,30,true);assert.equal(capped.scale,1);
  const manual=new PerformanceMonitor();for(let i=0;i<200;i++)manual.sample(i*50,60,false);assert.equal(manual.scale,1);
});

test('portrait tablets use the lower dock while desktop and landscape phones keep the side column', () => {
  for(const [w,h,dock] of [[1079,1834,true],[499,792,true],[390,844,true],[1363,937,false],[844,390,false],[320,568,true]]) assert.equal(usesBottomDock(w,h),dock,`${w}x${h}`);
});
