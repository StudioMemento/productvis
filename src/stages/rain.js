import * as THREE from 'three';
import {stageClock} from './natureSettings.js';

// A clear rain stage. The product and its wet floor are the only solid volumes.
export function createRainStage(s,coarse=false){
  const group=new THREE.Group();group.name='Rain · open atmosphere';
  const count=coarse?180:360,positions=new Float32Array(count*6),tips=new Float32Array(count*2);
  let seed=73;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<count;i++){
    const p=[random(),random(),random()];positions.set(p,i*6);positions.set(p,i*6+3);tips[i*2+1]=1;
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('dropTip',new THREE.BufferAttribute(tips,1));
  const uniforms={flow:{value:0},amount:{value:s.weather},height:{value:s.height},spread:{value:s.spread},seed:{value:0},tint:{value:new THREE.Color(s.ringColor)}};
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms,
    vertexShader:`
      uniform float flow, height, spread, seed;
      attribute float dropTip;
      varying float rainFade;
      void main(){
        vec3 r=fract(position+vec3(seed,seed*.713,seed*.419));
        vec3 p=vec3((r.x-.5)*24.0*spread,mod(r.y*10.0*height-flow*4.0,10.0*height),(r.z-.5)*30.0*spread);
        if(abs(p.x)<3.4&&abs(p.z)<3.7)p.x=(p.x<0.0?-1.0:1.0)*3.8;
        // Both endpoints wrap together: no long streak across the whole volume.
        rainFade=smoothstep(0.0,.35,p.y)*(1.0-smoothstep(9.0*height,10.0*height,p.y));
        p+=dropTip*vec3(-.025,.18+r.x*.2,0.0);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
      }`,
    fragmentShader:`
      uniform float amount;uniform vec3 tint;varying float rainFade;
      void main(){
        gl_FragColor=vec4(tint,amount*.32*rainFade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const drops=new THREE.LineSegments(geometry,material);drops.name='Rain streaks';drops.frustumCulled=false;group.add(drops);
  const clock=stageClock();
  const stage={group,atmosphere:drops,
    update(config,time=0,context={}){
      uniforms.flow.value=clock.update(time,config.speed,context);uniforms.amount.value=config.weather;
      uniforms.height.value=config.height;uniforms.spread.value=config.spread;
      uniforms.seed.value=(config.seed%100000)*.61803398875;uniforms.tint.value.set(config.ringColor);
      const active=Math.round(count*Math.max(0,Math.min(1,config.density))*(context.quality==='fluid'?.5:1));
      geometry.setDrawRange(0,active*2);drops.visible=active>0&&config.weather>.001&&context.inspection?.view!=='normals';
      return drops.visible&&config.speed>0&&!context.reducedMotion;
    },
    get phase(){return clock.phase;},restorePhase(value,time){clock.restore(value,time);},
  };
  stage.update(s);return stage;
}
