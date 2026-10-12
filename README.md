# ProductVis · Preset Studio

Prototipo interattivo React + Three.js della direzione approvata: prodotto a tutto viewport, UI flottante, preset a rombo e controlli essenziali su blur progressivo del fondale senza bordi.

**Stato:** build e logica verificate con test automatici. Collaudo visivo, touch, prestazioni GPU ed esportazione PNG su dispositivi reali ancora da completare: la sessione di sviluppo non dispone di un browser WebGL utilizzabile. Il pacchetto include la configurazione Vercel e le istruzioni in `DEPLOY_VERCEL.md`.

## Avvio

Con Node.js 22 o successivo:

```sh
npm ci
npm run dev -- --host 0.0.0.0
```

Aprire l'indirizzo indicato da Vite in un browser con WebGL 2 disponibile. I file del prodotto vengono elaborati localmente dal browser; il prototipo non richiede account o backend.

La cartella `dist/client` contiene anche la build statica. Va servita via HTTP: l'apertura diretta di `index.html` come file locale non carica correttamente moduli e modello.

```sh
npm run build:vercel
npm run preview -- --host 0.0.0.0
npm test
```

## Ottimizzazioni

Il motore 3D si carica dopo la UI. La scena ferma si ridisegna solo quando necessario; movimento, particelle visibili e interazioni mantengono il rendering attivo. Cambiare finestra sospende i frame. La qualità Auto limita i pixel interni a circa 2 milioni, Fluida a 1 milione, Alta a 4 milioni.

Le immagini di riserva WebP si caricano solo quando WebGL non è disponibile. Le tab montano solo i controlli vicini alla pagina visibile; la posizione verticale resta memorizzata. Il font comprende il sottoinsieme latino; altri alfabeti usano il font di sistema. Dettagli e misure in `OPTIMIZATION.md`.

## Categorie e controlli tattili

Le funzioni sono raccolte in nove categorie. La navbar globale è in basso al centro: nove sole icone in un selettore prospettico, con l'attiva più grande e luminosa. Il titolo della pagina e i tooltip indicano la categoria; i nomi rimangono disponibili alle tecnologie assistive. Drag, rotella, chevron, tap e frecce da tastiera cambiano categoria. Su mobile la rail scorre mantenendo visibile l’icona attiva e conservando la dimensione dei bersagli touch. Le pagine mantengono lo swipe orizzontale e lo scroll verticale locale.

Il logo **Memento** fornito dall’utente è isolato in alto a sinistra. In alto al centro: nascondi UI, **sparkle**, knob delta e valore intero affiancato, senza etichetta aggiuntiva. Lo sparkle resta sull’asse centrale; sui telefoni i comandi scendono sotto il logo per evitare sovrapposizioni. Ogni tap con delta maggiore di zero cambia ambiente, tipo di shot, rig di luci e mood del postprocessing. Il delta dosa l'intensità delle variazioni numeriche. A 0 resta tutto invariato; sotto 70 i materiali sono conservati, da 70 può cambiare anche la finitura della superficie opaca selezionata. Vetri, luci, trasparenze, UV e altri materiali restano protetti.

Un solo Annulla recupera l’intero setup precedente. Il random include rotazione del prodotto, orbita/dolly camera e Idle, una lenta oscillazione con respiro della distanza. Il delta dosa anche velocità, ampiezza e corsa; gli shot Macro usano soltanto movimenti contenuti. La nuova inquadratura si completa prima di avviare l’animazione. Con riduzione del movimento attiva nel sistema, il preset viene scelto ma resta in pausa. Ripristina fuoco automatico e PBR, disattiva sezioni e sfondo alpha; qualità e MSAA restano invariati. **Nascondi UI** lascia soltanto il comando di riapertura, centrato. Annulla è in Progetto → File e resta disponibile con Ctrl/Cmd Z.

