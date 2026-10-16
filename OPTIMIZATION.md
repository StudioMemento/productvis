# ProductVis · revisione del 12 ottobre 2026

## Misure della build

| Voce | Prima | Dopo |
| --- | ---: | ---: |
| JavaScript iniziale della UI, non compresso | 1.002 KB | 287 KB |
| JavaScript iniziale della UI, gzip | 272 KB | 88 KB |
| Immagini di riserva, totale | 3.559.578 byte | 182.238 byte |
| Sottoinsiemi del font distribuiti | 7 | 1 latino |
| Pagine con controlli montati all’apertura | 6 | 2 |

Misure in KB decimali, ottenute dai file di produzione. Il motore 3D è ora un chunk separato da 730 KB, caricato dopo la UI; non è eliminato. Le immagini di riserva sono circa il 95% più leggere e non si scaricano durante il funzionamento WebGL. La build statica completa pesa 14.981.247 byte, incluso il modello demo originale da 12.340.172 byte.

## Interventi

- Rendering su richiesta per scene statiche; le animazioni, il movimento manuale e le particelle visibili mantengono i frame attivi. Nessun frame quando la scheda del browser è nascosta.
- Budget della risoluzione interna: circa 1 milione di pixel in Fluida, 2 in Auto, 4 in Alta. Rispetto del pixel ratio del dispositivo e dei limiti precedenti su mobile.
- Draco e Meshopt importati solo se indicati nelle estensioni del GLB. I decoder sono locali e seguono la versione bloccata di Three.js; rimossa la copia duplicata in `public/draco`.
- Modifiche a nome e delta non attivano il renderer. Aggiornamento dei materiali e delle luci solo quando cambiano i dati pertinenti.
- Richieste modello precedenti annullate quando arriva un nuovo caricamento. Notifiche di avanzamento deduplicate.
- Rilascio dei render target dell’ambiente, del pass di output e delle ombre. Rimosso un oggetto di selezione inutilizzato. Snapshot PNG richiesto subito dopo il rendering senza trattenere permanentemente il drawing buffer.
- Controlli montati per la pagina corrente e le vicine, conservando i nove contenitori, lo swipe e la posizione di scroll. Tolti selettori CSS dismessi.
- Rombi, tracce dei knob e ombre più sottili; sfumatura meno opaca. Layout, hit area, etichette funzionali, sparkle con delta e pulsante UI conservati.
- Corretto l’aggiornamento colore dell’anello luminoso esterno.

## Verifica e limiti

Build di produzione e test automatici su stato, materiali, random, gesti, navigazione, composizioni cubiche, motion, scheduler e budget di rendering. Verifica strutturale dell’interfaccia: nove tab e pannelli, due categorie montate inizialmente, nessuna immagine fallback iniziale.

Il controllo ZIP verifica integrità CRC, contenuti esclusi, configurazione Vercel e corrispondenza del modello sorgente/compilato. La build portabile viene verificata dalla cartella estratta.

Non sono misure di FPS, Lighthouse o consumi reali. La sessione non dispone di un browser GPU utilizzabile: interazioni touch, resa WebGL, importazione di modelli compressi ed esportazione PNG richiedono ancora il collaudo sui dispositivi di destinazione. Il chunk del renderer supera la soglia informativa di 500 KB di Vite; resta separato e differito, senza alterare la soglia per nascondere l’avviso.

## Estensione Lookdev

Rispetto al pacchetto precedente, la UI aggiunge circa 20 KB non compressi (5,6 KB gzip), il motore circa 11 KB. Nessuna nuova dipendenza o immagine. Il color grading usa un solo pass, disabilitato con valori neutri. Bloom e DOF sono attivati secondo qualità, alpha e modalità di ispezione; i valori restano memorizzati.

MSAA è configurato sui target del composer, con capacità HDR reali. Il limitatore 30/60 FPS e il monitor si fermano insieme al renderer quando non serve aggiornare la scena. L'adattamento usa gli intervalli tra frame, ignora le pause e riduce/recupera la risoluzione con attese differenti per evitare oscillazioni. Una variazione della risoluzione interna non reimposta camera o orbita.

