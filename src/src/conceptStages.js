// Compatibility entry point; experimental stage builders have been retired.
import { createEnvironmentStage } from './environmentStage.js';
export function createConceptStage(config,coarse=false){return createEnvironmentStage(config,coarse);}
