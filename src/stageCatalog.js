// Art direction lives beside the procedural sets, with no external texture assets.
const stage = (id, name, family, description, background, groundColor, ringColor, lighting, camera, effect, extra = {}) => ({
  id, name, family, description, lighting, camera, effect,
  theme: { background, groundColor, ringColor, fog: .12, reflection: .22, floorRoughness: .32, density: .45, height: 1, spread: 1, scale: 1, weather: .55, speed: .6, ...extra },
});
export const CONCEPT_STAGES = [
  stage('black-softbox','Black Softbox','clean','Luce sospesa, grafite e spazio negativo.','#07090c','#171b21','#dbe8f3','softbox','hero',null,{reflection:.12,floorRoughness:.5}),
  stage('pearl-infinity','Pearl Infinity','clean','Un fondale continuo di luce perlacea.','#bcc6ce','#d8dce0','#ffffff','showroom','hero',null,{fog:.05,reflection:.1,floorRoughness:.62}),
  stage('amber-horizon','Amber Horizon','clean','Una linea ambra attraversa il vuoto.','#11100f','#202021','#ffb45d','warm','low','pulse'),
  stage('halo-floor','Halo Floor','clean','Un anello aperto incornicia il prodotto.','#09111a','#1a2630','#8fe3f0','rim','hero','pulse'),
  stage('concrete-cut','Concrete Cut','clean','Cemento, una fenditura e luce radente.','#343536','#656866','#ffdea0','split','hero',null,{reflection:.08,floorRoughness:.8}),
  stage('neon-gate','Neon Gate','clean','Un solo portale ciano nel buio.','#090d19','#192031','#73e6ff','neon','front','pulse'),
  stage('rain-veil','Rain Veil','clean','Pioggia sullo sfondo, riflessi sul piano.','#0b1720','#172d36','#a3dce9','moon','hero','rain',{reflection:.5,floorRoughness:.12}),
  stage('twin-blades','Twin Blades','clean','Due lame di luce scolpiscono la silhouette.','#141016','#2c2530','#eba8de','bicolor','front',null),
  stage('mist-island','Mist Island','clean','Un basamento sospeso in una nebbia infinita.','#263b42','#667e83','#bae9df','overcast','hero','mist',{fog:.3,reflection:.12}),
  stage('velocity-lines','Velocity Lines','clean','Scie laterali e un centro perfettamente fermo.','#080e18','#172132','#71c9ff','neon','low','trails',{reflection:.35}),
  stage('neon-rain-cathedral','Neon Rain Cathedral','elaborate','Portali seriali, pioggia e profondità elettrica.','#090c1a','#171c31','#a991ff','neon','front','rain',{reflection:.5,floorRoughness:.12}),
  stage('endless-monoliths','Endless Monoliths','elaborate','Stele di pietra scompaiono nella foschia.','#25232c','#54515e','#e4bfd5','overcast','hero','mist',{fog:.3,floorRoughness:.6}),
  stage('brutalist-orbit','Brutalist Orbit','elaborate','Un oculo monumentale sopra un’arena di cemento.','#182128','#535e63','#d0e9ee','top','wide',null,{reflection:.12,floorRoughness:.75}),
  stage('hyperdrive','Hyperdrive','elaborate','Un tunnel di costole e scie ad alta velocità.','#070c18','#171f32','#68c9ff','neon','front','trails',{reflection:.4}),
  stage('tidal-eclipse','Tidal Eclipse','elaborate','Acqua scura e un’eclissi sospesa all’orizzonte.','#10222b','#263b43','#edd5a3','moon','hero','water',{fog:.08,reflection:.42}),
  stage('aurora-vault','Aurora Vault','elaborate','Nastri di aurora sopra un paesaggio minerale.','#101e2d','#34404f','#70ebc0','moon','wide','aurora',{fog:.19}),
  stage('ember-rift','Ember Rift','elaborate','Una frattura luminosa tra rocce scure.','#181315','#342c2a','#ff9051','sunset','low','pulse',{reflection:.12,floorRoughness:.65}),
  stage('kinetic-gallery','Kinetic Gallery','elaborate','Cornici inclinate e luce in sequenza.','#27292d','#6c7076','#ffcb8e','showroom','hero','pulse',{reflection:.22,floorRoughness:.4}),
  stage('signal-garden','Signal Garden','elaborate','Un campo di segnali luminosi, tra scultura e tecnologia.','#10191e','#29393b','#91ebd4','bicolor','hero','pulse'),
  stage('midnight-skydeck','Midnight Skydeck','elaborate','Una terrazza brutalista sopra la città notturna.','#0c1728','#344353','#dfac84','rim','hero','rain',{reflection:.35,weather:.25}),
].map((item, index) => ({ ...item, number: String(index + 1).padStart(2, '0') }));
export const STAGE_BY_ID = Object.fromEntries(CONCEPT_STAGES.map(item => [item.id, item]));
