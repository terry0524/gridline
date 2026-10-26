import fs from 'node:fs/promises';
import path from 'node:path';
import {VerificationScheduler} from '../src/live/verification-scheduler.js';
import {verificationPlan,planDigest} from '../src/live/verification-plan.js';
import {runVerification} from '../scripts/verify-live-session.js';

export async function startScheduledVerification({base,secret,workerId}){
 const dir=path.join(process.env.GRIDLINE_CACHE_DIR||'/tmp/gridline-worker-cache','verification');await fs.mkdir(dir,{recursive:true});const file=path.join(dir,verificationPlan.id+'.json');let saved=null;
 try{const r=await fetch(new URL('/api/live/verification',base),{signal:AbortSignal.timeout(10000)});if(r.ok)saved=(await r.json()).snapshot;}catch{}
 if(!saved)try{saved=JSON.parse(await fs.readFile(file));}catch{}
 const scheduler=new VerificationScheduler({plan:verificationPlan,workerId,saved,run:(expected,options)=>runVerification({expected,...options,output:dir,setExitCode:false,durationMs:verificationPlan.observationMs})});
 let publishing=false,lastPublished=0,lastRevision=-1,lastError=0,closed=false;
 async function publish(){
  if(closed||publishing||Date.now()-lastPublished<60000&&lastRevision===scheduler.revision)return;
  publishing=true;const snapshot=scheduler.snapshot();
  try{
   const temp=file+'.tmp';await fs.writeFile(temp,JSON.stringify(snapshot));await fs.rename(temp,file);
   const r=await fetch(new URL('/api/internal/verification-ingest',base),{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+secret},body:JSON.stringify(snapshot),signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error('Verification checkpoint HTTP '+r.status);await r.arrayBuffer();lastPublished=Date.now();lastRevision=snapshot.revision;
  }catch(error){if(Date.now()-lastError>60000){console.error(error.message);lastError=Date.now();}}
  finally{publishing=false;}
 }
 const tick=()=>{scheduler.tick();publish().catch(()=>{});if(Object.values(scheduler.tasks).every(t=>['COMPLETE','MISSED'].includes(t.status))&&lastRevision===scheduler.revision)clearInterval(timer);};const timer=setInterval(tick,1000);tick();
 console.log(JSON.stringify({event:'verification-clock-ready',planId:verificationPlan.id,planDigest,bootedAt:scheduler.bootedAt,next:verificationPlan.sessions[0].start,drillScheduledAt:scheduler.tasks.drill.scheduledAt}));
 return{scheduler,async close(){clearInterval(timer);await scheduler.close();await publish();closed=true;}};
}
