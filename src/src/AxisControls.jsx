import { IconMaximize, IconMinimize } from './icons.jsx';
import { Tool } from './Controls.jsx';
import { ProgressiveBlur } from './ProgressiveBlur.jsx';
import { DeltaIcon } from './DeltaIcon.jsx';
import { CategoryNavigation } from './CategoryNavigation.jsx';
export function GenerateDial({delta,onDelta,onGenerate,disabled,locked,activeCount}){
  return <div className="generate-dial"><DeltaIcon kind="global" label="globale" value={delta} onChange={onDelta} onGenerate={onGenerate} disabled={disabled||locked} blocked={!activeCount||delta===0}/></div>;
}
export function AxisDock(props){
  return <div className="axis-dock"><ProgressiveBlur className="toolbar-blur"/>
    <CategoryNavigation {...props} secondary/>
  </div>;
}
export function ViewTools({fullscreen,onFullscreen,disabled}){
  return <div className="view-tools" role="group" aria-label="Vista">
    <Tool label={fullscreen?'Esci da schermo intero':'Schermo intero'} aria-pressed={fullscreen} onClick={onFullscreen} disabled={disabled}>{fullscreen?<IconMinimize size={18}/>:<IconMaximize size={18}/>}</Tool>
  </div>;
}
