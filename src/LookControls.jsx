import { IconSparkles, IconBlur, IconSlice, IconFlipHorizontal, IconGridDots, IconActivity, IconAdjustments, IconCircleHalf2, IconLock, IconLockOpen } from '@tabler/icons-react';
import { Knob, Choices, Toggle, Tool } from './Controls.jsx';
import { POST_LOOKS, BLOOM_LIMIT, BLOOM_OVERRIDE_LIMIT, bloomStrength } from './lookdev.js';

export function InspectorControls({ state, change, disabled, onStart }) {
  const { inspection, section } = state;
  const field = (group,key,value) => change(s => ({ ...s, [group]: { ...s[group], [key]:value } }), `${group}.${key}`);
  const axisField = (axis,key,value) => change(s => ({ ...s, section:{ ...s.section, [axis]:{ ...s.section[axis], [key]:value } } }), `section.${axis}.${key}`);
  return <div className="look-controls">
    <Choices label="Vista" value={inspection.view} options={[['pbr','PBR'],['wire','Wire'],['overlay','Mix'],['normals','Normali']].map(([value,label])=>({value,label,disabled}))} onChange={value=>field('inspection','view',value)}/>
    {inspection.view === 'overlay' && <div className="knob-grid"><Knob label="Wire alpha" value={inspection.wireOpacity} min={.05} max={1} step={.01} onStart={onStart} onChange={v=>field('inspection','wireOpacity',v)}/></div>}
    <div className="look-heading"><Toggle label="Sezioni XYZ" icon={IconSlice} checked={section.enabled} onChange={v=>field('section','enabled',v)} disabled={disabled}/></div>
    {section.enabled && <>
      <Choices label="Taglio" value={section.mode} options={[{value:'cut',label:'Piano'},{value:'slab',label:'Fascia'}]} onChange={v=>field('section','mode',v)}/>
      <div className="section-axes">{['x','y','z'].map(axis=><div className="section-axis" key={axis}>
        <button type="button" className={`axis-toggle ${section[axis].enabled?'selected':''}`} aria-pressed={section[axis].enabled} aria-label={`Sezione ${axis.toUpperCase()}`} onClick={()=>axisField(axis,'enabled',!section[axis].enabled)}>{axis.toUpperCase()}</button>
        <Knob label={`Posizione ${axis.toUpperCase()}`} value={section[axis].position} onChange={v=>axisField(axis,'position',v)} onStart={onStart} disabled={!section[axis].enabled}/>
        {section.mode==='cut' && <Tool label={`Inverti taglio ${axis.toUpperCase()}`} aria-pressed={section[axis].flip} className={section[axis].flip?'selected':''} disabled={!section[axis].enabled} onClick={()=>axisField(axis,'flip',!section[axis].flip)}><IconFlipHorizontal size={17}/></Tool>}
      </div>)}</div>
      {section.mode==='slab' && <div className="knob-grid"><Knob label="Spessore" value={section.thickness} min={.02} max={1} step={.01} onStart={onStart} onChange={v=>field('section','thickness',v)}/></div>}
      <Toggle label="Guide" icon={IconGridDots} checked={section.helpers} onChange={v=>field('section','helpers',v)}/>
      <span className="pass-note">Tagli aperti · nessun riempimento</span>
    </>}
  </div>;
}

