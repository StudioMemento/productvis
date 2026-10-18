import * as THREE from 'three';
import { createConcreteMaps } from './amberHaloMaterial.js';

export const ISLAND_RADIUS = 3.65;
export const ISLAND_TOP = -.012;
export const WATER_LEVEL = -.29;

export function createNaturePlatform(s, coarse=false) {
  const group=new THREE.Group(),maps=createConcreteMaps(coarse);
  for(const texture of Object.values(maps))texture.repeat.set(6,6);
  const material=new THREE.MeshStandardMaterial({...maps,color:s.groundColor,roughness:s.floorRoughness,
    metalness:.22,normalScale:new THREE.Vector2(.16,.16),dithering:true});
  const platform=new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_RADIUS,ISLAND_RADIUS+.025,.3,96),material);
  platform.name='Product island';platform.position.y=ISLAND_TOP-.15;platform.receiveShadow=true;
  group.add(platform);
  const bandMaterial=new THREE.MeshBasicMaterial({color:s.ringColor});
  const band=new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_RADIUS+.007,ISLAND_RADIUS+.007,.012,96,1,true),bandMaterial);
  band.position.y=-.22;band.name='Island rim light';group.add(band);
  return {group,maps,update(config){
    material.color.set(config.groundColor);material.roughness=Math.max(.12,config.floorRoughness);
    bandMaterial.color.set(config.ringColor).multiplyScalar(config.preset==='water'?1.8:.4);
  }};
}

export function createNatureProbe(s) {
  const scene=new THREE.Scene();scene.background=new THREE.Color(s.background);
  for(const [w,h,pos,col,intensity] of [
    [8,5,[0,8,0],'#e5edff',2.6], [4,6,[-6,3,-3],'#a7c3ef',2.2], [3,6,[6,3,-5],s.ringColor,2.5],
  ]){
    const material=new THREE.MeshBasicMaterial({color:new THREE.Color(col).multiplyScalar(intensity),side:THREE.DoubleSide});
    const card=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);card.position.fromArray(pos);card.lookAt(0,1,0);scene.add(card);
  }
  return scene;
}
