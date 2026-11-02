import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {Readable} from 'node:stream';
import {spawn} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {normalizeResults} from '../src/season-model.js';
import {ResultFinishTracker,provisionalResult,openF1Result,matchResultSession,mergeResultSnapshot,overlaySeasonResults,resultPollDelay} from '../src/result-model.js';
import {validateResultPacket,ingestResults,readResults,resultRevision} from '../src/result-store.js';
import {ResultSynchronizer} from '../src/result-sync.js';
const fixture=JSON.parse(await fs.readFile(new URL('./fixtures/mexico-result-sources.json',import.meta.url)));
const season=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/season-2026.json.gz',import.meta.url))));
const session=fixture.data['race-session'][0],now=Date.parse(session.date_end)+3600000;
const published={meeting:normalizeResults(fixture.data['jolpica-result'].MRData.RaceTable.Races,'race')[0],status:'PUBLISHED',source:'Jolpica',sourceAt:now,checkedAt:now,sessionKey:session.session_key};
const fallback=openF1Result(fixture.data.result,session,season,now);
const state={mode:'live',active:true,timestamp:now-1000,session:{key:session.session_key,year:2026,type:'Race',start:Date.parse(session.date_start),status:'Started'},health:{channels:{TimingData:{sourceTimestamp:now-1000}}},drivers:fixture.data.result.map(r=>({number:r.driver_number,position:r.position,completedLap:r.number_of_laps,retired:r.dnf,gap:r.gap_to_leader,name:`Driver ${r.driver_number}`,abbreviation:null,team:'—',color:'#999'}))};
const pending=()=>provisionalResult({...state,active:false,session:{...state.session,status:'Ends'}},season,now);
const packet=r=>({version:1,season:2026,checkedAt:now,items:[r],standings:null});
const memory=()=>{const m=new Map();return{async get(k){return m.get(k);},async set(k,v){m.set(k,v);}};};
const env=data=>({data,fetchedAt:new Date(now).toISOString(),stale:false});
test('actual Mexico OpenF1 Race/Qualifying normalize observed positions, laps, awards and Q segments',()=>{
 assert.equal(fallback.meeting.results.length,22);assert.equal(fallback.meeting.results[0].number,3);assert.equal(fallback.meeting.results[0].points,25);assert.equal(fallback.meeting.results[0].time,'02:20:28.772');assert.equal(fallback.meeting.results[0].laps,71);assert.equal(fallback.status,'SOURCE_RESULT');
 const q=openF1Result(fixture.data.qualifying,fixture.data['qualifying-session'][0],season,now);
 assert.equal(q.meeting.results[0].number,44);assert.equal(q.meeting.results[0].q1,'1:17.341');assert.equal(q.meeting.results[0].q3,'1:16.514');assert.equal(q.meeting.results[0].points,null);
 const jq={meeting:normalizeResults(fixture.data['jolpica-qualifying'].MRData.RaceTable.Races,'qualifying')[0],status:'PUBLISHED',source:'Jolpica',sourceAt:now,checkedAt:now};validateResultPacket(packet(jq),now);assert.ok(jq.meeting.results.every(r=>r.points===null));
 assert.deepEqual(fallback.meeting.results.map(r=>r.number),published.meeting.results.map(r=>r.number));assert.deepEqual(fallback.meeting.results.map(r=>r.points),published.meeting.results.map(r=>r.points));
});
test('only a fresh actually observed live end transition produces provisional results; no inferred points/grid',()=>{
 const tracker=new ResultFinishTracker(),ended={...state,active:false,session:{...state.session,status:'Ends'}};
 assert.equal(tracker.observe(ended,season,now),null);assert.equal(tracker.observe({...state,mode:'simulated-live'},season,now),null);
 tracker.observe(state,season,now);const result=tracker.observe(ended,season,now+1000);assert.equal(result.status,'PROVISIONAL');assert.ok(result.meeting.results.every(r=>r.points===null&&r.grid===null));
 assert.equal(tracker.observe({...ended,session:{...ended.session,status:'Aborted'}},season,now+2000),null);
 assert.equal(tracker.observe(ended,season,now+11*60000),null);
 const stale=new ResultFinishTracker();stale.observe({...state,health:{sourceTimestamp:now-60000}},season,now);assert.equal(stale.observe(ended,season,now),null);
});
test('session matching rejects wrong year, ambiguous calendars and mismatched OpenF1 session payloads',()=>{
 assert.equal(matchResultSession(season.schedule,{...state.session,year:2025}),null);
 assert.equal(matchResultSession([...season.schedule,...season.schedule],state.session),null);
 assert.equal(openF1Result([{...fixture.data.result[0],session_key:1}],session,season,now),null);
 const unknown=pending();assert.ok(unknown.meeting.results.every(r=>r.driver.id===null||typeof r.driver.id==='string'));
});
test('published revisions supersede provisional and OpenF1 but cannot downgrade; post-race corrections change revision',()=>{
 let s=mergeResultSnapshot(null,packet(pending()));const provisionalRevision=s.revision;s=mergeResultSnapshot(s,packet(fallback));assert.notEqual(s.revision,provisionalRevision);
 s=mergeResultSnapshot(s,packet(published));const revision=s.revision;s=mergeResultSnapshot(s,packet({...pending(),checkedAt:now+1000}));assert.equal(s.items[0].status,'PUBLISHED');assert.equal(s.revision,revision);
 const corrected=structuredClone(published);corrected.checkedAt=now+2000;corrected.meeting.results[0].points=18;s=mergeResultSnapshot(s,packet(corrected));assert.notEqual(s.revision,revision);
 const unchanged=mergeResultSnapshot(s,{...packet({...corrected,checkedAt:now+3000,sourceAt:now+3000}),checkedAt:now+3000});assert.equal(s.revision,unchanged.revision);
 const stale=mergeResultSnapshot(s,packet({...published,checkedAt:now+4000,sourceAt:now-1}));assert.equal(stale.items[0].meeting.results[0].points,18);
});
test('early results do not alter actual championship awards; published results rebuild progression',()=>{
 const points=rows=>rows.map(r=>({round:r.round,drivers:r.drivers,constructors:r.constructors}));const before=points(season.progression.rounds);
 for(const r of [pending(),fallback]){const s=overlaySeasonResults(season,mergeResultSnapshot(null,packet(r)));assert.equal(s.races.length,17);assert.equal(s.earlyResults.length,1);assert.deepEqual(points(s.progression.rounds),before);}
 const missing=overlaySeasonResults(season,mergeResultSnapshot(null,packet(published)));assert.equal(missing.progression.complete,false);assert.equal(missing.progression.rounds.at(-1).round,17);
 const complete={...season,races:[...season.races,...normalizeResults(fixture.data['jolpica-united-states'].MRData.RaceTable.Races,'race')]};
 const updated=overlaySeasonResults(complete,mergeResultSnapshot(null,packet(published)));assert.equal(updated.races.length,19);assert.equal(updated.earlyResults.length,0);assert.equal(updated.progression.rounds.at(-1).round,19);assert.equal(updated.progression.rule.fastestLapBonus,0);assert.equal(updated.progression.rounds.at(-1).drivers.max_verstappen,261);assert.equal(updated.progression.rounds.at(-1).drivers.antonelli,380);
});
test('authenticated relay storage is bounded, durable across readers and rejects malformed/private payloads',async()=>{
 const store=memory();const p=packet(published);validateResultPacket(p,now);
 assert.throws(()=>validateResultPacket({...p,season:2022},now));assert.throws(()=>validateResultPacket({...p,cookie:'private'},now));assert.throws(()=>validateResultPacket({...p,checkedAt:now-180000},now));
 const bad=structuredClone(p);bad.items[0].meeting.results[0].position=Infinity;assert.throws(()=>validateResultPacket(bad,now));
 // Ingestion validates wall-clock replay protection, independently of historical source timestamps.
 p.checkedAt=Date.now();await ingestResults(Readable.from([JSON.stringify(p)]),store);assert.equal((await readResults(2026,store)).items[0].status,'PUBLISHED');assert.ok((await resultRevision(2026,store)).revision);
 await assert.rejects(ingestResults(Readable.from([Buffer.alloc(1024*1024+1)]),store),/too large/);
});
test('monitor is single-flight for concurrent callers and only requests due round endpoints',async()=>{
 let calls=0,resolve;const blocker=new Promise(r=>resolve=r),saved=[];const short={...season,schedule:[season.schedule.find(m=>m.round===19)]};
 const sync=new ResultSynchronizer({now:()=>Date.parse(session.date_start)+2*3600000,loadSeason:async()=>short,publish:async p=>saved.push(p),fetcher:async(source,endpoint)=>{calls++;await blocker;if(source==='jolpica')return env({MRData:{RaceTable:{Races:[]}}});return env([]);}});
 const first=sync.tick(null);await new Promise(r=>setImmediate(r));await Promise.all(Array.from({length:10},()=>sync.tick(null)));resolve();await first;const count=calls;assert.ok(count>=1&&count<=4);await sync.tick(null);assert.equal(calls,count);
});
test('cadence concentrates on the post-session window, backs off after publication and stops after a week',()=>{
 assert.equal(resultPollDelay(now-3600000,null,now),60000);assert.equal(resultPollDelay(now-3600000,published,now),300000);assert.equal(resultPollDelay(now-2*86400000,null,now),1800000);assert.equal(resultPollDelay(now-8*86400000,null,now),null);assert.equal(resultPollDelay(now+1,null,now),null);
});
test('optional source outage retains published result and exponential retry does not hammer upstream',async()=>{
 let calls=0;const short={...season,schedule:[{...season.schedule.find(m=>m.round===19),sessions:[{name:'Race',start:now-2*3600000}]}]},sync=new ResultSynchronizer({now:()=>now,loadSeason:async()=>short,loadSaved:async()=>({items:[published]}),publish:async()=>{},fetcher:async()=>{calls++;throw Error('HTTP 429');}});
 await sync.tick(null);assert.equal(sync.items.get('19:race').status,'PUBLISHED');assert.equal(calls,1);await sync.tick(null);assert.equal(calls,1);
});
test('an end arriving during checkpoint publication stays dirty and is flushed on the next tick',async()=>{
 let release;const blocked=new Promise(r=>release=r),saved=[];const sync=new ResultSynchronizer({now:()=>now,loadSeason:async()=>season,publish:async p=>{saved.push(p);if(saved.length===1)await blocked;}});await sync.prepare();sync.accept(pending());const first=sync.flush();sync.accept(fallback);release();await first;assert.equal(sync.dirty,true);await sync.flush();assert.equal(saved[1].items[0].status,'SOURCE_RESULT');assert.equal(sync.dirty,false);
});

