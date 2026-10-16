import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DEFAULT_STATE,PRESETS,clone} from '../src/state.js';
import {AXES} from '../src/axisState.js';
import {EFFECT_GROUPS} from '../src/objectEffectsState.js';
import {TECHNICAL_MENUS} from '../src/workspaceMenu.js';
import {historySlots,historyDrag} from '../src/historyNavigation.js';
const exports=`export {App} from './src/App.jsx';export {AxisDock,GenerateDial,ViewTools} from './src/AxisControls.jsx';export {CategoryNavigation} from './src/CategoryNavigation.jsx';export {StageLibrary} from './src/StageLibrary.jsx';export {CategoryPager} from './src/CategoryPager.jsx';export {ShaderControls} from './src/ShaderControls.jsx';export {CameraWorkspace} from './src/CameraWorkspace.jsx';export {AnimationControls} from './src/AnimationControls.jsx';export {MaterialPicker} from './src/MaterialPicker.jsx';export {Knob,Presets} from './src/Controls.jsx';export {WorkspaceResizeHandle} from './src/WorkspaceResize.jsx';export {HistoryRail} from './src/HistoryRail.jsx';export {DeltaIcon,deltaFromDrag} from './src/DeltaIcon.jsx';`;
const bundle=await build({stdin:{contents:exports,resolveDir:process.cwd(),loader:'jsx'},bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/*','react-dom/*','three','three/*'],write:false,logLevel:'silent'});
const mod={exports:{}},require=createRequire(import.meta.url);
new Function('require','module','exports',bundle.outputFiles[0].text)(require,mod,mod.exports);
const {App,AxisDock,GenerateDial,ViewTools,CategoryNavigation,StageLibrary,CategoryPager,ShaderControls,CameraWorkspace,AnimationControls,MaterialPicker,Knob,Presets,WorkspaceResizeHandle,HistoryRail}=mod.exports;
const html=(Component,props={})=>renderToStaticMarkup(React.createElement(Component,props));
const count=(s,re)=>(s.match(re)||[]).length;
function restored(id){
  const before=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  try{Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>JSON.stringify({category:'camera',open:id})}});return html(App);}
  finally{if(before)Object.defineProperty(globalThis,'localStorage',before);else delete globalThis.localStorage;}
}
function atViewport(width,height,render=()=>html(App)){
  const previous={width:globalThis.innerWidth,height:globalThis.innerHeight};
  globalThis.innerWidth=width;globalThis.innerHeight=height;
  try{return render();}finally{if(previous.width===undefined)delete globalThis.innerWidth;else globalThis.innerWidth=previous.width;if(previous.height===undefined)delete globalThis.innerHeight;else globalThis.innerHeight=previous.height;}
}
test('mobile has one five-axis nav below history, desktop may duplicate it in the player',()=>{
  const s=atViewport(390,844);
  assert.deepEqual(TECHNICAL_MENUS,['model','project','export']);
  assert.equal(count(s,/data-tech=/g),3);assert.equal(count(s,/data-category=/g),5);
  assert.equal(count(s,/role="slider"/g),7);
  assert.ok(s.includes('/assets/memento-icon.svg'));
  assert.equal(count(s,/aria-label="Cronologia modifiche"/g),1);
  assert.ok(s.includes('Chiudi proprietà'));assert.ok(s.includes('aria-controls="property-content"'));
  assert.ok(s.indexOf('id="property-content"')<s.indexOf('class="history-rail"'));
  assert.ok(s.indexOf('class="history-rail"')<s.indexOf('id="productvis-navigation"'));
  assert.equal(count(s,/role="separator"/g),2);
  assert.equal(count(atViewport(844,390),/data-category=/g),5);
  const desktop=atViewport(1440,900);assert.equal(count(desktop,/data-category=/g),10);
  const ids=[...desktop.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
});
test('every current and migrated destination mounts exactly one property region',()=>{
  for(const id of [...AXES.map(a=>a.tab),...TECHNICAL_MENUS,'post','inspect','render']){
    const s=atViewport(390,844,()=>restored(id)),region=({post:'motion',inspect:'model',render:'project'}[id]||id);
    const triggers=s.match(/<button[^>]*id="(?:menu-trigger|category-tab)-[^"]+"[^>]*aria-expanded="true"[^>]*>/g)||[];
    assert.equal(triggers.length,1,id);assert.ok(triggers[0].includes('aria-controls="controls-'+region+'"'));
    assert.ok(s.includes('id="controls-'+region+'"'));
    assert.equal(count(s,/<(?:select|details|summary)\b/g),0);
    assert.equal(count(s,/aria-label="Delta (?:MAT|ENV|LIGHT|CAM|FX)"/g),5);
    assert.equal(count(s,/aria-label="Blocca asse /g),5);assert.equal(count(s,/aria-label="Ripristina asse /g),5);
  }
});
test('mesh includes inspection, settings include rendering/project, capture owns PNG/playblast',()=>{
  const panel=id=>restored(id).split('id="controls-'+id+'"')[1].split('<nav id="productvis-navigation"')[0];
  const model=panel('model'),settings=panel('project'),capture=panel('export');
  for(const label of ['Importa GLB','Posizione X','Rotazione X','Scala modello','Facce','Alpha','UV','Ispeziona','Animazioni GLB','Sezioni XYZ'])assert.ok(model.includes(label),label);
  for(const label of ['Nome progetto','Salva .pvis','Apri .pvis','Qualità','MSAA','FPS','Risoluzione','Adattiva','Monitor rendering'])assert.ok(settings.includes(label),label);
  assert.ok(!settings.includes('Importa GLB'));assert.ok(!settings.includes('Esporta clip'));
  for(const label of ['Esporta frame PNG','Sfondo alpha','Playblast','Formato','Durata','Esporta clip'])assert.ok(capture.includes(label),label);
  assert.ok(!capture.includes('MSAA'));
});
test('all retained stages have vector previews and only the selected one is active',()=>{
  for(const p of PRESETS.scene){
    const s=html(StageLibrary,{selected:p.id,onChoose(){}});
    assert.equal(count(s,/<button/g),6);assert.equal(count(s,/aria-pressed="true"/g),1);
    for(const stage of PRESETS.scene)assert.ok(s.includes(stage.name));
    assert.ok(!/<canvas|<img|stage-carousel/.test(s));
  }
});
test('camera and all product effects remain available inside the paired property banks',()=>{
  const state=clone(DEFAULT_STATE),props={state,change(){},field(){},onRewind(){},onRender(){},onFocus(){},onRestart(){},cursor:.3,
    presets:category=>React.createElement(Presets,{category,selected:state[category].preset,onChoose(){}}),
    knob:(category,key,label,extra)=>React.createElement(Knob,{label,value:state[category][key],onChange(){},...extra})};
  const camera=html(CameraWorkspace,props),fx=html(ShaderControls,props);
  assert.ok(camera.includes('property-pair'));assert.ok(fx.includes('property-pair'));
  for(const category of ['camera','motion'])for(const p of PRESETS[category])assert.ok(camera.includes(p.name));
  for(const label of ['Bokeh','Distanza fuoco','Ciclo','Velocità','Fase','Ampiezza','Corsa','Loop','Playblast'])assert.ok(camera.includes(label),label);
  assert.equal(count(fx,/<button[^>]*aria-label="Shader /g),18);
  for(const [,label] of Object.values(EFFECT_GROUPS).flat())assert.ok(fx.includes(label));
});
test('each axis combines delta, context label, lock, open cue and reset',()=>{
  const axes=clone(DEFAULT_STATE.axes);axes.mat={locked:true,delta:0};
  const nav=html(CategoryNavigation,{active:'product',opened:true,axes,onChange(){}});
  assert.ok(nav.includes('Sblocca asse MAT'));assert.ok(nav.includes('Ripristina asse MAT'));
  const delta=nav.match(/<button[^>]*role="slider"[^>]*>/)[0];assert.ok(!delta.includes('disabled'));assert.ok(delta.includes('aria-valuenow="0"'));
  assert.ok(!nav.match(/<button[^>]*aria-label="Ripristina asse MAT"[^>]*>/)[0].includes('disabled'));
  assert.ok(html(CategoryNavigation,{axes,controlsDisabled:true}).match(/<button[^>]*aria-label="Ripristina asse MAT"[^>]*>/)[0].includes('disabled'));
  assert.equal(count(nav,/data-open="true"/g),1);assert.equal(count(nav,/data-open="false"/g),4);
  assert.equal(count(html(CategoryNavigation,{active:'product',opened:false,axes}),/data-open="true"/g),0);
});
test('each integrated axis routes delta and generation independently; its label only opens context',()=>{
  const calls=[],tree=CategoryNavigation({axes:DEFAULT_STATE.axes,materialEligible:true,onDelta:(...a)=>calls.push(['delta',...a]),onGenerate:id=>calls.push(['generate',id]),onChange:tab=>calls.push(['context',tab]),onLock:id=>calls.push(['lock',id]),onReset:id=>calls.push(['reset',id])});
  tree.props.children.forEach((child,i)=>{
    const [icon,label,actions]=child.props.children;
    icon.props.onChange(23);icon.props.onGenerate();icon.props.onContext();label.props.onClick();
    actions.props.children[0].props.onClick();actions.props.children[2].props.onClick();
    assert.equal(icon.props.kind,AXES[i].id);
  });
  assert.deepEqual(calls,AXES.flatMap(a=>[['delta',a.id,23],['generate',a.id],['context',a.tab],['context',a.tab],['lock',a.id],['reset',a.id]]));
});
test('history exposes bounded undo/redo controls and an accessible scrubber',()=>{
  const start=html(HistoryRail,{cursor:0,labels:['Materiale','Luce']}),end=html(HistoryRail,{cursor:2,labels:['Materiale','Luce']});
  assert.ok(start.match(/<button[^>]*aria-label="Annulla[^>]*>/)[0].includes('disabled'));
  assert.ok(!start.match(/<button[^>]*aria-label="Ripeti[^>]*>/)[0].includes('disabled'));
  assert.ok(end.match(/<button[^>]*aria-label="Ripeti[^>]*>/)[0].includes('disabled'));
  assert.ok(end.includes('2 di 2 · Luce'));assert.ok(end.includes('aria-label="Posizione cronologia"'));
});
test('resize semantics and fullscreen remain available',()=>{
  for(const bottom of [false,true]){
    const s=html(WorkspaceResizeHandle,{layout:{bottom,size:400,bounds:{min:270,max:600}}});
    assert.ok(s.includes('role="separator"'));assert.ok(s.includes('aria-valuenow="400"'));
    assert.ok(s.includes('aria-orientation="'+(bottom?'horizontal':'vertical')+'"'));
  }
  const s=html(ViewTools,{fullscreen:false});
  assert.ok(s.includes('Schermo intero'));assert.equal(count(s,/<button/g),1);
});
test('every material and native animation clip is directly reachable',()=>{
  const materials=Array.from({length:12},(_,i)=>({id:'m'+i,label:'Surface '+i,group:'body',original:{color:'#cccccc'}}));
  const s=html(MaterialPicker,{materials,selectedId:'m8',onSelect(){}});
  for(const m of materials)assert.ok(s.includes(m.label));assert.equal(count(s,/<button/g),12);
  const clips=Array.from({length:9},(_,i)=>({index:i,name:'Clip '+i,duration:i+1}));
  const animation=html(AnimationControls,{clips,animation:DEFAULT_STATE.animation,cursor:.3,onChange(){},onSeek(){},knob:()=>null});
  for(const c of clips)assert.ok(animation.includes(c.name));
});
// Exercise the real event handlers without a browser; only hook allocation is stubbed.
const hooked={exports:{}};
const hooks={...React,useId:()=> 'test-delta',useRef:value=>({current:value}),useState:value=>[value,()=>{}],useEffect:()=>{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(name=>name==='react'?hooks:require(name),hooked,hooked.exports);
test('tap generates once, vertical drag only changes delta, cancellation restores it, locks block generation',()=>{
  const run=(extra={})=>{
    const values=[],generations=[],contexts=[];
    const element=hooked.exports.DeltaIcon({kind:'mat',label:'MAT',value:50,onChange:v=>values.push(v),onGenerate:()=>generations.push(1),onContext:()=>contexts.push(1),...extra});
    const p=element.props,event={button:0,pointerId:1,clientY:100,preventDefault(){},currentTarget:{focus(){},setPointerCapture(){}}};
    return {p,event,values,generations,contexts};
  };
  const tap=run();tap.p.onPointerDown(tap.event);tap.p.onPointerUp(tap.event);tap.p.onClick();assert.equal(tap.generations.length,1);assert.equal(tap.values.length,0);
  const drag=run();drag.p.onPointerDown(drag.event);drag.p.onPointerMove({...drag.event,clientY:60});drag.p.onPointerUp(drag.event);drag.p.onClick();assert.deepEqual(drag.values,[80]);assert.equal(drag.generations.length,0);
  const cancel=run();cancel.p.onPointerDown(cancel.event);cancel.p.onPointerMove({...cancel.event,clientY:150});cancel.p.onPointerCancel(cancel.event);assert.equal(cancel.values.at(-1),50);assert.equal(cancel.generations.length,0);
  const lock=run({blocked:true,locked:true});lock.p.onPointerDown(lock.event);lock.p.onPointerUp(lock.event);assert.equal(lock.generations.length,0);
  lock.p.onKeyDown({key:'ArrowUp',preventDefault(){}});assert.deepEqual(lock.values,[51]);
});

test('simplified mode remains closed through context selection and history; only its chevron reopens it',()=>{
  const slots=[];let index=0;
  const useState=initial=>{
    const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;
    return [slots[i],update=>{slots[i]=typeof update==='function'?update(slots[i]):update;}];
  };
  const runtime={...React,useState,useRef:initial=>useState(()=>({current:initial}))[0],useCallback:fn=>fn,useEffect(){},useLayoutEffect(){},useReducer:(reducer,initial,init)=>{
    const [state,set]=useState(()=>init?init(initial):initial);return [state,action=>set(value=>reducer(value,action))];
  }};
  const app={exports:{}};
  new Function('require','module','exports',bundle.outputFiles[0].text)(name=>name==='react'?runtime:require(name),app,app.exports);
  const render=()=>{index=0;return atViewport(390,844,()=>app.exports.App());};
  const find=(node,predicate)=>{
    if(!node||typeof node!=='object')return undefined;
    if(predicate(node))return node;
    for(const child of [node.props?.children].flat(Infinity)){const found=find(child,predicate);if(found)return found;}
  };
  const arrow=tree=>find(tree,n=>n.props?.className==='property-toggle');
  const nav=tree=>find(tree,n=>n.type===app.exports.CategoryNavigation);
  const content=tree=>find(tree,n=>n.props?.id==='property-content');
  let tree=render();assert.equal(content(tree).props['aria-hidden'],false);
  arrow(tree).props.onClick();tree=render();
  assert.equal(content(tree).props.inert,true);assert.equal(arrow(tree).props['aria-label'],'Apri proprietà');
  assert.ok(tree.props.className.includes('is-presenting'));assert.equal(nav(tree).props.opened,false);
  for(const axis of AXES){
    nav(tree).props.onChange(axis.tab);tree=render();
    assert.equal(nav(tree).props.active,axis.tab);assert.equal(nav(tree).props.opened,false);assert.equal(content(tree).props.inert,true);
  }
  find(tree,n=>n.props?.['data-tech']==='project').props.onClick();tree=render();
  assert.equal(content(tree).props.inert,true);assert.equal(nav(tree).props.opened,false);
  const rail=find(tree,n=>n.type===app.exports.HistoryRail);rail.props.onUndo();rail.props.onRedo();tree=render();
  assert.equal(content(tree).props.inert,true);
  arrow(tree).props.onClick();tree=render();
  assert.equal(content(tree).props.inert,undefined);assert.ok(!tree.props.className.includes('is-presenting'));
  assert.equal(find(tree,n=>n.props?.['data-tech']==='project').props['aria-expanded'],true);
});


test('history keeps the active slot central and never represents an empty future as an edit',()=>{
  for(const [cursor,total] of [[0,0],[0,5],[2,5],[5,5],[79,80],[80,80]]){
    const slots=historySlots(cursor,total),middle=(slots.length-1)/2;
    assert.equal(slots[middle].index,cursor);assert.equal(slots[middle].kind,'current');
    assert.equal(slots.filter(s=>s.kind==='current').length,1);
    for(const slot of slots){
      if(slot.index<0||slot.index>total)assert.equal(slot.kind,'empty');
      if(slot.kind==='past')assert.ok(slot.index<cursor&&slot.index>=0);
      if(slot.kind==='future')assert.ok(slot.index>cursor&&slot.index<=total);
    }
    if(cursor===total)assert.ok(slots.slice(middle+1).every(s=>s.kind==='empty'));
  }
  const end=html(HistoryRail,{cursor:5,labels:['A','B','C','D','E']});
  assert.equal(count(end,/class="history-pivot"/g),1);
  assert.ok(end.includes('data-at-present="true"'));assert.ok(end.includes('Presente'));
  assert.deepEqual(historyDrag(5,100,5),{cursor:5,offset:0});
  assert.deepEqual(historyDrag(0,-100,5),{cursor:0,offset:0});
});

const historyGesture=(cursor=5,extra={})=>{
  const calls=[],tree=hooked.exports.HistoryRail({cursor,labels:['A','B','C','D','E'],onSeek:index=>calls.push(index),...extra});
  const p=tree.props.children[1].props;
  const event={button:0,pointerId:1,clientX:200,preventDefault(){},stopPropagation(){},currentTarget:{focus(){},setPointerCapture(){},getBoundingClientRect(){return {left:100,width:200};}}};
  return {p,event,calls};
};
test('history swipes left to undo, right to redo, and blocks travel beyond the present',()=>{
  const h=historyGesture();h.p.onPointerDown(h.event);
  h.p.onPointerMove({...h.event,clientX:240});assert.deepEqual(h.calls,[]);
  h.p.onPointerMove({...h.event,clientX:168});assert.deepEqual(h.calls,[3]);
  h.p.onPointerMove({...h.event,clientX:184});assert.deepEqual(h.calls,[3,4]);
  h.p.onPointerMove({...h.event,clientX:260});assert.deepEqual(h.calls,[3,4,5]);
  h.p.onPointerMove({...h.event,clientX:300});h.p.onPointerUp({...h.event,clientX:300});assert.deepEqual(h.calls,[3,4,5]);
  const redo=historyGesture(3);redo.p.onPointerDown(redo.event);redo.p.onPointerMove({...redo.event,clientX:232});redo.p.onPointerUp({...redo.event,clientX:232});assert.deepEqual(redo.calls,[5]);
});
test('history taps only existing slots; cancellation restores the gesture origin',()=>{
  const empty=historyGesture();const tap={...empty.event,clientX:232};empty.p.onPointerDown(tap);empty.p.onPointerUp(tap);assert.deepEqual(empty.calls,[]);
  const past=historyGesture();const slot={...past.event,clientX:168};past.p.onPointerDown(slot);past.p.onPointerUp(slot);assert.deepEqual(past.calls,[3]);
  for(const method of ['onPointerCancel','onLostPointerCapture','onKeyDown']){
    const h=historyGesture();h.p.onPointerDown(h.event);h.p.onPointerMove({...h.event,clientX:152});
    h.p[method]({...h.event,key:'Escape'});assert.deepEqual(h.calls,[2,5]);
    h.p.onPointerUp(h.event);assert.deepEqual(h.calls,[2,5]);
  }
  const disabled=historyGesture(5,{disabled:true});disabled.p.onPointerDown(disabled.event);disabled.p.onPointerMove({...disabled.event,clientX:100});disabled.p.onPointerUp(disabled.event);assert.deepEqual(disabled.calls,[]);
});
test('history keyboard navigation obeys both endpoints and does not seek for unrelated keys',()=>{
  const h=historyGesture();
  for(const key of ['ArrowRight','ArrowUp','PageUp','End','a'])h.p.onKeyDown({...h.event,key});assert.deepEqual(h.calls,[]);
  for(const key of ['ArrowLeft','Home','PageDown'])h.p.onKeyDown({...h.event,key});assert.deepEqual(h.calls,[4,0,0]);
  const start=historyGesture(0);for(const key of ['ArrowLeft','Home','PageDown'])start.p.onKeyDown({...start.event,key});assert.deepEqual(start.calls,[]);
});
test('all five axis glyphs use Phosphor and the squircle perimeter reflects delta endpoints',()=>{
  for(const kind of ['mat','env','light','cam','fx'])for(const value of [0,35,100]){
    const s=html(mod.exports.DeltaIcon,{kind,label:kind,value});
    assert.ok(s.includes('class="delta-squircle"'));assert.ok(s.includes('data-phosphor=""'));
    assert.ok(s.includes('stroke-dasharray="'+value+' 100"'));
    assert.ok(s.includes('aria-valuenow="'+value+'"'));assert.ok(!s.includes('<clipPath'));
  }
});
