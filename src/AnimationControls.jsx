import { IconPlayerPlay, IconPlayerPause, IconPlayerStop, IconInfinity } from '@tabler/icons-react';
import { Tool, Toggle, KnobGrid } from './Controls.jsx';

export function AnimationControls({clips,animation,cursor,disabled,onChange,onSeek,knob}){
  const clip=clips[animation.clip]||clips[0];
  return <section className="animation-controls" aria-label="Animazioni del modello">
    <span className="control-group-title">Animazioni GLB <small>{clips.length}</small></span>
    {!clip?<p className="interaction-hint">Questo modello non contiene clip. Puoi animare il prodotto e la camera con Movimento in CAM.</p>:<>
      <div className="clip-options" role="group" aria-label="Animazioni GLB disponibili">{clips.map(item=><button type="button" key={item.index} disabled={disabled} aria-pressed={clip.index===item.index} className={clip.index===item.index?'active':''} onClick={()=>onChange({clip:item.index,cursor:0,playing:false})}><IconPlayerPlay size={14}/><span>{item.name}</span><small>{item.duration.toFixed(1)} s</small></button>)}</div>
      <div className="animation-transport"><Tool label={animation.playing?'Pausa animazione GLB':'Riproduci animazione GLB'} disabled={disabled} onClick={()=>onChange({playing:!animation.playing})}>{animation.playing?<IconPlayerPause size={20}/>:<IconPlayerPlay size={20}/>}</Tool><Tool label="Ferma animazione GLB" disabled={disabled} onClick={()=>onSeek(0)}><IconPlayerStop size={18}/></Tool><Toggle label="Loop" icon={IconInfinity} checked={animation.loop} disabled={disabled} onChange={loop=>onChange({loop})}/></div>
      <label className="clip-timeline"><span>Tempo <output>{(cursor*clip.duration).toFixed(2)} / {clip.duration.toFixed(2)} s</output></span><input type="range" aria-label="Posizione animazione GLB" min="0" max="1" step="0.001" value={cursor} disabled={disabled} onChange={event=>onSeek(Number(event.target.value))}/></label>
      <KnobGrid>{knob('animation','speed','Velocità clip',{min:.1,max:3,step:.1,format:value=>`${value.toFixed(1)}×`})}</KnobGrid>
    </>}
  </section>;
}