Wireframe e normali riutilizzano la geometria, creano i materiali diagnostici su richiesta e li rilasciano al cambio modello. Le guide di taglio si ricostruiscono solo se cambiano le sezioni. Le modifiche PBR non ricostruiscono l'ispezione. Nessuna miniatura o lettura aggiuntiva dei pixel GPU.

46 test automatici superati. I nuovi casi coprono roundtrip e validazione, scelta dei campioni, policy dei pass, tagli e fasce XYZ, picking sulle superfici rimaste, trasformazioni e risorse, snapshot con guide temporaneamente nascoste, risoluzione senza spostare camera e layout portrait/landscape. Snapshot e composer sono verificati con oggetti di prova: non dimostrano i pixel finali o la compilazione shader su GPU.

## Editor unico e navigazione 3D

Nella precedente revisione la UI iniziale era scesa a 279.349 byte (gzip 85.939), il renderer differito è 720.691 byte (gzip 184.962). Rimossi popup shader duplicato, vecchi stili della navbar e vecchio controllo delta. La prospettiva della navigazione usa trasformazioni CSS; hover indica soltanto il bersaglio, i controlli si aprono al click.

Il picking interrompe la ricerca sulla prima superficie visibile dopo clipping e alpha; i pixel alpha delle texture sorgenti sono conservati in una WeakMap. Nessuna miniatura del render o lettura GPU. Due livelli di backdrop blur con maschere sfumate, ridotti sui puntatori touch. Il costo effettivo del blur e la resa dei ritagli MSAA richiedono misure su dispositivi reali.

Cinque regressioni dedicate verificano la correzione depth dei ritagli NSX, la conservazione dei vetri e dei materiali importati, le modalità di culling, UV condivisi e picking attraverso i pixel trasparenti. La verifica SSR controlla sei tab a sole icone, editor unico, UV selezionato, sei colori a rombo e posizione dello sparkle prima della navbar. È una verifica del markup, non uno screenshot del nuovo layout.


## Polish Memento, bloom e contatto

Build della revisione precedente: UI 283.547 byte (gzip livello 9: 86.589), motore differito 728.507 byte (184.748 gzip), CSS 40.279 byte (8.763 gzip). Il logo è un SVG locale derivato dall’asset fornito; nessuna dipendenza aggiunta. Rimossi stili dei vecchi wordmark e toolbar.

Il random varia anche rotazione prodotto, orbita, dolly e Idle; la camera raggiunge prima il nuovo shot. Il rendering continua durante questi movimenti e si arresta quando non restano animazioni o particelle visibili. La preferenza di movimento ridotto evita l’autoplay.

Ombra di contatto: due target da 512×512 su desktop o 256×256 con puntatore touch, depth del solo prodotto e due pass separabili di blur. Geometrie e texture alpha originali sono riutilizzate; nessun readback GPU. Il risultato resta in cache per camera, luci e proprietà PBR che non alterano la silhouette. La rotazione del prodotto aggiorna al massimo ogni 50 ms desktop / 80 ms touch. Opacità, ritagli, UV, trasmissione e cambi di piano invalidano la cache; lo snapshot richiede l’ultima posa. Risorse rilasciate al cambio modello o alla chiusura.

53 test superati, oltre alla verifica esplicita `test:sites`. Casi nuovi: bloom 0.2/override 1 e progetti legacy, copertura dei movimenti random, Idle limitato e continuo, attesa della nuova camera prima del movimento, appoggio/sollevamento, orientamento UV della proiezione, cache, alpha e ripristino del renderer dopo errore. La verifica SSR conferma logo, quattro comandi nella toolbar superiore, sei tab, editor unico, UV attivo e controlli Ispeziona/Post in Progetto. Nessuna verifica dei pixel o degli FPS su GPU è implicita in questi test.


## Nove tab e trasformazione modello

Post, Ispeziona e Render hanno pagine proprie; l’ingranaggio raccoglie modello e file. La rail mantiene bersagli di 48 px e scorre per rivelare l’icona attiva sui display stretti. Rimangono montate solo la pagina corrente e le vicine (due all’apertura). Finiture riempite direttamente nel rombo CSS; rimossi elemento campione interno, shortcut Ispeziona e sottoviste Progetto. Nessuna immagine, dipendenza o pass GPU aggiunto.