export function PostControls({ state, change, disabled, onStart }) {
  const post = state.post;
  const field = (key,value) => change(s=>({...s,post:{...s.post,[key]:value}}),`post.${key}`);
  const knob = (key,label,props={}) => <Knob label={label} value={post[key]} onChange={v=>field(key,v)} onStart={onStart} disabled={disabled||!post.enabled} {...props}/>;
  const note = state.render.alpha ? 'Bloom e DOF sospesi in Alpha' : state.inspection.view!=='pbr' ? 'Effetti sospesi in Ispeziona' : state.quality==='fluid' ? 'Bloom e DOF sospesi in Fluida' : state.section.enabled ? 'DOF sospeso durante il taglio' : null;
  return <div className="look-controls">
    <div className="presets post-presets" role="group" aria-label="Look postprocessing">{POST_LOOKS.map(look=>{const active=Object.entries(look.values).every(([key,value])=>post[key]===value);return <button type="button" className={`preset ${active?'active':''}`} aria-pressed={active} key={look.id} disabled={disabled} onClick={()=>change(s=>({...s,post:{...look.values}}))}><span className="preset-diamond"><IconSparkles size={18}/></span><span>{look.name}</span></button>;})}</div>
    <Toggle label="Postprocessing" icon={IconAdjustments} checked={post.enabled} onChange={v=>field('enabled',v)} disabled={disabled}/>
    <Choices label="Tone" value={post.tone} options={[['aces','ACES'],['agx','AgX'],['neutral','Neutral']].map(([value,label])=>({value,label,disabled}))} onChange={v=>field('tone',v)}/>
    <div className="look-heading bloom-heading"><Toggle label="Bloom" icon={IconSparkles} checked={post.bloom} onChange={v=>field('bloom',v)} disabled={disabled||!post.enabled}/><button type="button" className={`bloom-limit ${post.bloomOverride?'selected':''}`} disabled={disabled||!post.enabled||!post.bloom} aria-pressed={post.bloomOverride} aria-label={post.bloomOverride?'Ripristina limite bloom 0.2':'Override manuale bloom fino a 1'} title={post.bloomOverride?'Ripristina massimo 0.2':'Sblocca manualmente fino a 1'} onClick={()=>change(s=>{const post={...s.post,bloomOverride:!s.post.bloomOverride};return {...s,post:{...post,strength:bloomStrength(post)}};})}>{post.bloomOverride?<IconLockOpen size={12}/>:<IconLock size={12}/>}Max {post.bloomOverride?'1':'0.2'}</button></div>
    {post.bloom && <div className="knob-grid">{knob('strength','Intensità',{max:post.bloomOverride?BLOOM_OVERRIDE_LIMIT:BLOOM_LIMIT,step:.01,format:v=>v.toFixed(2)})}{knob('radius','Raggio')}{knob('threshold','Soglia',{max:3,step:.05,format:v=>v.toFixed(2)})}</div>}
    <Toggle label="Profondità di campo" icon={IconBlur} checked={post.dof} onChange={v=>field('dof',v)} disabled={disabled||!post.enabled}/>
    <span className="control-group-title">Immagine</span>
    <div className="knob-grid">{knob('contrast','Contrasto',{min:.5,max:1.5,step:.01})}{knob('saturation','Saturazione',{max:2})}{knob('vignette','Vignetta')}</div>
    {note && <span className="pass-note">{note}</span>}
  </div>;
}

export function RenderControls({ state, change, capabilities, stats, onStart }) {
  const field = (key,value) => change(s=>({...s,render:{...s.render,[key]:value}}),`render.${key}`);
  return <div className="look-controls render-controls">
    <Choices label="Qualità" value={state.quality} options={[{value:'auto',label:'Auto'},{value:'fluid',label:'Fluida'},{value:'high',label:'Alta'}]} onChange={v=>change(s=>({...s,quality:v}))}/>
    <Choices label="MSAA" value={state.render.msaa} options={['auto',0,2,4,8].map(value=>({value,label:value==='auto'?'Auto':value===0?'Off':`${value}×`,disabled:typeof value==='number'&&value>0&&!capabilities.samples.includes(value)}))} onChange={v=>field('msaa',v)}/>
    <Choices label="FPS" value={state.render.fps} options={['auto',30,60].map(value=>({value,label:value==='auto'?'Auto':String(value)}))} onChange={v=>field('fps',v)}/>
    <div className="render-tuning"><Knob label="Risoluzione" value={state.render.resolution} min={.5} max={1} step={.05} onChange={v=>field('resolution',v)} onStart={onStart}/><div><Toggle label="Adattiva" checked={state.render.adaptive} onChange={v=>field('adaptive',v)}/><Toggle label="Monitor" icon={IconActivity} checked={state.render.stats} onChange={v=>field('stats',v)}/></div></div>
    {stats && <span className="pass-note">{stats.width} × {stats.height} · MSAA {stats.samples?`${stats.samples}×`:'Off'}</span>}
    <Toggle label="Sfondo alpha" icon={IconCircleHalf2} checked={state.render.alpha} onChange={v=>field('alpha',v)}/>
  </div>;
}
