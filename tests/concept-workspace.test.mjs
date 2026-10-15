import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONCEPT_STAGES } from '../src/stageCatalog.js';
import { createConceptStage } from '../src/conceptStages.js';
import { DEFAULT_STATE, clone, applyPreset, makeProject, validateProject } from '../src/state.js';
import { randomizePresentation } from '../src/presentation.js';
import { ModelAnimation } from '../src/modelAnimation.js';
import { INITIAL_MENU, workspaceMenu, restoreWorkspaceMenu, persistWorkspaceMenu } from '../src/workspaceMenu.js';

test('twenty complete concepts preserve old presets, camera and authored materials',()=>{
  assert.equal(new Set(CONCEPT_STAGES.map(s=>s.id)).size,20);
  for(const family of ['clean','elaborate'])assert.equal(CONCEPT_STAGES.filter(s=>s.family===family).length,10);
  for(const stage of CONCEPT_STAGES){
    const state=applyPreset(clone(DEFAULT_STATE),'scene',stage.id);
    assert.equal(state.scene.preset,stage.id);assert.deepEqual(state.lighting,DEFAULT_STATE.lighting);
    assert.deepEqual(state.camera,DEFAULT_STATE.camera);assert.deepEqual(state.materials,DEFAULT_STATE.materials);
    assert.deepEqual(validateProject(makeProject(state,{type:'demo'})).state,state);
  }
});

function dispose(stage){const resources=new Set();stage.group.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});resources.forEach(r=>r.dispose());}
test('every concept stays within a small draw/triangle budget at maximum density on mobile and desktop',()=>{
  for(const spec of CONCEPT_STAGES)for(const coarse of [false,true]){
    const state={...DEFAULT_STATE.scene,...spec.theme,preset:spec.id,density:1};
    const stage=createConceptStage(state,coarse);let draws=0,triangles=0;
    stage.group.traverse(o=>{if(!o.geometry)return;draws++;if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);assert.ok(!o.material.map);assert.ok(!o.isLight);});
    assert.ok(draws<=12,`${spec.id}: ${draws} draw calls`);assert.ok(triangles<6000,`${spec.id}: ${triangles} triangles`);
    assert.equal(stage.update({...state,speed:0},50),false);
    if(spec.effect==='rain')assert.equal(stage.update({...state,speed:1,weather:0},50),false);
    if(!spec.effect)assert.equal(stage.update({...state,speed:1},50),false);
    if(stage.reflectionSpan)assert.ok(stage.reflectionSpan/2*Math.SQRT2<4.3,'island reflector stays inside the platform');
    dispose(stage);
  }
});

test('solid stage modules keep the central product volume clear at all supported proportions',()=>{
  const occupied=new THREE.Box3(new THREE.Vector3(-2.7,.05,-2.7),new THREE.Vector3(2.7,4.7,2.7));
  const transform=new THREE.Matrix4(),bounds=new THREE.Box3();
  for(const spec of CONCEPT_STAGES)for(const scale of [.55,1.5]){
    const stage=createConceptStage({...DEFAULT_STATE.scene,...spec.theme,preset:spec.id,density:1,scale,height:2,spread:.6});
    stage.group.updateMatrixWorld(true);
    stage.group.traverse(o=>{if(!o.isMesh||o.material.transparent)return;o.geometry.computeBoundingBox();
      for(let i=0;i<(o.isInstancedMesh?o.count:1);i++){
        if(o.isInstancedMesh){o.getMatrixAt(i,transform);transform.premultiply(o.matrixWorld);}else transform.copy(o.matrixWorld);
        bounds.copy(o.geometry.boundingBox).applyMatrix4(transform);
        assert.equal(bounds.intersectsBox(occupied),false,`${spec.id}: product corridor intersects ${o.name||o.geometry.type}`);
      }
    });dispose(stage);
  }
});

test('Sparkle includes all twenty concepts, preserves native animation, and pauses effects for reduced motion',()=>{
  let seed=37;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
  let state=clone(DEFAULT_STATE);state.animation={clip:2,playing:true,cursor:.4,loop:false,speed:.8};
  const seen=new Set();for(let i=0;i<700;i++){const before=state;state=randomizePresentation(state,[],{random,reducedMotion:true});seen.add(state.scene.preset);assert.notEqual(state.scene.preset,before.scene.preset);assert.deepEqual(state.animation,before.animation);assert.equal(state.scene.speed,0);assert.equal(state.motion.playing,false);}
  for(const stage of CONCEPT_STAGES)assert.ok(seen.has(stage.id),`${stage.name} is reachable from Sparkle`);
});

