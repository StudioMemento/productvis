import { CONCEPT_STAGES } from './stageCatalog.js';
import { PRESETS } from './state.js';
import { StageIllustration } from './StageIllustration.jsx';
import { VariantGrid } from './VariantGrid.jsx';
const collections=[['clean','Clean',CONCEPT_STAGES.filter(s=>s.family==='clean')],['elaborate','Elaborate',CONCEPT_STAGES.filter(s=>s.family==='elaborate')],['classic','Classici',PRESETS.scene.filter(s=>!s.family)]];
export function StageLibrary({selected,onChoose,disabled}) {
  return <div className="stage-library">{collections.map(([id,label,items])=><section key={id} className="variant-collection" aria-label={`Collezione ${label}`}>
    <h4><span>{label}</span><small>{String(items.length).padStart(2,'0')}</small></h4>
    <VariantGrid items={items} selected={selected} onChoose={onChoose} disabled={disabled} label={`Stage ${label}`} className="stage-variants" renderSymbol={stage=><StageIllustration id={stage.id}/>}/>
  </section>)}</div>;
}
