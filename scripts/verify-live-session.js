import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const USGP_SESSIONS=[
 {id:'fp1',type:'Practice 1',start:'2026-10-23T17:30:00Z',end:'2026-10-23T18:30:00Z'},
 {id:'fp2',type:'Practice 2',start:'2026-10-23T21:00:00Z',end:'2026-10-23T22:00:00Z'},
 {id:'fp3',type:'Practice 3',start:'2026-10-24T17:30:00Z',end:'2026-10-24T18:30:00Z'},
 {id:'qualifying',type:'Qualifying',start:'2026-10-24T21:00:00Z',end:'2026-10-24T22:00:00Z'},
 {id:'race',type:'Race',start:'2026-10-25T20:00:00Z',end:'2026-10-25T22:00:00Z'}
];
export function selectSession(id='auto',now=Date.now()){
 if(id==='smoke')return{id:'smoke',type:'Practice 1',start:new Date(now).toISOString(),end:new Date(now+30000).toISOString()};
 if(id!=='auto')return USGP_SESSIONS.find(s=>s.id===id)??null;
 return USGP_SESSIONS.find(s=>now>=Date.parse(s.start)-10*60000&&now<Date.parse(s.end)-15*60000)??null;
}
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const text=v=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,'').slice(0,120):null;
const capabilities=['timing','intervals','tires','pit','weather','raceControl','radioMetadata','position','telemetry'];
export function newObservation(expected){return{expected,frames:0,matchingFrames:0,freshFrames:0,sourceAdvances:0,timingChanges:0,maxDrivers:0,firstSourceAt:null,lastSourceAt:null,longestFreshRunMs:0,runStart:null,lastFreshAt:null,lastSession:null,lastSignature:null,observedSessions:new Map(),capabilities:Object.fromEntries(capabilities.map(k=>[k,false])),channelFreshness:{},lastSampleAt:0};}
export function observeState(o,s,at=Date.now()){
 if(!s||!Array.isArray(s.drivers)||s.drivers.length>30)return null;
 o.frames++;const session=s.session??{};const identity=[session.year,session.name,session.type,session.key].join('|');
 o.observedSessions.set(identity,{year:session.year,name:text(session.name),type:text(session.type),key:session.key??null});
 const matches=s.mode==='live'&&session.year===2026&&/United States/i.test(session.name??'')&&session.type===o.expected.type&&finite(session.start)&&Math.abs(session.start-Date.parse(o.expected.start))<3*3600000;
 const sourceAt=s.health?.channels?.TimingData?.sourceTimestamp??s.health?.sourceTimestamp;
 const fresh=matches&&s.active===true&&s.health?.sessionAvailability==='LIVE SESSION AVAILABLE'&&finite(sourceAt)&&at-sourceAt>=-5000&&at-sourceAt<=15000&&['CONNECTED','DELAYED'].includes(s.health?.status);
 if(!fresh){o.runStart=null;return null;}
 o.matchingFrames++;o.freshFrames++;o.maxDrivers=Math.max(o.maxDrivers,s.drivers.length);
 if(o.lastFreshAt===null||at-o.lastFreshAt>30000||o.lastSession!==session.key)o.runStart=at;
 o.runStart??=at;o.lastFreshAt=at;o.lastSession=session.key;o.longestFreshRunMs=Math.max(o.longestFreshRunMs,at-o.runStart);
 if(o.lastSourceAt===null||sourceAt>o.lastSourceAt){o.sourceAdvances++;o.firstSourceAt??=sourceAt;o.lastSourceAt=sourceAt;}
 const signature=JSON.stringify(s.drivers.map(d=>[d.number,d.position,d.gap,d.interval,d.currentLap,d.lastLap,d.bestLap,d.compound,d.tyreAge,d.pitStops]));
 if(o.lastSignature!==null&&signature!==o.lastSignature)o.timingChanges++;o.lastSignature=signature;
 const has={
  timing:s.drivers.some(d=>finite(d.position)),intervals:s.drivers.some(d=>d.gap!=null||d.interval!=null),tires:s.drivers.some(d=>d.compound!=null),pit:s.drivers.some(d=>finite(d.pitStops)||typeof d.pitIn==='boolean'),
  weather:s.weather&&['air','track','humidity','pressure','windSpeed','rainfall'].some(k=>finite(s.weather[k])),raceControl:Array.isArray(s.control)&&s.control.length>0,
  radioMetadata:s.drivers.some(d=>d.radio?.some(r=>finite(r.at)&&r.at>=Date.parse(o.expected.start))),
  position:s.drivers.some(d=>d.positionQuality==='exact'&&finite(d.location?.x)&&finite(d.location?.y)&&finite(d.location?.at)&&Math.abs(at-d.location.at)<10000),
  telemetry:s.drivers.some(d=>finite(d.telemetry?.at)&&Math.abs(at-d.telemetry.at)<10000&&['speed','rpm','gear','throttle','brake','drs'].some(k=>finite(d.telemetry[k])))
 };
 for(const k of capabilities)o.capabilities[k]||=!!has[k];
 for(const [k,v]of Object.entries(s.health?.channels??{}))o.channelFreshness[k]={sourceTimestamp:v.sourceTimestamp??null,ageMs:v.ageMs??null,state:v.state??null};
 if(at-o.lastSampleAt<5000)return null;o.lastSampleAt=at;
 // Deliberately allowlist evidence fields: no raw frames, transport headers,
 // cookies, audio URLs, radio references or provider credentials are recorded.
 return{receivedAt:at,sourceTimestamp:sourceAt,session:{key:session.key,year:session.year,name:text(session.name),type:text(session.type)},health:{status:s.health.status,dataAgeMs:at-sourceAt},trackStatus:text(s.trackStatus),lap:session.currentLap??null,capabilities:has,
  fastestLap:s.fastestLap?{driver:text(s.fastestLap.driver??s.fastestLap.abbreviation),number:s.fastestLap.number??null,seconds:s.fastestLap.seconds??null,lap:s.fastestLap.lap??null}:null,
  weather:s.weather?Object.fromEntries(['at','air','track','humidity','pressure','rainfall','windSpeed','windDirection'].map(k=>[k,finite(s.weather[k])?s.weather[k]:null])):null,
  controlEvents:Array.isArray(s.control)?s.control.length:0,
  drivers:s.drivers.map(d=>({number:d.number,abbreviation:text(d.abbreviation),position:d.position??null,gap:d.gap??null,interval:d.interval??null,lap:d.currentLap??null,lastLap:d.lastLap??null,bestLap:d.bestLap??null,tire:text(d.compound),tireAge:d.tyreAge??null,pitStops:d.pitStops??null,pitStatus:text(d.pitStatus),positionQuality:text(d.positionQuality),radioMetadataCount:d.radio?.length??0}))};
}
export function assessment(o,{smoke=false}={}){
 const verified=!smoke&&o.longestFreshRunMs>=600000&&o.sourceAdvances>=30&&o.timingChanges>=3&&o.capabilities.timing;
 return{result:smoke?'TRANSPORT_SMOKE_ONLY':verified?'LIVE_TIMING_VERIFIED':'NOT_VERIFIED',expected:o.expected,normalizedFrames:o.frames,matchingFreshFrames:o.freshFrames,sourceAdvances:o.sourceAdvances,timingChanges:o.timingChanges,longestFreshRunMs:o.longestFreshRunMs,sourceSpanMs:o.lastSourceAt===null?0:o.lastSourceAt-o.firstSourceAt,maxDrivers:o.maxDrivers,observedSessions:[...o.observedSessions.values()],capabilities:o.capabilities,lastChannelFreshness:o.channelFreshness,
  scope:'Deployed normalized SSE, not raw SignalR channel counts, TV comparison, browser QA, audio access, or GPS precision. False capability means not observed in this observation window.'};
}
export class SSEFrames{
 constructor(){this.buffer='';this.decoder=new TextDecoder();}
 push(bytes){this.buffer=(this.buffer+this.decoder.decode(bytes,{stream:true})).replace(/\r\n/g,'\n');if(this.buffer.length>1024*1024)throw Error('Oversized SSE frame');const out=[];let i;while((i=this.buffer.indexOf('\n\n'))>=0){const frame=this.buffer.slice(0,i);this.buffer=this.buffer.slice(i+2);if(!frame.split('\n').some(l=>l==='event: race-state'))continue;const payload=frame.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');out.push(JSON.parse(payload));}return out;}
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function runVerification({id=process.env.OBSERVE_SESSION??'auto',output='.cache/usgp-live'}={}){
 const expected=selectSession(id);if(!expected){console.log('Outside the 2026 US GP verification windows; no source requested.');return null;}
 const now=Date.now(),start=Date.parse(expected.start),end=Date.parse(expected.end),smoke=id==='smoke';
 if(!smoke&&(now<start-10*60000||now>=end-10*60000))throw Error('Requested session is outside its observation window');
 if(!smoke){const begin=start+120000;while(Date.now()<begin)await sleep(Math.min(30000,begin-Date.now()));}
 await fs.mkdir(output,{recursive:true});const prefix=path.join(output,expected.id+'-'+new Date().toISOString().replace(/[:.]/g,'-'));
 const samples=await fs.open(prefix+'.ndjson','wx'),o=newObservation(expected),began=Date.now(),deadline=smoke?began+20000:Math.min(began+900000,end);
 const transport={attempts:0,connections:0,cleanEnds:0,errors:0,invalidFrames:0,startHttp:null};const base='https://gridline-indol.vercel.app';
 try{
  try{const r=await fetch(base+'/api/live/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'live'}),signal:AbortSignal.timeout(20000)});transport.startHttp=r.status;await r.arrayBuffer();}catch{transport.errors++;}
  let retryDelay=1000;
  while(Date.now()<deadline){
   const controller=new AbortController(),finish=setTimeout(()=>controller.abort(),deadline-Date.now());let lastBytes=Date.now();
   const stall=setInterval(()=>{if(Date.now()-lastBytes>30000)controller.abort();},5000);
   try{
    transport.attempts++;const r=await fetch(base+'/api/live/events',{signal:controller.signal});if(!r.ok||!r.headers.get('content-type')?.startsWith('text/event-stream')){await r.body?.cancel();throw Error('SSE unavailable');}transport.connections++;retryDelay=1000;
    const frames=new SSEFrames();for await(const chunk of r.body){lastBytes=Date.now();let packets;try{packets=frames.push(chunk);}catch{transport.invalidFrames++;throw Error('Malformed SSE');}
     for(const packet of packets){const sample=observeState(o,packet.state);if(sample)await samples.write(JSON.stringify(sample)+'\n');}
    }transport.cleanEnds++;
   }catch{if(Date.now()<deadline-1000){transport.errors++;retryDelay=Math.min(15000,retryDelay*2);}}
   finally{clearTimeout(finish);clearInterval(stall);controller.abort();}
   if(Date.now()<deadline)await sleep(Math.min(retryDelay,deadline-Date.now()));
  }
 }finally{await samples.close();}
 const result={checkedAt:new Date().toISOString(),startedAt:new Date(began).toISOString(),durationMs:Date.now()-began,...assessment(o,{smoke}),transport};
 if(smoke&&(transport.connections===0||transport.startHttp!==200))result.result='TRANSPORT_FAILED';
 if(!smoke&&transport.startHttp!==200)result.result='NOT_VERIFIED';
 await fs.writeFile(prefix+'.json',JSON.stringify(result,null,2)+'\n');
 const markdown=`# 2026 US GP · ${expected.type}\n\nResult: **${result.result}**\n\n- Duration: ${(result.durationMs/60000).toFixed(1)} min\n- Fresh continuous run: ${(result.longestFreshRunMs/60000).toFixed(1)} min\n- Original source timestamp advances: ${result.sourceAdvances}\n- Timing value changes: ${result.timingChanges}\n- Normalized SSE frames: ${result.normalizedFrames} (not raw channel messages)\n- Drivers: ${result.maxDrivers}\n- SSE connections / clean ends / errors: ${transport.connections} / ${transport.cleanEnds} / ${transport.errors}\n\n| Capability | Actual payload observed during fresh matching session |\n| --- | --- |\n${Object.entries(result.capabilities).map(([k,v])=>`| ${k} | ${v?'YES':'NOT OBSERVED'} |`).join('\n')}\n\n${result.scope}\n\nNo raw frames, credentials or radio audio are saved. A smoke test never verifies active Live.\n`;
 await fs.writeFile(prefix+'.md',markdown);if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,markdown);
 console.log(JSON.stringify({result:result.result,frames:result.normalizedFrames,freshMinutes:result.longestFreshRunMs/60000,report:prefix+'.json'}));
 if(smoke?result.result==='TRANSPORT_FAILED':result.result!=='LIVE_TIMING_VERIFIED')process.exitCode=2;return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await runVerification();
