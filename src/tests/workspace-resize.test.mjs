import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_WORKSPACE, usesBottomDock, workspaceBounds, workspaceInsets, resizedWorkspace, resizeFromKey, restoreWorkspaceSize, persistWorkspaceSize } from '../src/workspaceLayout.js';
import { smootherstep, isLightBackdrop } from '../src/blurProfile.js';

test('drag sizes clamp to usable viewport bounds and preserve the other orientation preference',()=>{
  for(const [w,h] of [[320,568],[390,844],[768,600],[844,390],[1440,900],[3840,2160]]){
    const bottom=usesBottomDock(w,h),bounds=workspaceBounds(w,h),prefs={sideRatio:.4,bottomRatio:.55};
    for(const pixels of [-100,0,300,450,9000]){
      const next=resizedWorkspace(prefs,w,h,pixels),insets=workspaceInsets(w,h,next),size=bottom?insets.bottom:insets.right;
      assert.ok(size>=bounds.min-1e-8&&size<=bounds.max+1e-8);
      assert.equal(next[bottom?'sideRatio':'bottomRatio'],prefs[bottom?'sideRatio':'bottomRatio']);
      assert.ok(bottom?h-insets.bottom>=h*.35-1e-8:w-insets.right>=300-1e-8);
    }
    assert.strictEqual(resizedWorkspace(prefs,w,h,NaN),prefs);
  }
});

test('resize keyboard respects physical direction, step modifiers and endpoints',()=>{
  const bounds={min:300,max:600};
  for(const bottom of [false,true]){
    const grow=bottom?'ArrowUp':'ArrowLeft',shrink=bottom?'ArrowDown':'ArrowRight';
    assert.equal(resizeFromKey(grow,400,bounds,bottom),416);
    assert.equal(resizeFromKey(shrink,400,bounds,bottom,true),360);
    assert.equal(resizeFromKey(grow,595,bounds,bottom),600);
    assert.equal(resizeFromKey(shrink,305,bounds,bottom),300);
    assert.equal(resizeFromKey('Home',400,bounds,bottom),300);
    assert.equal(resizeFromKey('End',400,bounds,bottom),600);
    assert.equal(resizeFromKey(bottom?'ArrowLeft':'ArrowUp',400,bounds,bottom),null);
  }
});

test('workspace preferences round-trip separately from the project and survive missing or corrupt storage',()=>{
  let saved;const storage={setItem:(key,value)=>{saved=value;},getItem:()=>saved};
  const preferences=resizedWorkspace({sideRatio:.4,bottomRatio:.56},3840,2160,280);
  persistWorkspaceSize(preferences,storage);
  assert.deepEqual(restoreWorkspaceSize(storage),preferences);
  assert.deepEqual(restoreWorkspaceSize({getItem:()=>'{bad'}),DEFAULT_WORKSPACE);
  assert.deepEqual(restoreWorkspaceSize({getItem:()=>null}),DEFAULT_WORKSPACE);
  assert.deepEqual(restoreWorkspaceSize({getItem:()=>'{"sideRatio":"wide","bottomRatio":null}'}),DEFAULT_WORKSPACE);
  assert.doesNotThrow(()=>persistWorkspaceSize(preferences,{setItem(){throw Error('Blocked');}}));
  assert.deepEqual(restoreWorkspaceSize({getItem(){throw Error('Blocked');}}),DEFAULT_WORKSPACE);
});

test('blur falloff is monotonic, symmetric and flat at both ends, with readable light-scene text selection',()=>{
  assert.equal(smootherstep(-1),0);assert.equal(smootherstep(2),1);
  let last=0;
  for(let i=0;i<=100;i++){
    const t=i/100,alpha=smootherstep(t);
    assert.ok(alpha>=last&&alpha<=1);last=alpha;
    assert.ok(Math.abs(alpha+smootherstep(1-t)-1)<1e-12);
  }
  assert.ok(smootherstep(.001)<1e-7);
  assert.ok(1-smootherstep(.999)<1e-7);
  assert.ok(smootherstep(.25)<.25&&smootherstep(.75)>.75);
  assert.equal(isLightBackdrop('#bcc6ce'),true);assert.equal(isLightBackdrop('#101722'),false);
  assert.equal(isLightBackdrop('invalid'),false);
});