test('newer provider corrections remain visible after the focused monitor window has ended',()=>{
 const corrected=structuredClone(published.meeting);corrected.results[0].points=18;
 const fresh={...season,races:[...season.races,corrected],provenance:[{url:'https://api.jolpi.ca/ergast/f1/2026/results.json',fetchedAt:new Date(now+10000).toISOString()}]};
 const merged=overlaySeasonResults(fresh,mergeResultSnapshot(null,packet(published)));assert.equal(merged.races.at(-1).results[0].points,18);
});

test('HTTP result relay requires existing credentials, public reads are bounded and read-only',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gridline-result-api-')),port=31868;
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),NODE_ENV:'production',GRIDLINE_CACHE_DIR:dir,GRIDLINE_OFFLINE:'1',GRIDLINE_AUTO_LIVE:'0',GRIDLINE_LIVE_ENABLED:'0',GRIDLINE_DEBUG:'0',GRIDLINE_LIVE_BRIDGE_SECRET:'local-test-only'},stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr.on('data',b=>stderr+=b);
 try{
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Server timeout '+stderr)),15000);child.stdout.on('data',b=>{if(String(b).includes('http://')){clearTimeout(timeout);resolve();}});child.once('exit',()=>{clearTimeout(timeout);reject(Error('Server exited '+stderr));});});
  const base=`http://127.0.0.1:${port}`,post=(data,authorized=false)=>fetch(base+'/api/internal/results-ingest',{method:'POST',headers:{'content-type':'application/json',...(authorized?{authorization:'Bearer local-test-only'}:{})},body:JSON.stringify(data)}),p={...packet(published),checkedAt:Date.now()};
  assert.equal((await post(p)).status,401);assert.equal((await post(p,true)).status,200);
  assert.equal((await(await fetch(base+'/api/results/2026')).json()).items[0].meeting.results.length,22);
  assert.ok((await(await fetch(base+'/api/results/2026/revision')).json()).revision);
  assert.equal((await fetch(base+'/api/results/2026',{method:'POST'})).status,405);assert.equal((await fetch(base+'/api/results/2022')).status,400);
 }finally{child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));await fs.rm(dir,{recursive:true,force:true});}
});
