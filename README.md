# ProductVis · Preset Studio

<<<<<<< HEAD
Prototipo interattivo React + Three.js della direzione approvata: prodotto a tutto viewport, UI flottante, icone Phosphor, cinque assi in squircle e controlli essenziali su blur progressivo del fondale senza bordi.
=======
Prototipo interattivo React + Three.js della direzione approvata: prodotto a tutto viewport, UI flottante, simboli vettoriali liberi e controlli essenziali su blur progressivo del fondale senza bordi.
>>>>>>> 10e60a6124e91f2ebd4d0716d2ef74e1804cf295

**Stato:** build e logica verificate con test automatici. Collaudo visivo, touch, prestazioni GPU ed esportazione PNG/video su dispositivi reali ancora da completare: la sessione di sviluppo non dispone di un browser WebGL utilizzabile. Il pacchetto include la configurazione Vercel e le istruzioni in `DEPLOY_VERCEL.md`.

## Avvio

Con Node.js 22 o successivo:

```sh
npm ci
npm run dev -- --host 0.0.0.0
```

Aprire l'indirizzo indicato da Vite in un browser con WebGL 2 disponibile. I file del prodotto vengono elaborati localmente dal browser; il prototipo non richiede account o backend.

<<<<<<< HEAD
La cartella `dist/client` contiene anche la build statica. Va servita via HTTP: l'apertura diretta di `index.html` come file locale non carica correttamente moduli e modello.
=======
Dopo la compilazione, la cartella `dist/client` contiene la build statica. Va servita via HTTP: l'apertura diretta di `index.html` come file locale non carica correttamente moduli e modello.
>>>>>>> 10e60a6124e91f2ebd4d0716d2ef74e1804cf295

```sh
npm run build:vercel
npm run preview -- --host 0.0.0.0
npm test
```

## Ottimizzazioni

Il motore 3D si carica dopo la UI. La scena ferma si ridisegna solo quando necessario; movimento, particelle visibili e interazioni mantengono il rendering attivo. Cambiare finestra sospende i frame. La qualità Auto limita i pixel interni a circa 2 milioni, Fluida a 1 milione, Alta a 4 milioni.

Le immagini di riserva WebP si caricano solo quando WebGL non è disponibile. Viene montata soltanto la pagina attiva, con un’unica area di scroll locale. Il font comprende il sottoinsieme latino; altri alfabeti usano il font di sistema. Dettagli e misure in `OPTIMIZATION.md`.

## Assi, delta e controlli tattili

<<<<<<< HEAD
**MAT, ENV, LIGHT, CAM, FX** sono cinque assi indipendenti. Memento sta in alto a sinistra; fullscreen, generatore globale e strumenti tecnici in alto a destra. Un solo blocco di proprietà, con uno scroll verticale, è seguito dalla history tattile e dalla navbar. Una sola navbar sui telefoni; su desktop orizzontale da 1024 px è disponibile anche la copia nel player.

Ogni asse ha un’icona Phosphor in uno squircle: il bordo ambra indica il **delta 0–100**, senza riempire il pittogramma. Drag verticale regola il delta; tap seleziona il contesto e genera solo quell’asse; tap sul nome apre solo il contesto. Il valore compare durante la regolazione o il focus da tastiera. Sotto, lucchetto, dot/pill del pannello e reset: la pill ambra indica esclusivamente il pannello aperto.

Chevron down attiva la modalità semplificata. Solo chevron up riapre le proprietà; selezioni, generazioni, undo/redo, picking ed Escape non la sbloccano. Le due maniglie del separatore regolano la stessa dimensione: altezza sul dock inferiore, larghezza sulla colonna laterale. Il canvas continua sotto il blur reale sfumato, senza fondale colorato o bordi dei gruppi.

La **history** ha un perno centrale fisso. A sinistra le tacche degli stati precedenti, a destra eventuali stati ripristinabili; gli slot vuoti sono punti centrati. Swipe/drag a sinistra torna indietro, a destra ripete, bloccandosi al presente. Tap su una tacca seleziona lo stato; tap su uno slot vuoto non fa avanzare. Escape o annullamento del gesto ripristinano la posizione iniziale. Massimo 80 modifiche, un passo per gesto; una nuova modifica dopo Undo elimina il ramo redo.

