import { AXES, generationAmounts } from './axisState.js';
import { CAMERA_ANGLES, FINISHES, LIGHT_RIGS, SCENE_THEMES, clamp } from './state.js';
import { LOOKS } from './presentation.js';
import { STAGE_BY_ID } from './stageCatalog.js';
import { POST_LOOKS, BLOOM_LIMIT } from './lookdev.js';
import { materialFamily } from './navigation.js';

const mix=(a,b,t)=>Number((a+(b-a)*t).toFixed(6));
const color=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(mix(parseInt(a.slice(i,i+2),16),parseInt(b.slice(i,i+2),16),t)).toString(16).padStart(2,'0')).join('');
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const pick=(items,random)=>items[Math.min(items.length-1,Math.floor(random()*items.length))];
const other=(items,current,random)=>pick(items.filter(item=>item!==current),random)??current;
const shifted=(value,span,amount,random,min,max)=>{
  let step=(random()<.5?-1:1)*(.3+.7*random())*span*amount;
  if(value+step<min||value+step>max)step=-step;
  return Number(clamp(value+step,min,max).toFixed(6));
};
const rotate=(degrees)=>((degrees+180)%360+360)%360-180;

export function canGenerateMaterial(state,materials=[]) {
  const meta=materials.find(m=>m.id===state.selectedMaterial),current=state.materials[state.selectedMaterial];
  return !!(meta&&current&&meta.lit!==false&&!['glass','lights'].includes(materialFamily(meta))&&
    (meta.original?.opacity??1)>=.98&&(current.opacity??1)>=.98&&
    (meta.original?.transmission??0)<.1&&(current.transmission??0)<.1);
}

function environment(state,amount,random,lockedLight) {
  const current=state.scene;
  let candidates=LOOKS.filter(look=>look.scene!==current.preset);
  if(lockedLight){const compatible=candidates.filter(look=>look.lighting===state.lighting.preset);if(compatible.length)candidates=compatible;}
  const nextId=amount>=.7?pick(candidates,random).scene:current.preset;
  const theme=SCENE_THEMES[nextId],changeStage=nextId!==current.preset;
  const next={...current,...(changeStage?theme:{}),preset:nextId};
  if(amount>=.4){next.seed=Math.floor(random()*100000);next.composition=pick([0,1,2],random);}
  for(const [key,span,min,max] of [['fog',.13,0,.65],['reflection',.18,0,.65],['floorRoughness',.15,.08,.9],['scale',.2,.55,1.5],['density',.22,.1,.85],['height',.25,.3,2],['spread',.2,.6,1.8],['weather',.22,0,.8],['glitch',.18,0,.55],['speed',.25,0,1.2]]){
    const base=changeStage&&Number.isFinite(theme[key])?theme[key]:current[key];
    // Manual values outside the curated range approach it gradually.
    next[key]=mix(base,shifted(clamp(base,min,max),span,1,random,min,max),amount);
  }
  if(!changeStage&&amount>=.4)next.ringColor=color(current.ringColor,theme.ringColor||current.ringColor,amount*.5);
  if(next.preset==='amber-halo'){
    for(const [key,span,min,max] of [['haloRadius',.3,3.2,4.5],['haloIntensity',.16,.3,.9],['wetness',.2,.15,.85],['microDetail',.12,.3,.85]]){
      const base=Number.isFinite(next[key])?next[key]:theme[key];
      next[key]=mix(base,shifted(clamp(base,min,max),span,1,random,min,max),amount);
    }
    next.fog=clamp(next.fog,.08,.5);next.speed=clamp(next.speed,0,.75);
  }
  if(['water','cloud'].includes(next.preset)){
    const ranges=next.preset==='water'?[['waterWaves',.18,.08,.75],['waterScale',.15,.1,.9],['waterRipples',.18,.1,.85]]:
      [['cloudDensity',.15,.3,.85],['cloudScale',.15,.15,.85],['cloudLevel',.12,-.5,0],['cloudThickness',.18,.6,1.45]];
    for(const [key,span,min,max] of ranges){const base=Number.isFinite(next[key])?next[key]:theme[key];next[key]=mix(base,shifted(clamp(base,min,max),span,1,random,min,max),amount);}
    next.speed=clamp(next.speed,0,.8);
  }
  return next;
}

