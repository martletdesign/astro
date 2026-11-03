import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {assertCleanStarter} from '../scripts/docs-versions/clean-starter.mjs';
test('archive input rejects nested dependencies and symlinks',async()=>{const dir=await mkdtemp(join(tmpdir(),'starter-clean-'));try{await mkdir(join(dir,'src'));await writeFile(join(dir,'src','page.astro'),'ok');await assert.doesNotReject(assertCleanStarter(dir));await mkdir(join(dir,'src','node_modules'));await assert.rejects(assertCleanStarter(dir),/Generated or linked/);await rm(join(dir,'src','node_modules'),{recursive:true});await symlink('/tmp',join(dir,'src','link'));await assert.rejects(assertCleanStarter(dir),/Generated or linked/);}finally{await rm(dir,{recursive:true,force:true})}});
