import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { perspectiveFit } from '../src/cameraFraming.js';
import { workspaceInsets } from '../src/workspaceLayout.js';
const v=(x,y,z)=>new THREE.Vector3(x,y,z);

test('default console size stays stable across content changes and explicit expansion remains bounded',()=>{
  for(const [width,height,bottomDock] of [[1440,900,false],[1920,1080,false],[844,390,false],[568,320,false],[390,844,true],[320,568,true],[1079,1834,true],[1150,1000,true],[1151,1000,false]]){
    const insets=workspaceInsets(width,height);
<<<<<<< HEAD
    const expected=bottomDock?{right:0,bottom:Math.min(height*.65,Math.max(340,height*.38))}:{right:width/3,bottom:0};
=======
    const expected=bottomDock?{right:0,bottom:Math.min(height*.65,Math.max(400,height/3))}:{right:width/3,bottom:0};
>>>>>>> 10e60a6124e91f2ebd4d0716d2ef74e1804cf295
    assert.ok(Math.abs(insets.right-expected.right)<1e-9&&Math.abs(insets.bottom-expected.bottom)<1e-9);
    assert.deepEqual(workspaceInsets(width,height,{expanded:true}),bottomDock?{right:0,bottom:height*.65}:insets);
    assert.ok(height-insets.bottom>=height*.35);
    // Content size and scroll never change framing.
    assert.deepEqual(workspaceInsets(width,height,{left:0,top:0}),insets);
    assert.deepEqual(workspaceInsets(width,height,{left:width,top:height}),insets);
  }
});

test('front framing fills portrait space without treating car length as visible width',()=>{
  const bounds=new THREE.Box3(v(-1,.025,-2.35),v(1,1.325,2.35)),target=bounds.getCenter(v(0,0,0)),fov=THREE.MathUtils.degToRad(35);
  const front=perspectiveFit(bounds,target,v(0,0,1),fov,390/844,1,.64);
  const side=perspectiveFit(bounds,target,v(1,0,0),fov,390/844,1,.64);
  assert.ok(front<side*.72);assert.ok(Number.isFinite(front));
});

test('projected corners fit the unobscured viewport across aspect ratios and cinematic angles',()=>{
  const bounds=new THREE.Box3(v(-1,.025,-2.35),v(1,1.325,2.35)),target=bounds.getCenter(v(0,0,0));
  for(const [width,height] of [[320,568],[390,844],[1079,1834],[1440,900],[1920,1080],[844,390],[568,320]]) {

    for(const preferences of [{},{expanded:true},{sideRatio:.6,bottomRatio:.65},{sideRatio:.15,bottomRatio:.3}])for(const [azimuth,elevation] of [[0,8],[38,13],[90,8],[38,57]]) {
      const {right,bottom}=workspaceInsets(width,height,preferences);
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
