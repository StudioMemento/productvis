import { IconMovie } from './icons.jsx';
import { Choices,Knob,KnobGrid } from './Controls.jsx';
import {videoSettings,videoType} from './playblast.js';
export function PlayblastControls({disabled,onExport,supported,settings,setSettings,reason}) {
  const field=(key,value)=>setSettings(s=>({...s,[key]:value}));
  const {width,height,fps,duration}=videoSettings(settings),mime=videoType(),codec=mime?.split('codecs=')[1],container=mime?.startsWith('video/mp4')?'MP4':'WebM';
  return <div className="playblast-controls">
    <Choices label="Formato" value={settings.aspect} options={['16:9','9:16','1:1'].map(value=>({value,label:value,disabled}))} onChange={v=>field('aspect',v)}/>
    <Choices label="Output" value={settings.size} options={[720,1080].map(value=>({value,label:`${value}p`,disabled}))} onChange={v=>field('size',v)}/>
    <Choices label="FPS" value={settings.fps} options={[24,30,60].map(value=>({value,label:`${value}`,disabled}))} onChange={v=>field('fps',v)}/>
    <KnobGrid><Knob label="Durata" min={2} max={20} step={1} value={settings.duration} unit="s" format={v=>`${v}s`} onChange={v=>field('duration',v)} disabled={disabled}/></KnobGrid>
    <div className="export-format-preview"><div className="format-frame" style={{aspectRatio:`${width}/${height}`}}><span>{settings.aspect}</span></div><output className="export-summary">{width} × {height} px<br/>{fps} fps richiesti · {duration} s<br/>{mime?`${container}${codec?' · '+codec:''}`:'Codec non disponibile'}</output></div>
    <button className="playblast-export" disabled={disabled||!supported} onClick={()=>onExport(settings)}><IconMovie size={21}/>Esporta clip</button>
    <span className="interaction-hint">{reason||(!supported?'Registrazione non disponibile in questo browser':'Solo render · in tempo reale. Gli FPS effettivi dipendono dal dispositivo.')}</span>
    <span className="interaction-hint">Il video reinquadra il prodotto nel formato scelto e avvia il movimento dall’inizio.</span>
  </div>;
}
