import * as THREE from 'three';
import { addHorizonToMaterial, createHorizon } from './horizon.js';
import { natureSettings, stageClock } from './natureSettings.js';
import { createNaturePlatform, createNatureProbe, ISLAND_RADIUS, WATER_LEVEL } from './naturePlatform.js';

export const WATER_WAVES_GLSL = `
  uniform float pvWaterTime,pvWaterWaves,pvWaterScale,pvWaterRipples;
  vec3 pvWave(vec2 p) {
    float f=mix(.45,1.4,pvWaterScale),t=pvWaterTime;
    vec2 a=vec2(.94,.34)*f,b=vec2(-.42,.91)*f*1.43,c=vec2(.19,-.98)*f*.72;
    float x=dot(p,a)-t*.8,y=dot(p,b)+t*.63,z=dot(p,c)-t*.43;
    float amplitude=pvWaterWaves*.1;
    float h=(sin(x)*.55+sin(y)*.28+sin(z)*.17)*amplitude;
    vec2 slope=(cos(x)*a*.55+cos(y)*b*.28+cos(z)*c*.17)*amplitude;
    return vec3(h,slope);
  }
  vec2 pvRipple(vec2 p) {
    float r=max(length(p),.001),edge=max(0.0,r-${ISLAND_RADIUS.toFixed(2)});
    float envelope=exp(-edge*.19)*smoothstep(${ISLAND_RADIUS.toFixed(2)},${(ISLAND_RADIUS+.5).toFixed(2)},r);
    float rings=cos(edge*11.0-pvWaterTime*2.0)*envelope*.095;
    vec2 fine=vec2(cos(dot(p,vec2(7.0,3.0))+pvWaterTime),cos(dot(p,vec2(-4.0,8.0))-pvWaterTime*.7))*.025;
    return (p/r*rings+fine)*pvWaterRipples;
  }
`;

// Polar tessellation spends vertices near the product and leaves the far field
// sparse. All actual mesh edges are beyond the shared horizon's fade range.
export function createWaterGeometry(coarse=false) {
  const rings=coarse?16:24,sectors=coarse?64:96,positions=[],uvs=[],indices=[];
  for(let ring=0;ring<=rings;ring++){
    const radius=100*(ring/rings)**2;
    for(let sector=0;sector<=sectors;sector++){
      const angle=sector/sectors*Math.PI*2,x=Math.sin(angle)*radius,z=Math.cos(angle)*radius;
      positions.push(x,0,z);uvs.push(x/200+.5,z/200+.5);
      if(ring<rings&&sector<sectors){const a=ring*(sectors+1)+sector,b=a+sectors+1;indices.push(a,b,a+1,b,b+1,a+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  // Increasing angle is clockwise seen from above; keep the surface facing +Y.
  const normal=geometry.attributes.normal;
  for(let i=0;i<normal.count;i++)normal.setXYZ(i,0,1,0);
  geometry.computeBoundingSphere();return geometry;
}

export function createWaterMaterial(s,horizon) {
  const uniforms={
    pvWaterTime:{value:0},pvWaterWaves:{value:.35},pvWaterScale:{value:.55},pvWaterRipples:{value:.55},
    pvWaterReflection:{value:null},pvWaterMatrix:{value:new THREE.Matrix4()},pvWaterPlanar:{value:0},pvWaterStrength:{value:s.reflection},
  };
  const material=new THREE.MeshPhysicalMaterial({color:'#0d1b29',metalness:0,roughness:.13,ior:1.333,
    clearcoat:0,envMapIntensity:1,dithering:true});
  material.name='Water · wave normals and planar reflection';
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=WATER_WAVES_GLSL+'\nvarying vec3 pvWaterWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed.y+=pvWave(position.xz).x;');
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\npvWaterWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader=WATER_WAVES_GLSL+`
      varying vec3 pvWaterWorld; uniform sampler2D pvWaterReflection;
      uniform mat4 pvWaterMatrix; uniform float pvWaterPlanar,pvWaterStrength;\n`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec2 waterSlope=pvWave(pvWaterWorld.xz).yz+pvRipple(pvWaterWorld.xz);
      vec3 waterNormal=normalize(vec3(-waterSlope.x,1.0,-waterSlope.y));
      normal=normalize(mat3(viewMatrix)*waterNormal);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      if(pvWaterPlanar>.5){
        vec4 projected=pvWaterMatrix*vec4(pvWaterWorld,1.0);
        vec2 uv=projected.xy/max(projected.w,.001)+waterSlope*.032;
        float valid=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0)*step(.001,projected.w);
        vec3 reflected=texture2D(pvWaterReflection,clamp(uv,0.001,.999)).rgb;
        float fresnel=.04+.96*pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),5.0);
        outgoingLight=mix(outgoingLight,reflected,valid*pvWaterStrength*(.35+.65*fresnel));
      }
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=> 'pv-water-v1';
  addHorizonToMaterial(material,horizon);
  return {material,uniforms};
}

