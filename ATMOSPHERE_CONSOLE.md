# ProductVis · Atmosfera e console compatta

Revisione del 18 ottobre 2026, dai sette screenshot di feedback.

## Superfici

| Proprietà | Desktop | Touch |
| --- | --- | --- |
| Mappe procedurali colore / normal / roughness | 1024² ciascuna | 512² ciascuna |
| Densità lineare sul piano da 160 unità | 256 texel/unità | 128 texel/unità |
| Aumento rispetto alla revisione precedente | 4× | 4× |
| Anisotropia richiesta, limitata dal renderer all'hardware | 8 | 4 |

Repeat 40 sul piano e 6 sul basamento, mipmap complete. La grana include una frequenza più fine; normali e pori hanno ampiezza ridotta per evitare l'effetto pietrisco. Sono unità normalizzate della scena, non metri. Le mappe vengono generate una volta per risoluzione e riutilizzate; ogni stage possiede le proprie texture GPU e le rilascia al cambio. Tre mappe desktop occupano circa 16 MiB con mipmap, touch circa 4 MiB. Il raccordo quintico con il cielo resta attivo.

## Nuovi fenomeni in ENV

**Aurora:** tre cortine luminose procedurali, deformate e animate dietro e sopra il centro del prodotto. La maschera dissolve i bordi; le striature sotto un pixel si attenuano tramite derivate. Controlli Intensità, Filamenti, Altezza, Estensione e Flusso. È una rappresentazione stilizzata, non una simulazione fisica dell'atmosfera.

**Dust:** pulviscolo sospeso che scorre lentamente attorno al prodotto. 640 punti desktop, 256 touch; qualità Fluida dimezza il limite e Densità regola il conteggio attivo. Sprite morbide, dissolvenza in altezza e distanza, nessuna texture esterna. Controlli Intensità, Densità, Altezza, Estensione e Flusso.

I due stage condividono il cemento fine, l'orizzonte e un probe di luce con softbox. Nessun nuovo pass a pieno schermo o dipendenza. Velocità zero e movimento ridotto congelano la fase; il playblast la campiona e la ripristina. Normali nasconde l'atmosfera. Palette, valori, Undo e random ENV conservano gli altri assi. I riflessi planari restano in cache durante il solo movimento atmosferico e sono disattivati in Fluida.

## Console

- Barra superiore: Modello, Progetto, Esporta, Fullscreen.
- Delta globale nella fascia del chevron, sullo stesso asse del chevron destro della history.
- Nessuna linea o maniglia disegnata nel separatore. Resize ancora disponibile a drag, tastiera e da Progetto → Workspace.
- Titoli essenziali, Carica modello visibile prima dei controlli e nome del GLB discreto.
- Navbar ridotta a 86 px; cinque icone da 40 px con nome e riga lock/dot/reset.
- Unico scroll delle proprietà. Nei viewport verificati 390×844 e 320×640, con il dock standard da 400 px, rimangono 183 px per le proprietà scorrevoli sotto il titolo.

La history usa un righello continuo a passo 24 px. Il trascinamento muove solo il righello e il nome dello stato candidato; il ripristino della scena avviene una volta al rilascio. Rotella e trackpad applicano lo stato dopo 140 ms di pausa. Nessuna inerzia, nessun futuro oltre il presente. Escape/pointercancel annullano la selezione senza ricaricare stati intermedi. Tap sulle tacche, frecce, Home/End e Undo/Redo restano disponibili. Lo scroll visivo rispetta reduced motion.

## Verifica e limiti

- 160 test Node passati: assi, progetti, history, callback, nuovi stage, clock, budget, lifetime delle risorse e hosting.
- 21 programmi vertex+fragment compilati e linkati tramite prefissi/chunk della Three installata, con OpenGL ES 3.2 Mesa software.
- UI desktop e due iframe della stessa app a 390×844 / 320×640 verificati nella preview autorizzata. Nessun overflow orizzontale o sovrapposizione di lock/reset; delta e freccia destra allineati.
- Aurora/Dust selezionabili. Drag della history 2→0 e rotella 0→2 ripristinano i preset previsti; modalità semplificata mantiene globale e riapertura accessibili.
- Il browser di controllo non dispone di WebGL. Gli screenshot di controllo mostrano il fallback dichiarato, non i nuovi shader. La compilazione non certifica resa estetica, FPS, memoria effettiva, DOF, touch fisico o file video su dispositivi reali.

La build privata Sites e il pacchetto Vercel conservano le dipendenze e il modello demo. Il fixture temporaneo usato per la verifica mobile è escluso dai sorgenti consegnati. Nessun deploy Vercel eseguito.
