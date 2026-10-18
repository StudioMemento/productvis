import { AXES,defaultAxes } from './axisState.js';
import { WorkspaceIcon } from './WorkspaceIcon.jsx';
import { Tool } from './Controls.jsx';
import { DeltaIcon } from './DeltaIcon.jsx';
export function CategoryNavigation({active,opened,onChange,axes=defaultAxes(),onDelta,onGenerate,onLock,onReset,disabled,controlsDisabled,materialEligible=true,materialResettable=true,secondary=false}){
  const prefix=secondary?'player-category':'category';
  return <nav id={secondary?'productvis-player-navigation':'productvis-navigation'} className="axis-tabs" aria-label={secondary?'Assi nel player':'Assi creativi'} onKeyDown={event=>{
    const current=AXES.findIndex(a=>a.tab===event.target.dataset.category);if(current<0)return;
    const next=event.key==='Home'?0:event.key==='End'?4:event.key==='ArrowLeft'?Math.max(0,current-1):event.key==='ArrowRight'?Math.min(4,current+1):null;
    if(next===null||disabled)return;event.preventDefault();onChange(AXES[next].tab);event.currentTarget.querySelectorAll('[data-category]')[next].focus({preventScroll:true});
  }}>
    {AXES.map(axis=><div key={axis.id} className={`axis-tab ${active===axis.tab?'selected-context':''} ${opened&&active===axis.tab?'active':''} ${axes[axis.id].locked?'locked':''}`}>
      <DeltaIcon kind={axis.id} label={axis.label} value={axes[axis.id].delta} onChange={value=>onDelta?.(axis.id,value)} onGenerate={()=>onGenerate?.(axis.id)} onContext={()=>onChange?.(axis.tab)} disabled={disabled} locked={axes[axis.id].locked} blocked={controlsDisabled||axes[axis.id].locked||axes[axis.id].delta===0||(axis.id==='mat'&&!materialEligible)} blockedReason={controlsDisabled?'Attendi il modello':axes[axis.id].locked?`${axis.label} bloccato · sblocca il lucchetto`:axes[axis.id].delta===0?'Delta a zero · aumentalo per variare':axis.id==='mat'&&!materialEligible?'Scegli una superficie opaca modificabile':''}/>
      <button type="button" className="axis-name" id={`${prefix}-tab-${axis.tab}`} data-category={axis.tab} disabled={disabled} aria-controls={opened&&active===axis.tab?`controls-${axis.tab}`:undefined} aria-expanded={!!opened&&active===axis.tab} onClick={()=>onChange?.(axis.tab)}><span>{axis.label}</span></button>
      <div className="tab-actions">
        <Tool label={`${axes[axis.id].locked?'Sblocca':'Blocca'} asse ${axis.label}`} aria-pressed={axes[axis.id].locked} disabled={disabled||controlsDisabled} onClick={()=>onLock?.(axis.id)}><WorkspaceIcon name={axes[axis.id].locked?'lock':'unlock'} size={13}/></Tool>
        <i className="panel-cue" data-open={!!opened&&active===axis.tab} aria-hidden="true"/>
        <Tool label={`Ripristina asse ${axis.label}`} disabled={disabled||controlsDisabled||(axis.id==='mat'&&!materialResettable)} onClick={()=>onReset?.(axis.id)}><WorkspaceIcon name="reset" size={14}/></Tool>
      </div>
    </div>)}
  </nav>;
}
