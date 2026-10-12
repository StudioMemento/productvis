import { useEffect, useMemo, useRef, useState } from 'react';
import { IconCar, IconWheel, IconWindow, IconBulb, IconArmchair, IconLayersIntersect, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { Tool } from './Controls.jsx';
import { boundedIndex, groupMaterials, locateMaterial, scrubIndex } from './navigation.js';

const ICONS = { body: IconCar, wheels: IconWheel, glass: IconWindow, lights: IconBulb, interior: IconArmchair, details: IconLayersIntersect };

export function MaterialPicker({ materials, selectedId, onSelect, disabled }) {
  const groups = useMemo(() => groupMaterials(materials), [materials]);
  const { groupIndex, materialIndex } = locateMaterial(groups, selectedId);
  const group = groups[groupIndex], selected = group?.materials[materialIndex];
  const root = useRef(null), gesture = useRef(null), remembered = useRef({}), current = useRef({});
  const [dragging, setDragging] = useState(false);
  current.current = { groupIndex, selectedId };
  useEffect(() => { remembered.current = {}; }, [materials]);
  useEffect(() => { if (group && selected) remembered.current[group.id] = selected.id; }, [group, selected]);
  const chooseGroup = index => {
    if (disabled) return;
    const target = groups[boundedIndex(index, groups.length)];
    if (!target) return;
    const id = target.materials.find(m => m.id === remembered.current[target.id])?.id || target.materials[0].id;
    if (id !== current.current.selectedId) onSelect(id);
  };
  current.current.chooseGroup = chooseGroup;
  useEffect(() => {
    const host = root.current;
    let delta = 0, last = 0, lockedUntil = 0;
    const wheel = e => {
      if (e.ctrlKey || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault(); e.stopPropagation();
      const now = performance.now();
      if (now < lockedUntil) return;
      const amount = e.deltaX * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 300 : 1);
      if (now - last > 160 || Math.sign(amount) !== Math.sign(delta)) delta = 0;
      last = now; delta += amount;
      if (Math.abs(delta) < 32) return;
      current.current.chooseGroup(current.current.groupIndex + Math.sign(delta));
      delta = 0; lockedUntil = now + 260;
    };
    host.addEventListener('wheel', wheel, { passive: false });
    return () => host.removeEventListener('wheel', wheel);
  }, []);
  const chooseMaterial = index => { const target = group?.materials[boundedIndex(index, group.materials.length)]; if (!disabled && target && target.id !== selectedId) onSelect(target.id); };
  const end = e => { if (gesture.current?.id !== e.pointerId) return; gesture.current = null; setDragging(false); };
  return <div className={`material-picker ${dragging ? 'is-dragging' : ''}`} ref={root} data-gesture-local>
    <div className="surface-reel-row">
      <Tool label="Zona precedente" disabled={disabled || groupIndex === 0} onClick={() => chooseGroup(groupIndex - 1)}><IconChevronLeft size={16}/></Tool>
      <div className="surface-reel" role="slider" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-label="Zona del prodotto" aria-valuemin={0} aria-valuemax={Math.max(0, groups.length - 1)} aria-valuenow={groupIndex} aria-valuetext={group?.label || 'Caricamento'} title="Trascina a scatti per scegliere la zona"
        onPointerDown={e => { if (disabled || e.button !== 0) return; e.currentTarget.focus({ preventScroll: true }); gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, index: groupIndex }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={e => { const g = gesture.current; if (!g || g.id !== e.pointerId) return; const dx = e.clientX - g.x, dy = e.clientY - g.y; if (!dragging && (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy))) return; setDragging(true); chooseGroup(scrubIndex(g.index, dx, groups.length)); }}
        onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
        onKeyDown={e => { if (['ArrowLeft','ArrowDown','ArrowRight','ArrowUp','Home','End'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); chooseGroup(e.key === 'Home' ? 0 : e.key === 'End' ? groups.length - 1 : groupIndex + (['ArrowRight','ArrowUp'].includes(e.key) ? 1 : -1)); } }}>
        <div className="surface-reel-track" style={{ transform: `translateX(${-groupIndex * 100}%)` }}>{groups.length ? groups.map(g => { const Icon = ICONS[g.id]; return <span className="surface-family" key={g.id} aria-hidden="true"><Icon size={20} stroke={1.4}/><span>{g.label}</span></span>; }) : <span className="surface-family">Carico le superfici</span>}</div>
        <span className="reel-grip" aria-hidden="true"><i/><i/><i/></span>
      </div>
      <Tool label="Zona successiva" disabled={disabled || groupIndex === groups.length - 1 || !groups.length} onClick={() => chooseGroup(groupIndex + 1)}><IconChevronRight size={16}/></Tool>
    </div>
    <div className="surface-detents" role="group" aria-label="Zone del prodotto">{groups.map((g,index) => <button key={g.id} type="button" aria-label={g.label} title={g.label} aria-pressed={index === groupIndex} className={index === groupIndex ? 'selected' : ''} disabled={disabled} onClick={() => chooseGroup(index)}><i/></button>)}</div>
    <div className="surface-target" aria-live="polite" aria-label="Superficie in modifica">
      <strong title={selected?.rawName}>{selected?.label || '—'}</strong>
      {group?.materials.length > 1 && <div className="surface-part-stepper"><Tool label="Superficie precedente" disabled={disabled || materialIndex === 0} onClick={() => chooseMaterial(materialIndex - 1)}><IconChevronLeft size={13}/></Tool><span>{materialIndex + 1}<i>/</i>{group.materials.length}</span><Tool label="Superficie successiva" disabled={disabled || materialIndex === group.materials.length - 1} onClick={() => chooseMaterial(materialIndex + 1)}><IconChevronRight size={13}/></Tool></div>}
    </div>
  </div>;
}
