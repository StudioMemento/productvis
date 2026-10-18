import {ShaderChunk} from 'three';

// A stationary world-space noise layer breaks the repeated four-unit tile.
// Two decorrelated samples per map keep colour, normals, roughness and puddles
// together, while the original mipmaps/anisotropy filter the fine grain.
const variationGLSL=`
  varying vec3 pvConcreteWorld;
  vec2 pvConcreteWarp;
  float pvConcreteBlend, pvConcreteMacro;
  float pvConcreteHash(vec2 p){
    vec3 q=fract(vec3(p.xyx)*.1031);
    q+=dot(q,q.yzx+33.33);
    return fract((q.x+q.y)*q.z);
  }
  float pvConcreteNoise(vec2 p){
    vec2 cell=floor(p),f=fract(p);
    vec2 u=f*f*f*(f*(f*6.0-15.0)+10.0);
    return mix(mix(pvConcreteHash(cell),pvConcreteHash(cell+vec2(1,0)),u.x),
      mix(pvConcreteHash(cell+vec2(0,1)),pvConcreteHash(cell+vec2(1,1)),u.x),u.y);
  }
  vec4 pvConcreteSample(sampler2D tex,vec2 uv){
    vec4 a=texture2D(tex,uv+pvConcreteWarp);
    vec4 b=texture2D(tex,uv*1.317+vec2(.371,.619)-pvConcreteWarp*.45);
    return mix(a,b,pvConcreteBlend);
  }
`;
const initializeVariation=`
  vec2 pvGround=pvConcreteWorld.xz;
  pvConcreteWarp=(vec2(pvConcreteNoise(pvGround*.23+vec2(17.3,4.1)),
    pvConcreteNoise(pvGround*.19+vec2(-8.7,23.6)))-.5)*.65;
  pvConcreteBlend=.175+.65*pvConcreteNoise(pvGround*.43+vec2(3.2,-13.1));
  pvConcreteMacro=.65*pvConcreteNoise(pvGround*.075)+.35*pvConcreteNoise(pvGround*.31+vec2(7.1,31.9));
`;
const sampleMaps=source=>source.replace(/texture2D\(\s*(map|normalMap|roughnessMap)\s*,\s*(vMapUv|vNormalMapUv|vRoughnessMapUv)\s*\)/g,'pvConcreteSample($1, $2)');

export function addConcreteVariation(material){
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=shader=>{
    compile.call(material,shader);
    shader.vertexShader='varying vec3 pvConcreteWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\npvConcreteWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader=variationGLSL+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
      initializeVariation+sampleMaps(ShaderChunk.map_fragment)+'\ndiffuseColor.rgb*=mix(.92,1.08,pvConcreteMacro);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',
      sampleMaps(ShaderChunk.roughnessmap_fragment)+'\nroughnessFactor=clamp(roughnessFactor*mix(.92,1.08,pvConcreteMacro),.05,1.0);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',sampleMaps(ShaderChunk.normal_fragment_maps));
    // Includes the Halo wetness lookup installed by the preceding material hook.
    shader.fragmentShader=sampleMaps(shader.fragmentShader);
  };
  material.customProgramCacheKey=()=>key+':world-concrete-noise-v1';
  return material;
}
