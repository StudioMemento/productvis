import { STAGES } from './stageCatalog.js';
import { StageIllustration } from './StageIllustration.jsx';
import { VariantGrid } from './VariantGrid.jsx';
export function StageLibrary({selected,onChoose,disabled}){
  return <div className="stage-library"><VariantGrid items={STAGES} selected={selected} onChoose={onChoose} disabled={disabled} label="Stage" className="stage-variants" renderSymbol={stage=><StageIllustration id={stage.id}/>}/></div>;
}