Il delta locale parte da 100, il globale da 35. Sparkle usa `delta effettivo = delta globale × delta asse / 100` sui soli assi sbloccati. Il tap locale usa esclusivamente il delta dell’asse. Zero, tutti gli assi bloccati o nessuna superficie idonea producono un vero no-op. I lucchetti proteggono dalle generazioni; i controlli manuali rimangono disponibili. Delta e lock sono salvati nel `.pvis`, ma restano fuori dalla history.

A delta effettivo basso (<40) si rifinisce il setup corrente; da 40 si reinterpretano finiture, rig e FX nello stesso stage; da 70 ENV e CAM possono esplorare un nuovo stage e una nuova inquadratura. La generazione combina palette, rapporti key/fill/rim, ottiche e movimenti contenuti. L’esposizione appartiene a CAM; FX preserva il DOF. Cambiare ENV non reinquadra CAM né riavvia movimento o scie.

- **MAT:** superficie selezionata, colori, finiture, PBR, ottica ed emissione. Il random modifica solo una superficie opaca idonea, conservando alpha, UV e gli altri materiali.
- **ENV:** Void, Cube, Studio, Rain, Ring, Velocity Lines. Stage modulari, atmosfera, palette, composizione e flusso ambientale. I progetti legacy migrano gli stage ritirati conservando gli altri assi.
- **LIGHT:** 12 rig studio; key/fill/rim, direzione, altezza, morbidezza, temperatura, colori, ambiente e riflessi.
- **CAM:** inquadratura, ottica, esposizione, fuoco, bokeh e movimento di presentazione.
- **FX:** effetti di superficie, particelle e scie; mix, trasporto, parametri avanzati e post-produzione.

La **mesh** contiene modello, trasformazioni, superfici, facce/alpha, UV, Ispeziona e clip GLB. L’**ingranaggio** contiene rendering, qualità, MSAA, FPS, adattamento e progetto `.pvis`. Il **rec-square** contiene PNG, sfondo alpha e playblast. Le impostazioni rimangono in memoria cambiando pagina.

Ogni generazione e reset è una sola modifica annullabile. Reset cambia solo l’asse scelto, anche se bloccato, conservando delta e lucchetto. MAT ripristina il look originale della superficie; CAM ripristina ripresa e movimento; FX conserva il master Post e il DOF. Un reset senza cambiamenti non aggiunge history. Il random preserva trasformazioni, clip native, qualità, sezioni e alpha. Il movimento ridotto si applica solo agli assi generati.

Knob: drag verticale, frecce, Home/End; Shift per regolazioni fini e numero modificabile nei pannelli. Delta: drag, frecce, Page Up/Down, Home/End. Tab: tap, frecce orizzontali, Home/End. History: frecce, Page Up/Down, Home/End. Shortcut: `1–5` assi, `H` modalità semplificata, `Spazio` trasporto, `Ctrl/Cmd Z` annulla, `Ctrl/Cmd Shift Z` e `Ctrl/Cmd Y` ripeti.
=======
**MAT, ENV, LIGHT, CAM, FX** sono cinque assi indipendenti. La console è mobile first: cinque tab tipografiche sulla baseline inferiore del pannello, numero e titolo della pagina, contenuti allineati dal basso. I cinque generatori locali, ciascuno con anello delta, nome, lucchetto e reset, sono separati dalla navigazione e centrati in basso nel player. Il delta globale è centrato in alto nel player. Schermo intero, comandi semplificati e Undo restano isolati in basso a sinistra.

La fascia isolata **Strumenti / Avanzati** segue **Modello → Ispeziona → Progetto → Render → Esporta** e condivide la larghezza del contenuto. Memento resta in alto a sinistra. Il canvas continua sotto un solo blur reale, senza attenuazione di luminosità, tinta o dither. La maschera alpha usa una curva smootherstep non lineare a 49 stop, piatta alle estremità. Testi e icone diventano scuri sugli ambienti chiari. I separatori partono dalla baseline dei titoli, sullo stesso gutter dei controlli.

