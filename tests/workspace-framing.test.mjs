import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { perspectiveFit } from '../src/cameraFraming.js';
import { workspaceInsets } from '../src/workspaceLayout.js';
const v=(x,y,z)=>new THREE.Vector3(x,y,z);

test('workspace reserves only the right column or lower dock, never the old bottom navbar',()=>{
  assert.deepEqual(workspaceInsets(1440,900,{left:1030,top:92}),{right:430,bottom:16});
  assert.deepEqual(workspaceInsets(390,844,{left:18,top:545}),{right:0,bottom:311});
  assert.deepEqual(workspaceInsets(1079,1834,{left:180,top:1422}),{right:0,bottom:424});
  assert.ok(workspaceInsets(390,844,{left:18,top:545}).bottom<844*.4);
});

test('front framing fills portrait space without treating car length as visible width',()=>{
  const bounds=new THREE.Box3(v(-1,.025,-2.35),v(1,1.325,2.35)),target=bounds.getCenter(v(0,0,0)),fov=THREE.MathUtils.degToRad(35);
  const front=perspectiveFit(bounds,target,v(0,0,1),fov,390/844,1,.64);
  const side=perspectiveFit(bounds,target,v(1,0,0),fov,390/844,1,.64);
  assert.ok(front<side*.72);assert.ok(Number.isFinite(front));
});

test('projected corners fit the unobscured viewport across aspect ratios and cinematic angles',()=>{
  const bounds=new THREE.Box3(v(-1,.025,-2.35),v(1,1.325,2.35)),target=bounds.getCenter(v(0,0,0));
  for(const [width,height,right,bottom] of [[390,844,0,311],[1079,1834,0,424],[1440,900,430,16],[844,390,346,16]]) {
    for(const [azimuth,elevation] of [[0,8],[38,13],[90,8],[38,57]]) {
      const a=THREE.MathUtils.degToRad(azimuth),e=THREE.MathUtils.degToRad(elevation),direction=v(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e));
      const camera=new THREE.PerspectiveCamera(35,width/height,.05,200);
      const distance=perspectiveFit(bounds,target,direction,THREE.MathUtils.degToRad(camera.fov),camera.aspect,1-right/width,1-bottom/height);
      camera.position.copy(direction).multiplyScalar(distance).add(target);camera.lookAt(target);camera.setViewOffset(width,height,right/2,bottom/2,width,height);camera.updateMatrixWorld();
      for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]) {
        const p=v(x,y,z).project(camera);
        assert.ok(p.x>=-1&&p.x<=1-2*right/width,`horizontal ${width}x${height}`);
        assert.ok(p.y>=-1+2*bottom/height&&p.y<=1,`vertical ${width}x${height}`);
      }
    }
  }
});
