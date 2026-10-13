import { Children, useLayoutEffect, useRef } from 'react';
import { TABS } from './state.js';

// Only the disclosed category exists in the scroll viewport. Hidden scroll-snap
// pages cannot emit a late selection after another menu has opened.
export function CategoryPager({active,children}){
  const viewport=useRef(null),scroll=useRef({});
  useLayoutEffect(()=>{viewport.current.scrollTop=scroll.current[active]||0;},[active]);
  return <div ref={viewport} className="category-page dropdown-scroll" role="region" id={`controls-${active}`} aria-labelledby={`category-tab-${active}`} tabIndex={0}
    onScroll={event=>{scroll.current[active]=event.currentTarget.scrollTop;}}>
    {Children.toArray(children)[TABS.indexOf(active)]}
  </div>;
}
