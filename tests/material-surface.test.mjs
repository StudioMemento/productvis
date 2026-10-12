import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MeshPhysicalMaterial,DoubleSide,FrontSide,BackSide,BoxGeometry,BufferAttribute} from 'three';
import {normalizeDemoSurface,surfacePolicy,applySurfacePolicy,geometryUvChannels,sharedUvChannels} from '../src/materialSurface.js';
import {clone,DEFAULT_STATE,makeProject,validateProject} from '../src/state.js';
const glb=readFileSync(new URL('../public/models/demo.glb',import.meta.url));
const manifest=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());

test('the bundled NSX interior and rim are already double-sided: repair texture alpha/depth without reversing normals',()=>{
  for(const index of [2,4,9,10,11,12,13,14,15,17,26,29]) {
    const source=manifest.materials[index];assert.equal(source.doubleSided,true);assert.equal(source.alphaMode,'BLEND');
    assert.ok(source.pbrMetallicRoughness.baseColorTexture);
    const material=new MeshPhysicalMaterial({side:DoubleSide,transparent:true,depthWrite:false});
    normalizeDemoSurface(material,index,true);
    assert.equal(material.side,DoubleSide);assert.equal(material.transparent,false);assert.equal(material.depthWrite,true);assert.equal(material.alphaTest,.08);
    material.dispose();
  }
});

test('glass and imported transparent assets retain authored blending',()=>{
  for(const [index,isDemo,opacity] of [[22,true,.25],[23,true,.56],[24,true,.25],[13,false,1],[4,true,.6]]) {
    const material=new MeshPhysicalMaterial({transparent:true,depthWrite:false,opacity,side:DoubleSide});
    normalizeDemoSurface(material,index,isDemo);
    assert.equal(material.transparent,true);assert.equal(material.depthWrite,false);assert.equal(material.opacity,opacity);assert.equal(material.alphaTest,0);
    material.dispose();
  }
});

test('front, back and double-sided edits have distinct culling; alpha cutouts write depth and use hardware coverage',()=>{
  const original={opacity:1,doubleSide:true,alphaMode:'mask',alphaCutoff:.08};
  for(const [sideMode,side] of [['source',DoubleSide],['front',FrontSide],['back',BackSide],['double',DoubleSide]]) {
    assert.equal(surfacePolicy({sideMode},original,4).side,side);
  }
  assert.deepEqual(surfacePolicy({},original,4),{opacity:1,side:DoubleSide,transparent:false,depthWrite:true,alphaTest:.08,alphaToCoverage:true});
  const mat=new MeshPhysicalMaterial();applySurfacePolicy(mat,{},original,4);const version=mat.version;
  applySurfacePolicy(mat,{},original,4);assert.equal(mat.version,version);
  applySurfacePolicy(mat,{alphaMode:'blend',opacity:.4},original,0);
  assert.equal(mat.transparent,true);assert.equal(mat.depthWrite,false);assert.equal(mat.alphaToCoverage,false);assert.equal(mat.alphaTest,0);assert.equal(mat.opacity,.4);
  mat.dispose();
});

test('shared materials expose only UV channels available on every mesh and preserve side choices in projects',()=>{
  const a=new BoxGeometry(),b=new BoxGeometry();a.setAttribute('uv1',new BufferAttribute(new Float32Array(a.attributes.uv.array),2));
  assert.deepEqual(geometryUvChannels(a),[0,1]);assert.deepEqual(sharedUvChannels([0,1],b),[0]);
  const state=clone(DEFAULT_STATE);state.selectedMaterial='mat-7';state.materials={'mat-7':{finish:'original',sideMode:'back',doubleSide:false,alphaMode:'mask',alphaCutoff:.08,uvChannel:1}};
  assert.deepEqual(validateProject(makeProject(state,{type:'demo',name:'NSX'})).state,state);
  a.dispose();b.dispose();
});

test('picking uses the active texture UV and skips transparent cutout pixels',async()=>{
  const {Texture,Mesh,Vector3}=await import('three');
  const {visibleSurfaceHit}=await import('../src/surfacePicking.js');
  const geometry=new BoxGeometry();
  geometry.setAttribute('uv1',new BufferAttribute(new Float32Array(geometry.attributes.uv.count*2).fill(.75),2));
  geometry.attributes.uv.array.fill(.1);
  const map=new Texture({width:2,height:1,data:new Uint8Array([255,255,255,0,255,255,255,255])});map.flipY=false;
  const material=new MeshPhysicalMaterial({map,alphaTest:.08,side:DoubleSide});
  const mesh=new Mesh(geometry,material);mesh.userData.pvBaseMaterials=material;
  const hit={object:mesh,face:{a:0,b:1,c:2,materialIndex:0},barycoord:new Vector3(1,0,0)};
  assert.equal(visibleSurfaceHit(hit),false);
  map.channel=1;assert.equal(visibleSurfaceHit(hit),true);
  material.transparent=true;material.opacity=0;assert.equal(visibleSurfaceHit(hit),false);
  geometry.dispose();material.dispose();map.dispose();
});
