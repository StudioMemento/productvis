# Amber Halo · 18 ottobre 2026

Prima scena realtime della nuova direzione per ProductVis. Il set combina geometria reale, materiali procedurali e illuminazione predisposta; costituisce la base per valutare la resa prima di estendere il catalogo alle altre reference.

## Uso

I nuovi progetti iniziano con **Amber Halo**, rig **Halo Studio** e camera Hero più larga. Nei progetti esistenti scegliere **ENV → Amber Halo**; LIGHT → Halo Studio è una scelta separata, perché ENV conserva camera, luci, materiali e FX.

| Controllo ENV | Effetto |
| --- | --- |
| Raggio | Anello da 3 a 5 unità normalizzate di scena; non è una misura metrica del GLB originale. |
| Luce anello | Emissione visibile, bagliore sul pavimento, punti luce bassi e banda ambra nel probe. |
| Bagnato | Rugosità a chiazze e intensità del riflesso planare. |
| Microdettaglio | Normali del cemento e distorsione del riflesso. |
| Flusso foschia | Velocità dei veli bassi; zero ferma la fase corrente. |

Nebbia, Riflesso, Superficie e i tre colori restano disponibili. Parametri salvati nel `.pvis`, annullabili e inclusi nella generazione ENV con intervalli limitati. I lucchetti continuano a proteggere gli altri assi.

## Costruzione

- Pavimento reale con mappe colore, normali e rugosità generate una volta per taglia. Nessuna fotografia o illuminazione incorporata nella mappa colore.
- Scanalatura scura, bordi metallici e anello emissivo incassato. Il bagliore sul piano è un contributo analitico controllato, affiancato da due punti luce bassi.
- Ambiente di riflessione dedicato con softbox freddi e banda ambra. PMREM aggiornato solo quando cambia il suo contenuto; durante il drag le catture vengono accorpate e il valore finale applicato prima della pausa del renderer.
- Riflesso planare con distorsione, filtro di rugosità e attenuazione radente. Cache quando si muove soltanto la foschia; ricalcolo con camera, prodotto, materiali, luci o effetti.
- Foschia attraverso piani instanziati con bordi morbidi e rumore animato; centro libero. È un'approssimazione leggera, non una simulazione volumetrica completa.
- Nessuna nuova dipendenza. Gli altri sei stage mantengono il proprio aspetto e filtro del riflesso.

| Budget | Desktop | Dispositivo con puntatore touch |
| --- | --- | --- |
| Mappe cemento · revisione compatta | 1024² | 512² |
| Riflesso Auto | 512², aggiornamento al più ogni 33 ms | 256², al più ogni 66 ms |
| Riflesso Alta | 1024², al più ogni 16 ms | 512², al più ogni 16 ms |
| Qualità Fluida | Riflesso planare disabilitato, 8 veli | Riflesso planare disabilitato, 8 veli |
| Veli Auto / Alta | 20 | 12 |

Questi sono limiti di lavoro, non misure FPS. Risoluzione e adattamento del renderer restano quelli di ProductVis. La preferenza di movimento ridotto ferma il flusso della foschia. PNG e playblast riusano il renderer; la registrazione ripristina anche la fase ambientale.

## Verifica

148 test Node superati: compatibilità dei progetti, isolamento/lock, fase e pausa della foschia, dati delle mappe, accorpamento e rilascio dei probe, aggancio delle estensioni shader alla versione Three.js installata, oltre alla suite UI/engine esistente. Build applicazione e test dell'hosting richiesti prima della pubblicazione.

Nel browser cloud sono stati verificati selezione dello stage e inserimento numerico Bagnato da 55 a 73. Il browser dichiara **WebGL non disponibile**: mostra la riserva statica, non un'immagine di Amber Halo. Non sono certificati compilazione effettiva dei nuovi shader, fedeltà alla reference, resa dei vetri, riflessi, tempi GPU o esportazioni su hardware reale.

Prima di considerare il look definitivo: provare la NSX con metallo, vernice opaca e vetri; orbitare a livello del piano; controllare Bagnato/Nebbia a zero e al massimo; confrontare Auto/Alta/Fluida; provare PNG e un breve playblast su desktop e telefono. I risultati visivi guideranno la taratura, prima delle altre cinque scene.

Lo sviluppo continua sul Site privato esistente. Il pacchetto Vercel è portabile e non comporta una pubblicazione Vercel.
