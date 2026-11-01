import {execFileSync} from 'node:child_process';
import {createHash, timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';

export function releaseVersion(tag) {
  const match=/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(tag);
  if (!match || (match[4] && match[4].split('.').some(x=>/^\d+$/.test(x)&&x.length>1&&x.startsWith('0')))) throw Error('Invalid release tag');
  return {version:tag.slice(1),channel:match[4]?'next':'latest'};
}

export function validateIdentity({tag,pkg,source,lock,repository,expectedRepository,expectedName}) {
  const result=releaseVersion(tag);
  if(repository!==expectedRepository || pkg.name!==expectedName || pkg.private===true || pkg.version!==result.version || source.version!==result.version) throw Error('Release identity mismatch');
  if(pkg.repository?.url!==`git+https://github.com/${expectedRepository}.git`) throw Error('Repository metadata mismatch');
  if(lock.name!==pkg.name || lock.version!==pkg.version || lock.packages?.['']?.name!==pkg.name || lock.packages?.['']?.version!==pkg.version || !['dependencies','devDependencies','peerDependencies','optionalDependencies'].every(key=>isDeepStrictEqual(lock.packages?.['']?.[key]??{},pkg[key]??{}))) throw Error('Lockfile metadata mismatch');
  return result;
}

export function productionCommit({git,tag,sha,protectedRef}) {
  if(protectedRef!=='true' || !/^[0-9a-f]{40}$/.test(sha)) throw Error('Unprotected ref or invalid event commit');
  releaseVersion(tag);
  const peeled=git(['rev-parse',`refs/tags/${tag}^{commit}`]).trim();
  if(peeled!==sha || git(['rev-parse','HEAD']).trim()!==sha) throw Error('Tag, event and checkout differ');
  if(!git(['rev-list','--first-parent','refs/remotes/origin/main']).trim().split('\n').includes(sha)) throw Error('Commit is not on main first-parent history');
  const local=git(['rev-parse',`refs/tags/${tag}`]).trim();
  const remote=git(['ls-remote','--refs','origin',`refs/tags/${tag}`]).trim().split(/\s+/);
  if(remote.length!==2 || remote[0]!==local || remote[1]!==`refs/tags/${tag}`) throw Error('Tag differs from remote');
}

export async function registryState(fetcher,registry,name,version) {
  try {
    const root=new URL(registry); if(root.protocol!=='https:') return 'unknown';
    const url=new URL(encodeURIComponent(name),root).href;
    const pkg=await fetcher(url); if(pkg.status!==200 || (await pkg.json()).name!==name) return 'unknown';
    const found=await fetcher(`${url}/${encodeURIComponent(version)}`);
    if(found.status===404) return 'absent';
    if(found.status!==200) return 'unknown';
    const data=await found.json(); return data.name===name && data.version===version?'present':'unknown';
  } catch {return 'unknown';}
}

export function verifyArchive({local,remote,metadata,name,version}) {
  if(metadata?.name!==name || metadata?.version!==version || !Buffer.isBuffer(local) || !Buffer.isBuffer(remote)) return false;
  const digest=b=>createHash('sha512').update(b).digest();
  const integrity=metadata?.dist?.integrity;
  if(typeof integrity!=='string' || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(integrity)) return false;
  const a=digest(local),b=digest(remote),c=Buffer.from(integrity.slice(7),'base64');
  return c.length===a.length && timingSafeEqual(a,b) && timingSafeEqual(a,c);
}

export async function identityFromFiles({tag,repository,expectedRepository,expectedName}) {
  const [pkg,lock,changelog]=await Promise.all([readFile('package.json','utf8').then(JSON.parse),readFile('package-lock.json','utf8').then(JSON.parse),readFile('CHANGELOG.md','utf8')]);
  if(!changelog.split('\n').some(line=>line.startsWith(`## ${pkg.version} `)||line===`## ${pkg.version}`)) throw Error('Changelog lacks exact source version');
  return validateIdentity({tag,pkg,source:{version:pkg.version},lock,repository,expectedRepository,expectedName});
}
export function realGit(args) {return execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});}
