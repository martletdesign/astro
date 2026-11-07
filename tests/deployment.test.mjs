import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
test('accepted-source and native static integrity boundaries',()=>{execFileSync('python3',['-m','unittest','discover','-s','tests','-p','test_deployment.py'],{stdio:'pipe',timeout:10000});});
