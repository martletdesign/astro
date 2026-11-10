import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
test('all exported entry points ship as portable source',async()=>{
  for(const path of Object.values(pkg.exports)) assert.ok((await readFile(new URL('../'+path,import.meta.url))).length);
  assert.equal(pkg.peerDependencies['@martlet/core'],'^3.0.0');
});
test('layout leaves identity and optional site behavior to consumers',async()=>{
  const layout=await readFile(new URL('../src/components/Layout.astro',import.meta.url),'utf8');
  for(const name of ['head','header','footer','body-end'])assert.ok(layout.includes(`name="${name}"`));
  assert.doesNotMatch(layout,/jameshoward|google-analytics|favicon|cookie|badge|https?:/i);
  assert.match(layout,/data-martlet=\{mode\}/);
});

test('npm archive contains the library but no reference or starter application', async()=>{
  const {execFileSync}=await import('node:child_process');
  const [archive]=JSON.parse(execFileSync('npm',['pack','--dry-run','--ignore-scripts','--json'],{encoding:'utf8'}));
  assert.ok(archive.files.some(file=>file.path==='src/index.ts'));
  assert.ok(archive.files.every(file=>! /^(reference|starter)\//.test(file.path)));
});
