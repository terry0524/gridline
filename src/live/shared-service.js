import {getCache} from '@vercel/functions';
import {timingSafeEqual} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
export const LIVE_CACHE_KEY='latest';
export function relayAuthorized(value,secret){const a=Buffer.from(value??''),b=Buffer.from(secret?'Bearer '+secret:'');return b.length>7&&a.length===b.length&&timingSafeEqual(a,b);}
export function validateRelayPacket(p,now=Date.now()){
 if(p?.version!==1||p.state?.mode!=='live'||typeof p.workerId!=='string'||!Number.isFinite(p.publishedAt)||Math.abs(now-p.publishedAt)>60000||!p.metadata?.session||!Array.isArray(p.state.drivers)||p.state.drivers.length>30||!p.state.health||!p.state.capabilities)throw Error('Invalid live relay packet');
 return p;
}
export function relayCache(){return getCache({namespace:'gridline-live-v1'});}
export function decodeRelayCache(value){return value?.encoding==='gzip'?JSON.parse(gunzipSync(Buffer.from(value.data,'base64'),{maxOutputLength:1024*1024})):value;}
export async function ingestRelay(req,cache=relayCache()){
 const chunks=[];let size=0;for await(const b of req){size+=Buffer.byteLength(b);if(size>1024*1024)throw Error('Relay packet too large');chunks.push(Buffer.from(b));}
 const packet=validateRelayPacket(JSON.parse(Buffer.concat(chunks).toString('utf8')));
 // Metadata/track and control history compress well; keep shared-cache usage bounded.
 await cache.set(LIVE_CACHE_KEY,{version:1,encoding:'gzip',data:gzipSync(JSON.stringify(packet)).toString('base64')},{ttl:240});return{accepted:true,publishedAt:packet.publishedAt};
}
export class SharedLiveService{
 constructor({cache=relayCache(),intervalMs=1000,leaseMs=270000}={}){Object.assign(this,{cache,intervalMs,leaseMs});this.clients=new Set();this.sequence=0;this.mode=null;this.state=null;this.metadata=null;this.packet=null;this.timer=null;this.pending=null;this.closed=false;}
 async refresh(){
  if(this.pending)return this.pending;
  this.pending=(async()=>{try{const p=decodeRelayCache(await this.cache.get(LIVE_CACHE_KEY));if(p?.version===1&&p.state?.mode==='live')this.packet=p;}catch{}
   if(!this.packet)return;
   const p=this.packet,age=Date.now()-p.publishedAt,expired=age>(p.state.health.sessionAvailability==='NO ACTIVE SESSION'?180000:35000);
   this.mode='live';this.generation=p.workerId+':'+(p.metadata.generation??0);this.metadata={...p.metadata,generation:this.generation};
   this.state={...p.state,health:{...p.state.health},connection:expired?'RECONNECTING':p.state.connection};
   if(typeof this.state.health.dataAgeMs==='number')this.state.health.dataAgeMs+=Math.max(0,age);
   if(expired){this.state.health={...this.state.health,status:'RECONNECTING',sessionAvailability:'SESSION UNCONFIRMED'};this.state.active=false;this.state.reason='Collector heartbeat delayed; last data retained';}
   if(age>300000){this.state.health.status='OFFLINE';this.state.connection='OFFLINE';}
   return this.state;
  })().finally(()=>{this.pending=null;});return this.pending;
 }
 async start(mode){if(mode!=='live')throw Error('Developer modes are disabled');this.mode='live';await this.refresh();return this.info();}
 info(){return{mode:this.mode,connection:this.state?.health?.status??'RECONNECTING',health:this.state?.health??null,session:this.state?.session??null,capabilities:this.state?.capabilities??{},clients:this.clients.size,sourceInstances:this.packet?1:0,upstreamConnections:this.packet?.collector?.upstreamConnections??0,transport:'Single Vercel daemon → shared runtime cache → SSE',requiresPaidService:false};}
 broadcast(){if(!this.state||!this.metadata)return;const id=++this.sequence;for(const client of this.clients){if(client.res.destroyed||client.res.writableEnded||client.res.writableLength>1024*1024){client.res.end();continue;}if(client.generation!==this.generation){client.res.write(`event: metadata\ndata: ${JSON.stringify(this.metadata)}\n\n`);client.generation=this.generation;}client.res.write(`id: ${id}\nevent: race-state\ndata: ${JSON.stringify({state:this.state,generation:this.generation,receivedAt:Date.now(),sequence:id})}\n\n`);}}
 async tick(){await this.refresh();this.broadcast();}
 subscribe(req,res){
  if(this.clients.size>=30){res.writeHead(503);res.end('Client limit reached');return;}
  res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform','x-accel-buffering':'no','x-content-type-options':'nosniff'});res.write('retry: 1000\n\n');
  const client={res,generation:null};this.clients.add(client);this.closed=false;
  const ping=setInterval(()=>{if(!res.writableEnded)res.write(': keepalive\n\n');},10000);
  // End cleanly before the Function limit; EventSource reconnects and retains UI data.
  const lease=setTimeout(()=>res.end(),this.leaseMs);
  res.on('close',()=>{clearInterval(ping);clearTimeout(lease);this.clients.delete(client);if(!this.clients.size){clearInterval(this.timer);this.timer=null;}});
  if(!this.timer)this.timer=setInterval(()=>this.tick().catch(()=>{}),this.intervalMs);this.tick().catch(()=>{});
 }
 async stopCapture(){}close(){clearInterval(this.timer);this.timer=null;for(const c of this.clients)c.res.end();this.clients.clear();this.closed=true;}
}
