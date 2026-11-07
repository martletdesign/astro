#!/usr/bin/env python3
"""Build and verify a Git-qualified static deployment; never publishes a package."""
import argparse
import concurrent.futures
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tarfile
import tempfile
import time
import threading
import urllib.error
import urllib.parse
import urllib.request
import zipfile
import uuid
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
SHA = re.compile(r'^[0-9a-f]{40}$')

def digest(data):
    return hashlib.sha256(data).hexdigest()

def json_bytes(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'))+'\n').encode()

def read_config(root=ROOT):
    c=json.loads((root/'infra/deployment/site.json').read_text())
    assert c['schemaVersion']==1 and c['family'] in ('martlet','krigsvold')
    assert c['repository']==c['family']+'design/astro'
    assert re.fullmatch(r'[a-f0-9]{32}',c['accountId'])
    assert set(c['targets'])=={'develop','main'}
    for branch,t in c['targets'].items():
        assert re.fullmatch(r'[a-z0-9-]+',t['worker'])
        u=urllib.parse.urlsplit(t['origin'])
        assert u.scheme=='https' and not u.username and not u.password and not u.port and not u.query and not u.fragment and u.path in ('','/')
        assert t['environment']==('astro-development' if branch=='develop' else 'astro-production')
    assert c['targets']['main']['worker']==c['family']+'design-astro-reference'
    assert c['targets']['main']['origin']=='https://astro.'+c['family']+'design.dev'
    assert c['targets']['develop']['worker']==c['targets']['main']['worker']
    assert c['targets']['develop']['previewName']=='develop'
    assert c['targets']['develop']['origin']=='https://develop-'+c['family']+'design-astro-reference.k3jph.workers.dev'
    return c

# GitHub owns acceptance of main/develop through its branch rules and CI.
# Cloudflare checks only that it is building the current accepted ref, and
# separately verifies artifact integrity before and after publication.
# No PR-history, reviewer, or CI API reconstruction belongs here.
def guard(c, branch, sha):
    assert branch in c['targets'] and SHA.fullmatch(sha),'Only accepted main/develop commits can deploy'
    assert os.environ.get('GITHUB_REPOSITORY',c['repository'])==c['repository'],'Repository identity differs'
    local=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True,timeout=15).strip()
    assert local==sha,'Checked-out commit differs from requested deployment'
    clean=subprocess.run(['git','diff','--quiet','HEAD','--'],cwd=ROOT,capture_output=True,text=True,timeout=15,check=False)
    assert clean.returncode==0,'Dirty tracked source must not deploy'
    reported_branch=os.environ.get('WORKERS_CI_BRANCH')
    reported_sha=os.environ.get('WORKERS_CI_COMMIT_SHA')
    assert reported_branch is None or reported_branch==branch,'Cloudflare branch differs from target'
    assert reported_sha is None or reported_sha==sha,'Cloudflare commit differs from checked-out commit'
    # A single public Git ref lookup prevents an older build from superseding a
    # newer accepted branch tip. No GitHub REST credentials or PR-history calls.
    remote='https://github.com/'+c['repository']+'.git'
    ref='refs/heads/'+branch
    result=subprocess.run(['git','ls-remote','--exit-code',remote,ref],
                          cwd=ROOT,capture_output=True,text=True,timeout=30,check=False)
    assert result.returncode==0,'Could not verify current trusted branch ref'
    lines=result.stdout.strip().splitlines()
    assert len(lines)==1,'Expected exactly one trusted branch ref'
    parts=lines[0].split('\t')
    assert len(parts)==2 and parts[1]==ref and SHA.fullmatch(parts[0]),'Invalid trusted branch ref'
    assert parts[0]==sha,'Superseded commit must not deploy'

def inventory(directory):
    files=[]
    for p in sorted(directory.rglob('*')):
        assert not p.is_symlink(),'Symlinks are forbidden in deployment payloads'
        if p.is_file():
            b=p.read_bytes();files.append({'path':p.relative_to(directory).as_posix(),'bytes':len(b),'sha256':digest(b)})
    return files

