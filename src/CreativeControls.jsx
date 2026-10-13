import { IconAdjustmentsHorizontal, IconDice5, IconFocus2, IconPlayerPlay, IconPlayerPause, IconRotateClockwise, IconRotate, IconInfinity, IconRefresh } from '@tabler/icons-react';
import { Choices, KnobGrid, Toggle, Tool } from './Controls.jsx';
import { CompositionSymbol } from './PresetSymbol.jsx';
import { CUSTOM_SCENES } from './state.js';
import { STAGE_BY_ID } from './stageCatalog.js';
import { StageLibrary } from './StageLibrary.jsx';

export function ColorControl({label,value,onChange,disabled}) {
  return <label className="color-control"><span className="color-diamond custom-color"><i style={{'--swatch':value}}/><input type="color" value={value} aria-label={label} disabled={disabled} onChange={e=>onChange(e.target.value)}/></span><span className="control-label">{label}</span></label>;
}
export function SceneControls({state,field,knob,presets,disabled,onPost,onChooseStage}) {
  const s=state.scene,custom=CUSTOM_SCENES.includes(s.preset),concept=STAGE_BY_ID[s.preset];
  return <>
    <StageLibrary selected={s.preset} onChoose={onChooseStage} disabled={disabled}/>
    <div className="context-actions"><Tool label="Nuovo seed scena" disabled={disabled} onClick={()=>field('scene','seed',Math.floor(Math.random()*100000))}><IconDice5 size={19}/></Tool><button className="text-action" onClick={onPost}><IconAdjustmentsHorizontal size={16}/>Post</button></div>
    {s.preset==='cubes'&&<Choices label="Layout" value={s.composition} options={[0,1,2].map(n=>({value:n,ariaLabel:`Composizione ${n+1}`,label:<CompositionSymbol index={n}/>}))} onChange={v=>field('scene','composition',v)}/>}
    {((custom&&!concept)||s.preset==='cubes'||concept?.family==='elaborate')&&<KnobGrid>{knob('scene','scale','Volumi',{min:.55,max:1.5,step:.05,format:v=>`${v.toFixed(2)}×`})}{custom&&<>{knob('scene','density','Densità')}{knob('scene','height','Altezza',{min:.3,max:2,step:.05,format:v=>`${v.toFixed(2)}×`})}{knob('scene','spread','Spazio',{min:.6,max:1.8,step:.05,format:v=>`${v.toFixed(2)}×`})}</>}</KnobGrid>}
    <span className="control-group-title">Atmosfera</span><KnobGrid>{knob('scene','fog','Nebbia')}{knob('scene','reflection','Riflesso',{max:.8})}{knob('scene','floorRoughness','Superficie')}</KnobGrid>
    {(['rain','road'].includes(s.preset)||concept?.effect)?<KnobGrid>{(s.preset==='rain'||concept?.effect==='rain')?knob('scene','weather','Pioggia'):s.preset==='road'?knob('scene','glitch','Glitch'):null}{knob('scene','speed','Flusso',{max:2,step:.05,format:v=>`${v.toFixed(2)}×`})}</KnobGrid>:['cubes','cinema','particles'].includes(s.preset)&&<KnobGrid>{knob('scene','particles','Particelle')}</KnobGrid>}
    <div className="color-trio">{[['background','Fondale'],['groundColor','Piano'],['ringColor','Accento']].map(([key,label])=><ColorControl key={key} label={label} value={s[key]} disabled={disabled} onChange={v=>field('scene',key,v)}/>)}</div>
  </>;
}
export function LightingControls({state,field,knob,presets,disabled,onPost}) {
  const s=state.lighting;
  return <>{presets('lighting')}<div className="context-actions"><span/><button className="text-action" onClick={onPost}><IconAdjustmentsHorizontal size={16}/>Post</button></div>
    <KnobGrid>{knob('lighting','intensity','Intensità',{max:2})}{knob('lighting','rotation','Direzione',{min:-180,max:180,step:1,format:v=>`${Math.round(v)}°`})}{knob('lighting','elevation','Altezza',{min:5,max:85,step:1,format:v=>`${Math.round(v)}°`})}{knob('lighting','softness','Morbidezza',{max:100,step:1,format:v=>`${Math.round(v)}%`})}</KnobGrid>
    <span className="control-group-title">Sorgenti</span><KnobGrid>{knob('lighting','key','Key',{max:10,step:.1,format:v=>v.toFixed(1)})}{knob('lighting','fill','Fill',{max:10,step:.1,format:v=>v.toFixed(1)})}{knob('lighting','rim','Rim',{max:10,step:.1,format:v=>v.toFixed(1)})}</KnobGrid>
    <div className="color-trio">{[['keyColor','Key', '#e9e1d5'],['fillColor','Fill','#c9d7ef'],['rimColor','Rim','#ffb84f']].map(([key,label,fallback])=><ColorControl key={key} label={label} value={s[key]||fallback} disabled={disabled} onChange={v=>field('lighting',key,v)}/>)}</div>
    <KnobGrid>{knob('lighting','temperature','Kelvin',{min:2000,max:9000,step:100,format:v=>`${Math.round(v)}K`,disabled:disabled||!!s.keyColor})}{knob('lighting','ambient','Ambiente',{max:1.5})}{knob('lighting','environment','Riflessi',{max:2})}</KnobGrid>
    {!!s.keyColor&&<button className="text-action" onClick={()=>field('lighting','keyColor','')}>Usa temperatura</button>}
  </>;
}
export function CameraControls({state,field,knob,presets,disabled,onVariation,onFocus,focusPick}) {
  return <>{presets('camera')}
    <div className="shot-variation"><Tool label="Varia questo shot" disabled={disabled||state.camera.shotDelta===0} onClick={onVariation}><IconDice5 size={22}/></Tool>{knob('camera','shotDelta','Δ shot',{max:100,step:1,format:v=>`${Math.round(v)}`})}<Tool label="Seleziona il punto di fuoco" aria-pressed={focusPick} className={focusPick?'selected':''} disabled={disabled} onClick={onFocus}><IconFocus2 size={22}/></Tool></div>
    <Choices label="Lente" value={state.camera.focal} options={[24,35,50,85,120].map(value=>({value,label:`${value}`,ariaLabel:`Focale ${value} mm`}))} onChange={v=>field('camera','focal',v)}/>
    <KnobGrid>{knob('camera','focal','Focale',{min:18,max:150,step:1,format:v=>`${Math.round(v)}mm`})}{knob('camera','aperture','Apertura',{min:1.4,max:16,step:.2,format:v=>`ƒ/${v.toFixed(1)}`})}{knob('camera','exposure','Esposizione',{min:-2,max:2,step:.1,format:v=>v.toFixed(1)})}</KnobGrid>
    <span className="control-group-title">Inquadratura</span><KnobGrid>{knob('camera','azimuth','Angolo',{min:-180,max:180,step:1,format:v=>`${Math.round(v)}°`})}{knob('camera','elevation','Altezza',{min:1,max:85,step:1,format:v=>`${Math.round(v)}°`})}{knob('camera','distance','Distanza',{min:.25,max:2.5,step:.01,format:v=>`${v.toFixed(2)}×`})}</KnobGrid>
    <span className="control-group-title">Fuoco</span><Toggle label="Auto" icon={IconFocus2} checked={state.camera.autoFocus} disabled={disabled} onChange={v=>field('camera','autoFocus',v)}/>
    <KnobGrid>{knob('camera','bokeh','Bokeh')}{!state.camera.autoFocus&&knob('camera','focus','Distanza fuoco',{min:.2,max:30,step:.1,format:v=>v.toFixed(1)})}</KnobGrid>
    <span className="interaction-hint">Doppio click · centra e metti a fuoco</span>
  </>;
}
export function MotionControls({state,field,knob,presets,disabled,onRewind,onRender}) {
  const m=state.motion,still=m.preset==='still';
  return <>{presets('motion')}
    <div className="motion-actions"><Tool label={m.playing?'Pausa':'Riproduci'} className="play-control" disabled={disabled||still} onClick={()=>field('motion','playing',!m.playing)}>{m.playing?<IconPlayerPause size={22}/>:<IconPlayerPlay size={22}/>}</Tool><Tool label="Torna all’inizio" disabled={disabled||still} onClick={onRewind}><IconRefresh size={19}/></Tool><Choices label="Verso" value={m.direction} options={[{value:1,label:<IconRotateClockwise size={20}/>,ariaLabel:'Avanti'},{value:-1,label:<IconRotate size={20}/>,ariaLabel:'Indietro'}]} onChange={v=>field('motion','direction',v)}/><Toggle label="Loop" icon={IconInfinity} checked={m.loop} disabled={disabled||still} onChange={v=>field('motion','loop',v)}/></div>
    <KnobGrid>{knob('motion','duration','Ciclo',{min:3,max:30,step:1,format:v=>`${v}s`,disabled:disabled||still})}{knob('motion','speed','Velocità',{min:.25,max:3,step:.05,format:v=>`${v.toFixed(2)}×`,disabled:disabled||still})}{knob('motion','cursor','Fase',{disabled:disabled||still})}{knob('motion','amplitude','Ampiezza',{min:m.preset==='idle'?1:15,max:m.preset==='idle'?15:360,step:1,format:v=>`${Math.round(v)}°`,disabled:disabled||still||m.preset==='dolly'})}{knob('motion','travel','Corsa',{min:.05,max:.6,step:.01,disabled:disabled||!['dolly','idle'].includes(m.preset)})}</KnobGrid>
    {m.preset==='turntable'&&<Choices label="Asse" value={m.axis} options={['x','y','z'].map(value=>({value,label:value.toUpperCase()}))} onChange={v=>field('motion','axis',v)}/>}
    <Choices label="Curva" value={m.easing} options={[{value:'smooth',label:'Smooth'},{value:'linear',label:'Linear'}]} onChange={v=>field('motion','easing',v)}/>
    <button className="playblast-link" disabled={disabled} onClick={onRender}>Playblast <span>↗</span></button>
  </>;
}
