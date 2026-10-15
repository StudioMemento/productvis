import { IconSparkles } from '@tabler/icons-react';
import { Tool } from './Controls.jsx';
import { DeltaControl } from './DeltaControl.jsx';
import { ProgressiveBlur } from './ProgressiveBlur.jsx';

export function PresentationToolbar({ presentation, onToggle, visibilityRef, delta, onDelta, onRandom, randomCount, disabled,locked=false }) {
  return <div className="global-toolbar" role="group" aria-label="Comandi presentazione">
    <ProgressiveBlur className="toolbar-blur"/>
    <div className="toolbar-leading">
      <Tool ref={visibilityRef} label={presentation?'Mostra UI':'Nascondi UI'} title={presentation?'Mostra UI · H':'Nascondi UI · H'} className="visibility-toggle" aria-controls="productvis-controls" aria-expanded={!presentation} onClick={onToggle} disabled={locked}><svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true"><path d="M9 4H4v5m15-5h5v5M4 19v5h5m15-5v5h-5"/>{presentation?<path d="M10 10h8v8h-8z"/>:<path d="m8 8 12 12M8 13v7h7M15 8h5v5"/>}</svg></Tool>
    </div>
    <div className="toolbar-random" id="productvis-random">
      <Tool label="Random · nuova variante" title={delta===0?'Aumenta il delta per creare una variante':`Scena, shot, luci, mood e movimento · Δ ${delta}`} className="random-control" onClick={onRandom} disabled={disabled||delta===0}><IconSparkles key={randomCount} size={38} stroke={1.25} className={randomCount?'sparkle-burst':undefined}/></Tool>
    </div>
    <div className="toolbar-delta"><DeltaControl value={delta} onChange={onDelta} disabled={disabled}/></div>
  </div>;
}
