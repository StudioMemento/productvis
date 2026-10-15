import { BLUR_MASK } from './blurProfile.js';
export function ProgressiveBlur({ className = '' }) {
  return <div className={`progressive-blur ${className}`} style={className==='ui-scrim'?{'--blur-mask':BLUR_MASK}:undefined} aria-hidden="true"><i/></div>;
}
