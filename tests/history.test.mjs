import test from 'node:test';
import assert from 'node:assert/strict';
import {EditHistory,historyShortcut} from '../src/history.js';
import {DEFAULT_STATE,clone} from '../src/state.js';

test('one gesture is one undo step, redo restores its final value, and a new branch clears redo',()=>{
  const h=new EditHistory(),a=clone(DEFAULT_STATE),b={...a,camera:{...a.camera,azimuth:42}},c={...b,camera:{...b.camera,azimuth:55}};
  h.record(a,b,{group:'camera.azimuth',time:1});h.record(b,c,{group:'camera.azimuth',time:20});
  assert.equal(h.view.cursor,1);assert.deepEqual(h.undo(c),a);assert.deepEqual(h.redo(a),c);
  h.undo(c);const d={...a,name:'New branch'};h.record(a,d);
  assert.equal(h.future.length,0);assert.equal(h.redo(d),d);
});
test('undo, redo and scrub preserve current generation locks/deltas while restoring authored controls',()=>{
  const h=new EditHistory(),a=clone(DEFAULT_STATE),b={...a,scene:{...a.scene,preset:'rain'}},c={...b,name:'Rain'};
  h.record(a,b,{label:'Stage'});h.record(b,c,{label:'Nome'});
  const live={...c,axes:{...c.axes,mat:{locked:true,delta:20}},randomDelta:68};
  const start=h.seek(live,0);assert.equal(start.scene.preset,a.scene.preset);assert.equal(start.name,a.name);assert.equal(start.axes,live.axes);assert.equal(start.randomDelta,68);
  const end=h.seek(start,2);assert.equal(end.scene.preset,'rain');assert.equal(end.name,'Rain');assert.equal(end.axes,live.axes);
  assert.deepEqual(h.view,{cursor:2,labels:['Stage','Nome']});
});
test('no-op edits do not enter history or destroy the redo branch',()=>{
  const h=new EditHistory(),a=clone(DEFAULT_STATE),b={...a,name:'Changed'};h.record(a,b);h.undo(b);
  assert.equal(h.record(a,clone(a)),false);assert.equal(h.past.length,0);assert.equal(h.future.length,1);
  assert.deepEqual(h.redo(a),b);
});
test('history is bounded, clears for a new model and snapshots cannot be mutated by later edits',()=>{
  const h=new EditHistory(3);let current=clone(DEFAULT_STATE);
  for(let i=0;i<8;i++){const next={...current,name:String(i)};h.record(current,next);current=next;}
  assert.equal(h.past.length,3);current.scene.fog=.9;assert.notEqual(h.past.at(-1).state.scene.fog,.9);
  h.clear();assert.deepEqual(h.view,{cursor:0,labels:[]});assert.equal(h.undo(current),current);
});
test('explicit gesture boundary separates adjacent drags of the same control',()=>{
  const h=new EditHistory(),a=clone(DEFAULT_STATE),b={...a,name:'B'},c={...b,name:'C'};
  h.record(a,b,{group:'name',time:1});h.endGesture();h.record(b,c,{group:'name',time:2});assert.equal(h.past.length,2);
});
test('all requested keyboard shortcuts resolve correctly on Ctrl and Command',()=>{
  for(const modifier of ['ctrlKey','metaKey']){
    assert.equal(historyShortcut({[modifier]:true,key:'z'}),'undo');
    assert.equal(historyShortcut({[modifier]:true,shiftKey:true,key:'Z'}),'redo');
    assert.equal(historyShortcut({[modifier]:true,key:'y'}),'redo');
  }
  assert.equal(historyShortcut({key:'z'}),null);assert.equal(historyShortcut({ctrlKey:true,altKey:true,key:'z'}),null);
});
