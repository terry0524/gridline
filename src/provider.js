import fs from 'node:fs/promises';
import path from 'node:path';
import {offline,version} from './config.js';
import {createHash,randomUUID} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
export const cacheDir=process.env.GRIDLINE_CACHE_DIR?path.resolve(process.env.GRIDLINE_CACHE_DIR):path.join(path.dirname(fileURLToPath(import.meta.url)),'../.cache');
const bases={openf1:'https://api.openf1.org/v1/',jolpica:'https://api.jolpi.ca/ergast/f1/',circuit:'https://api.multiviewer.app/api/v1/circuits/'};
const pending=new Map(); const queues=new Map(); const lastRequest=new Map();
const delay=ms=>new Promise(r=>setTimeout(r,ms));
export class ProviderError extends Error {constructor(message,status=502){super(message);this.status=status;}}
// A single queue per provider, shared by replay imports and ordinary proxy calls.
function enqueue(source,task){const next=(queues.get(source)||Promise.resolve()).catch(()=>{}).then(async()=>{const spacing=source==='openf1'?2200:source==='jolpica'?700:0;await delay(Math.max(0,spacing-(Date.now()-(lastRequest.get(source)||0))));lastRequest.set(source,Date.now());return task();});queues.set(source,next);return next;}
export async function getData(source,endpoint,params={},ttl=300000){
 if(!bases[source])throw new ProviderError('Unknown provider',400);
 const u=new URL(endpoint+(source==='jolpica'?'.json':''),bases[source]);
 if(!u.href.startsWith(bases[source]))throw new ProviderError('Invalid endpoint',400);
 for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v));
 u.searchParams.sort(); const key=createHash('sha256').update(u.href).digest('hex');
 const file=path.join(cacheDir,'upstream',`${key}.json.gz`);
 let cached;try{cached=JSON.parse(gunzipSync(await fs.readFile(file),{maxOutputLength:256*1024*1024}));if(Date.now()-Date.parse(cached.fetchedAt)<ttl)return {...cached,cache:'HIT',stale:false};}catch{}
 if(offline){if(cached)return{...cached,cache:'OFFLINE',stale:true};throw new ProviderError('Upstream offline; cached data unavailable',503);}
 if(pending.has(key))return pending.get(key);
 const promise=enqueue(source,async()=>{
  for(let attempt=0;attempt<4;attempt++){
   try{
    const response=await fetch(u,{headers:{accept:'application/json',...(source==='jolpica'?{'user-agent':'Gridline/'+version+' Node/'+process.versions.node}:{})},signal:AbortSignal.timeout(90000)});
    if(response.status===429||response.status>=500){if(attempt<3){await delay(response.status===429?Math.max(15000,Number(response.headers.get('retry-after')||0)*1000):3000*(attempt+1));continue;}}
    if(!response.ok)throw new ProviderError(`${source}: HTTP ${response.status}`,response.status);
    const size=256*1024*1024;if(Number(response.headers.get('content-length'))>size)throw new ProviderError('Provider payload too large',413);const chunks=[];let length=0;for await(const chunk of response.body){length+=chunk.length;if(length>size)throw new ProviderError('Provider payload too large',413);chunks.push(chunk);}const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(source!=='jolpica'&&source!=='circuit'&&!Array.isArray(data))throw new ProviderError('Unexpected provider schema');
    if(source==='jolpica'&&!data.MRData)throw new ProviderError('Unexpected Jolpica schema');
    const envelope={source,url:u.href,fetchedAt:new Date().toISOString(),sha256:createHash('sha256').update(JSON.stringify(data)).digest('hex'),data};
    await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';await fs.writeFile(tmp,gzipSync(JSON.stringify(envelope)));await fs.rename(tmp,file);
    return {...envelope,cache:'MISS',stale:false};
   }catch(err){if(attempt===3||err instanceof ProviderError){if(cached)return {...cached,cache:'STALE',stale:true};throw err;}await delay(3000*(attempt+1));}
  }
 });pending.set(key,promise);try{return await promise;}finally{pending.delete(key);}
}
export const historicalTTL=365*86400000;
export function isHistorical(session,now=Date.now()){return Number.isFinite(Date.parse(session.date_end))&&now>Date.parse(session.date_end)+30*60000;}
