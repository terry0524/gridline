import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import http from 'node:http';import {Readable} from 'node:stream';
import {validateLibrary,remoteLibrary} from '../src/replay-library.js';
import {batchCandidates} from '../src/replay-batch.js';
import {SharedLiveService,relayAuthorized,validateRelayPacket,ingestRelay,decodeRelayCache,LIVE_CACHE_KEY} from '../src/live/shared-service.js';
test('library rejects unsafe identities and hash/size metadata',async()=>{
 const m=JSON.parse(await fs.readFile(new URL('../.cache/replays/manifest-v1.json',import.meta.url))),record=m.replays.find(r=>r.sessionKey===9472);
 const library={version:1,schemaVersion:4,replays:[record]};assert.equal(validateLibrary(library).replays[0].asset,'2024-9472-v4.json.gz');
 for(const change of [{season:'../../'},{sessionKey:-1},{sha256:'bad'},{bytes:100*1024*1024},{slug:'../../secret'}])assert.throws(()=>validateLibrary({...library,replays:[{...record,...change}]}));
 assert.throws(()=>validateLibrary({...library,replays:[record,record]}));
});
test('library refresh retries index replacement without reusing stale asset redirects',async()=>{
 const m=JSON.parse(await fs.readFile(new URL('../.cache/replays/manifest-v1.json',import.meta.url))),record=m.replays.find(r=>r.sessionKey===9472);
 const original=globalThis.fetch,enabled=process.env.GRIDLINE_REPLAY_LIBRARY,urls=[];process.env.GRIDLINE_REPLAY_LIBRARY='1';
 globalThis.fetch=async url=>{urls.push(url);return urls.length===1?new Response('',{status:404}):Response.json({version:1,schemaVersion:4,replays:[record]});};
 try{const result=await remoteLibrary();assert.equal(result.replays[0].sessionKey,9472);assert.equal(urls.length,2);assert.notEqual(urls[0],urls[1]);assert.match(urls[0],/library-v1\.json\?revision=/);await remoteLibrary();assert.equal(urls.length,2);}
 finally{globalThis.fetch=original;if(enabled===undefined)delete process.env.GRIDLINE_REPLAY_LIBRARY;else process.env.GRIDLINE_REPLAY_LIBRARY=enabled;}
});
test('bulk import matches only unambiguous ended races with published results',()=>{
 const race={season:'2024',round:'1',raceName:'Bahrain Grand Prix',date:'2024-03-02',time:'15:00:00Z',Results:[{position:'1',laps:'57',Driver:{driverId:'max_verstappen',code:'VER'},Constructor:{constructorId:'red_bull'},FastestLap:{rank:'1',lap:'39',Time:{time:'1:32.608'}}}]};
 const session={year:2024,session_key:9472,session_name:'Race',date_start:'2024-03-02T15:00:00Z',date_end:'2024-03-02T17:00:00Z'};
 const result=batchCandidates(2024,[session],[race]);assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].official.fastest.seconds,92.608);
 assert.equal(batchCandidates(2024,[session,{...session,session_key:9999}],[race]).candidates.length,0);
 assert.equal(batchCandidates(2024,[session],[{...race,Results:[]}]).candidates.length,0);
 assert.equal(batchCandidates(2024,[{...session,date_end:'2099-01-01'}],[race]).candidates.length,0);
});
const packet=()=>({version:1,workerId:'unit-test-worker',publishedAt:Date.now(),metadata:{mode:'live',session:{key:null},drivers:[],generation:1},state:{mode:'live',drivers:[],capabilities:{timing:false},connection:'RECONNECTING',health:{status:'RECONNECTING',sessionAvailability:'SESSION UNCONFIRMED',dataAgeMs:null}},collector:{upstreamConnections:0}});
test('relay authentication and bounds reject foreign or malformed producer data',async()=>{
 assert.equal(relayAuthorized('Bearer test-secret','test-secret'),true);assert.equal(relayAuthorized('Bearer other','test-secret'),false);assert.equal(relayAuthorized('',undefined),false);
 assert.throws(()=>validateRelayPacket({...packet(),publishedAt:Date.now()+120000}));assert.throws(()=>validateRelayPacket({...packet(),state:{mode:'replay'}}));
 const values=new Map(),cache={set:async(k,v)=>values.set(k,v)};await ingestRelay(Readable.from([JSON.stringify(packet())]),cache);assert.equal(decodeRelayCache(values.get(LIVE_CACHE_KEY)).state.mode,'live');
 await assert.rejects(()=>ingestRelay(Readable.from([Buffer.alloc(1024*1024+1)]),cache),/too large/);
});
test('shared live reader retains data and marks a missed collector heartbeat as reconnecting',async()=>{
 const p=packet();p.publishedAt-=40000;p.state.drivers=[{number:1,abbreviation:'VER'}];const service=new SharedLiveService({cache:{get:async()=>p}});
 await service.start('live');assert.equal(service.state.health.status,'RECONNECTING');assert.equal(service.state.drivers[0].number,1);assert.equal(service.state.active,false);service.close();
});
test('shared stream forwards late driver/track metadata and session changes without a collector restart',async()=>{
 const p=packet(),frames=[],service=new SharedLiveService({cache:{get:async()=>p}});
 service.clients.add({res:{write:wire=>frames.push(wire),end(){},writableLength:0}});
 try{
  await service.tick();const generation=service.generation;
  p.metadata={...p.metadata,session:{key:9472},drivers:[{number:1,abbreviation:'VER'}],track:{points:[[0,0],[1,1]]}};
  await service.tick();await service.tick();assert.equal(service.generation,generation);
  let metadata=frames.filter(f=>f.startsWith('event: metadata'));assert.equal(metadata.length,2);assert.ok(metadata[1].includes('9472'));assert.ok(metadata[1].includes('VER'));
  p.metadata={...p.metadata,session:{key:9523}};await service.tick();metadata=frames.filter(f=>f.startsWith('event: metadata'));assert.equal(metadata.length,3);assert.ok(metadata[2].includes('9523'));
 }finally{service.close();}
});
test('ten SSE clients share the reader and clean up on response close',async()=>{
 const p=packet(),cache={get:async()=>p};const service=new SharedLiveService({cache,intervalMs:30,leaseMs:2000});
 const server=http.createServer((req,res)=>service.subscribe(req,res)).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const requests=[];try{await Promise.all(Array.from({length:10},()=>new Promise((resolve,reject)=>{const req=http.get(`http://127.0.0.1:${server.address().port}`,res=>{let body='';res.on('data',b=>{body+=b;if(body.includes('event: race-state'))resolve();});});requests.push(req);req.on('error',reject);})));assert.equal(service.clients.size,10);assert.equal(service.info().sourceInstances,1);assert.equal(service.info().upstreamConnections,0);}
 finally{for(const req of requests)req.destroy();service.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
 assert.equal(service.clients.size,0);assert.equal(service.timer,null);
});
