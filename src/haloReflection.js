import { haloBudget, haloSettings } from './stages/amberHaloSettings.js';
import { HORIZON_GLSL } from './stages/horizon.js';

export function configureFloorReflection(reflector, engine) {
  const material = reflector.material;
  material.transparent = true; material.depthWrite = false;
  Object.assign(material.uniforms, {
    pvReflection: { value: .27 }, pvHalo: { value: 0 }, pvDetail: { value: null },
    pvRoughness: { value: .4 }, pvWetness: { value: .55 }, pvMicro: { value: .7 }, pvFog: { value: .015 },
    pvIslandRadius: { value: 0 },
  });
  Object.assign(material.uniforms,engine.horizon?.uniforms||{});
  material.vertexShader = material.vertexShader.replace('varying vec4 vUv;', 'varying vec4 vUv; varying vec3 pvWorld; varying vec2 pvPlaneUv;');
  material.vertexShader = material.vertexShader.replace('vUv = textureMatrix * vec4( position, 1.0 );', 'vUv = textureMatrix * vec4( position, 1.0 ); pvWorld = (modelMatrix * vec4(position, 1.0)).xyz; pvPlaneUv=uv;');
  material.fragmentShader=HORIZON_GLSL+'\n'+material.fragmentShader;
  material.fragmentShader = material.fragmentShader.replace('uniform vec3 color;', `uniform vec3 color;
    uniform float pvReflection, pvHalo, pvRoughness, pvWetness, pvMicro, pvFog;
    uniform sampler2D pvDetail; uniform float pvIslandRadius; varying vec3 pvWorld; varying vec2 pvPlaneUv;`);
  material.fragmentShader = material.fragmentShader.replace('vec4 base = texture2DProj( tDiffuse, vUv );', `
    vec2 uv = vUv.xy / max(vUv.w, .0001);
    float blur = .002, haloMask = 1.0;
    if(pvHalo > .5) {
      vec4 detail = texture2D(pvDetail, pvWorld.xz * .125);
      uv += (detail.rg * 2.0 - 1.0) * .008 * pvMicro;
      blur = mix(.002, .022, pvRoughness) * (1.0 - pvWetness * .45);
      float grazing = 1.0 - abs(normalize(cameraPosition - pvWorld).y);
      haloMask = (.28 + .72 * pow(grazing, 4.0)) * mix(.3, 1.0, pvWetness) * mix(.5, 1.0, detail.a);
      haloMask *= exp(-pow(length(cameraPosition - pvWorld) * pvFog, 2.0));
    }
    vec4 base;
    if(pvHalo > .5) {
      base = texture2D(tDiffuse, uv) * .28;
      base += texture2D(tDiffuse, uv + vec2(blur, blur)) * .12;
      base += texture2D(tDiffuse, uv + vec2(-blur, blur)) * .12;
      base += texture2D(tDiffuse, uv + vec2(blur, -blur)) * .12;
      base += texture2D(tDiffuse, uv - vec2(blur, blur)) * .12;
      base += texture2D(tDiffuse, uv + vec2(0.0, blur * 2.0)) * .12;
      base += texture2D(tDiffuse, uv - vec2(0.0, blur * 2.0)) * .12;
    } else {
      base = texture2D(tDiffuse, uv) * .4;
      base += texture2D(tDiffuse, uv + vec2(.0015, .002)) * .15;
      base += texture2D(tDiffuse, uv + vec2(-.0015, .002)) * .15;
      base += texture2D(tDiffuse, uv + vec2(.002, -.002)) * .15;
      base += texture2D(tDiffuse, uv + vec2(-.002, -.002)) * .15;
    }`);
  material.fragmentShader = material.fragmentShader.replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );', `
    float edgeMask=1.0-pvSmoother(.42,.5,max(abs(pvPlaneUv.x-.5),abs(pvPlaneUv.y-.5)));
    if(pvIslandRadius>0.0)edgeMask=1.0-pvSmoother(pvIslandRadius-.12,pvIslandRadius,length(pvWorld.xz));
    float horizonMask=1.0-pvSmoother(15.0,40.0,length(pvWorld.xz));
    gl_FragColor = pvHalo > .5 ? vec4(base.rgb, pvReflection * haloMask) : vec4(blendOverlay(base.rgb, color), pvReflection);
    gl_FragColor.a*=edgeMask*horizonMask;`);
  const renderReflection = reflector.onBeforeRender;
  reflector.onBeforeRender = function (...args) {
    if (!engine.customStage?.usesCachedReflection) return renderReflection.apply(this, args);
    if (engine.scene.overrideMaterial) return;
    const now = performance.now(), budget = haloBudget(engine.config.quality, engine.coarse);
    if (!engine.recording && (!engine.haloReflectionDirty || now - (engine.haloReflectionTime ?? -Infinity) < budget.reflectionInterval)) return;
    const atmosphere = engine.customStage.atmosphere, visible = atmosphere?.visible;
    if(atmosphere)atmosphere.visible = false;
    try { renderReflection.apply(this, args); }
    finally { if(atmosphere)atmosphere.visible = visible; }
    engine.haloReflectionDirty = false; engine.haloReflectionTime = now;
  };
}

export function updateHaloReflection(reflector, stage, config, coarse, fog) {
  if (!reflector) return;
  const halo = !!stage?.isAmberHalo, uniforms = reflector.material.uniforms;
  uniforms.pvHalo.value = halo ? 1 : 0;
  uniforms.pvDetail.value = halo ? stage.maps.normalMap : null;
  uniforms.pvIslandRadius.value=stage?.reflectionRadius||0;
  if (halo) {
    const v = haloSettings(config.scene);
    uniforms.pvRoughness.value = config.scene.floorRoughness;
    uniforms.pvWetness.value = v.wetness; uniforms.pvMicro.value = v.microDetail;
    uniforms.pvFog.value = fog;
  }
  const size = stage?.usesCachedReflection ? haloBudget(config.quality, coarse).reflectionSize : 512;
  const target = reflector.getRenderTarget();
  if (target.width !== size) target.setSize(size, size);
}
