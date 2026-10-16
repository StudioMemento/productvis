import { Children, useLayoutEffect, useRef } from 'react';
import { TABS } from './state.js';

// Only the disclosed category exists in the scroll viewport. Hidden scroll-snap
// pages cannot emit a late selection after another menu has opened.
export function CategoryPager({active,scrollKey=active,scrollPositions,children}){
  const viewport=useRef(null),localScroll=useRef({}),scroll=scrollPositions||localScroll.current;
  useLayoutEffect(()=>{viewport.current.scrollTop=scroll[scrollKey]||0;},[scrollKey,scroll]);
  return <div ref={viewport} className="category-page dropdown-scroll" role="region" id={`controls-${active}`} aria-labelledby={`category-tab-${active}`} tabIndex={0}
    onScroll={event=>{scroll[scrollKey]=event.currentTarget.scrollTop;}}>
    {Children.toArray(children)[TABS.indexOf(active)]}
  </div>;
}
