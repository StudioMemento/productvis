import { useEffect, useState } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { CONCEPT_STAGES, STAGE_BY_ID } from './stageCatalog.js';
import { PRESETS } from './state.js';

export function StageLibrary({selected,onChoose,disabled}){
  const current=STAGE_BY_ID[selected],selectedFamily=current?.family||'classic';
  const [family,setFamily]=useState(selectedFamily);
  useEffect(()=>setFamily(selectedFamily),[selected,selectedFamily]);
  const items=family==='classic'?PRESETS.scene.filter(s=>!s.family):CONCEPT_STAGES.filter(s=>s.family===family);
  return <div className="stage-library">
    <div className="stage-families" role="group" aria-label="Collezioni di ambienti">{[['clean','Clean','10'],['elaborate','Elaborate','10'],['classic','Classici','14']].map(([id,label,count])=><button type="button" key={id} aria-pressed={family===id} className={family===id?'active':''} onClick={()=>setFamily(id)}>{label}<small>{count}</small></button>)}</div>
    <div className="stage-list" role="group" aria-label={`Scene ${family}`}>{items.map((stage,index)=><button type="button" key={stage.id} disabled={disabled} aria-pressed={selected===stage.id} title={stage.description||stage.name} className={selected===stage.id?'active':''} onClick={()=>onChoose(stage.id)}>
      <span className="stage-number" style={{'--stage-color':stage.theme?.ringColor||'#899aac'}}>{stage.number||String(index+1).padStart(2,'0')}</span><span>{stage.name}</span>{selected===stage.id&&<IconCheck size={13} aria-hidden="true"/>}
    </button>)}</div>
    <p className="stage-description"><b>{current?.name||PRESETS.scene.find(s=>s.id===selected)?.name}</b>{current?.description||'Ambiente della collezione originale.'}</p>
  </div>;
}
