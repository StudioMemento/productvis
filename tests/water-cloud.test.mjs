import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { DEFAULT_STATE,applyPreset,clone,makeProject,validateProject } from '../src/state.js';
import { generateAxes } from '../src/axisGeneration.js';
import { createEnvironmentStage } from '../src/environmentStage.js';
import { StudioEngine } from '../src/engine.js';
import { createHorizon,addHorizonToMaterial,horizonFade } from '../src/stages/horizon.js';
import { natureSettings,cloudBudget } from '../src/stages/natureSettings.js';
import { createWaterGeometry } from '../src/stages/water.js';

const release=stage=>StudioEngine.prototype.disposeObject.call({},stage.group);
const shaderFor=material=>{const shader={uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader};material.onBeforeCompile(shader);return shader;};

test('ground fades into the exact background before every finite surface edge, even with fog zero',()=>{
  assert.equal(horizonFade(0),0);assert.equal(horizonFade(15),0);assert.equal(horizonFade(58),1);assert.equal(horizonFade(80),1);
  let previous=0;for(let d=0;d<100;d+=.1){const value=horizonFade(d);assert.ok(value>=previous);previous=value;}
  assert.ok(horizonFade(15.01)<1e-8);assert.ok(1-horizonFade(57.99)<1e-8);
  const horizon=createHorizon({...DEFAULT_STATE.scene,fog:0});
  const material=addHorizonToMaterial(new THREE.MeshStandardMaterial(),horizon),shader=shaderFor(material);
  assert.strictEqual(shader.uniforms.pvSkyBase,horizon.sky.material.uniforms.pvSkyBase);
  assert.strictEqual(shader.uniforms.pvSkyHaze,horizon.sky.material.uniforms.pvSkyHaze);
  assert.equal(material.fog,false);assert.ok(horizon.uniforms.pvSkyHaze.value.r>0);
  horizon.sky.geometry.dispose();horizon.sky.material.dispose();material.dispose();
});

test('water and cloud parameters persist with bounded defaults without changing the other axes',()=>{
  for(const id of ['water','cloud']){
    const state=applyPreset(clone(DEFAULT_STATE),'scene',id);
    Object.assign(state.scene,{waterWaves:.76,waterRipples:.82,cloudDensity:.73,cloudLevel:-.12,cloudThickness:1.4,speed:0});
    assert.deepEqual(validateProject(makeProject(state,{type:'demo'})).state,state);
    const saved=makeProject(state,{type:'demo'});delete saved.state.scene.waterWaves;saved.state.scene.cloudLevel=100;saved.state.scene.cloudThickness=-5;
    const restored=validateProject(saved).state;
    assert.equal(restored.scene.waterWaves,.35);assert.equal(restored.scene.cloudLevel,.08);assert.equal(restored.scene.cloudThickness,.5);
    for(const key of ['camera','lighting','materials','effects','motion','transform'])assert.deepEqual(state[key],DEFAULT_STATE[key]);
  }
});

test('nature generation respects locks and remains within valid ranges',()=>{
  for(const id of ['water','cloud']){
    const state=applyPreset(clone(DEFAULT_STATE),'scene',id);state.axes.env.delta=35;
    for(const axis of ['mat','light','cam','fx'])state.axes[axis].locked=true;
    for(let i=1;i<25;i++){
      const next=generateAxes(state,[],{axis:'env',random:()=>i/26});
      assert.deepEqual(natureSettings(next.scene),Object.fromEntries(Object.keys(natureSettings(next.scene)).map(k=>[k,next.scene[k]])));
      for(const key of ['camera','lighting','materials','effects','motion','transform'])assert.deepEqual(next[key],state[key]);
    }
  }
});

