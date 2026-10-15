import { clone, clamp } from './state.js';
export function varyShot(state,random=Math.random) {
  const next=clone(state),amount=clamp(state.camera.shotDelta,0,100)/100;
  if(!amount)return next;
  const signed=()=>random()<.5?-1:1;
  next.camera={...state.camera,targetPoint:null,focusPoint:null,orbitRadius:null,autoFocus:true,
    azimuth:clamp(state.camera.azimuth+signed()*(3+random()*11)*amount,-180,180),
    elevation:clamp(state.camera.elevation+signed()*(2+random()*7)*amount,1,85),
    distance:clamp(state.camera.distance*(1+signed()*(.03+random()*.14)*amount),.25,2.5),
    focal:Math.round(clamp(state.camera.focal+signed()*(3+random()*12)*amount,18,150))};
  next.motion.playing=false;return next;
}
