# ProductVis · deploy Vercel

Pacchetto dell’ultima revisione del 15 ottobre 2026: reset individuali degli assi, UI compatta, maniglia del pannello e maschera blur non lineare.

## Cartella da usare

Estrai lo ZIP. La cartella **productvis**, quella che contiene `package.json` e `vercel.json`, è la radice del progetto.

## Deploy

Carica il contenuto della cartella in un repository Git e importalo in Vercel, oppure aggiorna il repository già collegato al tuo progetto ProductVis. Imposta Root Directory sulla cartella contenente `package.json`: `.` se hai caricato il contenuto nella radice del repository, `productvis` se hai caricato la cartella intera.

In alternativa, apri un terminale dentro `productvis` e usa:

```sh
npx vercel
```

Collega il progetto corretto e controlla l’anteprima. Per un deploy in produzione:

```sh
npx vercel --prod
```

## Configurazione già inclusa

| Impostazione | Valore |
| --- | --- |
| Framework | Vite |
| Install | `npm ci` |
| Build | `npm run build:vercel` |
| Output | `dist/client` |
| Node.js | 22 o successivo |
| Variabili d’ambiente | Nessuna |

Anche `npm run build` esegue la build portabile. Il pacchetto contiene sorgenti, lockfile, modello demo, asset locali, licenze e test. Vercel genera `dist/client` durante il deploy; questa distribuzione non duplica il modello in una build precompilata.

## Verifica locale

```sh
npm ci
npm run build
npm test
npm run preview
```

Apri l’indirizzo HTTP indicato da Vite. L’app richiede WebGL 2 per il render interattivo; senza WebGL mostra un riferimento statico esplicito. I GLB importati rimangono nel browser; non serve un backend.

## Controlli dell’ultima versione

- MAT / ENV / LIGHT / CAM / FX: navigazione persistente in basso alla console, tutte le opzioni in un solo scroll verticale.
- Anello delta globale in alto; cinque generatori locali in basso. Lock e reset sotto il nome dell’asse. Reset è indipendente e annullabile.
- Maniglia: larghezza su desktop, altezza in verticale; doppio click o Invio ripristinano la dimensione. Le due preferenze vengono ricordate separatamente.
- Modello: GLB, trasformazioni, superfici, facce/alpha e UV. Ispeziona: clip native GLB e diagnostica. Progetto: file e preferenze. Render: qualità video. Esporta: frame PNG e playblast.
- CAM include ripresa e movimento; FX contiene shader, particelle, scie e postprocessing.
- Vista semplificata conserva i generatori. Click sul vuoto, preset e Sparkle mantengono la tab selezionata.

La build e i test automatici sono verificati. Il collaudo visivo del blur, touch, GPU, fullscreen e cattura PNG/video richiede un dispositivo reale. Il playblast registra in tempo reale: gli FPS effettivi dipendono dal dispositivo.

Crediti e licenza del modello demo: `README.md` e `licenses/MODEL.md`.

Documentazione ufficiale: [Vite su Vercel](https://vercel.com/docs/frameworks/frontend/vite), [configurazione della build](https://vercel.com/docs/builds/configure-a-build).