UI della revisione precedente: 287.479 byte (87.686 gzip livello 9), motore differito 729.817 byte (185.307 gzip), CSS 42.024 byte (9.017 gzip). Build statica totale 14.981.247 byte. L’aumento rispetto al precedente ZIP era di circa 4 KB JS UI, 1.3 KB motore e 1.7 KB CSS non compressi.

Posizione, rotazione e scala agiscono su un gruppo distinto dall’animazione, senza riscrivere geometrie o texture. Le modifiche invalidano il contatto; camera e luci continuano a riusare la proiezione. L’ombra è ritagliata ai bordi del cubo. Centra, Appoggia e Inquadra calcolano l’ingombro trasformato soltanto quando richiesto; il mantenimento dell’appoggio durante rotazione inclinata richiede l’aggiornamento dei bounds.

59 test automatici superati, più il gate `test:sites` esplicito. Copertura aggiuntiva: trasformazioni salvate/legacy, conservazione con sparkle, appoggio e centratura dopo scala/rotazione, movimento con parent trasformato, nuova inquadratura e limiti del basamento. SSR conferma nove tab e pannelli, due categorie montate, sei rombi pieni senza figli, toolbar minimale e controlli modello/tecnici. La verifica non misura pixel, gesto touch o FPS reali.

## Gerarchia e viewport — revisione precedente

Navbar integrata sopra ai controlli: rimossa la sfumatura separata sotto la vecchia rail. Restano due livelli di blur reale, direzionali da destra o dal basso e ridotti sui puntatori touch. Nessuna immagine, dipendenza o pass GPU aggiunto. Le tab continuano a montare soltanto la pagina corrente e le vicine.

La griglia conta anche i controlli nei fragment condizionali: due, tre, quattro o cinque colonne secondo il gruppo, con 3+2 per cinque elementi nelle colonne strette. In verticale il dock usa 34dvh, limitati a 264–400 px; l’espansione è esplicita. L’ingombro della navbar fa parte di quello del pannello: non riserva più una seconda fascia inferiore sul desktop.

L’inquadratura proietta gli otto vertici dell’ingombro del prodotto nelle direzioni della camera, tenendo conto della profondità e dello spazio libero dalla UI. Questo calcolo avviene quando si inquadra, non a ogni frame. I movimenti di orbita e rotazione mantengono un margine per i lati successivamente visibili.

UI della revisione precedente: 286.192 byte (87.629 gzip livello 9), motore differito 730.447 byte (185.551 gzip), CSS 44.085 byte (9.410 gzip). Build statica totale 14.982.651 byte. Rispetto alla revisione precedente: −1.287 byte JS iniziale, +630 byte motore e +2.061 byte CSS non compressi.

Build riuscita, 62 test automatici e gate Sites passati. Verifiche nuove: inquadratura frontale proporzionata, vertici entro l’area libera su quattro formati e quattro angolazioni, bloom 0.1 anche nei vecchi progetti con override. SSR conferma navbar prima dei controlli, nove tab, due categorie montate, cinque elementi nei gruppi condizionali e quattro comandi abilitati nella toolbar con UI nascosta (mostra, sparkle, knob delta, valore). Sono controlli strutturali e matematici: nessuna nuova cattura GPU o misura FPS sui dispositivi.

## Cinque strumenti, ambienti e playblast — ultimo polish

Cinque categorie creative con due pagine montate all’apertura, tre popup tecnici e Post da ENV/LIGHT. Un solo livello di backdrop blur (14 px desktop / 9 px touch), maschera morbida e dither SVG locale da meno di 1 KB; i due strati di brightness/blur precedenti sono superati. Nessuna nuova dipendenza o anteprima GPU.

Scene 14, rig luce 12, shot 12, palette 17 più colore libero. I nuovi set sono procedurali e deterministici per seed; geometrie ripetute sono raccolte in InstancedMesh. Le dune usano una draw call per le forme ripetute; il tunnel due per travi e accenti. Rain e road animano uniform, senza ricostruire la geometria a ogni frame. Il picking hover è limitato a una volta ogni 100 ms.

