import { IconPlayerPlay, IconPlayerPause, IconRefresh } from './icons.jsx';
import { Choices, KnobGrid, Tool, Toggle } from './Controls.jsx';
import { ControlBlock, ControlDeck, PropertyPair } from './ControlBlocks.jsx';
import { ColorControl } from './CreativeControls.jsx';
import { PostControls } from './LookControls.jsx';
import { VariantGrid } from './VariantGrid.jsx';
import { EffectSymbol } from './EffectSymbol.jsx';
import { DEFAULT_EFFECTS, EFFECT_GROUPS, chooseEffect } from './objectEffectsState.js';
const TYPES={surface:'Superficie',particles:'Particelle',trail:'Scie'};
export function ShaderControls({state,change,field,knob,disabled,cursor=0,onRestart,onStart}) {
  const fx=state.effects,active=Object.keys(EFFECT_GROUPS).some(group=>fx[group]!=='none');
  const reduced=()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const choose=(group,id)=>change(s=>({...s,effects:chooseEffect(s.effects,group,id,reduced())}));
  const reference=()=>change(s=>({...s,effects:{...s.effects,surface:'rim',particles:'points',trail:'none',color:'#e4eeff',solid:.04,intensity:.8,density:.7,size:.65,phase:0,playing:!reduced()}}));
  const blocked=disabled||!active,particle=fx.particles!=='none'||fx.trail!=='none';
  return <div className="shader-controls"><div className="shader-scope"><span>Intero prodotto</span><button className="text-action" disabled={disabled} onClick={reference}>Point sculpture ↗</button></div><PropertyPair><div className="property-bank visual-bank">
    {Object.entries(EFFECT_GROUPS).map(([group,items])=><ControlBlock key={group} title={TYPES[group]} wide><VariantGrid label={`Shader ${TYPES[group].toLowerCase()}`} items={[{id:'none',name:'Nessuno'},...items.map(([id,name])=>({id,name}))]} selected={fx[group]} onChoose={id=>choose(group,id)} disabled={disabled} renderSymbol={item=><EffectSymbol id={item.id}/>}/></ControlBlock>)}
    </div><div className="property-bank parameter-bank"><ControlBlock title="Mix" wide><KnobGrid>{knob('effects','intensity','Intensità',{disabled:blocked})}{knob('effects','speed','Velocità',{min:0,max:2,step:.05,unit:'×',format:v=>`${v.toFixed(2)}×`,disabled:blocked})}{knob('effects','solid','Solido',{disabled:blocked})}</KnobGrid>
      <div className="animation-transport"><Tool label={fx.playing?'Pausa shader':'Riproduci shader'} disabled={blocked} onClick={()=>field('effects','playing',!fx.playing)}>{fx.playing?<IconPlayerPause size={20}/>:<IconPlayerPlay size={20}/>}</Tool><Tool label="Riavvia shader e scie" disabled={blocked} onClick={onRestart}><IconRefresh size={18}/></Tool><ColorControl label="Colore FX" value={fx.color} disabled={blocked} onChange={v=>field('effects','color',v)}/></div>
    </ControlBlock>
    <ControlBlock title="Particelle · forma" wide><KnobGrid>
      {knob('effects','density','Densità',{min:.05,disabled:disabled||!particle})}
      {knob('effects','size','Dimensione',{min:.25,max:2,step:.05,unit:'×',format:v=>`${v.toFixed(2)}×`,disabled:disabled||!particle})}
      {knob('effects','spread','Dispersione',{disabled:disabled||!['scatter','flow','filaments'].includes(fx.particles)})}
      {knob('effects','length','Lunghezza',{disabled:disabled||(fx.trail==='none'&&fx.particles!=='streaks')})}
    </KnobGrid></ControlBlock>
    <ControlBlock title="Tempo · direzione" wide>
      <label className="clip-timeline"><span>Fase shader<output>{Math.round(cursor*100)}%</output></span><input aria-label="Fase shader" type="range" min="0" max="1" step=".001" value={cursor} disabled={blocked} onChange={e=>field('effects','phase',Number(e.target.value))}/></label>
      <Choices label="Direzione" value={fx.axis} options={['x','y','z'].map(value=>({value,label:value.toUpperCase(),disabled:disabled||!(['scan','hologram','contour','glitch'].includes(fx.surface)||fx.particles==='streaks')}))} onChange={v=>field('effects','axis',v)}/>
      <Toggle label="Inverti scie" checked={fx.reverse} disabled={disabled||fx.particles!=='streaks'} onChange={v=>field('effects','reverse',v)}/>
    </ControlBlock>
    <ControlBlock title="Post · colore · bloom" wide><PostControls state={state} change={change} disabled={disabled} onStart={onStart}/></ControlBlock>
    <div className="block-wide effect-reset"><button className="text-action" disabled={blocked} onClick={()=>change(s=>({...s,effects:{...DEFAULT_EFFECTS,randomize:s.effects.randomize}}))}>Disattiva VFX</button></div>
    {state.inspection.view!=='pbr'&&<p className="knowledge-note block-wide">FX sospesi in Ispeziona. <button className="text-action" onClick={()=>change(s=>({...s,inspection:{...s.inspection,view:'pbr'}}))}>Mostra PBR</button></p>}
  </div></PropertyPair></div>;
}
