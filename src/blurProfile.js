export function smootherstep(value) {
  const t=Math.max(0,Math.min(1,value));
  return t*t*t*(t*(t*6-15)+10);
}
// C2-continuous falloff: slope and curvature reach zero at both ends.
// Dense float stops approximate the curve instead of hand-authored alpha jumps.
export const BLUR_MASK=`linear-gradient(var(--blur-direction),${Array.from({length:49},(_,i)=>{
  const t=i/48;
  return `rgba(0,0,0,${smootherstep(t).toFixed(6)}) calc(var(--blend-reach)*${t.toFixed(6)})`;
}).join(',')})`;

// Keep text readable on intentionally pale environments without darkening
// the underlying scene and drawing a dark halo at the panel boundary.
export function isLightBackdrop(color) {
  if(!/^#[0-9a-f]{6}$/i.test(color||''))return false;
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.36;
}
