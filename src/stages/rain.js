import * as THREE from 'three';
export function createRainStage(s,coarse=false){
  const group=new THREE.Group();group.name='Rain · skyline';
  let seed=s.seed|0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const stone=new THREE.MeshStandardMaterial({color:s.groundColor,roughness:.65,metalness:.18});
  const n=Math.round(8+s.density*(coarse?20:36)),blocks=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),stone,n),dummy=new THREE.Object3D();
  for(let i=0;i<n;i++){const w=(.7+random()*1.6)*s.scale,h=(1+random()*8)*s.height;dummy.position.set((i%2?1:-1)*(5+w+random()*7*s.spread),h/2-.02,-6-random()*26*s.spread);dummy.scale.set(w,h,w);dummy.updateMatrix();blocks.setMatrixAt(i,dummy.matrix);}
  blocks.receiveShadow=true;blocks.computeBoundingSphere();group.add(blocks);
  const positions=[];for(let i=0;i<(coarse?180:360);i++){let x=(random()-.5)*24,z=(random()-.5)*30;if(Math.abs(x)<3.4&&Math.abs(z)<3.7)x=(x<0?-1:1)*3.8;const y=random()*10;positions.push(x,y,z,x-.025,y+.18+random()*.2,z);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const rain=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0},amount:{value:s.weather},tint:{value:new THREE.Color(s.ringColor)}},vertexShader:'uniform float time;void main(){vec3 p=position;p.y=mod(p.y-time*4.,10.);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',fragmentShader:'uniform float amount;uniform vec3 tint;void main(){gl_FragColor=vec4(tint,amount*.32);}'});
  const drops=new THREE.LineSegments(geometry,rain);drops.frustumCulled=false;group.add(drops);
  return {group,update(config,time){stone.color.set(config.groundColor);rain.uniforms.time.value=time*config.speed;rain.uniforms.amount.value=config.weather;rain.uniforms.tint.value.set(config.ringColor);return config.speed>0&&config.weather>0;}};
}
