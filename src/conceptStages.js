import * as THREE from 'three';
import { STAGE_BY_ID } from './stageCatalog.js';

// One active set. Shared primitives are instanced; effects have no texture downloads,
// simulation, extra shadow lights, or per-frame geometry allocation.
export function createConceptStage(s, coarse = false) {
  const spec = STAGE_BY_ID[s.preset];
  if (!spec) return null;
  const group = new THREE.Group(); group.name = spec.name;
  let seed = s.seed | 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  const resources = new Set(), shaders = [], pulses = [];
  const own = resource => { resources.add(resource); return resource; };
  const stone = own(new THREE.MeshStandardMaterial({ color: s.groundColor, roughness: .7, metalness: .12, flatShading: true }));
  const accent = own(new THREE.MeshBasicMaterial({ color: s.ringColor, toneMapped: false }));
  const dark = own(new THREE.MeshStandardMaterial({ color: '#080b11', roughness: .65 }));
  const white = own(new THREE.MeshBasicMaterial({ color: '#e5eef6', toneMapped: false }));
  const box = own(new THREE.BoxGeometry(1, 1, 1));
  const place = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
    own(geo); own(mat);
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x,y,z); mesh.scale.set(sx,sy,sz);
    mesh.receiveShadow = mat === stone; group.add(mesh); return mesh;
  };
  const slab = (mat, x,y,z, sx,sy,sz) => place(box,mat,x,y,z,sx,sy,sz);
  const n = Math.round(6 + s.density * (coarse ? 14 : 26));
  const height = s.height, spread = s.spread;
  // Interior remains at least 6.4 units wide, even at minimum stage scale/spread.
  const side = 3.7 + s.scale * 1.1, roof = 5.2 + height;
  const ring = (radius, tube, mat, x,y,z, arc = Math.PI*2) => place(own(new THREE.TorusGeometry(radius,tube,6,coarse?48:80,arc)),mat,x,y,z);
  const platform = (radius = 4.3) => place(own(new THREE.CylinderGeometry(radius,radius+.12,.28,coarse?48:80)),stone,0,-.155,0);
  const portal = (z, w = side, h = roof, mat = stone, thickness = .17) => {
    slab(mat,-w,h/2,z,thickness,h,thickness); slab(mat,w,h/2,z,thickness,h,thickness); slab(mat,0,h,z,w*2,thickness,thickness);
  };
  const effect = (mode, opacity = .7) => {
    const material = own(new THREE.ShaderMaterial({ transparent:true, depthWrite:false, side:THREE.DoubleSide, toneMapped:false,
      uniforms:{ time:{value:0}, tint:{value:new THREE.Color(s.ringColor)}, amount:{value:opacity}, weather:{value:s.weather} },
      vertexShader:'varying vec2 vUv; varying vec3 vPos; void main(){vUv=uv;vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec2 vUv;varying vec3 vPos;uniform float time,amount,weather;uniform vec3 tint;
        void main(){vec2 p=vUv;float alpha=1.;vec3 color=tint;
        ${mode==='trails' ? 'float streak=pow(.5+.5*sin(p.x*42.-time*6.),8.);alpha=(.12+streak*.88)*sin(p.y*3.14159);' : ''}
        ${mode==='mist' ? 'float cloud=.5+.5*sin(p.x*12.+sin(p.y*11.+time*.15)*1.5+time*.1);alpha=sin(p.x*3.14159)*sin(p.y*3.14159)*(.1+cloud*.2);' : ''}
        ${mode==='water' ? 'float waves=pow(.5+.5*sin(p.y*190.+sin(p.x*45.+time*.3)*2.+time*.6),14.);color=mix(vec3(.025,.07,.085),tint,.07+waves*.15);alpha=.95;' : ''}
        ${mode==='aurora' ? 'float folds=.5+.5*sin(p.x*24.+sin(p.x*8.+time*.3)*3.+time*.25);alpha=sin(p.x*3.14159)*pow(sin(p.y*3.14159),1.7)*(.15+folds*.65);color=mix(tint,vec3(.3,.32,.85),p.y);' : ''}
        gl_FragColor=vec4(color,alpha*amount);}` }));
    shaders.push(material); return material;
  };
  const mist = () => {
    const mat=effect('mist',.65),geo=own(new THREE.PlaneGeometry(48,38));
    for(let i=0;i<2;i++){const m=place(geo,mat,0,-.22-i*.28,-8-i*4);m.rotation.x=-Math.PI/2;m.rotation.z=i*.6;}
  };
  const rain = (backOnly = false) => {
    const points=[], count=coarse?144:288;
    for(let i=0;i<count;i++){
      let x=(random()-.5)*28,z=backOnly?-5-random()*14:(random()-.65)*32;
      if(Math.abs(x)<3.3&&Math.abs(z)<3.5)x=(x<0?-1:1)*(side+random()*3);
      const y=random()*11;points.push(x,y,z,x-.035,y+.2+random()*.18,z);
    }
    const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    const mat=own(new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,
      uniforms:{time:{value:0},tint:{value:new THREE.Color(s.ringColor)},weather:{value:s.weather}},
      vertexShader:'uniform float time;varying float fade;void main(){vec3 p=position;p.y=mod(p.y-time*3.,11.);fade=smoothstep(0.,.8,p.y);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
      fragmentShader:'uniform vec3 tint;uniform float weather;varying float fade;void main(){gl_FragColor=vec4(tint,weather*.45*fade);}'}));
    shaders.push(mat);const lines=new THREE.LineSegments(geo,mat);lines.frustumCulled=false;group.add(lines);
  };
  const trail = (sign, y, z, length = 30) => {
    // Low-poly ribbons imply long exposure while the product stays sharp.
    const points=[new THREE.Vector3(sign*(side+1),y+1,z-length/2),new THREE.Vector3(sign*side,y,z),new THREE.Vector3(sign*(side+3),y-.2,z+length/2)];
    const curve=new THREE.CatmullRomCurve3(points),geo=own(new THREE.TubeGeometry(curve,24,.035,4,false));
    place(geo,effect('trails',.9),0,0,0);
  };
  const rocks = (count, radius = 1.4) => {
    const geo=own(new THREE.ConeGeometry(1,2,5,1));
    for(let i=0;i<count;i++){const r=(.8+random()*radius)*s.scale,h=(.5+random()*2.3)*height;
      const m=place(geo,stone,(i%2?1:-1)*(side+r+random()*4*spread),h/2-.08,-3-random()*25*spread,r,h/2,r);m.rotation.y=random()*6;}
  };
  let floorVisible=true, reflectionSpan=null;
  switch(s.preset){
    case 'black-softbox': {
      slab(white,0,roof+1,-2,5.5,.025,2);slab(stone,0,3.8,-8,22,7.6,.18);
      for(const sign of [-1,1])slab(dark,sign*(side+1),2.5,-4,.3,5,3);break;
    }
    case 'pearl-infinity': {
      // Quarter-cylinder sweep, tangential to the floor, rather than a hard horizon.
      const points=[];for(let i=0;i<=16;i++){const a=i/16*Math.PI/2;points.push(new THREE.Vector2(0,0));points[i].set(3*Math.sin(a),3*(1-Math.cos(a)));}
      const vertices=[],uv=[];for(let i=0;i<16;i++){
        const a=points[i],b=points[i+1];for(const [x,p,t] of [[-22,a,i/16],[22,a,i/16],[22,b,(i+1)/16],[-22,a,i/16],[22,b,(i+1)/16],[-22,b,(i+1)/16]]){vertices.push(x,p.y,-6-p.x);uv.push((x+22)/44,t);}
      }
      const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
      place(geo,stone,0,-.015,0);slab(stone,0,9,-9,44,12,.1);break;
    }
    case 'amber-horizon': slab(stone,0,3,-13,70,6,.18);slab(accent,0,.04,-12.85,70,.025,.025);pulses.push(accent);break;
    case 'halo-floor': {const m=ring(3.7+s.scale*.3,.025,accent,0,.003,0,Math.PI*1.72);m.rotation.x=-Math.PI/2;m.rotation.z=.45;platform(3.6);pulses.push(accent);break;}
    case 'concrete-cut': slab(stone,-7,4.5,-7,10,9,.7);slab(stone,6.4,4.5,-7,11.3,9,.7);slab(accent,-1.9,4.4,-7.2,.12,8.8,.03);{
      const mat=own(new THREE.MeshBasicMaterial({color:s.ringColor,transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide}));
      const m=place(own(new THREE.PlaneGeometry(1.2,8)),mat,-.1,-.005,-2);m.rotation.set(-Math.PI/2,0,-.43);break;}
    case 'neon-gate': portal(-5.5,side,roof,accent,.035);portal(-5.57,side+.07,roof+.07,dark,.13);pulses.push(accent);break;
    case 'rain-veil': slab(white,0,roof,-6,8,.03,.12);rain(true);break;
    case 'twin-blades': {for(const sign of [-1,1]){const m=slab(sign===1?accent:white,sign*side,3,-3,.19,6,.06);m.rotation.z=sign*-.13;}break;}
    case 'mist-island': platform();mist();floorVisible=false;reflectionSpan=6.05;break;
    case 'velocity-lines': for(const sign of [-1,1]){trail(sign,.25,-7);trail(sign,.42,-9);}break;
    case 'neon-rain-cathedral': for(let i=0;i<Math.min(n,9);i++){const z=-5-i*3.8*spread;portal(z,side,roof+1,stone,.22);portal(z+.13,side-.13,roof+.87,accent,.025);}rain();break;
    case 'endless-monoliths': for(let i=0;i<n;i++){const h=(2.5+random()*5)*height;const m=slab(stone,(i%2?1:-1)*(side+random()*8*spread),h/2,-3-random()*40*spread,.55*s.scale,h,1.1*s.scale);m.rotation.y=(random()-.5)*.35;}mist();break;
    case 'brutalist-orbit': {const ceiling=ring(7,.65,stone,0,roof+1,-3,Math.PI*1.85);ceiling.rotation.x=Math.PI/2;const light=ring(6.4,.035,accent,0,roof+.4,-3,Math.PI*1.85);light.rotation.x=Math.PI/2;
      for(const sign of [-1,1])for(let i=0;i<4;i++){const m=slab(stone,sign*(side+1),roof/2,-4-i*4,.28,roof,1.2);m.rotation.z=sign*.12;}break;}
    case 'hyperdrive': for(let i=0;i<Math.min(n,12);i++)portal(-5-i*4,side,roof,stone,.18);for(const sign of [-1,1]){trail(sign,.25,-16,60);trail(sign,2.6,-16,60);trail(sign,4.6,-16,60);}break;
    case 'tidal-eclipse': {platform();const water=place(own(new THREE.PlaneGeometry(100,100,1,1)),effect('water'),0,-.24,-15);water.rotation.x=-Math.PI/2;place(own(new THREE.CircleGeometry(3.2,64)),dark,0,6.8,-19);ring(3.27,.045,accent,0,6.8,-18.98);floorVisible=false;reflectionSpan=6.05;break;}
    case 'aurora-vault': rocks(Math.min(n,14),2);for(let i=0;i<3;i++){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-19,9+i,-22-i*5),new THREE.Vector3(-6,7+i*1.2,-16-i*4),new THREE.Vector3(8,9+i,-20-i*4),new THREE.Vector3(22,7+i,-25-i*4)]);
      const pts=curve.getPoints(32),vertices=[],uv=[];for(let j=0;j<32;j++){for(const [k,v] of [[j,0],[j,1],[j+1,1],[j,0],[j+1,1],[j+1,0]]){vertices.push(pts[k].x,pts[k].y+v*3,pts[k].z);uv.push(k/32,v);}}
      const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();place(geo,effect('aurora'),0,0,0);}break;
    case 'ember-rift': rocks(n,1.6);for(const sign of [-1,1])for(let i=0;i<8;i++){const m=slab(accent,sign*(side+Math.sin(i)*.7),.009,-3-i*3,.045,.018,3.6);m.rotation.y=sign*Math.sin(i+1)*.33;}pulses.push(accent);break;
    case 'kinetic-gallery': for(let i=0;i<Math.min(n,8);i++){const frame=new THREE.Group();group.add(frame);const before=group.children.length;portal(-5-i*4,side,roof,stone,.2);const parts=group.children.slice(before);parts.forEach(p=>frame.attach(p));frame.rotation.z=(i%2?1:-1)*.12;slab(accent,(i%2?1:-1)*side,1.4,-4.85-i*4,.035,2.8,.035);}pulses.push(accent);break;
    case 'signal-garden': for(let i=0;i<Math.min(48,n+10);i++){const h=(.6+random()*3.5)*height,x=(i%2?1:-1)*(side+random()*8*spread),z=-2-random()*25*spread;slab(stone,x,h/2,z,.06,h,.06);slab(accent,x,h+.08,z,.12,.16,.12);}pulses.push(accent);break;
    case 'midnight-skydeck': slab(stone,0,roof+1,-3,15,.32,10);for(const sign of [-1,1])slab(stone,sign*6.5,roof/2,-6,.6,roof,1);slab(accent,0,roof+.8,-.5,13,.024,.05);
      for(let i=0;i<n;i++){const x=(i-n/2)*2.5,h=2+random()*7;slab(stone,x,h/2-1,-23-random()*8,1+random(),h,1.5);if(i%2===0)slab(accent,x,h*.6-1,-21.95, .035,.8,.02);}rain(true);break;
  }
  // Flatten rigid nested frames, then batch compatible geometry/material pairs.
  group.updateMatrixWorld(true);
  const meshes=[];group.traverse(o=>{if(o.isMesh)meshes.push(o);});
  meshes.forEach(o=>{if(o.parent!==group)group.attach(o);});
  for(const child of [...group.children])if(child.isGroup)group.remove(child);
  const batches=new Map();for(const mesh of meshes){const key=mesh.geometry.uuid+mesh.material.uuid;const batch=batches.get(key)||[];batch.push(mesh);batches.set(key,batch);}
  for(const items of batches.values())if(items.length>1){const first=items[0],batch=new THREE.InstancedMesh(first.geometry,first.material,items.length);batch.name=`${spec.name} · modules`;batch.receiveShadow=first.receiveShadow;
    items.forEach((item,i)=>{item.updateMatrix();batch.setMatrixAt(i,item.matrix);group.remove(item);});batch.computeBoundingSphere();group.add(batch);}
  const used=new Set();group.traverse(o=>{if(o.geometry)used.add(o.geometry);if(o.material)used.add(o.material);});for(const resource of resources)if(!used.has(resource))resource.dispose();
  return {group, floorVisible, reflectionSpan, update(config,time){
    stone.color.set(config.groundColor);accent.color.set(config.ringColor);
    const t=time*config.speed;
    for(const shader of shaders){shader.uniforms.time.value=t;shader.uniforms.tint.value.set(config.ringColor);shader.uniforms.weather.value=config.weather;}
    for(const mat of pulses)mat.color.multiplyScalar(.82+Math.sin(t*.8)*.12);
    return config.speed>0 && (spec.effect==='rain'?config.weather>0:!!spec.effect);
  }};
}
