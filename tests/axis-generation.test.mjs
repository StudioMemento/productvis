import test from 'node:test';
import * as THREE from 'three';
import {StudioEngine} from '../src/engine.js';
import assert from 'node:assert/strict';
import {AXES,defaultAxes,validateAxes,generationAmounts} from '../src/axisState.js';
import {generateAxes,canGenerateMaterial} from '../src/axisGeneration.js';
import {DEFAULT_STATE,LIGHT_RIGS,clone,makeProject,validateProject,applyPreset} from '../src/state.js';
import {CONCEPT_STAGES} from '../src/stageCatalog.js';

const surface={finish:'satin',color:'#424752',overlay:.7,roughness:.32,metalness:.65,clearcoat:.25,normalScale:.8,opacity:1,uvChannel:1,alphaMode:'opaque',sideMode:'double',transmission:0};
const metadata=[{id:'mat-7',rawName:'body_paint',lit:true,physical:true,original:{...surface}},{id:'mat-8',rawName:'glass',lit:true,physical:true,original:{...surface,opacity:.4}}];
const setup=()=>({...clone(DEFAULT_STATE),selectedMaterial:'mat-7',materials:{'mat-7':{...surface},'mat-8':{...surface,opacity:.4}},randomDelta:100});
const rng=(seed=91)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
const roundtrip=state=>validateProject(JSON.parse(JSON.stringify(makeProject(state,{type:'demo'})))).state;

test('each individual axis changes only its owned values, without mutating history',()=>{
  for(const axis of AXES)for(const delta of [1,35,55,70,100])for(const sample of [0,.23,.5,1-Number.EPSILON]){
    const state=setup();state.axes[axis.id].delta=delta;const before=clone(state);
    const next=generateAxes(state,metadata,{axis:axis.id,random:()=>sample});
    assert.notEqual(next,state,`${axis.id} at ${delta}`);
    for(const key of Object.keys(state))if(!axis.fields.includes(key))assert.equal(next[key],state[key],`${axis.id} must preserve ${key}`);
    assert.deepEqual(state,before);
    assert.deepEqual(roundtrip(next),next);
  }
});

test('all 32 global lock combinations preserve protected axes, native clips and technical state exactly',()=>{
  for(let mask=0;mask<32;mask++){
    const state=setup();state.render.alpha=true;state.inspection.view='normals';state.section.enabled=true;
    Object.assign(state.animation,{playing:true,cursor:.63});state.transform.positionX=4;
    for(const [i,axis] of AXES.entries())state.axes[axis.id].locked=!!(mask&(1<<i));
    const before=clone(state),next=generateAxes(state,metadata,{random:rng(mask),reducedMotion:true});
    for(const axis of AXES)for(const key of axis.fields){
      if(state.axes[axis.id].locked)assert.equal(next[key],state[key],`${mask}: ${key}`);
      else assert.notDeepEqual(next[key],state[key],`${mask}: ${key} varies`);
    }
    for(const key of ['name','quality','selectedMaterial','axes','animation','transform','render','inspection','section'])assert.equal(next[key],state[key],key);
    assert.deepEqual(state,before);if(mask===31)assert.equal(next,state);
  }
});

test('global delta scales local deltas; local variation is independent of the master and blocked states are true no-ops',()=>{
  const state=setup();state.randomDelta=40;state.axes.env.delta=25;state.axes.fx.delta=0;state.axes.light.locked=true;
  assert.deepEqual(generationAmounts(state),{mat:.4,env:.1,light:0,cam:.4,fx:0});
  assert.equal(generationAmounts(state,'env').env,.25);
  assert.equal(generateAxes(state,metadata,{delta:0}),state);
  for(const axis of ['fx','light','unknown'])assert.equal(generateAxes(state,metadata,{axis}),state);
  state.randomDelta=0;assert.notEqual(generateAxes(state,metadata,{axis:'env',random:rng()}),state);
  for(const setting of Object.values(state.axes))setting.delta=0;
  assert.equal(generateAxes(state,metadata,{delta:100}),state);
});

