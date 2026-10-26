import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {Readable} from 'node:stream';
import {verificationPlan,validatePlan,scheduledSessions,koreanTime} from '../src/live/verification-plan.js';
import {VerificationScheduler} from '../src/live/verification-scheduler.js';
import {ingestVerification,verificationStatus,validateCheckpoint} from '../src/live/verification-store.js';
import {newObservation,observeState,assessment} from '../scripts/verify-live-session.js';
const workerId='11111111-1111-4111-8111-111111111111';
test('Mexico schedule has explicit UTC instants and KST dates across the November DST boundary',()=>{
 const sessions=scheduledSessions();assert.equal(koreanTime(sessions[0].start),'2026-10-31 03:30');assert.equal(koreanTime(sessions.at(-1).start),'2026-11-02 05:00');
 assert.equal(new Date(sessions.at(-1).scheduledAt).toISOString(),'2026-11-01T20:02:00.000Z');
 const p=structuredClone(verificationPlan);p.sessions[0].start='2026-10-30T18:30:00';assert.throws(()=>validatePlan(p));
 const results=['UTC','Asia/Seoul','America/Los_Angeles'].map(TZ=>spawnSync(process.execPath,['--input-type=module','-e','import {scheduledSessions} from "./src/live/verification-plan.js";console.log(JSON.stringify(scheduledSessions().map(s=>s.scheduledAt)));'],{cwd:new URL('../',import.meta.url),env:{...process.env,TZ},encoding:'utf8'}));for(const r of results)assert.equal(r.status,0);assert.equal(new Set(results.map(r=>r.stdout)).size,1);
});
test('resident timer starts the transport drill once at its target and records the actual delay',async()=>{
 let now=Date.parse('2026-10-27T00:00:00Z'),calls=0,finish;const s=new VerificationScheduler({plan:verificationPlan,workerId,now:()=>now,run:()=>{calls++;return new Promise(r=>{finish=r;});}});
 const target=s.tasks.drill.scheduledAt;now=target-1;s.tick();assert.equal(calls,0);now=target+34;s.tick();await Promise.resolve();assert.equal(calls,1);assert.equal(s.tasks.drill.delayMs,34);s.tick();assert.equal(calls,1);
 finish({result:'TRANSPORT_SMOKE_ONLY',durationMs:20000});await s.active;assert.equal(s.tasks.drill.status,'COMPLETE');s.tick();assert.equal(calls,1);await s.close();
});
test('completed sessions survive restart; missed and interrupted windows are never invented',async()=>{
 const expected=scheduledSessions()[0];let now=expected.scheduledAt-1000,calls=0;const s=new VerificationScheduler({plan:verificationPlan,workerId,now:()=>now,drillDelayMs:86400000,run:async()=>{calls++;return{result:'LIVE_TIMING_VERIFIED'};}});
 now=expected.scheduledAt;s.tick();await s.active;assert.equal(calls,1);const saved=s.snapshot();saved.tasks.fp2.status='RUNNING';
 now=Date.parse(verificationPlan.sessions.at(-1).end)+86400000;const restored=new VerificationScheduler({plan:verificationPlan,workerId,now:()=>now,drillDelayMs:86400000,saved,run:async()=>{calls++;return{};}});restored.tick();assert.equal(calls,1);assert.equal(restored.tasks.fp1.status,'COMPLETE');assert.equal(restored.tasks.fp2.status,'MISSED');assert.equal(restored.tasks.fp2.attempts[0].result,'INTERRUPTED');assert.equal(restored.tasks.fp2.result.result,'NOT_VERIFIED');await restored.close();await s.close();
});
test('a transient unverified observation can retry only once inside the remaining session window',async()=>{
 let now=scheduledSessions()[0].scheduledAt,calls=0;const s=new VerificationScheduler({plan:verificationPlan,workerId,now:()=>now,drillDelayMs:86400000,run:async()=>({result:++calls===1?'NOT_VERIFIED':'LIVE_TIMING_VERIFIED'})});
 s.tick();await s.active;assert.equal(s.tasks.fp1.status,'SCHEDULED');now+=59000;s.tick();assert.equal(calls,1);now+=1000;s.tick();await s.active;assert.equal(calls,2);assert.equal(s.tasks.fp1.status,'COMPLETE');assert.equal(s.tasks.fp1.attempts[0].result,'NOT_VERIFIED');assert.equal(s.tasks.fp1.attempts.length,2);await s.close();
});
test('Mexico observations reject a different meeting and retain the live-freshness evidence requirements',()=>{
 const expected=scheduledSessions()[0],o=newObservation(expected),wrong=newObservation(expected),base=expected.scheduledAt;
 for(let i=0;i<=130;i++){const at=base+i*5000,s={mode:'live',active:true,session:{key:999,year:2026,name:'Mexico City Grand Prix',type:'Practice 1',start:Date.parse(expected.start)},health:{status:'CONNECTED',sessionAvailability:'LIVE SESSION AVAILABLE',channels:{TimingData:{sourceTimestamp:at}}},drivers:[{number:1,abbreviation:'VER',position:1,currentLap:Math.floor(i/18)+1,compound:'SOFT',radio:[]}],control:[]};observeState(o,s,at);observeState(wrong,{...s,session:{...s.session,name:'United States Grand Prix'}},at);}
 assert.equal(assessment(o).result,'LIVE_TIMING_VERIFIED');assert.equal(assessment(wrong).result,'NOT_VERIFIED');assert.equal(assessment(o,{smoke:true}).result,'TRANSPORT_SMOKE_ONLY');
});
test('checkpoint store bounds data, excludes credentials and separates smoke from actual Live',async()=>{
 const s=new VerificationScheduler({plan:verificationPlan,workerId,run:async()=>({})}),p=s.snapshot(),data=new Map(),cache={get:async k=>data.get(k),set:async(k,v)=>data.set(k,v)};
 await ingestVerification(Readable.from([JSON.stringify(p)]),cache);const status=await verificationStatus(cache);assert.equal(status.schedulerHealth,'READY');assert.equal(status.snapshot.planId,verificationPlan.id);assert.equal(status.sessions[4].startKST,'2026-11-02 05:00');
 assert.throws(()=>validateCheckpoint({...p,token:'private'}),/Forbidden/);assert.throws(()=>validateCheckpoint({...p,planDigest:'wrong'}));
 const forged=structuredClone(p);forged.tasks.drill.result={result:'LIVE_TIMING_VERIFIED'};assert.throws(()=>validateCheckpoint(forged),/cannot verify/);
 await assert.rejects(()=>ingestVerification(Readable.from([Buffer.alloc(1024*1024+1)]),cache),/too large/);await s.close();
});
