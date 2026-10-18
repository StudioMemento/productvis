// Selection and runtime playback cursors are not edits to the saved look.
export function projectFingerprint(state) {
  const {selectedMaterial,...project}=state;
  return JSON.stringify({...project,
    animation:{...project.animation,playing:false},
    effects:{...project.effects,playing:false},
    motion:{...project.motion,playing:false},
    render:{...project.render,stats:false}});
}

const groups={material:'MAT',scene:'Scena',lighting:'Luce',camera:'Camera',motion:'Movimento',effects:'FX',post:'Post',render:'Rendering',transform:'Modello',animation:'Clip',name:'Progetto'};
const properties={overlay:'Mix colore',color:'Colore',roughness:'Rugosità',metalness:'Metallo',clearcoat:'Vernice',normalScale:'Rilievo',transmission:'Trasmissione',ior:'IOR',thickness:'Spessore',emissiveIntensity:'Emissione',opacity:'Opacità',fog:'Nebbia',reflection:'Riflesso',floorRoughness:'Superficie',key:'Key',fill:'Fill',rim:'Rim',focal:'Focale',duration:'Durata',strength:'Bloom',background:'Fondale',intensity:'Intensità',speed:'Velocità',phase:'Fase',name:'Nome',rotation:'Direzione',elevation:'Altezza',softness:'Morbidezza',temperature:'Temperatura',ambient:'Ambiente',environment:'Riflessi',azimuth:'Angolo',distance:'Distanza',aperture:'Apertura',exposure:'Esposizione',bokeh:'Bokeh',focus:'Fuoco',resolution:'Risoluzione',alpha:'Sfondo alpha'};
export function editLabel(group){
  const parts=(group||'').split('.'),category=groups[parts[0]]||'Modifica',key=parts.at(-1);
  return properties[key]?`${category} · ${properties[key]}`:category;
}