test('axis settings roundtrip and migrate old FX opt-out without weakening explicit new settings',()=>{
  const state=setup();state.axes.mat={delta:27,locked:true};state.axes.cam={delta:0,locked:false};
  assert.deepEqual(roundtrip(state),state);
  delete state.axes;state.effects.randomize=false;
  assert.deepEqual(roundtrip(state).axes,{...defaultAxes(),fx:{delta:100,locked:true}});
  state.axes=defaultAxes();assert.equal(roundtrip(state).axes.fx.locked,false);
  assert.deepEqual(validateAxes({mat:{delta:-2,locked:'yes'},env:{delta:150,locked:true},cam:{delta:24.7},fx:{delta:NaN}}),{mat:{delta:0,locked:false},env:{delta:100,locked:true},light:{delta:100,locked:false},cam:{delta:25,locked:false},fx:{delta:100,locked:false}});
  const locked=setup();locked.axes.mat.locked=true;
  assert.notDeepEqual(applyPreset(locked,'product','metal',surface).materials,locked.materials,'locks protect generation, not manual editing');
});

test('low delta refines a setup, preserves manual targets and approaches extreme lenses gradually',()=>{
  for(const focal of [18,50,150]){
    const state=setup();state.randomDelta=1;Object.assign(state.camera,{focal,targetPoint:[1,2,3],focusPoint:[2,3,4],orbitRadius:7});
    const next=generateAxes(state,metadata,{random:rng()});
    for(const group of ['scene','lighting','camera','motion'])assert.equal(next[group].preset,state[group].preset);
    assert.equal(next.materials['mat-7'].finish,state.materials['mat-7'].finish);
    assert.deepEqual(next.camera.targetPoint,state.camera.targetPoint);assert.deepEqual(next.camera.focusPoint,state.camera.focusPoint);
    assert.ok(Math.abs(next.camera.focal-focal)<=.43);assert.ok(Math.abs(next.camera.orbitRadius-7)<.01);
    assert.ok(next.effects.intensity<=.007,'a newly enabled effect fades in with delta');
  }
});

test('global high-delta exploration reaches every concept with bounded, project-valid values',()=>{
  let state=setup();const random=rng(12),scenes=new Set();
  for(let i=0;i<500;i++){
    const next=generateAxes(state,metadata,{random});
    assert.notEqual(next.scene.preset,state.scene.preset);scenes.add(next.scene.preset);
    assert.ok(next.post.strength<=.1);assert.equal(next.post.dof,state.post.dof);assert.equal(next.post.enabled,state.post.enabled);
    assert.ok(next.camera.focal>=24&&next.camera.focal<=120);
    assert.ok(next.effects.density<=.5);assert.deepEqual(roundtrip(next),next);
    assert.equal(next.materials['mat-8'],state.materials['mat-8']);
    for(const key of ['uvChannel','normalScale','opacity','transmission','alphaMode','sideMode'])assert.equal(next.materials['mat-7'][key],surface[key]);
    state=next;
  }
  for(const stage of CONCEPT_STAGES)assert.ok(scenes.has(stage.id),stage.id);
});

test('studio light generation keeps authored rig ratios and never adjusts camera exposure',()=>{
  const state=setup();const random=rng(30);
  for(let i=0;i<100;i++){
    const next=generateAxes(state,metadata,{axis:'light',random}),rig=LIGHT_RIGS[next.lighting.preset];
    assert.ok(Math.abs(next.lighting.key/next.lighting.fill-rig.key/rig.fill)<.0002);
    assert.ok(Math.abs(next.lighting.rim/next.lighting.fill-rig.rim/rig.fill)<.0002);
    assert.equal(next.camera,state.camera);
  }
});

test('MAT preserves transparent, unlit and unknown surfaces and never invents a material',()=>{
  for(const patch of [{rawName:'windows'},{rawName:'headlamp'},{lit:false},{original:{...surface,opacity:.5}},{original:{...surface,transmission:.9}}]){
    const state=setup(),meta=[{...metadata[0],...patch}];
    assert.equal(canGenerateMaterial(state,meta),false);
    assert.equal(generateAxes(state,meta,{axis:'mat'}),state);
  }
  for(const patch of [{opacity:.5},{transmission:.5}]){
    const state=setup();Object.assign(state.materials['mat-7'],patch);
    assert.equal(generateAxes(state,metadata,{axis:'mat'}),state);
  }
  assert.equal(generateAxes(DEFAULT_STATE,[],{axis:'mat'}),DEFAULT_STATE);
  const state=setup();assert.equal(generateAxes(state,[],{axis:'mat'}),state);
});