def cloudflare_build_metadata(branch, sha, environ=None):
    """Whitelisted, overridable environment evidence; not an attestation."""
    environment=os.environ if environ is None else environ
    build_id=environment.get('WORKERS_CI_BUILD_UUID')
    commit=environment.get('WORKERS_CI_COMMIT_SHA')
    reported_branch=environment.get('WORKERS_CI_BRANCH')
    if commit is not None:assert SHA.fullmatch(commit) and commit==sha,'Cloudflare reported commit does not match the actual source'
    if reported_branch is not None:assert reported_branch==branch,'Cloudflare reported branch does not match the target'
    if build_id is None:return None
    assert re.fullmatch(r'[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}',build_id),'Invalid Cloudflare build UUID'
    return {'buildUuid':str(uuid.UUID(build_id)),'commitSha':commit,'branch':reported_branch,'evidence':'environment-reported','independentAttestationClaimed':False}

def finalize(c, branch, sha, destination):
    """Consume the existing native Astro starter output; archive writes stay off."""
    assert branch in c['targets'] and SHA.fullmatch(sha)
    destination=destination.resolve();assert destination==ROOT/'.cloudflare-site' and destination.is_dir() and not destination.is_symlink()
    subprocess.run(['git','diff','--quiet','HEAD'],cwd=ROOT,check=True,timeout=30)
    provenance=json.loads((ROOT/'.cloudflare-build-provenance.json').read_text())
    assert provenance['sourceCommit']==sha and provenance['family']==c['family']
    assert provenance['core']==json.loads((ROOT/'docs-release-lock.json').read_text())['core']
    headers='/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: public, no-transform\n'
    if branch=='develop':
        headers+='  X-Robots-Tag: noindex, nofollow, noarchive\n'
        (destination/'robots.txt').write_text('User-agent: *\nDisallow: /\n')
    (destination/'_headers').write_text(headers)
    files=inventory(destination);artifact_sha=digest(json_bytes(files))
    metadata={'schemaVersion':1,'family':c['family'],'framework':'astro','repository':c['repository'],'branch':branch,'sourceCommit':sha,'sourceTree':subprocess.check_output(['git','rev-parse',sha+'^{tree}'],cwd=ROOT,text=True).strip(),'builtAt':datetime.now(timezone.utc).isoformat(),'artifactSha256':artifact_sha,'package':provenance['package'],'core':provenance['core'],'toolchain':provenance['toolchain'],'worker':c['targets'][branch]['worker'],'url':c['targets'][branch]['origin'],'advancedArchiveEnabled':False,'runtimeBindings':[],'runtimeSecrets':False,'noindex':branch=='develop','deliveryMode':'native-cloudflare-static-assets','manualAccessibilityReviewPassed':False}
    metadata['cloudflareBuild']=cloudflare_build_metadata(branch,sha)
    path=destination/'.well-known/deployment.json';path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(json_bytes(metadata))
    (destination/'deployment-inventory.json').write_bytes(json_bytes({'schemaVersion':1,'artifactSha256':artifact_sha,'files':files}))
    return metadata

def validate_artifact(c, branch, sha, directory):
    assert directory is not None and not directory.is_symlink(),'Deployment directory must not be a symlink'
    directory=directory.resolve();assert directory==ROOT/'.cloudflare-site','Deployment directory escapes the verified output'
    m=json.loads((directory/'.well-known/deployment.json').read_text())
    assert m['repository']==c['repository'] and m['branch']==branch and m['sourceCommit']==sha
    assert m['worker']==c['targets'][branch]['worker'] and m['url']==c['targets'][branch]['origin']
    assert m['advancedArchiveEnabled'] is False and m['runtimeBindings']==[] and m['runtimeSecrets'] is False
    assert m['noindex']==(branch=='develop')
    inv=json.loads((directory/'deployment-inventory.json').read_text())
    assert inv['artifactSha256']==m['artifactSha256']==digest(json_bytes(inv['files']))
    expected={f['path']:f for f in inv['files']}
    assert len(expected)==len(inv['files'])
    actual={f['path']:f for f in inventory(directory) if f['path'] not in ('.well-known/deployment.json','deployment-inventory.json')}
    assert expected==actual,'Artifact bytes or paths changed after verified build'
    return m,inv

