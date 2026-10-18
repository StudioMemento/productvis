export const NATURE_DEFAULTS = {
  waterWaves: .35, waterScale: .55, waterRipples: .55,
  cloudDensity: .6, cloudScale: .5, cloudLevel: -.25, cloudThickness: 1.1,
};
export const NATURE_RANGES = {
  waterWaves: [0,1], waterScale: [0,1], waterRipples: [0,1],
  cloudDensity: [0,1], cloudScale: [0,1], cloudLevel: [-.55,.08], cloudThickness: [.5,1.6],
};
export function natureSettings(scene) {
  return Object.fromEntries(Object.entries(NATURE_RANGES).map(([key,[min,max]])=>
    [key, Math.min(max,Math.max(min,Number.isFinite(scene[key])?scene[key]:NATURE_DEFAULTS[key]))]));
}
export function cloudBudget(quality='auto',coarse=false) {
  return quality==='fluid' ? 8 : quality==='high' ? (coarse?14:20) : (coarse?10:14);
}
export function stageClock() {
  let phase=0,lastTime=null;
  return {
    get phase(){return phase;},
    update(time,speed,context={}){
      const rate=context.reducedMotion?0:Math.max(0,speed||0);
      if(context.recording)phase=time*rate;
      else if(lastTime!==null)phase+=Math.max(0,Math.min(time-lastTime,.1))*rate;
      lastTime=time;return phase;
    },
    restore(value,time){phase=value;lastTime=time;},
  };
}
