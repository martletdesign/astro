import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {verifyArchive} from './tag-release-guard.mjs';
async function boundedBytes(response,limit) {
 assert.equal(response.status,200,'Exact Core dependency is unpublished or registry access failed');
 const chunks=[];let size=0;const reader=response.body.getReader();
 try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;assert.ok(size<=limit,'Core registry response exceeds its size bound');chunks.push(Buffer.from(value));}}
 finally {await reader.cancel();}
 return Buffer.concat(chunks);
}
export async function checkCorePublication(fetcher,pkg,pin) {
 const {family,core}=pin;assert.ok(['martlet','krigsvold'].includes(family));
 assert.equal(pkg.name,`@${family}/astro`);assert.equal(core.name,`@${family}/core`);
 assert.equal(pkg.peerDependencies[core.name],`^${core.version}`,'Published Core pin must match the supported minimum');
 assert.match(core.version,/^\d+\.\d+\.\d+$/);
 const options=()=>({signal:AbortSignal.timeout(15000),redirect:'error'});
 const metadata=JSON.parse((await boundedBytes(await fetcher(`https://registry.npmjs.org/${encodeURIComponent(core.name)}/${core.version}`,options()),1024*1024)).toString('utf8'));
 assert.equal(metadata.name,core.name);assert.equal(metadata.version,core.version);assert.equal(metadata.dist?.integrity,core.integrity,'Published Core differs from the reviewed pin');
 const url=new URL(metadata.dist.tarball);assert.equal(url.protocol,'https:');assert.equal(url.hostname,'registry.npmjs.org');assert.equal(url.username+url.password,'');
 const archive=await boundedBytes(await fetcher(url.href,options()),8*1024*1024);
 assert.equal(verifyArchive({local:archive,remote:archive,metadata,name:core.name,version:core.version}),true,'Published Core bytes do not match pinned integrity');
 return {name:core.name,version:core.version,integrity:core.integrity};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const pkg=JSON.parse(await readFile('package.json','utf8')),pin=JSON.parse(await readFile('docs-release-lock.json','utf8'));
 console.log(JSON.stringify({publishedCore:await checkCorePublication(fetch,pkg,pin)}));
}
