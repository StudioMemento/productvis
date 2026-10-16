import test from 'node:test';
import assert from 'node:assert/strict';
import { AXES } from '../src/axisState.js';
import { resetAxis } from '../src/axisReset.js';
import { DEFAULT_STATE, clone } from '../src/state.js';

const original={color:'#304050',roughness:.3,metalness:.7,clearcoat:.2,normalScale:1.2,transmission:.4,ior:1.4,thickness:.8,emissive:'#112233',emissiveIntensity:.6};
const materials=[{id:'body',original},{id:'glass',original:{color:'#aaaaaa'}}];
function modified() {
  const s=clone(DEFAULT_STATE);
  s.axes=Object.fromEntries(AXES.map(a=>[a.id,{delta:23,locked:true}]));s.randomDelta=17;
  s.selectedMaterial='body';
  s.materials={body:{...original,finish:'metal',color:'#ff0000',overlay:.7,roughness:.8,uvChannel:1,opacity:.6,alphaMode:'blend',alphaCutoff:.2,doubleSide:true},glass:{color:'#00ffff',opacity:.3}};
  s.scene={...s.scene,preset:'rain-veil',fog:.8,seed:821};
  s.lighting={...s.lighting,preset:'neon',key:2};
  s.camera={...s.camera,preset:'macro',focusPoint:[2,3,4],targetPoint:[1,2,3],orbitRadius:7,bokeh:.9};
  s.motion={...s.motion,preset:'orbit',cursor:.45,playing:true};
  s.effects={...s.effects,surface:'hologram',particles:'scatter',trail:'ghost',phase:.8,randomize:false};
  s.post={...s.post,enabled:false,dof:true,strength:.1,contrast:1.4};
  s.transform.position=[1,2,3];s.animation={...s.animation,clip:2,cursor:.5,playing:true};
  s.inspection.view='wire';s.render.alpha=true;s.section.enabled=true;
  return s;
}

test('each reset changes only its axis, retaining locks, deltas, authored mesh settings and diagnostics',()=>{
  for(const axis of AXES){
    const before=modified(),snapshot=clone(before),next=resetAxis(before,axis.id,materials);
    assert.notStrictEqual(next,before,axis.id);
    assert.deepEqual(before,snapshot,'input state is immutable');
    for(const key of Object.keys(before))if(!axis.fields.includes(key))assert.strictEqual(next[key],before[key],axis.id+': '+key);
    assert.strictEqual(next.axes,before.axes);assert.equal(next.randomDelta,17);
  }
});

test('MAT restores the selected authored look, including glass, without changing UV, alpha or other surfaces',()=>{
  const before=modified(),next=resetAxis(before,'mat',materials);
  for(const [key,value] of Object.entries(original))assert.equal(next.materials.body[key],value,key);
  assert.equal(next.materials.body.finish,'original');assert.equal(next.materials.body.overlay,0);
  for(const key of ['uvChannel','opacity','alphaMode','alphaCutoff','doubleSide'])assert.equal(next.materials.body[key],before.materials.body[key]);
  assert.strictEqual(next.materials.glass,before.materials.glass);
  assert.strictEqual(resetAxis(next,'mat',materials),next,'repeat reset must not create undo history');
});

test('CAM resets camera and movement together while preserving native GLB animation and the FX pass state',()=>{
  const before=modified(),next=resetAxis(before,'cam',materials);
  assert.deepEqual(next.camera,DEFAULT_STATE.camera);assert.deepEqual(next.motion,DEFAULT_STATE.motion);
  assert.strictEqual(next.animation,before.animation);assert.strictEqual(next.post,before.post);
  assert.strictEqual(next.effects,before.effects);
});

test('FX reset removes product effects and restores post values while retaining camera-authored DOF and pass enable',()=>{
  const before=modified(),next=resetAxis(before,'fx',materials);
  assert.deepEqual(next.effects,{...DEFAULT_STATE.effects,randomize:false});
  assert.deepEqual(next.post,{...DEFAULT_STATE.post,dof:true,enabled:false});
  assert.strictEqual(next.camera,before.camera);
  assert.strictEqual(resetAxis(next,'fx',materials),next);
});

test('unchanged axes and unavailable material resets are identity no-ops',()=>{
  const state=clone(DEFAULT_STATE);
  for(const id of ['env','light','cam','fx','unknown','mat'])assert.strictEqual(resetAxis(state,id,materials),state,id);
  const before=modified();
  assert.strictEqual(resetAxis(before,'mat',[]),before);
  assert.strictEqual(resetAxis(before,'mat',[{id:'other',original}]),before);
  for(const id of ['env','light']){
    const once=resetAxis(before,id,materials);
    assert.strictEqual(resetAxis(once,id,materials),once,id);
  }
});
