import { TABS, TAB_LABELS } from './state.js';
export function CategoryNavigation({active,opened,onChange,disabled}) {
  return <nav id="productvis-navigation" className="axis-tabs" aria-label="Assi creativi" style={{'--active-axis':TABS.indexOf(active)}} onKeyDown={event=>{
    const current=TABS.indexOf(event.target.dataset.category);if(current<0)return;
    const next=event.key==='Home'?0:event.key==='End'?4:event.key==='ArrowLeft'?Math.max(0,current-1):event.key==='ArrowRight'?Math.min(4,current+1):null;
    if(next===null||disabled)return;event.preventDefault();onChange(TABS[next]);event.currentTarget.querySelectorAll('button')[next].focus({preventScroll:true});
  }}>
    {TABS.map((id,i)=><button key={id} type="button" id={`category-tab-${id}`} data-category={id} disabled={disabled} aria-controls={opened&&active===id?`controls-${id}`:undefined} aria-expanded={opened&&active===id} className={opened&&active===id?'active':''} onClick={()=>onChange(id)}><small>{String(i+1).padStart(2,'0')}</small><span>{TAB_LABELS[id]}</span></button>)}
    <i className={`axis-tab-line ${opened?'':'is-idle'}`} aria-hidden="true"/>
  </nav>;
}
