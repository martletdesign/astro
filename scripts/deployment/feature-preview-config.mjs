// Candidate previews only: never deploy to production.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const branch=process.argv[3];
assert.match(branch,/^(?:feature|fix|hotfix|release)\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/);
const config=JSON.parse(await readFile('infra/deployment/site.json','utf8'));
const name=branch.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,57).replace(/-+$/,'');
assert.match(name,/^[a-z0-9][a-z0-9-]{0,56}$/);
if(process.argv[2]==='name')console.log(name);
else if(process.argv[2]==='config'){
 const output={name:config.targets.main.worker,account_id:config.accountId,
 compatibility_date:'2026-11-03',workers_dev:true,
 assets:{directory:resolve('.cloudflare-site'),html_handling:'auto-trailing-slash',not_found_handling:'404-page'},
 previews:{vars:{}}};
 await writeFile('.cloudflare-feature-wrangler.json',JSON.stringify(output,null,2)+'\n');
 console.log('FEATURE_PREVIEW_CONFIG',JSON.stringify({branch,preview:name,productionDeployInvoked:false}));
}else throw Error('Use name or config');
