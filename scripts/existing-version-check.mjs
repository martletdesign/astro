import {registryState} from './tag-release-guard.mjs';
const state=await registryState(url=>fetch(url,{signal:AbortSignal.timeout(15000),redirect:'error'}),'https://registry.npmjs.org/','@martlet/astro','1.2.2');
if(state!=='present') throw Error(`Known published version must be rejected; registry state: ${state}`);
console.log('Known published version correctly classified as present');
