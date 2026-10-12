# ProductVis · deploy Vercel

Estrai lo ZIP: la cartella `productvis` è la radice del progetto.

## Da browser

Apri [Vercel Drop](https://vercel.com/drop), trascina la cartella **productvis**, scegli team e nome e premi Deploy. Carica la cartella estratta, non lo ZIP. Vercel legge `vercel.json` e ricostruisce il sito.

In alternativa, carica i sorgenti in un repository Git e importalo in Vercel con Root Directory impostata sulla cartella che contiene `package.json`.

## Configurazione inclusa

| Impostazione | Valore |
| --- | --- |
| Framework | Vite |
| Install | `npm ci` |
| Build | `npm run build:vercel` |
| Output | `dist/client` |
| Node.js | 22 o successivo |
| Variabili d’ambiente | Nessuna |

Per aggiornare il progetto Vercel esistente da terminale, esegui dalla cartella estratta:

```sh
npx vercel
```

Seleziona il progetto corretto durante il collegamento e verifica l’anteprima. Per pubblicare in produzione quando è approvata:

```sh
npx vercel --prod
```

## Contenuto e verifica locale

Il pacchetto contiene sorgenti, dipendenze bloccate in `package-lock.json`, test, asset locali, licenze e una copia già compilata in `dist/client`. Non richiede backend o chiavi API. I modelli importati rimangono nel browser.

```sh
npm ci
npm run build:vercel
npm test
npm run preview
```

Apri l’indirizzo HTTP indicato da Vite: il doppio clic su `index.html` non esegue correttamente l’app. Nel pacchetto esportato anche `npm run build` compila direttamente per Vercel, senza il packaging privato dell’ambiente di sviluppo.

La build e i test automatici sono verificati. Il collaudo su GPU reale resta da eseguire: orbitare, cambiare preset, importare un GLB, esportare PNG e riaprire un `.pvis`, anche da telefono. Se WebGL 2 manca, l’app segnala esplicitamente la vista statica.

I crediti del modello demo sono nel README e in `licenses/MODEL.md`; la licenza del modello è CC BY-NC-SA 4.0.

Documentazione: [Vercel Drop e metodi di deploy](https://vercel.com/docs/deployments), [Vite](https://vercel.com/docs/frameworks/frontend/vite), [configurazione](https://vercel.com/docs/project-configuration).
