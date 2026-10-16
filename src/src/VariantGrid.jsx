// No pagination, filter state or nested scrolling.
export function VariantGrid({items,selected,onChoose,disabled,label,renderSymbol,className=''}) {
  return <div className={`variant-grid ${className}`} data-count={items.length} role="group" aria-label={label}>
    {items.map(item=><button key={item.id} type="button" className={`variant ${selected===item.id?'active':''}`} aria-pressed={selected===item.id} aria-label={`${label}: ${item.name}`} title={item.description||item.name} disabled={disabled} onClick={()=>onChoose(item.id)} style={item.theme?{'--stage-color':item.theme.ringColor}:undefined}>
      <span className={`variant-symbol variant-${item.id}`} aria-hidden="true">{renderSymbol?.(item)}</span>
      <span className="variant-label">{item.name}</span>
    </button>)}
  </div>;
}
