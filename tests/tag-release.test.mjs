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
  async function check(items) {return registryState(async()=>{const r=items.shift();if(r instanceof Error)throw r;return r;},'https://registry.npmjs.org/','@martlet/astro','2.2.3');}
  assert.equal(await check([res(200,{name:'@martlet/astro'}),res(404)]),'absent');
  assert.equal(await check([res(200,{name:'@martlet/astro'}),res(200,{name:'@martlet/astro',version:'2.2.3'})]),'present');
  for(const items of [[res(404)], [res(403)], [new Error('offline')], [res(200,{name:'@martlet/astro'}),res(500)]]) assert.equal(await check(items),'unknown');
});
test('registry package identity, bytes and integrity must match',()=>{
  const local=Buffer.from('reviewed'), metadata={name:'@martlet/astro',version:'2.2.3',dist:{integrity:`sha512-${createHash('sha512').update(local).digest('base64')}`}};
  assert.equal(verifyArchive({local,remote:local,metadata,name:pkg.name,version:pkg.version}),true);
  assert.equal(verifyArchive({local,remote:Buffer.from('different'),metadata,name:pkg.name,version:pkg.version}),false);
  assert.equal(verifyArchive({local,remote:local,metadata:{...metadata,name:'@other/core'},name:pkg.name,version:pkg.version}),false);
});
test('tag publication proposal is disabled and legacy release-event workflow is removed',async()=>{
  const draft=await readFile('.github/workflows/tag-release.yml','utf8');
  await assert.rejects(readFile('.github/workflows/publish.yml','utf8'),{code:'ENOENT'});
  assert.match(draft,/push:\s*\n\s*tags:\s*\['v\*'\]/);
  assert.match(draft,/if:\s*\$\{\{ false \}\}/);
  assert.match(draft,/environment:\s*astro-production-release/);
  assert.match(draft,/npm publish[^\n]*--provenance/);
  assert.match(draft,/verify-registry/);
});

test('recovery refuses malformed tags before contacting the registry',()=>{
  const run=spawnSync(process.execPath,['scripts/tag-release-cli.mjs','verify-registry','missing.tgz'],{env:{...process.env,RELEASE_TAG:'x2.2.3'},encoding:'utf8'});
  assert.notEqual(run.status,0);assert.match(run.stderr,/Invalid release tag/);
});

test('verified provenance must identify the exact package, tag, workflow and commit',()=>{
  const archive=Buffer.from('release bytes'),commit='a'.repeat(40),tag='v2.2.3',repository=input.expectedRepository;
  const [scope,packageName]=pkg.name.split('/');
  const statement={_type:'https://in-toto.io/Statement/v1',subject:[{name:`pkg:npm/${encodeURIComponent(scope)}/${packageName}@2.2.3`,digest:{sha512:createHash('sha512').update(archive).digest('hex')}}],predicate:{buildDefinition:{externalParameters:{workflow:{repository:`https://github.com/${repository}`,path:'.github/workflows/tag-release.yml',ref:`refs/tags/${tag}`}},internalParameters:{github:{event_name:'push'}},resolvedDependencies:[{uri:`git+https://github.com/${repository}@refs/tags/${tag}`,digest:{gitCommit:commit}}]}}};
  const makeAudit=s=>({invalid:[],missing:[],verified:[{name:pkg.name,version:'2.2.3',attestationBundles:[{predicateType:'https://slsa.dev/provenance/v1',bundle:{dsseEnvelope:{payload:Buffer.from(JSON.stringify(s)).toString('base64')}}}]}]});
  const args={audit:makeAudit(statement),archive,name:pkg.name,version:'2.2.3',repository,tag,commit};
  assert.equal(verifyProvenance(args),true);
  assert.equal(verifyProvenance({...args,commit:'b'.repeat(40)}),false);
  assert.equal(verifyProvenance({...args,archive:Buffer.from('other')}),false);
  assert.equal(verifyProvenance({...args,audit:{...args.audit,invalid:[{}]}}),false);
  assert.equal(verifyProvenance({...args,audit:{invalid:[],missing:[],verified:[]}}),false);
  statement.predicate.buildDefinition.externalParameters.workflow.path='.github/workflows/other.yml';
  assert.equal(verifyProvenance({...args,audit:makeAudit(statement)}),false);
});

test('documentation verification blocks publication until immutable storage is configured',async()=>{
  const workflow=await readFile('.github/workflows/tag-release.yml','utf8');
  assert.match(workflow,/uses:\s*\.\/\.github\/workflows\/docs-archive\.yml/);
  assert.match(workflow,/needs:\s*\[verify, docs\]/);
  assert.ok(workflow.indexOf('scripts/docs-versions/verify-published.mjs')<workflow.indexOf('npm publish '));
  const run=spawnSync(process.execPath,['scripts/docs-versions/verify-published.mjs'],{encoding:'utf8'});
  assert.notEqual(run.status,0);assert.match(run.stderr,/storage and verification are not configured/);
});
