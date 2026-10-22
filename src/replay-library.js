import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export const libraryBase='https://github.com/terry0524/gridline/releases/download/replay-library-v1/';
let lastGood=null,lastAttempt=0,pending=null;
export function validateLibrary(value){
 if(value?.version!==1||value.schemaVersion!==4||!Array.isArray(value.replays)||value.replays.length>512)throw Error('Invalid replay library');
 const seen=new Set();
 const replays=value.replays.map(r=>{
  if(!Number.isSafeInteger(r.sessionKey)||r.sessionKey<=0||seen.has(r.sessionKey)||!Number.isInteger(r.season)||r.season<2023||r.season>new Date().getFullYear()||r.cacheVersion!==4||!['VALID','PARTIAL'].includes(r.validation)||!Number.isInteger(r.bytes)||r.bytes<1||r.bytes>32*1024*1024||!/^[a-f0-9]{64}$/.test(r.sha256)||!Number.isFinite(Date.parse(r.date))||typeof r.grandPrix!=='string'||typeof r.slug!=='string'||!/^[a-z0-9-]+$/.test(r.slug))throw Error('Invalid replay library record');
  seen.add(r.sessionKey);return{...r,remote:true,asset:`${r.season}-${r.sessionKey}-v4.json.gz`};
 });return{...value,replays};
}
export async function remoteLibrary(){
 if(process.env.GRIDLINE_REPLAY_LIBRARY!=='1')return null;
 if(Date.now()-lastAttempt<60000)return pending??lastGood;
 lastAttempt=Date.now();
 pending=(async()=>{
  // Release index replacement is not atomic. Avoid a cached redirect to a deleted
  // asset and retry the short replacement window before keeping the last index.
  for(let attempt=0;attempt<3;attempt++){
   try{const r=await fetch(libraryBase+'library-v1.json?revision='+Date.now()+'-'+attempt,{signal:AbortSignal.timeout(10000),headers:{accept:'application/json'}});if(!r.ok)throw Error('Library HTTP '+r.status);const b=Buffer.from(await r.arrayBuffer());if(b.length>2*1024*1024)throw Error('Library too large');lastGood=validateLibrary(JSON.parse(b));break;}
   catch{if(attempt<2)await new Promise(r=>setTimeout(r,300*(attempt+1)));}
  }
  return lastGood;
 })().finally(()=>{pending=null;});return pending;
}
const downloads=new Map();
export async function cacheLibraryReplay(record,file){
 if(!record.remote)return;
 if(downloads.has(record.sessionKey))return downloads.get(record.sessionKey);
 const promise=(async()=>{
  try{const b=await fs.readFile(file);if(b.length===record.bytes&&createHash('sha256').update(b).digest('hex')===record.sha256)return;}catch{}
  const r=await fetch(libraryBase+record.asset,{signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error('Replay download unavailable');
  let size=0;const chunks=[];for await(const b of r.body){size+=b.length;if(size>record.bytes)throw Error('Oversized replay download');chunks.push(b);}
  const bytes=Buffer.concat(chunks);if(bytes.length!==record.bytes||createHash('sha256').update(bytes).digest('hex')!==record.sha256)throw Error('Replay download integrity failure');
  await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';await fs.writeFile(tmp,bytes);await fs.rename(tmp,file);
 })();downloads.set(record.sessionKey,promise);try{return await promise;}finally{downloads.delete(record.sessionKey);}
}
