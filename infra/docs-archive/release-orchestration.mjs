// Nonpublishing orchestration prototype. Callbacks are injected intentionally:
// production head authority and GitHub/R2 permissions are not configured.
// There is no npm publish or release creation operation in this module.
const digest=/^[a-f0-9]{64}$/;
import {parseVersion} from '../../scripts/docs-versions/contract.mjs';
function need(ok,message){if(!ok)throw Error(message);}
export async function reconcileVerifiedRelease({previousHead,candidate,allowBootstrap=false,readHead,verifyPrior,verifyArchive,verifyRegistry,verifyAttestation,applyPromotion,verifyPromotion,compareAndSwapHead}){
 need(previousHead===null||digest.test(previousHead||''),'Invalid independent prior head');
 need(previousHead!==null||allowBootstrap===true,'Explicit bootstrap baseline required');
 const version=parseVersion(candidate?.version);
 for(const k of ['checkpointSha256','manifestSha256','catalogSha256'])need(digest.test(candidate?.[k]||''),`Invalid candidate ${k}`);
 need(digest.test(candidate?.promotionSha256||'')||(version.channel==='prerelease'&&candidate.promotionSha256===null),'Invalid candidate promotionSha256');
 need(/^[a-f0-9]{40}$/.test(candidate.sourceCommit||''),'Invalid candidate source commit');
 need(candidate.previousHead===previousHead,'Candidate is not bound to prior head');
 const observed=await readHead();need(observed===previousHead||observed===candidate.checkpointSha256,'Independent head changed or unavailable');
 need(await verifyPrior(previousHead)===true,'Prior checkpoint was not verified');
 need(await verifyArchive(candidate)===true,'Candidate archive or catalog failed verification');
 // This callback must independently verify an already-published registry
 // artifact. It must not publish or treat a missing version as success.
 need(await verifyRegistry(candidate)===true,'Registry artifact was not verified');
 const attested=await verifyAttestation(candidate);
 need(attested?.sha256===candidate.checkpointSha256&&attested.manifestSha256===candidate.manifestSha256&&attested.catalogSha256===candidate.catalogSha256&&attested.promotionSha256===candidate.promotionSha256&&attested.previousHead===previousHead&&attested.version===candidate.version&&attested.sourceCommit===candidate.sourceCommit,'Attestation does not bind the candidate and prior head');
 // The promotion callback must use a pinned previous pointer and be
 // byte-identical/idempotent on retry. Its result is verified independently.
 const latestHead=await readHead();need(latestHead===previousHead||latestHead===candidate.checkpointSha256,'Independent head changed before promotion');
 if(version.channel==='stable')need(await applyPromotion(candidate)===true,'Promotion failed');
 need(await verifyPromotion(candidate)===true,'Promotion verification failed');
 if(latestHead!==candidate.checkpointSha256){
   need(await compareAndSwapHead(previousHead,candidate.checkpointSha256)===true,'Independent head compare-and-swap failed');
 }
 need(await readHead()===candidate.checkpointSha256,'Independent head not persisted');
 return {checkpointSha256:candidate.checkpointSha256,recovered:observed===candidate.checkpointSha256};
}
