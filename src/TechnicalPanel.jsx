import { useLayoutEffect, useRef } from 'react';

export function TechnicalPanel({id,title,action,scrollPositions,children}) {
  const viewport=useRef(null);
  useLayoutEffect(()=>{viewport.current.scrollTop=scrollPositions?.[id]||0;},[id,scrollPositions]);
  return <section className="technical-panel category" id={`controls-${id}`} role="region" aria-label={title}>
    <div ref={viewport} className="technical-content dropdown-scroll" tabIndex={0} onScroll={event=>{if(scrollPositions)scrollPositions[id]=event.currentTarget.scrollTop;}}>
      <header className="technical-heading"><h2>{title}</h2>{action}</header>
      {children}
    </div>
  </section>;
}
