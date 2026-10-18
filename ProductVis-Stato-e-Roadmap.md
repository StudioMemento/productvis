# ProductVis — Stato attuale e percorso alla v1

**Aggiornamento:** 18 ottobre 2026 · revisione Rain / noise / knob / history.

**Stato:** prototipo funzionale avanzato. Il flusso creativo è già utilizzabile; la qualità visiva e l’affidabilità su una matrice di dispositivi non sono ancora certificate come prodotto finito.

Il deploy pubblico osservato è [productvis.vercel.app](https://productvis.vercel.app/). Le quattro correzioni descritte sotto appartengono alla nuova revisione consegnata: il deploy Vercel dell’utente richiede l’aggiornamento dal nuovo pacchetto.

## 1. End goal di riferimento

Caricare un GLB, collocarlo rapidamente in uno scenario curato, esplorare varianti coerenti di materiali, ambiente, luci, camera ed effetti e ottenere immagini o brevi video utilizzabili. Il prodotto resta il protagonista, l’interfaccia è essenziale e i controlli funzionano anche da mobile.

Il livello visivo desiderato è quello delle reference atmosferiche: superfici credibili, orizzonte senza stacchi, luce controllata, acqua e foschia con profondità, composizioni pulite. Le reference sono una direzione artistica: una scena procedurale già presente nel catalogo non equivale automaticamente alla fedeltà raggiunta.

**Perimetro della prima v1:** tool nel browser, elaborazione locale, GLB con risorse incorporate, PNG e playblast in tempo reale. Account, collaborazione, rendering offline e backend non sono necessari a questo traguardo.

## 2. Cosa c’è già

| Area | Implementato | Maturità e limite attuale |
| --- | --- | --- |
| Modello | Upload GLB, demo, normalizzazione, trasformazioni, centra/appoggia/inquadra, materiali, clip native | Flusso implementato; serve una matrice di asset reali, non solo automobili |
| Lookdev | PBR per materiale, UV disponibili, facce/alpha, trasmissione, IOR, emissione, wire/mix/normali, sezioni | Sezioni aperte; niente editor di unwrap o maschere per singola isola UV |
| Ambiente | 11 stage: Amber Halo, Water, Cloud, Aurora, Dust, Void, Cube, Studio, Rain, Ring, Velocity Lines | Ampiezza sufficiente; finitura visiva disomogenea fra stage |
| Luce e camera | 13 rig luce, 12 preset camera, focus, DOF, orbita e movimenti di presentazione | Controlli presenti; resa e framing da verificare con prodotti di forme diverse |
| Generazione | MAT / ENV / LIGHT / CAM / FX indipendenti, delta locale/globale, lock, reset e varianti coordinate | Isolamento e persistenza coperti dai test; la qualità delle combinazioni richiede selezione artistica |
| FX | 15 effetti tra superficie, particelle e scie, più Post | Budget limitati; combinazioni pesanti e trasparenze da collaudare sulla GPU |
| Interazione | Knob con drag/tastiera/input, history da 80 modifiche, Undo/Redo, pannello ridimensionabile e modalità semplificata | Controlli desktop e layout mobile verificati; touch fisico e gesti interrotti richiedono sessioni su device |
| Progetti | Salva/apri `.pvis`, modello incorporato, validazione, migrazioni e protezione delle sostituzioni | Roundtrip automatico coperto; manca il recupero automatico della sessione dopo chiusura/crash |
| Output | PNG, alpha PNG, playblast 16:9 / 9:16 / 1:1, 720/1080, richiesta 24/30/60 FPS, 2–20 s | Registrazione in tempo reale; durata, codec e frame effettivi vanno controllati sul file prodotto |
| Rendering | WebGL 2, qualità, MSAA, limite FPS, risoluzione adattiva, riflessi in cache e sospensione quando possibile | Strumenti presenti; nessuna garanzia di FPS su hardware non misurato |
| Distribuzione | Sorgenti versionati, build statica, pacchetto Vercel riproducibile | Il rilascio pubblico resta separato dalla revisione di sviluppo |

## 3. Correzioni di questa revisione

### Rain pulita

Rimossi skyline, cubi e materiale dei volumi. Rimangono le strisce di pioggia, il prodotto e il pavimento del motore. Rimosso il controllo «Volumi» da Rain; Densità, Altezza e Spazio regolano ora la pioggia stessa. Seed e parametri aggiornano lo stage senza ricostruirlo durante il drag.

Il budget massimo è 360 gocce desktop / 180 touch, dimezzato in Fluida. Gli estremi di ogni striscia attraversano insieme il limite verticale, evitando linee che collegano accidentalmente cielo e suolo. Pausa, movimento ridotto e ripristino del playblast usano il clock comune.

### Knob concentrici

Sul deploy l’anello SVG era spostato di **−2 px in X e Y** rispetto al centro del controllo; etichetta e valore erano già sull’asse corretto. L’anello ora è centrato rispetto al bottone, indipendentemente dalla sua dimensione. Verifica della nuova UI: offset **0 px**, anche nelle colonne strette.

### Noise contro la ripetizione delle UV

Il cemento mantiene mappe 1024² desktop / 512² touch e grana fine. Un nuovo layer procedurale ancorato alle coordinate della scena altera gradualmente il campionamento e combina due campioni a scala e offset differenti. Colore, normali, rugosità e pozze di Amber Halo seguono la stessa variazione; una modulazione più ampia rompe ulteriormente l’uniformità.

Applicato ai piani Amber Halo / Aurora / Dust e ai basamenti Water / Cloud. Non modifica UV o materiali dei GLB importati. Nessuna nuova texture da scaricare o pass fullscreen; il costo passa da uno a due campioni per ogni lookup coinvolto e aggiunge calcoli di noise. Il nuovo materiale è stato osservato su Amber Halo con WebGL attivo dopo la pubblicazione privata, senza errori segnalati. Restano da confrontare shot più ampi e ravvicinati e da misurare il costo sui dispositivi mobili.

### History nel verso del gesto

Trascinare **a destra torna indietro**; trascinare **a sinistra avanza**. Anche il segno della rotella è invertito rispetto alla revisione precedente. Il righello segue il trascinamento; la scena cambia solo al rilascio o dopo 140 ms senza eventi di rotella. Restano blocco agli estremi, tap sulle tacche, annullamento e shortcut Undo/Redo.

Rimosso il popup con nome e contatore, incluso il tooltip del righello. Posizione e istruzioni restano disponibili alle tecnologie assistive. Le frecce Undo/Redo mantengono il significato precedente/successivo.

## 4. Quanto manca

Non c’è ancora una percentuale misurabile di «completamento»: la quantità di funzioni è già ampia, mentre il traguardo dipende soprattutto dalla consistenza delle immagini e dal collaudo reale.

**Stima di pianificazione: 8–15 giornate di lavoro effettivo per una v1 locale curata e verificata**, mantenendo l’attuale architettura e senza nuove grandi funzioni. Equivale indicativamente a 2–3 settimane con dispositivi di prova e feedback disponibili. È una stima, non una misura del lavoro già completato né una data garantita.

| Priorità | Blocco di lavoro | Lavoro residuo | Stima | Criterio di uscita |
| --- | --- | --- | --- | --- |
| P0 | Qualità visiva | Tarare cemento, wetness, riflessi, contatto e luce; confrontare acqua/cloud/rain con le reference; selezionare varianti riuscite | 3–5 giorni | Tre stage guida approvati, più passata di coerenza sugli altri; nessun bordo di piano o pattern evidente negli shot di prova |
| P0 | GPU e mobile | Profilare desktop, iPhone/Safari e Android/Chrome; misurare noise, cloud, riflessi, blur e FX; regolare budget e fallback | 2–4 giorni | Obiettivi proposti: 60 FPS desktop e 30 FPS mobile nei setup concordati, con risoluzione e p95 documentati; niente crash o contesto perso nella sessione di prova |
| P0 | Asset, progetti ed export | Provare GLB piccoli/grandi, vetro, alpha, skin/morph/clip; salva–chiudi–riapri; controllare PNG alpha e video prodotti | 2–3 giorni | Stesso setup alla riapertura, file leggibili, dimensioni/alpha/durata corretti, ripristino dopo export o annullamento |
| P1 | Finitura e stabilità | Touch fisico, conflitti scroll/knob, history lunga, tastiera, contrasto su scene chiare; consolidare CSS storico e documentazione | 1–3 giorni | Nessuna collisione nei viewport concordati, ogni controllo raggiungibile, nessuna regressione dei flussi principali |

Le stime assumono correzioni incrementali. Se il confronto visivo richiede nuovi sistemi di rifrazione, volumetria o una pipeline video offline, va ridefinito il perimetro.

### Ordine operativo consigliato

1. **Bloccare tre scene guida:** Amber Halo per cemento/luce; Water per superficie/riflesso; Cloud per profondità atmosferica. Usare anche Rain come verifica di pulizia della scena.
2. **Confrontare shot ripetibili:** stessa camera, stesso GLB, stessa palette; dettaglio ravvicinato e vista larga. Conservare il `.pvis` di ogni caso approvato.
3. **Profilare prima di aggiungere effetti:** partire da Auto e Fluida sui dispositivi concordati; ridurre costo dove si osserva un limite reale.
4. **Chiudere il ciclo di lavoro:** importazione → regolazione → Undo/Redo → salvataggio → riapertura → PNG/video.
5. **Congelare la release candidata**, correggere solo i difetti emersi, quindi aggiornare il deploy Vercel.

## 5. Gap visivi e funzionali da tenere espliciti

- **Pioggia:** ora la composizione è pulita, ma non simula collisioni, schizzi o increspature generate dalle singole gocce. Valutarli solo se il confronto visivo li rende necessari.
- **Cloud:** il volume è a budget limitato; profondità, trasparenze e DOF possono mostrare approssimazioni in alcuni shot.
- **Acqua:** superficie e riflesso sono procedurali; non è una simulazione di fluidi né un trasporto fisico completo della luce.
- **Aurora e Dust:** effetti stilizzati. Vanno giudicati per composizione e leggibilità del prodotto, senza confonderli con fenomeni fisici completi.
- **Illuminazione:** riflessi e contact shadow hanno cache e limiti intenzionali; i riflessi del prodotto vanno verificati con materiali lucidi e vetro, anche cambiando camera.
- **UI:** il blur da solo non garantisce contrasto su ogni fondale. Servono prove su scene chiare e display reali, preservando la direzione grafica minimale.
- **Recupero sessione:** un autosave locale con recupero esplicito è una possibile aggiunta successiva, da stimare separatamente; i `.pvis` restano oggi il salvataggio deliberato.
- **Performance:** le impostazioni FPS sono obiettivi, non promesse; il monitor misura frame consegnati, non il tempo GPU puro.

## 6. Evidenze di verifica

| Verifica | Esito / portata |
| --- | --- |
| Screenshot dell’utente | Quattro immagini ispezionate: skyline Rain, knob disassati, pattern del piano e popup history |
| Deploy Vercel precedente | Aperto nel browser collegato; render 3D osservato e offset degli anelli misurato a −2 px |
| Test automatici della revisione | 161 superati: stato, assi, storia/gesti, asset/progetti, budget, clock e hosting |
| Programmi shader | 22 programmi vertex+fragment compilati e linkati con i chunk della Three installata, su OpenGL ES 3.2 Mesa software |
| UI della nuova revisione | Desktop e viewport 390×844 / 320×640: knob centrati, nessun overflow orizzontale, contatore assente; drag history 2→0→2 e rotella verificati |
| Nuova build pubblicata | Amber Halo e Rain osservati nel browser collegato con 3D attivo: materiale noise renderizzato, skyline assente, nessun errore nei log controllati. Verifica puntuale, non benchmark o certificazione di tutti gli stage |
| Limite della preview mobile | I viewport 390/320 della preview usano il fallback statico: dimostrano il layout e le interazioni, non la resa 3D mobile |
| Da completare su device | Confronto visivo degli 11 stage su shot e device diversi, FPS sostenuti, temperatura/memoria, touch fisico, file PNG e video e riapertura di progetti con GLB diversi |

La compilazione shader elimina errori sintattici/linking, ma non certifica qualità visiva, velocità o compatibilità di ogni driver.

## 7. Definizione di “pronto”

La v1 è pronta quando i tre stage guida sono approvati su immagini reali del motore, tutti gli 11 stage superano la verifica visiva di base, il flusso completo funziona sui browser concordati e i file esportati sono stati aperti e controllati. Le combinazioni più costose devono avere un comportamento prevedibile e un’alternativa di qualità più leggera.

Rimangono fuori dal traguardo iniziale: collaborazione/cloud, editing delle isole UV, simulazioni fisiche complete, path tracing e rendering video offline. Aggiungerli ora cambierebbe la natura e la durata del progetto.
