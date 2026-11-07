import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {releaseVersion,validateIdentity,productionCommit,registryState,verifyArchive,verifyProvenance} from '../scripts/tag-release-guard.mjs';

const pkg={name:'@martlet/astro',version:'2.2.3',private:true,repository:{url:'git+https://github.com/martletdesign/astro.git'},dependencies:{font:'1.0.0'},peerDependencies:{'@martlet/core':'^2.2.0'}};
const input={tag:'v2.2.3',pkg,source:{version:'2.2.3'},lock:{name:pkg.name,version:pkg.version,packages:{'':{name:pkg.name,version:pkg.version,dependencies:pkg.dependencies,peerDependencies:pkg.peerDependencies}}},repository:'martletdesign/astro',expectedRepository:'martletdesign/astro',expectedName:'@martlet/astro'};
test('tag and package source/lock identity must agree',()=>{
  assert.deepEqual(validateIdentity(input),{version:'2.2.3',channel:'latest'});
  const reordered={...pkg,dependencies:{z:'1',a:'2'}};
  assert.doesNotThrow(()=>validateIdentity({...input,pkg:reordered,lock:{...input.lock,packages:{'':{...input.lock.packages[''],dependencies:{a:'2',z:'1'}}}}}));
  assert.throws(()=>validateIdentity({...input,pkg:{...pkg,peerDependencies:{'@martlet/theme':'^2.0.0'}}}));
  assert.equal(releaseVersion('v2.2.4-rc.1').channel,'next');
  for(const t of ['v02.2.3','v2.2','v2.2.3-rc.01','v2.2.3+1']) assert.throws(()=>releaseVersion(t));
  for(const change of [{tag:'v2.2.4'},{repository:'other/core'},{source:{version:'2.2.4'}},{pkg:{...pkg,private:false}},{lock:{...input.lock,version:'2.2.4'}}]) assert.throws(()=>validateIdentity({...input,...change}));
});
test('tag protection, event SHA, first-parent and remote ref all gate release',()=>{
  const sha='1'.repeat(40),object='2'.repeat(40);
  const git=args=>args[0]==='ls-remote'?`${object}\trefs/tags/v2.2.3`:args[0]==='rev-list'?`${sha}\n`:(args.at(-1).endsWith('^{commit}')||args.at(-1)==='HEAD'?sha:object);
  productionCommit({git,tag:'v2.2.3',sha,protectedRef:'true'});
  assert.throws(()=>productionCommit({git,tag:'v2.2.3',sha,protectedRef:'false'}));
  assert.throws(()=>productionCommit({git,tag:'v2.2.3',sha:'3'.repeat(40),protectedRef:'true'}));
  assert.throws(()=>productionCommit({git:args=>args[0]==='rev-list'?'4'.repeat(40):git(args),tag:'v2.2.3',sha,protectedRef:'true'}));
  assert.throws(()=>productionCommit({git:args=>args[0]==='ls-remote'?'':git(args),tag:'v2.2.3',sha,protectedRef:'true'}));
});
test('registry uncertainty fails closed and existing versions are rejected',async()=>{
  const res=(status,body)=>({status,json:async()=>body});
  async function check(items) {return registryState(async()=>{const r=items.shift();if(r instanceof Error)throw r;if(!r)throw Error('unexpected request');return r;},'https://registry.npmjs.org/','@martlet/astro','2.2.3');}
  const root={name:'@martlet/astro',versions:{}};
  assert.equal(await check([res(200,root),res(404)]),'absent');
  assert.equal(await check([res(200,root),res(200,{name:'@martlet/astro',version:'2.2.3'})]),'present');
  assert.equal(await check([res(200,{...root,versions:{'2.2.3':{name:'@martlet/astro',version:'2.2.3'}}}),res(404)]),'present');
  assert.equal(await check([res(200,{...root,versions:{'2.2.3':{name:'@other/astro',version:'2.2.3'}}}),res(404)]),'unknown');
  for(const items of [[res(404)], [res(403)], [new Error('offline')], [res(200,{name:'@martlet/astro'})], [res(200,{...root,versions:[]})], [res(200,root),res(500)]]) assert.equal(await check(items),'unknown');
});
test('registry package identity, bytes and integrity must match',()=>{
  const local=Buffer.from('reviewed'), metadata={name:'@martlet/astro',version:'2.2.3',dist:{integrity:`sha512-${createHash('sha512').update(local).digest('base64')}`}};
  assert.equal(verifyArchive({local,remote:local,metadata,name:pkg.name,version:pkg.version}),true);
  assert.equal(verifyArchive({local,remote:Buffer.from('different'),metadata,name:pkg.name,version:pkg.version}),false);
  assert.equal(verifyArchive({local,remote:local,metadata:{...metadata,name:'@other/core'},name:pkg.name,version:pkg.version}),false);
});
test('tag completion verifies staged publication without npm publication authority',async()=>{
  const workflow=await readFile('.github/workflows/tag-release.yml','utf8');
  await assert.rejects(readFile('.github/workflows/publish.yml','utf8'),{code:'ENOENT'});
  assert.match(workflow,/push:\s*\n\s*tags:\s*\['v\*'\]/);
  assert.match(workflow,/environment:\s*astro-production-release/);
  assert.doesNotMatch(workflow,/if:\s*\$\{\{ false \}\}|id-token:|npm (?:publish|stage publish)/);
  assert.match(workflow,/verify-registry/);
  assert.match(workflow,/verify-provenance/);
  assert.match(workflow,/SHA256SUMS/);
});

