import { Children, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TABS } from './state.js';
import { pageIndex } from './navigation.js';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function CategoryPage({ index, active, mounted, children }) {
  const page = useRef(null), savedScroll = useRef(0);
  useLayoutEffect(() => {
    if (mounted) page.current.scrollTop = savedScroll.current;
  }, [mounted]);
  return <div ref={page} className="category-page" role="tabpanel" id={`controls-${TABS[index]}`} aria-labelledby={`category-tab-${TABS[index]}`} aria-hidden={!active} inert={!active ? true : undefined} tabIndex={active ? 0 : -1} onScroll={event => { if (mounted) savedScroll.current = event.currentTarget.scrollTop; }}>{mounted ? children : null}</div>;
}

export function CategoryPager({ active, onChange, children }) {
  const pages = useRef(null), settleTimer = useRef(null), pointerDown = useRef(false);
  const requested = useRef(null);
  const activeIndex = Math.max(0, TABS.indexOf(active));
  const [visible, setVisible] = useState(activeIndex);
  const current = useRef({ index: activeIndex, onChange });
  current.current = { index: activeIndex, onChange };

  const settle = () => {
    if (pointerDown.current || !pages.current) return;
    const index = pageIndex(pages.current.scrollLeft, pages.current.clientWidth, TABS.length);
    // A long tab jump must not be replaced by an intermediate scroll-snap page.
    if (requested.current !== null && index !== requested.current) return;
    requested.current = null;
    setVisible(index);
    if (index !== current.current.index) current.current.onChange(TABS[index]);
  };
  useEffect(() => {
    const rail = pages.current;
    const left = activeIndex * rail.clientWidth;
    clearTimeout(settleTimer.current);
    if (Math.abs(rail.scrollLeft - left) > 1) {
      requested.current = activeIndex; setVisible(activeIndex);
      const distant = Math.abs(rail.scrollLeft - left) > rail.clientWidth * 1.1;
      rail.scrollTo({ left, behavior: reducedMotion() || distant ? 'instant' : 'smooth' });
    }
    else setVisible(activeIndex);
  }, [activeIndex]);
  useEffect(() => {
    const rail = pages.current;
    const resize = new ResizeObserver(() => {
      clearTimeout(settleTimer.current);
      requested.current = null;
      rail.scrollTo({ left: current.current.index * rail.clientWidth, behavior: 'instant' });
      setVisible(current.current.index);
    });
    resize.observe(rail);
    return () => { resize.disconnect(); clearTimeout(settleTimer.current); };
  }, []);

  return <div className="category-browser">
    <div className="category-pages" ref={pages}
      onPointerDown={() => { requested.current = null; pointerDown.current = true; }} onPointerUp={() => { pointerDown.current = false; settle(); }} onPointerCancel={() => { pointerDown.current = false; }} onLostPointerCapture={() => { pointerDown.current = false; }}
      onWheel={() => { requested.current = null; }}
      onScroll={e => { if (requested.current === null) setVisible(pageIndex(e.currentTarget.scrollLeft, e.currentTarget.clientWidth, TABS.length)); clearTimeout(settleTimer.current); settleTimer.current = setTimeout(settle, 130); }}>
      {Children.map(children, (child,index) => <CategoryPage index={index} active={index === visible} mounted={Math.abs(index - visible) <= 1 || index === activeIndex}>{child}</CategoryPage>)}
    </div>
  </div>;
}
