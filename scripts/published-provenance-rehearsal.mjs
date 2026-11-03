import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyProvenance} from './tag-release-guard.mjs';
const audit=JSON.parse(await readFile(process.argv[2],'utf8')),archive=await readFile(process.argv[3]);
if(createHash('sha256').update(archive).digest('hex')!=='49ffe50e4c8184492158c758e71dada4300b9012dd8b72d613cf78796fe2f36e')throw Error('Published tarball differs from reviewed bytes');
if(!verifyProvenance({audit,archive,name:'@martlet/astro',version:'1.2.2',repository:'martlettheme/astro',tag:'v1.2.2',commit:'ed1f121ae991fd868e757228664d1c3a737c3c10',expectedWorkflow:'.github/workflows/publish.yml',expectedRef:'refs/tags/v1.2.2',expectedEvent:'release'}))throw Error('Verified existing provenance identity mismatch');
console.log('Published archive and supplied verified-audit provenance match the recorded source');
