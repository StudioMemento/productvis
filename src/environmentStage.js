import { createRingStage } from './stages/ring.js';
import { createRainStage } from './stages/rain.js';
import { createVelocityStage } from './stages/velocity.js';
import { createAmberHaloStage } from './stages/amberHalo.js';
import { createWaterStage } from './stages/water.js';
import { createCloudStage } from './stages/cloud.js';
import { createAtmosphereStage } from './stages/atmosphere.js';
export { CUSTOM_SCENES } from './state.js';
export function seededRandom(seed){let a=seed|0;return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
const factories={ring:createRingStage,rain:createRainStage,'velocity-lines':createVelocityStage,'amber-halo':createAmberHaloStage,water:createWaterStage,cloud:createCloudStage,aurora:createAtmosphereStage,dust:createAtmosphereStage};
export function createEnvironmentStage(config,coarse=false,horizon){return factories[config.preset]?.(config,coarse,horizon)||null;}
