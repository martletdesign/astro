import {checkDashboardFamily} from './dashboard-family-check.mjs';
import { cp, mkdtemp, readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const core=process.env.MARTLET_CORE_SOURCE?resolve(process.env.MARTLET_CORE_SOURCE):null;
const pin=JSON.parse(await readFile(join(root,'docs-release-lock.json'),'utf8'));
const temp=await mkdtemp(join(tmpdir(),'martlet-packed-'));
try {
  const pack=cwd=>JSON.parse(execFileSync('npm',['pack','--ignore-scripts','--json','--pack-destination',temp],{cwd,encoding:'utf8',stdio:['ignore','pipe','inherit']}))[0].filename;
  const coreArchive=core?pack(core):null,astroArchive=pack(root);
  const site=join(temp,'site');await cp(join(root,'reference'),site,{recursive:true,filter:path=>!/[\\/](node_modules|dist|\.astro)([\\/]|$)/.test(path)});await mkdir(join(site,'vendor'));
  for(const archive of [coreArchive,astroArchive].filter(Boolean))await cp(join(temp,archive),join(site,'vendor',archive));
  const pkg=JSON.parse(await readFile(join(site,'package.json'),'utf8'));
  pkg.dependencies['@martlet/core']=core?'file:vendor/'+coreArchive:pin.core.version;
  pkg.dependencies['@martlet/astro']='file:vendor/'+astroArchive;
  if(process.env.MARTLET_ASTRO_VERSION)pkg.dependencies.astro=process.env.MARTLET_ASTRO_VERSION;
  await writeFile(join(site,'package.json'),JSON.stringify(pkg,null,2)+'\n');
  execFileSync('npm',['install','--ignore-scripts','--no-audit','--no-fund'],{cwd:site,stdio:'inherit',timeout:180000});
  if(!core){const lock=JSON.parse(await readFile(join(site,'package-lock.json'),'utf8')),installed=lock.packages?.[`node_modules/${pin.core.name}`];assert.equal(installed?.version,pin.core.version);assert.equal(installed?.integrity,pin.core.integrity);}
  execFileSync('npm',['run','build'],{cwd:site,stdio:'inherit',timeout:180000,env:{...process.env,NIGHTJAR_BASE:'/'}});
  await checkDashboardFamily(join(site,'dist'),'martlet');
  const html=await readFile(join(site,'dist/index.html'),'utf8');
  assert.match(html,/data-martlet="light"/);
  assert.match(html,/<h1\b[^>]*>Martlet for Astro<\/h1>/,'The root is the family reference homepage');
  assert.match(html,/Martlet Astro/);
  assert.match(html,/data-hero-variant="signature"/);
  assert.match(html,/aria-label="Primary navigation"/);
  assert.match(html,/<footer\b[^>]*class="[^"]*\bsite-footer\b/);
  assert.equal((html.match(/<main\b/g)||[]).length,1,'The reference homepage has one main landmark');
  assert.equal((html.match(/<h1\b/g)||[]).length,1,'The reference homepage has one page heading');
  const hero=html.match(/\bsrc="(\/assets\/images\/heroes\/martlet-hero-\d+\.webp)"/)?.[1];
  assert.ok(hero,'The approved signature image is referenced by the homepage');
  assert.ok((await readFile(join(site,'dist',hero.slice(1)))).length>0,'The consuming build contains the approved signature image');
  // The layout laboratory retains simultaneous light/dark component coverage;
  // the canonical homepage is no longer a generic component demonstration.
  const layoutsHtml=await readFile(join(site,'dist/layouts/index.html'),'utf8');
  assert.match(layoutsHtml,/data-martlet="light"/);assert.match(layoutsHtml,/data-martlet="dark"/);
  const formHtml=await readFile(join(site,'dist/form/index.html'),'utf8');
  assert.match(formHtml,/id="main-content"/);
  assert.match(formHtml,/type="button"[^>]*disabled|disabled[^>]*type="button"/);
  for(const [id,type] of [['submit','submit'],['reset-button','reset'],['default-button','button']]) {
    const tag=formHtml.match(new RegExp('<button\\b[^>]*id="'+id+'"[^>]*>'))?.[0];
    assert.ok(tag,id+' exists'); assert.equal((tag.match(/\btype=/g)||[]).length,1,'Exactly one type attribute for '+id);
    assert.match(tag,new RegExp('type="'+type+'"'));
  }
  const assets=join(site,'dist/_astro');const files=await readdir(assets);
  const css=(await Promise.all(files.filter(x=>x.endsWith('.css')).map(x=>readFile(join(assets,x),'utf8')))).join('\n');
  for(const family of ['Cambo','Lato','Cinzel','IBM Plex Mono'])assert.ok(css.includes(family),family);
  assert.ok(files.some(x=>x.endsWith('.woff2')),'Local fonts are emitted by the consuming build');
  assert.doesNotMatch(css,/fonts\.googleapis\.com|fonts\.gstatic\.com|Space Grotesk|DM Sans/);
  for (const route of ['article','documentation','layouts','form']) {
    const page=await readFile(join(site,'dist',route,'index.html'),'utf8');
    assert.equal((page.match(/<main\b/g)||[]).length,1,route+' should have one main landmark');
    assert.equal((page.match(/<h1\b/g)||[]).length,1,route+' should have one page h1');
    assert.match(page,/aria-label="Primary navigation"/);assert.match(page,/<footer\b[^>]*class="[^"]*\bsite-footer\b/);
  }
  const article=await readFile(join(site,'dist/article/index.html'),'utf8');
  assert.match(article,/name="example-head" content="forwarded"/);
  assert.match(article,/id="body-end-example"/);
  assert.ok(article.indexOf('martlet-sidebar__main')<article.indexOf('martlet-sidebar__aside'));
  assert.match(article,/<nav aria-label="On this page"/);
  assert.match(article,/<li><a href="#question">[^<]+<\/a><ul><li><a href="#detail">/);
  assert.ok(article.indexOf('martlet-reading-layout__contents') < article.indexOf('martlet-reading-layout__body'));
  assert.ok(article.indexOf('martlet-reading-layout__body') < article.indexOf('martlet-sidebar__aside'));
  assert.match(article,/martlet-site-footer--grouped/);
  assert.equal((article.match(/class="martlet-site-footer__group"/g)||[]).length,3);
  assert.ok(article.includes('Martlet Astro') && article.includes('A website of James Howard'),'Identity slot reaches the grouped footer');
  assert.ok(article.includes('Copyright © 2026 James P. Howard, II'),'Base slot reaches the grouped footer');
  const guide=await readFile(join(site,'dist/documentation/index.html'),'utf8');
  assert.ok(guide.indexOf('martlet-sidebar__aside')<guide.indexOf('martlet-sidebar__main'));
  if(process.env.MARTLET_BROWSER === '1') execFileSync(process.execPath,[join(root,'scripts/browser.mjs'),join(site,'dist')],{cwd:root,stdio:'inherit',timeout:210000});
  if(process.env.MARTLET_BROWSER === '1') execFileSync(process.execPath,[join(root,'scripts/dashboard-resize-check.mjs'),join(site,'dist'),'/'],{cwd:root,stdio:'inherit',timeout:70000});
  if(process.env.MARTLET_BROWSER === '1') execFileSync(process.execPath,[join(root,'scripts/placeholder-contrast-check.mjs'),join(site,'dist'),'/'],{cwd:root,stdio:'inherit',timeout:70000});
  // A host may install this reference beneath a prefix; test its emitted internal URLs.
  execFileSync('npm',['run','build'],{cwd:site,stdio:'inherit',timeout:180000,env:{...process.env,NIGHTJAR_BASE:'/preview/'}});
  await checkDashboardFamily(join(site,'dist'),'martlet');
  execFileSync(process.execPath,[join(root,'scripts/subpath-check.mjs'),join(site,'dist')],{cwd:root,stdio:'inherit',timeout:30000});
  if(process.env.MARTLET_BROWSER === '1') execFileSync(process.execPath,[join(root,'scripts/dashboard-resize-check.mjs'),join(site,'dist'),'/preview/'],{cwd:root,stdio:'inherit',timeout:70000});
  if(process.env.MARTLET_BROWSER === '1') execFileSync(process.execPath,[join(root,'scripts/placeholder-contrast-check.mjs'),join(site,'dist'),'/preview/'],{cwd:root,stdio:'inherit',timeout:70000});
  if(process.env.MARTLET_KEEP_FIXTURE) console.log('Packed reference fixture: '+temp);
  console.log('Packed reference build passed: both modes, all font roles, local font assets, and native button behavior.');
} finally { if (!process.env.MARTLET_KEEP_FIXTURE) await rm(temp,{recursive:true,force:true}); }