La tab attiva e il suo scroll restano aperti durante selezioni, preset e generazioni. Click sul vuoto, tap ripetuto ed Escape non chiudono il pannello. L’ultima tab si conserva al reload quando lo storage è disponibile. **Comandi semplificati** nasconde e rende inerte la console, lasciando tutti i delta, lucchetti, reset, generatori e comandi vista. Il picking aggiorna la superficie senza cambiare tab. Il fullscreen nativo viene richiesto solo con il pulsante dedicato; dove non è supportato compare un messaggio.

Ogni asse ha **delta 0–100** (inizialmente 100), **lucchetto**, **reset** e **Varia solo**. Il delta è indicato dall’anello, senza numero visibile; resta regolabile con trascinamento e tastiera e leggibile agli screen reader. Lucchetto e reset sono affiancati sotto al nome dell’asse. Il delta globale parte da 35. Sparkle usa `delta effettivo = delta globale × delta asse / 100` sui soli assi sbloccati. Varia solo usa esclusivamente il delta locale: ad esempio, ENV 60 rimane 60 anche se il globale è zero. Zero, tutti gli assi bloccati o nessuna superficie idonea producono un vero no-op. I lucchetti proteggono dalle generazioni; i controlli manuali rimangono disponibili.

A delta effettivo basso (<40) si rifinisce il setup corrente; da 40 si reinterpretano finiture, rig e FX nello stesso stage; da 70 ENV e CAM possono esplorare un nuovo stage e una nuova inquadratura. La generazione combina palette, rapporti key/fill/rim, ottiche e movimenti contenuti. Non è un motore di illuminazione fisicamente accurato. L’esposizione appartiene a CAM, non a LIGHT. FX preserva fuoco/DOF già impostati. I cambi di ENV non reinquadrano CAM né riavviano movimento o scie.

- **MAT:** superficie selezionata, 17 colori più colore libero, sei finiture, PBR, ottica ed emissione. Il random modifica solo una superficie opaca idonea e conserva alpha, UV e gli altri materiali; facce/alpha e UV sono in Modello.
- **ENV:** 10 Clean, 10 Elaborate e 14 Classici. Tutte le collezioni sono griglie compatte di simboli liberi, senza paginazione o scorrimento orizzontale. Stage, atmosfera, palette, composizione e flusso ambientale.
- **LIGHT:** 12 rig studio; key/fill/rim, direzione, altezza, morbidezza, temperatura, colori, ambiente e riflessi. Un’indicazione breve spiega il disegno della luce del rig.
- **CAM:** Ripresa e Movimento nella stessa pagina. Inquadrature, ottiche, apertura, esposizione, fuoco, bokeh; still, Idle, rotazione prodotto, orbita e dolly con trasporto e percorso. Il delta CAM sostituisce il vecchio delta separato dello shot.
- **FX:** tre blocchi per Superficie / Particelle / Scie, tutti i 15 effetti già presenti, mix e trasporto, tutti i parametri avanzati e Post. Il lucchetto FX sostituisce “In Sparkle”; la scelta dei vecchi progetti viene migrata.

**Modello** contiene importazione, tutte le trasformazioni, elenco completo delle superfici, facce/alpha e UV. **Ispeziona** contiene tutte le clip GLB native e la diagnostica geometrica. **Progetto** contiene file .pvis, nome, monitor del workspace e crediti. **Render** contiene qualità video, MSAA, FPS, risoluzione e adattamento. **Esporta** contiene PNG, sfondo alpha e playblast; le impostazioni di cattura rimangono in memoria passando tra le tab. Una vecchia selezione Post viene riaperta in FX.

Nessun selettore a tendina o accordion. Tutti i preset, gli effetti, le clip e le opzioni avanzate restano presenti nella pagina e sono raggiungibili nello scroll verticale. I parametri non applicabili sono disabilitati anziché nascosti. I simboli sono SVG leggeri senza cornici; il numero di colonne si adatta alla larghezza disponibile. Non ci sono miniature 3D aggiuntive.

