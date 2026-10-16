import * as THREE from 'three';
export function createRingStage(s){
  const group=new THREE.Group();group.name='Ring · recessed light platform';
  const base=new THREE.MeshStandardMaterial({color:s.groundColor,metalness:.5,roughness:s.floorRoughness});
  const trim=new THREE.MeshStandardMaterial({color:'#0e131a',metalness:.7,roughness:.25});
  const emission=new THREE.MeshBasicMaterial({color:s.ringColor,toneMapped:false});
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(3.55,3.59,.12,96),base);plinth.position.y=-.07;plinth.receiveShadow=true;group.add(plinth);
  const groove=new THREE.Mesh(new THREE.TorusGeometry(3.39,.043,8,128),trim);groove.rotation.x=-Math.PI/2;groove.position.y=-.005;group.add(groove);
  // Two recessed arcs leave a quiet opening at the front of the product.
  for(const angle of [.13,Math.PI+.13]){
    const arc=new THREE.Mesh(new THREE.TorusGeometry(3.39,.013,6,96,Math.PI-.26),emission);
    arc.rotation.set(-Math.PI/2,0,angle);arc.position.y=.012;group.add(arc);
  }
  return {group,floorVisible:true,reflectionSpan:4.9,update(config){base.color.set(config.groundColor);base.roughness=config.floorRoughness;emission.color.set(config.ringColor);return false;}};
}
