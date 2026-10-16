# ProductVis · Vercel

<<<<<<< HEAD
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
=======
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
>>>>>>> 10e60a6124e91f2ebd4d0716d2ef74e1804cf295

```sh
npx vercel --prod
```

<<<<<<< HEAD
In alternativa carica i sorgenti nel repository Git collegato a Vercel. Imposta la Root Directory sulla cartella che contiene `package.json`; verifica questi valori:
=======
## Configurazione già inclusa
>>>>>>> 10e60a6124e91f2ebd4d0716d2ef74e1804cf295

| Impostazione | Valore |
| --- | --- |
| Framework | Vite |
| Install | `npm ci` |
| Build | `npm run build:vercel` |
| Output | `dist/client` |
<<<<<<< HEAD
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
=======
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
>>>>>>> 10e60a6124e91f2ebd4d0716d2ef74e1804cf295
