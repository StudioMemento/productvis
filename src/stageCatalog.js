// One registry drives UI, validation and generation. Add a factory in stages/ for a new set.
const common={fog:.12,reflection:.22,floorRoughness:.36,density:.45,height:1,spread:1,scale:1,weather:.55,speed:.6,particles:0};
const stage=(id,name,lighting,camera,theme,extra={})=>({id,name,lighting,camera,theme:{...common,...theme},...extra});
export const STAGES=[
  stage('void','Void','split','profile',{background:'#07090c',groundColor:'#1b1f25',ringColor:'#ffb020',fog:.08,reflection:0}),
  stage('cubes','Cube','rim','hero',{background:'#101722',groundColor:'#272e38',ringColor:'#ffb020',fog:.25,reflection:.27,particles:.25}),
  stage('studio','Studio','softbox','hero',{background:'#303741',groundColor:'#45494f',ringColor:'#e8e1d7',fog:.08}),
  stage('rain','Rain','moon','hero',{background:'#111922',groundColor:'#222a34',ringColor:'#8fb8df',reflection:.4,floorRoughness:.18},{effect:'rain'}),
  stage('ring','Ring','rim','hero',{background:'#080b10',groundColor:'#191e25',ringColor:'#ffc076',reflection:.18,floorRoughness:.42},{factory:'ring'}),
  stage('velocity-lines','Velocity Lines','neon','low',{background:'#080e18',groundColor:'#172132',ringColor:'#71c9ff',reflection:.3,floorRoughness:.23},{factory:'velocity',effect:'trails'}),
];
export const STAGE_BY_ID=Object.fromEntries(STAGES.map(s=>[s.id,s]));
export const CONCEPT_STAGES=STAGES.filter(s=>s.factory);
// Opening old projects keeps the model/materials and maps retired environments.
export const RETIRED_STAGES={
  cinema:'studio',particles:'void',grid:'studio',desert:'cubes',mountain:'cubes',urban:'rain',tunnel:'velocity-lines',road:'velocity-lines',monolith:'cubes',
  'black-softbox':'studio','pearl-infinity':'studio','amber-horizon':'void','halo-floor':'ring','concrete-cut':'cubes','neon-gate':'ring','rain-veil':'rain','twin-blades':'studio','mist-island':'cubes',
  'neon-rain-cathedral':'rain','endless-monoliths':'cubes','brutalist-orbit':'ring',hyperdrive:'velocity-lines','tidal-eclipse':'ring','aurora-vault':'void','ember-rift':'cubes','kinetic-gallery':'studio','signal-garden':'void','midnight-skydeck':'rain'
};
