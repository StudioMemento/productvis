// A bounded cycle is shared by product and camera motion. Time excludes pauses.
export function motionSample(motion, seconds) {
  if (motion.preset === 'still') return { angle: 0, dolly: 1, ended: false };
  if(Number.isFinite(motion.duration)&&motion.duration>0){
    const raw=Math.max(0,seconds)/motion.duration,progress=motion.loop?raw%1:Math.min(1,raw);
    const phase=progress*Math.PI*2,span=motion.amplitude*Math.PI/180;
    if(motion.preset==='idle')return {angle:Math.sin(phase)*Math.min(15,motion.amplitude)*Math.PI/360*motion.direction,dolly:1-(1-Math.cos(phase))*.5*motion.travel*.08*motion.direction,ended:!motion.loop&&raw>=1};
    const fraction=motion.loop?(motion.easing==='linear'?1-Math.abs(2*progress-1):(1-Math.cos(phase))*.5):(motion.easing==='linear'?progress:(1-Math.cos(Math.PI*progress))*.5);
    const angle=motion.loop&&motion.amplitude===360?raw*Math.PI*2*motion.direction:fraction*span*motion.direction;
    return {angle,dolly:1-fraction*motion.travel*motion.direction,ended:!motion.loop&&raw>=1};
  }
  if (motion.preset === 'idle') {
    const progress = motion.loop ? seconds / 12 : Math.min(1,seconds / 12);
    const phase = progress * Math.PI * 2;
    return { angle: Math.sin(phase) * Math.min(15,motion.amplitude) * Math.PI / 360 * motion.direction,
      dolly: 1 - (1-Math.cos(phase))*.5*motion.travel*.08*motion.direction,
      ended: !motion.loop && seconds >= 12 };
  }
  const span = motion.amplitude * Math.PI / 180;
  const rate = (motion.preset === 'orbit' ? 12 : 20) * Math.PI / 180;
  const progress = motion.preset === 'dolly' ? seconds / 6 : seconds * rate / span;
  const fraction = motion.loop
    ? (1 - Math.cos(Math.PI * progress)) / 2
    : Math.min(1, progress);
  const angle = motion.loop && motion.amplitude === 360
    ? seconds * rate * motion.direction
    : fraction * span * motion.direction;
  return { angle, dolly: 1 - fraction * motion.travel * motion.direction, ended: !motion.loop && progress >= 1 };
}
