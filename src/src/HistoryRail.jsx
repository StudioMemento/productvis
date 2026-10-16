import { useRef, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from './icons.jsx';
import { Tool } from './Controls.jsx';
import { HISTORY_STEP, historySlots, historyDrag, historyKey } from './historyNavigation.js';
export function HistoryRail({cursor,labels,onUndo,onRedo,onSeek,disabled}){
  const total=labels.length,gesture=useRef(null),[offset,setOffset]=useState(0),[dragging,setDragging]=useState(false);
  const unavailable=disabled||!total;
  const finish=(event,cancel=false)=>{
    const g=gesture.current;if(!g||g.id!==event.pointerId)return;
    gesture.current=null;setOffset(0);setDragging(false);
    if(cancel){if(g.last!==g.start)onSeek(g.start);return;}
    if(!g.moved){
      const rect=event.currentTarget.getBoundingClientRect(),index=g.start+Math.round((event.clientX-rect.left-rect.width/2)/HISTORY_STEP);
      if(index>=0&&index<=total&&index!==g.start)onSeek(index);
    }
  };
  return <div className="history-rail" role="group" aria-label="Cronologia modifiche">
    <Tool label="Annulla · Ctrl Z" disabled={disabled||cursor===0} onClick={onUndo}><IconChevronLeft size={16}/></Tool>
    <div className={`history-track ${dragging?'is-dragging':''}`} role="slider" tabIndex={unavailable?-1:0} aria-label="Posizione cronologia" aria-valuemin={0} aria-valuemax={total} aria-valuenow={cursor} aria-valuetext={`${cursor} di ${total}${cursor?' · '+labels[cursor-1]:' · Inizio'}${cursor===total?' · Presente':''}`} aria-orientation="horizontal" aria-disabled={!!unavailable} data-at-present={cursor===total} style={{'--history-offset':`${offset}px`}} title={cursor===total?'Presente':labels[cursor-1]||'Inizio'}
      onPointerDown={event=>{
        if(unavailable||event.button!==0||gesture.current)return;event.preventDefault();event.currentTarget.focus({preventScroll:true});event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current={id:event.pointerId,x:event.clientX,start:cursor,last:cursor,moved:false};
      }}
      onPointerMove={event=>{
        const g=gesture.current;if(!g||g.id!==event.pointerId)return;
        const distance=event.clientX-g.x;if(Math.abs(distance)>4)g.moved=true;if(!g.moved)return;
        setDragging(true);const next=historyDrag(g.start,distance,total);setOffset(next.offset);
        if(next.cursor!==g.last){g.last=next.cursor;onSeek(next.cursor);}
      }}
      onPointerUp={event=>finish(event)} onPointerCancel={event=>finish(event,true)} onLostPointerCapture={event=>{if(gesture.current)finish(event,true);}}
      onKeyDown={event=>{
        if(unavailable)return;
        if(event.key==='Escape'&&gesture.current){event.preventDefault();event.stopPropagation();finish({pointerId:gesture.current.id},true);return;}
        const next=historyKey(event.key,cursor,total);if(next===null)return;event.preventDefault();if(next!==cursor)onSeek(next);
      }}>
      <div className="history-ticks" aria-hidden="true">{historySlots(cursor,total).map(slot=><span key={slot.offset} className={`history-slot ${slot.kind}`} data-index={slot.index}><i/></span>)}</div>
      <i className="history-pivot" aria-hidden="true"/>
    </div>
    <Tool label="Ripeti · Ctrl Shift Z / Ctrl Y" disabled={disabled||cursor===total} onClick={onRedo}><IconChevronRight size={16}/></Tool>
  </div>;
}
