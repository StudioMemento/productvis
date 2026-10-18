// History is a relative rail: the selected state is always at its center.
export const HISTORY_STEP = 24;
export const historyPosition = (start,distance,total,step=HISTORY_STEP) => Math.max(0,Math.min(total,start+distance/step));
export const historyWheelDistance = event => {
  const delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
  return Math.max(-96,Math.min(96,delta*(event.deltaMode===1?16:event.deltaMode===2?240:1)))*.5;
};
export function historySlots(cursor,total,radius=32){
  return Array.from({length:radius*2+1},(_,i)=>{
    const offset=i-radius,index=cursor+offset;
    return {offset,index,kind:index<0||index>total?'empty':offset===0?'current':offset<0?'past':'future'};
  });
}
export function historyDrag(start,distance,total,step=HISTORY_STEP){
  const raw=start+distance/step,cursor=Math.max(0,Math.min(total,Math.round(raw)));
  return {cursor,offset:raw<0||raw>total?0:-(distance-(cursor-start)*step)};
}
export function historyKey(key,cursor,total){
  const steps={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1,PageUp:5,PageDown:-5};
  if(key==='Home')return 0;if(key==='End')return total;
  return key in steps?Math.max(0,Math.min(total,cursor+steps[key])):null;
}
