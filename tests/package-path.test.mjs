import test from 'node:test';
import assert from 'node:assert/strict';
import {validPackagePath} from '../scripts/tag-release-guard.mjs';

test('archive paths accept Astro rest-route filenames and reject actual POSIX traversal',()=>{
 for(const path of ['package/src/components/[...reference].astro','package/src/components/[...examples].astro','package/docs/notes...md','package/.well-known/metadata.json','package/package.json'])assert.equal(validPackagePath(path),true,path);
 for(const path of ['package/../outside','package/src/../../outside','package/src/./file','package/src//file','package/src/','package/','package','/package/src/file','src/file','package/src\\..\\outside','C:\\package\\file'])assert.equal(validPackagePath(path),false,path);
});