test('independent random streams keep unrelated axes stable when a material axis is excluded',()=>{
  const state=setup(),blocked=clone(state);blocked.axes.mat.locked=true;
  const first=generateAxes(state,metadata,{random:rng(1)}),second=generateAxes(blocked,metadata,{random:rng(1)});
  for(const key of ['scene','lighting','camera','motion','effects','post'])assert.deepEqual(first[key],second[key]);
  assert.equal(second.materials,blocked.materials);
});

test('reduced motion affects only generated axes; locked clocks and native animations are untouched',()=>{
  const state=setup();Object.assign(state.motion,{preset:'orbit',playing:true});state.animation.playing=true;
  const next=generateAxes(state,metadata,{random:rng(),reducedMotion:true});
  assert.equal(next.scene.speed,0);assert.equal(next.motion.playing,false);assert.equal(next.effects.playing,false);assert.equal(next.animation,state.animation);
  for(const axis of ['env','cam','fx'])state.axes[axis].locked=true;
  const protectedState=generateAxes(state,metadata,{random:rng(),reducedMotion:true});
  for(const key of ['scene','camera','motion','effects','animation'])assert.equal(protectedState[key],state[key]);
});


test('engine application of ENV, MAT, LIGHT or FX preserves the live camera, motion clock and trail history',()=>{
  for(const axis of ['env','mat','light','fx']){
    const state=setup();Object.assign(state.motion,{preset:'orbit',playing:true});
    let frames=0,clears=0,trailClears=0;
    const engine=Object.assign(Object.create(StudioEngine.prototype),{
      config:state,sceneKey:JSON.stringify([state.scene.preset,state.scene.composition,state.scene.scale,state.scene.seed,state.scene.density,state.scene.height,state.scene.spread]),
      scene:new THREE.Scene(),backgroundColor:new THREE.Color(),sceneFog:new THREE.FogExp2(),stage:new THREE.Group(),floor:{visible:true},floorMaterial:new THREE.MeshStandardMaterial(),ringLamp:new THREE.PointLight(),
      materials:new Map(),product:new THREE.Group(),camera:new THREE.PerspectiveCamera(),target:new THREE.Vector3(),
      desiredPosition:new THREE.Vector3(8,4,9),desiredTarget:new THREE.Vector3(0,.65,0),controls:{target:new THREE.Vector3(),update:()=>false},
      motionTime:7.4,motionBaseAngle:.3,motionPosition:new THREE.Vector3(8,4,9),motionTarget:new THREE.Vector3(0,.65,0),transition:false,
      renderer:{setClearColor(){}},worldPlanes:[],effects:{setState(){},trails:{clear(){trailClears++;}}},
      frameCamera(){frames++;},clearOrbitInertia(){clears++;},resize(){},applyLights(){},buildStage(){},applyPost(){},applyInspection(){},setSelected(){},invalidate(){}
    });
    engine.camera.position.set(8,4,9);engine.product.rotation.y=.6;
    engine.cameraKey=engine.cameraSignature(state.camera);
    try{
      const next=generateAxes(state,metadata,{axis,random:rng()});engine.setState(next);
      assert.equal(frames,0,axis);assert.equal(clears,0,axis);assert.equal(trailClears,0,axis);
      assert.equal(engine.transition,false);assert.equal(engine.motionTime,7.4);assert.equal(engine.motionBaseAngle,.3);
      assert.equal(engine.product.rotation.y,.6);assert.deepEqual(engine.camera.position.toArray(),[8,4,9]);
    }finally{engine.floorMaterial.dispose();}
  }
});

test('restoring the same CAM on different stages computes an identical frame',()=>{
  const state=setup(),engine=Object.assign(Object.create(StudioEngine.prototype),{config:state,modelSize:new THREE.Vector3(2,1.3,4.7),size:{width:390,height:844},workspaceInsets:{right:0,bottom:336},camera:new THREE.PerspectiveCamera(),desiredPosition:new THREE.Vector3(),desiredTarget:new THREE.Vector3()});
  engine.frameCamera(state.camera);const position=engine.desiredPosition.toArray(),target=engine.desiredTarget.toArray();
  for(const preset of ['void','studio',...CONCEPT_STAGES.map(stage=>stage.id)]){
    engine.config={...state,scene:{...state.scene,preset}};engine.frameCamera(state.camera);
    assert.deepEqual(engine.desiredPosition.toArray(),position,preset);assert.deepEqual(engine.desiredTarget.toArray(),target,preset);
  }
});
