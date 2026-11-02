import fs from 'node:fs/promises';
import path from 'node:path';
import {ResultSynchronizer} from '../src/result-sync.js';
export function startResultMonitor({base,secret,service}){
 const dir=path.join(process.env.GRIDLINE_CACHE_DIR||'/tmp/gridline-worker-cache','result-monitor');let closed=false,lastFailure=0,retryPublishAt=0;
 const file=year=>path.join(dir,year+'.json');
 async function read(url){const r=await fetch(new URL(url,base),{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Result monitor HTTP '+r.status);return r.json();}
 const sync=new ResultSynchronizer({
  loadSeason:year=>read(`/api/season/${year}?refresh=1`),
  loadSaved:async year=>{try{const remote=await read(`/api/results/${year}`);if(remote?.items?.length)return remote;}catch{}try{return JSON.parse(await fs.readFile(file(year)));}catch{return null;}},
  publish:async packet=>{
   if(Date.now()<retryPublishAt)throw Error('Result checkpoint retry delayed');
   try{await fs.mkdir(dir,{recursive:true});const temp=file(packet.season)+'.tmp';await fs.writeFile(temp,JSON.stringify(packet));await fs.rename(temp,file(packet.season));
   const r=await fetch(new URL('/api/internal/results-ingest',base),{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+secret},body:JSON.stringify(packet),signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error('Result checkpoint HTTP '+r.status);await r.arrayBuffer();retryPublishAt=0;}catch(e){retryPublishAt=Date.now()+60000;throw e;}
  }
 });
 function logFailure(error){if(Date.now()-lastFailure>=60000){console.error('Result monitor: '+error.message);lastFailure=Date.now();}}
 const timer=setInterval(()=>{
  if(closed)return;
  // Observe the existing collector only; no extra SignalR connection or raw capture.
  sync.observe(service.state);
  if(sync.dirty)sync.flush().catch(logFailure);
  sync.tick(service.state).then(()=>{if(sync.lastError)logFailure(Error(sync.lastError));}).catch(logFailure);
 },1000);
 sync.tick(service.state).catch(logFailure);
 return {sync,async close(){closed=true;clearInterval(timer);if(sync.dirty)await sync.flush().catch(logFailure);}};
}
