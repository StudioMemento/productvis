# ProductVis · Vercel

Estrai lo ZIP. La cartella **productvis**, che contiene `package.json` e `vercel.json`, è la radice del progetto.

## Aggiornare il progetto esistente

Dalla cartella estratta, con Node.js 22:

```sh
npm ci
npm run build
npm test
npx vercel
```

Durante il collegamento scegli il tuo team e il progetto Vercel esistente. Controlla l’anteprima restituita dal comando. Per pubblicare quella revisione in produzione:

```sh
npx vercel --prod
```

In alternativa carica i sorgenti nel repository Git collegato a Vercel. Imposta la Root Directory sulla cartella che contiene `package.json`; verifica questi valori:

| Impostazione | Valore |
| --- | --- |
| Framework | Vite |
| Install | `npm ci` |
| Build | `npm run build:vercel` |
| Output | `dist/client` |
| Node.js | 22 |
| Variabili d’ambiente | Nessuna |

`vercel.json` include già i comandi. Nel pacchetto anche `npm run build` compila la sola app Vercel. Vercel ricostruisce dai sorgenti: la build inclusa non richiede di essere caricata separatamente.

## Contenuto

Sorgenti, lockfile, test, asset locali, licenze e copia statica compilata in `dist/client`. Nessun backend o chiave API; i modelli importati rimangono nel browser. Il pacchetto non contiene dipendenze installate o credenziali.

Per una verifica locale dopo la build:

```sh
npm run preview
```

Apri l’indirizzo HTTP indicato da Vite. Il doppio clic su `index.html` non esegue correttamente moduli e modello.

## Revisione inclusa

- Icone Phosphor Light in strumenti, preset e assi. Cinque squircle con delta sul perimetro, drag verticale e tap per generare.
- Perno centrale della history, tacche per gli stati e punti per gli slot vuoti. Sinistra annulla; destra ripete e si blocca al presente.
- Proprietà, history e navbar in un solo blocco. Una navbar su mobile; chevron up per uscire dalla modalità semplificata.
- Mesh per modello/ispezione/clip; ingranaggio per rendering/progetto; rec-square per PNG/playblast. Stage: Void, Cube, Studio, Rain, Ring, Velocity Lines.

Build e test automatici verificano logica, markup, gesti e compatibilità dei progetti. Il collaudo visivo, touch reale, WebGL e video sul dispositivo resta da completare. Il playblast registra in tempo reale: gli FPS effettivi dipendono dal dispositivo. Alpha disponibile per il PNG.

Crediti del modello demo in `licenses/MODEL.md`: CC BY-NC-SA 4.0. Phosphor in `licenses/PHOSPHOR.txt`.

Documentazione: [Vite su Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Vercel CLI](https://vercel.com/docs/cli), [configurazione](https://vercel.com/docs/project-configuration).