- **Prodotto:** selezione tramite tap o slider tattile, finiture, colori, PBR e UV. Gruppi e valori allineati su una griglia comune.
- **Scena:** Ring, Void, Studio, Cinema, Cubi e Particelle. Cubi usa un basamento cubico reale, volumi laterali separati e quote sfalsate. Composizioni A/B/C, variazione, scala, atmosfera, riflesso e superficie.
- **Luci:** preset e regolazioni di intensità, direzione, temperatura, morbidezza e key/fill/rim.
- **Camera:** angolazioni, Ottica (focale, apertura, esposizione), Inquadratura (angolo, altezza, distanza) e fuoco. La distanza di fuoco manuale compare quando Auto è spento.
- **Movimento:** fermo, Idle, rotazione prodotto, orbita camera e dolly; play/pausa, verso, loop, velocità, ampiezza o corsa, asse dove pertinente.
- **Post:** look, bloom, DOF e color grading.
- **Ispeziona:** wireframe, normali e tagli XYZ.
- **Render:** qualità, MSAA, FPS, risoluzione, monitor e sfondo alpha; export PNG e Presenta.
- **Progetto:** upload GLB/demo, posizione XYZ, rotazione XYZ e scala uniforme; Centra, Appoggia, Inquadra e Reset. File raccoglie nome, salva/apri `.pvis`, annulla e crediti.

I parametri mantengono i knob compatti, con nome immediatamente sopra a valore o percentuale e senza pulsanti +/−. Trascinamento verticale, frecce da tastiera o tap sul valore per inserirlo direttamente. Shift durante il drag consente una regolazione fine; Home/End selezionano gli estremi. I preset usano SVG/CSS statici senza miniature GPU.

Le 32 superfici della NSX sono raccolte in sei famiglie senza perdere materiali: Carrozzeria, Ruote, Vetri, Luci, Interni e Dettagli. Il selettore scorre tra famiglie e le piccole frecce raggiungono i singoli materiali. Il nome sotto al selettore indica sempre il bersaglio effettivo; cambiare famiglia non modifica automaticamente tutte le superfici.

Ogni categoria conserva le altre regolazioni. Annulla conserva fino a 40 modifiche; la navigazione manuale sospende il movimento. Il modello importato viene incorporato nel progetto. Scorciatoie: `1–9` selezionano le categorie, `H` mostra/nasconde UI, `Spazio` play/pausa fuori dai controlli interattivi, `Esc` chiude gli overlay, `Ctrl/Cmd Z` annulla.

## Modello nello spazio

Nell’ingranaggio **Progetto**, Importa GLB sostituisce il modello attivo; Demo ripristina la NSX. L’importazione conserva i materiali originali e normalizza la dimensione massima a 4.7 unità di scena: i valori di posizione sono unità normalizzate, non metri. Le tre modalità Posizione / Rotazione / Scala espongono knob tattili e valori modificabili. Posizione ±10, rotazione ±180°, scala 0.1–3×. La scala è uniforme per conservare le proporzioni.

Centra allinea l’ingombro reale agli assi X/Z; Appoggia porta la parte inferiore sul piano della scena, dopo eventuali rotazioni. Inquadra ritrova l’intero modello nella vista Hero, anche dopo spostamento o ridimensionamento. Reset ripristina la posa e ferma l’animazione. Le trasformazioni mettono in pausa il movimento, sono annullabili e si salvano nel `.pvis`; sparkle le conserva. Sostituire il modello le azzera, mentre aprire un progetto le ripristina. I vecchi file restano compatibili.

## Lookdev

L'hover sul modello mostra un piccolo rombo/crosshair e il nome del bersaglio. Il click (tap su touch) seleziona la superficie e apre l'editor unico nella categoria Prodotto. Materiale e canale UV della texture colore sono subito visibili; i canali realmente disponibili si selezionano nello stesso gruppo. Se un materiale è condiviso, le modifiche valgono per tutte le mesh che lo usano. Non è un editor di unwrap o di singole isole UV.

Finiture e colori usano rombi statici interamente riempiti, senza campioni quadrati interni. Rugosità, metallo, vernice, alpha e rilievo sono raccolti in una griglia; facce Esterno / Due lati / Interno e modalità alpha Solido / Taglio / Blend seguono nello stesso editor. Ottica ed emissione espandono trasmissione, IOR, spessore ed emissione. Le proprietà non supportate sono disabilitate. Lo sfondo della UI usa blur reale del fondale con maschere sfumate, senza pannello a gradiente colorato.