Ogni generazione e reset è una sola modifica annullabile. Reset riporta ai valori iniziali solo l’asse scelto, anche se bloccato, e conserva delta e lucchetto. MAT ripristina il look originale della superficie selezionata, lasciando UV, alpha, facce e altri materiali invariati. CAM ripristina ripresa e movimento; FX conserva il master Post e il DOF impostato dalla camera. Un reset senza cambiamenti non aggiunge history. Annulla conserva i delta e i lucchetti correnti; non cambia selezione della UI. Il random preserva trasformazioni, clip native, qualità, sezioni e alpha, anche se questi ultimi sospendono alcuni effetti. Il movimento ridotto viene applicato solo agli assi generati, senza alterare quelli bloccati. Delta e lucchetti si salvano nel `.pvis`; i vecchi progetti restano compatibili.

Knob: trascinamento verticale, frecce, Home/End; Shift per regolazioni fini. I parametri nei pannelli mantengono il numero per inserimento diretto; i delta globali e locali usano solo l’anello. Le tab supportano click/tap, frecce orizzontali e Home/End; lo scroll verticale non cambia categoria. Scorciatoie: `1–5` assi, `H` UI, `Spazio` trasporto, `Esc` strumenti temporanei, `Ctrl/Cmd Z` annulla. Le superfici sono tutte selezionabili in Modello, raggruppate per famiglia senza filtri; MAT indica il materiale attivo e collega a Modello.
>>>>>>> 10e60a6124e91f2ebd4d0716d2ef74e1804cf295

## Effetti sul prodotto

Gli shader modificano la resa senza riscrivere texture o materiali salvati. Il ripristino rimuove gli effetti; i progetti precedenti partono senza shader attivi. Punti, dispersioni e scie seguono le mesh animate e i ritagli alpha della texture colore. Ghost echo usa sagome puntinate delle pose precedenti; Ribbon registra il movimento reale del prodotto. La sola orbita della camera non crea scie. I filamenti avvolgono l’ingombro del prodotto, senza simulazione fisica.

Pausa e fase sono indipendenti dalle clip GLB. Il .pvis conserva la fase attuale; il playblast valuta il tempo shader ed alla fine ripristina anche la storia delle scie. Densità e risorse hanno limiti inferiori su mobile e mesh deformate. Nessuna nuova dipendenza, texture o pass fullscreen; i parametri non ricreano i campioni della superficie. Prestazioni e resa WebGL richiedono comunque collaudo su dispositivo reale.

## Modello nello spazio

In **Modello**, Importa GLB sostituisce il modello attivo; Demo ripristina la NSX. L’importazione conserva i materiali originali e normalizza la dimensione massima a 4.7 unità di scena: i valori di posizione sono unità normalizzate, non metri. Le tre sezioni sempre visibili Posizione / Rotazione / Scala espongono knob tattili e valori modificabili. Posizione ±10, rotazione ±180°, scala 0.1–3×. La scala è uniforme per conservare le proporzioni.

Centra allinea l’ingombro reale agli assi X/Z; Appoggia porta la parte inferiore sul piano della scena, dopo eventuali rotazioni. Inquadra ritrova l’intero modello nella vista Hero, anche dopo spostamento o ridimensionamento. Reset ripristina la posa e ferma l’animazione. Le trasformazioni mettono in pausa il movimento, sono annullabili e si salvano nel `.pvis`; sparkle le conserva. Sostituire il modello le azzera, mentre aprire un progetto le ripristina. I vecchi file restano compatibili.

## Lookdev

<<<<<<< HEAD
L'hover sul modello mostra un piccolo rombo/crosshair e soltanto il nome della superficie, senza il suffisso UV1. Il click (tap su touch) seleziona la superficie e il contesto MAT, conservando la modalità semplificata. MAT mostra il materiale; i canali disponibili sono in Modello → Coordinate UV. Se un materiale è condiviso, le modifiche valgono per tutte le mesh che lo usano. Non è un editor di unwrap o di singole isole UV.
=======
L'hover sul modello mostra un piccolo rombo/crosshair e soltanto il nome della superficie, senza il suffisso UV1. Il click (tap su touch) aggiorna la superficie senza cambiare tab. MAT mostra il materiale; i canali disponibili sono in Modello → Coordinate UV. Se un materiale è condiviso, le modifiche valgono per tutte le mesh che lo usano. Non è un editor di unwrap o di singole isole UV.
>>>>>>> 10e60a6124e91f2ebd4d0716d2ef74e1804cf295

