/** @typedef {import('./models').ReplayDataset} ReplayDataset */
/** @typedef {import('./models').RaceState} RaceState */
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const time=v=>{const t=Date.parse(v);return Number.isFinite(t)?t:null;};
const sort=(a,b)=>a.at-b.at;
export function indexAt(rows,t){let l=0,r=rows.length;while(l<r){const m=(l+r)>>>1;if(rows[m].at<=t)l=m+1;else r=m;}return l-1;}
export function lastAt(rows,t){return rows[indexAt(rows,t)]||null;}
export function locationAt(rows,t,maxGap=2000,holdLast=false){
 let l=0,r=rows.length;while(l<r){const m=(l+r)>>>1;if(rows[m][0]<=t)l=m+1;else r=m;}
 const a=rows[l-1],b=rows[l];if(!a)return null;if(t-a[0]>5000)return holdLast?{at:a[0],x:a[1],y:a[2],interpolated:false,stale:true}:null;
 if(!b||b[0]-a[0]>maxGap)return {at:a[0],x:a[1],y:a[2],interpolated:false};
 const u=(t-a[0])/(b[0]-a[0]);return {at:a[0],x:a[1]+(b[1]-a[1])*u,y:a[2]+(b[2]-a[2])*u,interpolated:u>0};
}
export function normalizeReplay(raw,provenance=[]){
 const {session,start,end}=raw;const invalid={};
 const rows=(ep,fn)=>{
  if(!Array.isArray(raw[ep]))return [];
  const out=[];for(const x of raw[ep]){if(!x||typeof x!=='object'||Array.isArray(x)){invalid[ep]=(invalid[ep]||0)+1;continue;}if(x.session_key!==session.session_key){invalid[ep]=(invalid[ep]||0)+1;continue;}const v=fn(x);if(v)out.push(v);else invalid[ep]=(invalid[ep]||0)+1;}return out;
 };
 const driverRows=rows('drivers',d=>number(d.driver_number)!==null?{number:d.driver_number,abbreviation:typeof d.name_acronym==='string'?d.name_acronym:String(d.driver_number),name:d.full_name||d.broadcast_name||String(d.driver_number),team:d.team_name||'—',color:/^[a-f\d]{6}$/i.test(d.team_colour||'')?'#'+d.team_colour:'#91a3b8'}:null);
 if(!driverRows.length)throw Error('No valid drivers');
 const byDriver=new Map(driverRows.map(d=>[d.number,{...d,locations:[],positions:[],intervals:[],laps:[],completedLaps:[],stints:[],pits:[],radio:[],telemetry:[]} ]));
 const add=(ep,field,fn)=>{for(const row of rows(ep,fn)){const d=byDriver.get(row.number);if(d)d[field].push(row);}};
 add('location','locations',x=>time(x.date)!==null&&number(x.x)!==null&&number(x.y)!==null&&number(x.driver_number)!==null?{number:x.driver_number,at:time(x.date),x:x.x,y:x.y}:null);
 add('position','positions',x=>time(x.date)!==null&&number(x.position)>0?{number:x.driver_number,at:time(x.date),position:x.position}:null);
 add('intervals','intervals',x=>time(x.date)!==null?{number:x.driver_number,at:time(x.date),gap:number(x.gap_to_leader)??(typeof x.gap_to_leader==='string'?x.gap_to_leader:null),interval:number(x.interval)??(typeof x.interval==='string'?x.interval:null)}:null);
 add('laps','laps',x=>time(x.date_start)!==null&&number(x.lap_number)>0?{number:x.driver_number,at:time(x.date_start),lap:x.lap_number,seconds:number(x.lap_duration),completedAt:number(x.lap_duration)>0?time(x.date_start)+x.lap_duration*1000:null,pitOut:x.is_pit_out_lap===true,sector1:number(x.duration_sector_1),sector2:number(x.duration_sector_2),sector3:number(x.duration_sector_3)}:null);
 add('stints','stints',x=>number(x.lap_start)!==null?{number:x.driver_number,lapStart:x.lap_start,lapEnd:number(x.lap_end),compound:typeof x.compound==='string'?x.compound:null,ageStart:number(x.tyre_age_at_start)}:null);
 add('pit','pits',x=>time(x.date)!==null?{number:x.driver_number,at:time(x.date),lap:number(x.lap_number),laneSeconds:number(x.lane_duration)??number(x.pit_duration),stopSeconds:number(x.stop_duration)}:null);
 add('team_radio','radio',x=>time(x.date)!==null?{number:x.driver_number,at:time(x.date),url:typeof x.recording_url==='string'&&x.recording_url.startsWith('https://livetiming.formula1.com/')?x.recording_url:null}:null);
 add('car_data','telemetry',x=>time(x.date)!==null?{number:x.driver_number,at:time(x.date),speed:number(x.speed),rpm:number(x.rpm),gear:number(x.n_gear),throttle:number(x.throttle),brake:number(x.brake),drs:number(x.drs)}:null);
 for(const d of byDriver.values()){
  for(const field of ['locations','positions','intervals','laps','pits','radio','telemetry'])d[field].sort(sort);
  d.stints.sort((a,b)=>a.lapStart-b.lapStart);
  d.completedLaps=d.laps.filter(l=>l.completedAt!==null).map(l=>({...l,at:l.completedAt})).sort(sort);
  d.locations=d.locations.filter((p,i,a)=>i===0||p.at!==a[i-1].at).map(p=>[p.at,p.x,p.y]);
 }
 const weather=rows('weather',x=>time(x.date)!==null?{at:time(x.date),air:number(x.air_temperature),track:number(x.track_temperature),humidity:number(x.humidity),pressure:number(x.pressure),windSpeed:number(x.wind_speed),windDirection:number(x.wind_direction),rainfall:number(x.rainfall)}:null).sort(sort);
 const control=rows('race_control',x=>time(x.date)!==null&&typeof x.message==='string'?{at:time(x.date),category:x.category||'Other',message:x.message,flag:x.flag||null,scope:x.scope||null,number:number(x.driver_number),lap:number(x.lap_number),sector:number(x.sector)}:null).sort(sort);
 const drivers=[...byDriver.values()];
 // One complete non-pit lap creates the reference line. All cars use exactly the same transform.
 const candidates=drivers.flatMap(d=>d.laps.filter(l=>l.seconds>0&&!l.pitOut&&l.lap>1).map(l=>({d,l}))).sort((a,b)=>a.l.seconds-b.l.seconds);
 let reference=null;
 for(const {d,l} of candidates){const pts=d.locations.filter(p=>p[0]>=l.at&&p[0]<=l.completedAt);if(pts.length>=80){reference={driver:d.number,lap:l.lap,at:l.at,points:pts.map(p=>[p[1],p[2]]),sector1:l.sector1>0?locationAt(d.locations,l.at+l.sector1*1000):null,sector2:l.sector1>0&&l.sector2>0?locationAt(d.locations,l.at+(l.sector1+l.sector2)*1000):null};break;}}
 reference??={driver:null,lap:null,at:null,points:[],sector1:null,sector2:null};
 const rotation=number(raw.circuit?.rotation)??0;
 const corners=Array.isArray(raw.circuit?.corners)?raw.circuit.corners.filter(c=>number(c.number)!==null&&number(c.trackPosition?.x)!==null&&number(c.trackPosition?.y)!==null).map(c=>({number:c.number,x:c.trackPosition.x,y:c.trackPosition.y})):[];
 return {version:4,mode:'replay',session:{key:session.session_key,meetingKey:session.meeting_key,year:session.year,name:raw.meeting?.meeting_name||`${session.country_name} Grand Prix`,type:session.session_name,circuit:session.circuit_short_name,start,end,totalLaps:number(raw.totalLaps)??Math.max(0,...drivers.flatMap(d=>d.laps.map(l=>l.lap))),scheduledStart:time(session.date_start)},drivers,weather,control,track:{...reference,rotation,corners,cornerSource:corners.length?'MultiViewer (referenced by OpenF1)':null,drsZones:[]},provenance,quality:{invalid,unavailable:raw.unavailable||[],locationCount:drivers.reduce((n,d)=>n+d.locations.length,0)},fetchedAt:new Date().toISOString()};
}
function eligibleLap(l,events){
 if(l.pitOut||!l.seconds||l.seconds<=0)return false;
 // There is no authoritative validity field; only explicit deletion messages can be excluded.
 return !events.some(e=>{
  if(!/DELETED|DELETION/i.test(e.message))return false;
  const car=e.message.match(/\bCAR\s+(\d+)\b/i);const number=car?Number(car[1]):e.number;if(number!==l.number)return false;
  const lap=e.message.match(/\bLAP\s+(\d+)\b/i);if(lap)return Number(lap[1])===l.lap;
  const lapTime=`${Math.floor(l.seconds/60)}:${(l.seconds%60).toFixed(3).padStart(6,'0')}`;
  return e.message.includes(`TIME ${lapTime} `);
 });
}
/** One model for replay and future authorized live ingestion. Never selects future timing observations. */
export function raceStateAt(dataset,t,mode='replay'){
 const events=dataset.control.slice(0,indexAt(dataset.control,t)+1);const fastestCandidates=[];
 const drivers=dataset.drivers.map(d=>{
  const lap=lastAt(d.laps,t);const completed=d.completedLaps.slice(0,indexAt(d.completedLaps,t)+1);
  const valid=completed.filter(l=>eligibleLap(l,events));const best=valid.reduce((a,b)=>!a||b.seconds<a.seconds?b:a,null);
  if(best)fastestCandidates.push({...best,driver:d.abbreviation,name:d.name,team:d.team,color:d.color});
  const stint=lap?d.stints.find(s=>s.lapStart<=lap.lap&&(s.lapEnd===null||s.lapEnd>=lap.lap)):null;
  const position=lastAt(d.positions,t),gap=lastAt(d.intervals,t),pit=lastAt(d.pits,t),car=lastAt(d.telemetry||[],t);
  return {number:d.number,abbreviation:d.abbreviation,name:d.name,team:d.team,color:d.color,position:position?.position??null,positionAt:position?.at??null,gap:gap?.gap??null,interval:gap?.interval??null,gapAt:gap?.at??null,currentLap:lap?.lap??null,completedLap:completed.at(-1)?.lap??null,lastLap:completed.at(-1)?.seconds??null,bestLap:best?.seconds??null,compound:stint?.compound??null,tyreAge:stint?.ageStart!==null&&stint&&lap?stint.ageStart+Math.max(0,(completed.at(-1)?.lap??0)-stint.lapStart+1):null,pitStops:dataset.quality?.unavailable?.includes('pit')?null:indexAt(d.pits,t)+1,pitStatus:pit&&t-pit.at<8000?'PIT EVENT':null,location:locationAt(d.locations,t),radio:d.radio.slice(0,indexAt(d.radio,t)+1),telemetry:car&&t-car.at<5000?car:null,positionQuality:locationAt(d.locations,t)?'exact':'unavailable'};
 }).sort((a,b)=>(a.position??999)-(b.position??999)||a.number-b.number);
 // A sector yellow does not replace global status. Session starts are data-driven, not presumed green.
 const global=events.filter(e=>e.category==='SafetyCar'||e.category==='SessionStatus'||e.scope==='Track'&&e.category==='Flag');
 const status=global.at(-1);
 return {mode,session:dataset.session,timestamp:t,source:'OpenF1',fetchedAt:dataset.fetchedAt,connection:'REPLAY',capabilities:dataset.capabilities,drivers,weather:lastAt(dataset.weather,t),control:events,status:status?.message??'Waiting for session',fastestLap:selectFastestLap(fastestCandidates),positionQuality:drivers.some(d=>d.location)?'exact':'unavailable'};
}
export function trackProjector(track,width=720,height=480){
 const angle=(track.rotation||0)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
 const rotate=(x,y)=>[x*cos-y*sin,x*sin+y*cos];const bounds=track.fitBounds;const points=track.projectedBounds?[[track.projectedBounds.minX,track.projectedBounds.minY],[track.projectedBounds.maxX,track.projectedBounds.maxY]]:(bounds?[[bounds.minX,bounds.minY],[bounds.maxX,bounds.minY],[bounds.maxX,bounds.maxY],[bounds.minX,bounds.maxY]]:track.points).map(([x,y])=>rotate(x,y));if(!points.length)return()=>[width/2,height/2];
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=Math.min((width-100)/(maxX-minX||1),(height-100)/(maxY-minY||1));
 return (x,y)=>{const p=rotate(x,y);return [width/2+(p[0]-(minX+maxX)/2)*scale,height/2-(p[1]-(minY+maxY)/2)*scale];};
}

export function selectFastestLap(records){return records.reduce((best,lap)=>typeof lap.seconds==='number'&&lap.seconds>0&&(!best||lap.seconds<best.seconds)?lap:best,null);}
