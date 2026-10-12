# ProductVis · Preset Studio

Prototipo interattivo React + Three.js della direzione approvata: prodotto a tutto viewport, UI flottante, preset a rombo e controlli essenziali su un gradiente sfumato senza bordi.

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

Le funzioni sono raccolte in sei tab con icone ancorate al fondo della colonna, sotto ai controlli e ai chevron. Su desktop la UI rimane a destra; su mobile nella parte inferiore. Swipe/scroll orizzontale cambiano categoria, lo scroll verticale percorre i controlli della pagina. Chevron, rotella sulla navigazione e tastiera sono alternative equivalenti. Ambra, sottolineatura e posizione 01/06 mantengono visibile la categoria attiva. La camera tiene conto dello spazio occupato dalla UI.

Lo **sparkle** è centrato nel viewport con **Δ %** accanto: trascina il numero, toccalo per inserirlo o usa le frecce da tastiera. Il delta controlla la distanza dallo shot corrente: 1–39% mantiene set, rig e materiali con variazioni vicine; 40–69% esplora nuove luci, camera e finitura nello stesso ambiente; 70–100% cambia anche ambiente. A 0% lo shot resta invariato. Il valore iniziale è 35% e viene salvato nel progetto; i file precedenti rimangono compatibili.

Un solo Annulla recupera l'intero setup precedente. Il random mantiene modello, qualità, nome, UV, rilievo, trasparenze e tutti gli altri materiali; vetri e luci non vengono ricolorati. Il movimento si ferma e il fuoco torna automatico. Nessuna anteprima aggiuntiva viene generata. Il tasto **UI**, in alto a destra, nasconde tutti i controlli e lascia solo il comando per riaprirli.

- **Prodotto:** modello demo o GLB, selezione tramite tap sul modello o slider tattile a scatti, finiture a rombo, colore e proprietà PBR, mappatura UV.
- **Scena:** Ring, Void, Studio, Cinema, Cubi e Particelle. Cubi usa un basamento cubico reale, volumi laterali separati e quote sfalsate. Composizioni A/B/C, variazione, scala, atmosfera, riflesso e superficie.
- **Luci:** preset e regolazioni di intensità, direzione, temperatura, morbidezza e key/fill/rim.
- **Camera:** angolazioni, focale, apertura, esposizione, posizione e fuoco automatico/manuale.
- **Movimento:** fermo, rotazione prodotto, orbita camera e dolly; play/pausa, verso, loop, velocità, ampiezza o corsa, asse dove pertinente.
- **Progetto:** salva/apri `.pvis`, PNG, presentazione, qualità e crediti.

I parametri mantengono i knob compatti, con nome immediatamente sopra a valore o percentuale e senza pulsanti +/−. Trascinamento verticale, frecce da tastiera o tap sul valore per inserirlo direttamente. Shift durante il drag consente una regolazione fine; Home/End selezionano gli estremi. I preset usano SVG/CSS statici senza miniature GPU.

Le 32 superfici della NSX sono raccolte in sei famiglie senza perdere materiali: Carrozzeria, Ruote, Vetri, Luci, Interni e Dettagli. Il selettore scorre tra famiglie e le piccole frecce raggiungono i singoli materiali. Il nome sotto al selettore indica sempre il bersaglio effettivo; cambiare famiglia non modifica automaticamente tutte le superfici.

Ogni categoria conserva le altre regolazioni. Annulla conserva fino a 40 modifiche; la navigazione manuale sospende il movimento. Il modello importato viene incorporato nel progetto. Scorciatoie: `1–6` selezionano le categorie, `H` mostra/nasconde UI, `Spazio` play/pausa fuori dai controlli interattivi, `Esc` chiude gli overlay, `Ctrl/Cmd Z` annulla.

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
