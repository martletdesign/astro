import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const dist=process.argv[2], base='/preview/';
for(const route of ['', 'article', 'documentation', 'layouts', 'form']) {
 const page=await readFile(join(dist, route, 'index.html'),'utf8');
 const hrefs=[...page.matchAll(/\bhref="([^"]*)"/g)].map(m=>m[1]);
 const escaped=hrefs.filter(href=>href.startsWith('/')&&!href.startsWith(base));
 assert.deepEqual(escaped,[],`${route||'index'}: root-relative hrefs must remain under ${base}`);
}
const home=await readFile(join(dist,'index.html'),'utf8');
assert.match(home,/href="\/preview\/article\/"/);
assert.match(home,/href="\/preview\/form\/"/);
console.log('Five starter pages retain their links and assets under /preview/.');

// Exercise navigation under the mounted base with and without JavaScript.
if (process.env.MARTLET_BROWSER === '1' || process.env.KRIGSVOLD_BROWSER === '1') {
 const {createServer} = await import('node:http');
 const {resolve,extname,sep} = await import('node:path');
 const {chromium,firefox,webkit} = await import('playwright');
 const root = resolve(dist), engine = process.env.DESIGN_BROWSER || 'chromium';
 assert.ok(['chromium','firefox','webkit'].includes(engine));
 const server=createServer(async(req,res)=>{try {const url=new URL(req.url,'http://localhost'); if(!url.pathname.startsWith(base)){res.writeHead(404).end();return;}const path=resolve(root,'.'+decodeURIComponent(url.pathname.slice(base.length-1))+(url.pathname.endsWith('/')?'index.html':''));if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}const data=await readFile(path),type={'.html':'text/html','.css':'text/css','.js':'application/javascript','.woff2':'font/woff2'}[extname(path)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type}).end(data);}catch{res.writeHead(404).end();}});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const browser=await ({chromium,firefox,webkit})[engine].launch(engine==='chromium'&&process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{});
 try {for(const enabled of [false,true]) {const context=await browser.newContext({javaScriptEnabled:enabled}),page=await context.newPage();const origin=`http://127.0.0.1:${server.address().port}`;const response=await page.goto(origin+base);assert.equal(response.status(),200);const link=page.getByRole('link',{name:'Try registration, recovery and reset.'});assert.equal(await link.getAttribute('href'),base+'form/');await link.click();assert.equal(new URL(page.url()).pathname,base+'form/');if(enabled)await page.waitForFunction(()=>document.querySelector('#submit')&&!document.querySelector('#submit').disabled,{timeout:10000});assert.equal(await page.locator('#submit').isDisabled(),!enabled);await page.locator('header a').first().click();assert.equal(new URL(page.url()).pathname,base);await context.close();}}finally{await browser.close();server.closeAllConnections();await new Promise(done=>server.close(done));}
 console.log(`${engine}: subpath navigation and JavaScript fallbacks passed.`);
}
