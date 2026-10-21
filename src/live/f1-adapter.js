import {mergePatch,decodeTopic,parseUtc,numeric,lapSeconds} from './protocol.js';
import {selectFastestLap} from '../race-model.js';
const entries=v=>v&&typeof v==='object'?Object.entries(v).filter(([k,value])=>/^\d+$/.test(k)&&value!==null&&typeof value==='object'):[];
import {detectCapabilities} from './diagnostics.js';
const values=v=>entries(v).map(([,r])=>r);
const gap=v=>typeof v==='number'?v:typeof v==='string'&&v.trim()?numeric(v)??v:null;
const trackStatus={'1':'GREEN · ALL CLEAR','2':'YELLOW','4':'SAFETY CAR','5':'RED FLAG','6':'VIRTUAL SAFETY CAR','7':'VSC ENDING'};
const compoundSet=new Set(['SOFT','MEDIUM','HARD','INTERMEDIATE','WET']);
function localSessionTime(date,offset){
 if(typeof date!=='string')return null;
 const raw=String(offset||'00:00:00');const zone=/^[+-]/.test(raw)?raw.slice(0,6):'+'+raw.slice(0,5);
 return Date.parse(date+(/Z$|[+-]\d\d:\d\d$/.test(date)?'':zone));
}
export class F1StateAdapter{
 raw={};topicAt={};lineAt={};progressAt={};locationHistory=new Map();carData=new Map();lastSourceAt=null;receivedAt=null;invalid=0;
 reset(){this.raw={};this.topicAt={};this.lineAt={};this.progressAt={};this.locationHistory.clear();this.carData.clear();this.lastSourceAt=null;}
 snapshot(snapshot,receivedAt=Date.now()){
  const previousKey=this.sessionKey,previousTrack=this.track;this.reset();this.receivedAt=receivedAt;for(const [topic,data]of Object.entries(snapshot)){try{const d=decodeTopic(topic,data);this.raw[d.topic]=mergePatch(undefined,d.data);this.readHighFrequency(d.topic,d.data);}catch{this.invalid++;}}
  this.track=this.sessionKey===previousKey?previousTrack:null;this.lastSourceAt=parseUtc(this.raw.Heartbeat?.Utc); // No wall-clock freshness assigned to old keyframes.
 }
 ingest(topic,value,utc,receivedAt=Date.now()){
  const {topic:name,data}=decodeTopic(topic,value);const at=parseUtc(utc);
  if(name==='SessionInfo'&&data.Key!==undefined&&this.raw.SessionInfo?.Key!==undefined&&data.Key!==this.raw.SessionInfo.Key){this.reset();this.track=null;}
  if(at!==null&&this.topicAt[name]!==undefined&&at<this.topicAt[name])return false;
  this.raw[name]=mergePatch(this.raw[name],data);this.receivedAt=receivedAt;if(at!==null){this.topicAt[name]=at;this.lastSourceAt=Math.max(this.lastSourceAt||0,at);for(const[n,line]of entries(data.Lines)){this.lineAt[`${name}/${n}`]=at;if(name==='TimingData'&&(line.Sectors!==undefined||line.NumberOfLaps!==undefined))this.progressAt[n]=at;}}
  this.readHighFrequency(name,data);return true;
 }
 readHighFrequency(topic,data){
  if(topic==='Position')for(const row of values(data.Position)){const at=parseUtc(row.Timestamp);if(at===null)continue;for(const[n,p]of entries(row.Entries)){if(numeric(p.X)===null||numeric(p.Y)===null)continue;const history=this.locationHistory.get(Number(n))||[];if(history.length&&at<=history.at(-1)[0])continue;history.push([at,numeric(p.X),numeric(p.Y)]);if(history.length>80)history.splice(0,history.length-80);this.locationHistory.set(Number(n),history);this.topicAt.Position=Math.max(this.topicAt.Position??0,at);this.lastSourceAt=Math.max(this.lastSourceAt??0,at);}}
  if(topic==='CarData')for(const row of values(data.Entries)){const at=parseUtc(row.Utc);if(at===null)continue;for(const[n,p]of entries(row.Cars)){const c=p.Channels||{};if((this.carData.get(Number(n))?.at??0)>at)continue;this.carData.set(Number(n),{at,speed:numeric(c['2']),rpm:numeric(c['0']),gear:numeric(c['3']),throttle:numeric(c['4']),brake:numeric(c['5']),drs:Number(String(this.raw.SessionInfo?.Path||'').slice(0,4))>=2026?null:numeric(c['45']),channel45Raw:numeric(c['45'])});this.topicAt.CarData=Math.max(this.topicAt.CarData??0,at);this.lastSourceAt=Math.max(this.lastSourceAt??0,at);}}
 }
 get sessionKey(){return this.raw.SessionInfo?.Key??null;}
 get active(){return this.raw.SessionStatus?.Status==='Started'&&!['Finished','Finalised'].includes(this.raw.SessionInfo?.SessionStatus);}
 toRaceState(connection='OFFLINE'){
  const info=this.raw.SessionInfo||{};const timestamp=this.lastSourceAt;const start=localSessionTime(info.StartDate,info.GmtOffset);const end=localSessionTime(info.EndDate,info.GmtOffset);const candidates=[];
  const drivers=entries(this.raw.DriverList).map(([key,meta])=>{
   const n=Number(key),line=this.raw.TimingData?.Lines?.[key]||{},stats=this.raw.TimingStats?.Lines?.[key]||{};
   const stints=values(this.raw.TimingAppData?.Lines?.[key]?.Stints);const stint=stints.at(-1);const best=line.BestLapTime??stats.PersonalBestLapTime;
   const seconds=lapSeconds(best?.Value);const lap=numeric(best?.Lap)??(seconds===lapSeconds(stats.PersonalBestLapTime?.Value)?numeric(stats.PersonalBestLapTime?.Lap):null);
   const color=/^[a-f\d]{6}$/i.test(meta.TeamColour||'')?'#'+meta.TeamColour:'#91a3b8';const completed=numeric(line.NumberOfLaps);
   const d={number:n,abbreviation:meta.Tla||String(n),name:meta.FullName||meta.BroadcastName||String(n),team:meta.TeamName||'—',color,position:numeric(line.Position),positionAt:this.lineAt[`TimingData/${key}`]??null,gap:gap(line.GapToLeader),interval:gap(line.IntervalToPositionAhead?.Value),gapAt:this.lineAt[`TimingData/${key}`]??null,currentLap:completed===null?null:this.active?completed+1:completed,completedLap:completed,lastLap:lapSeconds(line.LastLapTime?.Value),bestLap:seconds,compound:compoundSet.has(stint?.Compound)?stint.Compound:null,tyreAge:numeric(stint?.TotalLaps),pitStops:numeric(line.NumberOfPitStops),pitStatus:line.InPit===true?'PIT IN':line.PitOut===true?'PIT OUT':null,pitIn:typeof line.InPit==='boolean'?line.InPit:null,pitOut:typeof line.PitOut==='boolean'?line.PitOut:null,pitDuration:null,retired:typeof line.Retired==='boolean'?line.Retired:null,location:null,telemetry:this.carData.get(n)||null,radio:[],positionQuality:'unavailable'};
   const point=this.locationHistory.get(n)?.at(-1);if(point){d.positionQuality='exact';d.location={at:point[0],x:point[1],y:point[2],interpolated:false};}
   if(seconds!==null)candidates.push({number:n,driver:d.abbreviation,name:d.name,team:d.team,color,seconds,lap,at:this.lineAt[`TimingData/${key}`]??null,completedAt:null,pitOut:false});
   return d;
  }).sort((a,b)=>(a.position??999)-(b.position??999)||a.number-b.number);
  const control=values(this.raw.RaceControlMessages?.Messages).filter(e=>typeof e.Message==='string').map(e=>({at:parseUtc(e.Utc),category:e.Category||'Other',message:e.Message,flag:e.Flag||null,scope:e.Scope||null,number:numeric(e.RacingNumber),lap:numeric(e.Lap),sector:numeric(e.Sector)})).filter(e=>e.at!==null).sort((a,b)=>a.at-b.at);
  const path=typeof info.Path==='string'&&/^\d{4}\/[A-Za-z\d_./-]+\/$/.test(info.Path)&&!info.Path.includes('..')?info.Path:null;
  if(path)for(const r of values(this.raw.TeamRadio?.Captures)){if(typeof r.Path!=='string'||!/^TeamRadio\/[A-Za-z\d_.-]+\.mp3$/.test(r.Path))continue;const d=drivers.find(d=>d.number===numeric(r.RacingNumber));if(d)d.radio.push({at:parseUtc(r.Utc),reference:r.Path,url:`https://livetiming.formula1.com/static/${path}${r.Path}`});}
  const w=this.raw.WeatherData;const weather=w?{at:this.topicAt.WeatherData??null,air:numeric(w.AirTemp),track:numeric(w.TrackTemp),humidity:numeric(w.Humidity),pressure:numeric(w.Pressure),rainfall:numeric(w.Rainfall),windSpeed:numeric(w.WindSpeed),windDirection:numeric(w.WindDirection)}:null;
  const code=String(this.raw.TrackStatus?.Status??'');const status=trackStatus[code]||this.raw.TrackStatus?.Message||'Waiting for session';
  const state={mode:'live',source:'F1 SignalR Core · anonymous timing',fetchedAt:this.receivedAt!==null?new Date(this.receivedAt).toISOString():null,timestamp,connection,session:{key:info.Key??null,meetingKey:info.Meeting?.Key??null,year:numeric(String(info.Path||'').slice(0,4)),name:info.Meeting?.Name||'Waiting for session',type:info.Name||info.Type||'—',circuit:info.Meeting?.Circuit?.ShortName||'—',circuitKey:info.Meeting?.Circuit?.Key??null,start:Number.isFinite(start)?start:null,end:Number.isFinite(end)?end:null,scheduledStart:Number.isFinite(start)?start:null,status:this.raw.SessionStatus?.Status||info.SessionStatus||null,currentLap:numeric(this.raw.LapCount?.CurrentLap),totalLaps:numeric(this.raw.LapCount?.TotalLaps)},drivers,weather,control,status:this.active?status:`SESSION ${this.raw.SessionStatus?.Status||'UNKNOWN'} · ${status}`,trackStatus:code,fastestLap:selectFastestLap(candidates),capabilities:{position:this.locationHistory.size>0,telemetry:this.carData.size>0,timing:!!this.raw.TimingData,weather:!!w,radio:!!this.raw.TeamRadio},quality:{invalid:this.invalid},active:this.active};state.capabilities=detectCapabilities(state);state.capabilities.radio=state.capabilities.radioMetadata;state.positionQuality=state.capabilities.position?'exact':'unavailable';return state;
 }
}
