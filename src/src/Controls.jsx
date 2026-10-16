import { Children, Fragment, useRef, useState } from 'react';
import { PresetSymbol } from './PresetSymbol.jsx';
import { VariantGrid } from './VariantGrid.jsx';
import { PRESETS, TAB_LABELS } from './state.js';
import { snapValue, dragValue } from './controlMath.js';

export function Tool({ label, children, className = '', ...props }) {
  return <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
}

const controlCount = children => Children.toArray(children).reduce((count,child)=>count+(child.type===Fragment?controlCount(child.props.children):1),0);
export function KnobGrid({ children, className = '', label }) {
  return <div className={`knob-grid ${className}`} data-count={controlCount(children)} role={label?'group':undefined} aria-label={label}>{children}</div>;
}

export function Knob({ label, ariaLabel = label, value, min = 0, max = 1, step = .01, onChange, format = v => `${Math.round(v * 100)}%`, disabled = false, onStart, showValue = true }) {
  const gesture = useRef(null);
  const [dragging, setDragging] = useState(false), [editing, setEditing] = useState(false), [draft, setDraft] = useState('');
  const set = v => onChange(snapValue(v, min, max, step));
  const changeBy = amount => { onStart?.(); set(value + amount); };
  const stop = e => { if (gesture.current?.id !== e.pointerId) return; gesture.current = null; setDragging(false); };
  const commit = () => { const next = Number(draft.replace(',', '.')); if (draft.trim() && Number.isFinite(next)) { onStart?.(); set(next); } setEditing(false); };
  const progress = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return <div className={`knob-field ${dragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`}>
    <button type="button" className="knob" role="spinbutton" aria-label={ariaLabel} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={format(value)} disabled={disabled} title="Trascina su / giù · Frecce per regolare" style={{ '--turn': `${-135 + progress * 270}deg` }}
      onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.focus({ preventScroll: true }); onStart?.(); gesture.current = { id: e.pointerId, y: e.clientY, start: value }; e.currentTarget.setPointerCapture(e.pointerId); setDragging(true); }}
      onPointerMove={e => { const g = gesture.current; if (g?.id === e.pointerId) set(dragValue(g.start, g.y - e.clientY, min, max, step, e.shiftKey)); }}
      onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
      onKeyDown={e => { const keys = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: step * 10, PageDown: -step * 10 }; if (e.key in keys) { e.preventDefault(); changeBy(keys[e.key]); } else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); onStart?.(); set(e.key === 'Home' ? min : max); } }}>
      <svg viewBox="0 0 48 48" aria-hidden="true"><path className="knob-track" pathLength="100" d="M9.15 38.85a21 21 0 1 1 29.7 0" /><path className="knob-progress" pathLength="100" strokeDasharray={`${progress * 100} 100`} d="M9.15 38.85a21 21 0 1 1 29.7 0" /></svg>
      <span className="knob-face"><i /></span>
    </button>
    <div className="knob-caption">
      <span className="control-label">{label}</span>
      {showValue && <div className="knob-value">
      {editing ? <input autoFocus className="number-entry" type="text" inputMode="decimal" aria-label={`Valore ${ariaLabel}`} value={draft} onFocus={e => e.target.select()} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); } }} /> : <button type="button" className="value-edit" disabled={disabled} aria-label={`Imposta ${ariaLabel}: ${format(value)}`} onClick={() => { setDraft(String(value)); setEditing(true); }}>{format(value)}</button>}
      </div>}
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
