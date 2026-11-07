"""Credential-free regression tests for accepted-source/static integrity boundaries."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

module_path=Path(__file__).resolve().parents[1]/'scripts/deployment/artifact.py'
spec=importlib.util.spec_from_file_location('astro_artifact',module_path)
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)

class DeploymentTest(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.site=self.root/'.cloudflare-site';self.site.mkdir()
        self.config=a.read_config();self.sha='a'*40
        (self.site/'index.html').write_text('<main><h1>Example</h1></main>')
        files=a.inventory(self.site);artifact=a.digest(a.json_bytes(files))
        m={'repository':self.config['repository'],'branch':'main','sourceCommit':self.sha,'worker':self.config['targets']['main']['worker'],'url':self.config['targets']['main']['origin'],'advancedArchiveEnabled':False,'runtimeBindings':[],'runtimeSecrets':False,'noindex':False,'artifactSha256':artifact}
        (self.site/'.well-known').mkdir();(self.site/'.well-known/deployment.json').write_bytes(a.json_bytes(m))
        (self.site/'deployment-inventory.json').write_bytes(a.json_bytes({'artifactSha256':artifact,'files':files}))
    def test_integrity_rejects_changed_missing_extra_and_symlinked_payload(self):
        a.validate_artifact(self.config,'main',self.sha,self.site)
        p=self.site/'index.html';original=p.read_bytes();p.write_text('corrupt')
        with self.assertRaises(AssertionError):a.validate_artifact(self.config,'main',self.sha,self.site)
        p.write_bytes(original);extra=self.site/'extra';extra.write_text('unexpected')
        with self.assertRaises(AssertionError):a.validate_artifact(self.config,'main',self.sha,self.site)
        extra.unlink();p.unlink()
        with self.assertRaises(AssertionError):a.validate_artifact(self.config,'main',self.sha,self.site)
        p.symlink_to(self.site/'deployment-inventory.json')
        with self.assertRaises(AssertionError):a.validate_artifact(self.config,'main',self.sha,self.site)
    def test_wrong_identity_and_runtime_authority_rejected(self):
        p=self.site/'.well-known/deployment.json';original=json.loads(p.read_text())
        for key,value in [('sourceCommit','b'*40),('branch','develop'),('runtimeBindings',[{'type':'r2_bucket'}]),('runtimeSecrets',True),('noindex',True),('advancedArchiveEnabled',True)]:
            m={**original,key:value};p.write_bytes(a.json_bytes(m))
            with self.assertRaises(AssertionError):a.validate_artifact(self.config,'main',self.sha,self.site)
    def test_only_current_accepted_ref_is_deployable(self):
        ref='refs/heads/main'
        result=subprocess.CompletedProcess([],0,self.sha+'\t'+ref+'\n','')
        with patch.object(a.subprocess,'check_output',return_value=self.sha+'\n'),patch.object(a.subprocess,'run',return_value=result),patch.dict(a.os.environ,{},clear=True):
            a.guard(self.config,'main',self.sha)
            with self.assertRaises(AssertionError):a.guard(self.config,'feature/experiment',self.sha)
            result.stdout='b'*40+'\t'+ref+'\n'
            with self.assertRaisesRegex(AssertionError,'Superseded'):a.guard(self.config,'main',self.sha)
            result.returncode=1
            with self.assertRaisesRegex(AssertionError,'verify'):a.guard(self.config,'main',self.sha)
    def test_live_verification_rejects_changed_bytes_and_honors_deadline(self):
        def fetch(url,timeout=25):
            path=url.removeprefix(self.config['targets']['main']['origin']+'/')
            return 200,(self.site/path).read_bytes(),{'cache-control':'public,no-transform'}
        with patch.object(a,'public_bytes',side_effect=fetch):
            result=a.verify_live(self.config,'main',self.sha,self.site,overall_timeout=2)
            self.assertEqual(result['filesVerified'],3);self.assertEqual(result['maxInFlightRequests'],4)
        with patch.object(a,'public_bytes',return_value=(200,b'corrupt',{})):
            with self.assertRaises(AssertionError):a.verify_live(self.config,'main',self.sha,self.site,overall_timeout=1,propagation_timeout=0)
        with patch.object(a,'public_bytes',side_effect=TimeoutError('request deadline')):
            with self.assertRaises(TimeoutError):a.verify_live(self.config,'main',self.sha,self.site,overall_timeout=1)

if __name__=='__main__':unittest.main()
