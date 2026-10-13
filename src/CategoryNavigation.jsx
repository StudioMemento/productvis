import { useEffect, useRef, useState } from 'react';
import { IconCube, IconDiamond, IconSun, IconCamera, IconRotate360, IconChevronLeft, IconChevronRight, IconChevronDown } from '@tabler/icons-react';
import { Tool } from './Controls.jsx';
import { TABS, TAB_LABELS } from './state.js';
import { boundedIndex, scrubIndex } from './navigation.js';
const ICONS={product:IconDiamond,scene:IconCube,lighting:IconSun,camera:IconCamera,motion:IconRotate360};

export function CategoryNavigation({ active, opened, onChange, onToggle }) {
  const rail=useRef(null), gesture=useRef(null), suppress=useRef(false), current=useRef({});
  const [dragging,setDragging]=useState(false);
  const index=Math.max(0,TABS.indexOf(active));
  const choose=next=>onChange(TABS[boundedIndex(next,TABS.length)]);
  current.current={index,choose};
  useEffect(()=>{
    const element=rail.current;
    const reveal=()=>{
      const button=element.querySelector('[aria-expanded="true"]');
      if (!button) return;
      const left=Math.max(0,Math.min(element.scrollWidth-element.clientWidth,button.offsetLeft+button.offsetWidth/2-element.clientWidth/2));
      element.scrollTo({left,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    };
    reveal();const observer=new ResizeObserver(reveal);observer.observe(element);
    return ()=>observer.disconnect();
  },[active,opened]);
  useEffect(()=>{
    const element=rail.current; let sum=0,last=0,lock=0;
    const wheel=e=>{
      if(e.ctrlKey)return;e.preventDefault();
      const now=performance.now();if(now<lock)return;
      const amount=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*(e.deltaMode===1?16:e.deltaMode===2?300:1);
      if(now-last>160||Math.sign(amount)!==Math.sign(sum))sum=0;
      last=now;sum+=amount;if(Math.abs(sum)<35)return;
      current.current.choose(current.current.index+Math.sign(sum));sum=0;lock=now+240;
    };
    element.addEventListener('wheel',wheel,{passive:false});
    return ()=>element.removeEventListener('wheel',wheel);
  },[]);
  const end=e=>{if(gesture.current?.id!==e.pointerId)return;gesture.current=null;setDragging(false);};
  return <div id="productvis-navigation" className={`navigation-dock ${dragging?'is-dragging':''}`}>
    <div className="navigation-reel">
      <Tool label="Categoria precedente" disabled={index===0} onClick={()=>choose(index-1)}><IconChevronLeft size={16}/></Tool>
      <nav ref={rail} className="category-slider" role="group" aria-label="Categorie ProductVis" title="Trascina o scorri per cambiare categoria"
        onPointerDown={e=>{if(e.button!==0)return;gesture.current={id:e.pointerId,x:e.clientX,index};suppress.current=false;}}
        onPointerMove={e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;const dx=e.clientX-g.x;if(Math.abs(dx)<8&&!dragging)return;e.currentTarget.setPointerCapture(e.pointerId);suppress.current=true;setDragging(true);choose(scrubIndex(g.index,dx*1.25,TABS.length));}}
        onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
        onClickCapture={e=>{if(suppress.current){e.preventDefault();e.stopPropagation();suppress.current=false;}}}
        onKeyDown={e=>{const i=Number(e.target.dataset.index);if(!Number.isFinite(i))return;let next;if(e.key==='ArrowRight')next=boundedIndex(i+1,TABS.length);else if(e.key==='ArrowLeft')next=boundedIndex(i-1,TABS.length);else if(e.key==='Home')next=0;else if(e.key==='End')next=TABS.length-1;else return;e.preventDefault();choose(next);e.currentTarget.querySelectorAll('[data-category]')[next].focus({preventScroll:true});}}>
        {TABS.map((id,i)=>{const Icon=ICONS[id],distance=i-index;return <button key={id} type="button" id={`category-tab-${id}`} data-index={i} data-category={id} tabIndex={0} aria-label={TAB_LABELS[id]} title={TAB_LABELS[id]} aria-expanded={opened&&i===index} aria-controls={`controls-${id}`} className={opened&&i===index?'active':''} style={{'--depth':Math.min(Math.abs(distance),3),'--tilt':`${Math.max(-3,Math.min(3,distance))*-8}deg`}} onClick={()=>onToggle(id)}><Icon size={32} stroke={1.2}/><span>{TAB_LABELS[id]}</span><IconChevronDown className="category-chevron" size={11} aria-hidden="true"/></button>;})}
      </nav>
      <Tool label="Categoria successiva" disabled={index===TABS.length-1} onClick={()=>choose(index+1)}><IconChevronRight size={16}/></Tool>
    </div>
    <span className="sr-only" role="status">{opened?`${TAB_LABELS[active]} aperto`:'Categorie chiuse'}</span>
  </div>;
}
