import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {acceptedMainRun,normalizedArchive,dispatchPublication,completePublication,githubClient,publishedArchive} from '../scripts/auto-publication.mjs';
const repository='martletdesign/astro',name='@martlet/astro',repoPath='/repos/'+repository;
const runEvent=sha=>({repository:{full_name:repository},workflow_run:{name:'Fast acceptance',path:'.github/workflows/acceptance.yml',workflow_id:42,event:'push',conclusion:'success',head_branch:'main',head_sha:sha,repository:{full_name:repository},head_repository:{full_name:repository}}});
async function fixture(work) {
 const directory=await mkdtemp(join(tmpdir(),'astro-publication-test-')),root=join(directory,'repo'),previous=process.cwd();await mkdir(root);
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try {
  git(['init','-b','main']);git(['config','user.name','Publication fixture']);git(['config','user.email','publication@example.test']);
  const peerDependencies={'@martlet/core':'^2.2.4'},pkg={name,version:'2.0.3',private:true,repository:{url:'git+https://github.com/'+repository+'.git'},peerDependencies,files:['src','starter','README.md','LICENSE']};
  for(const dir of ['src','starter'])await mkdir(join(root,dir));
  await writeFile(join(root,'package.json'),JSON.stringify(pkg,null,2)+'\n');
  await writeFile(join(root,'package-lock.json'),JSON.stringify({name,version:pkg.version,lockfileVersion:3,packages:{'':{name,version:pkg.version,peerDependencies}}}));
  await writeFile(join(root,'CHANGELOG.md'),'# Changelog\n\n## 2.0.3\n\nFixture.\n');
  await writeFile(join(root,'README.md'),'Publication fixture.\n');await writeFile(join(root,'LICENSE'),'MIT\n');
  await writeFile(join(root,'src/index.ts'),'export const fixture = true;\n');await writeFile(join(root,'starter/index.html'),'<h1>Fixture</h1>\n');
  git(['add','.']);git(['commit','-m','Accepted source']);const sha=git(['rev-parse','HEAD']);git(['update-ref','refs/remotes/origin/main',sha]);
  process.chdir(root);await work({directory,root,git,sha,pkg});
 } finally {process.chdir(previous);await rm(directory,{recursive:true,force:true});}
}
function apiFixture(sha,options={}) {
 const calls=[];let tagPresent=options.tagPresent??false;
 const api=async(path,method='GET',body)=>{
  calls.push({path,method,body});
  if(method==='GET'&&path===repoPath)return {status:200,body:{full_name:repository}};
  if(method==='GET'&&path===repoPath+'/git/ref/heads/main')return {status:200,body:{ref:'refs/heads/main',object:{type:'commit',sha}}};
  if(method==='GET'&&path===repoPath+'/actions/workflows/acceptance.yml')return {status:200,body:{id:options.workflowId??42,path:'.github/workflows/acceptance.yml'}};
  if(method==='GET'&&path===repoPath+'/git/ref/tags/v2.0.3')return tagPresent?{status:200,body:{ref:'refs/tags/v2.0.3',object:{type:'commit',sha:options.tagSha??sha}}}:{status:404,body:{message:'Not Found'}};
  if(method==='POST'&&path===repoPath+'/git/refs'){tagPresent=true;return {status:options.createStatus??201,body:null};}
  if(method==='POST'&&path.endsWith('/dispatches'))return {status:204,body:null};
  throw Error('Unexpected API operation '+method+' '+path);
 };
 return {api,calls};
}
const absentRegistry=async url=>url.endsWith('/2.0.3')?new Response('{"error":"Not found"}',{status:404}):new Response(JSON.stringify({name,versions:{}}),{status:200});

test('only the successful exact current same-repository main push acceptance run authorizes automatic publication',()=>{
 const sha='a'.repeat(40);assert.equal(acceptedMainRun(runEvent(sha),repository,sha),true);
 for(const change of [e=>e.workflow_run.event='pull_request',e=>e.workflow_run.conclusion='failure',e=>e.workflow_run.head_branch='develop',e=>e.workflow_run.head_sha='b'.repeat(40),e=>e.repository.full_name='foreign/repo',e=>e.workflow_run.repository.full_name='foreign/repo',e=>e.workflow_run.head_repository.full_name='foreign/repo',e=>e.workflow_run.path='.github/workflows/foreign.yml',e=>e.workflow_run.name='Different acceptance']){
  const event=runEvent(sha);change(event);assert.equal(acceptedMainRun(event,repository,sha),false);
 }
});

