# ProductVis · UI/UX V003_3

Revisione del 16 ottobre 2026 dalla baseline V003_2: sorgenti GitHub `f9ee108e01f063d2cf44241c6bbaaad3bffa66d2`, componenti equivalenti nella base Sites `c3e38ecdec6882cff8aa03fdc2b014e5cc36365e`.

## Cambiamenti

- Percentuali nell’unità mostrata, virgola/punto, errore esplicito senza clamp silenzioso, conferma singola e ritorno del focus.
- Drag lungo come singolo Undo; annullamento e ritorno al valore iniziale preservano il ramo redo. Etichette della history leggibili senza cambiare il perno centrale.
- Minimo laterale 336 px, target e secondari senza sovrapposizioni; gerarchia distinta tra delta, pagina selezionata, pannello aperto, lock e focus.
- Titolo/materiale persistenti, indici dei gruppi, delta numerico e dimensione del pannello accessibili anche senza drag. Orbita conserva il contesto; picking seleziona MAT senza riaprire la modalità semplificata.
- Stato modificato, protezione di demo/apertura/import/reload, Salva copia con messaggio coerente con l’avvio di un download.
- Pixel, alpha, durata, FPS richiesti e codec espliciti. Guida del formato video collegata alla proiezione della camera. Fallback dichiarato statico, con spiegazioni accanto alle azioni non disponibili.

Logo, Phosphor Light, squircle, delta perimetrale, blur e ordine proprietà → history → navbar conservati. Nessuna dipendenza, stage o VFX aggiuntivo.

## Prove eseguite

- Confronto browser con baseline live: Nebbia 25% apriva `.25` e inserire `30` portava a 100%; ora apre `25`, applica `30%`, rifiuta `130`, Escape annulla e Undo torna a 25%.
- Focus restituito al pulsante del valore. Nome progetto modificato attiva il dirty state; Demo apre il dialogo, Annulla torna al trigger. Salva copia avvia il download e aggiorna lo stato senza cancellare history.
- Delta zero tramite tastiera/input: messaggio «Delta a zero», nessuna modifica in history. Cambiare asse in modalità semplificata mantiene proprietà nascoste e inerti.
- Colonna minima misurata a 336 px: cinque assi da 52 px senza overlap. In landscape corto, assi da 44 px e una sola navbar. Nessun overflow orizzontale nei viewport verificati.
- 142 test Node superati: isolamento assi/reset, unità e precisione, gesture/history, roundtrip .pvis e dirty, limiti responsive, equivalenza della proiezione tra guida e output nei tre formati, cattura/ripristino con recorder simulato, markup e hosting.

| Viewport CSS | Dock | Navbar | Area proprietà MAT | Esito layout |
| --- | --- | ---: | ---: | --- |
| 320 × 568 | Inferiore | 1 | 128 px | Passato |
| 360 × 800 | Inferiore | 1 | 159 px | Passato |
| 390 × 844 | Inferiore | 1 | 159 px | Passato |
| 430 × 932 | Inferiore | 1 | 188 px | Passato |
| 844 × 390 | Laterale | 1 | 150 px | Passato |
| 768 × 1024 | Inferiore | 1 | 230 px | Passato |
| 1024 × 768 | Laterale | 2 | 480 px | Passato |
| 1366 × 768 | Laterale | 2 | 480 px | Passato |
| 1920 × 1080 | Laterale | 2 | 792 px | Passato |

Misure con preferenze iniziali ripristinate e viewport iframe; non sono emulazione hardware o collaudo touch. Il browser cloud non offre WebGL: l’immagine del prodotto osservata è il fallback statico.

![Console Camera V003_3, browser cloud con riferimento statico](docs/productvis-v003-3.jpg)

## Criteri ancora aperti

- Resa WebGL, contrasto sui diversi stage, inquadratura dinamica della guida con prodotto animato e performance reali.
- PNG scaricato: dimensioni/alpha; file MP4/WebM: codec effettivo, durata, tre formati, riproduzione e assenza di UI. La proiezione è verificata matematicamente, non mediante video renderizzato.
- Safari iOS / Chrome Android: touch, pinch, tastiera virtuale, safe area, import e riapertura dei file scaricati.
- Chrome/Edge Windows a zoom 200%, dispositivo 1440 × 900 e lettore di schermo.

Il codice è pronto per il collaudo sul dispositivo; questi criteri non sono dichiarati superati da build e test automatici.
