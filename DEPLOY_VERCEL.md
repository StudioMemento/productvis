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

## Revisione inclusa · Atmosfera e console compatta

- Mappe cemento 1024² desktop / 512² touch, densità lineare quadruplicata; Aurora e Dust con flusso regolabile.
- Toolbar Modello → Progetto → Esporta → Fullscreen; delta globale in basso nella fascia del chevron, navbar compatta e Carica modello subito visibile. History continua: drag applicato al rilascio, rotella con aggancio. Dettagli in `ATMOSPHERE_CONSOLE.md`.
- Pavimento e cielo si raccordano con una transizione lunga; bordo dei riflessi attenuato. Nuovi stage Water e Cloud con shader animati, parametri ENV, salvataggio, Undo e generazione indipendente. Dettagli in `WATER_CLOUD.md`.

- Primo stage della nuova direzione lookdev: cemento con mappe procedurali, anello emissivo incassato, riflesso rugoso, foschia e probe di illuminazione. Parametri dedicati in ENV, rig Halo Studio in LIGHT. Dettagli in `AMBER_HALO.md`.

- Icone Phosphor Light in strumenti, preset e assi. Cinque squircle con delta sul perimetro, drag verticale e tap per generare.
- Perno centrale della history, tacche per gli stati e punti per gli slot vuoti. Sinistra annulla; destra ripete e si blocca al presente.
- Proprietà, history e navbar in un solo blocco. Una navbar su mobile; chevron up per uscire dalla modalità semplificata.
- Mesh per modello/ispezione/clip; ingranaggio per rendering/progetto; rec-square per PNG/playblast. Stage: Amber Halo, Water, Cloud, Aurora, Dust, Void, Cube, Studio, Rain, Ring, Velocity Lines.
- Editing nell’unità visibile con validazione, focus recuperato e annullamento dei gesti. Pannello minimo 336 px, contesto essenziale e gruppi sempre aperti.
- Progetto modificato riconoscibile, protezione delle sostituzioni e Salva copia. Riepilogo di export e guida del formato video nel player.

160 test automatici verificano logica, markup, gesti, budget e compatibilità dei progetti. Compilazione/linking di 21 programmi shader verificati con GLES software. Console verificata a 390 × 844 e 320 × 640; Aurora/Dust, drag history 2→0 e rotella 0→2 controllati nel browser in fallback statico. Touch reale, resa finale, prestazioni WebGL e file PNG/video sul dispositivo restano da completare. Il playblast registra in tempo reale: gli FPS effettivi dipendono dal dispositivo. Alpha disponibile per il PNG. Dettagli UI precedenti in `UI_UX_V003_3.md`.

Crediti del modello demo in `licenses/MODEL.md`: CC BY-NC-SA 4.0. Phosphor in `licenses/PHOSPHOR.txt`.

Documentazione: [Vite su Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Vercel CLI](https://vercel.com/docs/cli), [configurazione](https://vercel.com/docs/project-configuration).
