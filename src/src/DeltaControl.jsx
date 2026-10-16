import { Knob } from './Controls.jsx';
export function DeltaControl({ value, onChange, disabled = false }) {
  return <div className="delta-control delta-knob" title="Delta · intensità della variazione"><Knob label="Δ" ariaLabel="Delta della variazione" value={value} min={0} max={100} step={1} format={v=>String(Math.round(v))} onChange={onChange} disabled={disabled}/></div>;
}
