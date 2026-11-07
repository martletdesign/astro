// Advisory: type-check public native Astro exports in a clean packed consumer.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const root=process.cwd(),pkg=JSON.parse(await readFile('package.json','utf8')),pin=JSON.parse(await readFile('docs-release-lock.json','utf8'));
const temporary=await mkdtemp(join(tmpdir(),'astro-native-type-consumer-'));
const run=(command,args,cwd)=>execFileSync(command,args,{cwd,encoding:'utf8',timeout:180000,stdio:['ignore','pipe','inherit']});
try {
 const archive=JSON.parse(run('npm',['pack','--ignore-scripts','--json','--pack-destination',temporary],root))[0].filename;
 const site=join(temporary,'site');await mkdir(join(site,'src/pages'),{recursive:true});
 await writeFile(join(site,'package.json'),JSON.stringify({name:'native-astro-api-consumer',private:true,type:'module',dependencies:{[pkg.name]:`file:../${archive}`,[pin.core.name]:pin.core.version,astro:process.env.ASTRO_VERSION??'7.3.2','@astrojs/check':'0.9.12',typescript:'5.9.3'}}));
 await writeFile(join(site,'tsconfig.json'),JSON.stringify({extends:'astro/tsconfigs/strict'}));
 await writeFile(join(site,'astro.config.mjs'),"import {defineConfig} from 'astro/config'; export default defineConfig({});\n");
 const imports=`import {Layout,Container,SectionHeading,Card,Button,Stack,Cluster,Grid,Sidebar,Split,Section,PageHeader,SiteHeader,SiteFooter,ArticleLayout,LandingLayout,DocumentationLayout,TableOfContents} from '${pkg.name}';\nimport type {ContentsItem} from '${pkg.name}';\nconst items:ContentsItem[]=[{href:'#question',label:'Question',depth:2}];\n`;
 const routes={
  index:`<Layout title="Native APIs"><SiteHeader slot="header" name="Example" links={[{href:'/',label:'Home'}]}/><Container><PageHeader title="Native APIs"/><SectionHeading title="Components"/><Stack><Cluster><Button type="button">Action</Button><Button href="/article/">Read</Button></Cluster><Grid columns={2}><Card>One</Card><Card>Two</Card></Grid><Sidebar sidebarLabel="Context"><p>Main</p><p slot="sidebar">Context</p></Sidebar><Split ratio="equal"><p>First</p><p slot="secondary">Second</p></Split><Section width="reading"><p>Section</p></Section></Stack></Container><SiteFooter slot="footer" links={[{href:'/',label:'Home'}]}>Example</SiteFooter></Layout>`,
  article:`<ArticleLayout title="Reading"><TableOfContents slot="contents" items={items}/><h2 id="question">Question</h2><p>Reading.</p></ArticleLayout>`,
  landing:`<LandingLayout title="Landing"><p>Content.</p></LandingLayout>`,
  guide:`<DocumentationLayout title="Guide"><nav slot="navigation" aria-label="Guide"><a href="#question">Question</a></nav><h2 id="question">Question</h2></DocumentationLayout>`
 };
 for(const [name,body] of Object.entries(routes))await writeFile(join(site,`src/pages/${name}.astro`),`---\n${imports}---\n${body}\n`);
 run('npm',['install','--ignore-scripts','--no-audit','--no-fund'],site);
 const check=()=>spawnSync('npm',['exec','--','astro','check'],{cwd:site,encoding:'utf8',timeout:180000});
 let result=check();if(result.status!==0)throw Error(`Native API type-check failed\n${result.stdout}\n${result.stderr}`);
 run('npm',['exec','--','astro','build'],site);
 await writeFile(join(site,'src/pages/invalid.astro'),`---\nimport {Grid} from '${pkg.name}';\n---\n<Grid columns={9}><p>Invalid columns must fail type-check.</p></Grid>\n`);
 result=check();assert.notEqual(result.status,0,'Checker must reject unsupported public Grid columns');assert.match(result.stdout+result.stderr,/9|columns/);
 console.log(`Native public Astro component/type exports passed; unsupported API rejected (${pkg.name}, Astro${process.env.ASTRO_VERSION??'7.3.2'}).`);
} finally {await rm(temporary,{recursive:true,force:true});}
