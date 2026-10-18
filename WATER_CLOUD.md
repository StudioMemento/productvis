# Water, Cloud e orizzonte continuo · 18 ottobre 2026

La revisione risolve la giunzione visibile tra pavimento e fondale segnalata negli screenshot di Studio e Amber Halo e aggiunge due ambienti selezionabili in **ENV**: **Water** e **Cloud**. La UI a cinque assi, i materiali del prodotto e l'inquadratura corrente restano indipendenti.

## Orizzonte

Pavimento e fondale condividono la stessa funzione di colore in spazio lineare. Una transizione quintica passa dal materiale al cielo fra 15 e 58 unità normalizzate di scena (18–58 per Cloud), prima della fine delle geometrie. Il fondale segue la direzione della camera, senza esporre un bordo della sfera. La foschia di raccordo rimane anche impostando Nebbia a zero.

Il riflesso del pavimento si attenua prima del limite del render target e lungo il suo perimetro. Su Cloud è ritagliato al disco del basamento. Restano visibili i bordi fisici intenzionali degli oggetti, come il cubo e il basamento.

## Water

Acqua intorno a un basamento circolare con accento luminoso; eclissi sullo sfondo, ispirata alla reference Tidal Eclipse. La superficie usa onde direzionali per il rilievo, normali animate per il dettaglio e increspature circolari attorno al basamento. I riflessi combinano l'ambiente PBR e una cattura planare del set, distorta dalle onde.

| Controllo | Effetto |
| --- | --- |
| Onde | Ampiezza delle onde ampie. |
| Frequenza | Distanza tra le onde. |
| Increspature | Anelli concentrici e dettaglio delle normali. |
| Flusso acqua | Velocità; zero ferma la fase corrente. |
| Riflesso / Superficie | Contributo planare e rugosità. |

La geometria polare ha più dettaglio vicino al prodotto: 4.608 triangoli desktop, 2.048 su touch. Non è una simulazione fluidodinamica né implementa rifrazione fisica dello spessore dell'acqua. In qualità Fluida il riflesso planare viene disabilitato; restano shading e riflessi PBR.

## Cloud

Basamento in una coltre di nuvole, ispirato alla reference Mist Island. Lo shader campiona un volume di rumore 3D di 32³ texel, combina tre scale di dettaglio e integra la densità lungo il raggio. Il centro è svuotato per lasciare leggibile il prodotto; i margini del volume si dissolvono prima del termine del piano. La profondità usa il primo campione partecipante, per rispettare l'occlusione del prodotto e del basamento.

| Controllo | Effetto |
| --- | --- |
| Densità cloud | Copertura e spessore ottico; zero nasconde il volume. |
| Dettaglio cloud | Scala delle forme di densità. |
| Quota | Posizione verticale in unità normalizzate, non metri del GLB originale. |
| Spessore | Estensione verticale della coltre. |
| Flusso cloud | Velocità; zero ferma la fase corrente. |

Budget di campionamento: Fluida 8 passi; Auto 14 desktop / 10 touch; Alta 20 desktop / 14 touch. Illuminazione e densità sono approssimazioni artistiche controllate, non scattering atmosferico completo. Le risorse del volume vengono rilasciate al cambio di stage.

## Integrazione

Tutti i nuovi valori sono salvati e validati nel `.pvis`, con default per i file precedenti. Generazione ENV, lucchetti, reset e history seguono il comportamento approvato. Le variazioni non ricostruiscono le geometrie né riavviano la camera. Movimento ridotto e flusso zero fermano l'animazione; il playblast ripristina la fase precedente alla cattura.

## Verifiche e limiti

- 155 test Node superati: roundtrip, valori limite, isolamento degli assi, clock, budget, orientamento della superficie acqua, matrice di riflessione in coordinate mondo e rilascio delle texture.
- Compilazione e linking di 15 programmi shader, espansi attraverso la versione Three.js installata, con OpenGL ES 3.2 Mesa/llvmpipe. Questo verifica la sintassi e l'interfaccia tra vertex e fragment shader nelle configurazioni controllate; non è una prova degli FPS su GPU hardware.
- Browser cloud: selezione Water/Cloud e controlli visibili; Densità cloud 60 → 74 → Undo 60 verificati.
- Il browser non supporta WebGL e mostra il fallback dichiarato. Fedeltà visiva, qualità dei riflessi, trasparenze, DOF e fluidità finale richiedono verifica su desktop e telefono con WebGL attivo.

Per confrontare gli screenshot: provare Studio e Amber Halo con Nebbia a zero e camera bassa, poi orbitare Water/Cloud. Verificare soprattutto l'orizzonte, il contorno del basamento, materiali trasparenti e qualità Auto/Fluida. Nessun deploy Vercel implicito: il pacchetto è portabile.
