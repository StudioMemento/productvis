import { Choices, Knob, KnobGrid } from './Controls.jsx';
export function SurfacePolicyControls({material,metadata,onChange,onStart,disabled}) {
  const value=(key,fallback)=>material[key]??metadata?.original?.[key]??fallback;
  const source=value('sideMode',value('doubleSide',false)?'double':'front');
  const side=source==='source'?(metadata?.original?.doubleSide?'double':'front'):source,alpha=value('alphaMode','opaque');
  return <div className="surface-policy"><span className="control-group-title">{metadata?.label||'Superficie'}</span>
    <Choices label="Facce" value={side} options={[['front','Esterno'],['double','Due lati'],['back','Interno']].map(([value,label])=>({value,label,disabled}))} onChange={sideMode=>onChange({sideMode,doubleSide:sideMode==='double'})}/>
    <Choices label="Alpha" value={alpha} options={[['opaque','Solido'],['mask','Taglio'],['blend','Blend']].map(([value,label])=>({value,label,disabled}))} onChange={alphaMode=>onChange({alphaMode})}/>
    <KnobGrid><Knob label="Opacità" value={value('opacity',1)} onChange={opacity=>onChange({opacity})} onStart={onStart} disabled={disabled}/><Knob label="Soglia" value={value('alphaCutoff',.5)} onChange={alphaCutoff=>onChange({alphaCutoff})} onStart={onStart} disabled={disabled||alpha!=='mask'}/></KnobGrid>
  </div>;
}
