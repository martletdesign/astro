// Non-production source specimen. The accepted develop branch alone is deployed.
// Unlike the existing published-reference builder, this deliberately builds
// reference-baseline/ rather than starter/. No npm publication occurs.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {cp, mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const root=process.cwd();
const output=join(root,'.cloudflare-site');
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const branch=process.env.WORKERS_CI_BRANCH || process.env.ASTRO_DEPLOY_BRANCH;
assert.equal(branch,'develop','Only accepted develop may build the neutral reference preview');
execFileSync('git',['diff','--quiet','HEAD'],{cwd:root});
try {await stat(output);throw Error('Never reuse a previous Cloudflare output');}
catch(error) {if(error.code!=='ENOENT')throw error;}

const temporary=await mkdtemp(join(tmpdir(),'astro-neutral-baseline-'));
try {
 const site=join(temporary,'site');
 await cp(join(root,'reference-baseline'),site,{recursive:true});
 const pkg=JSON.parse(await readFile(join(site,'package.json'),'utf8'));
 assert.equal(pkg.private,true);
 assert.match(pkg.name,/^(martlet|krigsvold)-source-neutral-baseline$/);
 const run=(args)=>execFileSync(args[0],args.slice(1),{
  cwd:site,env:process.env,stdio:'inherit',timeout:420000
 });
 run(['npm','install','--ignore-scripts','--no-audit','--no-fund']);
 run(['npm','run','build']);
 const dist=join(site,'dist');
 for(const page of ['index.html','article/index.html','document/index.html'])
   await stat(join(dist,page));
 await cp(dist,output,{recursive:true});
 const provenance={
  family:pkg.name.split('-')[0],
  sourceCommit:head,
  buildMode:'canonical-source-baseline',
  package:{name:pkg.name,version:null,dependencies:pkg.dependencies},
  core:null,
  baseline:{repository:process.env.CANONICAL_SOURCE_REPO,commit:process.env.CANONICAL_SOURCE_SHA},
  toolchain:{node:process.versions.node,npm:execFileSync('npm',['--version'],{encoding:'utf8'}).trim(),astro:pkg.dependencies.astro}
 };
 assert.ok(provenance.baseline.repository && /^[0-9a-f]{40}$/.test(provenance.baseline.commit));
 await writeFile(join(root,'.cloudflare-build-provenance.json'),JSON.stringify(provenance,null,2)+'\n');
 console.log('CANONICAL_ASTRO_BASELINE_READY',JSON.stringify({family:provenance.family,sha:head,files:'root/ article/ document/'}));
}catch(error){await rm(output,{force:true,recursive:true});throw error;}
finally{await rm(temporary,{recursive:true,force:true});}
