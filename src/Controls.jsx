import { Children, Fragment, createContext, useContext, useId, useRef, useState } from 'react';
import { PresetSymbol } from './PresetSymbol.jsx';
import { VariantGrid } from './VariantGrid.jsx';
import { PRESETS, TAB_LABELS } from './state.js';
import { snapValue, dragValue, valueAdapter } from './controlMath.js';

export const ControlGestureContext=createContext(null);

export function Tool({ label, children, className = '', ...props }) {
  return <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
}

const controlCount = children => Children.toArray(children).reduce((count,child)=>count+(child.type===Fragment?controlCount(child.props.children):1),0);
export function KnobGrid({ children, className = '', label }) {
  return <div className={`knob-grid ${className}`} data-count={controlCount(children)} role={label?'group':undefined} aria-label={label}>{children}</div>;
}

export function Knob({ label, ariaLabel = label, value, min = 0, max = 1, step = .01, onChange, format, unit=format?'':'%', inputScale=format?1:100, precision, disabled = false, disabledReason, onStart, showValue = true }) {
  const gesture = useRef(null),origin=useRef(null),entry=useRef(null),editingRef=useRef(false),transaction=useContext(ControlGestureContext),errorId=useId();
  const [dragging, setDragging] = useState(false), [editing, setEditing] = useState(false), [draft, setDraft] = useState(''),[error,setError]=useState('');
  const adapter=valueAdapter({min,max,step,scale:inputScale,unit,precision});
  const formatted=format?format(value):`${adapter.draft(value)}%`;
  const set = v => onChange(snapValue(v, min, max, step));
  const changeBy = amount => { onStart?.(); set(value + amount); };
  const stop = (e,cancel=false) => { const g=gesture.current;if(g?.id!==e.pointerId)return;gesture.current=null;setDragging(false);if(cancel){onChange(g.start);transaction?.cancel();}else transaction?.end(); };
  const close = (focus=true) => {editingRef.current=false;setEditing(false);setError('');if(focus)requestAnimationFrame(()=>origin.current?.focus({preventScroll:true}));};
  const commit = (focus=true) => {if(!editingRef.current)return;const result=adapter.parse(draft);if(result.error){setError(result.error);return;}editingRef.current=false;if(result.value!==value){onStart?.();set(result.value);}close(focus);};
  const progress = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return <div className={`knob-field ${dragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`}>
    <button type="button" className="knob" role="spinbutton" aria-label={ariaLabel} aria-valuemin={adapter.min} aria-valuemax={adapter.max} aria-valuenow={Number(adapter.draft(value))} aria-valuetext={formatted} disabled={disabled} title={disabledReason||'Trascina su / giù · Tocca il valore per scriverlo'} style={{ '--turn': `${-135 + progress * 270}deg` }}
      onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.focus({ preventScroll: true }); onStart?.();transaction?.begin();gesture.current = { id: e.pointerId, y: e.clientY, start: value }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={e => { const g = gesture.current; if (g?.id === e.pointerId&&Math.abs(g.y-e.clientY)>4){setDragging(true);set(dragValue(g.start, g.y - e.clientY, min, max, step, e.shiftKey));} }}
      onPointerUp={e=>stop(e)} onPointerCancel={e=>stop(e,true)} onLostPointerCapture={e=>stop(e,true)}
      onKeyDown={e => { if(e.key==='Escape'&&gesture.current){e.preventDefault();e.stopPropagation();stop({pointerId:gesture.current.id},true);return;}const keys = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: step * 10, PageDown: -step * 10 }; if (e.key in keys) { e.preventDefault(); changeBy(keys[e.key]); } else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); onStart?.(); set(e.key === 'Home' ? min : max); } }}>
      <svg viewBox="0 0 48 48" aria-hidden="true"><path className="knob-track" pathLength="100" d="M9.15 38.85a21 21 0 1 1 29.7 0" /><path className="knob-progress" pathLength="100" strokeDasharray={`${progress * 100} 100`} d="M9.15 38.85a21 21 0 1 1 29.7 0" /></svg>
      <span className="knob-face"><i /></span>
    </button>
    <div className="knob-caption">
      <span className="control-label">{label}</span>
      {showValue && <div className="knob-value">
      {editing ? <div ref={entry} className="number-editor" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))commit(false);}}>
        <input autoFocus className="number-entry" type="text" inputMode="decimal" aria-label={`Valore ${ariaLabel}`} aria-invalid={!!error} aria-describedby={error?errorId:undefined} value={draft} onFocus={e=>{e.target.select();e.target.scrollIntoView({block:'nearest'});}} onChange={e=>{setDraft(e.target.value);setError('');}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();commit();}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}}}/>
        <span className="number-unit">{unit}</span><div className="number-actions"><button type="button" aria-label={`Conferma ${ariaLabel}`} onClick={()=>commit()}>✓</button><button type="button" aria-label={`Annulla ${ariaLabel}`} onClick={()=>close()}>×</button></div>
        {error&&<span className="number-error" id={errorId} role="alert">{error}</span>}
      </div> : <button ref={origin} type="button" className="value-edit" disabled={disabled} aria-label={`Imposta ${ariaLabel}: ${formatted}`} onClick={()=>{setDraft(adapter.draft(value));setError('');editingRef.current=true;setEditing(true);}}>{formatted}</button>}
      </div>}
      {disabled&&disabledReason&&<span className="control-reason">{disabledReason}</span>}
    </div>
  </div>;
}

export function Toggle({ label, checked, onChange, disabled = false, icon: Icon }) {
  return <button type="button" role="switch" aria-checked={checked} disabled={disabled} className={`toggle ${checked ? 'selected' : ''}`} onClick={() => onChange(!checked)}>{Icon && <Icon size={17} />}<span>{label}</span><i aria-hidden="true"><b /></i></button>;
}

export function Choices({ label, value, options, onChange, className = '' }) {
  return <div className={`choice-field ${className}`}><span className="control-label">{label}</span><div className="choices" role="group" aria-label={label}>{options.map(o => <button type="button" key={o.value} disabled={o.disabled} aria-label={o.ariaLabel} title={o.ariaLabel || (typeof o.label === 'string' ? o.label : undefined)} aria-pressed={o.value === value} className={o.value === value ? 'selected' : ''} onClick={() => onChange(o.value)}>{o.label}</button>)}</div></div>;
}

export function Presets({category,selected,onChoose,disabled}) {
  const label=category==='motion'?'Movimento':TAB_LABELS[category];
  return <VariantGrid items={PRESETS[category]} selected={selected} onChoose={onChoose} disabled={disabled} label={`Preset ${label}`} className={`presets-${category}`} renderSymbol={p=>category==='product'?<i className={`finish-sample finish-${p.id}`}/>:<PresetSymbol category={category} id={p.id}/>}/>;
}

export function Category({ id, title, icon: Icon, action, children }) {
  return <section className={`category category-${id}`} id={`category-${id}`} aria-labelledby={`title-${id}`}><header className="category-heading"><h2 id={`title-${id}`}>{title}</h2><span className="category-index">{String(['product','scene','lighting','camera','motion'].indexOf(id)+1).padStart(2,'0')}</span>{action}</header>{children}</section>;
}
