import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DEFAULT_STATE,PRESETS,CUSTOM_SCENES,applyPreset,clone,makeProject,validateProject} from '../src/state.js';
import {createEnvironmentStage} from '../src/environmentStage.js';
import {varyShot} from '../src/shotVariation.js';
import {motionSample} from '../src/motion.js';
import {StudioEngine} from '../src/engine.js';
import {videoSettings,videoType,recordCanvas} from '../src/playblast.js';

test('expanded environments, lighting, focus and motion controls survive project roundtrips',()=>{
  assert.equal(PRESETS.scene.length,6);assert.equal(PRESETS.lighting.length,12);assert.equal(PRESETS.camera.length,12);
  for(const group of ['scene','lighting','camera'])for(const preset of PRESETS[group]){
    const state=applyPreset(clone(DEFAULT_STATE),group,preset.id);
    state.scene.density=.85;state.scene.height=1.8;state.scene.weather=.7;state.scene.glitch=.6;
    Object.assign(state.camera,{targetPoint:[1,.6,-1],focusPoint:[1,.6,-1],orbitRadius:4,bokeh:.8});
    Object.assign(state.motion,{duration:8,cursor:.45,easing:'linear'});
    assert.deepEqual(validateProject(makeProject(state,{type:'demo'})).state,state);
  }
});

test('procedural sets stay bounded, seeded and independent of image assets',()=>{
  for(const preset of CUSTOM_SCENES){
    const s={...applyPreset(clone(DEFAULT_STATE),'scene',preset).scene,density:1};
    const a=createEnvironmentStage(s),b=createEnvironmentStage(s);
    assert.equal(a.group.children.length,b.group.children.length);assert.ok(a.group.children.length<90);
    let vertices=0;a.group.traverse(o=>{vertices+=o.geometry?.attributes.position.count||0;assert.ok(!o.material?.map);if(o.isInstancedMesh)assert.ok(o.count<=56);});
    assert.ok(vertices<15000,`${preset}: geometry budget`);
    assert.deepEqual(a.group.children.map(o=>o.position.toArray()),b.group.children.map(o=>o.position.toArray()));
    assert.deepEqual(a.group.children.filter(o=>o.isInstancedMesh).map(o=>Array.from(o.instanceMatrix.array)),b.group.children.filter(o=>o.isInstancedMesh).map(o=>Array.from(o.instanceMatrix.array)));
    assert.equal(a.update({...s,speed:0},10),false);
    if(preset==='rain')assert.equal(a.update({...s,speed:1,weather:0},10),false);
    for(const stage of [a,b])StudioEngine.prototype.disposeObject.call({},stage.group);
  }
});

test('shot delta creates nearby variants without changing the look or selected material',()=>{
  const state=clone(DEFAULT_STATE);state.camera.orbitRadius=9;state.camera.targetPoint=[1,0,0];
  const low=varyShot({...state,camera:{...state.camera,shotDelta:10}},()=>.75);
  const high=varyShot({...state,camera:{...state.camera,shotDelta:100}},()=>.75);
  assert.equal(high.camera.preset,state.camera.preset);assert.equal(high.camera.targetPoint,null);assert.equal(high.camera.orbitRadius,null);
  assert.ok(Math.abs(high.camera.azimuth-state.camera.azimuth)>Math.abs(low.camera.azimuth-state.camera.azimuth));
  for(const group of ['scene','lighting','materials','post','transform'])assert.deepEqual(high[group],state[group]);
  const zero={...state,camera:{...state.camera,shotDelta:0}};assert.deepEqual(varyShot(zero),zero);
});

test('explicit animation duration defines a closed cycle and a deterministic scrub position',()=>{
  for(const preset of ['turntable','orbit','dolly','idle'])for(const easing of ['linear','smooth']){
    const m={...DEFAULT_STATE.motion,preset,easing,duration:8,amplitude:preset==='idle'?6:90};
    assert.ok(Math.abs(motionSample(m,8).angle-motionSample(m,0).angle)<1e-9);
    assert.ok(Math.abs(motionSample(m,8).dolly-motionSample(m,0).dolly)<1e-9);
    assert.equal(motionSample({...m,loop:false},8).ended,true);
    assert.deepEqual(motionSample(m,8*.35),motionSample(m,2.8));
  }
  const legacy={preset:'turntable',amplitude:90,direction:1,loop:true,travel:.3};
  assert.ok(Math.abs(motionSample(legacy,4.5).angle-Math.PI/2)<1e-9);
});

function engineFixture(){
  const engine=Object.create(StudioEngine.prototype),config=clone(DEFAULT_STATE);
  let pixels=1;
  Object.assign(engine,{config,ready:true,events:{},camera:new THREE.PerspectiveCamera(35,1,.05,200),product:new THREE.Group(),modelSize:new THREE.Vector3(2,1.3,4.7),
    controls:{enabled:true,enableDamping:true,target:new THREE.Vector3(0,.7,0),update:()=>false},
    size:{width:1200,height:800},desiredPosition:new THREE.Vector3(8,3,9),desiredTarget:new THREE.Vector3(0,.7,0),
    renderer:{getPixelRatio:()=>pixels,setPixelRatio:v=>pixels=v,setSize(){},info:{reset(){}}},composer:{setPixelRatio(){},setSize(){},render(){}},
    loop:{setPaused(){}},sectionHelpers:{visible:true},monitor:{reset(){},sample:()=>null},stage:{visible:true},worldPlanes:[],motionTime:2,motionBaseAngle:0,environmentTime:3,
    motionPosition:new THREE.Vector3(8,3,9),motionTarget:new THREE.Vector3(0,.7,0),setSelected(){},reportStats(){},invalidate(){},transition:false,lastFrame:0});
  engine.camera.position.set(8,3,9);return engine;
}

