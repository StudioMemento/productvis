import { Color, Matrix4, Vector3 } from 'three';
import { EFFECT_CYCLE } from './objectEffectsState.js';

export const SURFACE_MODES = {none:0,rim:1,scan:2,spectral:3,hologram:4,contour:5,wire:6,glitch:7,dissolve:8};
export function surfaceUniforms() {
  return { pvFxEnabled:{value:0},pvFxMode:{value:0},pvFxTime:{value:0},pvFxIntensity:{value:.7},
    pvFxSolid:{value:1},pvFxDensity:{value:.5},pvFxColor:{value:new Color('#e4eeff')},
    pvFxAxis:{value:new Vector3(0,1,0)},pvFxCenter:{value:new Vector3()},pvFxSpan:{value:1},
    pvFxWorldToProduct:{value:new Matrix4()} };
}
const shared = `
uniform float pvFxEnabled, pvFxMode, pvFxTime, pvFxIntensity, pvFxSolid, pvFxDensity, pvFxSpan;
uniform vec3 pvFxColor, pvFxAxis, pvFxCenter;
uniform mat4 pvFxWorldToProduct;
varying vec3 vFxPosition, vFxView, vFxNormal;
float fxHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
`;

// Layered onto the imported material after its existing color/texture patch.
// Skinning, morphs, UVs, physical shading and alpha cutouts remain Three's own.
export function patchSurfaceShader(shader, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shared + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
    #include <project_vertex>
    vec4 fxWorld = vec4(transformed,1.0);
    #ifdef USE_BATCHING
      fxWorld = batchingMatrix * fxWorld;
    #endif
    #ifdef USE_INSTANCING
      fxWorld = instanceMatrix * fxWorld;
    #endif
    fxWorld = modelMatrix * fxWorld;
    vFxPosition = ((pvFxWorldToProduct * fxWorld).xyz - pvFxCenter) / pvFxSpan;
    vFxView = mvPosition.xyz;
    #if defined(STANDARD) || defined(USE_ENVMAP) || defined(USE_SKINNING)
      vFxNormal = transformedNormal;
    #else
      vFxNormal = normalMatrix * normal;
    #endif
    if (pvFxEnabled > 0.5 && pvFxMode > 6.5 && pvFxMode < 7.5) {
      float stripe = floor(dot(vFxPosition,pvFxAxis)*26.0);
      float beat = floor(pvFxTime*9.0);
      float gate = step(.85,fxHash(vec2(stripe,beat)));
      gl_Position.x += gate * (fxHash(vec2(beat,stripe))-.5) * .07 * pvFxIntensity * gl_Position.w;
    }
  `);
  shader.fragmentShader = shared + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace('#include <alphahash_fragment>', `
    #include <alphahash_fragment>
    vec3 fxEmission = vec3(0.0);
    float fxShade = 1.0;
    if (pvFxEnabled > 0.5) {
      float power = pvFxIntensity;
      float facing = abs(dot(normalize(vFxNormal),normalize(-vFxView)));
      float edge = pow(1.0-clamp(facing,0.0,1.0),2.4);
      float q = dot(vFxPosition,pvFxAxis);
      float phase = pvFxTime / ${EFFECT_CYCLE.toFixed(1)};
      float coverage = pvFxSolid;
      vec3 emission = vec3(0.0);
      float shade = 1.0;
      if (pvFxMode > .5 && pvFxMode < 1.5) {
        emission = pvFxColor * edge * 2.6;
        shade = .55;
        coverage = max(coverage,edge);
      } else if (pvFxMode < 2.5 && pvFxMode > 1.5) {
        float band = 1.0-smoothstep(.008,.06,abs(fract(q*.7-phase)-.5));
        emission = pvFxColor * (band*2.8+edge*.12);
      } else if (pvFxMode < 3.5 && pvFxMode > 2.5) {
        vec3 spectrum = .5+.5*cos(6.28318*(facing*1.35+vec3(0.0,.33,.67)));
        emission = mix(spectrum,pvFxColor,.3)*(.15+edge*1.8);
        shade = .65;
      } else if (pvFxMode < 4.5 && pvFxMode > 3.5) {
        float lines = smoothstep(.2,.6,fract(q*(55.0+pvFxDensity*80.0)-phase*3.0));
        float sweep = pow(.5+.5*sin(q*12.0-phase*12.56636),18.0);
        emission = pvFxColor*(edge*1.8+lines*.35+sweep*.65);
        coverage *= mix(1.0,.3+lines*.4+edge*.3,power);
        shade = .18;
      } else if (pvFxMode < 5.5 && pvFxMode > 4.5) {
        float curve = q*(9.0+pvFxDensity*20.0)+sin(vFxPosition.x*6.0+phase*6.28318)*.45+sin(vFxPosition.z*8.0)*.2;
        float line = abs(fract(curve)-.5);
        float aa = max(fwidth(curve),.015);
        emission = pvFxColor*(1.0-smoothstep(.025,.025+aa,line))*1.9;
        shade = .45;
      } else if (pvFxMode < 6.5 && pvFxMode > 5.5) {
        shade = .32;
      } else if (pvFxMode < 7.5 && pvFxMode > 6.5) {
        float stripe = floor(q*26.0);
        float hit = step(.85,fxHash(vec2(stripe,floor(pvFxTime*9.0))));
        emission = pvFxColor*(hit*1.4+edge*.25);
        shade = 1.0-hit*.65;
      } else if (pvFxMode > 7.5) {
        float grain = .5+.25*sin(dot(vFxPosition,vec3(19.0,13.0,7.0)))+.25*sin(dot(vFxPosition,vec3(-7.0,29.0,17.0)));
        float threshold = (.5-.5*cos(phase*6.28318))*1.12-.06;
        float remaining = grain-threshold;
        if (remaining < 0.0 && power > .001) discard;
        emission = pvFxColor*(1.0-smoothstep(0.0,.07,remaining))*3.0;
      }
      // Ordered coverage gives an inexpensive see-through point sculpture while
      // retaining the original opaque / alpha-mask / blended material policies.
      float dither = mod(gl_FragCoord.x,4.0)*.25 + mod(gl_FragCoord.y,4.0)*.0625;
      if (coverage < 1.0 && coverage <= dither) discard;
      fxShade = mix(1.0,shade,power);
      fxEmission = emission*power;
    }
  `);
  shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight = outgoingLight * fxShade + fxEmission;\n#include <opaque_fragment>');
  return shader;
}

export function installSurfaceShader(material, uniforms) {
  const before = material.onBeforeCompile, cache = material.customProgramCacheKey;
  material.onBeforeCompile = function(shader, renderer) { before.call(this,shader,renderer);patchSurfaceShader(shader,uniforms); };
  material.customProgramCacheKey = function() { return `${cache.call(this)}|pv-object-fx-v1`; };
  material.needsUpdate = true;
  return () => { material.onBeforeCompile=before;material.customProgramCacheKey=cache;material.needsUpdate=true; };
}
