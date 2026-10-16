import * as THREE from 'three';
export function createVelocityStage(s,coarse=false){
  const group=new THREE.Group();group.name='Velocity Lines · clear product corridor';
  const count=Math.round((coarse?18:30)*( .45+s.density*.55)),positions=[],phases=[];
  let seed=s.seed|0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  // Parallel ribbons stay outside the product footprint; every tail fades before it wraps.
  for(let i=0;i<count;i++){
    const x=(i%2?1:-1)*(4.1+random()*5*s.spread),y=.15+random()*3.4*s.height,z=-28+random()*42,phase=random();
    const length=2+random()*6;
    positions.push(x,y,z,x,y,z+length);phases.push(phase,phase);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,uniforms:{time:{value:0},tint:{value:new THREE.Color(s.ringColor)}},
    vertexShader:'attribute float phase;uniform float time;varying float fade;void main(){vec3 p=position;float travel=mod(p.z+time*8.,54.);p.z=travel-32.;fade=smoothstep(0.,8.,travel)*(1.-smoothstep(40.,54.,travel))*(.28+phase*.42);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
    fragmentShader:'uniform vec3 tint;varying float fade;void main(){gl_FragColor=vec4(tint,fade);}'});
  const lines=new THREE.LineSegments(geometry,material);lines.frustumCulled=false;group.add(lines);
  return {group,update(config,time){material.uniforms.time.value=time*config.speed;material.uniforms.tint.value.set(config.ringColor);return config.speed>0;}};
}
