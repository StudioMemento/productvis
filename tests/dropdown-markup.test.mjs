import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_STATE, PRESETS, clone } from '../src/state.js';
import { AXES } from '../src/axisState.js';
import { EFFECT_GROUPS } from '../src/objectEffectsState.js';
import { TECHNICAL_MENUS } from '../src/workspaceMenu.js';

// Real component output and callbacks. Browser, touch and GPU QA remain separate.
const result=await build({stdin:{contents:`export {App} from './src/App.jsx';export {AxisDock,AxisGenerator,GenerateDial,ViewTools} from './src/AxisControls.jsx';export {CategoryNavigation} from './src/CategoryNavigation.jsx';export {StageLibrary} from './src/StageLibrary.jsx';export {CategoryPager} from './src/CategoryPager.jsx';export {ShaderControls} from './src/ShaderControls.jsx';export {CameraWorkspace} from './src/CameraWorkspace.jsx';export {AnimationControls} from './src/AnimationControls.jsx';export {MaterialPicker} from './src/MaterialPicker.jsx';export {Knob,Presets} from './src/Controls.jsx';export {WorkspaceResizeHandle} from './src/WorkspaceResize.jsx';`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,platform:'node',format:'cjs',jsx:'automatic',packages:'external',write:false,logLevel:'silent'});
const mod={exports:{}};
new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
const {App,AxisDock,AxisGenerator,GenerateDial,ViewTools,CategoryNavigation,StageLibrary,CategoryPager,ShaderControls,CameraWorkspace,AnimationControls,MaterialPicker,Knob,Presets,WorkspaceResizeHandle}=mod.exports;
const markup=(Component,props={})=>renderToStaticMarkup(createElement(Component,props));
const tags=(html,pattern)=>(html.match(pattern)||[]);

function restored(id) {
  const before=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  try {
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>JSON.stringify({category:'camera',open:id})}});
    return markup(App);
  } finally {if(before)Object.defineProperty(globalThis,'localStorage',before);else delete globalThis.localStorage;}
}

test('five technical destinations precede five typographic creative tabs in the requested order',()=>{
  const html=markup(App);
  assert.deepEqual(TECHNICAL_MENUS,['model','inspect','project','render','export']);
  const indices=TECHNICAL_MENUS.map(id=>html.indexOf(`id="menu-trigger-${id}"`));
  assert.ok(indices.every((value,i)=>value>0&&(!i||value>indices[i-1])));
  assert.ok(indices.at(-1)<html.indexOf('id="category-tab-product"'));
  assert.equal(tags(html,/class="technical-rail"/g).length,1);
  assert.equal(tags(html,/data-category=/g).length,5);
  assert.ok(html.includes('id="controls-product"'));assert.ok(!html.includes('id="controls-scene"'));
});

test('every restored destination has one active trigger, one panel and no dropdowns or accordions',()=>{
  for(const id of [...AXES.map(a=>a.tab),...TECHNICAL_MENUS,'post']){
    const html=restored(id),region=id==='post'?'motion':id;
    const triggers=tags(html,/<button[^>]*id="(?:menu-trigger|category-tab)-[^"]+"[^>]*aria-expanded="true"[^>]*>/g);
    assert.equal(triggers.length,1,id);
    assert.ok(triggers[0].includes(`aria-controls="controls-${region}"`),id);
    assert.ok(html.includes(`id="controls-${region}"`));
    assert.equal(tags(html,/<(?:select|details|summary)\b/g).length,0,id);
    assert.ok(!html.includes('Chiudi tendina'));
    // Five independent local controls remain available even inside technical tools.
    assert.equal(tags(html,/aria-label="Varia solo (?:MAT|ENV|LIGHT|CAM|FX)"/g).length,5);
  }
});

test('technical destinations keep mesh, workspace, render and export responsibilities separate',()=>{
  const panel=id=>restored(id).split(`id="controls-${id}"`)[1].split('<nav id="productvis-navigation"')[0];
  const model=panel('model'),project=panel('project'),render=panel('render'),output=panel('export'),inspect=panel('inspect');
  for(const label of ['Importa GLB','Posizione X','Rotazione X','Scala modello','Facce','Alpha','UV'])assert.ok(model.includes(label),label);
  assert.ok(!model.includes('Nome progetto'));
  for(const label of ['Nome progetto','Salva .pvis','Apri .pvis','Monitor rendering'])assert.ok(project.includes(label),label);
  for(const label of ['Importa GLB','Posizione X','Esporta clip','Sfondo alpha'])assert.ok(!project.includes(label),label);
  for(const label of ['Qualità','MSAA','FPS','Risoluzione','Adattiva'])assert.ok(render.includes(label),label);
  for(const label of ['Esporta clip','Esporta frame PNG','Sfondo alpha','Monitor rendering','Importa GLB'])assert.ok(!render.includes(label),label);
  for(const label of ['Esporta frame PNG','Sfondo alpha','Playblast','Formato','Durata','Esporta clip'])assert.ok(output.includes(label),label);
  assert.ok(!output.includes('MSAA'));
  for(const label of ['Animazioni GLB','Wire alpha','Sezioni XYZ','Inverti taglio X','Spessore'])assert.ok(inspect.includes(label),label);
});