function player(){
  const root=new THREE.Group(),node=new THREE.Object3D();node.name='Product';root.add(node);
  const move=new THREE.AnimationClip('Move',2,[new THREE.NumberKeyframeTrack('Product.position[x]',[0,2],[0,2])]);
  const lift=new THREE.AnimationClip('Lift',4,[new THREE.NumberKeyframeTrack('Product.position[y]',[0,4],[0,4])]);
  const animation=new ModelAnimation(root,[move,lift]);animation.setState(DEFAULT_STATE.animation);return {animation,node,root};
}
test('native GLB clips play, pause without rewinding, scrub, switch clips, loop and finish exactly once',()=>{
  const {animation:a,node}=player();
  assert.deepEqual(a.metadata.map(c=>c.duration),[2,4]);
  a.setState({...DEFAULT_STATE.animation,playing:true,speed:2});a.update(.5);assert.equal(node.position.x,1);
  a.setState({...DEFAULT_STATE.animation,playing:false,speed:2});assert.equal(a.update(1).moving,false);assert.equal(node.position.x,1);
  a.setState({...DEFAULT_STATE.animation,cursor:.75});assert.equal(node.position.x,1.5);
  a.setState({...DEFAULT_STATE.animation,clip:1,cursor:.25});assert.equal(node.position.x,0);assert.equal(node.position.y,1);
  a.setState({...DEFAULT_STATE.animation,clip:1,cursor:.25,playing:true});a.update(4);assert.equal(node.position.y,1);
  a.setState({...DEFAULT_STATE.animation,clip:1,cursor:.25,playing:true,loop:false});assert.equal(a.update(3).ended,true);assert.equal(node.position.y,4);assert.equal(a.update(.5).ended,false);
  a.setState({...DEFAULT_STATE.animation,clip:1,playing:false,cursor:1});a.setState({...DEFAULT_STATE.animation,clip:1,playing:true,cursor:1});assert.equal(node.position.y,0);
  a.dispose();assert.equal(node.position.y,0);
});

test('normalization survives animated root transforms and playblast samples without accumulated drift',()=>{
  const root=new THREE.Group(),wrapper=new THREE.Group();wrapper.scale.setScalar(.1);wrapper.add(root);
  const clip=new THREE.AnimationClip('Scale',2,[new THREE.VectorKeyframeTrack('.scale',[0,2],[1,1,1,3,3,3])]);
  const a=new ModelAnimation(root,[clip]);a.setState({...DEFAULT_STATE.animation,playing:true});
  for(const second of [0,.1,.8,1.9])a.sample(second,false);
  wrapper.updateMatrixWorld(true);assert.ok(Math.abs(root.getWorldScale(new THREE.Vector3()).x-.29)<1e-6);assert.equal(wrapper.scale.x,.1);
  a.sample(.8,false);assert.ok(Math.abs(root.scale.x-1.8)<1e-6);a.dispose();
});

test('old projects default native clips to paused and malformed clip controls are bounded',()=>{
  const project=makeProject(clone(DEFAULT_STATE),{type:'demo'});delete project.state.animation;
  assert.deepEqual(validateProject(project).state.animation,DEFAULT_STATE.animation);
  project.state.animation={clip:-9,cursor:Infinity,speed:100,playing:'yes',loop:false};
  assert.deepEqual(validateProject(project).state.animation,{clip:0,cursor:0,speed:3,playing:false,loop:false});
  const empty=new ModelAnimation(new THREE.Group());empty.setState({playing:true});assert.equal(empty.update(.5).moving,false);empty.dispose();
});

test('one persistent selection owns the workspace; repeated clicks and dismissals cannot collapse it',()=>{
  let menu=INITIAL_MENU;
  menu=workspaceMenu(menu,{type:'toggle',id:'project'});assert.equal(menu.open,'project');assert.equal(menu.category,'product');
  assert.equal(workspaceMenu(menu,{type:'toggle',id:'project'}),menu);
  menu=workspaceMenu(menu,{type:'open',id:'scene'});assert.deepEqual(menu,{category:'scene',open:'scene'});
  menu=workspaceMenu(menu,{type:'toggle',id:'inspect'});assert.equal(menu.open,'inspect');
  menu=workspaceMenu(menu,{type:'close'});assert.deepEqual(menu,{category:'scene',open:'inspect'});
  menu=workspaceMenu(menu,{type:'toggle',id:'scene'});assert.equal(menu.open,'scene');
  assert.equal(workspaceMenu(menu,{type:'toggle',id:'scene'}),menu);
  assert.equal(workspaceMenu(menu,{type:'open',id:'invalid'}),menu);
  for(const id of ['product','scene','lighting','camera','motion','model','inspect','project','render','export','post']){
    menu=workspaceMenu(menu,{type:'open',id});
    assert.equal(menu.open,id==='post'?'motion':id);
    for(const type of ['toggle','close','hide','escape','outside','unknown'])assert.equal(workspaceMenu(menu,{type,id}),menu);
  }
});

test('the last workspace survives a reload and unavailable or malformed storage falls back safely',()=>{
  let saved;const storage={getItem:()=>saved,setItem:(_key,value)=>{saved=value;}};
  assert.deepEqual(restoreWorkspaceMenu(storage),INITIAL_MENU);
  for(const menu of [{category:'motion',open:'motion'},{category:'camera',open:'render'},{category:'scene',open:'model'},{category:'motion',open:'export'},{category:'lighting',open:'post'}]){
    persistWorkspaceMenu(menu,storage);assert.deepEqual(restoreWorkspaceMenu(storage),menu.open==='post'?{category:'motion',open:'motion'}:menu);
  }
  for(const value of ['broken','null','{}','{"category":"scene","open":null}','{"category":"bad","open":"product"}']){
    saved=value;assert.deepEqual(restoreWorkspaceMenu(storage),INITIAL_MENU);
  }
  saved='{"category":"scene","open":"camera"}';assert.deepEqual(restoreWorkspaceMenu(storage),{category:'camera',open:'camera'});
  const blocked={getItem(){throw Error('unavailable');},setItem(){throw Error('unavailable');}};
  assert.deepEqual(restoreWorkspaceMenu(blocked),INITIAL_MENU);assert.doesNotThrow(()=>persistWorkspaceMenu(INITIAL_MENU,blocked));
});