Nel modello NSX tutti i materiali risultano già double-sided. Le texture ritagliate di interni, cerchi e decal erano marcate Blend: vengono trattate come ritagli alpha con scrittura della profondità, evitando la sovrapposizione da ordinamento trasparente. I tre materiali di vetro mantengono il blending; i modelli GLB importati conservano la propria configurazione. La selezione attraversa i pixel trasparenti dei ritagli usando il canale UV corrente. Le texture sorgenti vengono lette una volta e memorizzate; il viewport non viene letto. Il confronto visivo finale resta da eseguire con WebGL attivo.


**Ispeziona**, direttamente nella navbar, mostra PBR, wireframe triangolato, overlay o normali. Abilita gli assi X/Y/Z e sposta ogni taglio; Piano elimina un lato invertibile, Fascia mantiene un intervallo e permette tre fasce simultanee. Le guide sono facoltative. Sono sezioni aperte, senza superfici di chiusura o modifica della geometria.

**Post** limita il Bloom a 0.2; il lucchetto «Max 0.2» abilita l’override manuale fino a 1, anche tramite valore numerico. Ripristinare il limite riduce subito un valore superiore. Preset e random disattivano l’override e rispettano 0.2. Lo sblocco è salvato nel progetto; i vecchi progetti senza override sono limitati a 0.2.

L’**ombra di contatto** viene proiettata dalla parte inferiore del modello sul piano o sul basamento. Tiene conto dei ritagli alpha e si attenua se il prodotto è sollevato. Sul cubo è ritagliata ai bordi del basamento e scompare quando il modello è fuori dalla sua superficie. È nascosta in Void, Alpha, viste diagnostiche e durante le sezioni. La proiezione è in cache: camera e luci non la ricalcolano, la rotazione del prodotto sì. Non è una simulazione completa di occlusione ambientale.

**Sfondo alpha** nasconde ambiente, basamento e pavimento nel render e nel PNG; il motivo a scacchi appartiene soltanto alla UI. Bloom e DOF vengono sospesi per conservare il canale alpha, e riprendono dalle regolazioni precedenti disattivando Alpha. DOF è sospeso anche durante il taglio; le guide non vengono esportate. Non è un export vettoriale o della mesh.

**MSAA** regola entrambi i render target HDR: Auto, Off, 2×, 4×, 8×. Sono selezionabili soltanto i campioni dichiarati dalla GPU; il valore effettivo è visibile. Auto preferisce 4× desktop, 2× touch, Off in qualità Fluida, scegliendo un valore supportato non superiore alla richiesta.

**FPS** limita l'animazione a 30/60 (Auto: 30 con puntatore touch, 60 con mouse). Le modifiche dirette rimangono immediate. Risoluzione 50–100% moltiplica il budget della qualità scelta; Adattiva può ridurla ulteriormente fino al 60% di quel valore e recupera gradualmente. Non cambia l'inquadratura. Il monitor misura FPS consegnati e intervallo p95 tra i frame, non durata GPU; Idle indica che il renderer dorme. È un obiettivo di fluidità, non una garanzia di FPS.

Telefoni e tablet verticali usano il dock inferiore espandibile; desktop e telefoni orizzontali mantengono la colonna. Le hit area touch sono aumentate. Tutte le nuove regolazioni sono salvate nel progetto e annullabili; i vecchi `.pvis` ricevono valori compatibili.

## Limiti dichiarati

