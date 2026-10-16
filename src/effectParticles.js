import * as THREE from 'three';
import { EFFECT_CYCLE } from './objectEffectsState.js';

const pars = `
uniform float pvFxTime,pvFxSpan,pvFxIntensity,uSize,uSpread,uLength,uPixels,uMode,uReverse;
uniform vec3 pvFxColor,pvFxAxis,pvFxCenter,uCamera;
attribute float seed, sampleVisible;
varying float vAlpha;
#include <common>
#include <clipping_planes_pars_vertex>
#include <fog_pars_vertex>
`;
const movement = `
  vec3 p=position;
  float phase=pvFxTime/${EFFECT_CYCLE.toFixed(1)};
  float cycle=.5-.5*cos(phase*6.28318);
  vec3 tangent=normalize(cross(normal,abs(normal.y)>.9?vec3(1.,0.,0.):vec3(0.,1.,0.)));
  if(uMode>.5 && uMode<1.5) {
    vec3 direction=normalize(normal*.65+vec3(sin(seed*43.),.35+seed,cos(seed*37.))*.6);
    p+=direction*cycle*uSpread*pvFxSpan*(.18+seed*.65);
  } else if(uMode>1.5 && uMode<2.5) {
    float orbit=(phase+seed)*6.28318;
    p+=normal*(.015+.5+.5*sin(orbit))*uSpread*pvFxSpan*.16;
    p+=tangent*sin(orbit*2.0)*uSpread*pvFxSpan*.12;
  }
  vAlpha=(.38+.62*pow(1.-abs(dot(normalize(normal),normalize(uCamera-p))),1.5))*pvFxIntensity*sampleVisible;
`;
const fragment = `
uniform vec3 pvFxColor; varying float vAlpha;
#include <common>
#include <clipping_planes_pars_fragment>
#include <fog_pars_fragment>
void main(){
  #include <clipping_planes_fragment>
  float radius=length(gl_PointCoord-.5);
  float alpha=(1.-smoothstep(.25,.5,radius))*vAlpha;
  if(alpha<.01)discard;
  gl_FragColor=vec4(pvFxColor*1.7,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function createParticleObject(samples, uniforms, kind) {
  const geometry=new THREE.BufferGeometry();
  const streaks=kind==='streaks',total=samples.count*(streaks?2:1);
  geometry.setAttribute('position',new THREE.BufferAttribute(streaks?new Float32Array(total*3):samples.positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('normal',new THREE.BufferAttribute(streaks?new Float32Array(total*3):samples.normals,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('seed',new THREE.BufferAttribute(streaks?new Float32Array(total):samples.seeds,1));
  geometry.setAttribute('sampleVisible',new THREE.BufferAttribute(streaks?new Float32Array(total):samples.visibility,1));
  if(streaks)geometry.setAttribute('tail',new THREE.BufferAttribute(Float32Array.from({length:total},(_,i)=>i%2),1));
  const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,clipping:true,
    vertexShader:streaks?`${pars}
      attribute float tail;varying float vTail;
      void main(){${movement}
        float travel=fract(phase*3.0+seed);
        p+=pvFxAxis*uReverse*(travel*.8+tail*(.015+uLength*.18))*pvFxSpan;
        vTail=tail;vAlpha*=sin(travel*3.14159);
        vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
        #include <clipping_planes_vertex>
        #include <fog_vertex>
      }`:`${pars}
      void main(){${movement}
        vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
        gl_PointSize=clamp(uSize*pvFxSpan*uPixels/max(.1,-mvPosition.z),1.,7.);
        #include <clipping_planes_vertex>
        #include <fog_vertex>
      }`,
    fragmentShader:streaks?`
      uniform vec3 pvFxColor;varying float vAlpha,vTail;
      #include <common>
      #include <clipping_planes_pars_fragment>
      #include <fog_pars_fragment>
      void main(){
        #include <clipping_planes_fragment>
        gl_FragColor=vec4(pvFxColor*2.,vAlpha*(1.-vTail*.95));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`:fragment,
  });
  const object=streaks?new THREE.LineSegments(geometry,material):new THREE.Points(geometry,material);
  object.name=`Product FX · ${kind}`;object.frustumCulled=false;object.raycast=()=>{};object.renderOrder=2;
  const sync=()=>{
    if(streaks)for(let i=0;i<samples.count;i++)for(let end=0;end<2;end++){
      geometry.attributes.position.array.set(samples.positions.subarray(i*3,i*3+3),(i*2+end)*3);
      geometry.attributes.normal.array.set(samples.normals.subarray(i*3,i*3+3),(i*2+end)*3);
      geometry.attributes.seed.array[i*2+end]=samples.seeds[i];
      geometry.attributes.sampleVisible.array[i*2+end]=samples.visibility[i];
    }
    geometry.attributes.position.needsUpdate=true;geometry.attributes.normal.needsUpdate=true;
    geometry.attributes.sampleVisible.needsUpdate=true;
  };
  sync();
  return {object,geometry,material,sync,setCount(count){geometry.setDrawRange(0,count*(streaks?2:1));},dispose(){object.removeFromParent();geometry.dispose();material.dispose();}};
}

export function createFilaments(uniforms, size, bands=5, segments=64) {
  const geometry=new THREE.BufferGeometry(),vertices=[],indices=[];
  for(let band=0;band<bands;band++) {
    for(let i=0;i<=segments;i++)for(const side of [-1,1])vertices.push(i/segments,side,band/Math.max(1,bands-1));
    for(let i=0;i<segments;i++){const n=band*(segments+1)*2+i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);
  const material=new THREE.ShaderMaterial({uniforms:{...uniforms,uBounds:{value:size.clone()}},side:THREE.DoubleSide,forceSinglePass:true,transparent:true,depthWrite:false,clipping:true,
    vertexShader:`
      uniform float pvFxTime,pvFxSpan,uSize,uSpread,pvFxIntensity;
      uniform vec3 pvFxCenter,uBounds;
      varying float vAcross,vGlow;
      #include <common>
      #include <clipping_planes_pars_vertex>
      vec3 path(float t,float band){
        float angle=t*6.28318;
        float tilt=(band-.5)*2.5;
        vec3 radius=(uBounds+pvFxSpan*(.08+uSpread*.25))*.55;
        return pvFxCenter+vec3(cos(angle)*radius.x,sin(angle)*radius.y*sin(tilt),sin(angle)*radius.z*cos(tilt));
      }
      void main(){
        vec3 p=path(position.x,position.z),next=path(position.x+.002,position.z);
        vec4 mvPosition=modelViewMatrix*vec4(p,1.);
        vec3 tangent=(modelViewMatrix*vec4(next,1.)).xyz-mvPosition.xyz;
        vec2 side=normalize(vec2(-tangent.y,tangent.x)+vec2(.000001));
        mvPosition.xy+=side*position.y*uSize*pvFxSpan*.0018;
        gl_Position=projectionMatrix*mvPosition;
        vAcross=position.y;vGlow=(.12+.88*pow(.5+.5*sin(position.x*6.28318-pvFxTime/${EFFECT_CYCLE.toFixed(1)}*6.28318+position.z*3.),5.))*pvFxIntensity;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader:`
      uniform vec3 pvFxColor;varying float vAcross,vGlow;
      #include <clipping_planes_pars_fragment>
      void main(){
        #include <clipping_planes_fragment>
        gl_FragColor=vec4(pvFxColor*2.,(1.-abs(vAcross))*vGlow);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const object=new THREE.Mesh(geometry,material);object.name='Product FX · filaments';object.frustumCulled=false;object.raycast=()=>{};object.renderOrder=2;
  return {object,geometry,material,setCount(count){geometry.setDrawRange(0,Math.max(1,Math.round(count))*segments*6);},dispose(){object.removeFromParent();geometry.dispose();material.dispose();}};
}