Finiture e colori usano campioni circolari compatti. Overlay, rugosità, metallo, vernice e rilievo sono raccolti in una griglia. Facce Esterno / Due lati / Interno, modalità alpha Solido / Taglio / Blend, opacità e soglia sono in Modello, riferiti alla superficie selezionata. Ottica ed emissione espandono trasmissione, IOR, spessore ed emissione. Le proprietà non supportate sono disabilitate. Lo sfondo della UI usa un solo livello di blur reale con maschera alpha non lineare, senza attenuazione della luminosità o pannello colorato.

Nel modello NSX tutti i materiali risultano già double-sided. Le texture ritagliate di interni, cerchi e decal erano marcate Blend: vengono trattate come ritagli alpha con scrittura della profondità, evitando la sovrapposizione da ordinamento trasparente. I tre materiali di vetro mantengono il blending; i modelli GLB importati conservano la propria configurazione. La selezione attraversa i pixel trasparenti dei ritagli usando il canale UV corrente. Le texture sorgenti vengono lette una volta e memorizzate; il viewport non viene letto. Il confronto visivo finale resta da eseguire con WebGL attivo.


**Ispeziona**, nella riga tecnica superiore, usa tre toggle esclusivi: Wire (wireframe triangolato), Mix (overlay) e Normali. Spegnere la vista attiva ripristina PBR. Abilita gli assi X/Y/Z e sposta ogni taglio; Piano elimina un lato invertibile, Fascia mantiene un intervallo e permette tre fasce simultanee. Le guide sono facoltative. Sono sezioni aperte, senza superfici di chiusura o modifica della geometria.

**Post** limita il Bloom a **0.1**, anche tramite valore numerico. Preset e random rispettano lo stesso massimo; i vecchi progetti vengono limitati al caricamento, incluso l’eventuale override delle revisioni precedenti. Il knob permette incrementi di 0.005.

L’**ombra di contatto** viene proiettata dalla parte inferiore del modello sul piano o sul basamento. Tiene conto dei ritagli alpha e si attenua se il prodotto è sollevato. Sul cubo è ritagliata ai bordi del basamento e scompare quando il modello è fuori dalla sua superficie. È nascosta in Void, Alpha, viste diagnostiche e durante le sezioni. La proiezione è in cache: camera e luci non la ricalcolano, la rotazione del prodotto sì. Non è una simulazione completa di occlusione ambientale.

**Sfondo alpha** nasconde ambiente, basamento e pavimento nel render e nel PNG; il motivo a scacchi appartiene soltanto alla UI. Bloom e DOF vengono sospesi per conservare il canale alpha, e riprendono dalle regolazioni precedenti disattivando Alpha. DOF è sospeso anche durante il taglio; le guide non vengono esportate. Non è un export vettoriale o della mesh.

**MSAA** regola entrambi i render target HDR: Auto, Off, 2×, 4×, 8×. Sono selezionabili soltanto i campioni dichiarati dalla GPU; il valore effettivo è visibile. Auto preferisce 4× desktop, 2× touch, Off in qualità Fluida, scegliendo un valore supportato non superiore alla richiesta.

**FPS** limita l'animazione a 30/60 (Auto: 30 con puntatore touch, 60 con mouse). Le modifiche dirette rimangono immediate. Risoluzione 50–100% moltiplica il budget della qualità scelta; Adattiva può ridurla ulteriormente fino al 60% di quel valore e recupera gradualmente. Non cambia l'inquadratura. Il monitor misura FPS consegnati e intervallo p95 tra i frame, non durata GPU; Idle indica che il renderer dorme. È un obiettivo di fluidità, non una garanzia di FPS.

Telefoni e tablet verticali usano un dock inferiore alto un terzo del viewport, con minimo di 400 px limitato al 65% dello schermo. La maniglia regola l’altezza in verticale e la larghezza in orizzontale. Il minimo di trascinamento verticale è 352 px, limitato al 65% nei viewport corti; in orizzontale si conserva almeno un player di 300 px. Doppio click o Invio ripristinano la dimensione iniziale. Frecce regolano 16 px, Shift+frecce 40 px, Home/End i limiti, Escape annulla il drag. Le due preferenze sono ricordate separatamente nel browser, fuori dal progetto; il renderer si reinquadra al rilascio. Desktop e telefoni orizzontali mantengono la colonna. Il blur sfuma dal basso o da destra secondo il layout. L’inquadratura usa gli angoli proiettati dell’ingombro del prodotto: nelle viste frontali la lunghezza dell’auto non forza più uno shot lontano. Ottica ed emissione condividono una griglia di cinque elementi, su una riga quando c’è spazio e 3+2 centrati nelle colonne strette. Tutte le regolazioni restano salvate nel progetto e annullabili.