test('creative indicators are neutral inside technical tools and only the chosen creative region is mounted',()=>{
  const html=markup(CategoryNavigation,{active:'scene',opened:false,onChange(){}});
  assert.equal(tags(html,/aria-expanded="false"/g).length,5);assert.ok(!html.includes('class="active"'));
  const children=['MAT','ENV','LIGHT','CAM','FX'].map(text=>createElement('p',{key:text},text));
  const panel=renderToStaticMarkup(createElement(CategoryPager,{active:'camera'},children));
  assert.ok(panel.includes('<p>CAM</p>'));assert.ok(!panel.includes('<p>ENV</p>'));
});

test('CAM exposes all shot and movement presets, focus and advanced path controls in one scroll',()=>{
  const state=clone(DEFAULT_STATE);
  const html=markup(CameraWorkspace,{state,field(){},onRewind(){},onRender(){},onFocus(){},
    presets:category=>createElement(Presets,{category,selected:state[category].preset,onChoose(){}}),
    knob:(category,key,label,extra)=>createElement(Knob,{label,value:state[category][key],onChange(){},...extra})});
  for(const label of ['Focale','Bokeh','Distanza fuoco','Preset Movimento','Ciclo','Velocità','Fase','Ampiezza','Corsa','Verso','Curva','Loop','Playblast','Asse'])assert.ok(html.includes(label),label);
  for(const category of ['camera','motion'])for(const p of PRESETS[category])assert.ok(html.includes(`>${p.name}</span>`),p.name);
  assert.ok(!html.includes('workspace-sections'));assert.ok(!html.includes('preset-pages'));
});

test('every stage collection is visible simultaneously, with one active stage and vector previews',()=>{
  for(const selected of ['black-softbox','neon-rain-cathedral','cubes']){
    const html=markup(StageLibrary,{selected,onChoose(){},disabled:false});
    assert.equal(tags(html,/<button/g).length,34);
    assert.equal(tags(html,/aria-pressed="true"/g).length,1);
    for(const p of PRESETS.scene)assert.ok(html.includes(p.name),p.name);
    assert.ok(!/<canvas|<img|stage-carousel/.test(html));
  }
});

