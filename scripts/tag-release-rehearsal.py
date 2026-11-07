import os, pathlib, subprocess, tempfile, json, shutil, sys, re
src=pathlib.Path(__file__).resolve().parent.parent
family=json.loads((src/'package.json').read_text())['name'].split('/')[0][1:]
source_package=json.loads((src/'package.json').read_text())
if source_package.get('private') is not True or f'@{family}/core' not in source_package.get('peerDependencies',{}): raise SystemExit('Rehearsal requires the combined private core-migration candidate')
base=pathlib.Path(tempfile.mkdtemp(prefix='nightjar-release-rehearsal-'))
repo=base/'repo';repo.mkdir()
def run(args,cwd=repo,env=None,quiet=True):
 p=subprocess.run(args,cwd=cwd,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if p.returncode: print('FAILED',args,p.stdout[-1200:],p.stderr[-1200:]);raise SystemExit(p.returncode)
 return p.stdout.strip()
a=subprocess.run(['git','archive','HEAD'],cwd=src,stdout=subprocess.PIPE,check=True)
subprocess.run(['tar','--same-permissions','-x','-C',str(repo)],input=a.stdout,check=True)
version='9999.0.0-nightjar.0'
for f in ['package.json','package-lock.json']:
 p=repo/f;d=json.loads(p.read_text());d['version']=version
 if f=='package-lock.json': d['packages']['']['version']=version
 p.write_text(json.dumps(d,indent=2)+'\n')
p=repo/'CHANGELOG.md';text,count=re.subn(r'^## [0-9]+\.[0-9]+\.[0-9]+',f'## {version}',p.read_text(),count=1,flags=re.MULTILINE);assert count==1;p.write_text(text)
env=os.environ.copy();env.setdefault('NODE_USE_ENV_PROXY','1')
run(['npm','ci','--ignore-scripts','--legacy-peer-deps'],env=env)
run(['npm','run','build','--if-present'],env=env)
run(['npm','test'],env=env)
run(['git','init','-b','main']);run(['git','config','user.email','rehearsal@example.invalid']);run(['git','config','user.name','Rehearsal']);run(['git','add','-A']);run(['git','commit','-m','rehearsal']);sha=run(['git','rev-parse','HEAD']);tag='v'+version;run(['git','tag',tag]);run(['git','clone','--bare',str(repo),str(base/'origin.git')],cwd=base);run(['git','remote','add','origin',str(base/'origin.git')]);run(['git','fetch','origin','main']);
identity=('martletdesign/astro' if family=='martlet' else 'krigsvolddesign/astro')
env.update({'RELEASE_TAG':tag,'GITHUB_REPOSITORY':identity,'GITHUB_SHA':sha,'REF_PROTECTED':'true','RELEASE_ENVIRONMENT_READY':'yes','GITHUB_OUTPUT':str(base/'outputs')})
run(['node','scripts/tag-release-cli.mjs','preflight'],env=env)
export=base/'export';export.mkdir();archive=subprocess.run(['git','archive','HEAD'],cwd=repo,stdout=subprocess.PIPE,check=True);subprocess.run(['tar','--same-permissions','-x','-C',str(export)],input=archive.stdout,check=True)
p=export/'package.json';d=json.loads(p.read_text());assert d['private'] is True;d['private']=False;p.write_text(json.dumps(d,indent=2)+'\n')
out=base/'out';out.mkdir();result=json.loads(run(['npm','pack','--ignore-scripts','--pack-destination',str(out),'--json'],cwd=export,env=env));artifact=out/result[0]['filename']
run(['node','scripts/tag-release-cli.mjs','inspect',str(artifact)],env=env)
run(['npm','publish',str(artifact),'--dry-run','--ignore-scripts','--tag','next','--registry=http://127.0.0.1:9','--fetch-retries=0','--fetch-timeout=2000'],env=env)
bad=env.copy();bad['REF_PROTECTED']='false';rejected=subprocess.run(['node','scripts/tag-release-cli.mjs','preflight'],cwd=repo,env=bad,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
if rejected.returncode==0: raise SystemExit('Unprotected tag unexpectedly accepted')
print(json.dumps({'family':family,'preflight':'pass with simulated protection and local tag','unprotected':'rejected','build':'pass','tests':'pass','pack_inspect':'pass','npm_publish_dry_run':'pass against unreachable local registry','production_mutations':False}))
