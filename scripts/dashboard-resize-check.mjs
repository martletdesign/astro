import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium,firefox,webkit} from 'playwright';
const root=resolve(process.argv[2]),prefix=process.argv[3]??'/';
assert.ok(['/','/preview/'].includes(prefix));
const engine=process.env.DESIGN_BROWSER??'chromium';assert.ok(['chromium','firefox','webkit'].includes(engine));
const watchdog=setTimeout(()=>{console.error(`${engine}: dashboard resize checks exceeded 60 seconds`);process.exit(1);},60000);
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith(prefix)){res.writeHead(404).end();return;}
 let tail=decodeURIComponent(url.pathname.slice(prefix.length));if(!tail||tail.endsWith('/'))tail+='index.html';
 const file=resolve(root,tail);if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
 const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.json':'application/json'};
 res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream'}).end(await readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const options=engine==='chromium'?{...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']}:{};
let browser;
try{
 browser=await ({chromium,firefox,webkit})[engine].launch(options);
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(15000);
 const errors=[];page.on('pageerror',error=>errors.push({route:page.url(),message:error.message}));
 const origin=`http://127.0.0.1:${server.address().port}`;
 for(const route of ['dashboard-analytics','dashboard-operations','dashboard-administration']){
  console.log(`${engine}: checking ${prefix}examples/${route}/ across repeated mobile/desktop resize`);
  const response=await page.goto(`${origin}${prefix}examples/${route}/`,{waitUntil:'networkidle'});assert.equal(response.status(),200);assert.equal(await page.locator('h1').count(),1);
  if(route!=='dashboard-administration')await page.locator('[data-chart] svg').first().waitFor();
  for(const width of [320,1440,320,1440]){
   await page.setViewportSize({width,height:900});
   await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));await page.waitForTimeout(150);
   if(route!=='dashboard-administration')assert.ok(await page.locator('[data-chart] svg').count()>0,'Charts remain rendered after resize');
  }
 }
 assert.deepEqual(errors,[],'Dashboard resizing must not emit any uncaught page errors');await context.close();
 console.log(`${engine}: repeated dashboard resizing passed under ${prefix} with no uncaught page errors`);
}finally{await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done));clearTimeout(watchdog);}
