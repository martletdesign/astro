import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {timingSafeEqual} from 'node:crypto';
import worker from '../infra/docs-archive/worker.mjs';
import {createManifest,sha256} from '../scripts/docs-versions/contract.mjs';
import {publishCandidate,advanceCatalog,advancePromotion} from '../infra/docs-archive/client.mjs';
import {checkpointBytes} from '../infra/docs-archive/checkpoint.mjs';
import {verifyCheckpointState} from '../infra/docs-archive/checkpoint-state.mjs';
crypto.subtle.timingSafeEqual=(a,b)=>timingSafeEqual(Buffer.from(a),Buffer.from(b));
const family=JSON.parse(await readFile(new URL('../docs-release-lock.json',import.meta.url),'utf8')).family,repository=`${family}design/astro`,tag='v2.0.0',commit='a'.repeat(40),object='b'.repeat(40),token='disposable-local-integration-token-only';
class R2{data=new Map();writes=0;async head(k){return this.data.has(k)?{}:null;}async get(k){const b=this.data.get(k);return b?{body:true,etag:sha256(b),arrayBuffer:async()=>Uint8Array.from(b).buffer}:null;}async put(k,v,o){this.writes++;const n=o.onlyIf.get('if-none-match'),m=o.onlyIf.get('if-match');if(n==='*'&&this.data.has(k))return null;if(m&&(!this.data.has(k)||m!==`"${sha256(this.data.get(k))}"`))return null;if(!n&&!m)throw Error('unconditional write');this.data.set(k,Uint8Array.from(v));return {};}}
test('signed checkpoint verifies archive, independent current heads and history; corrupt or stale state fails closed',async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'checkpoint-state-')),originalFetch=globalThis.fetch,bucket=new R2(),env={FAMILY:family,ARCHIVES:bucket,ARCHIVE_WRITE_TOKEN:token,DEPLOY_PREFIX:'/preview'};
 try{
  const archiveRoot=join(tmp,'archives'),dir=join(archiveRoot,'2.0.0');await mkdir(archiveRoot);await mkdir(dir);await writeFile(join(dir,'index.html'),'<meta name="robots" content="noindex"><h1>Reference</h1>');
  const metadata={schemaVersion:1,family,framework:'astro',docsVersion:'2.0.0',basePath:'/docs/v/2.0.0/',implementation:{kind:'npm',name:`@${family}/astro`,version:'2.0.0',tag},core:{name:`@${family}/core`,version:family==='martlet'?'2.2.3':'2.2.4',integrity:`sha512-${Buffer.alloc(64,1).toString('base64')}`},source:{repository,commit,tag},fixtures:{source:'repository'},toolchain:{node:'24.19.0',astro:'7.3.2'},createdAt:'2026-11-01T00:00:00.000Z',indexing:'noindex'};
  const manifest=await createManifest(dir,metadata),manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n'),manifestSha256=sha256(manifestBytes);await writeFile(join(dir,'manifest.json'),manifestBytes);
  globalThis.fetch=async(url,options)=>worker.fetch(new Request(url,options),env);
  const base='https://archive.invalid/preview';await publishCandidate({base,token,archiveRoot,version:'2.0.0',expectedSha256:manifestSha256});
  const entry={version:'2.0.0',channel:'stable',manifestSha256,supported:true,topics:['index.html']},catalog={schemaVersion:1,family,framework:'astro',previousSha256:null,latestStable:'2.0.0',versions:[entry]};
  const c=await advanceCatalog({base,token,catalog,expectedPreviousSha256:null});
  const promo={schemaVersion:1,family,framework:'astro',previousSha256:null,catalogSha256:c.headSha256,version:'2.0.0',operation:'promote',reason:''};
  const p=await advancePromotion({base,token,promotion:promo,expectedPreviousSha256:null,expectedCatalogSha256:c.headSha256});
  const cp={schemaVersion:1,family,framework:'astro',version:'2.0.0',source:{repository,tag,commit},manifestSha256,catalogSha256:c.headSha256,promotionSha256:p.headSha256,previous:null},identity={family,repository,tag,expectedCommit:commit};
  const bytes=checkpointBytes(cp,identity),expectedSha256=sha256(bytes),assetPath=join(tmp,'documentation-checkpoint.json');await writeFile(assetPath,bytes);
  const commands=[];const run=(program,args)=>{commands.push([program,...args]);if(program==='gh'&&args[0]==='api')return JSON.stringify({immutable:true,draft:false,tag_name:tag,assets:[{name:'documentation-checkpoint.json',digest:`sha256:${expectedSha256}`,size:bytes.length}]});if(program==='gh')return '';if(args[0]==='remote')return `https://github.com/${repository}.git`;if(args[0]==='rev-parse')return args[1].endsWith('^{commit}')?commit:object;if(args[0]==='ls-remote')return `${object}\trefs/tags/${tag}\n`;if(args[0]==='rev-list')return `${commit}\n`;throw Error('unexpected');};
  const args={...identity,base,assetPath,expectedSha256,expectedCatalogHeadSha256:c.headSha256,expectedPromotionHeadSha256:p.headSha256,run};
  const before=bucket.writes,result=await verifyCheckpointState(args);assert.equal(result.files,1);assert.equal(bucket.writes,before);
  // Retrying post-publication verification is entirely read-only.
  assert.equal((await verifyCheckpointState(args)).checkpointSha256,expectedSha256);assert.equal(bucket.writes,before);
  // A later framework release may advance both heads without rewriting the
  // earlier checkpoint; verify the earlier archive through both histories.
  const dir2=join(archiveRoot,'2.1.0');await mkdir(dir2);await writeFile(join(dir2,'index.html'),'<meta name="robots" content="noindex"><h1>Next</h1>');
  const meta2={...metadata,docsVersion:'2.1.0',basePath:'/docs/v/2.1.0/',implementation:{...metadata.implementation,version:'2.1.0',tag:'v2.1.0'},source:{...metadata.source,tag:'v2.1.0'}};
  const m2=await createManifest(dir2,meta2),b2=Buffer.from(JSON.stringify(m2,null,2)+'\n'),s2=sha256(b2);await writeFile(join(dir2,'manifest.json'),b2);
  await publishCandidate({base,token,archiveRoot,version:'2.1.0',expectedSha256:s2});
  const entry2={version:'2.1.0',channel:'stable',manifestSha256:s2,supported:true,topics:['index.html']},catalog2={...catalog,previousSha256:c.headSha256,latestStable:'2.1.0',versions:[entry,entry2]};
  const c2=await advanceCatalog({base,token,catalog:catalog2,expectedPreviousSha256:c.headSha256});
  const promo2={...promo,previousSha256:p.headSha256,catalogSha256:c2.headSha256,version:'2.1.0'};
  const p2=await advancePromotion({base,token,promotion:promo2,expectedPreviousSha256:p.headSha256,expectedCatalogSha256:c2.headSha256});
  const after=bucket.writes,newHeads={...args,expectedCatalogHeadSha256:c2.headSha256,expectedPromotionHeadSha256:p2.headSha256};
  assert.equal((await verifyCheckpointState(newHeads)).checkpointSha256,expectedSha256);assert.equal(bucket.writes,after);
  await assert.rejects(verifyCheckpointState({...args,expectedCatalogHeadSha256:'f'.repeat(64)}),/digest mismatch/);
  await assert.rejects(verifyCheckpointState({...newHeads,expectedPromotionHeadSha256:'e'.repeat(64)}),/digest mismatch/);
  await assert.rejects(verifyCheckpointState({...args,expectedSha256:'d'.repeat(64)}),/digest mismatch/);
  await assert.rejects(verifyCheckpointState({...args,run:(program,argv)=>{if(program==='gh'&&argv[1]==='verify-asset')throw Error('invalid signature');return run(program,argv);}}),/invalid signature/);
  bucket.data.set(`${family}/astro/2.0.0/index.html`,Buffer.from('tampered'));
  await assert.rejects(verifyCheckpointState(newHeads),/Archive history unavailable/);assert.equal(bucket.writes,after);
  assert.ok(commands.every(c=>!['create','upload','edit','publish','delete'].includes(c[2])));
 }finally{globalThis.fetch=originalFetch;await rm(tmp,{recursive:true,force:true});}
});