function createEclipse(s) {
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{accent:{value:new THREE.Color(s.ringColor)}},
    vertexShader:'varying vec2 vDisc;void main(){vDisc=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec2 vDisc;uniform vec3 accent;
      void main(){
        float radius=length(vDisc),edge=abs(radius-.76);
        float line=exp(-edge*310.0),aura=exp(-edge*40.0)*.15;
        float disc=1.0-smoothstep(.754,.76,radius);
        float alpha=max(disc,(line+aura)*(1.0-smoothstep(.88,1.0,radius)));
        if(alpha<.001)discard;
        vec3 rim=mix(vec3(.52,.72,1.0),accent,smoothstep(-.6,.6,vDisc.x));
        vec3 radiance=vec3(.004,.007,.012)*disc+rim*(line*4.0+aura);
        gl_FragColor=vec4(radiance,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(22,22),material);
  mesh.position.set(0,10,-26);mesh.name='Tidal eclipse';return mesh;
}

export function createWaterStage(s,coarse=false,sharedHorizon) {
  const group=new THREE.Group();group.name='Water · tidal eclipse';
  const horizon=sharedHorizon||createHorizon(s);if(!sharedHorizon)group.add(horizon.sky);
  const platform=createNaturePlatform(s,coarse);group.add(platform.group);
  const {material,uniforms}=createWaterMaterial(s,horizon);
  const water=new THREE.Mesh(createWaterGeometry(coarse),material);water.position.y=WATER_LEVEL;water.name='Water surface';water.frustumCulled=false;group.add(water);
  const eclipse=createEclipse(s);group.add(eclipse);
  const clock=stageClock();
  const result={group,floorVisible:false,reflectionSpan:90,reflectionY:WATER_LEVEL,usesCachedReflection:true,isWater:true,reflectionActive:false,
    createProbe:createNatureProbe,probeSignature:config=>`water:${config.background}:${config.ringColor}`,
    bindReflection(reflector){
      if(!reflector)return;
      uniforms.pvWaterReflection.value=reflector.getRenderTarget().texture;
      const inverse=new THREE.Matrix4();
      water.onBeforeRender=(renderer,scene,camera)=>{
        if(!result.reflectionActive||scene.overrideMaterial)return;
        const wasWater=water.visible,wasReflector=reflector.visible;
        water.visible=false;reflector.visible=false;reflector.updateMatrixWorld(true);
        try{
          reflector.onBeforeRender(renderer,scene,camera);
          // Reflector's matrix expects LOCAL coordinates; this shader uses world.
          inverse.copy(reflector.matrixWorld).invert();
          uniforms.pvWaterMatrix.value.copy(reflector.material.uniforms.textureMatrix.value).multiply(inverse);
        }
        finally{water.visible=wasWater;reflector.visible=wasReflector;}
      };
    },
    update(config,time=0,context={}){
      const v=natureSettings(config);horizon.update(config);platform.update(config);
      uniforms.pvWaterTime.value=clock.update(time,config.speed,context);
      uniforms.pvWaterWaves.value=v.waterWaves;uniforms.pvWaterScale.value=v.waterScale;uniforms.pvWaterRipples.value=v.waterRipples;
      material.color.set(config.groundColor).multiplyScalar(.45);material.roughness=Math.max(.065,config.floorRoughness*.42);
      uniforms.pvWaterStrength.value=config.reflection;
      result.reflectionActive=context.quality!=='fluid'&&!context.alpha&&context.inspection?.view!=='normals'&&config.reflection>.015;
      uniforms.pvWaterPlanar.value=result.reflectionActive?1:0;
      eclipse.material.uniforms.accent.value.set(config.ringColor);
      return config.speed>0&&!context.reducedMotion&&(v.waterWaves>0||v.waterRipples>0);
    },
    get phase(){return clock.phase;},restorePhase(value,time){clock.restore(value,time);},
  };
  result.update(s);return result;
}
