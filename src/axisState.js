// Public generation axes are separate from the legacy tab ids (FX used 'motion').
export const AXES = Object.freeze([
  {id:'mat',tab:'product',label:'MAT',name:'Materiale',scope:'Superficie selezionata',fields:['materials']},
  {id:'env',tab:'scene',label:'ENV',name:'Ambiente',scope:'Stage e atmosfera',fields:['scene']},
  {id:'light',tab:'lighting',label:'LIGHT',name:'Luce',scope:'Key · fill · rim',fields:['lighting']},
  {id:'cam',tab:'camera',label:'CAM',name:'Camera',scope:'Ripresa e movimento',fields:['camera','motion']},
  {id:'fx',tab:'motion',label:'FX',name:'Effetti',scope:'Shader e post',fields:['effects','post']},
]);
export const axisForTab = tab => AXES.find(axis=>axis.tab===tab)||AXES[0];
export const defaultAxes = () => Object.fromEntries(AXES.map(({id})=>[id,{delta:100,locked:false}]));
export function validateAxes(input,{legacyRandomize=true}={}) {
  const axes=defaultAxes();
  for(const {id} of AXES){
    const value=input?.[id];
    if(Number.isFinite(value?.delta))axes[id].delta=Math.round(Math.max(0,Math.min(100,value.delta)));
    if(typeof value?.locked==='boolean')axes[id].locked=value.locked;
  }
  if(!input?.fx&&legacyRandomize===false)axes.fx.locked=true;
  return axes;
}
export function generationAmounts(state,axis=null,delta=state.randomDelta) {
  const axes=validateAxes(state.axes,{legacyRandomize:state.effects?.randomize});
  const master=Number.isFinite(delta)?Math.max(0,Math.min(100,delta))/100:0;
  return Object.fromEntries(AXES.map(({id})=>[id,axes[id].locked||(axis&&axis!==id)?0:axes[id].delta/100*(axis?1:master)]));
}
