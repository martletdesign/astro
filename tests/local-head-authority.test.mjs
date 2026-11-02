import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {initializeLocalHeadAuthority,localHeadAuthority} from '../infra/docs-archive/local-head-authority.mjs';
import {reconcileVerifiedRelease} from '../infra/docs-archive/release-orchestration.mjs';
const a='a'.repeat(64),b='b'.repeat(64),c='c'.repeat(64);
async function fixture(fn){const dir=await mkdtemp(join(tmpdir(),'nightjar-independent-head-'));try{
 const authorityPath=join(dir,'authority.git');execFileSync('git',['init','--bare',authorityPath],{stdio:'ignore'});
 const options={mode:'nonproduction',authorityPath,family:'martlet',framework:'astro'};
 const anchor=initializeLocalHeadAuthority(options);await fn({options:{...options,...anchor},dir});
}finally{await rm(dir,{recursive:true,force:true});}}
test('durable independent head advances by expected digest and survives process reopen',async()=>fixture(async({options})=>{
 const authority=localHeadAuthority(options);assert.equal(await authority.readHead(),null);
 assert.equal(await authority.compareAndSwapHead(null,a),true);
 const reopened=localHeadAuthority(options);assert.equal(await reopened.readHead(),a);
 assert.equal(await reopened.compareAndSwapHead(null,b),false);assert.equal(await reopened.readHead(),a);
 assert.equal(await reopened.compareAndSwapHead(a,b),true);assert.equal(await authority.readHead(),b);
 assert.throws(()=>initializeLocalHeadAuthority(options),/already initialized/);
}));
test('production, unpinned bootstrap, remote transport and substituted identity fail closed',async()=>fixture(async({options})=>{
 assert.throws(()=>localHeadAuthority({...options,mode:'production'}),/not configured/);
 assert.throws(()=>localHeadAuthority({...options,anchorCommit:undefined}),/pinned bootstrap/);
 await assert.rejects(localHeadAuthority({...options,framework:'react'}).readHead(),/identity/);
 await assert.rejects(localHeadAuthority({...options,anchorCommit:'f'.repeat(40)}).readHead(),/parent or checkpoint/);
 execFileSync('git',['--git-dir',options.authorityPath,'remote','add','origin','https://example.invalid/authority.git']);
 assert.throws(()=>localHeadAuthority(options),/no remote/);
}));
test('rollback or substituted branch cannot pass an externally pinned current digest',async()=>fixture(async({options})=>{
 const authority=localHeadAuthority(options);await authority.compareAndSwapHead(null,a);await authority.compareAndSwapHead(a,b);
 // A privileged writer can still reset local storage; detection requires the
 // independently retained current digest and is never called protection.
 execFileSync('git',['--git-dir',options.authorityPath,'update-ref',options.ref,options.anchorCommit]);
 assert.notEqual(await authority.readHead(),b);
 assert.equal(await authority.compareAndSwapHead(b,c),false);
}));
test('real durable CAS integrates release reconciliation and idempotent retry without publishing',async()=>fixture(async({options})=>{
 const authority=localHeadAuthority(options);await authority.compareAndSwapHead(null,a);
 const candidate={previousHead:a,version:'2.0.0',sourceCommit:'f'.repeat(40),checkpointSha256:b,manifestSha256:c,catalogSha256:'d'.repeat(64),promotionSha256:'e'.repeat(64)};
 let promoted=false,fail=true;const callbacks={...authority,previousHead:a,candidate,verifyPrior:async()=>true,verifyArchive:async()=>true,verifyRegistry:async()=>true,verifyAttestation:async()=>({...candidate,sha256:b}),applyPromotion:async()=>{promoted=true;return true;},verifyPromotion:async()=>promoted,compareAndSwapHead:async(...args)=>{if(fail){fail=false;return false;}return authority.compareAndSwapHead(...args);}};
 await assert.rejects(reconcileVerifiedRelease(callbacks),/compare-and-swap/);assert.equal(await authority.readHead(),a);
 assert.equal((await reconcileVerifiedRelease(callbacks)).recovered,false);assert.equal(await localHeadAuthority(options).readHead(),b);
 assert.equal((await reconcileVerifiedRelease(callbacks)).recovered,true);
}));

test('competing independent processes cannot both advance the same expected head',async()=>fixture(async({options})=>{
 const {spawn}=await import('node:child_process');
 const authority=localHeadAuthority(options);await authority.compareAndSwapHead(null,a);
 const moduleURL=new URL('../infra/docs-archive/local-head-authority.mjs',import.meta.url).href;
 const results=await Promise.all(Array.from({length:6},(_,i)=>new Promise((resolve,reject)=>{
  const script=`import {localHeadAuthority} from ${JSON.stringify(moduleURL)};const h=localHeadAuthority(JSON.parse(process.argv[1]));console.log(await h.compareAndSwapHead(process.argv[2],process.argv[3]));`;
  const child=spawn(process.execPath,['--input-type=module','-e',script,JSON.stringify(options),a,String(i+1).repeat(64)],{stdio:['ignore','pipe','pipe']});let out='',err='';
  child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',reject);child.on('exit',code=>code===0?resolve(out.trim()==='true'):reject(Error(err)));
 })));
 assert.equal(results.filter(Boolean).length,1);
 assert.notEqual(await localHeadAuthority(options).readHead(),a);
}));

test('rewriting authority history to an unanchored root fails verification',async()=>fixture(async({options})=>{
 const authority=localHeadAuthority(options);await authority.compareAndSwapHead(null,a);
 const git=(...args)=>execFileSync('git',['--git-dir',options.authorityPath,...args],{encoding:'utf8',env:{...process.env,GIT_AUTHOR_NAME:'Test',GIT_AUTHOR_EMAIL:'test@example.invalid',GIT_COMMITTER_NAME:'Test',GIT_COMMITTER_EMAIL:'test@example.invalid'}}).trim();
 const tree=git('rev-parse',`${options.ref}^{tree}`),orphan=git('commit-tree',tree,'-m','substituted unanchored root');git('update-ref',options.ref,orphan);
 await assert.rejects(authority.readHead(),/parent or checkpoint/);
}));
