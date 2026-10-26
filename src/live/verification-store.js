import {getCache} from '@vercel/functions';
import {gzipSync,gunzipSync} from 'node:zlib';
import {verificationPlan,planDigest,scheduledSessions,koreanTime} from './verification-plan.js';
const key='plan:'+planDigest;
const cache=()=>getCache({namespace:'gridline-verification-v1'});
export function validateCheckpoint(p,now=Date.now()){
 if(p?.version!==1||p.planId!==verificationPlan.id||p.planDigest!==planDigest||!Number.isFinite(p.heartbeatAt)||Math.abs(now-p.heartbeatAt)>60000||!Number.isFinite(p.bootedAt)||p.bootedAt>now+5000||!/^[a-f\d-]{36}$/i.test(p.workerId)||!p.tasks||Array.isArray(p.tasks))throw Error('Invalid verification checkpoint');
 const expected=new Map(scheduledSessions().map(s=>[s.id,s]));
 for(const [id,t]of Object.entries(p.tasks)){
  if(id!=='drill'&&!expected.has(id)||!['SCHEDULED','RUNNING','COMPLETE','MISSED'].includes(t.status)||!Number.isFinite(t.scheduledAt)||id!=='drill'&&t.scheduledAt!==expected.get(id).scheduledAt)throw Error('Invalid verification task');
  if(id==='drill'&&t.result?.result==='LIVE_TIMING_VERIFIED')throw Error('Transport drill cannot verify Live');
 }
 function safe(value){if(!value||typeof value!=='object')return;for(const [k,v]of Object.entries(value)){if(/cookie|token|authorization|password|secret|rawframes|audio|reference|^url$/i.test(k))throw Error('Forbidden verification field');safe(v);}}
 safe(p);return p;
}
export async function ingestVerification(req,store=cache()){
 let size=0;const chunks=[];for await(const chunk of req){const bytes=Buffer.from(chunk);size+=bytes.length;if(size>1024*1024)throw Error('Verification checkpoint too large');chunks.push(bytes);}
 const p=validateCheckpoint(JSON.parse(Buffer.concat(chunks).toString('utf8')));
 let prior;try{const entry=await store.get(key);if(entry)prior=JSON.parse(gunzipSync(Buffer.from(entry.data,'base64'),{maxOutputLength:1024*1024}));}catch{}
 if(prior?.heartbeatAt>p.heartbeatAt)throw Error('Outdated verification checkpoint');
 // A rolling replacement must not erase a completed observation.
 for(const [id,t]of Object.entries(prior?.tasks??{}))if(id!=='drill'&&t.status==='COMPLETE'&&p.tasks[id]?.status!=='COMPLETE')p.tasks[id]=t;
 await store.set(key,{encoding:'gzip',data:gzipSync(JSON.stringify(p)).toString('base64')},{ttl:30*86400});
 return{accepted:true,planId:p.planId,heartbeatAt:p.heartbeatAt};
}
export async function verificationStatus(store=cache(),now=Date.now()){
 let snapshot=null;try{const entry=await store.get(key);if(entry)snapshot=JSON.parse(gunzipSync(Buffer.from(entry.data,'base64'),{maxOutputLength:1024*1024}));}catch{}
 const finished=snapshot&&verificationPlan.sessions.every(s=>['COMPLETE','MISSED'].includes(snapshot.tasks[s.id]?.status));
 return{plan:verificationPlan,planDigest,sessions:scheduledSessions().map(s=>({...s,startKST:koreanTime(s.start),observationKST:koreanTime(s.scheduledAt)})),snapshot,schedulerHealth:finished?'DONE':!snapshot?'UNCONFIRMED':now-snapshot.heartbeatAt>180000?'STALE':'READY',storage:'Ephemeral runtime cache plus resident disk; GitHub export backs up completed evidence. Cache eviction is not durable storage.'};
}