test('water and cloud pause in place, honor reduced motion, and restore after recording',()=>{
  for(const id of ['water','cloud']){
    const s=applyPreset(clone(DEFAULT_STATE),'scene',id).scene,stage=createEnvironmentStage(s);
    stage.update(s,1);const phase=stage.phase;
    assert.equal(stage.update({...s,speed:0},20),false);assert.equal(stage.phase,phase);
    assert.equal(stage.update(s,21,{reducedMotion:true}),false);assert.equal(stage.phase,phase);
    stage.update(s,4,{recording:true});assert.equal(stage.phase,4*s.speed);
    stage.restorePhase(phase,21);stage.update(s,21);assert.equal(stage.phase,phase);
    if(id==='water'){stage.update(s,22,{quality:'fluid'});assert.equal(stage.reflectionActive,false);assert.equal(stage.update({...s,waterWaves:0,waterRipples:0},23),false);}
    else assert.equal(stage.update({...s,cloudDensity:0},22),false);
    release(stage);
  }
});

test('water polar mesh is bounded and faces upward on desktop and touch',()=>{
  for(const coarse of [false,true]){
    const g=createWaterGeometry(coarse),p=g.attributes.position,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    assert.ok(g.index.count/3<5000);assert.ok(g.boundingSphere.radius>=99.9);
    for(let i=0;i<g.index.count;i+=3){
      a.fromBufferAttribute(p,g.index.getX(i));b.fromBufferAttribute(p,g.index.getX(i+1));c.fromBufferAttribute(p,g.index.getX(i+2));
      const normal=b.sub(a).cross(c.sub(a));assert.ok(normal.y>=-1e-5);
    }
    g.dispose();
  }
});

test('water uses a world reflection matrix and restores hidden objects on failure',()=>{
  const s=applyPreset(clone(DEFAULT_STATE),'scene','water').scene,stage=createEnvironmentStage(s);
  const water=stage.group.getObjectByName('Water surface'),shader=shaderFor(water.material);
  const reflector=new Reflector(new THREE.PlaneGeometry(90,90));reflector.rotation.x=-Math.PI/2;reflector.position.y=-.29;reflector.updateMatrixWorld(true);
  const expected=new THREE.Matrix4().makeTranslation(.2,.3,.4);
  reflector.onBeforeRender=()=>{assert.equal(water.visible,false);reflector.material.uniforms.textureMatrix.value.copy(expected).multiply(reflector.matrixWorld);};
  stage.bindReflection(reflector);reflector.visible=false;
  water.onBeforeRender({},new THREE.Scene(),new THREE.Camera());
  const actual=shader.uniforms.pvWaterMatrix.value;
  for(let i=0;i<16;i++)assert.ok(Math.abs(actual.elements[i]-expected.elements[i])<1e-10);
  assert.equal(water.visible,true);assert.equal(reflector.visible,false);
  reflector.onBeforeRender=()=>{throw Error('capture failed');};
  assert.throws(()=>water.onBeforeRender({},new THREE.Scene(),new THREE.Camera()),/capture failed/);
  assert.equal(water.visible,true);assert.equal(reflector.visible,false);
  reflector.dispose();reflector.geometry.dispose();release(stage);
});

test('cloud sample budgets, empty center, and owned 3D texture lifetime stay bounded',()=>{
  const s=applyPreset(clone(DEFAULT_STATE),'scene','cloud').scene,stage=createEnvironmentStage(s,true);
  const volume=stage.atmosphere,noise=volume.material.uniforms.cloudNoise.value;
  assert.equal(noise.image.data.length,32**3);assert.equal(noise.wrapR,THREE.RepeatWrapping);
  assert.ok(volume.material.fragmentShader.includes('protectedCentre'));assert.ok(volume.material.fragmentShader.includes('gl_FragDepth'));
  for(const quality of ['fluid','auto','high']){stage.update(s,0,{quality});assert.equal(volume.material.uniforms.cloudSteps.value,cloudBudget(quality,true));assert.ok(cloudBudget(quality,true)<=14);}
  let disposed=0;noise.addEventListener('dispose',()=>disposed++);release(stage);assert.equal(disposed,1);
});
