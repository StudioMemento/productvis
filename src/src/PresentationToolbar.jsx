import { IconSparkles,IconMaximize,IconMinimize } from './icons.jsx';
import { Tool } from './Controls.jsx';
import { DeltaControl } from './DeltaControl.jsx';
import { ProgressiveBlur } from './ProgressiveBlur.jsx';

export function PresentationToolbar({ presentation, onToggle, visibilityRef, delta, onDelta, onRandom, randomCount, disabled,locked=false }) {
  return <div className="global-toolbar" role="group" aria-label="Comandi presentazione">
    <ProgressiveBlur className="toolbar-blur"/>
    <div className="toolbar-leading">
      <Tool ref={visibilityRef} label={presentation?'Mostra UI':'Nascondi UI'} title={presentation?'Mostra UI · H':'Nascondi UI · H'} className="visibility-toggle" aria-controls="productvis-controls" aria-expanded={!presentation} onClick={onToggle} disabled={locked}>{presentation?<IconMaximize size={28}/>:<IconMinimize size={28}/>}</Tool>
    </div>
    <div className="toolbar-random" id="productvis-random">
      <Tool label="Random · nuova variante" title={delta===0?'Aumenta il delta per creare una variante':`Scena, shot, luci, mood e movimento · Δ ${delta}`} className="random-control" onClick={onRandom} disabled={disabled||delta===0}><IconSparkles key={randomCount} size={38} className={randomCount?'sparkle-burst':undefined}/></Tool>
    </div>
    <div className="toolbar-delta"><DeltaControl value={delta} onChange={onDelta} disabled={disabled}/></div>
  </div>;
}
