import { CAMERA_ANGLES, FINISHES, LIGHT_RIGS, SCENE_THEMES, clamp, clone } from './state.js';
import { materialFamily } from './navigation.js';
import { POST_LOOKS, BLOOM_LIMIT } from './lookdev.js';
import { CONCEPT_STAGES, STAGE_BY_ID } from './stageCatalog.js';
import { sparkleEffects } from './objectEffectsState.js';

// Pair environments with lighting, a full-product view and a restrained palette.
// Variations use the existing renderer once; no preview images are generated.
export const LOOKS = [
  ...CONCEPT_STAGES.flatMap(stage=>[stage.camera,stage.camera==='hero'?'low':'hero'].map(camera=>({scene:stage.id,lighting:stage.lighting,camera,colors:['#e9e4d7','#424752',stage.theme.ringColor],finishes:['satin','metal','gloss']}))),
  { scene: 'cubes', lighting: 'rim', camera: 'hero', colors: ['#34516b', '#bc8b33', '#424752'], finishes: ['satin', 'metal'] },
  { scene: 'cubes', lighting: 'top', camera: 'low', colors: ['#e9e4d7', '#68796d', '#424752'], finishes: ['matte', 'ceramic'] },
  { scene: 'ring', lighting: 'bicolor', camera: 'low', colors: ['#34516b', '#aab4c2', '#424752'], finishes: ['metal', 'gloss'] },
  { scene: 'ring', lighting: 'rim', camera: 'front', colors: ['#922633', '#bc8b33', '#e9e4d7'], finishes: ['gloss', 'satin'] },
  { scene: 'void', lighting: 'split', camera: 'profile', colors: ['#922633', '#aab4c2', '#424752'], finishes: ['satin', 'metal'] },
  { scene: 'void', lighting: 'softbox', camera: 'hero', colors: ['#e9e4d7', '#68796d', '#34516b'], finishes: ['ceramic', 'matte'] },
  { scene: 'studio', lighting: 'softbox', camera: 'hero', colors: ['#e9e4d7', '#34516b', '#922633'], finishes: ['ceramic', 'gloss'] },
  { scene: 'studio', lighting: 'top', camera: 'front', colors: ['#424752', '#68796d', '#aab4c2'], finishes: ['satin', 'matte'] },
  { scene: 'cinema', lighting: 'warm', camera: 'hero', colors: ['#bc8b33', '#922633', '#424752'], finishes: ['satin', 'gloss'] },
  { scene: 'cinema', lighting: 'bicolor', camera: 'low', colors: ['#34516b', '#aab4c2', '#424752'], finishes: ['metal', 'satin'] },
  { scene: 'particles', lighting: 'rim', camera: 'profile', colors: ['#e9e4d7', '#aab4c2', '#bc8b33'], finishes: ['ceramic', 'metal'] },
  { scene: 'particles', lighting: 'bicolor', camera: 'top', colors: ['#34516b', '#e9e4d7', '#922633'], finishes: ['gloss', 'satin'] },
  { scene: 'studio', lighting: 'split', camera: 'macro', colors: ['#424752', '#e9e4d7'], finishes: ['satin', 'gloss'] },
  { scene: 'cinema', lighting: 'softbox', camera: 'macro', colors: ['#bc8b33', '#34516b'], finishes: ['metal', 'ceramic'] },
  {scene:'desert',lighting:'sunset',camera:'wide',colors:['#e9e4d7','#bc8b33'],finishes:['matte','satin']},
  {scene:'mountain',lighting:'overcast',camera:'rear',colors:['#637c70','#aab4c2'],finishes:['matte','metal']},
  {scene:'urban',lighting:'noir',camera:'rearLow',colors:['#111317','#bc303a'],finishes:['gloss','metal']},
  {scene:'tunnel',lighting:'neon',camera:'front',colors:['#aab4c2','#375fba'],finishes:['metal','gloss']},
  {scene:'road',lighting:'rim',camera:'low',colors:['#bc8b33','#e9e4d7'],finishes:['satin','gloss']},
  {scene:'rain',lighting:'moon',camera:'rearLow',colors:['#111317','#aab4c2'],finishes:['gloss','metal']},
  {scene:'grid',lighting:'bicolor',camera:'overhead',colors:['#60b6c2','#424752'],finishes:['metal','satin']},
  {scene:'monolith',lighting:'showroom',camera:'left',colors:['#bd879c','#e9e4d7'],finishes:['matte','ceramic']},
];

const mix = (a, b, amount) => Number((a + (b - a) * amount).toFixed(6));
const mixColor = (a, b, amount) => '#' + [1, 3, 5].map(index => Math.round(mix(parseInt(a.slice(index, index + 2), 16), parseInt(b.slice(index, index + 2), 16), amount)).toString(16).padStart(2, '0')).join('');