- WebGL 2 è necessario per il render, il picking e l'esportazione PNG. In sua assenza compare esplicitamente una **anteprima statica**: cambiarne i controlli modifica lo stato ma non l'immagine. I rombi rimangono simboli statici, anche con WebGL attivo.
- Shader, luce, DOF, riflessi, orientamento/inquadratura del modello e fluidità su GPU reali restano da verificare. Il renderer non è un path tracer; apertura e morbidezza sono regolazioni di una simulazione in tempo reale.
- La configurazione agisce sui materiali GLB. Un canale UV è una mappatura, non identifica automaticamente parti o isole selezionabili. Maschere indipendenti per isola UV e decal richiedono un'estensione dedicata.
- Importazione GLB con risorse incorporate fino a 120 MB; progetto fino a 180 MB. KTX2/Basis, skin animation, rig animati e asset che dipendono da file esterni non sono il target di questa prima versione.
- Download richiesto correttamente dalla UI, ma la ricezione del file non è stata osservabile tramite l'API di download del browser cloud. Il formato è coperto dai test di roundtrip; l'apertura di un progetto locale è stata verificata dalla UI.
- Undo riguarda lo stato del setup, non la sostituzione del modello. Non sono presenti autosalvataggio cloud, collaborazione o backend.
- Deserto, montagna e urban restano sviluppi futuri.

## Struttura

- `src/App.jsx`: interfaccia, storia delle modifiche, file e controlli.
- `src/state.js`: preset, formato progetto e validazione.
- `src/presentation.js`, `src/DeltaControl.jsx`: combinazioni random, somiglianza regolabile e protezione delle superfici.
- `src/engine.js`: renderer, modello, materiali, scene, luci e camera.
- `src/ModelControls.jsx`, `src/modelTransform.js`, `src/modelPlacement.js`: gestione, validazione e trasformazioni del modello.
- `src/lookdev.js`, `src/inspection.js`, `src/GradeShader.js`: policy dei pass, sezioni e color grading.
- `src/LookControls.jsx`, `src/MeshEditor.jsx`, `src/CategoryNavigation.jsx`: controlli lookdev, editor unico e navigazione 3D.
- `src/materialSurface.js`, `src/surfacePicking.js`: facce, alpha, depth e selezione delle superfici visibili.
- `src/ProgressiveBlur.jsx`, `src/workspaceLayout.js`, `src/mesh-workspace.css`: blur progressivo e layout adattivo.
- `src/performanceMonitor.js`: adattamento della risoluzione e misure dei frame.
- `src/CategoryPager.jsx`, `src/MaterialPicker.jsx` e `src/navigation.js`: categorie, slider discreto e raggruppamento delle superfici.
- `src/Controls.jsx` e `src/controlMath.js`: controlli tattili e quantizzazione.
- `src/cubeStage.js`: basamento e composizioni cubiche.
- `src/motion.js`: cicli di movimento.
- `public/models/demo.glb`: modello demo originale.
- Decoder Draco/Meshopt: caricati dal bundle locale solo quando richiesti dal modello; nessun CDN esterno.
- `public/assets`: immagini statiche di riserva, non render dal motore.
- `tests`: test dello stato, roundtrip, movimento e packaging.

Il progetto di sviluppo è gestito in **Sites**, con anteprima privata e sorgenti versionati. Lo ZIP per Vercel contiene una copia portabile senza identificativi di hosting privati. `vercel.json` usa `npm run build:vercel` e pubblica `dist/client`; non servono variabili d’ambiente. La copia statica già compilata è inclusa. La preparazione dello ZIP non effettua il deploy su Vercel.

## Crediti

Modello: **2015 Rocket Bunny Racing Honda NSX**, **Ddiaz Design**.

- Autore: https://sketchfab.com/ddiaz-design
- Fonte: https://sketchfab.com/3d-models/2015-rocket-bunny-racing-honda-nsx-e30ef65ebbcc4526bc727edcce93c9b3
- Licenza dichiarata dal GLB: **CC BY-NC-SA 4.0** — https://creativecommons.org/licenses/by-nc-sa/4.0/

Modello recuperato dalla demo ProductVis fornita dall'utente; geometria e texture originali sono conservate. Il colore grafite iniziale è un overlay in fase di rendering, ripristinabile con “Originale”.

Icone: Tabler Icons. Font: Inter. Immagini statiche di riserva generate per questa esplorazione; non attestano la resa del renderer Three.js.
