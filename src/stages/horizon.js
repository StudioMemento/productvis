import * as THREE from 'three';

// One radiance function for the background AND the far surface. The quintic
// ramp reaches the exact background before any finite geometry/reflector edge.
export const HORIZON_GLSL = `
  uniform vec3 pvSkyBase, pvSkyHaze;
  uniform vec2 pvHorizonRange;
  float pvSmoother(float a, float b, float x) {
    float t = clamp((x-a)/(b-a), 0.0, 1.0);
    return t*t*t*(t*(t*6.0-15.0)+10.0);
  }
  vec3 pvAtmosphere(vec3 ray) {
    float band = exp(-pow(ray.y / .145, 2.0));
    float ceiling = pow(max(ray.y, 0.0), 5.0);
    return pvSkyBase + pvSkyHaze * band + vec3(.024,.033,.048) * ceiling;
  }
  float pvSurfaceFade(vec3 world) {
    return pvSmoother(pvHorizonRange.x, pvHorizonRange.y, length(world.xz));
  }
`;

export function horizonFade(distance, start = 15, end = 58) {
  const t = Math.max(0, Math.min(1, (distance-start)/(end-start)));
  return t*t*t*(t*(t*6-15)+10);
}

export function createHorizon(s) {
  const uniforms = {
    pvSkyBase: { value: new THREE.Color() }, pvSkyHaze: { value: new THREE.Color() },
    pvHorizonRange: { value: new THREE.Vector2(15, 58) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, depthTest: false,
    vertexShader: `varying vec3 pvRay;
      void main(){
        pvRay=position;
        vec4 view=vec4(mat3(viewMatrix)*position,1.0);
        vec4 clip=projectionMatrix*view;
        gl_Position=clip.xyww;
      }`,
    fragmentShader: `${HORIZON_GLSL}
      #include <common>
      #include <dithering_pars_fragment>
      varying vec3 pvRay;
      void main(){
        gl_FragColor=vec4(pvAtmosphere(normalize(pvRay)),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <dithering_fragment>
      }`,
    dithering: true,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 16, 8), material);
  sky.name = 'Seamless horizon'; sky.frustumCulled = false; sky.renderOrder = -1000;
  sky.userData.isBackdrop = true;
  const update = config => {
    uniforms.pvSkyBase.value.set(config.background || '#111722');
    const cloud = config.preset === 'cloud', water = config.preset === 'water';
    uniforms.pvSkyHaze.value.set(cloud ? '#a6aec4' : water ? '#a2b2c8' : '#8494ac');
    uniforms.pvSkyHaze.value.multiplyScalar(cloud ? .18 : water ? .095 : .025 + (config.fog || 0)*.04);
    // A minimum horizon veil remains even with the local fog control at zero.
    uniforms.pvHorizonRange.value.set(cloud ? 18 : 15, 58);
  };
  update(s);
  return { uniforms, sky, update };
}

export function addHorizonToMaterial(material, horizon) {
  const compile = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.fog = false;
  material.onBeforeCompile = shader => {
    compile.call(material, shader);
    Object.assign(shader.uniforms, horizon.uniforms);
    shader.vertexShader = 'varying vec3 pvHorizonWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\npvHorizonWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader = HORIZON_GLSL + '\nvarying vec3 pvHorizonWorld;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      outgoingLight=mix(outgoingLight,pvAtmosphere(normalize(pvHorizonWorld-cameraPosition)),pvSurfaceFade(pvHorizonWorld));
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => key + ':seamless-horizon-v1';
  return material;
}
