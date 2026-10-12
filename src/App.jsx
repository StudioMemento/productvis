import { useState, useEffect, useRef, useCallback } from 'react';
import { IconCube, IconMountain, IconSun, IconCamera, IconRotate360, IconSettings, IconArrowBackUp, IconChevronDown, IconX, IconDice5, IconSparkles, IconFocus2, IconPlayerPlay, IconPlayerPause, IconRotateClockwise, IconRotate, IconInfinity, IconDeviceFloppy, IconFolderOpen, IconPhotoDown, IconMaximize, IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand, IconUpload, IconCheck, IconPalette, IconRefresh, IconInfoCircle, IconAlertCircle } from '@tabler/icons-react';
import { CompositionSymbol } from './PresetSymbol.jsx';
import { Tool, Knob, Toggle, Choices, Presets, Category } from './Controls.jsx';
import { CategoryPager } from './CategoryPager.jsx';
import { MaterialPicker } from './MaterialPicker.jsx';
import { DeltaControl } from './DeltaControl.jsx';
import { randomizePresentation } from './presentation.js';
import { DEFAULT_STATE, TABS, SWATCHES, clone, applyPreset, validateProject, makeProject } from './state.js';
const fixed = n => Number(n ?? 0).toFixed(2);
const fileBase64 = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
const download = (blob, name) => { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000); };

