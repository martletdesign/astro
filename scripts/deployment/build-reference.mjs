// Build the existing shipped starter from an exact Git export. No publishing.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {cp,mkdir,mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {checkDashboardFamily} from '../dashboard-family-check.mjs';
import {assertCleanStarter} from '../docs-versions/clean-starter.mjs';

const root=process.cwd(),output=join(root,'.cloudflare-site');
const run=(args,cwd=root,env={})=>execFileSync(args[0],args.slice(1),{cwd,env:{...process.env,...env},encoding:'utf8',stdio:['ignore','pipe','inherit'],timeout:480000});
const sha=run(['git','rev-parse','HEAD']).trim();
run(['git','diff','--quiet','HEAD']);
try {await stat(output);throw Error('Never reuse an earlier reference output');}catch(error){if(error.code!=='ENOENT')throw error;}
const pkg=JSON.parse(await readFile('package.json','utf8')),pin=JSON.parse(await readFile('docs-release-lock.json','utf8'));
assert.equal(pkg.name,`@${pin.family}/astro`);assert.equal(pin.core.name,`@${pin.family}/core`);
await assertCleanStarter(join(root,'starter'));
const temp=await mkdtemp(join(tmpdir(),'astro-native-reference-'));
try {
  const source=join(temp,'source'),vendor=join(temp,'vendor'),site=join(temp,'site');
  await mkdir(source);await mkdir(vendor);
  const exported=execFileSync('git',['archive',sha],{cwd:root,timeout:30000,maxBuffer:32*1024*1024});
  execFileSync('tar',['--same-permissions','-x','-C',source],{input:exported,timeout:30000});
  // Only source private flag changes, matching the staged public archive.
  const manifest=JSON.parse(await readFile(join(source,'package.json'),'utf8'));assert.deepEqual(manifest,pkg);assert.equal(manifest.private,true);manifest.private=false;
  await writeFile(join(source,'package.json'),JSON.stringify(manifest,null,2)+'\n');
  const archive=JSON.parse(run(['npm','pack','--ignore-scripts','--json','--pack-destination',vendor],source))[0];
  await cp(join(source,'starter'),site,{recursive:true});await mkdir(join(site,'vendor'));
  await cp(join(vendor,archive.filename),join(site,'vendor',archive.filename));
  const project=JSON.parse(await readFile(join(site,'package.json'),'utf8'));
  project.dependencies[pkg.name]=`file:vendor/${archive.filename}`;project.dependencies[pin.core.name]=pin.core.version;project.dependencies.astro=pin.astro;
  await writeFile(join(site,'package.json'),JSON.stringify(project,null,2)+'\n');
  run(['npm','install','--ignore-scripts','--no-audit','--no-fund'],site);
  const lock=JSON.parse(await readFile(join(site,'package-lock.json'),'utf8')),core=lock.packages[`node_modules/${pin.core.name}`];
  assert.equal(core.version,pin.core.version);assert.equal(core.integrity,pin.core.integrity);run(['npm','ls',pin.core.name,'--json'],site);
  await mkdir(output);
  for(const base of ['/','/preview/']) {
    console.log(`ASTRO_REFERENCE_BUILD family=${pin.family} operation=build base=${base} sha=${sha}`);
    run(['npm','run','build'],site,{NIGHTJAR_BASE:base});
    const built=join(site,'dist');await checkDashboardFamily(built,pin.family);
    console.log(run(['python3',join(source,'scripts/docs-versions/verify-canonical.py'),built,join(site,'page-archetypes/content/catalog.json')]).trim());
    console.log(run(['python3',join(source,'scripts/docs-versions/verify-html.py'),built,'--baseurl',base==='/'?'':base.slice(0,-1)]).trim());
    await cp(built,base==='/'?output:join(output,'preview'),{recursive:true});
    console.log(`ASTRO_REFERENCE_BUILD family=${pin.family} operation=verified base=${base} sha=${sha}`);
  }
  await writeFile(join(root,'.cloudflare-build-provenance.json'),JSON.stringify({family:pin.family,sourceCommit:sha,package:{name:pkg.name,version:pkg.version,archiveIntegrity:archive.integrity,archiveShasum:archive.shasum},core:pin.core,toolchain:{node:process.versions.node,npm:run(['npm','--version']).trim(),astro:pin.astro}},null,2)+'\n');
} catch(error) {await rm(output,{recursive:true,force:true});throw error;}
finally {await rm(temp,{recursive:true,force:true});}