function lighting(state,scene,amount,random,newStage) {
  const current=state.lighting;
  const preferred=STAGE_BY_ID[scene.preset]?.lighting||LOOKS.find(look=>look.scene===scene.preset)?.lighting||'softbox';
  const bright=['pearl-cyclorama','studio'].includes(scene.preset);
  const options=[...new Set([preferred,...(bright?['softbox','showroom','overcast','top']:['softbox','rim','split','top','bicolor','noir'])])];
  const id=amount>=.4?(newStage?preferred:other(options,current.preset,random)):current.preset;
  const rig=LIGHT_RIGS[id],next={...current,preset:id};
  // Key/fill/rim move together towards a studio rig, preserving its ratios.
  const power=mix(.9,1.08,random());
  for(const key of ['key','fill','rim'])next[key]=mix(current[key],clamp(rig[key]*power,0,10),amount);
  for(const key of ['softness','elevation','ambient','environment'])next[key]=mix(current[key],rig[key],amount);
  next.rotation=rotate(shifted(current.rotation,amount<.4?18:55,amount,random,-180,180));
  next.intensity=mix(current.intensity,pick([.85,1,1.12],random),amount);
  next.temperature=Math.round(mix(current.temperature,rig.temperature,amount));
  if(id!==current.preset){
    next.tint=rig.tint;next.keyColor=rig.keyColor;next.fillColor=rig.fillColor;
    next.rimColor=rig.rimColor||scene.ringColor;
  }
  return next;
}

function material(state,materials,scene,amount,random) {
  if(!canGenerateMaterial(state,materials))return state.materials;
  const id=state.selectedMaterial,current=state.materials[id],meta=materials.find(m=>m.id===id);
  const palette=[...new Set(['#e9e4d7','#424752','#aab4c2',scene.ringColor])];
  const finish=amount>=.4?other(Object.keys(FINISHES),current.finish,random):current.finish;
  const target=FINISHES[finish]||FINISHES.satin,next={...current};
  for(const key of ['roughness','metalness','clearcoat']){
    if(key==='clearcoat'&&meta.physical===false)continue;
    const base=current[key]??meta.original?.[key]??0;
    next[key]=amount<.4?shifted(base,.16,amount,random,0,1):mix(base,target[key],amount);
  }
  if(amount>=.4)next.finish=finish;
  const baseColor=current.color||meta.original?.color||'#808080';
  next.color=color(baseColor,other(palette,baseColor,random),amount*(amount<.4?.22:1));
  next.overlay=mix(current.overlay??0,amount<.4?.3:.95,amount);
  return {...state.materials,[id]:next};
}

function camera(state,scene,amount,random,reducedMotion) {
  const current=state.camera,wide=['hero','low','front','profile','top','rear','rearLow','overhead','wide','left'];
  const suggested=STAGE_BY_ID[scene.preset]?.camera;
  const id=amount>=.7?other([...new Set([suggested,...wide].filter(Boolean))],current.preset,random):current.preset;
  const angle=CAMERA_ANGLES[id],changed=id!==current.preset;
  const next={...current,preset:id};
  if(changed)Object.assign(next,angle,{targetPoint:null,focusPoint:null,orbitRadius:null,autoFocus:true});
  next.azimuth=rotate((changed?angle.azimuth:current.azimuth)+(random()<.5?-1:1)*(3+random()*12)*amount);
  next.elevation=shifted(changed?angle.elevation:current.elevation,10,amount,random,1,85);
  next.distance=shifted(changed?angle.distance:current.distance,.12,amount,random,.25,2.5);
  if(!changed&&current.orbitRadius)next.orbitRadius=shifted(current.orbitRadius,current.orbitRadius*.12,amount,random,.2,100);
  const focal=changed?angle.focal:current.focal;
  next.focal=mix(focal,shifted(clamp(focal,24,120),12,1,random,24,120),amount);
  next.aperture=mix(current.aperture,pick([4,5.6,8,11],random),amount);
  // Exposure is an authored camera decision: random lighting never touches it.
  next.exposure=mix(current.exposure,pick([-.25,-.1,0,.1],random),amount*.6);
  let motion={...state.motion};
  if(amount>=.7){
    const close=['macro','detail'].includes(id),preset=pick(close?['still','idle','dolly']:['still','idle','turntable','orbit','dolly'],random);
    motion={...motion,preset,playing:preset!=='still'&&!reducedMotion,loop:true,axis:'y',direction:pick([-1,1],random),duration:pick([10,12,16],random),easing:'smooth',cursor:0,
      speed:mix(.35,.8,amount),amplitude:preset==='idle'?mix(2,7,amount):preset==='turntable'?mix(30,100,amount):mix(15,45,amount),travel:close?.08:mix(.08,.2,amount)};
  }else if(motion.preset!=='still')motion.speed=mix(motion.speed,pick([.4,.6,.8],random),amount*.5);
  if(reducedMotion)motion.playing=false;
  return {camera:next,motion};
}

