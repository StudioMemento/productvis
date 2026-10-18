import {useState} from 'react';
import {Knob} from './Controls.jsx';

export function WorkspaceContext({title,surface,axis,value,onDelta,locked,disabled}){
  const [expanded,setExpanded]=useState(false);
  return <div className="workspace-context">
    <div className="context-line"><span className="context-title">{title}</span>{surface&&<span className="context-surface" title={`Materiale condiviso · ${surface}`}>{surface}</span>}{axis&&<button type="button" className="context-delta" aria-label={`Regola delta ${axis.label}`} aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>Δ <span>{value}</span></button>}</div>
    {expanded&&axis&&<div className="axis-settings"><Knob label={`Delta ${axis.label}`} value={value} min={0} max={100} step={1} format={v=>String(v)} inputScale={1} onChange={onDelta} disabled={disabled}/><div><span>{locked?'Asse bloccato · le modifiche manuali restano attive':axis.scope}</span><small>Icona: varia · Nome: apri proprietà</small></div></div>}
  </div>;
}

export function WorkspaceSizeControls({layout,disabled}){
  return <div className="workspace-sizes" role="group" aria-label="Dimensione pannello"><span>{layout.bottom?'Altezza':'Larghezza'} · {Math.round(layout.size)} px</span><div>{[['Compatto',()=>layout.setSize(layout.bounds.min)],['Standard',layout.reset],['Ampio',()=>layout.setSize(layout.bounds.max)]].map(([name,action])=><button type="button" key={name} onClick={action} disabled={disabled}>{name}</button>)}</div></div>;
}
