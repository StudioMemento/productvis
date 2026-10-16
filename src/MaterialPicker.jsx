import { groupMaterials } from './navigation.js';
export function MaterialPicker({materials,selectedId,onSelect,disabled}) {
  const groups=groupMaterials(materials);
  return <div className="surface-catalog" aria-label="Superfici del modello">
    {!groups.length&&<p className="knowledge-note">Le superfici appariranno qui dopo il caricamento.</p>}
    {groups.map(group=><section key={group.id} className="surface-group" aria-label={group.label}><h4><span>{group.label}</span><small>{group.materials.length}</small></h4><div className="surface-options">
      {group.materials.map(material=><button key={material.id} type="button" aria-pressed={selectedId===material.id} className={selectedId===material.id?'active':''} title={material.rawName||material.label} disabled={disabled} onClick={()=>onSelect(material.id)}><i style={{'--swatch':material.original?.color||'#a2acb9'}}/><span>{material.label}</span></button>)}
    </div></section>)}
  </div>;
}
