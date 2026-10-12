import { useState } from 'react';
import { IconUpload, IconCube, IconFocus2, IconArrowBarToDown, IconMaximize, IconRefresh } from '@tabler/icons-react';
import { Choices, Knob } from './Controls.jsx';
import { TRANSFORM_LIMITS } from './modelTransform.js';

export function ModelControls({ name, transform, disabled, loading, onImport, onDemo, onChange, onAction, onStart }) {
  const [mode, setMode] = useState('position');
  const keys = mode === 'position' ? ['x', 'y', 'z'] : mode === 'rotation' ? ['rx', 'ry', 'rz'] : ['scale'];
  return <div className="model-controls">
    <div className="model-heading"><IconCube size={15}/><span title={name}>{name}</span></div>
    <div className="model-import-actions">
      <button type="button" disabled={loading} onClick={onImport}><IconUpload size={16}/>Importa GLB</button>
      <button type="button" disabled={loading} onClick={onDemo}><IconCube size={16}/>Demo</button>
    </div>
    <Choices className="transform-modes" label="Trasforma" value={mode} options={[{value:'position',label:'Posizione'},{value:'rotation',label:'Rotazione'},{value:'scale',label:'Scala'}]} onChange={setMode}/>
    <div className={`knob-grid transform-knobs transform-${mode}`}>
      {keys.map((key,i)=><Knob key={key} label={key==='scale'?'Scala':['X','Y','Z'][i]} ariaLabel={`${mode==='position'?'Posizione':mode==='rotation'?'Rotazione':'Scala'} ${key==='scale'?'modello':['X','Y','Z'][i]}`} value={transform[key]} min={TRANSFORM_LIMITS[key][0]} max={TRANSFORM_LIMITS[key][1]} step={mode==='rotation'?1:.01} format={v=>mode==='rotation'?`${Math.round(v)}°`:key==='scale'?`${v.toFixed(2)}×`:v.toFixed(2)} disabled={disabled} onStart={onStart} onChange={value=>onChange(key,value)}/>)}
    </div>
    <div className="model-space-actions">
      {[[IconFocus2,'center','Centra','Centra sugli assi X/Z'],[IconArrowBarToDown,'ground','Appoggia','Appoggia sul piano della scena'],[IconMaximize,'frame','Inquadra','Inquadra il modello'],[IconRefresh,'reset','Reset','Ripristina posizione, rotazione e scala']].map(([Icon,action,label,title])=><button key={action} type="button" title={title} disabled={disabled} onClick={()=>onAction(action)}><Icon size={17}/><span>{label}</span></button>)}
    </div>
  </div>;
}
