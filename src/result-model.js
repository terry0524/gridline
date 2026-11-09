import {createHash} from 'node:crypto';
import {buildProgression} from './season-model.js';
const finite=Number.isFinite;
export const resultKinds={Race:'race',Sprint:'sprint',Qualifying:'qualifying'};
export const resultKey=(round,kind)=>`${round}:${kind}`;
export const resultDigest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const lapTime=s=>finite(s)?`${Math.floor(s/60)}:${(s%60).toFixed(3).padStart(6,'0')}`:null;
export function matchResultSession(schedule,session,kind=resultKinds[session?.type]){
 if(!kind||!finite(session.start))return null;
 const matches=schedule.filter(m=>m.season===session.year&&m.sessions.some(s=>s.name===session.type&&finite(s.start)&&Math.abs(s.start-session.start)<3*3600000));
 return matches.length===1?{meeting:matches[0],kind}:null;
}
function identity(number,abbreviation,season){
 const rows=[...(season.standings?.drivers??[]).map(s=>({driver:s.driver,team:s.team})),...[...(season.races??[]),...(season.sprints??[])].reverse().flatMap(m=>m.results)];
 return rows.find(r=>r.driver?.number===number&&(!abbreviation||r.driver.abbreviation===abbreviation))??rows.find(r=>abbreviation&&r.driver?.abbreviation===abbreviation)??null;
}
export function provisionalResult(state,season,now=Date.now()){
 const match=matchResultSession(season.schedule,state.session);
 if(state.mode!=='live'||!match||!['Ends','Finished','Finalised'].includes(state.session.status)||!state.drivers?.some(d=>finite(d.position)))return null;
 const {meeting,kind}=match;
 if(kind==='qualifying'&&state.session.status==='Ends')return null;
 const results=state.drivers.filter(d=>finite(d.position)).map(d=>{
  const known=identity(d.number,d.abbreviation,season),f=state.fastestLap;
  return {position:d.position,positionText:String(d.position),number:d.number,driver:known?.driver??{id:null,name:d.name,abbreviation:d.abbreviation,number:d.number},team:known?.team??{id:null,name:d.team,color:d.color},grid:null,laps:finite(d.completedLap)?d.completedLap:null,points:null,time:d.position===1?null:finite(d.gap)?`+${d.gap.toFixed(3)}`:typeof d.gap==='string'?d.gap:null,timeMillis:null,status:null,classification:d.retired===true?'DNF':'PROVISIONAL',q1:null,q2:null,q3:null,fastest:f?.number===d.number&&finite(f.seconds)?{rank:1,lap:f.lap,time:lapTime(f.seconds)}:null};
 }).sort((a,b)=>a.position-b.position);
 return {meeting:{...meeting,kind,results},status:'PROVISIONAL',source:'F1 Timing',sourceAt:state.health?.channels?.TimingData?.sourceTimestamp??state.timestamp,checkedAt:now,sessionKey:state.session.key};
}
// Only a fresh, actually observed active session may transition into a saved timing result.
export class ResultFinishTracker{
 constructor(){this.active=new Map();}
 observe(state,season,now=Date.now()){
  if(state?.mode!=='live'||!Number.isSafeInteger(state.session?.key)||state.session.key<=0)return null;
  const at=state.health?.channels?.TimingData?.sourceTimestamp??state.health?.sourceTimestamp;
  if(state.active===true&&finite(at)&&now-at>=-5000&&now-at<=15000)this.active.set(state.session.key,now);
  for(const[k,t]of this.active)if(now-t>10*60000)this.active.delete(k);
  const seen=this.active.get(state.session.key);
  if(!seen||now-seen>10*60000)return null;
  return provisionalResult(state,season,now);
 }
}
export function openF1Result(rows,session,season,now=Date.now()){
 const type = session.session_name;
 const kind = type === 'Sprint Qualifying' ? 'sprint-qualifying' : resultKinds[type];
 const match=matchResultSession(season.schedule,{...session,key:session.session_key,type,start:Date.parse(session.date_start)},kind);
 if(!match||!Array.isArray(rows)||!rows.length||rows.some(r=>r.session_key!==session.session_key))return null;
 const {meeting}=match;
 const qualifying = kind === 'qualifying' || kind === 'sprint-qualifying';
 const results=rows.filter(r=>Number.isInteger(r.driver_number)).map(r=>{
  const known=identity(r.driver_number,null,season),duration=Array.isArray(r.duration)?r.duration:[],gap=r.gap_to_leader;
  return {position:Number.isInteger(r.position)?r.position:null,positionText:r.position===null?null:String(r.position),number:r.driver_number,driver:known?.driver??{id:null,name:`Driver ${r.driver_number}`,abbreviation:String(r.driver_number),number:r.driver_number},team:known?.team??{id:null,name:'—',color:'#91a3b8'},grid:null,laps:finite(r.number_of_laps)?r.number_of_laps:null,points:finite(r.points)?r.points:null,time:qualifying?null:r.position===1&&finite(r.duration)?new Date(r.duration*1000).toISOString().slice(11,23):finite(gap)?`+${gap.toFixed(3)}`:typeof gap==='string'?gap:null,timeMillis:r.position===1&&finite(r.duration)?r.duration*1000:null,status:null,classification:r.dsq===true?'DSQ':r.dns===true?'DNS':r.dnf===true?'DNF':qualifying?'QUALIFIED':r.dnf===false&&r.dns===false&&r.dsq===false?'CLASSIFIED':'—',q1:lapTime(duration[0]),q2:lapTime(duration[1]),q3:lapTime(duration[2]),fastest:null};
 }).sort((a,b)=>(a.position??999)-(b.position??999));
 if(!results.length||new Set(results.map(r=>r.number)).size!==results.length)return null;
 return{meeting:{...meeting,kind,results},status:'SOURCE_RESULT',source:'OpenF1 historical',sourceAt:now,checkedAt:now,sessionKey:session.session_key};
}
export function selectResult(prior,next){
 if(!prior)return next;
 const rank={PROVISIONAL:1,SOURCE_RESULT:2,PUBLISHED:3};
 if(rank[next.status]<rank[prior.status]||next.checkedAt<prior.checkedAt)return prior;
 if(next.status===prior.status&&prior.sourceAt>next.sourceAt)return prior;
 return next;
}
export function mergeResultSnapshot(prior,packet){
 const items=new Map((prior?.items??[]).map(r=>[resultKey(r.meeting.round,r.meeting.kind),r]));
 for(const r of packet.items??[]){const key=resultKey(r.meeting.round,r.meeting.kind);items.set(key,selectResult(items.get(key),r));}
 const ordered=[...items.values()].sort((a,b)=>a.meeting.round-b.meeting.round||a.meeting.kind.localeCompare(b.meeting.kind));
 const standings=packet.standings&&(!prior?.standings||(packet.standings.round>prior.standings.round||packet.standings.round===prior.standings.round&&(packet.standings.sourceAt??0)>=(prior.standings.sourceAt??0)))?packet.standings:prior?.standings??null;
 const stable=ordered.map(({checkedAt,sourceAt,...r})=>r);
 return{version:1,season:packet.season,items:ordered,standings,checkedAt:Math.max(prior?.checkedAt??0,packet.checkedAt),revision:resultDigest({items:stable,standings:standings?Object.fromEntries(Object.entries(standings).filter(([k])=>k!=='sourceAt')):null})};
}
export function overlaySeasonResults(season,snapshot){
 if(!snapshot?.items?.length)return{...season,resultRevision:snapshot?.revision??null};
 const sourceTime=pattern=>{const times=(season.provenance??[]).filter(p=>p.url?.includes(pattern)).map(p=>Date.parse(p.fetchedAt)).filter(Number.isFinite);return times.length?Math.min(...times):Date.parse(season.fetchedAt)||0;};
 const baseRaceAt=sourceTime(`/${season.season}/results.json`),baseSprintAt=sourceTime(`/${season.season}/sprint.json`);
 const races=new Map(season.races.map(r=>[r.round,r])),sprints=new Map(season.sprints.map(r=>[r.round,r])),earlyResults=[];
 for(const r of snapshot.items){const m={...r.meeting,resultStatus:r.status,resultSource:r.source,resultUpdatedAt:r.sourceAt};
  if(r.status==='PUBLISHED'&&['race','sprint'].includes(m.kind)){const target=m.kind==='race'?races:sprints,at=m.kind==='race'?baseRaceAt:baseSprintAt;if(!target.has(m.round)||r.sourceAt>=at)target.set(m.round,m);}
  else if(r.status!=='PUBLISHED'&&m.kind==='race'&&!races.has(m.round))earlyResults.push(m);
 }
 const finalRaces=[...races.values()].sort((a,b)=>a.round-b.round),finalSprints=[...sprints.values()].sort((a,b)=>a.round-b.round);
 const candidate=snapshot.standings,baseStandingAt=Math.min(sourceTime(`/${season.season}/driverstandings.json`),sourceTime(`/${season.season}/constructorstandings.json`));
 const standings=structuredClone(candidate&&(candidate.round>season.standings.round||candidate.round===season.standings.round&&(candidate.sourceAt??0)>=baseStandingAt)?candidate:season.standings);
 for(const standing of standings.drivers){const latest=[...finalRaces,...finalSprints].sort((a,b)=>b.round-a.round||(a.kind==='race'?-1:1)).flatMap(m=>m.results).find(r=>r.driver.id===standing.id);if(latest){standing.driver.number=latest.number??standing.driver.number;standing.team=latest.team;}}
 const progression=buildProgression(finalRaces,finalSprints,standings);
 const lastRound=finalRaces.at(-1)?.round??0,missing=season.schedule.find(m=>m.round<=lastRound&&Number.isFinite(m.start)&&!races.has(m.round));
 // Never draw an understated cumulative total across a missing earlier Race.
 if(missing){progression.rounds=progression.rounds.filter(r=>r.round<missing.round);progression.complete=false;progression.reconciliation.matches=false;}
 if(season.errors.race||season.errors.sprint){progression.complete=false;progression.reconciliation.matches=false;}
 return{...season,races:finalRaces,sprints:finalSprints,standings,progression,earlyResults,resultRevision:snapshot.revision};
}
export function resultPollDelay(start,record,now){
 const age=now-start;if(age<0||age>7*86400000)return null;
 if(record?.status==='PUBLISHED')return age<6*3600000?300000:age<86400000?1800000:6*3600000;
 return age<6*3600000?60000:age<86400000?300000:1800000;
}
