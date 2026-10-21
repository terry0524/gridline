export const FRESHNESS_THRESHOLDS={TimingData:{delayedMs:5000,staleMs:15000},WeatherData:{delayedMs:120000,staleMs:300000},Position:{delayedMs:3000,staleMs:10000},CarData:{delayedMs:3000,staleMs:10000}};
export function healthAt(adapter,phase='OFFLINE',now=Date.now()){
 const channels={};for(const [topic,threshold]of Object.entries(FRESHNESS_THRESHOLDS)){const at=adapter.topicAt[topic]??null;const ageMs=at===null||at>now+5000?null:Math.max(0,now-at);channels[topic]={sourceTimestamp:at,ageMs,state:ageMs===null?'UNAVAILABLE':ageMs>threshold.staleMs?'STALE':ageMs>threshold.delayedMs?'DELAYED':'CONNECTED',...threshold};}
 const timing=channels.TimingData;const status=phase==='RECONNECTING'?'RECONNECTING':phase!=='CONNECTED'?'OFFLINE':timing.state==='UNAVAILABLE'?'STALE':timing.state;
 const ended=['Ends','Finished','Finalised','Aborted'].includes(adapter.raw.SessionStatus?.Status)||['Finished','Finalised'].includes(adapter.raw.SessionInfo?.SessionStatus);
 const sessionAvailability=ended?'NO ACTIVE SESSION':adapter.active&&['CONNECTED','DELAYED'].includes(status)?'LIVE SESSION AVAILABLE':'SESSION UNCONFIRMED';
 return {status,transport:phase,dataAgeMs:timing.ageMs,sourceTimestamp:timing.sourceTimestamp,channels,sessionAvailability};
}
