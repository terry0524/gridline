import {getData,isHistorical} from './provider.js';
import {normalizeResults,normalizeStandings} from './season-model.js';
import {ResultFinishTracker,resultKinds,resultKey,resultDigest,selectResult,openF1Result,resultPollDelay} from './result-model.js';
const endpoints={race:'results',sprint:'sprint',qualifying:'qualifying'};
const sourceList=(e,kind)=>e.data.MRData.StandingsTable?.StandingsLists?.[0]?.[kind==='drivers'?'DriverStandings':'ConstructorStandings']??[];
export class ResultSynchronizer{
 constructor({loadSeason,loadSaved=async()=>null,publish,fetcher=getData,now=Date.now}={}){Object.assign(this,{loadSeason,loadSaved,publish,fetcher,now});this.tracker=new ResultFinishTracker();this.items=new Map();this.lastChecks=new Map();this.failures=new Map();this.season=null;this.standings=null;this.busy=false;this.dirty=false;this.lastSeasonAt=0;this.lastError=null;this.lastFlush=0;this.changeRevision=0;this.openF1Checks=new Map();}
 async prepare(){const now=this.now();if(this.season&&now-this.lastSeasonAt<6*3600000)return;const season=await this.loadSeason(new Date(now).getUTCFullYear());if(!season?.schedule?.length)throw Error('Result monitor schedule unavailable');if(this.season?.season!==season.season){this.items.clear();const saved=await this.loadSaved(season.season);for(const r of saved?.items??[])this.items.set(resultKey(r.meeting.round,r.meeting.kind),r);this.standings=saved?.standings??null;}this.season=season;this.lastSeasonAt=now;}
 accept(record){const key=resultKey(record.meeting.round,record.meeting.kind),prior=this.items.get(key),chosen=selectResult(prior,record);if(chosen===prior)return false;this.items.set(key,chosen);this.dirty=true;this.changeRevision++;return !prior||resultDigest(prior.meeting)!==resultDigest(chosen.meeting)||prior.status!==chosen.status;}
 observe(state){this.liveState=state;if(!this.season)return;const r=this.tracker.observe(state,this.season,this.now());if(!r)return;const prior=this.items.get(resultKey(r.meeting.round,r.meeting.kind));if(prior?.status==='PROVISIONAL'&&resultDigest(prior.meeting)===resultDigest(r.meeting))return;this.accept(r);}
 async refreshStandings(){
  const year=this.season.season,now=this.now();if(this.lastStandingsAt&&now-this.lastStandingsAt<300000)return;
  const [d,c]=await Promise.all(['driverstandings','constructorstandings'].map(k=>this.fetcher('jolpica',`${year}/${k}`,{limit:100},60000)));
  if(d.stale||c.stale)return;
  const dr=Number(d.data.MRData.StandingsTable?.StandingsLists?.[0]?.round),cr=Number(c.data.MRData.StandingsTable?.StandingsLists?.[0]?.round);if(!dr||dr!==cr)return;
  if(!sourceList(d,'drivers').length||!sourceList(c,'constructors').length)throw Error('Published standings unavailable');
  const previous=dr>1?await Promise.all(['driverstandings','constructorstandings'].map(k=>this.fetcher('jolpica',`${year}/${dr-1}/${k}`,{limit:100},300000))):null;
  if(previous?.some(e=>e.stale))return;
  this.standings={round:dr,sourceAt:Math.max(Date.parse(d.fetchedAt),Date.parse(c.fetchedAt)),drivers:normalizeStandings(sourceList(d,'drivers'),'drivers',previous?sourceList(previous[0],'drivers'):[]),constructors:normalizeStandings(sourceList(c,'constructors'),'constructors',previous?sourceList(previous[1],'constructors'):[])};
  this.lastStandingsAt=now;this.dirty=true;this.changeRevision++;
 }
 async fallback(target){
  const now=this.now(),key=resultKey(target.round,resultKinds[target.name]);if(now-(this.openF1Checks.get(key)??0)<300000)return;
  this.openF1Checks.set(key,now);
  const env=await this.fetcher('openf1','sessions',{year:this.season.season},3600000);if(env.stale)return;
  const candidates=env.data.filter(s=>s.is_cancelled!==true&&s.session_name===target.name&&s.year===this.season.season&&Math.abs(Date.parse(s.date_start)-target.start)<3*3600000&&isHistorical(s,now));if(candidates.length!==1)return;
  const session=candidates[0];if(this.liveState?.session?.key===session.session_key&&this.liveState.active===true)return;
  const data=await this.fetcher('openf1','session_result',{session_key:session.session_key},60000);if(data.stale)return;
  const record=openF1Result(data.data,session,this.season,now);if(record)this.accept(record);
 }
 async tick(state){
  if(this.busy)return;this.busy=true;
  try{
   await this.prepare();this.observe(state);
   if(this.dirty)await this.flush();
   const now=this.now();
   for(const m of this.season.schedule)for(const s of m.sessions){
    const kind=resultKinds[s.name];if(!kind||!Number.isFinite(s.start))continue;
    const key=resultKey(m.round,kind),prior=this.items.get(key),wait=resultPollDelay(s.start,prior,now);
    // Begin light result checks near the expected finish; a real end transition bypasses this gate.
    const minimum=kind==='race'?60*60000:kind==='sprint'?20*60000:30*60000;
    const failures=this.failures.get(key)??0,backoff=failures?Math.min(1800000,60000*2**Math.min(failures-1,5)):0;
    if(wait===null||now-s.start<minimum&&!prior||now-(this.lastChecks.get(key)??0)<Math.max(wait,backoff))continue;
    this.lastChecks.set(key,now);
    try{
     const e=await this.fetcher('jolpica',`${m.season}/${m.round}/${endpoints[kind]}`,{limit:100},60000);
     if(e.stale)throw Error('Result source delayed; previous result retained');
     const races=e.data.MRData.RaceTable?.Races??[],normalized=normalizeResults(races,kind).find(r=>r.round===m.round&&r.season===m.season);
     if(normalized?.results.length&&normalized.results.every(r=>Number.isInteger(r.number)&&(kind==='qualifying'||Number.isFinite(r.points)))){this.accept({meeting:normalized,status:'PUBLISHED',source:'Jolpica',sourceAt:Date.parse(e.fetchedAt),checkedAt:now,sessionKey:prior?.sessionKey??null});if(kind!=='qualifying')await this.refreshStandings();}
     else{try{await this.fallback({...s,round:m.round});}catch{ /* Optional historical source never removes a good result. */ }}
     this.failures.delete(key);this.lastError=null;
    }catch(e){this.failures.set(key,failures+1);this.lastError=e.message;}
   }
   if(this.dirty||now-this.lastFlush>=300000)await this.flush();
  }catch(e){this.lastError=e.message;}
  finally{this.busy=false;}
 }
 async flush(){if(this.flushing||!this.season)return;this.flushing=true;const now=this.now(),revision=this.changeRevision;try{await this.publish({version:1,season:this.season.season,checkedAt:now,items:[...this.items.values()],standings:this.standings});this.lastFlush=now;if(this.changeRevision===revision)this.dirty=false;}finally{this.flushing=false;}}
}
