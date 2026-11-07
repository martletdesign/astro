import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium,firefox,webkit} from 'playwright';
const root=resolve(process.argv[2]),prefix=process.argv[3]??'/';
assert.ok(['/','/preview/'].includes(prefix));
const engine=process.env.DESIGN_BROWSER??'chromium';assert.ok(['chromium','firefox','webkit'].includes(engine));
const watchdog=setTimeout(()=>{console.error(`${engine}: placeholder contrast checks exceeded 60 seconds`);process.exit(1);},60000);
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith(prefix)){res.writeHead(404).end();return;}
 let tail=decodeURIComponent(url.pathname.slice(prefix.length));if(!tail||tail.endsWith('/'))tail+='index.html';
 const file=resolve(root,tail);if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
 const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.json':'application/json'};
 res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream'}).end(await readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try {
 const options=engine==='chromium'?{...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']}:{};
 browser=await ({chromium,firefox,webkit})[engine].launch(options);
 for(const mode of ['light','dark']) {
  const context=await browser.newContext({viewport:{width:320,height:1000},colorScheme:mode,reducedMotion:'reduce'});context.setDefaultTimeout(10000);context.setDefaultNavigationTimeout(15000);
  await context.addInitScript(mode=>localStorage.setItem('nightjar-appearance',mode),mode);
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const route of ['search','dashboard-administration']) {
   console.log(`${engine}: ${prefix}examples/${route}/ ${mode} operation=placeholder-contrast`);
   const response=await page.goto(`http://127.0.0.1:${server.address().port}${prefix}examples/${route}/`,{waitUntil:'load'});assert.equal(response.status(),200);
   await page.waitForFunction(()=>{const input=document.querySelector('input[placeholder]');return input&&!input.matches(':disabled');});
   const result=await page.locator('input[placeholder]').first().evaluate(input=>{
    const rgba=value=>{const n=value.match(/[\d.]+/g).map(Number);return value.startsWith('color(srgb')?[n[0]*255,n[1]*255,n[2]*255,n[3]??1]:[n[0],n[1],n[2],n[3]??1];};
    const mix=(f,b)=>[f[0]*f[3]+b[0]*(1-f[3]),f[1]*f[3]+b[1]*(1-f[3]),f[2]*f[3]+b[2]*(1-f[3]),1];
    const luminance=a=>{const c=a.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
    const layers=[];for(let element=input;element;element=element.parentElement){const style=getComputedStyle(element);layers.push({color:rgba(style.backgroundColor),image:style.backgroundImage,opacity:style.opacity});if(layers.at(-1).color[3]===1)break;}
    let background=[255,255,255,1];for(const layer of layers.toReversed())background=mix(layer.color,background);
    const style=getComputedStyle(input,'::placeholder'),color=rgba(style.color);color[3]*=Number(style.opacity);const foreground=mix(color,background),a=luminance(foreground),b=luminance(background);
    return {ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),value:input.value,visible:input.getClientRects().length>0,layers};
   });
   assert.equal(result.value,'');assert.equal(result.visible,true);assert.ok(result.layers.every(layer=>layer.image==='none'&&Number(layer.opacity)===1));
   assert.ok(result.ratio>=4.5,`${route} ${mode} placeholder contrast ${result.ratio} must be >=4.5`);
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log(`${engine}: enabled placeholder contrast passed under ${prefix}`);
} finally {await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done));clearTimeout(watchdog);}
