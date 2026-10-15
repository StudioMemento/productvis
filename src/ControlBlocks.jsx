export function ControlDeck({children,className=''}) {
  return <div className={`control-deck ${className}`}>{children}</div>;
}
// Sections stay open; the complete toolset shares one vertical scroll.
export function ControlBlock({title,children,wide=false,action,className=''}) {
  return <section className={`control-block ${wide?'block-wide':''} ${className}`} aria-label={title}><header className="control-block-heading"><h3>{title}</h3>{action}</header><div className="control-block-body">{children}</div></section>;
}
