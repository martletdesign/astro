import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {identityFromFiles,registryState,releaseVersion,verifyArchive} from './tag-release-guard.mjs';

const repository='martletdesign/astro',name='@martlet/astro';
const shaPattern=/^[a-f0-9]{40}$/;
const git=(root,args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe']}).trim();

export function acceptedMainRun(event,expectedRepository,currentSha) {
 const run=event?.workflow_run;
 return shaPattern.test(currentSha??'')&&event?.repository?.full_name===expectedRepository&&
  run?.repository?.full_name===expectedRepository&&run?.head_repository?.full_name===expectedRepository&&
  run.name==='Fast acceptance'&&run.path==='.github/workflows/acceptance.yml'&&
  run.event==='push'&&run.conclusion==='success'&&run.head_branch==='main'&&run.head_sha===currentSha;
}

export async function normalizedArchive(root,output) {
 const sha=git(root,['rev-parse','HEAD']);
 assert.equal(git(root,['status','--porcelain']),'','Archive source must be clean');
 const source=join(output,'source'),archives=join(output,'archives');
 await mkdir(output,{recursive:true});await mkdir(source);await mkdir(archives);
 const exported=execFileSync('git',['archive',sha],{cwd:root,maxBuffer:32*1024*1024,timeout:30000});
 execFileSync('tar',['--same-permissions','-x','-C',source],{input:exported,timeout:30000});
 const pkg=JSON.parse(await readFile(join(source,'package.json'),'utf8'));
 assert.equal(pkg.name,name);assert.equal(pkg.private,true);releaseVersion('v'+pkg.version);
 pkg.private=false;await writeFile(join(source,'package.json'),JSON.stringify(pkg,null,2)+'\n');
 const packed=JSON.parse(execFileSync('npm',['pack','--ignore-scripts','--json','--pack-destination',archives],{cwd:source,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']}));
 assert.equal(packed.length,1);assert.equal(packed[0].name,name);assert.equal(packed[0].version,pkg.version);
 const filename='martlet-astro-'+pkg.version+'.tgz';assert.equal(packed[0].filename,filename);
 const archive=join(archives,filename),bytes=await readFile(archive);
 return {archive,bytes,sha256:createHash('sha256').update(bytes).digest('hex'),version:pkg.version};
}

async function responseJSON(response) {
 const text=await response.text();assert.ok(Buffer.byteLength(text)<=1024*1024,'API response exceeds its bound');
 return text?JSON.parse(text):null;
}
export function githubClient(fetcher,token) {
 assert.ok(token,'GitHub workflow token is unavailable');
 return async(path,method='GET',body)=>{
  assert.ok(path===repoPath||path.startsWith(repoPath+'/'),'GitHub request escapes publication repository');
  const response=await fetcher('https://api.github.com'+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'astro-publication',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});
  return {status:response.status,body:await responseJSON(response)};
 };
}
const repoPath='/repos/'+repository;
async function visibleRepository(api) {
 const response=await api(repoPath);
 assert.equal(response.status,200,'Publication repository is inaccessible');assert.equal(response.body?.full_name,repository);
}
async function currentMain(api) {
 const response=await api(repoPath+'/git/ref/heads/main');
 assert.equal(response.status,200);assert.equal(response.body?.ref,'refs/heads/main');
 assert.equal(response.body?.object?.type,'commit');assert.match(response.body.object.sha,shaPattern);
 return response.body.object.sha;
}
async function registryBytes(fetcher,packed,timeoutMs=15000) {
 const options={headers:{'Cache-Control':'no-cache'},redirect:'error',signal:AbortSignal.timeout(timeoutMs)};
 const url='https://registry.npmjs.org/'+encodeURIComponent(name)+'/'+encodeURIComponent(packed.version);
 const response=await fetcher(url,options);
 assert.equal(response.status,200);const metadata=await responseJSON(response);
 const target=new URL(metadata.dist?.tarball);assert.equal(target.origin,'https://registry.npmjs.org');assert.equal(target.username+target.password,'');
 const artifact=await fetcher(target.href,options);assert.equal(artifact.status,200);
 const chunks=[];let size=0;const reader=artifact.body.getReader();
 try {for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;assert.ok(size<=packed.bytes.length,'Published archive exceeds expected size');chunks.push(Buffer.from(value));}}
 finally {await reader.cancel();}
 assert.ok(verifyArchive({local:packed.bytes,remote:Buffer.concat(chunks),metadata,name,version:packed.version}),'Existing registry version differs from accepted source; use a new version, never overwrite');
}

export async function dispatchPublication({event,root,api,fetcher,temporary}) {
 await visibleRepository(api);
 const current=await currentMain(api);
 if(!acceptedMainRun(event,repository,current))return {status:'skipped',reason:'Only a successful current main push may publish'};
 const workflow=await api(repoPath+'/actions/workflows/acceptance.yml');
 assert.equal(workflow.status,200);assert.equal(workflow.body?.path,'.github/workflows/acceptance.yml');
 assert.equal(workflow.body?.id,event.workflow_run.workflow_id,'Trigger differs from the authoritative acceptance workflow');
 assert.equal(git(root,['rev-parse','HEAD']),current,'Checkout differs from accepted run');
 const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8')),tag='v'+pkg.version;
 await identityFromFiles({tag,repository,expectedRepository:repository,expectedName:name});
 const packed=await normalizedArchive(root,temporary);
 const state=await registryState(url=>fetcher(url,{redirect:'error',signal:AbortSignal.timeout(15000)}),'https://registry.npmjs.org/',name,pkg.version);
 assert.notEqual(state,'unknown','Registry state is unknown');
 if(state==='present'){await registryBytes(fetcher,packed);return {status:'skipped',reason:'Exact package bytes are already published',version:pkg.version};}
 await releaseTagExists(api,tag,current);
 if(await currentMain(api)!==current)return {status:'skipped',reason:'Main was superseded during archive preparation'};
 const inputs={approved_sha:current,artifact_sha256:packed.sha256,distribution_tag:releaseVersion(tag).channel,publish_mode:'publish'};
 const result=await api(repoPath+'/actions/workflows/stage.yml/dispatches','POST',{ref:'main',inputs});
 assert.equal(result.status,204,'Automatic publication dispatch failed');
 return {status:'dispatched',workflow:'stage.yml',sourceCommit:current,version:pkg.version,archiveSha256:packed.sha256};
}

export async function releaseTagExists(api,tag,approvedSha) {
 releaseVersion(tag);assert.match(approvedSha,shaPattern);await visibleRepository(api);
 const response=await api(repoPath+'/git/ref/tags/'+encodeURIComponent(tag));
 if(response.status===404){assert.equal(response.body?.message,'Not Found','Tag absence is not definite');return false;}
 assert.equal(response.status,200);assert.equal(response.body?.ref,'refs/tags/'+tag);
 let object=response.body.object;
 if(object?.type==='tag'){
  assert.match(object.sha,shaPattern);
  const annotated=await api(repoPath+'/git/tags/'+object.sha);assert.equal(annotated.status,200);object=annotated.body?.object;
 }
 assert.equal(object?.type,'commit');assert.equal(object?.sha,approvedSha,'Existing immutable release tag points elsewhere');
 return true;
}

export async function publishedArchive(fetcher,packed,{timeoutMs=90000,delayMs=5000,log=event=>console.error(JSON.stringify(event))}={}) {
 assert.ok(Number.isFinite(timeoutMs)&&timeoutMs>0&&Number.isFinite(delayMs)&&delayMs>=0);
 const started=Date.now(),deadline=started+timeoutMs;let previous;
 for(let attempt=1;;attempt++){
  const remaining=deadline-Date.now();
  if(remaining<=0)throw Error(`Registry propagation exceeded its ${timeoutMs}ms deadline`,{cause:previous});
  log({operation:'registry.publication',state:'start',attempt,version:packed.version,elapsedMs:Date.now()-started});
  try {
   await registryBytes(fetcher,packed,Math.min(15000,remaining));
   log({operation:'registry.publication',state:'passed',attempt,version:packed.version,elapsedMs:Date.now()-started});return;
  }catch(error){
   const transient=error?.actual===404||(typeof error?.actual==='number'&&error.actual>=500)||['TypeError','TimeoutError','AbortError'].includes(error?.name);
   if(!transient)throw error;
   previous=error;
   log({operation:'registry.publication',state:'waiting',attempt,status:error.actual??error.name,version:packed.version,elapsedMs:Date.now()-started});
   await new Promise(done=>setTimeout(done,Math.min(delayMs,Math.max(0,deadline-Date.now()))));
  }
 }
}

export async function completePublication({root,api,approvedSha,fetcher=fetch}) {
 assert.match(approvedSha??'',shaPattern);assert.equal(git(root,['rev-parse','HEAD']),approvedSha);
 const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8')),tag='v'+pkg.version;
 await identityFromFiles({tag,repository,expectedRepository:repository,expectedName:name});
 assert.ok(git(root,['rev-list','--first-parent','refs/remotes/origin/main']).split('\n').includes(approvedSha),'Publication source is not eligible main history');
 const exists=await releaseTagExists(api,tag,approvedSha);
 const temporary=await mkdtemp(join(tmpdir(),'astro-published-archive-'));
 try {
  const packed=await normalizedArchive(root,temporary);
  await publishedArchive(fetcher,packed);
 } finally {await rm(temporary,{recursive:true,force:true});}
 if(!exists){
  const created=await api(repoPath+'/git/refs','POST',{ref:'refs/tags/'+tag,sha:approvedSha});
  assert.ok([201,422].includes(created.status),'Release tag creation failed');
  assert.equal(await releaseTagExists(api,tag,approvedSha),true,'Release tag was not confirmed');
 }
 const result=await api(repoPath+'/actions/workflows/tag-release.yml/dispatches','POST',{ref:tag});
 assert.equal(result.status,204,'Source release completion dispatch failed');
 return {status:'dispatched',workflow:'tag-release.yml',tag,sourceCommit:approvedSha};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 assert.equal(process.env.GITHUB_REPOSITORY,repository,'Wrong publication repository');
 const root=process.cwd(),api=githubClient(fetch,process.env.GH_TOKEN);
 if(process.argv[2]==='dispatch'){
  const temporary=await mkdtemp(join(tmpdir(),'astro-auto-publication-'));
  try {const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));console.log(JSON.stringify(await dispatchPublication({event,root,api,fetcher:fetch,temporary})));}
  finally {await rm(temporary,{recursive:true,force:true});}
 }else if(process.argv[2]==='complete')console.log(JSON.stringify(await completePublication({root,api,approvedSha:process.env.APPROVED_SHA,fetcher:fetch})));
 else if(process.argv[2]==='check-tag'){
  const pkg=JSON.parse(await readFile('package.json','utf8')),sha=git(root,['rev-parse','HEAD']);
  assert.equal(sha,process.env.GITHUB_SHA);
  console.log(JSON.stringify({tag:'v'+pkg.version,exists:await releaseTagExists(api,'v'+pkg.version,sha)}));
 }
 else throw Error('Expected dispatch or complete');
}
