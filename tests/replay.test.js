import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {getReplay} from '../src/replay-loader.js';
import {raceStateAt,locationAt,trackProjector,normalizeReplay} from '../src/race-model.js';
import {cacheDir,isHistorical} from '../src/provider.js';
const dataset=await getReplay(9472);assert.ok(dataset,'Run npm run import:replay first; these tests require real OpenF1 data.');
const at=p=>dataset.session.start+(dataset.session.end-dataset.session.start)*p/100;
// Read this fixture's exact archives, not every unrelated race imported later.
const provenanceURLs=new Set([...dataset.provenance.map(p=>p.url),'https://api.jolpi.ca/ergast/f1/2024/1/results.json?limit=100']);
const envelopes=await Promise.all([...provenanceURLs].map(async url=>{const key=createHash('sha256').update(url).digest('hex');return JSON.parse(gunzipSync(await fs.readFile(path.join(cacheDir,'upstream',key+'.json.gz'))));}));
test('real Bahrain dataset: complete field, 20 drivers, increasing observed timestamps',()=>{
 assert.equal(dataset.session.key,9472);assert.equal(dataset.drivers.length,20);assert.ok(dataset.quality.locationCount>400000);
 for(const d of dataset.drivers){assert.ok(d.locations.length>10000);for(let i=1;i<d.locations.length;i++)assert.ok(d.locations[i][0]>d.locations[i-1][0]);}
 assert.deepEqual(dataset.quality.invalid,{});assert.deepEqual(dataset.quality.unavailable,[]);
});
test('every provenance hash matches actual persisted upstream response',()=>{
 for(const p of dataset.provenance){const e=envelopes.find(e=>e.url===p.url);assert.ok(e,p.url);assert.equal(createHash('sha256').update(JSON.stringify(e.data)).digest('hex'),p.sha256);}
});
test('fastest lap appears after completion, matches Jolpica final classification',()=>{
 const final=raceStateAt(dataset,at(100));assert.equal(final.fastestLap.number,1);assert.equal(final.fastestLap.lap,39);assert.equal(final.fastestLap.seconds,92.608);
 const official=envelopes.find(e=>e.url.includes('/2024/1/results.json'));assert.ok(official,'Jolpica comparison source required');
 const winner=official.data.MRData.RaceTable.Races[0].Results.find(r=>r.FastestLap?.rank==='1');assert.equal(winner.Driver.code,final.fastestLap.driver);assert.equal(Number(winner.FastestLap.lap),39);assert.equal(winner.FastestLap.Time.time,'1:32.608');
 assert.notEqual(raceStateAt(dataset,final.fastestLap.completedAt-1).fastestLap?.seconds,92.608);assert.equal(raceStateAt(dataset,final.fastestLap.completedAt).fastestLap.seconds,92.608);
});
test('reverse seek removes future laps, pits, weather and race control',()=>{
 const early=raceStateAt(dataset,at(10));raceStateAt(dataset,at(100));assert.deepEqual(raceStateAt(dataset,at(10)),early);
 assert.equal(raceStateAt(dataset,at(0)).fastestLap,null);
 for(const pct of [0,10,40,70,100]){const s=raceStateAt(dataset,at(pct));assert.ok(s.weather.at<=s.timestamp);assert.ok(s.control.every(e=>e.at<=s.timestamp));for(const d of s.drivers){if(d.positionAt)assert.ok(d.positionAt<=s.timestamp);if(d.gapAt)assert.ok(d.gapAt<=s.timestamp);}}
});
test('pit events and stint compound/age change at recorded times',()=>{
 const driver=dataset.drivers.find(d=>d.number===1),pit=driver.pits[0];const a=raceStateAt(dataset,pit.at-1).drivers.find(d=>d.number===1),b=raceStateAt(dataset,pit.at+1).drivers.find(d=>d.number===1);
 assert.equal(b.pitStops,a.pitStops+1);assert.equal(b.pitStatus,'PIT EVENT');
 const start=raceStateAt(dataset,at(0)).drivers.find(d=>d.number===1);assert.equal(start.compound,'SOFT');assert.equal(start.tyreAge,3);
 const mid=raceStateAt(dataset,at(40)).drivers.find(d=>d.number===1);assert.equal(mid.compound,'HARD');assert.ok(mid.tyreAge>=0);
});
test('interpolation uses bracketing actual samples; no future extrapolation or gap bridging',()=>{
 const rows=dataset.drivers[0].locations,i=100;const a=rows[i],b=rows[i+1];const m=locationAt(rows,(a[0]+b[0])/2);assert.ok(m.interpolated);assert.ok(Math.abs(m.x-(a[1]+b[1])/2)<1e-9);assert.equal(locationAt(rows,rows[0][0]-1),null);
 assert.equal(locationAt([a,[a[0]+10000,b[1],b[2]]],a[0]+1000).interpolated,false);assert.equal(locationAt([a],a[0]+6000),null);
});
test('timing retains drivers when location unavailable; missing weather remains unavailable',()=>{
 const altered={...dataset,drivers:dataset.drivers.map(d=>({...d,locations:[]})),weather:[]};const s=raceStateAt(altered,at(50));assert.equal(s.drivers.length,20);assert.ok(s.drivers.every(d=>d.location===null));assert.equal(s.weather,null);
});
test('all-driver track consistency: measured reference lap, common projection, p95 within 7 SVG px',()=>{
 const project=trackProjector(dataset.track),points=dataset.track.points.map(p=>project(...p)),errors=[];
 for(const d of dataset.drivers)for(let i=0;i<d.locations.length;i+=50){const p=project(d.locations[i][1],d.locations[i][2]);errors.push(Math.min(...points.map(q=>Math.hypot(p[0]-q[0],p[1]-q[1]))));}
 errors.sort((a,b)=>a-b);const p95=errors[Math.floor(errors.length*.95)];console.log(`Alignment: ${errors.length} observed samples, p95=${p95.toFixed(3)} SVG pixels`);assert.ok(p95<7);assert.equal(dataset.track.corners.length,15);
});
test('live access boundary requires a ended session plus 30 minutes',()=>{
 const s={date_end:'2024-03-02T17:00:00Z'};assert.equal(isHistorical(s,Date.parse(s.date_end)+30*60000),false);assert.equal(isHistorical(s,Date.parse(s.date_end)+30*60000+1),true);assert.equal(isHistorical({}),false);
});
