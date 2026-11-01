import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {parseVersion,sha256,validateManifest,verifyArchive} from '../../scripts/docs-versions/contract.mjs';

// The base URL is a dedicated archive origin. Do not follow redirects carrying
// credentials. Public verification uses an independently supplied manifest hash.
function origin(value) { const u=new URL(value); if(u.protocol!=='https:' || u.username || u.password || u.pathname!=='/' || u.search || u.hash)throw Error('Archive must be a dedicated HTTPS origin'); return u.origin; }
async function response(url,options={}) { const r=await fetch(url,{...options,redirect:'error'}); return r; }
async function expectBytes(r,expected){if(!r.ok || sha256(Buffer.from(await r.arrayBuffer()))!==sha256(expected))throw Error('Remote bytes differ');}
export async function publishCandidate({base,token,archiveRoot,version,expectedSha256}) {
  parseVersion(version);
  const url=origin(base),root=resolve(archiveRoot,version),bytes=await readFile(join(root,'manifest.json'));
  if(sha256(bytes)!==expectedSha256)throw Error('Candidate manifest differs from trusted digest');
  const manifest=JSON.parse(bytes);if(manifest.docsVersion!==version)throw Error('Candidate version mismatch');
  await verifyArchive(root,manifest,expectedSha256);
  if(typeof token!=='string'||token.length<32)throw Error('Missing archive authorization');
  const headers={authorization:`Bearer ${token}`};
  async function put(path,content,extra={}) {
    const endpoint=`${url}/_archive/v/${version}/${path}`;
    const result=await response(endpoint,{method:'PUT',headers:{...headers,...extra},body:content});
    if(result.status===409) await expectBytes(await response(endpoint,{headers}),content);
    else if(result.status!==201) throw Error(`Archive write failed: ${result.status}`);
  }
  for(const file of manifest.files) await put(file.path,await readFile(join(root,file.path)));
  await put('manifest.json',bytes,{'x-manifest-sha256':expectedSha256});
  await verifyPublished({base,version,expectedSha256});
}
export async function verifyPublished({base,version,expectedSha256}) {
  parseVersion(version);
  const url=origin(base);if(!/^[a-f0-9]{64}$/.test(expectedSha256))throw Error('Missing trusted manifest digest');
  const r=await response(`${url}/docs/v/${version}/manifest.json`);if(!r.ok)throw Error(`Manifest fetch failed: ${r.status}`);
  const bytes=Buffer.from(await r.arrayBuffer());if(sha256(bytes)!==expectedSha256)throw Error('Published manifest digest mismatch');
  const manifest=validateManifest(JSON.parse(bytes));if(manifest.docsVersion!==version)throw Error('Published manifest identity mismatch');
  for(const f of manifest.files){const object=await response(`${url}/docs/v/${version}/${f.path}`);if(!object.ok)throw Error(`Missing archive file: ${f.path}`);const data=Buffer.from(await object.arrayBuffer());if(data.length!==f.size || sha256(data)!==f.sha256)throw Error(`Published bytes mismatch: ${f.path}`);}
  return {version,manifestSha256:expectedSha256,files:manifest.files.length};
}
