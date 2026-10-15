import { IconSparkles, IconArrowBackUp, IconMaximize, IconMinimize, IconAdjustments, IconAdjustmentsOff } from '@tabler/icons-react';
import { Knob, Tool } from './Controls.jsx';
import { AXES } from './axisState.js';
import { ProgressiveBlur } from './ProgressiveBlur.jsx';
import { WorkspaceIcon } from './WorkspaceIcon.jsx';

export function AxisGenerator({axis,settings,onDelta,onLock,onReset,onGenerate,disabled,unavailable,resetUnavailable}) {
  const blocked=disabled||settings.locked||settings.delta===0||unavailable;
  return <div className={`local-generator ${settings.locked?'axis-is-locked':''}`} role="group" aria-label={`Generazione ${axis.label}`}>
    <div className="local-dial">
      <Knob label={axis.label} ariaLabel={`Delta ${axis.label}`} value={settings.delta} min={0} max={100} step={1} format={v=>String(Math.round(v))} onChange={onDelta} disabled={disabled} showValue={false}/>
      <Tool label={`Varia solo ${axis.label}`} title={settings.locked?'Asse protetto':unavailable?'Scegli una superficie opaca modificabile':`Varia ${axis.name} · Δ ${settings.delta}`} className="local-sparkle" disabled={blocked} onClick={onGenerate}><IconSparkles size={19} stroke={1.25}/></Tool>
    </div>
    <div className="local-actions">
      <Tool label={`${settings.locked?'Sblocca':'Blocca'} asse ${axis.label}`} title="Il lucchetto protegge dalle generazioni. I controlli manuali restano disponibili." aria-pressed={settings.locked} className="local-lock" onClick={onLock} disabled={disabled}><WorkspaceIcon name={settings.locked?'lock':'unlock'} size={14}/></Tool>
      <Tool label={`Ripristina asse ${axis.label}`} title={axis.id==='mat'?'Ripristina la finitura originale della superficie selezionata':'Ripristina i valori iniziali di questo asse'} className="local-reset" onClick={onReset} disabled={disabled||resetUnavailable}><WorkspaceIcon name="reset" size={15}/></Tool>
    </div>
  </div>;
}
export function GenerateDial({delta,onDelta,onGenerate,disabled,locked,randomCount,activeCount}) {
  return <div className="generate-dial" title="Trascina l’anello. Delta effettivo = delta globale × delta asse / 100. Sparkle varia solo gli assi sbloccati.">
    <Knob label="GLOBALE" ariaLabel="Delta globale" value={delta} min={0} max={100} step={1} format={v=>String(Math.round(v))} onChange={onDelta} disabled={locked} showValue={false}/>
    <Tool label="Sparkle · varia gli assi sbloccati" title={!activeCount?'Tutti gli assi sono bloccati o a delta zero':delta===0?'Aumenta il delta globale':`Genera · ${activeCount} assi · Δ ${delta}`} className="generate-button" disabled={disabled||locked||!activeCount||delta===0} onClick={onGenerate}><IconSparkles size={25} stroke={1.2} key={randomCount} className={randomCount?'sparkle-burst':undefined}/></Tool>
  </div>;
}
export function AxisDock({axes,onDelta,onLock,onReset,onGenerate,disabled,materialEligible,materialResettable=true}) {
  return <div className="axis-dock" role="group" aria-label="Delta locali, blocchi e reset">
    <ProgressiveBlur className="toolbar-blur"/>
    {AXES.map(axis=><AxisGenerator key={axis.id} axis={axis} settings={axes[axis.id]} disabled={disabled} unavailable={axis.id==='mat'&&!materialEligible} resetUnavailable={axis.id==='mat'&&!materialResettable} onDelta={value=>onDelta(axis.id,value)} onLock={()=>onLock(axis.id)} onReset={()=>onReset(axis.id)} onGenerate={()=>onGenerate(axis.id)}/>)}
  </div>;
}
export function ViewTools({presentation,onToggle,visibilityRef,fullscreen,onFullscreen,disabled,onUndo,canUndo}) {
  return <div className="view-tools" role="group" aria-label="Vista e comandi semplificati">
    <Tool label={fullscreen?'Esci da schermo intero':'Schermo intero'} aria-pressed={fullscreen} onClick={onFullscreen} disabled={disabled}>{fullscreen?<IconMinimize size={18}/>:<IconMaximize size={18}/>}</Tool>
    <Tool ref={visibilityRef} label={presentation?'Mostra controlli completi':'Comandi semplificati'} aria-controls="productvis-controls" aria-expanded={!presentation} aria-pressed={presentation} onClick={onToggle} disabled={disabled}>{presentation?<IconAdjustments size={18}/>:<IconAdjustmentsOff size={18}/>}</Tool>
    <Tool label="Annulla ultima modifica" onClick={onUndo} disabled={disabled||!canUndo}><IconArrowBackUp size={17}/></Tool>
  </div>;
}
