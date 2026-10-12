# ProductVis · revisione del 12 ottobre 2026

## Misure della build

| Voce | Prima | Dopo |
| --- | ---: | ---: |
| JavaScript iniziale della UI, non compresso | 1.002 KB | 262 KB |
| JavaScript iniziale della UI, gzip | 272 KB | 81 KB |
| Immagini di riserva, totale | 3.559.578 byte | 182.238 byte |
| Sottoinsiemi del font distribuiti | 7 | 1 latino |
| Pagine con controlli montati all’apertura | 6 | 2 |

Misure in KB decimali, ottenute dai file di produzione. Il motore 3D è ora un chunk separato da 707 KB, caricato dopo la UI; non è eliminato. Le immagini di riserva sono circa il 95% più leggere e non si scaricano durante il funzionamento WebGL. La build statica completa pesa 14.913.893 byte, incluso il modello demo originale da 12.340.172 byte.

## Interventi

- Rendering su richiesta per scene statiche; le animazioni, il movimento manuale e le particelle visibili mantengono i frame attivi. Nessun frame quando la scheda del browser è nascosta.
- Budget della risoluzione interna: circa 1 milione di pixel in Fluida, 2 in Auto, 4 in Alta. Rispetto del pixel ratio del dispositivo e dei limiti precedenti su mobile.
- Draco e Meshopt importati solo se indicati nelle estensioni del GLB. I decoder sono locali e seguono la versione bloccata di Three.js; rimossa la copia duplicata in `public/draco`.
- Modifiche a nome e delta non attivano il renderer. Aggiornamento dei materiali e delle luci solo quando cambiano i dati pertinenti.
- Richieste modello precedenti annullate quando arriva un nuovo caricamento. Notifiche di avanzamento deduplicate.
- Rilascio dei render target dell’ambiente, del pass di output e delle ombre. Rimosso un oggetto di selezione inutilizzato. Snapshot PNG richiesto subito dopo il rendering senza trattenere permanentemente il drawing buffer.
- Controlli montati per la pagina corrente e le vicine, conservando i sei contenitori, lo swipe e la posizione di scroll. Tolti selettori CSS dismessi.
- Rombi, tracce dei knob e ombre più sottili; sfumatura meno opaca. Layout, hit area, etichette funzionali, sparkle con delta e pulsante UI conservati.
- Corretto l’aggiornamento colore dell’anello luminoso esterno.

## Verifica e limiti

Build di produzione e test automatici su stato, materiali, random, gesti, navigazione, composizioni cubiche, motion, scheduler e budget di rendering. Verifica strutturale dell’interfaccia: sei tab e pannelli, due categorie montate inizialmente, nessuna immagine fallback iniziale.

Il controllo ZIP verifica integrità CRC, contenuti esclusi, configurazione Vercel e corrispondenza del modello sorgente/compilato. La build portabile viene verificata dalla cartella estratta.

Non sono misure di FPS, Lighthouse o consumi reali. La sessione non dispone di un browser GPU utilizzabile: interazioni touch, resa WebGL, importazione di modelli compressi ed esportazione PNG richiedono ancora il collaudo sui dispositivi di destinazione. Il chunk del renderer supera la soglia informativa di 500 KB di Vite; resta separato e differito, senza alterare la soglia per nascondere l’avviso.