export function randomizePresentation(state, materials = [], { delta = state.randomDelta ?? 35, random = Math.random, reducedMotion = false } = {}) {
  const amount = clamp(Number.isFinite(delta) ? delta : 35, 0, 100) / 100;
  if (amount === 0) return clone(state);
  const pick = values => values[Math.min(values.length - 1, Math.max(0, Math.floor(random() * values.length)))];
  // Every non-zero sparkle changes the four creative categories. Delta controls
  // variation strength; it never silently locks a category to the previous preset.
  const looks = LOOKS.filter(item => item.scene !== state.scene.preset && item.lighting !== state.lighting.preset && item.camera !== state.camera.preset);
  const look = pick(looks);
  const next = clone(state), blend = .4 + amount * .6;
  next.scene = {
    ...state.scene,...SCENE_THEMES[look.scene], preset: look.scene, composition: pick([0,1,2]), seed: Math.floor(random()*100000),
    density:pick([.25,.45,.7]),height:mix(1,pick([.5,.8,1.2,1.6]),amount),spread:mix(1,pick([.8,1.2,1.5]),amount),weather:pick([.2,.4,.65]),glitch:mix(.1,.45,amount),speed:mix(.35,.9,amount),
    scale: mix(1,pick([.65,.8,1.1,1.35]),amount),
    fog: mix(state.scene.fog,pick([.05,.12,.2,.35]),blend),
    particles: mix(state.scene.particles,pick([.05,.15,.3,.5]),blend),
    floorRoughness: mix(state.scene.floorRoughness,pick([.2,.4,.65]),blend),
    reflection: mix(state.scene.reflection,pick([.08,.2,.35]),blend),
    ringColor: look.lighting==='bicolor'?pick(['#799fff','#e6eeff']):pick(['#ffb020','#ff887c','#e6eeff']),
  };
  // Keep each concept's identity. Delta varies proportions without turning pearl
  // into a dark room or erasing the rain/neon palette that defines the set.
  const concept=STAGE_BY_ID[look.scene];
  if(concept){
    for(const key of ['background','groundColor','ringColor','floorRoughness','reflection'])next.scene[key]=concept.theme[key];
    next.scene.fog=clamp(concept.theme.fog+mix(-.025,.06,random())*amount,0,1);
    next.scene.weather=clamp(concept.theme.weather+mix(-.15,.15,random())*amount,0,1);
  }
  if(reducedMotion)next.scene.speed=0;
  next.lighting = { ...state.lighting, preset: look.lighting, ...LIGHT_RIGS[look.lighting],
    intensity: mix(1,pick([.75,.9,1.1,1.3]),amount), rotation: mix(0,pick([-60,-30,20,50]),amount) };
  const angle=CAMERA_ANGLES[look.camera];
  next.camera = { ...state.camera, preset:look.camera, ...angle,
    azimuth:clamp(angle.azimuth+mix(0,pick([-12,-5,5,12]),amount),-180,180),
    aperture:mix(5.6,pick([2.8,4,8,11]),amount), exposure:mix(-.1,pick([-.35,-.2,0,.15]),amount), autoFocus:true, focusPoint:null,targetPoint:null,orbitRadius:null };
  if (next.camera.azimuth===state.camera.azimuth) next.camera.azimuth=clamp(next.camera.azimuth+(next.camera.azimuth>175?-1:1)*Math.max(.1,amount*3),-180,180);
  const mood=pick(POST_LOOKS.filter(look=>Object.entries(look.values).some(([key,value])=>state.post[key]!==value))).values;
  next.post={...mood};
  for(const key of ['strength','radius','threshold','vignette','contrast','saturation']) next.post[key]=mix(state.post[key],mood[key],blend);
  next.post.strength=Math.min(BLOOM_LIMIT,next.post.strength); next.post.bloomOverride=false;
  // Macro shots stay close to the selected detail; wider views can rotate the product.
  const motions=['macro','detail'].includes(look.camera)?['idle','dolly']:['idle','turntable','orbit','dolly'];
  const motion=pick(motions.filter(preset=>preset!==state.motion.preset));
  next.motion={...state.motion,preset:motion,playing:!reducedMotion,loop:true,axis:'y',direction:pick([-1,1]),duration:pick([8,12,16]),easing:'smooth',cursor:0,
    speed:mix(.3,motion==='idle'?.65:.9,amount),
    amplitude:motion==='idle'?mix(2,10,amount):motion==='turntable'?mix(30,120,amount):mix(15,55,amount),
    travel:mix(.05,look.camera==='macro'?.12:.24,amount)};
  next.inspection={...state.inspection,view:'pbr'};
  next.section={...state.section,enabled:false}; next.render={...state.render,alpha:false};
  // Keep authored product surfaces at modest deltas; high deltas can explore a finish.
  const target=materials.find(material=>material.id===state.selectedMaterial), current=state.materials[state.selectedMaterial];
  if(amount>=.7 && target && current && !['glass','lights'].includes(materialFamily(target))
      && (target.original?.opacity??1)>=.98 && (current.opacity??1)>=.98) {
    const finish=pick(look.finishes.filter(value=>value!==current.finish));
    const color=pick(look.colors.filter(value=>value.toLowerCase()!==current.color?.toLowerCase()));
    const values={...current,...FINISHES[finish],finish,color:mixColor(current.color||target.original.color||'#808080',color,amount),overlay:mix(current.overlay??0,.95,amount)};
    for(const key of ['roughness','metalness','clearcoat'])values[key]=mix(current[key]??target.original[key]??0,values[key],amount);
    next.materials[state.selectedMaterial]=values;
  }
  let effectsSeed=(next.scene.seed+(state.effects?.seed||19))>>>0;
  const effectRandom=()=>{effectsSeed=(Math.imul(effectsSeed,1664525)+1013904223)>>>0;return effectsSeed/4294967296;};
  next.effects = sparkleEffects(state.effects, next.scene.ringColor, amount, effectRandom, reducedMotion,
    next.motion.preset === 'turntable' || next.animation?.playing);
  return next;
}
