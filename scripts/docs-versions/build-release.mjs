import {cp,lstat,mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
import {createSnapshot} from './snapshot.mjs';
import {assertCleanStarter} from './clean-starter.mjs';
import {parseVersion,sha256,validateCatalog,versionTopicURL} from './contract.mjs';

const env=process.env;
for(const key of ['DOCS_ARCHIVE_ROOT','DOCS_BASELINE_PATH','DOCS_BASELINE_SHA256','RELEASE_TAG'])if(!env[key])throw Error(`Missing ${key}`);
const root=process.cwd(),pkg=JSON.parse(await readFile('package.json','utf8')),pin=JSON.parse(await readFile('docs-release-lock.json','utf8'));
const {version}=parseVersion(pkg.version),family=pin.family;
if(env.RELEASE_TAG!==`v${version}`||pkg.name!==`@${family}/astro`||pkg.private!==true||!pkg.peerDependencies?.[pin.core.name]||pkg.peerDependencies?.[`@${family}/theme`])throw Error('Documentation requires the matching private core-migration candidate');
if(pin.core.name!==`@${family}/core`||!/^\d+\.\d+\.\d+$/.test(pin.core.version)||!/^\d+\.\d+\.\d+$/.test(pin.astro))throw Error('Documentation dependencies must be exact');
const baselineBytes=await readFile(env.DOCS_BASELINE_PATH);if(sha256(baselineBytes)!==env.DOCS_BASELINE_SHA256)throw Error('Baseline catalog digest mismatch');
const baseline=JSON.parse(baselineBytes);if(baseline.family!==family||baseline.framework!=='astro'||baseline.schemaVersion!==1||!Array.isArray(baseline.versions))throw Error('Baseline authority mismatch');
if(baseline.versions.length)validateCatalog(baseline);else if(baseline.latestStable!==null)throw Error('Invalid empty baseline');
const prefix=env.DOCS_DEPLOY_PREFIX??'';
if(prefix && (!/^\/(?:[A-Za-z0-9._~-]+)(?:\/[A-Za-z0-9._~-]+)*$/.test(prefix)||prefix.split('/').some(x=>x==='..'||x==='.') ))throw Error('Invalid deployment prefix');
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(env.GITHUB_SHA && env.GITHUB_SHA!==sourceCommit)throw Error('Source commit differs from event');
if(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())throw Error('Documentation source tree must be clean');
try {await lstat(join(resolve(env.DOCS_ARCHIVE_ROOT),version));throw Error('Snapshot version already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
await assertCleanStarter(join(root,'starter'));
const temp=await mkdtemp(join(tmpdir(),'nightjar-astro-docs-'));
const run=(command,args,cwd)=>execFileSync(command,args,{cwd,stdio:['ignore','pipe','inherit'],encoding:'utf8'});
async function files(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...await files(p));else out.push(p);}return out;}
try {
  const vendor=join(temp,'vendor'),site=join(temp,'site');await mkdir(vendor);await cp(join(root,'starter'),site,{recursive:true});
  const archive=JSON.parse(run('npm',['pack','--ignore-scripts','--json','--pack-destination',vendor],root))[0].filename;
  await mkdir(join(site,'vendor'));await cp(join(vendor,archive),join(site,'vendor',archive));
  const projectPath=join(site,'package.json'),project=JSON.parse(await readFile(projectPath,'utf8'));
  project.dependencies[pkg.name]=`file:vendor/${archive}`;project.dependencies[pin.core.name]=pin.core.version;project.dependencies.astro=pin.astro;
  await writeFile(projectPath,JSON.stringify(project,null,2)+'\n');
  run('npm',['install','--package-lock-only','--ignore-scripts','--legacy-peer-deps','--no-audit','--no-fund'],site);
  run('npm',['ci','--ignore-scripts','--legacy-peer-deps','--no-audit','--no-fund'],site);
  const lock=JSON.parse(await readFile(join(site,'package-lock.json'),'utf8')),installed=lock.packages?.[`node_modules/${pin.core.name}`];
  if(installed?.version!==pin.core.version||installed?.integrity!==pin.core.integrity)throw Error('Installed core version or integrity differs from reviewed pin');
  run('npm',['ls',pin.core.name,'--json'],site);
  const base=`${prefix}/docs/v/${version}/`;
  process.env.NIGHTJAR_BASE=base;
  process.env.NIGHTJAR_FAMILY=family;
  run('npm',['run','build'],site);
  const dist=join(site,'dist'),paths=await files(dist);
  const catalog=JSON.parse(await readFile(join(site,'page-archetypes/content/catalog.json'),'utf8'));
  if(catalog.pages?.length!==50||new Set(catalog.pages.map(p=>p.id)).size!==50)throw Error('Expected 50 unique canonical examples');
  for(const page of catalog.pages){if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.id))throw Error('Invalid canonical example id');await readFile(join(dist,'examples',page.id,'index.html'));}
  await readFile(join(dist,'examples/scientific-workspace/index.html'));
  run('python3',[join(root,'scripts/docs-versions/verify-html.py'),dist,'--baseurl',base.replace(/\/$/,'')],root);
  const navigationScript=`const prefix=${JSON.stringify(prefix)},family=${JSON.stringify(family)},active=${JSON.stringify(version)};\n`+
    `const nav=document.querySelector('[data-version-nav]');if(nav)fetch(prefix+'/docs/catalog.json',{credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(c=>{if(c.family!==family||c.framework!=='astro'||!Array.isArray(c.versions)||c.versions.length>1000||!c.versions.some(v=>v.version===active))return;const topic=nav.dataset.topic,list=nav.querySelector('ul'),frag=document.createDocumentFragment();for(const v of c.versions){if(typeof v.version!=='string'||!/^\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?$/.test(v.version)||!Array.isArray(v.topics)||typeof v.supported!=='boolean')return;const use=v.topics.includes(topic)?topic:'';if(use&&!/^[A-Za-z0-9._~/-]+$/.test(use))return;const li=document.createElement('li'),a=document.createElement('a');a.href=prefix+'/docs/v/'+v.version+'/'+use;a.textContent='v'+v.version+(v.version===active?' (current)':'')+(v.version===c.latestStable?' (latest stable)':'')+(v.supported?'':' (unsupported)')+(v.channel==='prerelease'?' (prerelease)':'');if(v.version===active)a.setAttribute('aria-current','page');li.append(a);frag.append(li);}list.replaceChildren(frag)}).catch(()=>{});\n`;
  await writeFile(join(dist,'version-navigation.js'),navigationScript);
  for(const path of paths.filter(p=>p.endsWith('.html'))){
    const topic=relative(dist,path).split('\\').join('/');let html=await readFile(path,'utf8');
    if(!/^[A-Za-z0-9._~/-]+$/.test(topic))throw Error('Unsafe documentation topic');
    if(!html.includes('</head>')||!/<main\b/i.test(html))throw Error(`Unexpected HTML shell: ${topic}`);
    for(const attr of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g))if(attr[1].startsWith('/')&&!attr[1].startsWith(base))throw Error(`Link escapes archive base: ${attr[1]}`);
    const links=baseline.versions.map(x=>`<li><a href="${versionTopicURL(baseline,x.version,topic,prefix||'/')}">v${x.version}${x.version===baseline.latestStable?' (latest stable)':''}${x.supported?'':' (unsupported)'}${x.channel==='prerelease'?' (prerelease)':''}</a></li>`).join('');
    const nav=`<nav aria-label="Documentation versions" data-version-nav data-topic="${topic}"><p>Astro documentation v${version}</p><ul><li><a aria-current="page" href="${base}${topic}">v${version} (current)</a></li>${links}</ul></nav>`;
    html=html.replace('</head>',`<meta name="robots" content="noindex, follow"><script type="module" src="${base}version-navigation.js"></script></head>`).replace(/<main\b/i,`${nav}<main`);
    await writeFile(path,html);
  }
  await mkdir(join(dist,'provenance'),{recursive:true});await cp(join(site,'package-lock.json'),join(dist,'provenance','package-lock.json'));
  const metadata={schemaVersion:1,family,framework:'astro',docsVersion:version,basePath:`/docs/v/${version}/`,implementation:{kind:'npm',name:pkg.name,version,tag:`v${version}`},core:pin.core,source:{repository:`${family}design/astro`,commit:sourceCommit,tag:`v${version}`},fixtures:{source:'repository'},toolchain:{node:process.versions.node,npm:run('npm',['--version'],root).trim(),astro:pin.astro},createdAt:new Date().toISOString(),indexing:'noindex'};
  const result=await createSnapshot({buildRoot:dist,archiveRoot:resolve(env.DOCS_ARCHIVE_ROOT),metadata,coreLock:lock,baselineBytes,baselineSha256:env.DOCS_BASELINE_SHA256});
  console.log(JSON.stringify({snapshot:result,baselineSha256:env.DOCS_BASELINE_SHA256,latestPromoted:false}));
} finally {await rm(temp,{recursive:true,force:true});}
