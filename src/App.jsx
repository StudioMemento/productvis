import { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import { IconCube, IconMountain, IconSun, IconCamera, IconRotate360, IconArrowBackUp, IconChevronDown, IconX, IconFocus2, IconDeviceFloppy, IconFolderOpen, IconPhotoDown, IconMaximize, IconDeviceDesktop, IconScanCube, IconUpload, IconCheck, IconRefresh, IconInfoCircle, IconAlertCircle } from '@tabler/icons-react';
import { SceneControls, LightingControls, CameraControls, MotionControls } from './CreativeControls.jsx';
import { SurfacePolicyControls } from './SurfacePolicyControls.jsx';
import { TechnicalPanel } from './TechnicalPanel.jsx';
import { PlayblastControls } from './PlayblastControls.jsx';
import { varyShot } from './shotVariation.js';
import { Tool, Knob, Presets, Category } from './Controls.jsx';
import { CategoryPager } from './CategoryPager.jsx';
import { MaterialPicker } from './MaterialPicker.jsx';
import { PresentationToolbar } from './PresentationToolbar.jsx';
import { InspectorControls, PostControls, RenderControls } from './LookControls.jsx';
import { MeshEditor } from './MeshEditor.jsx';
import { ModelControls } from './ModelControls.jsx';
import { DEFAULT_TRANSFORM } from './modelTransform.js';
import { CategoryNavigation } from './CategoryNavigation.jsx';
import { ProgressiveBlur } from './ProgressiveBlur.jsx';
import { workspaceInsets } from './workspaceLayout.js';
import { randomizePresentation } from './presentation.js';
import { DEFAULT_STATE, TABS, clone, applyPreset, validateProject, makeProject } from './state.js';
import { workspaceMenu, INITIAL_MENU, TECHNICAL_MENUS } from './workspaceMenu.js';
import { AnimationControls } from './AnimationControls.jsx';
const fileBase64 = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
const download = (blob, name) => { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000); };

