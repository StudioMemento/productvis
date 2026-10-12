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

UI corrente: 287.479 byte (87.686 gzip livello 9), motore differito 729.817 byte (185.307 gzip), CSS 42.024 byte (9.017 gzip). Build statica totale 14.981.247 byte. L’aumento rispetto al precedente ZIP è di circa 4 KB JS UI, 1.3 KB motore e 1.7 KB CSS non compressi.

Posizione, rotazione e scala agiscono su un gruppo distinto dall’animazione, senza riscrivere geometrie o texture. Le modifiche invalidano il contatto; camera e luci continuano a riusare la proiezione. L’ombra è ritagliata ai bordi del cubo. Centra, Appoggia e Inquadra calcolano l’ingombro trasformato soltanto quando richiesto; il mantenimento dell’appoggio durante rotazione inclinata richiede l’aggiornamento dei bounds.

59 test automatici superati, più il gate `test:sites` esplicito. Copertura aggiuntiva: trasformazioni salvate/legacy, conservazione con sparkle, appoggio e centratura dopo scala/rotazione, movimento con parent trasformato, nuova inquadratura e limiti del basamento. SSR conferma nove tab e pannelli, due categorie montate, sei rombi pieni senza figli, toolbar minimale e controlli modello/tecnici. La verifica non misura pixel, gesto touch o FPS reali.