const FX_RECIPES=[
  {surface:'rim',particles:'points',solid:.08},{surface:'hologram',particles:'none',solid:1},
  {surface:'contour',particles:'filaments',solid:1},{surface:'spectral',particles:'none',solid:1},
  {surface:'scan',particles:'streaks',solid:1},{surface:'dissolve',particles:'scatter',solid:.45},
  {surface:'wire',particles:'none',solid:1},{surface:'glitch',particles:'flow',solid:.9},
];
function effects(state,scene,motion,amount,random,reducedMotion) {
  const current=state.effects,next={...current};
  const active=['surface','particles','trail'].some(key=>current[key]!=='none');
  if(amount>=.4){
    const recipe=pick(FX_RECIPES.filter(r=>r.surface!==current.surface),random);
    Object.assign(next,recipe);next.trail=amount>=.8&&(motion.preset==='turntable'&&motion.playing||state.animation.playing)?pick(['none','ribbon','ghost'],random):'none';
    next.seed=Math.floor(random()*100000);next.phase=0;
  }else if(!active)Object.assign(next,{surface:'rim',solid:1});
  next.color=color(current.color,scene.ringColor,amount);
  next.intensity=mix(active?current.intensity:0,pick([.4,.55,.7],random),amount);
  next.density=mix(current.density,pick([.2,.35,.5],random),amount);
  next.size=mix(current.size,pick([.5,.7,1],random),amount);
  next.spread=mix(current.spread,pick([.2,.35,.5],random),amount);
  next.speed=mix(current.speed,pick([.35,.5,.7],random),amount);
  next.length=mix(current.length,pick([.25,.4,.55],random),amount);
  if(reducedMotion)next.playing=false;
  const post={...state.post};
  if(amount>=.55){
    const mood=pick(POST_LOOKS,random).values;
    for(const key of ['strength','radius','threshold','vignette','contrast','saturation'])post[key]=mix(post[key],mood[key],amount);
    post.tone=mood.tone;post.bloom=mood.bloom;
  }
  post.strength=Math.min(BLOOM_LIMIT,post.strength);post.bloomOverride=false;
  // DOF/enabled are left as authored: a VFX variation cannot change camera focus.
  return {effects:next,post};
}

export function generateAxes(state,materials=[],{axis=null,delta=state.randomDelta,random=Math.random,reducedMotion=false}={}) {
  if(axis&&!AXES.some(item=>item.id===axis))return state;
  const amount=generationAmounts(state,axis,delta);
  if(!Object.values(amount).some(Boolean))return state;
  // Fixed independent streams: skipping/locking an axis does not shift the others.
  const sample=random(),seed=Math.floor(clamp(Number.isFinite(sample)?sample:0,0,.999999999)*4294967296);
  const stream=id=>rng(seed^({mat:1717,env:2828,light:3939,cam:4141,fx:5252}[id]));
  const next={...state};
  if(amount.env){next.scene=environment(state,amount.env,stream('env'),!amount.light);if(reducedMotion)next.scene.speed=0;}
  if(amount.light)next.lighting=lighting(state,next.scene,amount.light,stream('light'),next.scene.preset!==state.scene.preset);
  if(amount.mat)next.materials=material(state,materials,next.scene,amount.mat,stream('mat'));
  if(amount.cam)Object.assign(next,camera(state,next.scene,amount.cam,stream('cam'),reducedMotion));
  if(amount.fx)Object.assign(next,effects(state,next.scene,next.motion,amount.fx,stream('fx'),reducedMotion));
  return AXES.some(item=>item.fields.some(key=>next[key]!==state[key]))?next:state;
}
