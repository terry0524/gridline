import {SignalRCollector} from './collector.js';
import {LiveDataPipeline} from './pipeline.js';
import {CaptureJournal} from '../capture/journal.js';
import {CaptureReplaySource} from '../capture/replay.js';
import {ReplayStreamSource} from './simulation.js';
import {getData,historicalTTL} from '../provider.js';
export class RaceStreamService{
 constructor(){this.mode=null;this.clients=new Set();this.sequence=0;this.generation=0;this.state=null;this.metadata=null;this.source=null;this.adapter=null;this.collector=null;this.timer=null;this.startQueue=Promise.resolve();this.frames=0;this.pipeline=null;this.capture=null;}
 async start(mode,key){const next=this.startQueue.catch(()=>{}).then(()=>this.startSource(mode,key));this.startQueue=next;return next;}
 async startSource(mode,key){
  if(!['live','simulated-live','capture-replay'].includes(mode))throw Error('Invalid stream mode');
  if(this.mode===mode&&(mode==='live'||this.source?.dataset?.session.key===key||mode==='capture-replay'&&this.source?.id===key)){this.publish();return this.info();}
  if(this.capture?.info().recording&&mode!=='live')throw Error('Stop capture before changing the shared stream source');
  // Prepare data before replacing an existing good source.
  const prepared=mode==='simulated-live'?await ReplayStreamSource.load(key):mode==='capture-replay'?await CaptureReplaySource.load(key):null;
  this.stopSource();this.mode=mode;this.generation++;this.frames=0;this.state=null;this.metadata=null;
  if(mode!=='live'){this.source=prepared;this.metadata={...prepared.metadata(),generation:this.generation};this.broadcast('metadata',this.metadata);}
  else{
   this.pipeline=new LiveDataPipeline({onEvent:event=>{this.capture?.normalized(event);if(event.state?.health.sessionAvailability==='LIVE SESSION AVAILABLE')this.capture?.activeSession(event.receivedAt);},onWarning:event=>this.capture?.warning(event),onPayload:(topic,data,at,context)=>this.capture?.diagnostics.observe(topic,data,at,context),onChannelOutcome:(topic,status,at)=>{if(status==='EMPTY')this.capture?.diagnostics.emptySubscription(topic,at);}});this.adapter=this.pipeline.adapter;
   this.metadata={mode:'live',session:this.adapter.toRaceState().session,track:null,drivers:[],source:'F1 SignalR Core · waiting',generation:this.generation};this.broadcast('metadata',this.metadata);
   this.collector=new SignalRCollector({onRaw:(raw,at)=>this.capture?.raw(raw,at),onUnknown:event=>this.pipeline.warning(event),onChannelError:(topic,reason,at)=>{this.pipeline.diagnostics.error(topic,reason,at);this.capture?.diagnostics.error(topic,reason,at);this.capture?.warning({channel:topic,reason,receivedAt:at});},onSnapshot:(snapshot,at,context)=>{if(context?.partial)this.pipeline.partialSnapshot(snapshot,at);else{this.pipeline.snapshot(snapshot,at);this.refreshMetadata();}this.publish();},onFeed:(topic,data,utc,at)=>{const key=this.adapter.sessionKey;this.pipeline.feed(topic,data,utc,at);if(this.adapter.sessionKey!==key||topic==='DriverList'||topic==='SessionInfo')this.refreshMetadata();},onStatus:info=>{this.pipeline.transport(info);this.publish();}});this.collector.start();
  }
  this.publish();this.timer=setInterval(()=>this.publish(),250);return this.info();
 }
 stopSource(){clearInterval(this.timer);this.timer=null;this.collector?.stop();this.collector=null;this.adapter=null;this.pipeline=null;this.source=null;}
 async refreshMetadata(){
  const adapter=this.adapter;if(!adapter)return;const s=adapter.toRaceState();const generation=this.generation,key=s.session.key;
  this.metadata={mode:'live',session:s.session,track:null,drivers:s.drivers.map(({number,abbreviation,name,team,color})=>({number,abbreviation,name,team,color})),source:s.source,generation};this.broadcast('metadata',this.metadata);
  if(s.session.circuitKey===null||s.session.year===null)return;
  try{const env=await getData('circuit',`${s.session.circuitKey}/${s.session.year}`,{},historicalTTL);if(generation!==this.generation||this.adapter!==adapter||key!==adapter.sessionKey)return;const c=env.data;if(!Array.isArray(c.x)||c.x.length<10||c.x.length!==c.y?.length)return;
   const track={points:c.x.map((x,i)=>[x,c.y[i]]).filter(p=>p.every(Number.isFinite)),rotation:Number.isFinite(c.rotation)?c.rotation:0,corners:(c.corners||[]).map(p=>({number:p.number,x:p.trackPosition?.x,y:p.trackPosition?.y})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),cornerSource:'MultiViewer metadata',sector1:null,sector2:null,drsZones:[],driver:null,lap:null,miniSectorsIndexes:c.miniSectorsIndexes||[]};this.adapter.track=track;this.metadata={...this.metadata,track};this.broadcast('metadata',this.metadata);
  }catch{ /* Real timing remains available when circuit geometry is unavailable. */ }
 }
 publish(){
  if(this.mode!=='live'&&this.source)this.state=this.source.state();
  else if(this.mode==='live'&&this.pipeline){this.state=this.pipeline.state();this.state.transport=this.collector?.info();this.state.reason=this.state.health.sessionAvailability==='LIVE SESSION AVAILABLE'?null:this.state.health.sessionAvailability==='NO ACTIVE SESSION'?'No active session; retained snapshot':'Session not confirmed by fresh TimingData';}
  if(this.mode==='capture-replay'&&this.source){const key=this.state?.session.key;const driverIds=this.state?.drivers.map(d=>d.number).join(',');if(key!==this.metadata?.session.key||driverIds!==this.metadata?.drivers.map(d=>d.number).join(',')){this.metadata={...this.source.metadata(),session:this.state.session,drivers:this.state.drivers.map(({number,abbreviation,name,team,color})=>({number,abbreviation,name,team,color})),generation:this.generation};this.broadcast('metadata',this.metadata);}}
  if(!this.state)return;this.frames++;this.broadcast('race-state',{state:this.state,generation:this.generation,receivedAt:Date.now(),sequence:this.sequence+1});
 }
 broadcast(event,data){const id=++this.sequence;const wire=`id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;for(const client of this.clients){if(client.destroyed||client.writableLength>1024*1024){client.end();this.clients.delete(client);continue;}client.write(wire);}}
 subscribe(req,res){if(this.clients.size>=30){res.writeHead(503);res.end('Client limit reached');return;}res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform','connection':'keep-alive','x-accel-buffering':'no','x-content-type-options':'nosniff'});res.write('retry: 1000\n\n');this.clients.add(res);if(this.metadata)res.write(`id: ${this.sequence}\nevent: metadata\ndata: ${JSON.stringify(this.metadata)}\n\n`);if(this.state)res.write(`id: ${this.sequence}\nevent: race-state\ndata: ${JSON.stringify({state:this.state,generation:this.generation,receivedAt:Date.now(),sequence:this.sequence})}\n\n`);const ping=setInterval(()=>res.write(': keepalive\n\n'),10000);res.on('close',()=>{clearInterval(ping);this.clients.delete(res);});}
 control(action,value){if(action==='interrupt'){for(const client of this.clients)client.end();this.clients.clear();return this.info();}if(!['simulated-live','capture-replay'].includes(this.mode)||!this.source)throw Error('Replay controls only apply to simulated live');this.source.control(action,value);this.publish();return this.info();}
 info(){return {mode:this.mode,generation:this.generation,clients:this.clients.size,frames:this.frames,connection:this.state?.connection||'OFFLINE',session:this.state?.session||null,sourceInstances:this.mode?1:0,upstreamConnections:this.collector?.activeConnections||0,collector:this.collector?.info()||null,simulation:this.state?.simulation||null,capabilities:this.state?.capabilities||{},health:this.state?.health??null,capture:this.capture?.info()??null,channels:this.pipeline?.diagnostics.channels??{},requiresPaidService:false};}
 async startCapture(){if(this.capture?.info().recording)return this.capture.info();if(this.mode!=='live')await this.start('live');this.capture=await CaptureJournal.start({pipeline:this.pipeline,session:this.state?.session});return this.capture.info();}
 async stopCapture(){return this.capture?await this.capture.stop():null;}
 setEstimated(enabled){if(this.pipeline)this.pipeline.allowEstimated=enabled;if(this.source?.pipeline){this.source.allowEstimated=enabled;this.source.pipeline.allowEstimated=enabled;}this.publish();return this.info();}
 close(){this.stopSource();for(const client of this.clients)client.end();this.clients.clear();}
}