export function App() {
  const [menu,dispatchMenu]=useReducer(workspaceMenu,INITIAL_MENU),[recording,setRecording]=useState(null);
  const activeCategory=menu.category,technical=TECHNICAL_MENUS.includes(menu.open)?menu.open:null,panelOpen=TABS.includes(menu.open);
  const closeMenu=useCallback(()=>dispatchMenu({type:'close'}),[]);
  const [animationClips,setAnimationClips]=useState([]),[animationCursor,setAnimationCursor]=useState(0);
  const recordingRef=useRef(false),recordAbort=useRef(null);recordingRef.current=recording!==null;
  const [dockExpanded, setDockExpanded] = useState(false), [hoverTarget, setHoverTarget] = useState(null);
  const [capabilities, setCapabilities] = useState({ samples: [] }), [stats, setStats] = useState(null);
  const contextRef = useRef({});
  const hoverMarker = useRef(null);
  const [engineReady, setEngineReady] = useState(false);
  const enginePromise = useRef(null);
  const [state, setState] = useState(() => clone(DEFAULT_STATE));
  const [presentation, setPresentation] = useState(false);
  const [status, setStatus] = useState('loading'), [progress, setProgress] = useState(0), [loadingModel, setLoadingModel] = useState(true);
  const [materials, setMaterials] = useState([]), [modelName, setModelName] = useState('Honda NSX · Demo');
  const [toast, setToast] = useState(null), [historyCount, setHistoryCount] = useState(0);
  const [focusPick, setFocusPick] = useState(false), [error, setError] = useState('');
  const [showCredits, setShowCredits] = useState(false), [draggingFile, setDraggingFile] = useState(false);
  const [randomCount, setRandomCount] = useState(0);
  const canvas = useRef(null), engine = useRef(null), stateRef = useRef(state);
  const history = useRef([]), groupRef = useRef(null), toastTimeout = useRef(null), modelRef = useRef({ type: 'demo', name: 'Honda NSX' });
  const fileInput = useRef(null), projectInput = useRef(null), workspace = useRef(null), visibilityButton = useRef(null);
  stateRef.current = state;
  const dismissMenu=()=>{workspace.current?.querySelector('[aria-expanded="true"][aria-controls]')?.focus({preventScroll:true});closeMenu();};
  const notify = useCallback((message, bad = false) => { clearTimeout(toastTimeout.current); setToast({ message, bad }); toastTimeout.current = setTimeout(() => setToast(null), bad ? 5000 : 2400); }, []);
  const change = useCallback((updater, group = null, record = true) => {
    if(recordingRef.current)return;
    const prev = stateRef.current, next = typeof updater === 'function' ? updater(prev) : updater;
    if (record && (group == null || groupRef.current?.key !== group || Date.now() - groupRef.current.time > 900)) { history.current.push(clone(prev)); if (history.current.length > 40) history.current.shift(); setHistoryCount(history.current.length); }
    groupRef.current = { key: group, time: Date.now() }; stateRef.current = next; setState(next);
  }, []);
  const field = (category, key, value) => change(s => ({ ...s, [category]: { ...s[category], [key]: value, ...(category==='camera'&&['distance','focal'].includes(key)?{orbitRadius:null}:{}), ...(category==='motion'&&key==='cursor'?{playing:false}:{}) }, ...(category==='camera'&&['azimuth','elevation','distance','focal'].includes(key)?{motion:{...s.motion,playing:false}}:{}),...(category==='camera'&&key==='bokeh'?{post:{...s.post,enabled:true,dof:value>0}}:{}) }), `${category}.${key}`);
  const patchMaterial = (id, patch) => change(s => {
    const current = s.materials[id] || {};
    const alpha = patch.opacity < 1 && (current.alphaMode || 'opaque') === 'opaque' ? { alphaMode:'blend' } : {};
    return { ...s, selectedMaterial:id, materials:{ ...s.materials, [id]:{ ...current, ...alpha, ...patch } } };
  }, `material.${id}.${Object.keys(patch).join('.')}`);
  const closeShader = useCallback(() => setHoverTarget(null), []);
  const undo = useCallback(() => { const prev = history.current.pop(); if (!prev) return; stateRef.current = prev; setState(prev); setHistoryCount(history.current.length); groupRef.current = null; notify('Ultima modifica annullata'); }, [notify]);
  const selectCategory = useCallback(id => { if(recordingRef.current)return;if (TABS.includes(id)) { dispatchMenu({type:'open',id});setPresentation(false); setHoverTarget(null); setFocusPick(false); engine.current?.setFocusMode(false); } }, []);
  const toggleCategory=id=>{if(!recordingRef.current){dispatchMenu({type:'toggle',id});setFocusPick(false);engine.current?.setFocusMode(false);}};
  const acceptModel = useCallback((meta, descriptor, restoreState = null) => {
    if (!meta) return;
    setHoverTarget(null);
    setAnimationClips(meta.animations||[]);setAnimationCursor(restoreState?.animation?.cursor||0);
    setMaterials(meta.materials); modelRef.current = descriptor; setModelName(descriptor.type === 'demo' ? 'Honda NSX · Demo' : descriptor.name);
    const next = restoreState ? { ...restoreState, materials: { ...meta.initial, ...restoreState.materials }, selectedMaterial: meta.materials.some(m => m.id === restoreState.selectedMaterial) ? restoreState.selectedMaterial : meta.selected } : { ...stateRef.current, materials: meta.initial, selectedMaterial: meta.selected, camera: clone(DEFAULT_STATE.camera), motion: clone(DEFAULT_STATE.motion), animation:clone(DEFAULT_STATE.animation), transform: { ...DEFAULT_TRANSFORM } };
    next.animation={...next.animation,clip:Math.min(next.animation.clip,Math.max(0,(meta.animations?.length||0)-1)),playing:!!meta.animations?.length&&next.animation.playing};
    history.current = []; setHistoryCount(0); groupRef.current = null; stateRef.current = next; setState(next); setLoadingModel(false); setError(''); engine.current?.setState(next, { immediate: true });
  }, []);
  useEffect(() => {
    let cancelled = false, instance;
    const ready = import('./engine.js').then(({ StudioEngine }) => {
      if (cancelled) return null;
      instance = new StudioEngine(canvas.current, {
      onStatus: setStatus, onLoading: setProgress, onError: message => notify(message, true),
      onCapabilities: setCapabilities, onStats: setStats, onHover: target => contextRef.current.hover?.(target),
      onPointerPosition: (x,y) => { if (hoverMarker.current) hoverMarker.current.style.transform = `translate3d(${x}px,${y}px,0)`; },
      onEmpty: ()=>contextRef.current.empty?.(),
      onSelect: (id,target) => { if (id && !recordingRef.current) {
        change(s => { const material=s.materials[id]||{}, uvChannel=target.uvChannels.includes(material.uvChannel)?material.uvChannel:target.uvChannel;
          return {...s,selectedMaterial:id,materials:{...s.materials,[id]:{...material,uvChannel}},inspection:{...s.inspection,view:'pbr'}};
        }, null, false);
        selectCategory('product'); setHoverTarget(null);
        requestAnimationFrame(()=>workspace.current?.querySelector('#controls-product')?.scrollTo({top:0,behavior:'instant'}));
      } },
      onManualMove: () => { setHoverTarget(null); if (stateRef.current.motion.playing) change(s => ({ ...s, motion: { ...s.motion, playing: false } }), null, false); },
      onCameraChange: camera => change(s => ({ ...s, camera: { ...s.camera, ...camera } }), null, false),
      onMotionEnd: () => change(s => ({ ...s, motion: { ...s.motion, playing: false } }), null, false),
      onAnimationTime:setAnimationCursor,
      onAnimationEnd:cursor=>{setAnimationCursor(cursor);change(s=>({...s,animation:{...s.animation,playing:false,cursor}}),null,false);},
      onFocus: (point,radius,orientation) => { change(s => ({ ...s, camera: { ...s.camera,...orientation, autoFocus:true, focusPoint:point,targetPoint:point,orbitRadius:radius },motion:{...s.motion,playing:false},post:{...s.post,enabled:true,dof:true} }));setFocusPick(false); },
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
    return () => {recordAbort.current?.abort(); cancelled = true; clearTimeout(toastTimeout.current); instance?.dispose(); engine.current = null; };
  }, [acceptModel, change, notify, selectCategory]);
  useEffect(() => { engine.current?.setState(state); }, [state, engineReady]);
  useEffect(() => { engine.current?.setTab(presentation||!panelOpen||technical?'':activeCategory); }, [activeCategory, engineReady,presentation,panelOpen,technical]);
  useEffect(() => {
    engine.current?.setPresentation(presentation);
    if (presentation) {
      closeMenu();closeShader(); setFocusPick(false); engine.current?.setFocusMode(false); setShowCredits(false); setToast(null);
      visibilityButton.current?.focus({ preventScroll: true });
    }
  }, [presentation, engineReady, closeShader, closeMenu]);
  useEffect(() => {
    const keyDown = e => {
      if(recordingRef.current){if(e.key==='Escape')recordAbort.current?.abort();return;}
      if (e.key === 'Escape') { workspace.current?.querySelector('[aria-expanded="true"][aria-controls]')?.focus({preventScroll:true});closeMenu();closeShader(); setPresentation(false); setShowCredits(false); setFocusPick(false); engine.current?.setFocusMode(false);return; }
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      if (/^[1-5]$/.test(e.key)) selectCategory(TABS[Number(e.key) - 1]);
      if (e.key.toLowerCase() === 'h') setPresentation(v => !v);
      if (e.key === ' ' && e.target.closest('button')) return;
      if (e.key === ' ' && stateRef.current.motion.preset !== 'still') { e.preventDefault(); change(s => ({ ...s, motion: { ...s.motion, playing: !s.motion.playing } }), null, false); }
    }; window.addEventListener('keydown', keyDown); return () => window.removeEventListener('keydown', keyDown);
  }, [change, selectCategory, undo, closeShader, closeMenu]);
  useEffect(()=>{
    if(!menu.open)return;
    const outside=event=>{if(!workspace.current?.contains(event.target)&&!event.target.closest('.global-toolbar'))closeMenu();};
    document.addEventListener('pointerdown',outside);
    return ()=>document.removeEventListener('pointerdown',outside);
  },[menu.open,closeMenu]);

  const loadDemo = async () => { if(recordingRef.current)return;setLoadingModel(true); setProgress(0); setError(''); try { const instance = await enginePromise.current; if (!instance || instance.disposed) return; const meta = await instance.loadModel('/models/demo.glb', true); if (!meta) return; acceptModel(meta, { type: 'demo', name: 'Honda NSX' }); notify('Modello demo caricato'); } catch (e) { if (e.name !== 'AbortError') { setError(e.message); setLoadingModel(false); } } };
  const importModel = async file => {
    if (!file||recordingRef.current) return; if (!/\.glb$/i.test(file.name)) { notify('Scegli un modello in formato GLB.', true); return; }
    if (file.size > 120 * 1024 * 1024) { notify('Per questa anteprima usa un GLB fino a 120 MB.', true); return; }
    setLoadingModel(true); setProgress(0); setError('');
    try { const buffer = await file.arrayBuffer(); const instance = await enginePromise.current; if (!instance || instance.disposed) return; const meta = await instance.loadModel(buffer, false); if (!meta) return; acceptModel(meta, { type: 'embedded', name: file.name.replace(/\.glb$/i, ''), buffer }); notify('Il tuo prodotto è pronto'); dispatchMenu({type:'open',id:'project'}); } catch (e) { if (e.name !== 'AbortError') { setError(e.message); setLoadingModel(false); } }
    if (fileInput.current) fileInput.current.value = '';
  };
  const saveProject = async () => {
    try { const model = modelRef.current.type === 'demo' ? modelRef.current : { type: 'embedded', name: modelRef.current.name, data: await fileBase64(new Blob([modelRef.current.buffer], { type: 'model/gltf-binary' })) }; download(new Blob([JSON.stringify(makeProject({...stateRef.current,animation:{...stateRef.current.animation,cursor:engine.current?.animations?.cursor??stateRef.current.animation.cursor}}, model))], { type: 'application/json' }), `${state.name.replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'ProductVis'}.pvis`); notify('Download avviato'); } catch { notify('Non è stato possibile salvare il progetto.', true); }
  };
  const openProject = async file => {
    if (!file||recordingRef.current) return;
    try {
      if (file.size > 180 * 1024 * 1024) throw new Error('Il progetto supera il limite di questa anteprima.');
      const parsed = validateProject(JSON.parse(await file.text())); if(recordingRef.current)return;setLoadingModel(true); setProgress(0); let buffer;
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
  const gpu = status === 'ready', canUse = materials.length > 0 && !loadingModel && recording===null;
  const openTechnical=id=>{if(recordingRef.current)return;dispatchMenu({type:'toggle',id});setPresentation(false);};
  const updateAnimation=patch=>change(s=>({...s,animation:{...s.animation,...(patch.playing===false?{cursor:engine.current?.animations?.cursor??s.animation.cursor}:{}),...patch}}),'animation');
  const seekAnimation=cursor=>{updateAnimation({cursor,playing:false});setAnimationCursor(cursor);const instance=engine.current;instance?.animations?.seek(cursor*instance.animations.duration);instance?.contactShadow?.invalidate();instance?.invalidate();};
  const exportClip=async settings=>{
    if(!gpu||!canUse||recordingRef.current)return;const wasPresenting=presentation;recordingRef.current=true;recordAbort.current=new AbortController();setRecording(0);closeMenu();setPresentation(true);
    try{const result=await engine.current.captureVideo({...settings,signal:recordAbort.current.signal,onProgress:value=>setRecording(Math.round(value*100))});download(result.blob,`${stateRef.current.name||'ProductVis'}.${result.extension}`);notify('Clip esportata');}
    catch(error){if(error.name!=='AbortError')notify(error.message,true);}
    finally{recordingRef.current=false;setRecording(null);recordAbort.current=null;setPresentation(wasPresenting);}
  };
  const randomize = () => {
    if (!canUse || stateRef.current.randomDelta === 0) return;
    change(s => randomizePresentation(s, materials, { reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches }));
    setFocusPick(false); engine.current?.setFocusMode(false);
    closeShader(); setRandomCount(count => count + 1);
    if (!gpu) notify('Setup variato · anteprima statica');
  };
  const startGesture = () => { groupRef.current = null; };
  const knob = (category, key, label, props = {}) => <Knob label={label} value={state[category][key]} onChange={v => field(category, key, v)} disabled={!canUse} onStart={startGesture} {...props} />;

  const presets = category => <Presets category={category} selected={category === 'product' ? mat.finish : state[category].preset} onChoose={id => choosePreset(category, id)} disabled={!canUse} />;

  useEffect(() => {
    const panel = workspace.current;
    const update = () => {
      const box = panel.getBoundingClientRect(), viewport = canvas.current.parentElement.getBoundingClientRect();
      engine.current?.setWorkspace(workspaceInsets(viewport.width, viewport.height, {top:box.top-viewport.top,left:box.left-viewport.left}));
    };
    const observer = new ResizeObserver(update); observer.observe(panel); window.addEventListener('resize', update); update();
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [engineReady]);

  contextRef.current.empty=()=>{if(!presentation&&!recordingRef.current){closeMenu();setHoverTarget(null);}};
  contextRef.current.hover = target => {
    if (presentation) return;
    setHoverTarget(previous => !target ? null : previous?.id===target.id ? previous : target);
  };
  const contextMaterial = materials.find(m=>m.id===hoverTarget?.id);
  const transformModel = (key, value) => change(s => ({ ...s, transform: { ...s.transform, [key]: value }, motion: { ...s.motion, playing: false } }), `transform.${key}`);
  const modelAction = action => {
    if (action === 'frame') {
      if (engine.current) engine.current.cameraKey = null;
      change(s => ({ ...applyPreset(s, 'camera', 'hero'), motion: { ...s.motion, playing: false } }));
      return;
    }
    const transform = action === 'reset' ? { ...DEFAULT_TRANSFORM } : engine.current?.modelPlacementAction(action);
    if (transform) change(s => ({ ...s, transform, motion: { ...s.motion, playing: false, ...(action === 'reset' ? { preset: 'still' } : {}) } }));
  };

  return <main className={`studio ${presentation ? 'is-presenting' : ''} ${status === 'fallback' ? 'is-fallback' : ''} ${state.render.alpha && gpu ? 'is-alpha' : ''} ${dockExpanded?'dock-expanded':''} ${!panelOpen&&!technical?'is-collapsed':''} ${technical?'popup-is-open':''} ${recording!==null?'is-recording':''}`}
    onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); if(!recordingRef.current)setDraggingFile(true); } }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDraggingFile(false); }} onDrop={e => { e.preventDefault(); setDraggingFile(false); if(recordingRef.current)return;const file = e.dataTransfer.files[0]; if (/\.(pvis|json)$/i.test(file?.name || '')) openProject(file); else importModel(file); }}>
    <div className="viewport">{status === 'fallback' && <picture className="fallback-render"><source media="(max-width: 899px)" srcSet="/assets/studio-fallback-mobile.webp" /><img src="/assets/studio-fallback.webp" decoding="async" alt="Riferimento statico del prodotto; non rappresenta la scena 3D corrente" /></picture>}<canvas ref={canvas} aria-label="Prodotto 3D. Trascina per orbitare, pizzica per avvicinare, tocca una superficie per selezionarla." /></div><ProgressiveBlur className="ui-scrim"/>
    <header className="topbar">
      <img className="memento-logo" src="/assets/memento.svg" alt="Memento" width="1418" height="57"/>

    </header>
    {status === 'fallback' && <div className="gpu-note" role="status"><IconInfoCircle size={15} /><span>Riferimento statico · WebGL non disponibile</span><Tool label="Riprova il 3D" onClick={() => window.location.reload()}><IconRefresh size={15} /></Tool></div>}
    {focusPick && <div className="focus-hint"><IconFocus2 size={17} />Tocca il punto di fuoco<Tool label="Annulla fuoco" onClick={() => { setFocusPick(false); engine.current?.setFocusMode(false); }}><IconX size={17} /></Tool></div>}
    {loadingModel && <div className="loading-state" role="status"><IconCube size={26} stroke={1.2} /><span>Carico il prodotto</span><progress max="100" value={progress} /><small>{progress}%</small></div>}
    {error && <div className="error-state" role="alert"><IconAlertCircle size={24} /><p>{error}</p><button onClick={loadDemo}>Ricarica demo</button><button onClick={() => setError('')}>Chiudi</button></div>}

    <aside className="control-column" id="productvis-controls" ref={workspace} aria-label="Controlli ProductVis" aria-hidden={presentation} inert={presentation ? true : undefined}>
      <button type="button" className="dock-handle" aria-label={dockExpanded?'Riduci controlli':'Espandi controlli'} aria-expanded={dockExpanded} onClick={()=>setDockExpanded(v=>!v)}><IconChevronDown size={16} style={{transform:dockExpanded?'none':'rotate(180deg)'}}/><i/></button>
      <nav className="technical-rail" aria-label="Strumenti progetto">
        {[[IconFolderOpen,'project','Progetto'],[IconScanCube,'inspect','Ispeziona'],[IconDeviceDesktop,'render','Render']].map(([Icon,id,label])=><button type="button" key={id} id={`menu-trigger-${id}`} data-tech={id} aria-controls={`controls-${id}`} aria-expanded={technical===id} className={technical===id?'active':''} onClick={()=>openTechnical(id)}><Icon size={18} stroke={1.35}/><span>{label}</span><IconChevronDown className="menu-chevron" size={12}/></button>)}
      </nav>
      <CategoryNavigation active={activeCategory} opened={panelOpen} onChange={selectCategory} onToggle={toggleCategory}/>
      {panelOpen&&<div className="creative-pages">
      <CategoryPager active={activeCategory}>
        <Category id="product" title="Materiali" icon={IconCube} action={<Tool label="Chiudi tendina" onClick={dismissMenu}><IconX size={18}/></Tool>}>
          <MaterialPicker materials={materials} selectedId={state.selectedMaterial} disabled={!canUse} compact onSelect={id=>change(s=>({...s,selectedMaterial:id}),null,false)}/>
          <MeshEditor material={mat} metadata={selectedMaterial} onChange={patch=>patchMaterial(state.selectedMaterial,patch)} onPreset={id=>choosePreset('product',id)} onStart={startGesture} disabled={!canUse}/>
        </Category>
        <Category id="scene" title="Environment" icon={IconMountain} action={<Tool label="Chiudi tendina" onClick={dismissMenu}><IconX size={18}/></Tool>}><SceneControls state={state} field={field} knob={knob} presets={presets} disabled={!canUse} onPost={()=>openTechnical('post')} onChooseStage={id=>choosePreset('scene',id)}/></Category>
        <Category id="lighting" title="Lighting" icon={IconSun} action={<Tool label="Chiudi tendina" onClick={dismissMenu}><IconX size={18}/></Tool>}><LightingControls state={state} field={field} knob={knob} presets={presets} disabled={!canUse} onPost={()=>openTechnical('post')}/></Category>
        <Category id="camera" title="Camera" icon={IconCamera} action={<Tool label="Chiudi tendina" onClick={dismissMenu}><IconX size={18}/></Tool>}><CameraControls state={state} field={field} knob={knob} presets={presets} disabled={!canUse} onVariation={()=>change(s=>varyShot(s))} focusPick={focusPick} onFocus={()=>{setFocusPick(v=>!v);engine.current?.setFocusMode(!focusPick);}}/></Category>
        <Category id="motion" title="Movement" icon={IconRotate360} action={<Tool label="Chiudi tendina" onClick={dismissMenu}><IconX size={18}/></Tool>}><MotionControls state={state} field={field} knob={knob} presets={presets} disabled={!canUse} onRewind={()=>{field('motion','cursor',0);engine.current?.rewindMotion();}} onRender={()=>openTechnical('render')}/></Category>
      </CategoryPager>
      </div>}
      {technical&&<TechnicalPanel key={technical} id={technical} title={{post:'Post process',inspect:'Ispeziona',render:'Render',project:'Progetto'}[technical]} onClose={dismissMenu}>
        {technical==='post'&&<PostControls state={state} change={change} disabled={!canUse} onStart={startGesture}/>}
        {technical==='inspect'&&<>
          <AnimationControls clips={animationClips} animation={state.animation} cursor={animationCursor} disabled={!canUse} onChange={updateAnimation} onSeek={seekAnimation} knob={knob}/>
          <section className="inspection-motion" aria-label="Movimento scena"><span className="control-group-title">Movimento scena</span><MotionControls state={state} field={field} knob={knob} presets={presets} disabled={!canUse} onRewind={()=>{field('motion','cursor',0);engine.current?.rewindMotion();}} onRender={()=>openTechnical('render')}/></section>
          <section className="inspection-surface" aria-label="Geometria e sezioni"><span className="control-group-title">Geometria e sezioni</span><InspectorControls state={state} change={change} disabled={!canUse} onStart={startGesture}/></section>
        </>}
        {technical==='render'&&<>
          <RenderControls state={state} change={change} capabilities={capabilities} stats={stats} onStart={startGesture}/>
          <div className="project-actions render-actions"><button onClick={exportImage} disabled={!gpu||!canUse}><IconPhotoDown size={19}/>PNG</button><button onClick={()=>setPresentation(true)}><IconMaximize size={19}/>Presenta</button></div>
          <PlayblastControls disabled={!gpu||!canUse||state.render.alpha} supported={capabilities.recording} onExport={exportClip}/>
          {state.render.alpha&&<span className="interaction-hint">Video: disattiva Alpha. PNG conserva la trasparenza.</span>}
        </>}
        {technical==='project'&&<>
          <ModelControls name={modelName} transform={state.transform} disabled={!canUse} loading={loadingModel} onImport={()=>fileInput.current.click()} onDemo={loadDemo} onChange={transformModel} onAction={modelAction} onStart={startGesture}/>
          <MaterialPicker materials={materials} selectedId={state.selectedMaterial} disabled={!canUse} compact onSelect={id=>change(s=>({...s,selectedMaterial:id}),null,false)}/>
          <SurfacePolicyControls material={mat} metadata={selectedMaterial} onChange={patch=>patchMaterial(state.selectedMaterial,patch)} onStart={startGesture} disabled={!canUse}/>
          <div className="project-files"><span className="control-group-title">File</span><input className="project-name" aria-label="Nome progetto" value={state.name} maxLength={80} onChange={e=>change(s=>({...s,name:e.target.value}),'name')}/><div className="project-actions"><button onClick={saveProject} disabled={!canUse}><IconDeviceFloppy size={19}/>Salva</button><button onClick={()=>projectInput.current.click()}><IconFolderOpen size={19}/>Apri</button></div><button className="undo-project" onClick={undo} disabled={!historyCount}><IconArrowBackUp size={15}/>Annulla</button><button className="credits-link" onClick={()=>setShowCredits(true)}><IconInfoCircle size={14}/>Crediti demo</button></div>
        </>}
      </TechnicalPanel>}


    </aside>
    <PresentationToolbar presentation={presentation} onToggle={()=>setPresentation(v=>!v)} visibilityRef={visibilityButton} delta={state.randomDelta} onDelta={value=>change(s=>({...s,randomDelta:value}),null,false)} onRandom={randomize} randomCount={randomCount} disabled={!canUse} locked={recording!==null}/>
    {recording!==null&&<div className="recording-status" role="status"><span>Playblast {recording}%</span><button onClick={()=>recordAbort.current?.abort()}>Annulla</button></div>}
    {!presentation && gpu && hoverTarget && contextMaterial && <div className="mesh-hover" ref={hoverMarker} style={{transform:`translate3d(${hoverTarget.x}px,${hoverTarget.y}px,0)`}} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 21 12 12 21 3 12Z"/><path d="M12 0v6m12 6h-6M12 24v-6M0 12h6"/></svg><span>{contextMaterial.label}</span></div>}
    {state.render.stats && !presentation && gpu && <output className="performance-hud" aria-label="Monitor rendering"><b>{stats?.idle?'Idle':stats?.fps?`${stats.fps} fps`:'— fps'}</b><span>{stats?.frameMs?`${stats.frameMs.toFixed(1)} ms · `:''}{stats?.width} × {stats?.height}</span><span>MSAA {stats?.samples?`${stats.samples}×`:'Off'} · {stats?.triangles?`${Math.round(stats.triangles/1000)}k tris`:''}</span></output>}
    {toast && <div className={`toast ${toast.bad ? 'bad' : ''}`} role="status">{toast.bad ? <IconAlertCircle size={18}/> : <IconCheck size={18}/>}<span>{toast.message}</span></div>}
    {draggingFile && <div className="file-drop"><IconUpload size={36}/><span>Rilascia GLB o progetto</span></div>}
    {showCredits && <div className="credits-backdrop" onClick={()=>setShowCredits(false)}><section className="credits" role="dialog" aria-modal="true" aria-label="Crediti modello" onClick={e=>e.stopPropagation()}><Tool label="Chiudi crediti" onClick={()=>setShowCredits(false)}><IconX size={20}/></Tool><h2>Honda NSX · Demo</h2><p>2015 Rocket Bunny Racing Honda NSX</p><a href="https://sketchfab.com/ddiaz-design" target="_blank" rel="noreferrer">Ddiaz Design</a><a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a><small>{modelName} · {materials.length} superfici</small></section></div>}
    <input ref={fileInput} type="file" accept=".glb,model/gltf-binary" hidden onChange={e=>importModel(e.target.files[0])}/><input ref={projectInput} type="file" accept=".pvis,.json,application/json" hidden onChange={e=>openProject(e.target.files[0])}/>
  </main>;
}
