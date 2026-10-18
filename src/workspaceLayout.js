export const WORKSPACE_TOKENS=Object.freeze({sideMin:336,playerMin:300,gutter:20,axisTarget:40,secondaryTarget:24});
export const usesBottomDock = (width, height) => width / height <= 1.15 || width < WORKSPACE_TOKENS.sideMin+WORKSPACE_TOKENS.playerMin;

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const STORAGE_KEY='productvis.workspace.size.v1';
export const DEFAULT_WORKSPACE={sideRatio:1/3,bottomRatio:null};
export function workspaceBounds(width,height) {
  if(usesBottomDock(width,height))return {min:Math.min(height*.65,Math.max(340,height*.34)),max:height*.65};
  return {min:WORKSPACE_TOKENS.sideMin,max:Math.max(WORKSPACE_TOKENS.sideMin,Math.min(width*.6,width-WORKSPACE_TOKENS.playerMin))};
}
export function workspaceInsets(width,height,{expanded=false,sideRatio=1/3,bottomRatio=null}={}) {
  const {min,max}=workspaceBounds(width,height);
  if(usesBottomDock(width,height))return {right:0,bottom:clamp(Number.isFinite(bottomRatio)?height*bottomRatio:expanded?max:Math.max(400,height*.46),min,max)};
  return {right:clamp(width*(Number.isFinite(sideRatio)?sideRatio:1/3),min,max),bottom:0};
}
export function resizedWorkspace(preferences,width,height,pixels) {
  if(!Number.isFinite(pixels))return preferences;
  const bottom=usesBottomDock(width,height),{min,max}=workspaceBounds(width,height);
  return {...preferences,[bottom?'bottomRatio':'sideRatio']:clamp(pixels,min,max)/(bottom?height:width)};
}
export function resizeFromKey(key,size,{min,max},bottom,shift=false) {
  if(key==='Home')return min;if(key==='End')return max;
  const grow=bottom?'ArrowUp':'ArrowLeft',shrink=bottom?'ArrowDown':'ArrowRight';
  if(key!==grow&&key!==shrink)return null;
  return clamp(size+(key===grow?1:-1)*(shift?40:16),min,max);
}
export function restoreWorkspaceSize(storage) {
  try{
    const value=JSON.parse((storage??globalThis.localStorage)?.getItem(STORAGE_KEY)||'null');
    return {sideRatio:Number.isFinite(value?.sideRatio)?clamp(value.sideRatio,.01,.6):1/3,bottomRatio:Number.isFinite(value?.bottomRatio)?clamp(value.bottomRatio,.25,.65):null};
  }catch{return {...DEFAULT_WORKSPACE};}
}
export function persistWorkspaceSize(value,storage) {
  try{(storage??globalThis.localStorage)?.setItem(STORAGE_KEY,JSON.stringify(value));}catch{/* Storage is optional. */}
}
