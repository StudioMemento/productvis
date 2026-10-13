import { useState } from 'react';
import { IconPalette, IconChevronDown, IconGridDots, IconLayersSubtract } from '@tabler/icons-react';
import { Knob, KnobGrid, Presets } from './Controls.jsx';
import { SWATCHES } from './state.js';

export function MeshEditor({ material, metadata, onChange, onPreset, onStart, disabled }) {
  const [optics,setOptics]=useState(false);
  const value=(key,fallback)=>material[key]??metadata?.original?.[key]??fallback;
  const knob=(key,label,props={})=><Knob key={key} label={label} value={value(key,0)} onChange={v=>onChange({[key]:v})} onStart={onStart} disabled={disabled} {...props}/>;
  const channels=metadata?.uvChannels||[];
  const color=value('color','#808080');
  const setColor=color=>onChange({color,overlay:1});
  return <div className="mesh-editor" aria-label={`Editor ${metadata?.label||'superficie'}`}>
    <div className="mesh-editor-target"><span><IconLayersSubtract size={14}/>{metadata?.label||'Superficie'}</span><div className="uv-channels" role="group" aria-label="UV della superficie selezionata"><IconGridDots size={14}/>{channels.length?channels.map(channel=><button key={channel} type="button" aria-label={`UV ${channel+1}, texture colore`} title={`UV ${channel+1} · texture colore`} aria-pressed={value('uvChannel',0)===channel} className={value('uvChannel',0)===channel?'active':''} disabled={disabled||!metadata?.hasTexture} onClick={()=>onChange({uvChannel:channel})}>UV {channel+1}</button>):<span>—</span>}</div></div>
    <div className="mesh-look-row"><span className="mesh-group-label">Finitura</span><Presets category="product" selected={value('finish','original')} onChoose={onPreset} disabled={disabled||!metadata?.lit}/></div>
    <div className="mesh-color-row"><span className="mesh-group-label">Colore</span><div className="diamond-colors" role="group" aria-label="Colore superficie">{SWATCHES.map(s=><button key={s.color} type="button" className={`color-diamond ${color.toLowerCase()===s.color?'selected':''}`} style={{'--swatch':s.color}} title={s.name} aria-label={s.name} aria-pressed={color.toLowerCase()===s.color} disabled={disabled} onClick={()=>setColor(s.color)}><i/></button>)}<label className="color-diamond custom-color" title="Colore personalizzato"><i style={{'--swatch':color}}><IconPalette size={13}/></i><input type="color" aria-label="Colore personalizzato" value={color} disabled={disabled} onChange={e=>setColor(e.target.value)}/></label></div></div>
    <span className="control-group-title">Superficie</span><KnobGrid className="mesh-surface-knobs" label="Proprietà superficie">{knob('overlay','Colore')}{knob('roughness','Rugosità',{disabled:disabled||!metadata?.lit})}{knob('metalness','Metallo',{disabled:disabled||!metadata?.lit})}{knob('clearcoat','Vernice',{disabled:disabled||!metadata?.physical})}{knob('normalScale','Rilievo',{max:2,format:v=>`${v.toFixed(1)}×`,disabled:disabled||!metadata?.hasNormalMap})}</KnobGrid>
    <button type="button" className="mesh-optics-toggle" aria-expanded={optics} onClick={()=>setOptics(v=>!v)}><span>Ottica · emissione</span><IconChevronDown size={14} style={{transform:optics?'rotate(180deg)':undefined}}/></button>
    {optics&&<div className="mesh-optics"><KnobGrid label="Ottica ed emissione" className="mesh-optics-grid">
      {knob('transmission','Trasmissione',{disabled:disabled||!metadata?.physical})}
      {knob('ior','IOR',{value:value('ior',1.5),min:1,max:2.5,format:v=>v.toFixed(2),disabled:disabled||!metadata?.physical})}
      {knob('thickness','Spessore',{max:5,step:.05,format:v=>v.toFixed(2),disabled:disabled||!metadata?.physical})}
      {knob('emissiveIntensity','Emissione',{value:value('emissiveIntensity',1),min:0,max:3,step:.05,format:v=>`${v.toFixed(2)}×`,disabled:disabled||!metadata?.lit})}
      <div className={`color-control ${disabled||!metadata?.lit?'is-disabled':''}`}><label className="color-diamond custom-color emission-color" title="Colore emissione"><i style={{'--swatch':value('emissive','#000000')}}/><input type="color" aria-label="Colore emissione" value={value('emissive','#000000')} disabled={disabled||!metadata?.lit} onChange={e=>onChange({emissive:e.target.value})}/></label><span className="control-label">Tinta luce</span></div>
    </KnobGrid></div>}
  </div>;
}
