import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const PLINTH_SIZE = 6.8;
export function cubeLayout(composition, seed, scale = 1) {
  const arrangements = [
    [[-6.2,-4.5,3.2,1.2],[0,-7.8,3.8,2.7],[5.8,-6.5,2.8,.1],[-7.5,2.3,2.3,-1.8],[7.9,1.5,2,-2.4]],
    [[-5.9,-5.8,3.5,2.2],[.6,-9.3,4.3,.8],[6.4,-4.9,2.8,1.3],[-7.6,.8,2.7,-1.2],[7.5,3.2,2.2,-2.5]],
    [[-7,-3.7,2.5,-.6],[-3.5,-8.4,3.2,1.2],[3.9,-8.1,4.1,3.1],[7.1,-1.9,2.7,-1],[-7.6,3.8,1.8,-2.6]],
  ];
  let n = seed | 0;
  const random = () => { n = Math.imul(n ^ n >>> 15, 1 | n) + 0x6D2B79F5 | 0; return (n >>> 0) / 4294967296; };
  return arrangements[Math.round(composition) % 3].map(([x,z,size,top],i) => {
    const side = size * scale * (.95 + random() * .1);
    x += (random() - .5) * .6; z += (random() - .5) * .6;
    const clearance = PLINTH_SIZE / 2 + side / 2 + .55;
    if (Math.abs(x) < clearance && Math.abs(z) < clearance) {
      if (Math.abs(x) > Math.abs(z)) x = Math.sign(x || 1) * clearance;
      else z = Math.sign(z || -1) * clearance;
    }
    return { x, z, side, y: top - side / 2, color: ['#333a45','#252d38','#414750','#242c38','#303744'][i] };
  });
}

export function createCubeStage(config) {
  const group = new THREE.Group(); group.name = 'Architectural cubes';
  const baseMaterial = new THREE.MeshStandardMaterial({ color: '#272e38', roughness: config.floorRoughness, metalness: .35 });
  const base = new THREE.Mesh(new RoundedBoxGeometry(PLINTH_SIZE, PLINTH_SIZE, PLINTH_SIZE, 2, .045), baseMaterial);
  base.name = 'Product plinth'; base.position.y = -PLINTH_SIZE / 2;
  base.castShadow = true; base.receiveShadow = true; group.add(base);
  for (const c of cubeLayout(config.composition, config.seed, config.scale)) {
    const cube = new THREE.Mesh(new RoundedBoxGeometry(c.side,c.side,c.side,2,.035),new THREE.MeshStandardMaterial({color:c.color,roughness:.48,metalness:.22}));
    cube.position.set(c.x,c.y,c.z); cube.castShadow=true; cube.receiveShadow=true; group.add(cube);
  }
  // Two short recessed edge lights emphasize the main block's thickness.
  for (const x of [-1,1]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(.013,.014,1.15),new THREE.MeshBasicMaterial({color:'#ffc16b',toneMapped:false}));
    line.position.set(x*(PLINTH_SIZE/2-.008),-.15,PLINTH_SIZE/2-.8); group.add(line);
  }
  return { group, baseMaterial };
}
