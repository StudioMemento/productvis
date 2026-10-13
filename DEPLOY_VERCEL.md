# ProductVis · deploy Vercel

Estrai lo ZIP. **productvis** è la radice del progetto: contiene `package.json` e `vercel.json`.

## Configurazione

La configurazione è già inclusa in `vercel.json`:

| Impostazione | Valore |
| --- | --- |
| Framework | Vite |
| Install | `npm ci` |
| Build | `npm run build:vercel` |
| Output | `dist/client` |
| Node.js | 22.x |
| Variabili d’ambiente | Nessuna |

## Aggiornare il progetto esistente

Apri un terminale dentro **productvis** ed esegui:

```sh
npx vercel
```

Accedi al tuo account e collega la cartella al progetto ProductVis esistente. Il comando crea un’anteprima. Per pubblicare l’aggiornamento in produzione:

```sh
npx vercel --prod
```

## Da browser

Per un nuovo progetto, trascina la cartella **productvis** su [Vercel Drop](https://vercel.com/drop). Scegli team e nome, poi Deploy.
Per aggiornare un progetto creato con Drop e senza Git collegato, trascina la cartella sulla pagina di quel progetto nella dashboard. È un aggiornamento in produzione.

## Tramite repository Git

Carica il contenuto di **productvis** nel repository collegato a Vercel. La Root Directory deve essere la cartella che contiene `package.json`, non `src` o `dist/client`. Vercel ricostruisce i file con la configurazione inclusa.

## Build inclusa

`dist/client` è già compilata, utile per verifica locale o hosting statico. `.vercelignore` esclude questa copia dal caricamento via CLI: Vercel la rigenera dai sorgenti, quindi gli asset corrispondono sempre alla build.

```sh
npm ci
npm run build:vercel
npm test
npm run preview
```

La UI, i 20 stage nuovi e i controlli animazioni corrispondono alla versione 14. Il pacchetto comprende la demo NSX, i decoder locali e i crediti. Non contiene credenziali o collegamenti al progetto Vercel del tuo account.

Fonti ufficiali consultate il 13 ottobre 2026: [Vite su Vercel](https://vercel.com/docs/frameworks/frontend/vite), [deploy con CLI](https://vercel.com/docs/cli/deploy), [Vercel Drop](https://vercel.com/docs/drop).