test('the real normalized archive preserves public bytes across workflow-only commits and detects changed package contents',()=>fixture(async({directory,root,git})=>{
 const one=await normalizedArchive(root,join(directory,'one'));
 const manifest=JSON.parse(execFileSync('tar',['-xOzf',one.archive,'package/package.json'],{encoding:'utf8'}));assert.equal(manifest.private,false);assert.equal(manifest.name,name);
 await mkdir(join(root,'.github'));await writeFile(join(root,'.github/workflow-only.txt'),'Workflow changed');git(['add','.']);git(['commit','-m','Workflow-only source']);
 const two=await normalizedArchive(root,join(directory,'two'));assert.equal(one.sha256,two.sha256);
 await writeFile(join(root,'starter/index.html'),'<h1>Changed shipped starter</h1>');git(['add','.']);git(['commit','-m','Changed starter']);
 const three=await normalizedArchive(root,join(directory,'three'));assert.notEqual(two.sha256,three.sha256);
}));

test('watcher dispatches the same trusted workflow with exact SHA, normalized digest, stable tag and direct mode',()=>fixture(async({directory,root,sha})=>{
 const {api,calls}=apiFixture(sha);
 const result=await dispatchPublication({event:runEvent(sha),root,api,fetcher:absentRegistry,temporary:join(directory,'dispatch')});
 assert.equal(result.status,'dispatched');const writes=calls.filter(x=>x.method==='POST');assert.equal(writes.length,1);
 assert.equal(writes[0].path,repoPath+'/actions/workflows/stage.yml/dispatches');
 assert.deepEqual(writes[0].body,{ref:'main',inputs:{approved_sha:sha,artifact_sha256:result.archiveSha256,distribution_tag:'latest',publish_mode:'publish'}});
 assert.match(result.archiveSha256,/^[a-f0-9]{64}$/);
}));

test('forks, obsolete accepted runs and workflow identity mismatches cannot dispatch',()=>fixture(async({directory,root,sha})=>{
 for(const event of [runEvent('b'.repeat(40)),{...runEvent(sha),repository:{full_name:'foreign/repo'}}]){
  const {api,calls}=apiFixture(sha);const result=await dispatchPublication({event,root,api,fetcher:()=>{throw Error('Registry should not be read');},temporary:join(directory,'unused')});assert.equal(result.status,'skipped');assert.equal(calls.some(x=>x.method==='POST'),false);
 }
 const {api,calls}=apiFixture(sha,{workflowId:999});await assert.rejects(dispatchPublication({event:runEvent(sha),root,api,fetcher:absentRegistry,temporary:join(directory,'unused')}),/authoritative acceptance workflow/);assert.equal(calls.some(x=>x.method==='POST'),false);
}));

test('an existing exact registry package skips publication, while different bytes fail closed',()=>fixture(async({directory,root,sha})=>{
 const packed=await normalizedArchive(root,join(directory,'expected'));
 const metadata={name,version:'2.0.3',dist:{tarball:'https://registry.npmjs.org/martlet/astro-fixture.tgz',integrity:'sha512-'+createHash('sha512').update(packed.bytes).digest('base64')}};
 const registry=wrong=>async url=>{
  if(url===metadata.dist.tarball)return new Response(wrong?Buffer.from('different bytes'):packed.bytes,{status:200});
  return new Response(JSON.stringify(url.endsWith('/2.0.3')?metadata:{name,versions:{'2.0.3':metadata}}),{status:200});
 };
 const correct=apiFixture(sha);assert.equal((await dispatchPublication({event:runEvent(sha),root,api:correct.api,fetcher:registry(false),temporary:join(directory,'published')})).status,'skipped');assert.equal(correct.calls.some(x=>x.method==='POST'),false);
 const wrong=apiFixture(sha);await assert.rejects(dispatchPublication({event:runEvent(sha),root,api:wrong.api,fetcher:registry(true),temporary:join(directory,'conflict')}),/differs from accepted source/);assert.equal(wrong.calls.some(x=>x.method==='POST'),false);
}));

