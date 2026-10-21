import {FrameDecoder,FREE_TOPICS,RESTRICTED_TOPICS,encodeFrame} from './protocol.js';
import {hubEvent} from './hub-events.js';
// Anonymous Core endpoint only. No F1TV tokens, login, legacy endpoint fallback, proxy rotation or TLS bypass.
export class SignalRCollector{
 constructor({onSnapshot=()=>{},onFeed=()=>{},onStatus=()=>{},onRaw=()=>{},onUnknown=()=>{},onChannelError=()=>{},optionalTopics=true}={}){Object.assign(this,{onSnapshot,onFeed,onStatus,onRaw,onUnknown,onChannelError,optionalTopics});this.running=false;this.socket=null;this.attempts=0;this.activeConnections=0;this.generation=0;this.phase='OFFLINE';this.lastMessageAt=null;this.receivedTopics=new Set();this.retryDelay=1000;}
 status(phase,reason=null){this.phase=phase;this.reason=reason;this.onStatus(this.info());}
 info(){return {phase:this.phase,reason:this.reason,activeConnections:this.activeConnections,attempts:this.attempts,lastMessageAt:this.lastMessageAt,topics:[...this.receivedTopics],credentials:'none',restrictedTopicsRequested:this.optionalTopics};}
 start(){if(this.running)return;this.running=true;this.generation++;this.connect(this.generation);}
 stop(){this.running=false;this.generation++;clearTimeout(this.retryTimer);clearTimeout(this.timeout);clearInterval(this.ping);this.abort?.abort();const closing=this.socket;this.socket=null;closing?.close();this.activeConnections=0;this.status('OFFLINE','Collector stopped');}
 schedule(generation,reason){if(!this.running||generation!==this.generation)return;clearTimeout(this.timeout);clearInterval(this.ping);const closing=this.socket;this.socket=null;closing?.close();this.activeConnections=0;this.status('RECONNECTING',reason);clearTimeout(this.retryTimer);this.retryTimer=setTimeout(()=>this.connect(generation),this.retryDelay);this.retryDelay=Math.min(60000,this.retryDelay*2);}
 async connect(generation){
  if(!this.running||generation!==this.generation)return;this.status('RECONNECTING','Anonymous SignalR Core handshake');this.attempts++;this.abort=new AbortController();
  try{
   if(typeof WebSocket!=='function')throw Error('Node.js 22+ is required for native WebSocket');
   const signal=AbortSignal.any([this.abort.signal,AbortSignal.timeout(15000)]);const cookies=new Map();
   const remember=res=>{for(const value of res.headers.getSetCookie()){const part=value.split(';')[0],i=part.indexOf('=');if(['AWSALB','AWSALBCORS'].includes(part.slice(0,i)))cookies.set(part.slice(0,i),part.slice(i+1));}};
   const affinity=()=>[...cookies].map(([k,v])=>k+'='+v).join('; ');
   // Load-balancer affinity only; OPTIONS may return 405 while issuing an anonymous affinity cookie.
   const options=await fetch('https://livetiming.formula1.com/signalrcore/negotiate',{method:'OPTIONS',signal});remember(options);await options.arrayBuffer();
   const res=await fetch('https://livetiming.formula1.com/signalrcore/negotiate?negotiateVersion=1',{method:'POST',headers:affinity()?{Cookie:affinity()}:{},signal});remember(res);
   if(!res.ok)throw Error(`Anonymous negotiate HTTP ${res.status}`);
   const n=await res.json();if(typeof n.connectionToken!=='string'||!n.availableTransports?.some(t=>t.transport==='WebSockets'))throw Error('Anonymous WebSocket transport unavailable');
   if(!this.running||generation!==this.generation)return;
   // The anonymous transport token is transient, held in memory, never logged or sent to clients.
   const ws=new WebSocket('wss://livetiming.formula1.com/signalrcore?id='+encodeURIComponent(n.connectionToken),{headers:affinity()?{Cookie:affinity()}:{}});this.socket=ws;this.activeConnections=1;
   const decoder=new FrameDecoder({onUnknown:event=>this.onUnknown({...event,receivedAt:this.lastMessageAt})});let handshake=false,ready=false;const early=[];
   this.timeout=setTimeout(()=>this.schedule(generation,'Handshake timeout'),15000);
   ws.addEventListener('open',()=>{if(ws!==this.socket)return;ws.send(encodeFrame({protocol:'json',version:1}));});
   ws.addEventListener('message',event=>{
    if(ws!==this.socket||!this.running)return;this.lastMessageAt=Date.now();
    const raw=String(event.data);this.onRaw(raw,this.lastMessageAt);
    try{for(const frame of decoder.push(raw)){
     const message=hubEvent(frame);
     if(message.kind==='handshake'&&!handshake){handshake=true;ws.send(encodeFrame({type:1,invocationId:'1',target:'Subscribe',arguments:[FREE_TOPICS]}));this.ping=setInterval(()=>{if(ws.readyState===1)ws.send(encodeFrame({type:6}));if(Date.now()-(this.lastMessageAt||0)>45000)this.schedule(generation,'Source transport timed out');},10000);}
     else if(message.kind==='snapshot'){
      for(const topic of Object.keys(message.data))this.receivedTopics.add(topic);
      if(message.partial){this.onSnapshot(message.data,this.lastMessageAt,{partial:true});}
      else{ready=true;clearTimeout(this.timeout);this.retryDelay=1000;this.onSnapshot(message.data,this.lastMessageAt,{partial:false});if(this.optionalTopics)ws.send(encodeFrame({type:1,invocationId:'2',target:'Subscribe',arguments:[RESTRICTED_TOPICS]}));for(const args of early)this.onFeed(...args);this.status('CONNECTED','Anonymous timing subscribed; optional payload availability is measured at runtime');}
     }else if(message.kind==='feed'){
      this.receivedTopics.add(message.topic);const args=[message.topic,message.data,message.utc,this.lastMessageAt];if(!ready){if(early.length<1000)early.push(args);}else this.onFeed(...args);
     }else if(message.kind==='error'){if(message.optional){for(const topic of RESTRICTED_TOPICS)this.onChannelError(topic,message.reason,this.lastMessageAt);}else this.schedule(generation,'Source rejected public subscription');}
     else if(message.kind==='close')this.schedule(generation,message.reason);
     else if(message.kind==='unknown')this.onUnknown({...message,frame,receivedAt:this.lastMessageAt});
    }}catch{this.onUnknown({reason:'Frame processing limit or unexpected schema',channel:null,receivedAt:this.lastMessageAt});}
   });
   ws.addEventListener('error',()=>{if(ws===this.socket)this.schedule(generation,'WebSocket connection unavailable');});
   ws.addEventListener('close',()=>{if(ws===this.socket)this.schedule(generation,'WebSocket connection closed');});
  }catch(err){if(generation===this.generation&&this.running)this.schedule(generation,err.name==='AbortError'?'Connection cancelled':err.message?.startsWith('Anonymous negotiate HTTP')?err.message:'Anonymous source unavailable');}
 }
}