test('all fifteen product effects and advanced controls remain visible even with every effect off',()=>{
  const state=clone(DEFAULT_STATE),props={state,change(){},field(){},knob:(category,key,label)=>createElement('span',{key},label),onRestart(){},cursor:.3};
  for(const active of [false,true]){
    if(active)state.effects={...state.effects,surface:'rim',particles:'points',trail:'ribbon',intensity:0};
    const html=markup(ShaderControls,props);
    assert.equal(tags(html,/class="variant-grid /g).length,3);
    assert.equal(tags(html,/<button[^>]*aria-label="Shader /g).length,18);
    for(const [,label] of Object.values(EFFECT_GROUPS).flat())assert.ok(html.includes(label),label);
    for(const label of ['Fase shader','Lunghezza','Solido','Dispersione','Intensità','Direzione','Inverti scie','Disattiva VFX'])assert.ok(html.includes(label),label);
    assert.ok(!/<select|<details|<canvas/.test(html));
  }
});

test('the local dial remains editable when locked, while locked or zero generation is disabled',()=>{
  for(const axis of AXES)for(const locked of [false,true])for(const delta of [0,40]){
    const html=markup(AxisGenerator,{axis,settings:{delta,locked}});
    assert.ok(html.includes(`aria-label="${locked?'Sblocca':'Blocca'} asse ${axis.label}"`));
    const action=html.match(new RegExp(`<button[^>]*aria-label="Varia solo ${axis.label}"[^>]*>`))[0];
    assert.equal(action.includes('disabled'),locked||delta===0);
    const knob=html.match(new RegExp(`<button[^>]*aria-label="Delta ${axis.label}"[^>]*>`))[0];
    assert.ok(!knob.includes('disabled'));
    assert.ok(knob.includes(`aria-valuenow="${delta}"`));
    assert.ok(!html.includes('class="knob-value"'));
    const reset=html.match(new RegExp(`<button[^>]*aria-label="Ripristina asse ${axis.label}"[^>]*>`))[0];
    assert.ok(!reset.includes('disabled'),'reset is a manual action, independent of lock and delta');
    assert.ok(html.indexOf('class="local-actions"')>html.indexOf(`>${axis.label}</span>`));
  }
});

test('the five bottom dials route changes, locks, resets and generation to their own axis without navigation',()=>{
  const state=clone(DEFAULT_STATE),calls=[];
  const props={axes:state.axes,materialEligible:true,onDelta:(...args)=>calls.push(['delta',...args]),onLock:id=>calls.push(['lock',id]),onReset:id=>calls.push(['reset',id]),onGenerate:id=>calls.push(['generate',id])};
  const tree=AxisDock(props),generators=tree.props.children[1];
  assert.equal(generators.length,5);
  generators.forEach((child,i)=>{child.props.onDelta(23);child.props.onLock();child.props.onReset();child.props.onGenerate();assert.equal(child.props.axis.id,AXES[i].id);});
  assert.deepEqual(calls,AXES.flatMap(a=>[['delta',a.id,23],['lock',a.id],['reset',a.id],['generate',a.id]]));
  const html=markup(AxisDock,props);
  assert.equal(tags(html,/aria-label="Delta (?:MAT|ENV|LIGHT|CAM|FX)"/g).length,5);
  assert.ok(!html.includes('data-category'));assert.ok(!html.includes('Delta globale'));
});

test('reset remains available for authored transparent surfaces, but not during a disabled workspace',()=>{
  const props={axis:AXES[0],settings:{delta:0,locked:true},unavailable:true};
  const reset=extra=>markup(AxisGenerator,{...props,...extra}).match(/<button[^>]*aria-label="Ripristina asse MAT"[^>]*>/)[0];
  assert.ok(!reset({}).includes('disabled'));
  assert.ok(reset({disabled:true}).includes('disabled'));
  assert.ok(reset({resetUnavailable:true}).includes('disabled'));
});

test('the resize separator exposes orientation, current size, limits and keyboard focus',()=>{
  for(const bottom of [false,true]){
    const layout={bottom,size:400,bounds:{min:300,max:600}};
    const html=markup(WorkspaceResizeHandle,{layout});
    assert.ok(html.includes('role="separator"'));
    assert.ok(html.includes(`aria-orientation="${bottom?'horizontal':'vertical'}"`));
    for(const attr of ['tabindex="0"','aria-controls="productvis-controls"','aria-valuenow="400"','aria-valuemin="300"','aria-valuemax="600"'])assert.ok(html.includes(attr));
    assert.ok(markup(WorkspaceResizeHandle,{layout,disabled:true}).includes('tabindex="-1"'));
  }
});

test('the global generator and simplified-view controls are separate and preserve blocked states',()=>{
  for(const override of [{activeCount:0},{delta:0},{locked:true}]){
    const html=markup(GenerateDial,{delta:40,activeCount:4,...override});
    assert.ok(html.match(/<button[^>]*aria-label="Sparkle · varia gli assi sbloccati"[^>]*>/)[0].includes('disabled'));
  }
  const html=markup(ViewTools,{presentation:true,fullscreen:false,canUndo:true});
  assert.ok(html.includes('Mostra controlli completi'));assert.ok(html.includes('Schermo intero'));
  assert.ok(html.includes('aria-expanded="false"'));assert.ok(html.includes('Annulla ultima modifica'));
});

test('all model surfaces and native animation clips have directly selectable entries',()=>{
  const materials=Array.from({length:12},(_,i)=>({id:'m'+i,label:'Surface '+i,group:i%2?'glass':'body',original:{color:'#cccccc'}}));
  const html=markup(MaterialPicker,{materials,selectedId:'m8',onSelect(){}});
  for(const material of materials)assert.ok(html.includes(material.label));
  assert.equal(tags(html,/<button/g).length,12);
  const clips=Array.from({length:9},(_,i)=>({index:i,name:'Clip '+i,duration:i+1}));
  const animation=markup(AnimationControls,{clips,animation:DEFAULT_STATE.animation,cursor:.3,onChange(){},onSeek(){},knob:()=>null});
  for(const clip of clips)assert.ok(animation.includes(clip.name));
  assert.equal(tags(animation,/<select/g).length,0);
  assert.equal(tags(animation,/aria-pressed=/g).length,9);
});
