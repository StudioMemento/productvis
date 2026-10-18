import * as THREE from 'three';
import { addHorizonToMaterial, createHorizon } from './horizon.js';
import { natureSettings, cloudBudget, stageClock } from './natureSettings.js';
import { createNaturePlatform, createNatureProbe, ISLAND_RADIUS } from './naturePlatform.js';

let noiseBytes;
export function createCloudNoise() {
  const size=32;
  if(!noiseBytes){
    noiseBytes=new Uint8Array(size**3);let seed=918273;
    for(let i=0;i<noiseBytes.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;noiseBytes[i]=seed>>>24;}
  }
  const texture=new THREE.Data3DTexture(noiseBytes,size,size,size);
  texture.name='Cloud · seamless density volume';texture.format=THREE.RedFormat;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;
  texture.wrapS=texture.wrapT=texture.wrapR=THREE.RepeatWrapping;
  texture.unpackAlignment=1;texture.needsUpdate=true;return texture;
}

export const CLOUD_FRAGMENT = `
  precision highp sampler3D;
  uniform sampler3D cloudNoise;
  uniform mat4 projectionMatrix;
  uniform vec3 cloudColor,cloudAccent,cloudMin,cloudMax;
  uniform float cloudTime,cloudCoverage,cloudFrequency,cloudLight;
  uniform int cloudSteps;
  varying vec3 vCloudWorld;
  out vec4 cloudOutput;
  #define gl_FragColor cloudOutput
  float field(vec3 p) {
    vec3 q=p*cloudFrequency+vec3(cloudTime*.004,0.0,-cloudTime*.0025);
    return texture(cloudNoise,q).r*.58+texture(cloudNoise,q*2.03+vec3(.17,.31,.13)).r*.28+texture(cloudNoise,q*4.07).r*.14;
  }
  float densityAt(vec3 p) {
    float h=clamp((p.y-cloudMin.y)/(cloudMax.y-cloudMin.y),0.0,1.0);
    float envelope=smoothstep(0.0,.2,h)*(1.0-smoothstep(.42,1.0,h));
    float protectedCentre=smoothstep(${(ISLAND_RADIUS-.32).toFixed(2)},${(ISLAND_RADIUS+.35).toFixed(2)},length(p.xz));
    float farFade=1.0-smoothstep(32.0,58.0,length(p.xz));
    float threshold=mix(.68,.31,cloudCoverage);
    return smoothstep(threshold,threshold+.17,field(p))*envelope*protectedCentre*farFade*cloudCoverage*2.6;
  }
  vec2 intersectVolume(vec3 ro,vec3 rd) {
    vec3 inv=1.0/(rd+step(abs(rd),vec3(.00001))*vec3(.00002));
    vec3 a=(cloudMin-ro)*inv,b=(cloudMax-ro)*inv;
    vec3 nearPlane=min(a,b),farPlane=max(a,b);
    return vec2(max(max(nearPlane.x,nearPlane.y),nearPlane.z),min(min(farPlane.x,farPlane.y),farPlane.z));
  }
  void main(){
    vec3 ray=normalize(vCloudWorld-cameraPosition);
    vec2 range=intersectVolume(cameraPosition,ray);
    float start=max(range.x,0.0),end=min(range.y,120.0);
    if(end<=start)discard;
    float transmission=1.0,firstHit=-1.0;
    vec3 sum=vec3(0.0);
    for(int i=0;i<20;i++){
      if(i>=cloudSteps)break;
      float a=float(i)/float(cloudSteps),b=float(i+1)/float(cloudSteps);
      float t=start+(end-start)*((a*a+b*b)*.5);
      float stepLength=(end-start)*(b*b-a*a);
      vec3 p=cameraPosition+ray*t;
      float density=densityAt(p);
      if(density>.001){
        float alpha=1.0-exp(-density*stepLength);
        if(firstHit<0.0&&alpha>.008)firstHit=t;
        float topLight=clamp(.62+(field(p)-field(p+vec3(-.7,1.4,.5)))*1.8,.23,1.0);
        vec3 lit=cloudColor*(.32+topLight*.95)*cloudLight;
        lit+=cloudAccent*pow(topLight,3.0)*.025;
        sum+=lit*transmission*alpha;
        transmission*=1.0-alpha;
        if(transmission<.025)break;
      }
    }
    float alpha=1.0-transmission;
    if(alpha<.008||firstHit<0.0)discard;
    // Depth is the first participating cloud sample, not the far face of the box.
    // This lets opaque product/platform pixels naturally occlude the volume.
    vec4 clip=projectionMatrix*viewMatrix*vec4(cameraPosition+ray*firstHit,1.0);
    gl_FragDepth=clamp((clip.z/clip.w)*.5+.5,0.0,1.0);
    gl_FragColor=vec4(sum/max(alpha,.001),alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createCloudStage(s,coarse=false,sharedHorizon) {
  const group=new THREE.Group();group.name='Cloud · mist island';
  const horizon=sharedHorizon||createHorizon(s);if(!sharedHorizon)group.add(horizon.sky);
  const platform=createNaturePlatform(s,coarse);group.add(platform.group);
  const baseMaterial=addHorizonToMaterial(new THREE.MeshStandardMaterial({color:'#303b50',roughness:1,metalness:0}),horizon);
  const base=new THREE.Mesh(new THREE.PlaneGeometry(160,160),baseMaterial);
  base.rotation.x=-Math.PI/2;base.position.y=-2.5;base.name='Cloud underlay';group.add(base);
  const noise=createCloudNoise();
  const uniforms={cloudNoise:{value:noise},cloudColor:{value:new THREE.Color()},cloudAccent:{value:new THREE.Color(s.ringColor)},
    cloudTime:{value:0},cloudCoverage:{value:.6},cloudFrequency:{value:.025},cloudLight:{value:1},cloudSteps:{value:cloudBudget('auto',coarse)},
    cloudMin:{value:new THREE.Vector3(-64,-2.5,-64)},cloudMax:{value:new THREE.Vector3(64,.3,64)}};
  const material=new THREE.ShaderMaterial({uniforms,glslVersion:THREE.GLSL3,side:THREE.BackSide,transparent:true,depthWrite:false,
    vertexShader:'varying vec3 vCloudWorld;void main(){vec4 world=modelMatrix*vec4(position,1.0);vCloudWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}',
    fragmentShader:CLOUD_FRAGMENT});
  material.userData.ownedTextures=[noise];
  const volume=new THREE.Mesh(new THREE.BoxGeometry(128,1,128),material);
  volume.name='Cloud · bounded volume';volume.frustumCulled=false;volume.renderOrder=3;group.add(volume);
  const clock=stageClock();
  const result={group,atmosphere:volume,floorVisible:false,reflectionSpan:ISLAND_RADIUS*2,reflectionRadius:ISLAND_RADIUS,usesCachedReflection:true,isCloud:true,
    createProbe:createNatureProbe,probeSignature:config=>`cloud:${config.background}:${config.ringColor}`,
    update(config,time=0,context={}){
      const v=natureSettings(config);horizon.update(config);platform.update(config);
      const bottom=v.cloudLevel-v.cloudThickness*1.45,top=v.cloudLevel+v.cloudThickness*.55;
      volume.scale.y=top-bottom;volume.position.y=(top+bottom)*.5;
      uniforms.cloudMin.value.y=bottom;uniforms.cloudMax.value.y=top;
      uniforms.cloudCoverage.value=v.cloudDensity;uniforms.cloudFrequency.value=.012+v.cloudScale*.024;
      uniforms.cloudTime.value=clock.update(time,config.speed,context);
      uniforms.cloudSteps.value=cloudBudget(context.quality,coarse);
      uniforms.cloudColor.value.set(config.groundColor).lerp(new THREE.Color('#bcc6da'),.7);
      uniforms.cloudAccent.value.set(config.ringColor);
      uniforms.cloudLight.value=.4+Math.min(2,context.lighting?.intensity??1)*.6;
      baseMaterial.color.copy(uniforms.cloudColor.value).multiplyScalar(.28);
      volume.visible=v.cloudDensity>.001&&context.inspection?.view!=='normals';
      return volume.visible&&config.speed>0&&!context.reducedMotion;
    },
    get phase(){return clock.phase;},restorePhase(value,time){clock.restore(value,time);},
  };
  result.update(s);return result;
}
