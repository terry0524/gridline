import {getCache} from '@vercel/functions';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {cacheDir,ProviderError} from './provider.js';
import {mergeResultSnapshot} from './result-model.js';
const queues=new Map();
export function resultYear(year){if(!Number.isInteger(year)||year<2023||year>new Date().getFullYear())throw new ProviderError('Invalid results season',400);return year;}
const localStore={
 async get(key){try{return JSON.parse(await fs.readFile(path.join(cacheDir,'published-results',key+'.json')));}catch{return null;}},
 async set(key,value){const file=path.join(cacheDir,'published-results',key+'.json');await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(value));await fs.rename(temp,file);}
};
export const resultsCache=()=>process.env.VERCEL==='1'?getCache({namespace:'gridline-results-v1'}):localStore;
export async function readResults(year,store=resultsCache()){
 const key='year-'+resultYear(year);try{const e=await store.get(key);return e?.encoding==='gzip'?JSON.parse(gunzipSync(Buffer.from(e.data,'base64'),{maxOutputLength:1024*1024})):null;}catch{return null;}
}
export function validateResultPacket(p,now=Date.now()){
 resultYear(p?.season);
 if(p.version!==1||!Number.isFinite(p.checkedAt)||Math.abs(now-p.checkedAt)>120000||!Array.isArray(p.items)||p.items.length>100)throw Error('Invalid result packet');
 for(const item of p.items){const m=item?.meeting;
  if(!m||m.season!==p.season||!Number.isInteger(m.round)||m.round<1||m.round>30||!['race','sprint','qualifying'].includes(m.kind)||!['PROVISIONAL','SOURCE_RESULT','PUBLISHED'].includes(item.status)||!['F1 Timing','OpenF1 historical','Jolpica'].includes(item.source)||item.status==='PUBLISHED'&&item.source!=='Jolpica'||item.status==='PROVISIONAL'&&item.source!=='F1 Timing'||item.status==='SOURCE_RESULT'&&item.source!=='OpenF1 historical'||!Number.isFinite(item.checkedAt)||item.checkedAt>now+5000||!Number.isFinite(item.sourceAt)||item.sourceAt>now+5000||!/^[a-z0-9-]{1,100}$/.test(m.slug)||typeof m.name!=='string'||!Array.isArray(m.sessions)||!Array.isArray(m.results)||!m.results.length||m.results.length>30)throw Error('Invalid normalized result');
  const numbers=new Set();for(const row of m.results){
   if(!Number.isInteger(row.number)||row.number<1||row.number>999||numbers.has(row.number)||!row.driver||!row.team||row.position!==null&&(!Number.isInteger(row.position)||row.position<1||row.position>40)||!['PROVISIONAL','CLASSIFIED','QUALIFIED','DNF','DNS','DSQ','DNQ','—'].includes(row.classification)||item.status==='PUBLISHED'&&m.kind!=='qualifying'&&!Number.isFinite(row.points)||item.status==='PROVISIONAL'&&row.points!==null)throw Error('Invalid result row');numbers.add(row.number);
  }
 }
 if(p.standings){const s=p.standings;if(!Number.isInteger(s.round)||s.round<1||s.round>30||!Array.isArray(s.drivers)||!Array.isArray(s.constructors)||!s.drivers.length||!s.constructors.length||s.drivers.length>40||s.constructors.length>20||!Number.isFinite(s.sourceAt)||[...s.drivers,...s.constructors].some(r=>typeof r.id!=='string'||!Number.isFinite(r.points)||!Number.isFinite(r.position)))throw Error('Invalid published standings');}
 function safe(v,depth=0){if(depth>15)throw Error('Result nesting too deep');if(typeof v==='string'&&v.length>500)throw Error('Result string too long');if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(/cookie|token|authorization|password|secret|raw|audio|radio|reference|__proto__|^url$/i.test(k))throw Error('Forbidden result field');safe(x,depth+1);}}
 safe(p);return p;
}
export async function ingestResults(req,store=resultsCache()){
 let length=0;const chunks=[];for await(const chunk of req){length+=Buffer.byteLength(chunk);if(length>1024*1024)throw Error('Result packet too large');chunks.push(Buffer.from(chunk));}
 const packet=validateResultPacket(JSON.parse(Buffer.concat(chunks).toString('utf8'))),key='year-'+packet.season;
 const job=(queues.get(key)??Promise.resolve()).catch(()=>{}).then(async()=>{
  const prior=await readResults(packet.season,store),merged=mergeResultSnapshot(prior,packet);
  const encoded=gzipSync(JSON.stringify(merged));if(encoded.length>240000)throw Error('Result cache too large');
  await store.set(key,{encoding:'gzip',data:encoded.toString('base64')},{ttl:30*86400});return{accepted:true,revision:merged.revision};
 });queues.set(key,job);try{return await job;}finally{if(queues.get(key)===job)queues.delete(key);}
}
export async function resultRevision(year,store=resultsCache(),now=Date.now()){
 const data=await readResults(year,store),recent=data?.items.some(r=>r.meeting.sessions.some(s=>Number.isFinite(s.start)&&now>=s.start&&now-s.start<8*3600000));
 return{season:year,revision:data?.revision??null,checkedAt:data?.checkedAt??null,pollAfterMs:recent?15000:60000};
}
