# ProductVis · note tecniche V14

- 20 concept procedurali oltre ai 14 ambienti precedenti. Geometrie condivise, moduli ripetuti instanziati, nessuna texture di ambiente esterna.
- Alla massima densità i test dei nuovi set verificano meno di 6.000 triangoli e al massimo 12 oggetti renderizzabili per stage, esclusi prodotto, piano globale e pass del renderer. Questi limiti geometrici non misurano FPS o costi GPU complessivi.
- Pioggia, acqua, aurora e scie usano uniform di shader; non ricostruiscono geometria a ogni frame.
- UI e motore in chunk separati. Decoder Draco/Meshopt locali su richiesta. Fallback WebP caricato soltanto quando WebGL manca.
- Una sola tendina di controlli montata; nessuna miniatura WebGL. Il cambio di contenuto non deve avviare un nuovo framing della camera.
- Animazioni GLB con clock indipendente dai movimenti FX e normalizzazione esterna ai nodi animati. Salvataggio del cursore e ripristino della posa dopo il playblast.
- Renderer su richiesta, limitatore FPS, risoluzione adattiva, MSAA in base alla GPU, un singolo livello di blur dell’interfaccia. Bloom massimo 0.1.

La soglia informativa Vite di 500 KB viene superata dal chunk del renderer, che resta differito. Nessun benchmark GPU, collaudo touch o verifica visiva dei video è implicito nel risultato dei test automatici.
