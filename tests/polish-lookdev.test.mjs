import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DEFAULT_STATE, clone, makeProject, validateProject, applyPreset } from '../src/state.js';
import { bloomStrength, POST_LOOKS } from '../src/lookdev.js';
import { randomizePresentation } from '../src/presentation.js';
import { motionSample } from '../src/motion.js';
import { StudioEngine } from '../src/engine.js';

test('bloom is limited to 0.2 unless explicitly unlocked, with a hard ceiling of 1 and safe legacy projects',()=>{
  for(const look of POST_LOOKS){assert.ok(look.values.strength<=.2);assert.equal(look.values.bloomOverride,false);}
  for(const [override,input,expected] of [[false,1,.2],[true,.7,.7],[true,5,1],[false,-1,0]]) {
    const state=clone(DEFAULT_STATE);Object.assign(state.post,{bloomOverride:override,strength:input});
    assert.equal(bloomStrength(state.post),expected);
    assert.equal(validateProject(makeProject(state,{type:'demo'})).state.post.strength,expected);
  }
  const legacy=makeProject(clone(DEFAULT_STATE),{type:'demo'});delete legacy.state.post.bloomOverride;legacy.state.post.strength=.8;
  assert.equal(validateProject(legacy).state.post.strength,.2);
  const saved=clone(DEFAULT_STATE);Object.assign(saved.post,{bloomOverride:true,strength:.73});
  assert.deepEqual(validateProject(makeProject(saved,{type:'demo'})).state,saved);
});

test('random includes product animation, camera motion and idle; resets manual bloom and respects reduced motion',()=>{
  let state=clone(DEFAULT_STATE),seed=42;const seen=new Set();
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let i=0;i<100;i++) {
    Object.assign(state.post,{bloomOverride:true,strength:1});
    const next=randomizePresentation(state,[],{delta:100,random});
    assert.notEqual(next.motion.preset,state.motion.preset);assert.equal(next.motion.playing,true);assert.equal(next.motion.axis,'y');
    assert.equal(next.post.bloomOverride,false);assert.ok(next.post.strength<=.2);
    if(next.camera.preset==='macro')assert.ok(['idle','dolly'].includes(next.motion.preset));
    seen.add(next.motion.preset);state=next;
  }
  assert.deepEqual([...seen].sort(),['dolly','idle','orbit','turntable']);
  const low=randomizePresentation(state,[],{delta:1,random:()=>.4}),high=randomizePresentation(state,[],{delta:100,random:()=>.4});
  assert.equal(low.motion.preset,high.motion.preset);assert.ok(high.motion.speed>low.motion.speed);assert.ok(high.motion.amplitude>low.motion.amplitude);
  const reduced=randomizePresentation(state,[],{delta:100,random:()=>.4,reducedMotion:true});
  assert.notEqual(reduced.scene.preset,state.scene.preset);assert.equal(reduced.motion.playing,false);
});

test('idle breathes smoothly within a small angle and distance, can pause and loops without a discontinuity',()=>{
  const state=applyPreset(clone(DEFAULT_STATE),'motion','idle'),motion=state.motion;
  assert.equal(motion.playing,true);assert.equal(motion.amplitude,6);
  for(let t=0;t<36;t+=.1) {
    const sample=motionSample(motion,t);assert.ok(Math.abs(sample.angle)<=3*Math.PI/180+1e-9);assert.ok(sample.dolly>=.976&&sample.dolly<=1);assert.equal(sample.ended,false);
  }
  const start=motionSample(motion,0),end=motionSample(motion,12);
  assert.ok(Math.abs(start.angle-end.angle)<1e-9);assert.equal(start.dolly,end.dolly);
  assert.equal(motionSample({...motion,loop:false},12).ended,true);
  assert.deepEqual(validateProject(makeProject(state,{type:'demo'})).state,state);
  assert.equal(applyPreset(state,'camera','front').motion.playing,false);
});

test('a randomized camera transition completes before its new animation starts',()=>{
  const previousDocument=globalThis.document;globalThis.document={hidden:false};
  const engine=Object.create(StudioEngine.prototype),state=clone(DEFAULT_STATE);
  Object.assign(engine,{config:state,ready:true,sceneKey:JSON.stringify([state.scene.preset,state.scene.composition,state.scene.scale,state.scene.seed]),
    scene:new THREE.Scene(),backgroundColor:new THREE.Color(),sceneFog:new THREE.FogExp2(),stage:new THREE.Group(),floor:{visible:true},floorMaterial:new THREE.MeshStandardMaterial(),ringLamp:new THREE.PointLight(),
    materials:new Map(),product:new THREE.Group(),modelSize:new THREE.Vector3(2,1.3,4.7),camera:new THREE.PerspectiveCamera(35,1,.05,200),size:{width:1400,height:900},
    desiredPosition:new THREE.Vector3(8,4,9),desiredTarget:new THREE.Vector3(0,.65,0),target:new THREE.Vector3(),controls:{target:new THREE.Vector3(),update:()=>false},
    renderer:{setClearColor(){},info:{reset(){}}},composer:{render(){}},monitor:{reset(){},sample:()=>null},worldPlanes:[],lastFrame:0,
    resize(){},applyLights(){},buildStage(){},applyPost(){},applyInspection(){},setSelected(){},invalidate(){this.dirty=true;},reportStats(){}});
  engine.camera.position.set(8,4,9);
  try {
    const next=randomizePresentation(state,[],{delta:100,random:()=>0});engine.setState(next);
    assert.equal(engine.transition,true);assert.equal(engine.motionTime,0);assert.ok(engine.motionPosition.distanceTo(engine.desiredPosition)<1e-8);
    engine.tick(16);assert.equal(engine.motionTime,0,'do not animate from the previous camera frame');
    for(let time=32;time<2500;time+=16)engine.tick(time);
    assert.equal(engine.transition,false);assert.ok(engine.motionTime>0);
    assert.ok(engine.motionPosition.distanceTo(engine.desiredPosition)<.004);
  } finally {engine.floorMaterial.dispose();if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});