def request(url, *, data=None, headers=None, method=None, timeout=25):
    """Bound the entire API response, including a slow body. Never argv secrets."""
    parsed=urllib.parse.urlsplit(url);headers=headers or {}
    loopback=parsed.scheme=='http' and parsed.hostname in ('127.0.0.1','localhost','::1')
    assert parsed.scheme=='https' or (loopback and not any(k.lower()=='authorization' for k in headers)),'API transport must use HTTPS'
    assert not parsed.username and not parsed.password and timeout>0
    config=['url = '+json.dumps(url)]
    for name,value in headers.items():
        assert re.fullmatch(r'[A-Za-z0-9-]+',name) and '\r' not in value and '\n' not in value,'Invalid API header'
        config.append('header = '+json.dumps(name+': '+value))
    with tempfile.TemporaryDirectory(prefix='astro-api-fetch-') as temporary:
        directory=Path(temporary);body=directory/'body';response_headers=directory/'headers'
        if data is not None:
            payload=directory/'request';payload.write_bytes(data)
            config.append('data-binary = '+json.dumps('@'+str(payload)))
        command=['curl','--disable','--silent','--show-error','--config','-','--proto','=http,https' if loopback else '=https','--request',method or ('POST' if data is not None else 'GET'),'--connect-timeout',str(min(10,timeout)),'--max-time',str(timeout),'--max-filesize',str(4*1024*1024),'--dump-header',str(response_headers),'--output',str(body),'--write-out','%{http_code}']
        try:
            completed=subprocess.run(command,input='\n'.join(config)+'\n',text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout+3,check=False)
        except subprocess.TimeoutExpired as error:
            raise TimeoutError('API response exceeded its total wall-clock deadline') from error
        if completed.returncode==28:raise TimeoutError('API response exceeded its total wall-clock deadline')
        assert completed.returncode==0,'API request failed or exceeded the bounded response size'
        assert body.stat().st_size<=4*1024*1024,'API response exceeds size limit'
        raw=response_headers.read_bytes();assert len(raw)<=1024*1024,'API headers exceed size limit'
        last=raw.strip().split(b'\r\n\r\n')[-1].decode('iso-8859-1');fields={}
        for line in last.splitlines()[1:]:
            name,separator,value=line.partition(':')
            if separator:fields[name.strip().lower()]=value.strip()
        return int(completed.stdout),body.read_bytes(),fields

def public_bytes(url, timeout=25):
    """A real HTTPS fetch with a wall-clock deadline, including redirects/body."""
    with tempfile.TemporaryDirectory(prefix='astro-live-fetch-') as temporary:
        root=Path(temporary);body=root/'body';headers=root/'headers'
        command=['curl','--silent','--show-error','--location','--proto-redir','=https','--connect-timeout',str(min(10,timeout)),'--max-time',str(timeout),'--dump-header',str(headers),'--output',str(body),'--write-out','%{http_code}','--user-agent','Mozilla/5.0 AstroDeploymentVerification','--header','Cache-Control: no-cache',url]
        completed=subprocess.run(command,check=False,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout+5)
        assert completed.returncode==0,f'Live request failed or exceeded {timeout}s: {url}'
        last=headers.read_bytes().strip().split(b'\r\n\r\n')[-1].decode('iso-8859-1')
        parsed={}
        for line in last.splitlines()[1:]:
            name,separator,value=line.partition(':')
            if separator:
                key=name.strip().lower();parsed[key]=(parsed[key]+', ' if key in parsed else '')+value.strip()
        return int(completed.stdout),body.read_bytes(),parsed

