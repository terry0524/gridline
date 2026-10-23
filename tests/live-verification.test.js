import test from 'node:test';import assert from 'node:assert/strict';
import {USGP_SESSIONS,selectSession,observationAllowed,newObservation,observeState,assessment,SSEFrames} from '../scripts/verify-live-session.js';
const expected=USGP_SESSIONS[0],begin=Date.parse(expected.start)+120000;
function state(at){return{mode:'live',active:true,session:{key:123,year:2026,name:'United States Grand Prix',type:'Practice 1',start:Date.parse(expected.start)},health:{status:'CONNECTED',sessionAvailability:'LIVE SESSION AVAILABLE',channels:{TimingData:{sourceTimestamp:at}}},drivers:[{number:1,abbreviation:'VER',position:1,currentLap:Math.floor((at-begin)/90000)+1,lastLap:90+(at%1000)/1000,compound:'SOFT',tyreAge:2,pitStops:0,location:null,telemetry:null,radio:[]}],weather:{air:25,track:35},control:[]};}
test('one-off session selection uses UTC windows and excludes other years',()=>{
 assert.equal(selectSession('auto',Date.parse('2026-10-23T17:25:00Z')).id,'fp1');assert.equal(selectSession('auto',Date.parse('2026-10-24T20:55:00Z')).id,'qualifying');assert.equal(selectSession('auto',Date.parse('2027-10-23T17:25:00Z')),null);assert.equal(selectSession('auto',Date.parse('2026-10-23T10:00:00Z')),null);
});
test('explicit cloud dispatch can wait up to three hours without widening automatic observation windows',()=>{
 const twoHoursEarly=Date.parse(expected.start)-2*3600000;
 assert.equal(observationAllowed(expected,twoHoursEarly,true),true);assert.equal(observationAllowed(expected,twoHoursEarly,false),false);
 assert.equal(observationAllowed(expected,Date.parse(expected.start)-3*3600000-1,true),false);
 assert.equal(observationAllowed(expected,Date.parse(expected.end),true),false);
});
test('handshake, repeated old snapshot, wrong session and simulated data cannot pass',()=>{
 for(const kind of ['stale','wrong','simulated']){const o=newObservation(expected);for(let i=0;i<=150;i++){const at=begin+i*5000,s=state(kind==='stale'?begin-60000:at);if(kind==='wrong')s.session.name='Singapore Grand Prix';if(kind==='simulated')s.mode='simulated-live';observeState(o,s,at);}assert.equal(assessment(o).result,'NOT_VERIFIED');}
 const o=newObservation(expected);for(let i=0;i<=150;i++)observeState(o,state(begin),begin+i*5000);assert.equal(assessment(o).result,'NOT_VERIFIED');
});
test('fresh changing real-session data passes after ten minutes; gaps and absent telemetry stay honest',()=>{
 const o=newObservation(expected);for(let i=0;i<=130;i++)observeState(o,state(begin+i*5000),begin+i*5000);
 const result=assessment(o);assert.equal(result.result,'LIVE_TIMING_VERIFIED');assert.equal(result.capabilities.position,false);assert.equal(result.capabilities.telemetry,false);assert.equal(result.capabilities.weather,true);assert.equal(assessment(o,{smoke:true}).result,'TRANSPORT_SMOKE_ONLY');
 const gap=newObservation(expected);for(let i=0;i<=130;i++){if(i===65)continue;const at=begin+i*5000;const s=state(at);if(i===64)s.health.status='STALE';observeState(gap,s,at);}assert.equal(assessment(gap).result,'NOT_VERIFIED');
});
test('SSE parser handles fragmented frames and evidence excludes audio URLs and tokens',()=>{
 const parser=new SSEFrames(),wire='event: race-state\ndata: '+JSON.stringify({state:state(begin)})+'\n\n',bytes=new TextEncoder().encode(wire);assert.deepEqual(parser.push(bytes.slice(0,27)),[]);assert.equal(parser.push(bytes.slice(27))[0].state.mode,'live');
 const o=newObservation(expected),s=state(begin);s.token='PRIVATE';s.drivers[0].radio=[{at:begin,url:'https://example.test/private.mp3?token=SECRET',reference:'PRIVATE'}];const saved=JSON.stringify(observeState(o,s,begin));assert.equal(saved.includes('SECRET'),false);assert.equal(saved.includes('PRIVATE'),false);assert.equal(saved.includes('private.mp3'),false);
});
