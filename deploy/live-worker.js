import {RaceStreamService} from '../src/live/service.js';
import {randomUUID} from 'node:crypto';
const base=new URL(process.env.GRIDLINE_PUBLIC_URL||'https://gridline-indol.vercel.app');
if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/')throw Error('Invalid relay origin');
const secret=process.env.GRIDLINE_LIVE_BRIDGE_SECRET;if(!secret)throw Error('Live relay credential is not configured');
const workerId=randomUUID(),service=new RaceStreamService();let stopped=false,lastPublished=0,lastFailure=0;
process.on('SIGTERM',()=>{stopped=true;service.close();});process.on('SIGINT',()=>{stopped=true;service.close();});
await service.start('live');console.log('GRIDLINE single live collector started; anonymous timing, no capture');
while(!stopped){
 // Keep the previous shared snapshot while a restarted collector is handshaking.
 if(service.state?.drivers.length&&service.metadata?.drivers.length&&Date.now()-lastPublished>=(service.state.active?1000:60000)){
  try{
   const packet={version:1,workerId,publishedAt:Date.now(),state:service.state,metadata:service.metadata,collector:{upstreamConnections:service.collector?.activeConnections??0}};
   const response=await fetch(new URL('/api/internal/live-ingest',base),{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+secret},body:JSON.stringify(packet),signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('Relay HTTP '+response.status);await response.arrayBuffer();lastPublished=Date.now();
  }catch(error){if(Date.now()-lastFailure>60000){console.error(error.message);lastFailure=Date.now();}await new Promise(r=>setTimeout(r,5000));}
 }
 await new Promise(r=>setTimeout(r,250));
}
service.close();
