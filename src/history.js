// Generator locks and deltas remain live UI metadata across undo/redo.
export class EditHistory {
  constructor(limit=80){this.limit=limit;this.clear();}
  clear(){this.past=[];this.future=[];this.group=null;this.gesture=null;}
  beginGesture(){this.gesture={past:[...this.past],future:[...this.future]};this.group=null;}
  cancelGesture(){if(this.gesture){this.past=this.gesture.past;this.future=this.gesture.future;}this.endGesture();}
  endGesture(current){
    if(this.gesture?.before&&current&&JSON.stringify(this.gesture.before)===JSON.stringify(current)){
      this.past=this.gesture.past;this.future=this.gesture.future;
    }
    this.group=null;this.gesture=null;
  }
  record(before,after,{group=null,label='Modifica',time=Date.now()}={}){
    if(before===after||JSON.stringify(before)===JSON.stringify(after))return false;
    if(this.gesture&&!this.gesture.before)this.gesture.before=structuredClone(before);
    const merge=group!==null&&this.group?.key===group&&(this.gesture||time-this.group.time<900)&&!this.future.length;
    if(!merge){this.past.push({state:structuredClone(before),label});if(this.past.length>this.limit)this.past.shift();}
    this.future=[];this.group={key:group,time};return true;
  }
  restore(snapshot,current){return {...structuredClone(snapshot),axes:current.axes,randomDelta:current.randomDelta};}
  undo(current){const entry=this.past.pop();if(!entry)return current;this.future.push({state:structuredClone(current),label:entry.label});this.endGesture();return this.restore(entry.state,current);}
  redo(current){const entry=this.future.pop();if(!entry)return current;this.past.push({state:structuredClone(current),label:entry.label});this.endGesture();return this.restore(entry.state,current);}
  seek(current,index){const target=Math.max(0,Math.min(this.past.length+this.future.length,Math.round(index)));while(this.past.length>target)current=this.undo(current);while(this.past.length<target)current=this.redo(current);return current;}
  get view(){return {cursor:this.past.length,labels:[...this.past.map(e=>e.label),...this.future.toReversed().map(e=>e.label)]};}
}
export function historyShortcut(event){
  if(!(event.ctrlKey||event.metaKey)||event.altKey)return null;
  const key=event.key.toLowerCase();
  return key==='y'||(key==='z'&&event.shiftKey)?'redo':key==='z'?'undo':null;
}
