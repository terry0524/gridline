import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'.vercel/output'),fn=path.join(output,'functions/site.func');
const staticDir=path.join(output,'static');
const assets=JSON.parse(await fs.readFile(path.join(root,'deploy/replay-assets.json')));
const staging=await fs.mkdtemp(path.join(os.tmpdir(),'gridline-vercel-seed-'));
try{
 // Restore into an empty staging directory: local raw archives are never uploaded.
 execFileSync(process.execPath,[path.join(root,'scripts/restore-replays.js')],{cwd:staging,stdio:'inherit'});
 await fs.mkdir(fn,{recursive:true});await fs.mkdir(staticDir,{recursive:true});
 await fs.cp(path.join(root,'src'),path.join(fn,'src'),{recursive:true});
 const lock=JSON.parse(await fs.readFile(path.join(root,'package-lock.json')));
 for(const [name,pkg] of Object.entries(lock.packages))if(name.startsWith('node_modules/')&&!pkg.dev){
  if(name.split('/').includes('..'))throw Error('Invalid dependency path');
  await fs.cp(path.join(root,name),path.join(fn,name),{recursive:true});
 }
 for(const f of ['server.js','package.json','index.html','styles.css','app.js','replay.js','chart.js'])await fs.copyFile(path.join(root,f),path.join(fn,f));
 await fs.copyFile(path.join(root,'deploy/vercel-handler.js'),path.join(fn,'handler.js'));
 const routes=[];
 for(const entry of assets.entries){
  const bytes=await fs.readFile(path.join(staging,'.cache',entry.file));
  if(bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('Build asset integrity failure');
  const dest=path.join(fn,'seed',entry.file);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,bytes);
  const match=entry.file.match(/^replays\/\d{4}\/(\d+)-v4\.json\.gz$/);
  if(match){
   // Serve large replay JSON through the CDN, beyond Function response-size limits.
   const file=`replay-data/${match[1]}-v4.json`;
   await fs.mkdir(path.join(staticDir,'replay-data'),{recursive:true});await fs.writeFile(path.join(staticDir,file),gunzipSync(bytes,{maxOutputLength:256*1024*1024}));
   routes.push({src:`/api/replay/${match[1]}/data`,dest:'/'+file,headers:{'Cache-Control':'public, max-age=3600','Content-Type':'application/json; charset=utf-8'}});
  }
 }
 for(const f of ['index.html','styles.css','app.js','replay.js','chart.js','src/race-model.js','src/brand.js','src/season-model.js','src/router.js']){
  const dest=path.join(staticDir,f);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(path.join(root,f),dest);
 }
 await fs.writeFile(path.join(fn,'.vc-config.json'),JSON.stringify({runtime:'nodejs22.x',handler:'handler.js',launcherType:'Nodejs',maxDuration:300,supportsResponseStreaming:true},null,2));
 const csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src https://livetiming.formula1.com; object-src 'none'; frame-src 'none'; base-uri 'self'; frame-ancestors 'none'";
 const config={version:3,routes:[{src:'/(.*)',headers:{'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':csp},continue:true},...routes,{src:'/(api/.*|healthz)',dest:'/site'},{handle:'filesystem'},{src:'/(schedule|standings|results|race-center)(/\\d{4}/[a-z0-9-]+)?/?',dest:'/index.html'},{src:'/(replay|drivers|teams)/\\d{4}/[a-z0-9_-]+/?',dest:'/index.html'},{src:'/',dest:'/index.html'},{src:'/favicon.ico',status:204},{src:'/(.*)',status:404}]};
 await fs.writeFile(path.join(output,'config.json'),JSON.stringify(config,null,2));
 console.log('Vercel output ready: existing UI + API, 3 verified historical replays. Live disabled.');
}finally{await fs.rm(staging,{recursive:true,force:true});}
