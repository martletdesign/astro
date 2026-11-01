import {Miniflare} from 'miniflare';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const script=await readFile(new URL('./worker.mjs',import.meta.url),'utf8');
const mf=new Miniflare({modules:true,script,compatibilityDate:'2026-08-06',r2Buckets:['ARCHIVES'],bindings:{FAMILY:'martlet',ARCHIVE_WRITE_TOKEN:'this-is-a-secret-token-32-bytes-minimum'}});
const call=(path,method='GET',body,extra={})=>mf.dispatchFetch('https://example.invalid'+path,{method,body,headers:{authorization:'Bearer this-is-a-secret-token-32-bytes-minimum',...extra}});
const sha=b=>createHash('sha256').update(b).digest('hex');
try{
 const bytes=Buffer.from('<h1>archive</h1>');const v='2.0.0';const manifest=Buffer.from(JSON.stringify({schemaVersion:1,family:'martlet',framework:'astro',docsVersion:v,basePath:`/docs/v/${v}/`,implementation:{kind:'npm',name:'@martlet/astro',version:v,tag:`v${v}`},source:{repository:'martletdesign/astro',commit:'a'.repeat(40),tag:`v${v}`},core:{name:'@martlet/core',version:'2.2.3',integrity:`sha512-${Buffer.alloc(64,1).toString('base64')}`},indexing:'noindex',files:[{path:'index.html',size:bytes.length,sha256:sha(bytes)}]}));
 assert.equal((await call('/_archive/v/2.0.0/index.html','PUT',bytes)).status,201);
 assert.equal((await call('/_archive/v/2.0.0/index.html','PUT',bytes)).status,409);
 assert.equal((await call('/_archive/v/2.0.0/manifest.json','PUT',manifest,{'x-manifest-sha256':sha(manifest)})).status,201);
 assert.equal(await (await call('/docs/v/2.0.0/')).text(),bytes.toString());
 console.log('Miniflare R2 conditional put, commit and public read passed');
}finally{await mf.dispose();}
