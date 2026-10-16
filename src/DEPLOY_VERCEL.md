# ProductVis · V003_1

## GitHub Desktop

1. Estrai lo ZIP in una cartella temporanea.
2. In GitHub Desktop apri il repository esistente con **Show in Explorer / Show in Finder**. Copia lì tutto il contenuto estratto, inclusi `.gitignore` e `.vercelignore`, sostituendo i file del progetto. Conserva la cartella `.git` esistente.
3. Nella radice del repository devono trovarsi direttamente `package.json`, `package-lock.json`, `vercel.json`, `index.html`, `src/` e `public/`. Non aggiungere una cartella intermedia `ProductVis_V003_1` o `productvis`.
4. In GitHub Desktop controlla le modifiche, scrivi **V003_1** nel campo Summary, esegui **Commit**, poi **Push origin** sul branch collegato a Vercel.

Il progetto Vercel collegato al repository ricompila i sorgenti ricevuti dal push. Non caricare lo ZIP dentro al repository.

## Configurazione Vercel

| Impostazione | Valore |
| --- | --- |
| Root Directory | Radice del repository |
| Framework | Vite |
| Install | `npm ci` |
| Build | `npm run build:vercel` |
| Output | `dist/client` |
| Variabili d’ambiente | Nessuna |

I comandi sono già in `vercel.json`. Anche `npm run build` compila l’app con Vite. Mantieni la versione Node.js già configurata nel progetto.

## Verifica locale

Con Node.js 22 o successivo, dalla cartella che contiene `package.json`:

```sh
npm ci
npm run build
npm test
npm run preview
```

Apri l’indirizzo HTTP indicato da Vite. L’apertura diretta di `index.html` non esegue correttamente i moduli e il modello.

## Contenuto della revisione

- Icone Phosphor Light; cinque assi in squircle con delta sul perimetro.
- History con perno centrale, tacche e punti per gli slot vuoti; ritorno al presente limitato agli stati esistenti.
- Proprietà, history e navbar compatte; una navbar su mobile e chevron per la modalità semplificata.
- Sorgenti, lockfile, test, asset locali e licenze. Dipendenze installate, build generate e configurazioni dell’ambiente di sviluppo escluse.

La confezione V003_1 conserva il codice dell’ultima revisione Phosphor. Build e test automatici verificano compilazione e logica; il collaudo visivo, touch, WebGL e video su dispositivo reale resta da completare.

Crediti del modello demo in `licenses/MODEL.md`; icone in `licenses/PHOSPHOR.txt`.
