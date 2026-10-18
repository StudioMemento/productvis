import test from 'node:test';
import assert from 'node:assert/strict';
import {valueAdapter} from '../src/controlMath.js';
import {EditHistory} from '../src/history.js';
import {DEFAULT_STATE,clone,makeProject,validateProject} from '../src/state.js';
import {projectFingerprint} from '../src/projectSession.js';
import {workspaceInsets,workspaceBounds} from '../src/workspaceLayout.js';
import {exportFrame} from '../src/exportFrame.js';
import {PerspectiveCamera,Vector3} from 'three';

test('percent editing round-trips in visible units without exposing GPU float noise',()=>{
  const percent=valueAdapter();
  assert.equal(percent.draft(.25),'25');assert.equal(percent.draft(.23999999463558197),'24');
  assert.equal(percent.parse('30').value,.3);assert.equal(percent.parse('30,0').value,.3);
  assert.ok(percent.parse('101').error);assert.ok(percent.parse('banana').error);assert.ok(percent.parse('').error);
  assert.ok(percent.parse('1e2').error);assert.equal(valueAdapter({max:.8}).max,80);
  const nativePercent=valueAdapter({min:0,max:100,step:1,scale:1,unit:'%'});
  assert.equal(nativePercent.parse('30').value,30);
});

test('optics, bloom and duration remain in native units',()=>{
  for(const [config,input,expected] of [
    [{min:1,max:2.5,step:.01,scale:1},'1,52',1.52],
    [{min:0,max:.1,step:.005,scale:1},'0.075',.075],
    [{min:18,max:150,step:1,scale:1,unit:'mm'},'85',85],
    [{min:2,max:20,step:1,scale:1,unit:'s'},'12',12],
    [{min:-180,max:180,step:1,scale:1,unit:'°'},'-30',-30]
  ])assert.equal(valueAdapter(config).parse(input).value,expected);
});

test('a slow gesture stays one undo and cancellation restores the existing redo branch',()=>{
  const h=new EditHistory(),initial=clone(DEFAULT_STATE);
  const a={...initial,scene:{...initial.scene,fog:.3}},b={...initial,scene:{...initial.scene,fog:.5}};
  h.beginGesture();h.record(initial,a,{group:'scene.fog',time:0});h.record(a,b,{group:'scene.fog',time:5000});h.endGesture();
  assert.equal(h.view.cursor,1);assert.deepEqual(h.undo(b),initial);assert.equal(h.view.labels.length,1);
  h.beginGesture();h.record(initial,a,{group:'scene.fog'});h.cancelGesture();
  assert.equal(h.view.cursor,0);assert.equal(h.view.labels.length,1);assert.deepEqual(h.redo(initial),b);
});

test('project dirty signature covers generation metadata and returns clean after undo or file roundtrip',()=>{
  const s=clone(DEFAULT_STATE),base=projectFingerprint(s),h=new EditHistory();
  const next={...s,scene:{...s.scene,fog:.31}};h.record(s,next);
  assert.notEqual(projectFingerprint(next),base);assert.equal(projectFingerprint(h.undo(next)),base);
  assert.equal(projectFingerprint({...s,selectedMaterial:'another'}),base);
  assert.notEqual(projectFingerprint({...s,axes:{...s.axes,mat:{delta:40,locked:true}}}),base);
  assert.equal(projectFingerprint(validateProject(makeProject(s,{type:'demo'})).state),base);
});

test('a drag returning to its starting value preserves the redo branch without a no-op entry',()=>{
  const h=new EditHistory(),a={value:1},b={value:2};
  h.record(a,b);h.undo(b);
  h.beginGesture();h.record(a,b,{group:'value'});h.record(b,a,{group:'value'});h.endGesture(a);
  assert.equal(h.view.cursor,0);assert.equal(h.view.labels.length,1);assert.deepEqual(h.redo(a).value,2);
});

test('video guide and output camera have the same projection inside every format rectangle',()=>{
  for(const [width,height,insets] of [[1366,768,{right:456}],[390,844,{bottom:400}],[844,390,{right:336}]]){
    for(const aspect of ['16:9','9:16','1:1']){
      const f=exportFrame(width,height,insets,{aspect});
      assert.ok(f.x>=0&&f.y>=0&&f.x+f.width<=width-(insets.right||0));
      assert.ok(f.y+f.height<=height-(insets.bottom||0));
      const preview=new PerspectiveCamera(35,f.width/f.height,.1,100),output=preview.clone();
      preview.setViewOffset(f.width,f.height,-f.x,-f.y,width,height);
      for(const point of [new Vector3(0,0,-5),new Vector3(1,.5,-5),new Vector3(-1,-.5,-10)]){
        const p=point.clone().project(preview),q=point.clone().project(output);
        assert.ok(Math.abs((p.x+1)*width/2-(f.x+(q.x+1)*f.width/2))<1e-7);
        assert.ok(Math.abs((1-p.y)*height/2-(f.y+(1-q.y)*f.height/2))<1e-7);
      }
    }
  }
});

test('side console reserves usable targets and switches to bottom dock on narrow landscapes',()=>{
  for(const [w,h] of [[844,390],[1024,768],[1366,768],[1440,900],[1920,1080]]){
    assert.ok(workspaceBounds(w,h).min>=336);
    assert.ok(workspaceInsets(w,h,{sideRatio:.01}).right>=336);
  }
  assert.equal(workspaceInsets(568,320).right,0);
});
