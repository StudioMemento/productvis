import { useRef, useState } from 'react';
import { dragValue, snapValue } from './controlMath.js';

export function DeltaControl({ value, onChange, disabled = false }) {
  const gesture = useRef(null), suppressClick = useRef(false), cancelled = useRef(false);
  const [dragging, setDragging] = useState(false), [editing, setEditing] = useState(false), [draft, setDraft] = useState('');
  const set = next => onChange(snapValue(next, 0, 100, 1));
  const finish = () => { gesture.current = null; setDragging(false); };
  const commit = () => {
    const next = Number(draft.replace(',', '.'));
    if (!cancelled.current && draft.trim() && Number.isFinite(next)) set(next);
    setEditing(false);
  };
  const similarity = value === 0 ? 'Invariato' : value < 40 ? 'Simile' : value < 70 ? 'Variazione' : 'Nuovo setup';
  return <div className={`delta-control ${dragging ? 'is-dragging' : ''}`}>
    {editing ? <label className="delta-entry"><span aria-hidden="true">Δ</span><input autoFocus type="text" inputMode="numeric" aria-label="Delta della variazione, da 0 a 100" value={draft} onFocus={e => e.target.select()} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { e.stopPropagation(); cancelled.current = true; setEditing(false); } }}/><small aria-hidden="true">%</small></label> :
      <button type="button" className="delta-value" role="spinbutton" aria-label="Delta della variazione" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-valuetext={`${value}% · ${similarity}`} disabled={disabled} title="Delta: basso = simile, alto = diverso. Trascina o tocca il valore."
        onPointerDown={e => { if (e.button !== 0) return; e.currentTarget.focus({ preventScroll: true }); gesture.current = { id: e.pointerId, x: e.clientX, value }; suppressClick.current = false; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={e => { const g = gesture.current; if (g?.id !== e.pointerId || Math.abs(e.clientX - g.x) < 4) return; suppressClick.current = true; setDragging(true); set(dragValue(g.value, e.clientX - g.x, 0, 100, 1, e.shiftKey)); }}
        onPointerUp={finish} onPointerCancel={() => { suppressClick.current = true; finish(); }} onLostPointerCapture={finish}
        onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } cancelled.current = false; setDraft(String(value)); setEditing(true); }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') suppressClick.current = false; const steps = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }; if (e.key in steps) { e.preventDefault(); e.stopPropagation(); set(value + steps[e.key]); } else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); e.stopPropagation(); set(e.key === 'Home' ? 0 : 100); } }}>
        <span aria-hidden="true">Δ</span><b>{value}<small>%</small></b>
      </button>}
  </div>;
}
