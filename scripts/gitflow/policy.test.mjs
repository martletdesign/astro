import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {branchAllowed, parseReleaseTag, checkRelease} from './policy.mjs';

test('only approved same-repository sources can target protected branches', () => {
  for (const h of ['release/1.2.3','hotfix/1.2.4']) assert.equal(branchAllowed('main',h),true);
  for (const h of ['feature/card','fix/card','release/1.2.3','hotfix/1.2.4','main']) assert.equal(branchAllowed('develop',h),true);
  for (const h of ['main','develop','feature/card','fix/card','release/']) assert.equal(branchAllowed('main',h),false);
  for (const h of ['', 'fix/']) assert.equal(branchAllowed('develop',h),false);
  assert.equal(branchAllowed('develop','fix/card',false),false);
  assert.equal(branchAllowed('develop','feature/card',false),false);
  assert.equal(branchAllowed('other','feature/card'),false);
});

test('release tags select stable and prerelease channels and reject invalid versions', () => {
  assert.deepEqual(parseReleaseTag('v1.2.3'),{version:'1.2.3',distTag:'latest'});
  assert.deepEqual(parseReleaseTag('v1.2.3-rc.1'),{version:'1.2.3-rc.1',distTag:'next'});
  for (const tag of ['1.2.3','v01.2.3','v1.2','v1.2.3-rc.01','v1.2.3+build','v1.2.3-']) assert.throws(()=>parseReleaseTag(tag));
});

test('publication fails closed on version, ancestry, protection and registry errors', () => {
  const good={tag:'v1.2.3',packageVersion:'1.2.3',sourceVersion:'1.2.3',onMainFirstParent:true,protectedTag:true,registryState:'absent'};
  assert.equal(checkRelease(good).distTag,'latest');
  for (const change of [{packageVersion:'1.2.4'},{sourceVersion:'1.2.4'},{onMainFirstParent:false},{protectedTag:false},{registryState:'present'},{registryState:'unknown'}]) assert.throws(()=>checkRelease({...good,...change}));
});

test('feature, release and hotfix merges preserve both integration histories', () => {
  const dir=mkdtempSync(join(tmpdir(),'nightjar-gitflow-'));
  const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  try {
    git('init','-b','main'); git('config','user.name','Nightjar rehearsal'); git('config','user.email','nightjar@example.invalid');
    git('commit','--allow-empty','-m','initial'); git('checkout','-b','develop'); git('checkout','-b','feature/example');
    git('commit','--allow-empty','-m','feature'); git('checkout','develop'); git('merge','--no-ff','feature/example','-m','feature integration');
    git('checkout','-b','release/1.0.0'); git('commit','--allow-empty','-m','release stabilization');
    git('checkout','main'); git('merge','--no-ff','release/1.0.0','-m','release'); git('tag','v1.0.0');
    git('checkout','develop'); git('merge','--no-ff','main','-m','release back merge');
    git('checkout','main'); git('checkout','-b','hotfix/1.0.1'); git('commit','--allow-empty','-m','hotfix');
    git('checkout','main'); git('merge','--no-ff','hotfix/1.0.1','-m','hotfix release'); git('tag','v1.0.1');
    git('checkout','develop'); git('merge','--no-ff','main','-m','hotfix back merge');
    git('merge-base','--is-ancestor','v1.0.0','develop'); git('merge-base','--is-ancestor','v1.0.1','develop');
    assert.ok(git('rev-list','--first-parent','main').split('\n').includes(git('rev-parse','v1.0.1')));
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