## Animazioni e playblast

In CAM → Movimento, Ciclo stabilisce la durata nominale, Velocità la moltiplica, Fase permette di scrubbiare la posa in pausa. Curva Smooth o Lineare, verso e loop completano il controllo; Riavvolgi torna all’inizio. Il sistema controlla i movimenti di presentazione del prodotto e della camera, non le animazioni scheletriche incorporate nei GLB.

Esporta → Playblast esporta **solo il canvas**, senza UI, guide o evidenza del materiale. Formati 16:9, 9:16 e 1:1; lato corto 720 o 1080 px; richiesta 24, 30 o 60 FPS; durata da 2 a 20 secondi. La clip parte dalla fase iniziale e usa il movimento configurato, anche se l’anteprima è in pausa. Per un ciclo completo imposta la durata della clip a Ciclo / Velocità, entro il limite di 20 secondi.

MP4 o WebM vengono scelti tra i codec supportati dal browser. La cattura è **in tempo reale**: i frame dipendono da GPU e encoder; non è una render queue offline e non garantisce gli FPS richiesti. Mantieni visibile la scheda. Annulla o Esc interrompono la registrazione; camera, dimensioni e stato vengono ripristinati anche in caso di errore. Le modifiche e il caricamento di altri modelli sono bloccati durante la cattura. Per la trasparenza usa PNG: il video richiede sfondo alpha disattivato.

Le dimensioni e la logica di cattura/ripristino sono testate; codec effettivo, qualità e riproduzione del file richiedono ancora una prova con WebGL su browser reale.

## Limiti dichiarati

- WebGL 2 è necessario per il render, il picking e l'esportazione PNG. In sua assenza compare esplicitamente una **anteprima statica**: cambiarne i controlli modifica lo stato ma non l'immagine. I simboli rimangono statici, anche con WebGL attivo.
- Shader, luce, DOF, riflessi, orientamento/inquadratura del modello e fluidità su GPU reali restano da verificare. Il renderer non è un path tracer; apertura e morbidezza sono regolazioni di una simulazione in tempo reale.
- La configurazione agisce sui materiali GLB. Un canale UV è una mappatura, non identifica automaticamente parti o isole selezionabili. Maschere indipendenti per isola UV e decal richiedono un'estensione dedicata.
- Importazione GLB con risorse incorporate fino a 120 MB; progetto fino a 180 MB. Clip, skin e morph GLB sono supportati; KTX2/Basis e asset che dipendono da file esterni non sono il target di questa versione.
- Salvataggio e apertura del formato sono coperti dai test di roundtrip; download, importazione UI e resa della nuova console richiedono verifica in browser.
- Undo riguarda lo stato del setup, non la sostituzione del modello. Non sono presenti autosalvataggio cloud, collaborazione o backend.
- Le nuove scene sono composizioni procedurali stilizzate; non sono ambienti fotorealistici o asset esterni.

## Struttura

