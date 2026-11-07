"""Credential-free regression tests for accepted-source/static integrity boundaries."""
import importlib.util
import json
import os
import shutil
import sys
from pathlib import Path
import subprocess
import tempfile
import unittest
import time
import threading
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from unittest.mock import patch

module_path=Path(__file__).resolve().parents[1]/'scripts/deployment/artifact.py'
spec=importlib.util.spec_from_file_location('astro_artifact',module_path)
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)

class DeploymentTest(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.site=self.root/'.cloudflare-site';self.site.mkdir()
        patcher=patch.object(a,'ROOT',self.root);patcher.start();self.addCleanup(patcher.stop)
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
    def test_escape_and_symlinked_output_rejected(self):
        escaped=self.root/'outside';shutil.copytree(self.site,escaped)
        with self.assertRaisesRegex(AssertionError,'escapes'):a.validate_artifact(self.config,'main',self.sha,escaped)
        alias=self.root/'alias';alias.symlink_to(self.site,target_is_directory=True)
        with self.assertRaisesRegex(AssertionError,'symlink'):a.validate_artifact(self.config,'main',self.sha,alias)
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
            with patch.dict(a.os.environ,{'GITHUB_REPOSITORY':'other/astro'}):
                with self.assertRaisesRegex(AssertionError,'Repository'):a.guard(self.config,'main',self.sha)
            result.stdout='b'*40+'\t'+ref+'\n'
            with self.assertRaisesRegex(AssertionError,'Superseded'):a.guard(self.config,'main',self.sha)
            result.returncode=1
            with self.assertRaisesRegex(AssertionError,'Dirty|verify'):a.guard(self.config,'main',self.sha)
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


class NativeEntrypointTest(unittest.TestCase):
    def test_api_slow_trickle_has_total_wall_clock_bound(self):
        stop=threading.Event()
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_GET(self):
                self.send_response(200);self.end_headers()
                try:
                    while not stop.wait(.03):self.wfile.write(b'x');self.wfile.flush()
                except (BrokenPipeError,ConnectionResetError):pass
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            start=time.monotonic()
            with self.assertRaises(TimeoutError):a.request(f'http://127.0.0.1:{server.server_port}/',timeout=.2)
            self.assertLess(time.monotonic()-start,1.5)
            with self.assertRaises(AssertionError):a.request(f'http://127.0.0.1:{server.server_port}/',headers={'Authorization':'Bearer fixture-only'})
        finally:stop.set();server.shutdown();server.server_close();thread.join(1)
    def test_api_bearer_only_passes_in_private_stdin_config(self):
        def run(command,**options):
            self.assertNotIn('fixture-secret',' '.join(command));self.assertIn('fixture-secret',options['input'])
            self.assertIn('--disable',command);self.assertIn('--max-time',command)
            Path(command[command.index('--output')+1]).write_bytes(b'{"success":true}')
            Path(command[command.index('--dump-header')+1]).write_bytes(b'HTTP/2 200\r\nContent-Type: application/json\r\n\r\n')
            return subprocess.CompletedProcess(command,0,'200','')
        with patch.object(a.subprocess,'run',side_effect=run):
            status,body,headers=a.request('https://api.cloudflare.com/fixture',headers={'Authorization':'Bearer fixture-secret'})
            self.assertEqual(status,200);self.assertEqual(json.loads(body),{'success':True})
    def test_preview_parser_consumes_realistic_cli_output_and_rejects_malformed_reports(self):
        with patch.dict(sys.modules,{'artifact':a}):
            spec=importlib.util.spec_from_file_location('record_preview',module_path.with_name('record-preview.py'))
            preview=importlib.util.module_from_spec(spec);spec.loader.exec_module(preview)
        report={'preview':{'id':'a'*32,'name':'develop','slug':'develop','urls':['https://develop-example.workers.dev']},'deployment':{'id':'12345678-1234-1234-1234-123456789abc','number':1,'created_on':'2026-11-07T00:00:00Z','main_module':'static-assets','annotations':{},'urls':['https://example.workers.dev']}}
        raw='Uploading static assets...\n'+json.dumps(report)+'\n'
        self.assertEqual(preview.parse_preview_output(raw),report)
        for malformed in ['no JSON',raw+'{}',raw.replace('"develop"','"main"'),raw.replace('"annotations": {}','"annotations": []'),'x'*(preview.MAX_PREVIEW_OUTPUT_BYTES+1)]:
            with self.assertRaises((AssertionError,ValueError)):preview.parse_preview_output(malformed)
    def test_actual_native_entrypoints_fail_before_write_on_unaccepted_identity(self):
        root=module_path.parents[2]
        env={**os.environ,'WORKERS_CI_BRANCH':'feature/not-accepted','ASTRO_DEPLOY_BRANCH':'feature/not-accepted','GITHUB_REPOSITORY':'other/astro'}
        for name in ['build-cloudflare.sh','deploy-cloudflare.sh','preview-cloudflare.sh']:
            result=subprocess.run(['bash',str(module_path.with_name(name))],cwd=root,env=env,capture_output=True,text=True,timeout=10)
            self.assertNotEqual(result.returncode,0,name)
        for command in [
            ['python3',str(module_path),'guard','--branch','main','--sha','0'*40],
            ['python3',str(module_path.with_name('record-preview.py'))],
            ['python3',str(module_path.with_name('deploy.py')),'--branch','main','--sha','0'*40,'--directory','.cloudflare-site','--receipt','.unused-receipt.json']]:
            result=subprocess.run(command,cwd=root,env=env,capture_output=True,text=True,timeout=10)
            self.assertNotEqual(result.returncode,0,command)
            self.assertNotIn('NameError',result.stderr)

if __name__=='__main__':unittest.main()
