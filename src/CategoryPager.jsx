import { Children, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IconCube, IconMountain, IconSun, IconCamera, IconRotate360, IconSettings, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { Tool } from './Controls.jsx';
import { TABS, TAB_LABELS } from './state.js';
import { boundedIndex, pageIndex } from './navigation.js';

const ICONS = { product: IconCube, scene: IconMountain, lighting: IconSun, camera: IconCamera, motion: IconRotate360, project: IconSettings };
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function CategoryPage({ index, active, mounted, children }) {
  const page = useRef(null), savedScroll = useRef(0);
  useLayoutEffect(() => {
    if (mounted) page.current.scrollTop = savedScroll.current;
  }, [mounted]);
  return <div ref={page} className="category-page" role="tabpanel" id={`controls-${TABS[index]}`} aria-labelledby={`category-tab-${TABS[index]}`} aria-hidden={!active} inert={!active ? true : undefined} tabIndex={active ? 0 : -1} onScroll={event => { if (mounted) savedScroll.current = event.currentTarget.scrollTop; }}>{mounted ? children : null}</div>;
}

export function CategoryPager({ active, onChange, children }) {
  const root = useRef(null), pages = useRef(null), settleTimer = useRef(null), pointerDown = useRef(false);
  const activeIndex = Math.max(0, TABS.indexOf(active));
  const [visible, setVisible] = useState(activeIndex);
  const current = useRef({ index: activeIndex, onChange });
  current.current = { index: activeIndex, onChange };

  const navigate = index => onChange(TABS[boundedIndex(index, TABS.length)]);
  const settle = () => {
    if (pointerDown.current || !pages.current) return;
    const index = pageIndex(pages.current.scrollLeft, pages.current.clientWidth, TABS.length);
    setVisible(index);
    if (index !== current.current.index) current.current.onChange(TABS[index]);
  };
  useEffect(() => {
    const rail = pages.current;
    const left = activeIndex * rail.clientWidth;
    clearTimeout(settleTimer.current);
    if (Math.abs(rail.scrollLeft - left) > 1) rail.scrollTo({ left, behavior: reducedMotion() ? 'instant' : 'smooth' });
    else setVisible(activeIndex);
  }, [activeIndex]);
  useEffect(() => {
    const rail = pages.current;
    const resize = new ResizeObserver(() => {
      clearTimeout(settleTimer.current);
      rail.scrollTo({ left: current.current.index * rail.clientWidth, behavior: 'instant' });
      setVisible(current.current.index);
    });
    resize.observe(rail);
    let delta = 0, last = 0, lockedUntil = 0;
    const wheel = e => {
      if (e.ctrlKey || !e.target.closest('[data-category-nav]')) return;
      e.preventDefault();
      const now = performance.now();
      if (now < lockedUntil) return;
      const amount = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 300 : 1);
      if (now - last > 160 || Math.sign(amount) !== Math.sign(delta)) delta = 0;
      last = now; delta += amount;
      if (Math.abs(delta) < 42) return;
      const next = boundedIndex(current.current.index + Math.sign(delta), TABS.length);
      current.current.onChange(TABS[next]); delta = 0; lockedUntil = now + 420;
    };
    const host = root.current; host.addEventListener('wheel', wheel, { passive: false });
    return () => { resize.disconnect(); clearTimeout(settleTimer.current); host.removeEventListener('wheel', wheel); };
  }, []);

  return <div className="category-browser" ref={root}>
    <div className="category-pages" ref={pages}
      onPointerDown={() => { pointerDown.current = true; }} onPointerUp={() => { pointerDown.current = false; settle(); }} onPointerCancel={() => { pointerDown.current = false; }} onLostPointerCapture={() => { pointerDown.current = false; }}
      onScroll={e => { setVisible(pageIndex(e.currentTarget.scrollLeft, e.currentTarget.clientWidth, TABS.length)); clearTimeout(settleTimer.current); settleTimer.current = setTimeout(settle, 170); }}>
      {Children.map(children, (child,index) => <CategoryPage index={index} active={index === visible} mounted={Math.abs(index - visible) <= 1 || index === activeIndex}>{child}</CategoryPage>)}
    </div>
    <div className="category-pagination" data-category-nav>
      <Tool label="Categoria precedente" disabled={visible === 0} onClick={() => navigate(visible - 1)}><IconChevronLeft size={19}/></Tool>
      <span className="category-location" aria-live="polite" aria-label={`${TAB_LABELS[TABS[visible]]}, ${visible + 1} di 6`}><span>{String(visible + 1).padStart(2,'0')} <i>/</i> 06</span></span>
      <Tool label="Categoria successiva" disabled={visible === TABS.length - 1} onClick={() => navigate(visible + 1)}><IconChevronRight size={19}/></Tool>
    </div>
    <nav className="category-tabs" role="tablist" aria-label="Categorie ProductVis" data-category-nav title="Scorri per cambiare categoria"
      onKeyDown={e => { const index = Number(e.target.dataset.index); if (!Number.isFinite(index)) return; let next; if (e.key === 'ArrowRight') next = boundedIndex(index + 1, TABS.length); else if (e.key === 'ArrowLeft') next = boundedIndex(index - 1, TABS.length); else if (e.key === 'Home') next = 0; else if (e.key === 'End') next = TABS.length - 1; else return; e.preventDefault(); navigate(next); e.currentTarget.querySelectorAll('[role="tab"]')[next].focus({ preventScroll: true }); }}>
      {TABS.map((id,index) => { const Icon = ICONS[id]; return <button key={id} id={`category-tab-${id}`} type="button" role="tab" data-index={index} aria-selected={index === visible} aria-controls={`controls-${id}`} tabIndex={index === visible ? 0 : -1} className={index === visible ? 'active' : ''} onClick={() => navigate(index)}><Icon size={21} stroke={1.4}/><span>{TAB_LABELS[id]}</span></button>; })}
      <span className="category-marker" aria-hidden="true" style={{ transform: `translateX(${visible * 100}%)` }}/>
    </nav>
  </div>;
}