export function App() {
  const [engineReady, setEngineReady] = useState(false);
  const enginePromise = useRef(null);
  const [state, setState] = useState(() => clone(DEFAULT_STATE));
  const [presentation, setPresentation] = useState(false), [activeCategory, setActiveCategory] = useState('product');
  const [status, setStatus] = useState('loading'), [progress, setProgress] = useState(0), [loadingModel, setLoadingModel] = useState(true);
  const [materials, setMaterials] = useState([]), [modelName, setModelName] = useState('Honda NSX · Demo');
  const [toast, setToast] = useState(null), [historyCount, setHistoryCount] = useState(0);
  const [modelMenu, setModelMenu] = useState(false), [focusPick, setFocusPick] = useState(false), [error, setError] = useState('');
  const [showCredits, setShowCredits] = useState(false), [draggingFile, setDraggingFile] = useState(false);
  const [randomCount, setRandomCount] = useState(0);
  const canvas = useRef(null), engine = useRef(null), stateRef = useRef(state);
  const history = useRef([]), groupRef = useRef(null), toastTimeout = useRef(null), modelRef = useRef({ type: 'demo', name: 'Honda NSX' });
  const fileInput = useRef(null), projectInput = useRef(null), workspace = useRef(null), visibilityButton = useRef(null);
  stateRef.current = state;
  const notify = useCallback((message, bad = false) => { clearTimeout(toastTimeout.current); setToast({ message, bad }); toastTimeout.current = setTimeout(() => setToast(null), bad ? 5000 : 2400); }, []);
  const change = useCallback((updater, group = null, record = true) => {
    const prev = stateRef.current, next = typeof updater === 'function' ? updater(prev) : updater;
    if (record && (group == null || groupRef.current?.key !== group || Date.now() - groupRef.current.time > 900)) { history.current.push(clone(prev)); if (history.current.length > 40) history.current.shift(); setHistoryCount(history.current.length); }
    groupRef.current = { key: group, time: Date.now() }; stateRef.current = next; setState(next);
  }, []);
  const field = (category, key, value) => change(s => ({ ...s, [category]: { ...s[category], [key]: value } }), `${category}.${key}`);
  const materialField = (key, value) => change(s => ({ ...s, materials: { ...s.materials, [s.selectedMaterial]: { ...s.materials[s.selectedMaterial], [key]: value } } }), `material.${key}`);
  const undo = useCallback(() => { const prev = history.current.pop(); if (!prev) return; stateRef.current = prev; setState(prev); setHistoryCount(history.current.length); groupRef.current = null; notify('Ultima modifica annullata'); }, [notify]);
  const selectCategory = useCallback(id => { if (TABS.includes(id)) { setActiveCategory(id); setModelMenu(false); setFocusPick(false); engine.current?.setFocusMode(false); } }, []);
  const acceptModel = useCallback((meta, descriptor, restoreState = null) => {
    if (!meta) return;
    setMaterials(meta.materials); modelRef.current = descriptor; setModelName(descriptor.type === 'demo' ? 'Honda NSX · Demo' : descriptor.name);
    const next = restoreState ? { ...restoreState, materials: { ...meta.initial, ...restoreState.materials }, selectedMaterial: meta.materials.some(m => m.id === restoreState.selectedMaterial) ? restoreState.selectedMaterial : meta.selected } : { ...stateRef.current, materials: meta.initial, selectedMaterial: meta.selected, camera: clone(DEFAULT_STATE.camera), motion: clone(DEFAULT_STATE.motion) };
    history.current = []; setHistoryCount(0); groupRef.current = null; stateRef.current = next; setState(next); setLoadingModel(false); setError(''); engine.current?.setState(next, { immediate: true });
  }, []);
  useEffect(() => {
    let cancelled = false, instance;
    const ready = import('./engine.js').then(({ StudioEngine }) => {
      if (cancelled) return null;
      instance = new StudioEngine(canvas.current, {
      onStatus: setStatus, onLoading: setProgress, onError: message => notify(message, true),
      onSelect: id => { if (id) { change(s => ({ ...s, selectedMaterial: id }), null, false); selectCategory('product'); } },
      onManualMove: () => { if (stateRef.current.motion.playing) change(s => ({ ...s, motion: { ...s.motion, playing: false } }), null, false); },
      onCameraChange: camera => change(s => ({ ...s, camera: { ...s.camera, ...camera } }), null, false),
      onMotionEnd: () => change(s => ({ ...s, motion: { ...s.motion, playing: false } }), null, false),
      onFocus: point => { change(s => ({ ...s, camera: { ...s.camera, autoFocus: true, focusPoint: point } })); setFocusPick(false); notify('Fuoco impostato'); },
      });
      engine.current = instance; setEngineReady(true);
      return instance;
    });
    enginePromise.current = ready;
    ready.then(async value => {
      if (!value) return;
      const meta = await value.loadModel('/models/demo.glb', true);
      if (!cancelled) acceptModel(meta, { type: 'demo', name: 'Honda NSX' });
    }).catch(e => { if (!cancelled && e.name !== 'AbortError') { setError(e.message); setLoadingModel(false); } });
    return () => { cancelled = true; clearTimeout(toastTimeout.current); instance?.dispose(); engine.current = null; };
  }, [acceptModel, change, notify, selectCategory]);
  useEffect(() => { engine.current?.setState(state); }, [state, engineReady]);
  useEffect(() => { engine.current?.setTab('product'); }, [state.selectedMaterial, engineReady]);
  useEffect(() => {
    engine.current?.setPresentation(presentation);
    if (presentation) {
      setFocusPick(false); engine.current?.setFocusMode(false); setModelMenu(false); setShowCredits(false); setToast(null);
      visibilityButton.current?.focus({ preventScroll: true });
    }
  }, [presentation, engineReady]);
  useEffect(() => {
    const keyDown = e => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
      if (e.key === 'Escape') { setPresentation(false); setModelMenu(false); setShowCredits(false); setFocusPick(false); engine.current?.setFocusMode(false); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      if (/^[1-6]$/.test(e.key)) selectCategory(TABS[Number(e.key) - 1]);
      if (e.key.toLowerCase() === 'h') setPresentation(v => !v);
      if (e.key === ' ' && e.target.closest('button')) return;
      if (e.key === ' ' && stateRef.current.motion.preset !== 'still') { e.preventDefault(); change(s => ({ ...s, motion: { ...s.motion, playing: !s.motion.playing } }), null, false); }
    }; window.addEventListener('keydown', keyDown); return () => window.removeEventListener('keydown', keyDown);
  }, [change, selectCategory, undo]);

  const loadDemo = async () => { setModelMenu(false); setLoadingModel(true); setProgress(0); setError(''); try { const instance = await enginePromise.current; if (!instance || instance.disposed) return; const meta = await instance.loadModel('/models/demo.glb', true); if (!meta) return; acceptModel(meta, { type: 'demo', name: 'Honda NSX' }); notify('Modello demo caricato'); } catch (e) { if (e.name !== 'AbortError') { setError(e.message); setLoadingModel(false); } } };
  const importModel = async file => {
    if (!file) return; if (!/\.glb$/i.test(file.name)) { notify('Scegli un modello in formato GLB.', true); return; }
    if (file.size > 120 * 1024 * 1024) { notify('Per questa anteprima usa un GLB fino a 120 MB.', true); return; }
    setLoadingModel(true); setProgress(0); setModelMenu(false); setError('');
    try { const buffer = await file.arrayBuffer(); const instance = await enginePromise.current; if (!instance || instance.disposed) return; const meta = await instance.loadModel(buffer, false); if (!meta) return; acceptModel(meta, { type: 'embedded', name: file.name.replace(/\.glb$/i, ''), buffer }); notify('Il tuo prodotto è pronto'); selectCategory('product'); } catch (e) { if (e.name !== 'AbortError') { setError(e.message); setLoadingModel(false); } }
    if (fileInput.current) fileInput.current.value = '';
  };
  const saveProject = async () => {
    try { const model = modelRef.current.type === 'demo' ? modelRef.current : { type: 'embedded', name: modelRef.current.name, data: await fileBase64(new Blob([modelRef.current.buffer], { type: 'model/gltf-binary' })) }; download(new Blob([JSON.stringify(makeProject(stateRef.current, model))], { type: 'application/json' }), `${state.name.replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'ProductVis'}.pvis`); notify('Download avviato'); } catch { notify('Non è stato possibile salvare il progetto.', true); }
  };
  const openProject = async file => {
    if (!file) return;
    try {
      if (file.size > 180 * 1024 * 1024) throw new Error('Il progetto supera il limite di questa anteprima.');
      const parsed = validateProject(JSON.parse(await file.text())); setLoadingModel(true); setProgress(0); let buffer;
      if (parsed.model.type === 'embedded') { const str = atob(parsed.model.data.split(',')[1]), bytes = new Uint8Array(str.length); for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i); buffer = bytes.buffer; }
      const instance = await enginePromise.current; if (!instance || instance.disposed) return;
      const meta = await instance.loadModel(buffer || '/models/demo.glb', !buffer); if (!meta) return; acceptModel(meta, buffer ? { type: 'embedded', name: parsed.model.name, buffer } : { type: 'demo', name: 'Honda NSX' }, parsed.state); notify('Progetto aperto');
    } catch (e) { if (e.name === 'AbortError') return; setLoadingModel(false); notify(e instanceof SyntaxError ? 'Questo file non è un progetto ProductVis.' : e.message, true); }
    if (projectInput.current) projectInput.current.value = '';
  };
  const exportImage = async () => { try { const blob = await engine.current.capture(); download(blob, `${state.name || 'ProductVis'}.png`); notify('Immagine esportata'); } catch (e) { notify(e.message, true); } };
  const choosePreset = (category, id) => { const original = materials.find(m => m.id === stateRef.current.selectedMaterial)?.original; change(s => applyPreset(s, category, id, original)); };
  const selectedMaterial = materials.find(m => m.id === state.selectedMaterial);
  const mat = state.materials[state.selectedMaterial] || { color: '#424752', overlay: 0, roughness: .32, metalness: .65, clearcoat: .2, opacity: 1, normalScale: 1, finish: 'original' };
  const gpu = status === 'ready', canUse = materials.length > 0 && !loadingModel;
  const randomize = () => {
    if (!canUse || stateRef.current.randomDelta === 0) return;
    change(s => randomizePresentation(s, materials));
    setFocusPick(false); engine.current?.setFocusMode(false); setModelMenu(false);
    setRandomCount(count => count + 1);
    if (!gpu) notify('Setup variato · anteprima statica');
  };
  const startGesture = () => { groupRef.current = null; };
  const knob = (category, key, label, props = {}) => <Knob label={label} value={state[category][key]} onChange={v => field(category, key, v)} disabled={!canUse} onStart={startGesture} {...props} />;
  const materialKnob = (key, label, props = {}) => <Knob label={label} value={mat[key] ?? 0} onChange={v => materialField(key, v)} disabled={!canUse} onStart={startGesture} {...props} />;
  const presets = category => <Presets category={category} selected={category === 'product' ? mat.finish : state[category].preset} onChoose={id => choosePreset(category, id)} disabled={!canUse} />;
  const setColor = color => change(s => ({ ...s, materials: { ...s.materials, [s.selectedMaterial]: { ...s.materials[s.selectedMaterial], color, overlay: Math.max(.65, mat.overlay) } } }), 'material.color');
  useEffect(() => {
    const panel = workspace.current;
    const update = () => { const box = panel.getBoundingClientRect(); engine.current?.setWorkspace((window.innerWidth >= 900 || (window.innerWidth >= 600 && window.innerHeight <= 550)) ? { right: window.innerWidth - box.left + 24, bottom: 0 } : { right: 0, bottom: window.innerHeight - box.top + 16 }); };
    const observer = new ResizeObserver(update); observer.observe(panel); window.addEventListener('resize', update); update();
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [engineReady]);

  return <main className={`studio ${presentation ? 'is-presenting' : ''} ${status === 'fallback' ? 'is-fallback' : ''}`}
    onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDraggingFile(true); } }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDraggingFile(false); }} onDrop={e => { e.preventDefault(); setDraggingFile(false); const file = e.dataTransfer.files[0]; if (/\.(pvis|json)$/i.test(file?.name || '')) openProject(file); else importModel(file); }}>
    <div className="viewport">{status === 'fallback' && <picture className="fallback-render"><source media="(max-width: 899px)" srcSet="/assets/studio-fallback-mobile.webp" /><img src="/assets/studio-fallback.webp" decoding="async" alt="Riferimento statico del prodotto; non rappresenta la scena 3D corrente" /></picture>}<canvas ref={canvas} aria-label="Prodotto 3D. Trascina per orbitare, pizzica per avvicinare, tocca una superficie per selezionarla." /></div><div className="ui-scrim" aria-hidden="true" />
    <header className="topbar">
      <span className="wordmark" aria-hidden={presentation}>Product<span>vis</span><i /></span>
      <div className="random-tools" id="productvis-random" inert={presentation ? true : undefined} aria-hidden={presentation}>
        <Tool label="Annulla" className="undo-control" onClick={undo} disabled={!historyCount}><IconArrowBackUp size={18} /></Tool>
        <Tool label="Random · nuova variante" title={state.randomDelta === 0 ? 'Aumenta il delta per creare una variante' : `Nuova variante · Δ ${state.randomDelta}%`} className="random-control" onClick={randomize} disabled={!canUse || state.randomDelta === 0}><IconSparkles key={randomCount} size={23} className={randomCount ? 'sparkle-burst' : undefined} /></Tool>
        <DeltaControl value={state.randomDelta} onChange={value => change(s => ({ ...s, randomDelta: value }), null, false)} disabled={!canUse} />
      </div>
      <Tool ref={visibilityButton} label={presentation ? 'Mostra UI' : 'Nascondi UI'} title={presentation ? 'Mostra UI · H' : 'Nascondi UI · H'} className={`visibility-toggle ${presentation ? 'ui-hidden' : ''}`} aria-controls="productvis-controls productvis-random" aria-expanded={!presentation} onClick={() => setPresentation(v => !v)}>{presentation ? <IconLayoutSidebarRightExpand size={21} /> : <IconLayoutSidebarRightCollapse size={21} />}<span>UI</span></Tool>
    </header>
    {status === 'fallback' && <div className="gpu-note" role="status"><IconInfoCircle size={15} /><span>Riferimento statico · WebGL non disponibile</span><Tool label="Riprova il 3D" onClick={() => window.location.reload()}><IconRefresh size={15} /></Tool></div>}
    {focusPick && <div className="focus-hint"><IconFocus2 size={17} />Tocca il punto di fuoco<Tool label="Annulla fuoco" onClick={() => { setFocusPick(false); engine.current?.setFocusMode(false); }}><IconX size={17} /></Tool></div>}
    {loadingModel && <div className="loading-state" role="status"><IconCube size={26} stroke={1.2} /><span>Carico il prodotto</span><progress max="100" value={progress} /><small>{progress}%</small></div>}
    {error && <div className="error-state" role="alert"><IconAlertCircle size={24} /><p>{error}</p><button onClick={loadDemo}>Ricarica demo</button><button onClick={() => setError('')}>Chiudi</button></div>}

    <aside className="control-column" id="productvis-controls" ref={workspace} aria-label="Controlli ProductVis" aria-hidden={presentation} inert={presentation ? true : undefined}>
      <CategoryPager active={activeCategory} onChange={selectCategory}>
      <Category id="product" title="Prodotto" icon={IconCube} action={<Tool label="Cambia modello" onClick={() => setModelMenu(v => !v)} aria-expanded={modelMenu}><IconUpload size={18} /></Tool>}>
        {modelMenu && <div className="inline-actions"><button onClick={() => fileInput.current.click()}><IconUpload size={17} />Importa GLB</button><button onClick={loadDemo}><IconCube size={17} />Demo NSX</button></div>}
        <MaterialPicker materials={materials} selectedId={state.selectedMaterial} disabled={!canUse} onSelect={id => change(s => ({ ...s, selectedMaterial: id }), null, false)} />
        {presets('product')}
        <div className="color-swatches" role="group" aria-label="Colore superficie">{SWATCHES.map(s => <button key={s.color} className={`swatch ${mat.color === s.color ? 'selected' : ''}`} style={{ '--swatch': s.color }} aria-label={s.name} aria-pressed={mat.color === s.color} disabled={!canUse} onClick={() => setColor(s.color)} />)}<label className="color-picker" title="Colore personalizzato"><IconPalette size={20} /><input type="color" aria-label="Colore personalizzato" value={mat.color} disabled={!canUse} onChange={e => setColor(e.target.value)} /></label></div>
        <div className="knob-grid">{materialKnob('overlay', 'Colore')}{materialKnob('roughness', 'Rugosità')}{materialKnob('metalness', 'Metallo')}{materialKnob('clearcoat', 'Vernice')}{materialKnob('opacity', 'Opacità')}{materialKnob('normalScale', 'Rilievo', { max: 2, disabled: !canUse || !selectedMaterial?.hasNormalMap, format: v => `${v.toFixed(1)}×` })}</div>
        <label className="select-row"><span>Mappatura</span><select aria-label="Mappatura texture" value={mat.uvChannel ?? 0} disabled={!selectedMaterial?.hasTexture || !canUse} onChange={e => materialField('uvChannel', Number(e.target.value))}>{(selectedMaterial?.uvChannels?.length ? selectedMaterial.uvChannels : [0]).map(n => <option key={n} value={n}>UV {n + 1}</option>)}</select></label>
      </Category>

      <Category id="scene" title="Scena" icon={IconMountain} action={state.scene.preset === 'cubes' && <Tool label="Varia composizione" disabled={!canUse} onClick={() => field('scene', 'seed', Math.floor(Math.random() * 9999))}><IconDice5 size={19} /></Tool>}>
        {presets('scene')}
        {state.scene.preset === 'cubes' && <Choices label="Composizione" value={state.scene.composition} options={[0, 1, 2].map(n => ({ value: n, ariaLabel: `Composizione ${['A','B','C'][n]}`, label: <><CompositionSymbol index={n} /><span>{['A','B','C'][n]}</span></> }))} onChange={v => field('scene', 'composition', v)} />}
        {state.scene.preset === 'ring' && <div className="color-swatches" role="group" aria-label="Colore ring">{['#ffb020', '#e6eeff', '#799fff', '#ff887c'].map(color => <button key={color} aria-label={`Ring ${color}`} aria-pressed={state.scene.ringColor === color} className={`swatch ${state.scene.ringColor === color ? 'selected' : ''}`} style={{ '--swatch': color }} onClick={() => field('scene', 'ringColor', color)} />)}</div>}
        <div className="knob-grid">
          {state.scene.preset === 'cubes' && knob('scene', 'scale', 'Volumi', { min: .55, max: 1.5, step: .05, format: v => `${v.toFixed(2)}×` })}
          {state.scene.preset !== 'void' && <>{knob('scene', 'fog', 'Atmosfera')}{knob('scene', 'reflection', 'Riflesso', { max: .8 })}{knob('scene', 'floorRoughness', 'Superficie')}</>}
          {['cubes','cinema','particles'].includes(state.scene.preset) && knob('scene', 'particles', 'Particelle')}
        </div>
      </Category>

      <Category id="lighting" title="Luci" icon={IconSun}>
        {presets('lighting')}
        <Choices label="Tinta" value={state.lighting.tint} options={[{ value: 'neutral', label: 'Neutra' }, { value: 'warm', label: 'Calda' }, { value: 'cool', label: 'Fredda' }]} onChange={v => field('lighting', 'tint', v)} />
        <div className="knob-grid">{knob('lighting','intensity','Intensità',{max:2})}{knob('lighting','rotation','Direzione',{min:-180,max:180,step:1,format:v=>`${Math.round(v)}°`})}{knob('lighting','temperature','Temperatura',{min:2000,max:9000,step:100,format:v=>`${Math.round(v)}K`})}{knob('lighting','softness','Morbidezza',{max:100,step:1,format:v=>`${Math.round(v)}%`})}{knob('lighting','key','Principale',{max:10,step:.1,format:fixed})}{knob('lighting','fill','Fill',{max:10,step:.1,format:fixed})}{knob('lighting','rim','Rim',{max:10,step:.1,format:fixed})}</div>
      </Category>

      <Category id="camera" title="Camera" icon={IconCamera} action={<Tool label="Tocca il punto di fuoco" disabled={!gpu} aria-pressed={focusPick} className={focusPick ? 'selected' : ''} onClick={() => { const next = !focusPick; setFocusPick(next); engine.current?.setFocusMode(next); }}><IconFocus2 size={19} /></Tool>}>
        {presets('camera')}
        <Choices label="Lente" value={state.camera.focal} options={[24,35,50,85,120].map(value=>({value,label:`${value}`,ariaLabel:`Focale ${value} millimetri`}))} onChange={v=>field('camera','focal',v)} />
        <div className="knob-grid">{knob('camera','focal','Focale',{min:18,max:150,step:1,format:v=>`${Math.round(v)}mm`})}{knob('camera','aperture','Apertura',{min:1.4,max:16,step:.2,format:v=>`ƒ/${v.toFixed(1)}`})}{knob('camera','exposure','Esposizione',{min:-2,max:2,step:.1,format:v=>`${v>0?'+':''}${v.toFixed(1)}`})}{knob('camera','azimuth','Angolo',{min:-180,max:180,step:1,format:v=>`${Math.round(v)}°`})}{knob('camera','elevation','Altezza',{min:1,max:85,step:1,format:v=>`${Math.round(v)}°`})}{knob('camera','distance','Distanza',{min:.25,max:2.5,step:.01,format:v=>`${v.toFixed(2)}×`})}{knob('camera','focus','Fuoco',{min:.2,max:30,step:.1,format:fixed,disabled:!canUse || state.camera.autoFocus})}</div>
        <Toggle label="Fuoco auto" checked={state.camera.autoFocus} icon={IconFocus2} disabled={!canUse} onChange={v=>field('camera','autoFocus',v)} />
      </Category>

      <Category id="motion" title="Movimento" icon={IconRotate360}>
        {presets('motion')}
        <div className="motion-actions"><Tool label={state.motion.playing ? 'Pausa' : 'Riproduci'} className="play-control" disabled={!canUse || state.motion.preset==='still'} onClick={()=>field('motion','playing',!state.motion.playing)}>{state.motion.playing ? <IconPlayerPause size={20} /> : <IconPlayerPlay size={20} />}</Tool><Choices label="Verso" value={state.motion.direction} options={[{value:1,label:state.motion.preset==='dolly'?<IconChevronDown size={20} style={{transform:'rotate(180deg)'}}/>:<IconRotateClockwise size={20}/>,ariaLabel:state.motion.preset==='dolly'?'Avvicina':'Orario'},{value:-1,label:state.motion.preset==='dolly'?<IconChevronDown size={20}/>:<IconRotate size={20}/>,ariaLabel:state.motion.preset==='dolly'?'Allontana':'Antiorario'}]} onChange={v=>field('motion','direction',v)}/><Toggle label="Loop" checked={state.motion.loop} icon={IconInfinity} onChange={v=>field('motion','loop',v)} disabled={state.motion.preset==='still'}/></div>
        <div className="knob-grid">{knob('motion','speed','Velocità',{min:.25,max:3,step:.05,format:v=>`${v.toFixed(2)}×`,disabled:!canUse || state.motion.preset==='still'})}{state.motion.preset==='dolly' ? knob('motion','travel','Corsa',{min:.05,max:.6,step:.05}) : knob('motion','amplitude','Ampiezza',{min:15,max:360,step:5,format:v=>`${Math.round(v)}°`,disabled:!canUse || state.motion.preset==='still'})}</div>
        {state.motion.preset==='turntable' && <Choices label="Asse" value={state.motion.axis} options={['x','y','z'].map(value=>({value,label:value.toUpperCase()}))} onChange={v=>field('motion','axis',v)}/>}
      </Category>

      <Category id="project" title="Progetto" icon={IconSettings}>
        <input className="project-name" aria-label="Nome progetto" value={state.name} maxLength={80} onChange={e=>change(s=>({...s,name:e.target.value}),'name')}/>
        <div className="project-actions"><button onClick={saveProject} disabled={!canUse}><IconDeviceFloppy size={19}/>Salva</button><button onClick={()=>projectInput.current.click()}><IconFolderOpen size={19}/>Apri</button><button onClick={exportImage} disabled={!gpu || !canUse} title={!gpu?'Richiede WebGL':undefined}><IconPhotoDown size={19}/>PNG</button><button onClick={()=>setPresentation(true)}><IconMaximize size={19}/>Presenta</button></div>
        <Choices label="Qualità" value={state.quality} options={[{value:'auto',label:'Auto'},{value:'fluid',label:'Fluida'},{value:'high',label:'Alta'}]} onChange={v=>change(s=>({...s,quality:v}))}/>
        <button className="credits-link" onClick={()=>setShowCredits(true)}><IconInfoCircle size={14}/>Crediti demo</button>
      </Category>
      </CategoryPager>
    </aside>
    {toast && <div className={`toast ${toast.bad ? 'bad' : ''}`} role="status">{toast.bad ? <IconAlertCircle size={18}/> : <IconCheck size={18}/>}<span>{toast.message}</span></div>}
    {draggingFile && <div className="file-drop"><IconUpload size={36}/><span>Rilascia GLB o progetto</span></div>}
    {showCredits && <div className="credits-backdrop" onClick={()=>setShowCredits(false)}><section className="credits" role="dialog" aria-modal="true" aria-label="Crediti modello" onClick={e=>e.stopPropagation()}><Tool label="Chiudi crediti" onClick={()=>setShowCredits(false)}><IconX size={20}/></Tool><h2>Honda NSX · Demo</h2><p>2015 Rocket Bunny Racing Honda NSX</p><a href="https://sketchfab.com/ddiaz-design" target="_blank" rel="noreferrer">Ddiaz Design</a><a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a><small>{modelName} · {materials.length} superfici</small></section></div>}
    <input ref={fileInput} type="file" accept=".glb,model/gltf-binary" hidden onChange={e=>importModel(e.target.files[0])}/><input ref={projectInput} type="file" accept=".pvis,.json,application/json" hidden onChange={e=>openProject(e.target.files[0])}/>
  </main>;
}