Orbita manuale, transizioni e movimenti programmatici hanno proprietà separata della camera. Lo smorzamento viene svuotato al passaggio di controllo; misure identiche del dock non rilanciano il framing. Il commit dell’orbita conserva raggio e orientamento senza generare una nuova transizione.

Playblast: cattura temporanea del solo canvas a 720/1080, codec scelto dal browser. Il renderer interattivo viene sospeso e ogni frame richiesto viene valutato dalla posizione temporale; la cattura resta in tempo reale e può perdere frame se il dispositivo non regge. Camera, dimensioni, posa, selezione e scheduler vengono ripristinati al termine o dopo annullamento/errore. Nessun encoder o dipendenza pesante aggiunti.

Build: UI 302.106 byte (92.161 gzip livello 9), motore differito 749.055 byte (191.270 gzip), CSS 53.752 byte (11.000 gzip). Statico totale 15.027.157 byte, compreso il GLB originale. Rispetto alla revisione precedente, +15.914 byte JS UI, +18.608 motore e +9.667 CSS non compressi. L’avviso Vite del chunk engine oltre 500 KB è conservato; il motore resta differito.

Build riuscita, 72 test passati e gate Sites 4/4. I nuovi casi verificano roundtrip dei controlli, budget/seed delle scene, shot locale, ciclo e scrub, proprietà della camera, misure duplicate, dimensioni e codec video, ripristino dopo errore e rilascio dei media track. SSR: cinque tab/pannelli, due categorie montate, tre utility, 18 colori, facce/alpha solo in Modello, toggle Ispeziona, comandi demo attivi e export video. Nessun benchmark GPU, screenshot della nuova UI o video riprodotto su dispositivo è implicito in questi risultati.


## Stage, tendine e shader prodotto — 13 ottobre 2026

34 stage, 20 dei quali nuovi concept procedurali. Un’unica tendina montata sotto le due righe di navigazione. La sottotab FX Shader aggiunge 15 effetti procedurali, senza nuove dipendenze, texture o pass fullscreen. Gli effetti superficie si innestano nei materiali originali e scartano i frammenti coperti prima dell’illuminazione.

Budget massimi: 6.000 punti su touch/qualità Fluida e 16.000 desktop; con skin o morph: 1.400 / 3.600, aggiornati fino a 24 / 30 Hz. Ghost usa 2 / 3 pose di massimo 1.000 / 2.200 punti; Ribbon 4 / 6 nastri con 28 campioni. Le scie registrano coordinate mondo, quindi la camera non trascina il fondale. I campioni seguono triangoli e coordinate baricentriche; alpha e UV usano la cache delle texture sorgenti già presente. Nessun readback del viewport.

Wire glow aggiunge un overlay per mesh condividendo la geometria: il suo costo dipende ancora dal modello importato. Risoluzione adattiva, limite FPS, pausa in background e bloom massimo 0.1 restano attivi. Nessun benchmark GPU implicito nei test matematici e strutturali.
<<<<<<< HEAD


## Phosphor e history centrale · 16 ottobre 2026

Phosphor React 2.1.10 sostituisce Tabler e i pittogrammi personalizzati, con import per icona e peso Light. Squircle delta in SVG/CSS, nessuna immagine o pass GPU aggiuntivo. La history usa uno spazio di 16 px per stato e una finestra di slot attorno al perno centrale; il drag aggiorna il progetto solo al cambio di stato e si blocca agli estremi.

Build corrente: UI iniziale 518.41 KB (147.01 KB gzip), renderer differito 788.77 KB (204.66 KB gzip), CSS 112.67 KB (20.07 KB gzip), valori decimali riportati da Vite. Phosphor include le definizioni dei pesi delle icone importate; il nuovo linguaggio iconografico aumenta il bundle UI. L'avviso dei chunk oltre 500 KB resta visibile. Il GLB e i decoder non sono modificati.

135 test automatici superati. Copertura nuova: perno centrale, slot vuoti, blocco al presente, direzione undo/redo, tap su tacche, annullamento del gesto, tastiera e delta sul perimetro. Il test SSR include i moduli ESM Phosphor nello stesso modo della build. Nessuna nuova verifica browser/GPU/touch reale: il blocco della sessione di anteprima resta attivo.
=======
>>>>>>> 10e60a6124e91f2ebd4d0716d2ef74e1804cf295
