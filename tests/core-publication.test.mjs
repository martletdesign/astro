import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {checkCorePublication} from '../scripts/check-core-publication.mjs';
test('staging requires the exact genuinely published Core dependency',async()=>{
 const bytes=Buffer.from('reviewed Core'),integrity='sha512-'+createHash('sha512').update(bytes).digest('base64');
 const pkg={name:'@martlet/astro',peerDependencies:{'@martlet/core':'^2.2.4'}},pin={family:'martlet',core:{name:'@martlet/core',version:'2.2.4',integrity}};
 const metadata={name:pin.core.name,version:pin.core.version,dist:{integrity,tarball:'https://registry.npmjs.org/@martlet/core/-/core-2.2.4.tgz'}};
 const fake=(meta=metadata,archive=bytes,status=200)=>{let calls=0;return async(url,options)=>{assert.equal(options.redirect,'error');assert.ok(options.signal);return calls++===0?new Response(JSON.stringify(meta),{status}):new Response(archive);};};
 assert.deepEqual(await checkCorePublication(fake(),pkg,pin),pin.core);
 await assert.rejects(checkCorePublication(fake(metadata,bytes,404),pkg,pin));
 await assert.rejects(checkCorePublication(fake({...metadata,name:'@other/core'}),pkg,pin));
 await assert.rejects(checkCorePublication(fake({...metadata,dist:{...metadata.dist,integrity:'sha512-wrong'}}),pkg,pin));
 await assert.rejects(checkCorePublication(fake(metadata,Buffer.from('corrupt')),pkg,pin));
 await assert.rejects(checkCorePublication(fake({...metadata,dist:{...metadata.dist,tarball:'https://attacker.invalid/core.tgz'}}),pkg,pin));
 await assert.rejects(checkCorePublication(async()=>{throw Error('network unavailable');},pkg,pin));
 await assert.rejects(checkCorePublication(fake(),{...pkg,peerDependencies:{'@martlet/core':'^2.2.3'}},pin));
});
