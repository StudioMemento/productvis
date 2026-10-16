export const DEFAULT_ANIMATION = { clip:0, playing:false, loop:true, speed:1, cursor:0 };
export function validateAnimation(input = {}) {
  const number=(key,min,max,fallback)=>Number.isFinite(input?.[key])?Math.min(max,Math.max(min,input[key])):fallback;
  return {clip:Math.floor(number('clip',0,10000,0)),playing:input?.playing===true,loop:input?.loop!==false,speed:number('speed',.1,3,1),cursor:number('cursor',0,1,0)};
}
