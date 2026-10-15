import { IconMovie } from '@tabler/icons-react';
import { Choices,Knob,KnobGrid } from './Controls.jsx';
export function PlayblastControls({disabled,onExport,supported,settings,setSettings}) {
  const field=(key,value)=>setSettings(s=>({...s,[key]:value}));
  return <div className="playblast-controls">
    <Choices label="Formato" value={settings.aspect} options={['16:9','9:16','1:1'].map(value=>({value,label:value,disabled}))} onChange={v=>field('aspect',v)}/>
    <Choices label="Output" value={settings.size} options={[720,1080].map(value=>({value,label:`${value}p`,disabled}))} onChange={v=>field('size',v)}/>
    <Choices label="FPS" value={settings.fps} options={[24,30,60].map(value=>({value,label:`${value}`,disabled}))} onChange={v=>field('fps',v)}/>
    <KnobGrid><Knob label="Durata" min={2} max={20} step={1} value={settings.duration} format={v=>`${v}s`} onChange={v=>field('duration',v)} disabled={disabled}/></KnobGrid>
    <button className="playblast-export" disabled={disabled||!supported} onClick={()=>onExport(settings)}><IconMovie size={21}/>Esporta clip</button>
    <span className="interaction-hint">{supported?'Solo render · in tempo reale · MP4 / WebM':'Registrazione non disponibile in questo browser'}</span>
  </div>;
}