test('recovery refuses malformed tags before contacting the registry',()=>{
  const run=spawnSync(process.execPath,['scripts/tag-release-cli.mjs','verify-registry','missing.tgz'],{env:{...process.env,RELEASE_TAG:'x2.2.3'},encoding:'utf8'});
  assert.notEqual(run.status,0);assert.match(run.stderr,/Invalid release tag/);
});

test('verified provenance must identify the exact package, tag, workflow and commit',()=>{
  const archive=Buffer.from('release bytes'),commit='a'.repeat(40),tag='v2.2.3',repository=input.expectedRepository;
  const [scope,packageName]=pkg.name.split('/');
  const statement={_type:'https://in-toto.io/Statement/v1',predicateType:'https://slsa.dev/provenance/v1',subject:[{name:`pkg:npm/${encodeURIComponent(scope)}/${packageName}@2.2.3`,digest:{sha512:createHash('sha512').update(archive).digest('hex')}}],predicate:{runDetails:{builder:{id:'https://github.com/actions/runner/github-hosted'}},buildDefinition:{buildType:'https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1',externalParameters:{workflow:{repository:`https://github.com/${repository}`,path:'.github/workflows/stage.yml',ref:'refs/heads/main'}},internalParameters:{github:{event_name:'workflow_dispatch'}},resolvedDependencies:[{uri:`git+https://github.com/${repository}@refs/heads/main`,digest:{gitCommit:commit}}]}}};
  const makeAudit=s=>({invalid:[],missing:[],verified:[{name:pkg.name,version:'2.2.3',attestationBundles:[{predicateType:'https://slsa.dev/provenance/v1',bundle:{dsseEnvelope:{payload:Buffer.from(JSON.stringify(s)).toString('base64')}}}]}]});
  const args={audit:makeAudit(statement),archive,name:pkg.name,version:'2.2.3',repository,tag,commit};
  assert.equal(verifyProvenance(args),true);
  assert.equal(verifyProvenance({...args,commit:'b'.repeat(40)}),false);
  assert.equal(verifyProvenance({...args,archive:Buffer.from('other')}),false);
  assert.equal(verifyProvenance({...args,audit:{...args.audit,invalid:[{}]}}),false);
  assert.equal(verifyProvenance({...args,audit:{invalid:[],missing:[],verified:[]}}),false);
  const altered=structuredClone(statement);altered.predicateType='https://example.invalid/provenance';
  assert.equal(verifyProvenance({...args,audit:makeAudit(altered)}),false);
  altered.predicateType=statement.predicateType;altered.predicate.runDetails.builder.id='https://example.invalid/builder';
  assert.equal(verifyProvenance({...args,audit:makeAudit(altered)}),false);
  altered.predicate.runDetails.builder.id=statement.predicate.runDetails.builder.id;altered.predicate.buildDefinition.buildType='https://example.invalid/build';
  assert.equal(verifyProvenance({...args,audit:makeAudit(altered)}),false);
  for(const mutate of [x=>x.subject[0].digest.sha512='0'.repeat(128),x=>x.predicate.buildDefinition.externalParameters.workflow.repository='https://github.com/other/astro',x=>x.predicate.buildDefinition.externalParameters.workflow.ref='refs/heads/develop',x=>x.predicate.buildDefinition.internalParameters.github.event_name='push']) {const bad=structuredClone(statement);mutate(bad);assert.equal(verifyProvenance({...args,audit:makeAudit(bad)}),false);}
  statement.predicate.buildDefinition.externalParameters.workflow.path='.github/workflows/other.yml';
  assert.equal(verifyProvenance({...args,audit:makeAudit(statement)}),false);
});

test('advanced archive remains disabled without blocking verified source releases',async()=>{
  const workflow=await readFile('.github/workflows/tag-release.yml','utf8');
  assert.doesNotMatch(workflow,/docs-archive\.yml|verify-published\.mjs/);
  const run=spawnSync(process.execPath,['scripts/docs-versions/verify-published.mjs'],{encoding:'utf8'});
  assert.notEqual(run.status,0);assert.match(run.stderr,/storage and verification are not configured/);
});
