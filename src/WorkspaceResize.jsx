import { useEffect, useRef, useState } from 'react';
import { DEFAULT_WORKSPACE, usesBottomDock, workspaceBounds, workspaceInsets, resizedWorkspace, resizeFromKey, restoreWorkspaceSize, persistWorkspaceSize } from './workspaceLayout.js';

export function useWorkspaceResize(root) {
  const [viewport,setViewport]=useState(()=>({width:globalThis.innerWidth||1280,height:globalThis.innerHeight||800}));
  const [preferences,setPreferences]=useState(restoreWorkspaceSize),[resizing,setResizing]=useState(false);
  const {width,height}=viewport,bottom=usesBottomDock(width,height),insets=workspaceInsets(width,height,preferences),bounds=workspaceBounds(width,height);
  useEffect(()=>{
    const element=root.current;if(!element)return;
    const update=()=>{const r=element.getBoundingClientRect();if(r.width&&r.height)setViewport(prev=>prev.width===r.width&&prev.height===r.height?prev:{width:r.width,height:r.height});};
    const observer=new ResizeObserver(update);observer.observe(element);update();
    return()=>observer.disconnect();
  },[root]);
  useEffect(()=>{const timer=setTimeout(()=>persistWorkspaceSize(preferences),180);return()=>clearTimeout(timer);},[preferences]);
  const reset=()=>setPreferences(p=>({...p,[bottom?'bottomRatio':'sideRatio']:DEFAULT_WORKSPACE[bottom?'bottomRatio':'sideRatio']}));
  return {width,height,bottom,insets,bounds,resizing,setResizing,preferences,setPreferences,reset,
    size:bottom?insets.bottom:insets.right,
    setSize:pixels=>setPreferences(p=>resizedWorkspace(p,width,height,pixels))};
}

export function WorkspaceResizeHandle({layout,disabled}) {
  const gesture=useRef(null),frame=useRef(null),latest=useRef(layout);
  latest.current=layout;
  useEffect(()=>()=>{if(frame.current)cancelAnimationFrame(frame.current);},[]);
  // A changed orientation or suspended UI invalidates the active gesture.
  useEffect(()=>{gesture.current=null;if(frame.current)cancelAnimationFrame(frame.current);frame.current=null;layout.setResizing(false);},[layout.bottom,disabled]);
  const finish=(event,cancel=false)=>{
    const g=gesture.current;if(!g||g.id!==event.pointerId)return;
    if(frame.current)cancelAnimationFrame(frame.current);frame.current=null;
    if(cancel)layout.setPreferences(g.preferences);else if(Number.isFinite(g.pending))layout.setSize(g.pending);
    gesture.current=null;layout.setResizing(false);
  };
  return <div className={`workspace-resize ${layout.bottom?'resize-height':'resize-width'}`} role="separator" tabIndex={disabled?-1:0}
    aria-label={layout.bottom?'Altezza pannello':'Larghezza pannello'} aria-orientation={layout.bottom?'horizontal':'vertical'}
    aria-controls="productvis-controls" aria-valuemin={Math.round(layout.bounds.min)} aria-valuemax={Math.round(layout.bounds.max)} aria-valuenow={Math.round(layout.size)} aria-valuetext={`${Math.round(layout.size)} pixel`} aria-disabled={disabled}
    title="Trascina per ridimensionare · Frecce per regolare · Doppio click per ripristinare"
    onPointerDown={event=>{
      if(disabled||event.button!==0||gesture.current)return;event.preventDefault();event.currentTarget.focus({preventScroll:true});
      gesture.current={id:event.pointerId,start:layout.bottom?event.clientY:event.clientX,size:layout.size,preferences:layout.preferences};
      event.currentTarget.setPointerCapture(event.pointerId);layout.setResizing(true);
    }}
    onPointerMove={event=>{
      const g=gesture.current;if(!g||g.id!==event.pointerId)return;
      g.pending=g.size+g.start-(layout.bottom?event.clientY:event.clientX);
      if(!frame.current)frame.current=requestAnimationFrame(()=>{frame.current=null;if(gesture.current===g)latest.current.setSize(g.pending);});
    }}
    onPointerUp={event=>finish(event)} onPointerCancel={event=>finish(event,true)} onLostPointerCapture={event=>finish(event)}
    onDoubleClick={()=>{if(!disabled)layout.reset();}}
    onKeyDown={event=>{
      if(disabled)return;
      if(event.key==='Escape'&&gesture.current){event.stopPropagation();finish({pointerId:gesture.current.id},true);return;}
      if(event.key==='Enter'){event.preventDefault();layout.reset();return;}
      const size=resizeFromKey(event.key,layout.size,layout.bounds,layout.bottom,event.shiftKey);
      if(size!==null){event.preventDefault();layout.setSize(size);}
    }}><span className="resize-grip" aria-hidden="true"><i/><i/></span></div>;
}
