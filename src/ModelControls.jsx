import { IconUpload, IconFocus2, IconArrowBarToDown, IconMaximize, IconRefresh } from './icons.jsx';
import { Knob, KnobGrid } from './Controls.jsx';
import { TRANSFORM_LIMITS } from './modelTransform.js';
export function ModelControls({name,transform,disabled,loading,onImport,onDemo,onChange,onAction,onStart}) {
  return <div className="model-controls">
    <div className="model-import-actions"><button type="button" className="load-model" disabled={loading} onClick={onImport}><IconUpload size={16}/>Carica modello<span className="model-format">GLB</span></button><button type="button" disabled={loading} onClick={onDemo}>Demo</button></div>
    <div className="model-heading"><span title={name}>{name}</span></div>
    {[['position','Posizione',['x','y','z']],['rotation','Rotazione',['rx','ry','rz']],['scale','Scala',['scale']]].map(([mode,label,keys])=><section className="transform-section" key={mode} aria-label={label}><h4>{label}</h4><KnobGrid className={`transform-knobs transform-${mode}`}>{keys.map((key,i)=><Knob key={key} label={key==='scale'?'Scala':['X','Y','Z'][i]} ariaLabel={`${label} ${key==='scale'?'modello':['X','Y','Z'][i]}`} value={transform[key]} min={TRANSFORM_LIMITS[key][0]} max={TRANSFORM_LIMITS[key][1]} step={mode==='rotation'?1:.01} unit={mode==='rotation'?'°':key==='scale'?'×':''} format={v=>mode==='rotation'?`${Math.round(v)}°`:key==='scale'?`${v.toFixed(2)}×`:v.toFixed(2)} disabled={disabled} onStart={onStart} onChange={value=>onChange(key,value)}/>)}</KnobGrid></section>)}
    <div className="model-space-actions">{[[IconFocus2,'center','Centra','Centra sugli assi X/Z'],[IconArrowBarToDown,'ground','Appoggia','Appoggia sul piano della scena'],[IconMaximize,'frame','Inquadra','Inquadra il modello'],[IconRefresh,'reset','Reset','Ripristina posizione, rotazione e scala']].map(([Icon,action,label,title])=><button key={action} type="button" title={title} disabled={disabled} onClick={()=>onAction(action)}><Icon size={17}/><span>{label}</span></button>)}</div>
  </div>;
}
