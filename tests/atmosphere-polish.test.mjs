import test from 'node:test';
import assert from 'node:assert/strict';
import {createConcreteMaps} from '../src/stages/amberHaloMaterial.js';
import {createEnvironmentStage} from '../src/environmentStage.js';
import {StudioEngine} from '../src/engine.js';
import {DEFAULT_STATE,clone,applyPreset,makeProject,validateProject} from '../src/state.js';
import {generateAxes} from '../src/axisGeneration.js';
import {historyPosition,historyWheelDistance} from '../src/historyNavigation.js';

test('floor texel density increases fourfold with mipmaps and bounded mobile maps',()=>{
  for(const coarse of [false,true]){
    const maps=createConcreteMaps(coarse),size=coarse?512:1024;
    for(const map of Object.values(maps)){
      assert.equal(map.image.width,size);assert.equal(map.repeat.x,40);assert.ok(map.generateMipmaps);
      assert.equal(size*map.repeat.x/160,coarse?128:256);
      assert.ok(map.anisotropy<=8);map.dispose();
    }
  }
});
test('Aurora and Dust survive projects and preserve every non-environment axis',()=>{
  for(const id of ['aurora','dust']){
    const state=applyPreset(clone(DEFAULT_STATE),'scene',id);state.axes.env.delta=35;
    Object.assign(state.scene,{weather:.82,height:1.2,spread:.85,density:.72,speed:.45});
    assert.deepEqual(validateProject(makeProject(state,{type:'demo'})).state,state);
    const next=generateAxes(state,[],{axis:'env',random:()=>.62});
    for(const key of ['camera','lighting','materials','transform','motion','effects','post'])assert.deepEqual(next[key],state[key]);
    assert.equal(next.scene.preset,id);assert.notEqual(next.scene.weather,state.scene.weather);
  }
});
test('new atmosphere uniforms update in place, pause, record, restore and dispose',()=>{
  for(const id of ['aurora','dust'])for(const coarse of [false,true]){
    const scene=applyPreset(clone(DEFAULT_STATE),'scene',id).scene,stage=createEnvironmentStage(scene,coarse);
    const geometry=stage.atmosphere.geometry,material=stage.atmosphere.material;
    stage.update(scene,1);stage.update(scene,1.1);const phase=stage.phase;assert.ok(phase>0);
    assert.equal(stage.update({...scene,speed:0},9),false);assert.equal(stage.phase,phase);
    assert.equal(stage.update(scene,10,{reducedMotion:true}),false);assert.equal(stage.phase,phase);
    stage.update(scene,4,{recording:true});assert.equal(stage.phase,4*scene.speed);
    stage.restorePhase(phase,10);stage.update(scene,10);assert.equal(stage.phase,phase);
    stage.update({...scene,height:1.7,weather:.3,spread:1.5},10);
    assert.strictEqual(stage.atmosphere.geometry,geometry);assert.strictEqual(stage.atmosphere.material,material);
    assert.equal(material.uniforms.height.value,1.7);assert.equal(material.uniforms.amount.value,.3);
    assert.equal(stage.update({...scene,weather:0},11),false);
    stage.update(scene,12,{inspection:{view:'normals'}});assert.equal(stage.atmosphere.visible,false);
    if(id==='dust'){
      const full=geometry.attributes.position.count;assert.equal(full,coarse?256:640);
      stage.update(scene,13,{quality:'fluid'});assert.ok(geometry.drawRange.count<=full/2);
    }
    let disposed=0;for(const map of Object.values(stage.maps))map.addEventListener('dispose',()=>disposed++);
    StudioEngine.prototype.disposeObject.call({},stage.group);assert.equal(disposed,3);
  }
});
test('tactile history has fractional motion and consistent bounded wheel units',()=>{
  assert.equal(historyPosition(3,6,5),2.75);assert.equal(historyPosition(3,-12,5),3.5);
  assert.equal(historyPosition(0,200,5),0);assert.equal(historyPosition(5,-200,5),5);
  assert.equal(historyWheelDistance({deltaX:0,deltaY:2,deltaMode:1}),16);
  assert.equal(historyWheelDistance({deltaX:-32,deltaY:1,deltaMode:0}),-16);
  assert.equal(historyWheelDistance({deltaX:0,deltaY:500,deltaMode:0}),48);
});

// Rain keeps working after removal of the skyline, including legacy parameters.
test('rain has no solid volumes and updates its distribution without rebuilding',()=>{
  for(const coarse of [false,true]){
    const scene=applyPreset(clone(DEFAULT_STATE),'scene','rain').scene,stage=createEnvironmentStage(scene,coarse);
    const objects=[];stage.group.traverse(o=>{if(o.geometry)objects.push(o);});
    assert.equal(objects.length,1);assert.ok(objects[0].isLineSegments);
    const drops=objects[0],geometry=drops.geometry,material=drops.material,maximum=coarse?180:360;
    stage.update({...scene,density:1},1);assert.equal(geometry.drawRange.count,maximum*2);
    stage.update({...scene,density:.5,height:1.8,spread:1.4,seed:171},1.1);
    assert.equal(geometry.drawRange.count,maximum);assert.equal(material.uniforms.height.value,1.8);assert.equal(material.uniforms.spread.value,1.4);
    assert.equal(drops.geometry,geometry);assert.equal(drops.material,material);
    const phase=stage.phase;stage.update({...scene,speed:0},2);assert.equal(stage.phase,phase);
    stage.update(scene,3,{reducedMotion:true});assert.equal(stage.phase,phase);
    stage.update(scene,4,{recording:true});assert.equal(stage.phase,scene.speed*4);stage.restorePhase(phase,4);assert.equal(stage.phase,phase);
    assert.equal(stage.update({...scene,density:0},5),false);assert.equal(drops.visible,false);
    stage.update({...scene,density:1},6,{quality:'fluid'});assert.equal(geometry.drawRange.count,maximum);
    let disposed=0;geometry.addEventListener('dispose',()=>disposed++);material.addEventListener('dispose',()=>disposed++);
    StudioEngine.prototype.disposeObject.call({},stage.group);assert.equal(disposed,2);
  }
});
