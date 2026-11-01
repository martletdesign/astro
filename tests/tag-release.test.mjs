import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {releaseVersion,validateIdentity,productionCommit,registryState,verifyArchive} from '../scripts/tag-release-guard.mjs';

const pkg={name:'@martlet/astro',version:'2.2.3',private:false,repository:{url:'git+https://github.com/martletdesign/astro.git'},dependencies:{font:'1.0.0'}};
const input={tag:'v2.2.3',pkg,source:{version:'2.2.3'},lock:{name:pkg.name,version:pkg.version,packages:{'':{name:pkg.name,version:pkg.version,dependencies:pkg.dependencies}}},repository:'martletdesign/astro',expectedRepository:'martletdesign/astro',expectedName:'@martlet/astro'};
test('tag and package source/lock identity must agree',()=>{
  assert.deepEqual(validateIdentity(input),{version:'2.2.3',channel:'latest'});
  const reordered={...pkg,dependencies:{z:'1',a:'2'}};
  assert.doesNotThrow(()=>validateIdentity({...input,pkg:reordered,lock:{...input.lock,packages:{'':{...input.lock.packages[''],dependencies:{a:'2',z:'1'}}}}}));
  assert.throws(()=>validateIdentity({...input,pkg:{...pkg,peerDependencies:{example:'^1.0.0'}}}));
  assert.equal(releaseVersion('v2.2.4-rc.1').channel,'next');
  for(const t of ['v02.2.3','v2.2','v2.2.3-rc.01','v2.2.3+1']) assert.throws(()=>releaseVersion(t));
  for(const change of [{tag:'v2.2.4'},{repository:'other/core'},{source:{version:'2.2.4'}},{pkg:{...pkg,private:true}},{lock:{...input.lock,version:'2.2.4'}}]) assert.throws(()=>validateIdentity({...input,...change}));
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
