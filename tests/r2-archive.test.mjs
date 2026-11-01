import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,timingSafeEqual} from 'node:crypto';
import worker from '../infra/docs-archive/worker.mjs';
// Cloudflare supplies this extension; Node does not.
crypto.subtle.timingSafeEqual = (a,b)=>timingSafeEqual(Buffer.from(a),Buffer.from(b));
class MockR2 {
  data=new Map();
  async head(key){return this.data.has(key)?{}:null;}
  async get(key){const b=this.data.get(key);return b?{body:true,arrayBuffer:async()=>Uint8Array.from(b).buffer}:null;}
  async put(key,value,options){assert.equal(options.onlyIf.get('if-none-match'),'*');if(this.data.has(key))return null;this.data.set(key,Uint8Array.from(value));return {};}
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const token='this-is-a-secret-token-32-bytes-minimum';
const env=()=>({FAMILY:'martlet',ARCHIVES:new MockR2(),ARCHIVE_WRITE_TOKEN:token});
const send=(env,path,{method='GET',body,auth=true,headers={}}={})=>worker.fetch(new Request('https://example.invalid'+path,{method,body,headers:{...(auth?{authorization:`Bearer ${token}`}:{}) ,...headers}}),env);
function manifestFor(version,bytes) {return {schemaVersion:1,family:'martlet',framework:'astro',docsVersion:version,basePath:`/docs/v/${version}/`,implementation:{kind:'npm',name:'@martlet/astro',version,tag:`v${version}`},core:{name:'@martlet/core',version:'2.2.3',integrity:`sha512-${Buffer.alloc(64,1).toString('base64')}`},source:{repository:'martletdesign/astro',commit:'a'.repeat(40),tag:`v${version}`},indexing:'noindex',files:[{path:'index.html',size:bytes.length,sha256:sha(bytes)}]};}
async function upload(env,version,bytes){const root=`/_archive/v/${version}/`,manifest=Buffer.from(JSON.stringify(manifestFor(version,bytes)));assert.equal((await send(env,root+'index.html',{method:'PUT',body:bytes})).status,201);assert.equal((await send(env,root+'manifest.json',{method:'PUT',body:manifest,headers:{'x-manifest-sha256':sha(manifest)}})).status,201);return manifest;}
test('conditional creation, complete manifest and independently retrievable bytes',async()=>{
 const e=env(),first=Buffer.from('<h1>first</h1>'),m=await upload(e,'2.0.0',first);
 assert.equal((await send(e,'/docs/v/2.0.0/')).status,200);assert.equal(await (await send(e,'/docs/v/2.0.0/')).text(),first.toString());
 assert.equal(sha(Buffer.from(await (await send(e,'/docs/v/2.0.0/manifest.json')).arrayBuffer())),sha(m));
 assert.equal((await send(e,'/_archive/v/2.0.0/index.html',{method:'PUT',body:'changed'})).status,409);
 await upload(e,'2.1.0',Buffer.from('<h1>second</h1>'));assert.equal(await (await send(e,'/docs/v/2.0.0/')).text(),first.toString());
 assert.equal((await send(e,'/docs/v/2.0.0/unknown.js')).status,404);
});
test('rejects unauthorized writes, incomplete commits, replacement and corrupted objects',async()=>{
 const e=env(),b=Buffer.from('expected'),m=Buffer.from(JSON.stringify(manifestFor('2.0.0',b))),root='/_archive/v/2.0.0/';
 assert.equal((await send(e,root+'index.html',{method:'PUT',body:b,auth:false})).status,401);
 assert.equal((await send(e,root+'manifest.json',{method:'PUT',body:m,headers:{'x-manifest-sha256':sha(m)}})).status,409);
 assert.equal((await send(e,root+'index.html',{method:'PUT',body:b})).status,201);
 assert.equal((await send(e,root+'index.html',{method:'PUT',body:'evil'})).status,409);
 assert.equal((await send(e,root+'manifest.json',{method:'PUT',body:m,headers:{'x-manifest-sha256':'f'.repeat(64)}})).status,400);
 assert.equal((await send(e,root+'manifest.json',{method:'PUT',body:m,headers:{'x-manifest-sha256':sha(m)}})).status,201);
 e.ARCHIVES.data.set('martlet/astro/2.0.0/index.html',Buffer.from('tampered'));
 assert.equal((await send(e,'/docs/v/2.0.0/')).status,503);
});
test('rejects unsafe identities and upload paths',async()=>{
 const e=env();assert.equal((await send(e,'/_archive/v/01.0.0/index.html',{method:'PUT',body:'x'})).status,404);
 assert.equal((await send(e,'/_archive/v/2.0.0/%2fetc',{method:'PUT',body:'x'})).status,400);
 const wrong=manifestFor('2.0.0',Buffer.from('a'));wrong.family='krigsvold';const m=Buffer.from(JSON.stringify(wrong));
 assert.equal((await send(e,'/_archive/v/2.0.0/manifest.json',{method:'PUT',body:m,headers:{'x-manifest-sha256':sha(m)}})).status,400);
});

test('client resumes interrupted upload, verifies remote bytes, and rejects a substituted trust anchor',async()=>{
 const {mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const {createManifest,sha256}=await import('../scripts/docs-versions/contract.mjs'),{publishCandidate,verifyPublished}=await import('../infra/docs-archive/client.mjs');
 const root=await mkdtemp(join(tmpdir(),'remote-archive-')),e=env(),version='2.0.0',dir=join(root,version),originalFetch=globalThis.fetch;
 try{
  await mkdir(dir);await writeFile(join(dir,'index.html'),'<meta name="robots" content="noindex"><h1>One</h1>');await writeFile(join(dir,'app.js'),'console.log(1)');
  const base=manifestFor(version,Buffer.from(''));
  delete base.files;Object.assign(base,{fixtures:{source:'repository'},toolchain:{node:'24.19.0',astro:'7.3.2'},createdAt:'2026-11-01T00:00:00.000Z'});
  const m=await createManifest(dir,base),bytes=Buffer.from(JSON.stringify(m,null,2)+'\n');await writeFile(join(dir,'manifest.json'),bytes);const expectedSha256=sha256(bytes);
  let failed=false;globalThis.fetch=async(url,opts)=>{if(!failed && String(url).endsWith('/index.html') && opts?.method==='PUT'){failed=true;throw Error('simulated interruption');}return worker.fetch(new Request(url,opts),e);};
  const options={base:'https://example.invalid',token,archiveRoot:root,version,expectedSha256};
  await assert.rejects(publishCandidate(options),/simulated interruption/);
  await publishCandidate(options);await publishCandidate(options);
  assert.equal((await verifyPublished(options)).files,2);
  await assert.rejects(verifyPublished({...options,expectedSha256:'f'.repeat(64)}),/digest mismatch/);
  e.ARCHIVES.data.set('martlet/astro/2.0.0/app.js',Buffer.from('tampered'));
  await assert.rejects(verifyPublished(options),/Missing archive file/);
 }finally{globalThis.fetch=originalFetch;await rm(root,{recursive:true,force:true});}
});
