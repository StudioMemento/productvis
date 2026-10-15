import * as THREE from 'three';
import { createConceptStage } from './conceptStages.js';
export { CUSTOM_SCENES } from './state.js';
export function seededRandom(seed) { let a=seed|0;return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;}; }

// Bounded procedural sets. The clear central corridor belongs to the product.
export function createEnvironmentStage(s,coarse=false) {
  const concept=createConceptStage(s,coarse);if(concept)return concept;
  const group=new THREE.Group();group.name=`Environment ${s.preset}`;
  const random=seededRandom(s.seed),accent=new THREE.Color(s.ringColor);
  const stone=new THREE.MeshStandardMaterial({color:s.groundColor,roughness:.72,metalness:.15,flatShading:true});
  const glow=new THREE.MeshBasicMaterial({color:accent,transparent:true,opacity:.55,toneMapped:false,depthWrite:false});
  const geometries=new Set(),materials=new Set([stone,glow]);
  const box=new THREE.BoxGeometry(1,1,1);geometries.add(box);
  const mesh=(geo,mat,x,y,z,sx=1,sy=1,sz=1)=>{
    const item=new THREE.Mesh(geo,mat);item.position.set(x,y,z);item.scale.set(sx,sy,sz);item.receiveShadow=true;
    group.add(item);geometries.add(geo);materials.add(mat);return item;
  };
  const n=Math.round(8+s.density*(coarse?28:48));
  if(['desert','mountain'].includes(s.preset)) {
    const geo=s.preset==='desert'?new THREE.IcosahedronGeometry(1,1):new THREE.ConeGeometry(1,2,6,1);
    for(let i=0;i<n;i++) {
      const radius=(1+random()*2.3)*s.scale,h=(s.preset==='desert'?.8:2.3)*(1+random()*1.7)*s.height;
      const x=(i%2?1:-1)*(4+radius+(random()*8)*s.spread),z=(random()-.7)*32*s.spread;
      const item=mesh(geo,stone,x,s.preset==='desert'?-.2:h*.5,z,radius,s.preset==='desert'?h:h*.5,radius);
      item.rotation.y=random()*Math.PI;
    }
  }
  if(['urban','rain','monolith'].includes(s.preset)) {
    const instances=new THREE.InstancedMesh(box,stone,n),dummy=new THREE.Object3D();
    instances.name='Low poly skyline';instances.receiveShadow=true;
    for(let i=0;i<n;i++) {
      const width=(.6+random()*1.8)*s.scale,height=(1+random()*(s.preset==='monolith'?6:9))*s.height;
      const x=(i%2?1:-1)*(4+width+random()*7*s.spread),z=(random()-.68)*35*s.spread;
      dummy.position.set(x,height/2-.02,z);dummy.scale.set(width,height,s.preset==='monolith'?width*.3:width);
      dummy.rotation.y=s.preset==='monolith'?(random()-.5)*.6:0;dummy.updateMatrix();instances.setMatrixAt(i,dummy.matrix);
      instances.setColorAt(i,new THREE.Color(1,1,1).multiplyScalar(.75+random()*.6));
      if(i%3===0)mesh(box,glow,x-width*.5-.005,height*.65,z,.014,height*.28,.016);
    }
    group.add(instances);
  }
  if(s.preset==='tunnel') {
    const count=Math.round(5+s.density*12);
    for(let i=0;i<count;i++) {
      const z=-4-i*3.4*s.spread,height=4+s.height*1.8,width=4.5+s.scale;
      for(const sign of [-1,1]) {
        mesh(box,stone,sign*width,height/2,z,.25,height,.28);
        mesh(box,glow,sign*(width-.13),height/2,z,.014,height*.9,.025);
      }
      mesh(box,stone,0,height,z,width*2,.25,.28);
      mesh(box,glow,0,height-.13,z,width*1.85,.018,.025);
    }
  }
  if(s.preset==='grid') {
    const points=[],extent=40,step=1.4*s.scale;
    for(let i=-20;i<=20;i++) {
      points.push(i*step,.006,-extent,i*step,.006,extent,-extent,.006,i*step,extent,.006,i*step);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometries.add(geo);
    const mat=new THREE.LineBasicMaterial({color:accent,transparent:true,opacity:.12+s.density*.22,depthWrite:false});materials.add(mat);
    group.add(new THREE.LineSegments(geo,mat));
    for(const sign of [-1,1])mesh(box,stone,sign*6,1.5*s.height,-7,1,3*s.height,1);
  }
  let road,rain;
  if(s.preset==='road') {
    road=new THREE.ShaderMaterial({transparent:true,depthWrite:true,uniforms:{time:{value:0},glitch:{value:s.glitch},accent:{value:accent}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;uniform float time,glitch;uniform vec3 accent;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){vec2 cell=floor(vUv*vec2(8.,70.));float center=1.-smoothstep(.04,.1,abs(vUv.y-.5));
          float gate=hash(cell+floor(time*.65));if(center<.5&&gate<glitch*.38)discard;
          float edge=smoothstep(.04,.08,vUv.x)*(1.-smoothstep(.92,.96,vUv.x));
          float lane=1.-smoothstep(.008,.018,abs(abs(vUv.x-.5)-.42));
          float dash=(1.-smoothstep(.003,.008,abs(vUv.x-.5)))*step(.5,fract(vUv.y*42.-time*.12));
          vec3 color=vec3(.022,.033,.047)+accent*(lane*.4+dash*.2);
          gl_FragColor=vec4(color,edge*(.82+center*.18));}`});materials.add(road);
    const item=mesh(new THREE.PlaneGeometry(8,100),road,0,-.01,0);item.rotation.x=-Math.PI/2;
    for(const sign of [-1,1])for(let i=0;i<8;i++)mesh(box,glow,sign*4.15,-.05,-6-i*6,.014,.02,2.5);
  }
  if(s.preset==='rain') {
    const count=coarse?180:360,points=[];
    for(let i=0;i<count;i++) {
      let x=(random()-.5)*24,z=(random()-.5)*30;
      if(Math.abs(x)<2.7&&Math.abs(z)<3.5)x=(x<0?-1:1)*3.5;
      const y=random()*10;
      points.push(x,y,z,x-.025,y+.15+random()*.22,z);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometries.add(geo);
    rain=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0},amount:{value:s.weather},tint:{value:accent}},
      vertexShader:'uniform float time;void main(){vec3 p=position;p.y=mod(p.y-time*4.,10.);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
      fragmentShader:'uniform float amount;uniform vec3 tint;void main(){gl_FragColor=vec4(tint,amount*.38);}'});materials.add(rain);
    const lines=new THREE.LineSegments(geo,rain);lines.frustumCulled=false;group.add(lines);
  }
  // Repeated static shapes share draw calls as well as geometry and materials.
  const batches=new Map();
  for(const item of group.children)if(item.isMesh&&!item.isInstancedMesh){
    let byMaterial=batches.get(item.geometry);if(!byMaterial){byMaterial=new Map();batches.set(item.geometry,byMaterial);}
    const items=byMaterial.get(item.material)||[];items.push(item);byMaterial.set(item.material,items);
  }
  for(const [geometry,byMaterial] of batches)for(const [material,items] of byMaterial)if(items.length>1){
    const batch=new THREE.InstancedMesh(geometry,material,items.length);batch.receiveShadow=true;
    items.forEach((item,i)=>{item.updateMatrix();batch.setMatrixAt(i,item.matrix);group.remove(item);});
    batch.computeBoundingSphere();group.add(batch);
  }
  // Empty temporary resources never enter the scene's disposal traversal.
  const usedMaterials=new Set(),usedGeometry=new Set();group.traverse(o=>{if(o.geometry)usedGeometry.add(o.geometry);if(o.material)usedMaterials.add(o.material);});
  for(const geo of geometries)if(!usedGeometry.has(geo))geo.dispose();for(const mat of materials)if(!usedMaterials.has(mat))mat.dispose();
  return {group,update(config,time){
    stone.color.set(config.groundColor);glow.color.set(config.ringColor);
    if(road){road.uniforms.time.value=time*config.speed;road.uniforms.glitch.value=config.glitch;road.uniforms.accent.value.set(config.ringColor);}
    if(rain){rain.uniforms.time.value=time*config.speed;rain.uniforms.amount.value=config.weather;rain.uniforms.tint.value.set(config.ringColor);}
    return config.speed>0&&(!!road||(!!rain&&config.weather>0));
  }};
}
