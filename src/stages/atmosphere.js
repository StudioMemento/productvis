import * as THREE from 'three';
import {addConcreteVariation} from './concreteVariation.js';
import {createConcreteMaps} from './amberHaloMaterial.js';
import {createHorizon,addHorizonToMaterial} from './horizon.js';
import {createNatureProbe} from './naturePlatform.js';
import {stageClock} from './natureSettings.js';

const AURORA_VERTEX=`
  uniform float flow, height, spread, seed;
  varying vec2 ribbonUv; varying float ribbonDepth;
  void main(){
    ribbonUv=uv;
    vec3 p=position;
    float layer=instanceMatrix[3].z;
    float bend=sin(p.x*.095+flow*.21+layer*.2+seed)*2.3+sin(p.x*.23-flow*.12)*.7;
    p.z+=bend*(.2+uv.y*.8);
    p.y+=sin(p.x*.075+layer*.13+flow*.09)*1.7;
    p.y=4.2+(p.y+8.0)*height*.72;
    p.x*=spread;
    vec4 world=modelMatrix*instanceMatrix*vec4(p,1.0);
    ribbonDepth=layer;gl_Position=projectionMatrix*viewMatrix*world;
  }`;
const AURORA_FRAGMENT=`
  uniform float flow, amount, detail, seed;
  uniform vec3 tint;
  varying vec2 ribbonUv; varying float ribbonDepth;
  void main(){
    vec2 p=ribbonUv;
    float wave=sin(p.x*17.0+flow*.16+ribbonDepth*.2+seed);
    float threads=sin(p.x*(180.0+detail*220.0)+wave*5.0+flow*.3);
    // Fade subpixel striations instead of sparkling at oblique angles.
    float resolved=1.0-smoothstep(.5,2.5,fwidth(p.x)*(180.0+detail*220.0));
    float rays=mix(.7,.62+.38*threads,resolved);
    float edge=smoothstep(0.0,.07,p.x)*(1.0-smoothstep(.93,1.0,p.x));
    float lower=.13+wave*.025;
    float curtain=smoothstep(lower-.09,lower+.035,p.y)*exp(-max(0.0,p.y-lower)*4.8);
    float crown=1.0-smoothstep(.72,1.0,p.y);
    float alpha=edge*curtain*crown*rays*amount*.75;
    if(alpha<.002)discard;
    vec3 hue=mix(tint,vec3(.22,.12,.72),smoothstep(.16,.85,p.y));
    gl_FragColor=vec4(hue*(1.2+curtain*1.2),alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const DUST_VERTEX=`
  uniform float flow, spread, height, amount, pixelScale, seed;
  attribute float dustSeed;
  varying float dustAlpha;
  void main(){
    float a=dustSeed*6.283185+flow*.035;
    float r=4.4+fract(dustSeed*37.7+seed*.01)*19.0*spread;
    vec3 p=vec3(cos(a)*r, .12+mod(position.y+flow*(.12+dustSeed*.2),5.0)*height, sin(a)*r);
    p.x+=sin(p.y*.6+flow*.12+dustSeed*19.0)*.55;
    vec4 view=modelViewMatrix*vec4(p,1.0);
    float radial=1.0-smoothstep(18.0,40.0,length(p.xz));
    float vertical=smoothstep(.1,.55,p.y)*(1.0-smoothstep(3.8*height,5.0*height,p.y));
    dustAlpha=amount*radial*vertical*(.2+.5*dustSeed);
    gl_PointSize=clamp(pixelScale*(.026+.04*dustSeed)/max(1.0,-view.z),1.0,7.0);
    gl_Position=projectionMatrix*view;
  }`;
const DUST_FRAGMENT=`
  uniform vec3 tint; varying float dustAlpha;
  void main(){
    float r=length(gl_PointCoord-.5)*2.0;
    float a=(1.0-smoothstep(.05,1.0,r))*dustAlpha;
    if(a<.002)discard;
    gl_FragColor=vec4(tint*1.5,a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// Stylized atmospheric curtains / suspended dust. No simulation or screen pass.
export function createAtmosphereStage(s,coarse=false,sharedHorizon){
  const aurora=s.preset==='aurora',group=new THREE.Group();group.name=aurora?'Aurora · light curtains':'Dust · suspended particles';
  const horizon=sharedHorizon||createHorizon(s);if(!sharedHorizon)group.add(horizon.sky);
  const maps=createConcreteMaps(coarse);
  const floorMaterial=addHorizonToMaterial(new THREE.MeshStandardMaterial({...maps,color:s.groundColor,roughness:s.floorRoughness,metalness:.14,normalScale:new THREE.Vector2(.12,.12),dithering:true}),horizon);
  addConcreteVariation(floorMaterial);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(160,160),floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;group.add(floor);
  const uniforms={flow:{value:0},height:{value:s.height},spread:{value:s.spread},seed:{value:0},amount:{value:s.weather},detail:{value:s.density},tint:{value:new THREE.Color(s.ringColor)},pixelScale:{value:800}};
  const material=new THREE.ShaderMaterial({uniforms,vertexShader:aurora?AURORA_VERTEX:DUST_VERTEX,fragmentShader:aurora?AURORA_FRAGMENT:DUST_FRAGMENT,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  let atmosphere;
  if(aurora){
    atmosphere=new THREE.InstancedMesh(new THREE.PlaneGeometry(70,16,coarse?48:80,8),material,3);
    const transform=new THREE.Matrix4();
    for(let i=0;i<3;i++){transform.makeTranslation((i-1)*5,i*1.8,-20-i*8);atmosphere.setMatrixAt(i,transform);}
  }else{
    const count=coarse?256:640,position=new Float32Array(count*3),seeds=new Float32Array(count);
    for(let i=0;i<count;i++){position[i*3+1]=((i*.61803398875)%1)*5;seeds[i]=(i+.5)/count;}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(position,3));geometry.setAttribute('dustSeed',new THREE.BufferAttribute(seeds,1));
    atmosphere=new THREE.Points(geometry,material);
    const size=new THREE.Vector2();atmosphere.onBeforeRender=(renderer)=>{renderer.getDrawingBufferSize(size);uniforms.pixelScale.value=size.y;};
  }
  atmosphere.name=aurora?'Aurora curtains':'Dust motes';atmosphere.frustumCulled=false;atmosphere.renderOrder=2;group.add(atmosphere);
  const clock=stageClock();
  const result={group,atmosphere,maps,floorVisible:false,reflectionSpan:90,usesCachedReflection:true,
    createProbe:createNatureProbe,probeSignature:config=>`${config.preset}:${config.background}:${config.ringColor}`,
    update(config,time=0,context={}){
      horizon.update(config);floorMaterial.color.set(config.groundColor);floorMaterial.roughness=Math.max(.12,config.floorRoughness);
      uniforms.flow.value=clock.update(time,config.speed,context);uniforms.amount.value=config.weather;
      uniforms.height.value=config.height;uniforms.spread.value=config.spread;uniforms.detail.value=config.density;
      uniforms.seed.value=(config.seed%1000)*.017;uniforms.tint.value.set(config.ringColor);
      atmosphere.visible=config.weather>.001&&context.inspection?.view!=='normals';
      if(!aurora)atmosphere.geometry.setDrawRange(0,Math.round((coarse?256:640)*(context.quality==='fluid'?.5:1)*(.3+.7*config.density)));
      return atmosphere.visible&&config.speed>0&&!context.reducedMotion;
    },
    get phase(){return clock.phase;},restorePhase(value,time){clock.restore(value,time);},
  };
  result.update(s);return result;
}
