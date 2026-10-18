import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DEFAULT_STATE, applyPreset, clone, makeProject, validateProject } from '../src/state.js';
import { generateAxes } from '../src/axisGeneration.js';
import { createAmberHaloStage } from '../src/stages/amberHalo.js';
import { concreteMapData } from '../src/stages/amberHaloMaterial.js';
import { haloBudget } from '../src/stages/amberHaloSettings.js';
import { StageEnvironment } from '../src/stageEnvironment.js';
import { configureFloorReflection } from '../src/haloReflection.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

function release(stage) {
  const resources = new Set();
  stage.group.traverse(node => {
    if(node.geometry)resources.add(node.geometry);
    if(node.material){resources.add(node.material);for(const value of Object.values(node.material))if(value?.isTexture)resources.add(value);}
  });
  resources.forEach(resource=>resource.dispose());
}

test('Halo parameters survive save/open; old projects receive bounded defaults', () => {
  const state = applyPreset(clone(DEFAULT_STATE), 'scene', 'amber-halo');
  Object.assign(state.scene, { haloRadius:4.2, haloIntensity:.82, wetness:.74, microDetail:.5, speed:0 });
  assert.deepEqual(validateProject(makeProject(state,{type:'demo'})).state,state);
  const old = makeProject(state,{type:'demo'});
  delete old.state.scene.haloRadius;old.state.scene.wetness=50;old.state.scene.haloIntensity=-1;
  const valid=validateProject(old).state;
  assert.equal(valid.scene.haloRadius,3.7);assert.equal(valid.scene.wetness,1);assert.equal(valid.scene.haloIntensity,0);
  const changed=applyPreset(state,'scene','studio');
  for(const key of ['lighting','camera','materials','transform','motion'])assert.deepEqual(changed[key],state[key]);
});

test('fog pauses without jumping, uses absolute recording time, and respects reduced motion', () => {
  const s=clone(DEFAULT_STATE.scene),stage=createAmberHaloStage(s,true);
  stage.update(s,1);const a=stage.phase;
  stage.update({...s,speed:0},8);assert.equal(stage.phase,a);
  stage.update(s,9,{reducedMotion:true});assert.equal(stage.phase,a);
  stage.update(s,10);assert.ok(stage.phase>a&&stage.phase<a+.1);
  stage.update(s,5,{recording:true});assert.equal(stage.phase,5*s.speed);
  stage.update(s,2,{recording:true});assert.equal(stage.phase,2*s.speed);
  stage.restorePhase(a,10);stage.update({...s,speed:0},10);assert.equal(stage.phase,a);
  assert.equal(stage.update({...s,fog:0},11),false);
  stage.update(s,12,{quality:'fluid'});assert.equal(stage.atmosphere.count,8);
  release(stage);
});

test('Halo variations stay inside the chosen axis and preserve locked camera/light/materials', () => {
  const state=clone(DEFAULT_STATE);
  for(const id of ['mat','light','cam','fx'])state.axes[id].locked=true;
  state.axes.env.delta=35;
  for(let i=1;i<30;i++){
    const next=generateAxes(state,[],{axis:'env',random:()=>i/31});
    assert.equal(next.scene.preset,'amber-halo');
    for(const key of ['lighting','camera','materials','transform','motion','post'])assert.deepEqual(next[key],state[key]);
    assert.ok(next.scene.haloRadius>=3&&next.scene.haloRadius<=5);
  }
});

test('procedural floor maps have actual spatial variation and normalized tangent normals', () => {
  const data=concreteMapData(256);
  assert.strictEqual(data,concreteMapData(256));
  assert.ok(new Set(data.color).size>40);
  assert.ok(new Set(data.roughness).size>40);
  for(let i=0;i<data.normal.length;i+=1024){
    const n=[0,1,2].map(k=>data.normal[i+k]/127.5-1);
    assert.ok(Math.abs(Math.hypot(...n)-1)<.02);
  }
  assert.equal(haloBudget('auto',true).reflectionSize,256);
  assert.equal(haloBudget('fluid').reflection,false);
});

test('environment captures coalesce during dragging, finish on the last value, and release targets', () => {
  const scene=new THREE.Scene(),fallback=new THREE.Texture(),created=[];
  let generatorDisposed=false;
  const generator={fromScene(){const t={texture:new THREE.Texture(),disposed:false,dispose(){this.disposed=true;}};created.push(t);return t;},dispose(){generatorDisposed=true;}};
  const stage={createProbe:()=>new THREE.Scene(),probeSignature:s=>s.ringColor};
  const manager=new StageEnvironment(null,scene,fallback,false,()=>generator);
  manager.setStage(stage,{ringColor:'#ffb860'});manager.update(0);
  assert.equal(created.length,1);manager.update(500);assert.equal(created.length,1);
  manager.setStage(stage,{ringColor:'#ff0000'});assert.equal(manager.update(50),true);
  manager.setStage(stage,{ringColor:'#00ff00'});assert.equal(manager.update(90),true);
  assert.equal(manager.update(200),false);assert.equal(created.length,2);assert.ok(created[0].disposed);
  assert.equal(manager.signature,'#00ff00');assert.strictEqual(scene.environment,created[1].texture);
  manager.setStage(null,{});assert.strictEqual(scene.environment,fallback);assert.ok(created[1].disposed);
  manager.dispose();assert.equal(generatorDisposed,true);
});

test('floor reflection extension binds to this Three version without leaving original opaque output', () => {
  const reflector=new Reflector(new THREE.PlaneGeometry(2,2));
  configureFloorReflection(reflector,{});
  assert.ok(reflector.material.vertexShader.includes('pvWorld = (modelMatrix'));
  assert.ok(reflector.material.fragmentShader.includes('float blur = .002'));
  assert.ok(!reflector.material.fragmentShader.includes('texture2DProj( tDiffuse, vUv )'));
  assert.ok(!reflector.material.fragmentShader.includes('vec4( blendOverlay( base.rgb, color ), 1.0 )'));
  reflector.geometry.dispose();reflector.dispose();
});