- `src/App.jsx`: interfaccia, storia delle modifiche, file e controlli.
- `src/state.js`: preset, formato progetto e validazione.
- `src/axisState.js`, `src/axisGeneration.js`, `src/axisReset.js`: proprietà degli assi, validazione, delta, generazione e reset indipendenti. `src/presentation.js` conserva le ricette condivise e il precedente helper per compatibilità dei test.
- `src/engine.js`: renderer, modello, materiali, scene, luci e camera.
- `src/environmentStage.js`, `src/CreativeControls.jsx`: set procedurali e controlli creativi.
- `src/AxisControls.jsx`, `src/ControlBlocks.jsx`, `src/axis-workspace.css`: console mobile, blocchi, delta, lock e navigazione.
- `src/VariantGrid.jsx`, `src/EffectSymbol.jsx`: cataloghi aperti con simboli vettoriali per i 15 VFX.
- `src/TechnicalPanel.jsx`, `src/SurfacePolicyControls.jsx`: pagine tecniche e proprietà facce/alpha.
- `src/playblast.js`, `src/PlayblastControls.jsx`: cattura canvas, codec e export video.
- `src/ModelControls.jsx`, `src/modelTransform.js`, `src/modelPlacement.js`: gestione, validazione e trasformazioni del modello.
- `src/lookdev.js`, `src/inspection.js`, `src/GradeShader.js`: policy dei pass, sezioni e color grading.
- `src/LookControls.jsx`, `src/MeshEditor.jsx`, `src/CategoryNavigation.jsx`: controlli lookdev, editor e navigazione tipografica.
- `src/materialSurface.js`, `src/surfacePicking.js`: facce, alpha, depth e selezione delle superfici visibili.
- `src/ProgressiveBlur.jsx`, `src/blurProfile.js`, `src/WorkspaceResize.jsx`, `src/workspaceLayout.js`: maschera non lineare, grip accessibile e layout adattivo.
- `src/performanceMonitor.js`: adattamento della risoluzione e misure dei frame.
- `src/CategoryPager.jsx`, `src/MaterialPicker.jsx` e `src/navigation.js`: categorie, catalogo visibile e raggruppamento delle superfici.
- `src/Controls.jsx` e `src/controlMath.js`: controlli tattili e quantizzazione.
- `src/cubeStage.js`: basamento e composizioni cubiche.
- `src/motion.js`: cicli di movimento.
- `public/models/demo.glb`: modello demo originale.
- Decoder Draco/Meshopt: caricati dal bundle locale solo quando richiesti dal modello; nessun CDN esterno.
- `public/assets`: immagini statiche di riserva, non render dal motore.
- `tests`: test dello stato, roundtrip, movimento e packaging.

<<<<<<< HEAD
Il progetto di sviluppo è gestito in **Sites**, con anteprima privata e sorgenti versionati. Lo ZIP per Vercel contiene una copia portabile senza identificativi di hosting privati. `vercel.json` usa `npm run build:vercel` e pubblica `dist/client`; non servono variabili d’ambiente. La copia statica già compilata è inclusa. La preparazione dello ZIP non effettua il deploy su Vercel.
=======
Il progetto di sviluppo è gestito in **Sites**, con anteprima privata e sorgenti versionati. Lo ZIP per Vercel contiene una copia portabile senza identificativi di hosting privati. `vercel.json` usa `npm run build:vercel` e pubblica `dist/client`; non servono variabili d’ambiente. La copia statica viene generata durante la build; lo ZIP leggero include sorgenti e asset senza duplicarla. La preparazione dello ZIP non effettua il deploy su Vercel.
>>>>>>> 10e60a6124e91f2ebd4d0716d2ef74e1804cf295

## Crediti

Modello: **2015 Rocket Bunny Racing Honda NSX**, **Ddiaz Design**.

- Autore: https://sketchfab.com/ddiaz-design
- Fonte: https://sketchfab.com/3d-models/2015-rocket-bunny-racing-honda-nsx-e30ef65ebbcc4526bc727edcce93c9b3
- Licenza dichiarata dal GLB: **CC BY-NC-SA 4.0** — https://creativecommons.org/licenses/by-nc-sa/4.0/

Modello recuperato dalla demo ProductVis fornita dall'utente; geometria e texture originali sono conservate. Il colore grafite iniziale è un overlay in fase di rendering, ripristinabile con “Originale”.

<<<<<<< HEAD
Icone: Phosphor Icons (`@phosphor-icons/react` 2.1.10, MIT), peso Light e import individuali. Logo Memento: vettore originale fornito dall’utente. Font: Inter. Immagini statiche di riserva generate per questa esplorazione; non attestano la resa del renderer Three.js.
=======
Icone: Tabler Icons e simboli SVG originali per stage, menu avanzato e azioni degli assi. Font: Inter. Immagini statiche di riserva generate per questa esplorazione; non attestano la resa del renderer Three.js.
>>>>>>> 10e60a6124e91f2ebd4d0716d2ef74e1804cf295
