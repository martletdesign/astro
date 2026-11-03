import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('canonical site checks detect missing and changed example content',()=>{
 const root=mkdtempSync(join(tmpdir(),'canonical-site-'));
 try{
  const pages=Array.from({length:50},(_,i)=>({id:`example-${i}`,title:`Title ${i}`,summary:`Summary ${i}`}));
  const catalog=join(root,'catalog.json');writeFileSync(catalog,JSON.stringify({pages}));
  for(const p of pages){const dir=join(root,'examples',p.id);mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'index.html'),`<main><h1>${p.title}</h1><p>${p.summary}</p></main>`)}
  const science=join(root,'examples','scientific-workspace');mkdirSync(science);writeFileSync(join(science,'index.html'),'science');
  const run=()=>execFileSync('python3',['scripts/docs-versions/verify-canonical.py',root,catalog],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  assert.match(run(),/50 canonical/);
  const target=join(root,'examples','example-0','index.html');writeFileSync(target,'<main><h1>Wrong</h1><p>Summary 0</p></main>');
  assert.throws(run,/canonical heading/);
  rmSync(target);assert.throws(run,/No such file/);
 }finally{rmSync(root,{recursive:true,force:true})}
});