def verify_live(c, branch, sha, directory, *, overall_timeout=300, request_timeout=25, propagation_timeout=30, retry_delay=1):
    m,inv=validate_artifact(c,branch,sha,directory);origin=c['targets'][branch]['origin']
    deadline=time.monotonic()+overall_timeout;stopping=threading.Event()
    def one(f):
        if f['path']=='_headers':return None
        url=origin+'/'+urllib.parse.quote(f['path'],safe='/')
        attempt=0;propagation_deadline=None
        while True:
            attempt+=1
            left=deadline-time.monotonic()
            if stopping.is_set() or left<=0:raise TimeoutError('Live verification overall deadline or cancellation reached')
            if propagation_deadline is not None:left=min(left,propagation_deadline-time.monotonic())
            if left<=0:raise AssertionError(f'Live bytes did not converge within {propagation_timeout}s: {f["path"]}')
            code,b,h=public_bytes(url,timeout=min(request_timeout,left))
            actual=digest(b)
            matches=len(b)==f['bytes'] and actual==f['sha256']
            # Static asset edges may briefly retain the previous deployment.
            # Only missing/stale bytes retry; transport errors and 5xx fail fast.
            if code==404 or (code==200 and not matches):
                if propagation_deadline is None:propagation_deadline=min(deadline,time.monotonic()+propagation_timeout)
                remaining=propagation_deadline-time.monotonic()
                if remaining>0:
                    delay=min(retry_delay*2**min(attempt-1,3),remaining)
                    if not stopping.wait(delay) and time.monotonic()<propagation_deadline:continue
                raise AssertionError(f'Live bytes did not converge within {propagation_timeout}s after {attempt} attempts: {f["path"]}; status={code}; expectedBytes={f["bytes"]}; actualBytes={len(b)}; expectedSha256={f["sha256"]}; actualSha256={actual}')
            assert code==200,(f['path'],code)
            assert matches,f'Live bytes differ: {f["path"]}'
            headers={k.lower():v for k,v in h.items()}
            if f['path'].endswith('.html'):assert 'no-transform' in headers.get('cache-control','')
            if branch=='develop':assert 'noindex' in headers.get('x-robots-tag','')
            return {'path':f['path'],'sha256':f['sha256'],'status':code,'attempts':attempt}
    files=inv['files']+[{'path':'.well-known/deployment.json','bytes':len((directory/'.well-known/deployment.json').read_bytes()),'sha256':digest((directory/'.well-known/deployment.json').read_bytes())},{'path':'deployment-inventory.json','bytes':len((directory/'deployment-inventory.json').read_bytes()),'sha256':digest((directory/'deployment-inventory.json').read_bytes())}]
    # Submit at most four requests. executor.map would queue the entire site
    # and wait for that queue even after a failure, defeating the rollback bound.
    results=[];remaining=iter(files)
    pool=concurrent.futures.ThreadPoolExecutor(max_workers=4);pending=set()
    def fill():
        while len(pending)<4:
            try:f=next(remaining)
            except StopIteration:return
            pending.add(pool.submit(one,f))
    try:
        fill()
        while pending:
            left=deadline-time.monotonic()
            if left<=0:raise TimeoutError(f'Live verification exceeded {overall_timeout}s overall deadline')
            done,_=concurrent.futures.wait(pending,timeout=left,return_when=concurrent.futures.FIRST_COMPLETED)
            if not done:raise TimeoutError(f'Live verification exceeded {overall_timeout}s overall deadline')
            # Observe all completed failures before submitting any more work.
            batch=[future.result() for future in done]
            pending.difference_update(done);results.extend(batch);fill()
    finally:
        stopping.set()
        for future in pending:future.cancel()
        pool.shutdown(wait=True,cancel_futures=True)
    return {'status':'passed','verifiedAt':datetime.now(timezone.utc).isoformat(),'sourceCommit':sha,'artifactSha256':m['artifactSha256'],'origin':origin,'filesVerified':sum(r is not None for r in results),'noindex':branch=='develop','tlsVerificationDisabled':False,'externalSiteAvailabilityClaimed':False,'overallDeadlineSeconds':overall_timeout,'requestWallClockDeadlineSeconds':request_timeout,'maxInFlightRequests':4}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('operation',choices=['guard','finalize','verify-artifact','verify-live','config']);p.add_argument('--branch',required=True,choices=['develop','main']);p.add_argument('--sha',required=True);p.add_argument('--directory',type=Path);p.add_argument('--output',type=Path)
    a=p.parse_args();c=read_config();assert SHA.fullmatch(a.sha)
    if a.operation=='guard':guard(c,a.branch,a.sha);out={'status':'passed','branch':a.branch,'sourceCommit':a.sha}
    elif a.operation=='finalize':out=finalize(c,a.branch,a.sha,a.directory)
    elif a.operation=='verify-artifact':out=validate_artifact(c,a.branch,a.sha,a.directory)[0]
    elif a.operation=='verify-live':out=verify_live(c,a.branch,a.sha,a.directory)
    else:
        validate_artifact(c,a.branch,a.sha,a.directory)
        out={'name':c['targets'][a.branch]['worker'],'account_id':c['accountId'],'compatibility_date':'2026-11-03','workers_dev':True,'assets':{'directory':str(a.directory.resolve()),'html_handling':'auto-trailing-slash','not_found_handling':'404-page'}}
        if a.branch=='develop':out['previews']={'vars':{}}
    if a.output:a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_bytes(json_bytes(out))
    print(json.dumps(out,sort_keys=True))

if __name__=='__main__':main()
