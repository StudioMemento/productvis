import {useEffect,useRef} from 'react';

export function Modal({label,onClose,children}){
  const dialog=useRef(null),close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    const origin=document.activeElement;
    dialog.current.querySelector('[data-initial-focus],button,input,a[href]')?.focus({preventScroll:true});
    const onKey=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close.current();}
      if(event.key==='Tab'){
        const nodes=[...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]')];
        const first=nodes[0],last=nodes.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',onKey,true);
    return()=>{document.removeEventListener('keydown',onKey,true);if(origin?.isConnected)origin.focus({preventScroll:true});};
  },[]);
  return <div className="credits-backdrop" onClick={onClose}><section ref={dialog} className="credits project-dialog" role="dialog" aria-modal="true" aria-label={label} onClick={e=>e.stopPropagation()}>{children}</section></div>;
}
