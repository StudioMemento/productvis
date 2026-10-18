// One registry drives UI, validation and generation. Add a factory in stages/ for a new set.
import { HALO_DEFAULTS } from './stages/amberHaloSettings.js';
import { NATURE_DEFAULTS } from './stages/natureSettings.js';
const common={...HALO_DEFAULTS,...NATURE_DEFAULTS,fog:.12,reflection:.22,floorRoughness:.36,density:.45,height:1,spread:1,scale:1,weather:.55,speed:.6,particles:0};
const stage=(id,name,lighting,camera,theme,extra={})=>({id,name,lighting,camera,theme:{...common,...theme},...extra});
export const STAGES=[
  stage('amber-halo','Amber Halo','halo','wide',{background:'#070a0f',groundColor:'#363b43',ringColor:'#ffb860',fog:.32,reflection:.32,floorRoughness:.56,speed:.35},{factory:'amber-halo',effect:'mist'}),
  stage('water','Water','halo','wide',{background:'#0a111c',groundColor:'#364657',ringColor:'#ffd2a0',fog:.18,reflection:.65,floorRoughness:.25,speed:.45},{factory:'water',effect:'water'}),
  stage('cloud','Cloud','overcast','wide',{background:'#1c2332',groundColor:'#626d80',ringColor:'#e3d6c7',fog:.25,reflection:.17,floorRoughness:.48,speed:.35},{factory:'cloud',effect:'cloud'}),
  stage('aurora','Aurora','bicolor','wide',{background:'#070c18',groundColor:'#26333f',ringColor:'#6adbb7',fog:.2,reflection:.27,floorRoughness:.34,weather:.75,density:.55,height:1,spread:1,speed:.3},{factory:'aurora',effect:'aurora'}),
  stage('dust','Dust','sunset','hero',{background:'#171218',groundColor:'#51433c',ringColor:'#ffd2a0',fog:.32,reflection:.15,floorRoughness:.65,weather:.65,density:.6,height:.7,spread:1,speed:.4},{factory:'dust',effect:'dust'}),
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
