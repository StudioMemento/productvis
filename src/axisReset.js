import { AXES } from './axisState.js';
import { DEFAULT_STATE, clone } from './state.js';

// MAT owns the selected look. Mesh alpha, sidedness and UV live in Modello.
const lookDefaults={finish:'original',color:'#808080',overlay:0,roughness:.5,metalness:0,clearcoat:0,normalScale:1,transmission:0,ior:1.5,thickness:0,emissive:'#000000',emissiveIntensity:1};
export function resetAxis(state,axisId,materials=[]) {
  const axis=AXES.find(item=>item.id===axisId);
  if(!axis)return state;
  let patch;
  if(axisId==='mat') {
    const id=state.selectedMaterial,current=state.materials[id],original=materials.find(m=>m.id===id)?.original;
    if(!current||!original)return state;
    const restored={...current};
    for(const [key,fallback] of Object.entries(lookDefaults))restored[key]=original[key]??fallback;
    restored.finish='original';restored.overlay=0;
    if(Object.keys(restored).every(key=>restored[key]===current[key]))return state;
    patch={materials:{...state.materials,[id]:restored}};
  }else{
    patch=Object.fromEntries(axis.fields.map(key=>[key,clone(DEFAULT_STATE[key])]));
    // Camera-authored focus and the pass master survive an FX reset.
    if(axisId==='fx'){
      patch.post={...patch.post,dof:state.post.dof,enabled:state.post.enabled};
      patch.effects.randomize=state.effects.randomize;
    }
    if(axis.fields.every(key=>JSON.stringify(patch[key])===JSON.stringify(state[key])))return state;
  }
  // Explicit manual reset is allowed while locked. Configuration stays intact.
  return {...state,...patch};
}
