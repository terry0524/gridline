import fs from 'node:fs/promises';
import path from 'node:path';
import {SignalRCollector} from '../src/live/collector.js';
import {F1StateAdapter} from '../src/live/f1-adapter.js';
import {cacheDir} from '../src/provider.js';
// Diagnostic is opt-in, real upstream, anonymous public topics only. Never prints transport tokens.
const dir=path.join(cacheDir,'research');await fs.mkdir(dir,{recursive:true});
let collector;let timer;const result=await new Promise((resolve,reject)=>{
 collector=new SignalRCollector({onSnapshot:async(snapshot,at,context)=>{if(context?.partial)return;try{const adapter=new F1StateAdapter();adapter.snapshot(snapshot,at);const s=adapter.toRaceState();const evidence={checkedAt:new Date(at).toISOString(),endpoint:'https://livetiming.formula1.com/signalrcore',credentials:'none',websocket:'opened',handshake:'accepted',returnedTopics:Object.keys(snapshot),session:s.session,activeSession:s.active,driverCount:s.drivers.length,positionAvailable:s.capabilities.position,telemetryAvailable:s.capabilities.telemetry,sourceTimestamp:s.timestamp,weather:s.weather,fastestLap:s.fastestLap,controlCount:s.control.length,radioCount:s.drivers.reduce((n,d)=>n+d.radio.length,0),restrictedTopicsRequested:false};await fs.writeFile(path.join(dir,'signalrcore-snapshot.json'),JSON.stringify(snapshot));await fs.writeFile(path.join(dir,'collector-probe.json'),JSON.stringify(evidence,null,2)+'\n');resolve(evidence);}catch(e){reject(e);}}});timer=setTimeout(()=>reject(Error('No real snapshot within 30 seconds')),30000);collector.start();
}).finally(()=>{clearTimeout(timer);collector?.stop();});
console.log(JSON.stringify(result,null,2));
