import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import {F1StateAdapter} from '../src/live/f1-adapter.js';
import {FrameDecoder,encodeFrame,mergePatch,decodeTopic,FREE_TOPICS,parseUtc} from '../src/live/protocol.js';
import {ReplayStreamSource} from '../src/live/simulation.js';
import {RaceStreamService} from '../src/live/service.js';
import {getReplay} from '../src/replay-loader.js';
import {raceStateAt,locationAt} from '../src/race-model.js';
const fixture=JSON.parse(await fs.readFile(new URL('./fixtures/observed-core-snapshot.json',import.meta.url)));
const position=JSON.parse(await fs.readFile(new URL('./fixtures/historical-position.z.json',import.meta.url)));
const car=JSON.parse(await fs.readFile(new URL('./fixtures/historical-car.z.json',import.meta.url)));
const dataset=await getReplay(9472);assert.ok(dataset,'Real Bahrain cache required');
test('observed anonymous Core snapshot normalizes real timing/weather and never labels a finished race live',()=>{
 const adapter=new F1StateAdapter();adapter.snapshot(fixture.data);const s=adapter.toRaceState();
 assert.equal(s.session.key,11388);assert.equal(s.drivers.length,22);assert.equal(s.active,false);assert.equal(s.connection,'OFFLINE');
 assert.equal(s.session.start,Date.parse('2026-10-11T12:00:00Z'));assert.equal(s.session.currentLap,62);assert.equal(s.weather.air,30.2);assert.equal(s.weather.track,41.5);assert.equal(s.weather.at,null);
 assert.equal(s.fastestLap.driver,'LEC');assert.equal(s.fastestLap.seconds,95.202);assert.equal(s.fastestLap.lap,41);assert.equal(s.capabilities.position,false);assert.equal(s.capabilities.telemetry,false);
 const line=fixture.data.TimingData.Lines['3'];const d=s.drivers.find(d=>d.number===3);assert.equal(d.position,Number(line.Position));assert.equal(d.pitStops,line.NumberOfPitStops);assert.ok(s.control.every(e=>e.at<=s.timestamp));assert.ok(s.drivers.flatMap(d=>d.radio).every(r=>r.url.startsWith('https://livetiming.formula1.com/static/')));
 assert.ok(!FREE_TOPICS.includes('Position.z'));assert.ok(!FREE_TOPICS.includes('CarData.z'));
});
test('actual public historical compressed channels decode into measured coordinates/telemetry, without claiming live entitlement',()=>{
 const p=decodeTopic('Position.z',position),c=decodeTopic('CarData.z',car);assert.equal(p.topic,'Position');assert.equal(c.topic,'CarData');
 const adapter=new F1StateAdapter();adapter.snapshot(fixture.data);adapter.ingest('Position.z',position,'2024-03-02T16:39:15Z');adapter.ingest('CarData.z',car,'2024-03-02T16:39:15Z');
 assert.equal(adapter.locationHistory.size,20);assert.equal(adapter.carData.size,20);const first=p.data.Position[0];const firstNumber=Object.keys(first.Entries)[0];assert.equal(adapter.locationHistory.get(Number(firstNumber))[0][1],first.Entries[firstNumber].X);assert.equal(adapter.carData.get(1).speed,0);
 assert.throws(()=>decodeTopic('Position.z','not-valid-deflate'));
});
test('Hub frame fragmentation and deep numeric-index patches preserve prior real snapshot; unsafe patches rejected',()=>{
 const decoder=new FrameDecoder(),wire=encodeFrame({type:1,target:'feed',arguments:['WeatherData',{AirTemp:'31.1'},'2026-10-12T00:00:00Z']});assert.deepEqual(decoder.push(wire.slice(0,20)),[]);assert.equal(decoder.push(wire.slice(20))[0].target,'feed');
 assert.deepEqual(mergePatch([{a:1},{a:2}],{'1':{b:3}}),[{a:1},{a:2,b:3}]);assert.throws(()=>mergePatch([],{'100001':1}));assert.equal(mergePatch({},JSON.parse('{"__proto__":{"polluted":true}}')).polluted,undefined);
 const a=new F1StateAdapter();a.snapshot(fixture.data);a.ingest('WeatherData',{AirTemp:'31.1'},'2026-10-12T00:00:00Z');assert.equal(a.toRaceState().weather.track,41.5);assert.equal(a.toRaceState().weather.air,31.1);assert.equal(a.ingest('WeatherData',{AirTemp:'1.0'},'2026-10-11T00:00:00Z'),false);assert.equal(parseUtc('2026-10-12T00:00:00'),Date.parse('2026-10-12T00:00:00Z'));
});
test('actual Bahrain simulation clock, controls, reverse seek and shared fastest-lap engine',()=>{
 let now=0;const source=new ReplayStreamSource(dataset,new Map(),()=>now);now=1000;assert.equal(source.timestamp(),dataset.session.start+1000);source.control('speed',8);now=2000;assert.equal(source.timestamp(),dataset.session.start+9000);source.control('pause');now=3000;assert.equal(source.timestamp(),dataset.session.start+9000);
 source.control('seek',100);const final=source.state();assert.equal(final.mode,'simulated-live');assert.equal(final.fastestLap.seconds,92.608);assert.equal(final.fastestLap.lap,39);assert.equal(final.session.totalLaps,57);assert.equal(final.drivers.length,20);
 source.control('seek',10);const s=source.state(),r=raceStateAt(dataset,s.timestamp);assert.deepEqual(s.fastestLap,r.fastestLap);assert.deepEqual(s.control,r.control);assert.deepEqual(s.weather,r.weather);assert.ok(s.control.every(e=>e.at<=s.timestamp));assert.ok(s.drivers.every(d=>d.telemetry===null));assert.throws(()=>source.control('speed',3));
 const rows=dataset.drivers[0].locations;assert.equal(locationAt([rows[0]],rows[0][0]+60000,2000,true).x,rows[0][1]);
});
async function sse(url){const abort=new AbortController();const res=await fetch(url,{signal:abort.signal});assert.equal(res.status,200);const reader=res.body.getReader();let buffer='';return {abort,next:async event=>{for(;;){let end;while((end=buffer.indexOf('\n\n'))>=0){const msg=buffer.slice(0,end);buffer=buffer.slice(end+2);if(msg.includes(`event: ${event}\n`))return JSON.parse(msg.split('\ndata: ')[1]);}const r=await reader.read();if(r.done)return null;buffer+=new TextDecoder().decode(r.value);}},close:()=>{abort.abort();reader.cancel().catch(()=>{});}};}
test('10 real SSE clients share one actual Bahrain source; interrupted/reopened stream resumes full snapshot without clock reset',{timeout:15000},async()=>{
 const service=new RaceStreamService();const server=http.createServer((req,res)=>service.subscribe(req,res));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;const clients=[];
 try{await service.start('simulated-live',9472);service.control('pause');service.control('seek',75);for(let i=0;i<10;i++)clients.push(await sse(url));const frames=await Promise.all(clients.map(c=>c.next('race-state')));assert.equal(service.info().clients,10);assert.equal(service.info().sourceInstances,1);assert.equal(service.info().upstreamConnections,0);assert.ok(frames.every(f=>f.state.timestamp===frames[0].state.timestamp));assert.ok(frames.every(f=>f.state.drivers.length===20&&f.state.drivers.every(d=>d.location)));const generation=service.generation;await service.start('simulated-live',9472);assert.equal(service.generation,generation);
  service.control('interrupt');for(const c of clients)c.close();clients.length=0;const resumed=await sse(url);clients.push(resumed);const metadata=await resumed.next('metadata'),frame=await resumed.next('race-state');assert.equal(metadata.session.key,9472);assert.equal(frame.state.timestamp,frames[0].state.timestamp);assert.equal(frame.state.fastestLap.seconds,92.608);assert.equal(service.generation,generation);
 }finally{for(const c of clients)c.close();service.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('collector detaches closing socket before synchronous native error/close events can schedule again',async()=>{
 const {SignalRCollector}=await import('../src/live/collector.js');const c=new SignalRCollector();c.running=true;c.generation=1;let closes=0;const socket={close(){closes++;if(c.socket===socket)c.schedule(1,'synchronous close');}};c.socket=socket;c.schedule(1,'disconnect');assert.equal(closes,1);assert.equal(c.socket,null);assert.equal(c.phase,'RECONNECTING');assert.equal(c.activeConnections,0);c.stop();assert.equal(c.running,false);
});
