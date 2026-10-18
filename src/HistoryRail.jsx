import { useEffect, useRef, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from './icons.jsx';
import { Tool } from './Controls.jsx';
import { HISTORY_STEP, historyPosition, historyWheelDistance, historyKey } from './historyNavigation.js';

export function HistoryRail({cursor,labels,onUndo,onRedo,onSeek,disabled}){
  const total=labels.length,gesture=useRef(null),track=useRef(null),wheel=useRef(null),timer=useRef(null);
  const [position,setPosition]=useState(cursor),[dragging,setDragging]=useState(false),live=useRef(null);
  const unavailable=disabled||!total,selected=Math.round(position);
  live.current={cursor,total,onSeek,unavailable};
  useEffect(()=>{gesture.current=null;wheel.current=null;clearTimeout(timer.current);setDragging(false);setPosition(cursor);},[cursor,total]);
  useEffect(()=>{
    if(unavailable){gesture.current=null;wheel.current=null;clearTimeout(timer.current);setDragging(false);setPosition(cursor);}
  },[unavailable]);
  useEffect(()=>{
    const element=track.current;if(!element)return;
    // The ruler moves locally. Restore the selected scene once scrolling settles.
    const scroll=event=>{
      if(live.current.unavailable||gesture.current||event.ctrlKey)return;
      event.preventDefault();
      if(!wheel.current)wheel.current={position:live.current.cursor};
      wheel.current.position=historyPosition(wheel.current.position,historyWheelDistance(event),live.current.total);
      setPosition(wheel.current.position);setDragging(true);clearTimeout(timer.current);
      timer.current=setTimeout(()=>{
        const index=Math.round(wheel.current.position);wheel.current=null;setPosition(index);setDragging(false);
        if(index!==live.current.cursor)live.current.onSeek(index);
      },140);
    };
    element.addEventListener('wheel',scroll,{passive:false});
    return()=>{element.removeEventListener('wheel',scroll);clearTimeout(timer.current);};
  },[]);
  const finish=(event,cancel=false)=>{
    const g=gesture.current;if(!g||g.id!==event.pointerId)return;
    gesture.current=null;setDragging(false);
    let index=g.start;
    if(!cancel){
      if(g.moved)index=Math.round(g.position);
      else {const rect=event.currentTarget.getBoundingClientRect();const hit=g.start+Math.round((event.clientX-rect.left-rect.width/2)/HISTORY_STEP);if(hit>=0&&hit<=total)index=hit;}
    }
    setPosition(index);
    if(index!==cursor)onSeek(index);
  };
  return <div className="history-rail" role="group" aria-label="Cronologia modifiche">
    <Tool label="Annulla · Ctrl Z" disabled={disabled||cursor===0} onClick={onUndo}><IconChevronLeft size={16}/></Tool>
    <div ref={track} className={`history-track ${dragging?'is-dragging':''}`} role="slider" tabIndex={unavailable?-1:0} aria-label="Posizione cronologia" aria-description="Trascina a destra per tornare indietro, a sinistra per avanzare. Rilascia per applicare. Frecce sinistra/destra: precedente/successivo." aria-valuemin={0} aria-valuemax={total} aria-valuenow={selected} aria-valuetext={`${selected} di ${total} · ${selected?labels[selected-1]:'Inizio'}${selected===total?' · Presente':''}`} aria-orientation="horizontal" aria-disabled={!!unavailable} data-at-present={selected===total} style={{'--history-offset':`${-position*HISTORY_STEP}px`,'--history-step':`${HISTORY_STEP}px`}}
      onPointerDown={event=>{
        if(unavailable||event.button!==0||gesture.current)return;
        clearTimeout(timer.current);wheel.current=null;event.preventDefault();event.currentTarget.focus({preventScroll:true});event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current={id:event.pointerId,x:event.clientX,start:cursor,position:cursor,moved:false};setPosition(cursor);
      }}
      onPointerMove={event=>{
        const g=gesture.current;if(!g||g.id!==event.pointerId)return;
        const distance=event.clientX-g.x;if(Math.abs(distance)>4)g.moved=true;if(!g.moved)return;
        g.position=historyPosition(g.start,distance,total);setPosition(g.position);setDragging(true);
      }}
      onPointerUp={event=>finish(event)} onPointerCancel={event=>finish(event,true)} onLostPointerCapture={event=>{if(gesture.current)finish(event,true);}}
      onKeyDown={event=>{
        if(unavailable)return;
        if(event.key==='Escape'&&(gesture.current||wheel.current)){
          event.preventDefault();event.stopPropagation();clearTimeout(timer.current);wheel.current=null;
          if(gesture.current)finish({pointerId:gesture.current.id},true);else {setPosition(cursor);setDragging(false);}return;
        }
        if(gesture.current)return;
        const next=historyKey(event.key,cursor,total);if(next===null)return;event.preventDefault();clearTimeout(timer.current);wheel.current=null;setDragging(false);setPosition(next);if(next!==cursor)onSeek(next);
      }}>
      <div className="history-ticks" aria-hidden="true">{Array.from({length:total+17},(_,i)=>i-8).map(index=><span key={index} className={`history-slot ${index<0||index>total?'empty':index===selected?'current':index<selected?'past':'future'}`} data-index={index} style={{left:`${index*HISTORY_STEP}px`}}><i/></span>)}</div>
      <i className="history-pivot" aria-hidden="true"/>
    </div>
    <Tool label="Ripeti · Ctrl Shift Z / Ctrl Y" disabled={disabled||cursor===total} onClick={onRedo}><IconChevronRight size={16}/></Tool>
  </div>;
}