test('camera transitions own the camera; OrbitControls only runs for manual input or settling',()=>{
  const before=globalThis.document;globalThis.document={hidden:false};
  try{
    const engine=engineFixture();let controlsWrites=0;engine.controls.update=()=>{controlsWrites++;return false;};
    engine.transition=true;engine.desiredPosition.set(2,3,5);engine.tick(16);assert.equal(controlsWrites,0);
    engine.transition=false;engine.config.motion={...engine.config.motion,preset:'orbit',playing:true};engine.tick(32);assert.equal(controlsWrites,0);
    engine.manual=true;engine.tick(48);assert.equal(controlsWrites,1);
  }finally{globalThis.document=before;}
});

test('unchanged workspace measurements cannot continually restart the camera',()=>{
  const engine=engineFixture();let frames=0;engine.frameCamera=()=>frames++;engine.clearOrbitInertia=()=>{};
  engine.setWorkspace({right:410,bottom:16});for(let i=0;i<20;i++)engine.setWorkspace({right:410.2,bottom:16});
  assert.equal(frames,1);engine.manual=true;engine.setWorkspace({right:0,bottom:90});assert.equal(frames,1);
});

test('manual camera commit preserves the actual radius and does not echo a new transition',()=>{
  const engine=engineFixture();let committed;engine.events.onCameraChange=c=>committed=c;
  engine.syncManualCamera();assert.equal(engine.cameraSignature(committed),engine.cameraKey);
  assert.equal(committed.orbitRadius,engine.camera.position.distanceTo(engine.controls.target));
  assert.deepEqual(engine.desiredPosition.toArray(),engine.camera.position.toArray());
});

test('playblast dimensions, duration and codecs are bounded to supported options',()=>{
  assert.deepEqual(videoSettings({size:1080,aspect:'9:16',duration:100,fps:120}),{width:1080,height:1920,duration:20,fps:30});
  assert.deepEqual(videoSettings({size:720,aspect:'1:1',duration:6,fps:24}),{width:720,height:720,duration:6,fps:24});
  assert.equal(videoType({isTypeSupported:type=>type==='video/webm;codecs=vp8'}),'video/webm;codecs=vp8');
  assert.equal(videoType({isTypeSupported:()=>false}),null);
});

test('failed video setup restores the exact camera, model pose, render size and loop',async()=>{
  const previousDoc=globalThis.document,previousRecorder=globalThis.MediaRecorder;
  globalThis.document={hidden:false};globalThis.MediaRecorder=undefined;
  try{
    const engine=engineFixture(),state=engine.config,position=engine.camera.position.clone(),quaternion=engine.camera.quaternion.clone(),size={...engine.size},calls=[];
    engine.loop.setPaused=v=>calls.push(v);engine.product.rotation.y=.4;const rotation=engine.product.quaternion.clone();
    await assert.rejects(engine.captureVideo({duration:2,size:1080,aspect:'9:16'}),/non supportata/);
    assert.equal(engine.config,state);assert.deepEqual(engine.size,size);assert.equal(engine.recording,false);assert.equal(engine.controls.enabled,true);
    assert.deepEqual(engine.camera.position.toArray(),position.toArray());assert.deepEqual(engine.camera.quaternion.toArray(),quaternion.toArray());
    assert.deepEqual(engine.product.quaternion.toArray(),rotation.toArray());assert.deepEqual(calls,[true,false]);assert.equal(engine.sectionHelpers.visible,true);
  }finally{globalThis.document=previousDoc;globalThis.MediaRecorder=previousRecorder;}
});

test('canvas recorder exports only rendered frames and releases tracks after success or cancellation',async()=>{
  const saved=Object.fromEntries(['document','MediaRecorder','requestAnimationFrame','cancelAnimationFrame'].map(key=>[key,globalThis[key]]));
  let copied=0,stopped=0,requested=0,now=performance.now(),renders=[],source={id:'only-render'};
  const track={requestFrame(){requested++;},stop(){stopped++;}},stream={getVideoTracks:()=>[track],getTracks:()=>[track]};
  const listeners=new Map();
  class Recorder {
    static isTypeSupported(type){return type==='video/webm;codecs=vp8';}
    constructor(s,options){assert.equal(s,stream);this.mimeType=options.mimeType;this.state='inactive';}
    start(){this.state='recording';}
    stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable({data:new Blob(['video-frames'])});this.onstop();});}
  }
  globalThis.MediaRecorder=Recorder;
  globalThis.document={hidden:false,createElement:tag=>{assert.equal(tag,'canvas');return{getContext:()=>({drawImage:canvas=>{assert.equal(canvas,source);copied++;}}),captureStream:()=>stream};},addEventListener:(type,cb)=>listeners.set(type,cb),removeEventListener:type=>listeners.delete(type)};
  globalThis.requestAnimationFrame=cb=>setImmediate(()=>{now+=100;cb(now);});globalThis.cancelAnimationFrame=clearImmediate;
  try{
    const video=await recordCanvas(source,time=>renders.push(time),{duration:2,fps:30,size:720,aspect:'16:9'});
    assert.equal(video.extension,'webm');assert.ok(video.blob.size>0);assert.ok(copied>10&&requested>10);assert.equal(stopped,1);assert.equal(listeners.size,0);assert.equal(renders[0],0);
    const abort=new AbortController();
    await assert.rejects(recordCanvas(source,()=>{}, {duration:2,signal:abort.signal,onProgress:()=>abort.abort()}),{name:'AbortError'});
    assert.equal(stopped,2);assert.equal(listeners.size,0);
  }finally{for(const [key,value] of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