test('completion preserves the exact publication commit after main advances and dispatches the release at its immutable tag',()=>fixture(async({directory,root,git,sha})=>{
 await writeFile(join(root,'later.txt'),'Later accepted source');git(['add','.']);git(['commit','-m','Later main']);git(['update-ref','refs/remotes/origin/main',git(['rev-parse','HEAD'])]);git(['checkout','--detach',sha]);
 const expected=await normalizedArchive(root,join(directory,'expected-published'));
 const metadata={name,version:'2.0.3',dist:{tarball:'https://registry.npmjs.org/martlet/completed.tgz',integrity:'sha512-'+createHash('sha512').update(expected.bytes).digest('base64')}};
 const fetcher=async url=>url===metadata.dist.tarball?new Response(expected.bytes,{status:200}):new Response(JSON.stringify(metadata),{status:200});
 const {api,calls}=apiFixture(sha);assert.equal((await completePublication({root,api,approvedSha:sha,fetcher})).tag,'v2.0.3');
 assert.deepEqual(calls.filter(x=>x.method==='POST').map(x=>({path:x.path,body:x.body})),[{path:repoPath+'/git/refs',body:{ref:'refs/tags/v2.0.3',sha}},{path:repoPath+'/actions/workflows/tag-release.yml/dispatches',body:{ref:'v2.0.3'}}]);
}));

test('completion never overwrites a conflicting tag or accepts a source outside main first-parent history',()=>fixture(async({root,git,sha})=>{
 const conflict=apiFixture(sha,{tagPresent:true,tagSha:'b'.repeat(40)});await assert.rejects(completePublication({root,api:conflict.api,approvedSha:sha}),/immutable release tag/);assert.equal(conflict.calls.some(x=>x.method==='POST'),false);
 await writeFile(join(root,'candidate.txt'),'Candidate only');git(['add','.']);git(['commit','-m','Unaccepted candidate']);const candidate=git(['rev-parse','HEAD']),unaccepted=apiFixture(candidate);
 await assert.rejects(completePublication({root,api:unaccepted.api,approvedSha:candidate}),/eligible main history/);assert.equal(unaccepted.calls.length,0);
}));

test('GitHub token requests are limited to the exact publication repository',async()=>{
 let used=false;const api=githubClient(async()=>{used=true;throw Error('Unexpected request');},'fixture-token');await assert.rejects(api('/repos/foreign/repository/git/refs','POST',{}),/escapes publication repository/);assert.equal(used,false);
});

test('a conflicting prepublication tag and differing published bytes prevent irreversible completion writes',()=>fixture(async({directory,root,sha})=>{
 const conflicting=apiFixture(sha,{tagPresent:true,tagSha:'b'.repeat(40)});
 await assert.rejects(dispatchPublication({event:runEvent(sha),root,api:conflicting.api,fetcher:absentRegistry,temporary:join(directory,'conflicting-dispatch')}),/immutable release tag/);assert.equal(conflicting.calls.some(x=>x.method==='POST'),false);
 const metadata={name,version:'2.0.3',dist:{tarball:'https://registry.npmjs.org/martlet/wrong.tgz',integrity:'sha512-'+createHash('sha512').update('wrong').digest('base64')}};
 const fetcher=async url=>url===metadata.dist.tarball?new Response('wrong',{status:200}):new Response(JSON.stringify(metadata),{status:200});
 const completing=apiFixture(sha);await assert.rejects(completePublication({root,api:completing.api,approvedSha:sha,fetcher}),/differs from accepted source/);assert.equal(completing.calls.some(x=>x.method==='POST'),false);
}));

test('registry propagation reads are fresh, bounded and visible without treating a deadline as success',async()=>{
 const bytes=Buffer.from('exact published fixture'),packed={version:'2.0.3',bytes};
 const metadata={name,version:packed.version,dist:{tarball:'https://registry.npmjs.org/martlet/ready.tgz',integrity:'sha512-'+createHash('sha512').update(bytes).digest('base64')}};
 let calls=0;const progress=[];
 const fetcher=async(url,options)=>{
  assert.equal(options.headers['Cache-Control'],'no-cache');assert.ok(options.signal);
  calls++;
  if(calls===1)return new Response('{"error":"Not found"}',{status:404});
  return url===metadata.dist.tarball?new Response(bytes,{status:200}):new Response(JSON.stringify(metadata),{status:200});
 };
 await publishedArchive(fetcher,packed,{delayMs:0,log:event=>progress.push(event)});
 assert.deepEqual(progress.map(event=>event.state),['start','waiting','start','passed']);assert.equal(calls,3);
 const timed=[];await assert.rejects(publishedArchive(async()=>new Response('{"error":"Not found"}',{status:404}),packed,{timeoutMs:25,delayMs:1,log:event=>timed.push(event)}),/deadline/);
 assert.ok(timed.some(event=>event.state==='waiting'));assert.equal(timed.some(event=>event.state==='passed'),false);
});
