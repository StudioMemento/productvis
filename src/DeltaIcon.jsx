import { useRef, useState, useEffect } from 'react';
import { IconSparkles,IconSphere,IconMountain,IconSun,IconCamera,IconMagicWand } from './icons.jsx';
const icons={mat:IconSphere,env:IconMountain,light:IconSun,cam:IconCamera,fx:IconMagicWand,global:IconSparkles};
// A continuous squircle perimeter is the delta meter; the icon stays legible.
const perimeter='M28 3C48 3 53 8 53 28C53 48 48 53 28 53C8 53 3 48 3 28C3 8 8 3 28 3Z';
export const deltaFromDrag=(start,distance,fine=false)=>Math.round(Math.max(0,Math.min(100,start+distance*(fine ? .15 : .75))));
export function DeltaIcon({kind,label,value,onChange,onGenerate,onContext,disabled=false,blocked=false,locked=false,blockedReason}){
  const Icon=icons[kind]||icons.global,gesture=useRef(null),suppressClick=useRef(false);
  const [dragging,setDragging]=useState(false),[flashing,setFlashing]=useState(false),[feedback,setFeedback]=useState(''),flashTimer=useRef(null);
  useEffect(()=>()=>clearTimeout(flashTimer.current),[]);
  const generate=()=>{clearTimeout(flashTimer.current);if(blocked){setFeedback(blockedReason||'Nessun asse attivo · aumenta il delta o sblocca un asse');flashTimer.current=setTimeout(()=>setFeedback(''),2800);return;}setFeedback('');setFlashing(true);flashTimer.current=setTimeout(()=>setFlashing(false),320);onGenerate();};
  const stop=(event,cancelled=false)=>{
    const g=gesture.current;if(!g||g.id!==event.pointerId)return;
    gesture.current=null;setDragging(false);suppressClick.current=true;
    if(cancelled){if(g.moved)onChange(g.start);return;}
    if(!g.moved)generate();
  };
  return <button type="button" className={`delta-icon ${dragging?'is-dragging':''} ${flashing?'is-flashing':''} ${locked?'is-locked':''} ${blocked?'generation-blocked':''}`} role="slider" aria-label={`Genera ${label} · Delta`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={value} aria-valuetext={`${value} · ${locked?'bloccato':'Invio genera · frecce regolano il delta'}`} aria-orientation="vertical" disabled={disabled} title={`${label} · Tocca per variare · Trascina per il delta (${value})${locked?' · bloccato':''}`} data-axis={kind}
    onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);gesture.current={id:e.pointerId,start:value,y:e.clientY,moved:false};suppressClick.current=false;onContext?.();}}
    onPointerMove={e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;const dy=g.y-e.clientY;if(Math.abs(dy)>5)g.moved=true;if(g.moved){setDragging(true);onChange(deltaFromDrag(g.start,dy,e.shiftKey));}}}
    onPointerUp={e=>stop(e)} onPointerCancel={e=>stop(e,true)} onLostPointerCapture={e=>{if(gesture.current)stop(e,true);}}
    onClick={e=>{if(suppressClick.current&&e.detail!==0){suppressClick.current=false;return;}suppressClick.current=false;onContext?.();generate();}}
    onKeyDown={e=>{if(e.key==='Escape'&&gesture.current){e.preventDefault();e.stopPropagation();stop({pointerId:gesture.current.id},true);return;}const shifts={ArrowUp:1,ArrowDown:-1,ArrowRight:1,ArrowLeft:-1,PageUp:10,PageDown:-10};if(e.key in shifts||e.key==='Home'||e.key==='End'){e.preventDefault();onContext?.();onChange(e.key==='Home'?0:e.key==='End'?100:Math.max(0,Math.min(100,value+shifts[e.key]*(e.shiftKey?10:1))));}}}>
    <svg className="delta-squircle" viewBox="0 0 56 56" aria-hidden="true"><path className="delta-track" d={perimeter}/><path className="delta-progress" d={perimeter} pathLength="100" strokeDasharray={`${value} 100`} opacity={value===0?0:1}/></svg>
    <Icon className="delta-glyph" size={25}/>
    <IconSparkles className="delta-sparkle" size={25}/>
    <span className="delta-feedback" aria-hidden="true">{value}</span>
    <span className={`delta-help ${feedback?'has-feedback':''}`} role={feedback?'status':undefined}>{feedback||'Tocca per variare · trascina per il delta'}</span>
  </button>;
}
