# ProductVis · V14 · Vercel

Versione del 13 ottobre 2026, sorgente `b62161c56c8573af8e48fe6cfdf9594638bc29bd`.
La cartella **productvis** contiene il progetto pronto per Vercel e la build statica in `dist/client`.
Le istruzioni sono in **DEPLOY_VERCEL.md**.

## Contenuto

- 34 ambienti: 10 Clean, 10 Elaborate e 14 Classici. I nuovi stage sono procedurali, con neon, pioggia, scie, nebbia, cemento, acqua, eclissi e aurora.
- Progetto, Ispeziona e Render sopra MAT, ENV, LIGHT, CAM e FX. Un’unica tendina attiva, separatori sottili, chiusura con secondo click, X, Escape o click esterno.
- Sparkle combina ambiente, luce, camera e movimento. Il delta controlla l’ampiezza delle variazioni; sotto 70 conserva i materiali. I 20 concept sono inclusi nel random.
- Ispeziona comprende clip GLB, play/pausa/stop, posizione, velocità e loop; movimento di presentazione; wireframe, mix, normali e sezioni XYZ. Per il modello demo privo di clip sono disponibili i movimenti di scena.
- Importazione GLB incorporati, materiali/PBR/UV, trasformazioni, salvataggio e apertura `.pvis`, PNG e playblast del canvas.
- UI flottante Memento, logo centrato in alto, Hide UI / Sparkle / delta in basso. Layout desktop, portrait e landscape.

## Avvio locale

Usa Node.js 22.x ed esegui dalla cartella che contiene `package.json`:

```sh
npm ci
npm run dev
```

Per ricostruire e verificare:

```sh
npm run build
npm test
npm run preview
```

`build` e `build:vercel` compilano entrambi in `dist/client`. Apri l’indirizzo HTTP mostrato da Vite; il doppio click su `index.html` non è sufficiente per moduli e GLB.
Non sono richiesti backend, account o variabili d’ambiente. I file importati sono elaborati nel browser.

## Verifica

Build portabile e 79 test automatici dell’app verificati dalla cartella esportata. I 4 test del Worker privato di sviluppo sono esclusi dal pacchetto Vercel.
Le verifiche coprono stato, scene, animazioni, geometrie, navigazione, struttura React, camera, materiali e logica di esportazione. Non certificano la resa WebGL, i codec video, la fluidità GPU o il comportamento touch su un dispositivo reale.

## Rendering

Il motore Three.js è caricato separatamente dalla UI. I set condividono geometrie e usano istanze; non scaricano immagini di ambiente. Bloom massimo 0.1. Il rendering dorme quando non ci sono movimenti o effetti attivi e si sospende quando la scheda è nascosta.
WebGL 2 è necessario per il 3D; senza supporto compare un riferimento statico dichiarato. Importa GLB con risorse incorporate (fino a 120 MB); KTX2/Basis e risorse esterne non sono supportati.
Il playblast è una cattura in tempo reale del canvas: MP4/WebM secondo il browser, 720/1080, 16:9/9:16/1:1, 2–20 secondi, 24/30/60 FPS richiesti. Gli FPS effettivi dipendono dal dispositivo. Per lo sfondo trasparente usa PNG.

## Crediti


Modello: **2015 Rocket Bunny Racing Honda NSX**, **Ddiaz Design**.

- Autore: https://sketchfab.com/ddiaz-design
- Fonte: https://sketchfab.com/3d-models/2015-rocket-bunny-racing-honda-nsx-e30ef65ebbcc4526bc727edcce93c9b3
- Licenza dichiarata dal GLB: **CC BY-NC-SA 4.0** — https://creativecommons.org/licenses/by-nc-sa/4.0/

Modello recuperato dalla demo ProductVis fornita dall'utente; geometria e texture originali sono conservate. Il colore grafite iniziale è un overlay in fase di rendering, ripristinabile con “Originale”.

Icone: Tabler Icons. Font: Inter. Immagini statiche di riserva generate per questa esplorazione; non attestano la resa del renderer Three.js.
