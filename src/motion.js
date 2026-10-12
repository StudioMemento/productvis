// A bounded cycle is shared by product and camera motion. Time excludes pauses.
export function motionSample(motion, seconds) {
  if (motion.preset === 'still') return { angle: 0, dolly: 1, ended: false };
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
