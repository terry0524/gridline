import fs from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {getData,historicalTTL,cacheDir} from '../src/provider.js';
import {pagedResults} from '../src/season-service.js';
import {batchCandidates} from '../src/replay-batch.js';
import {startReplay,replayStatus} from '../src/replay-loader.js';
import {replayManifest,clearReplayMemory,replayFile} from '../src/replay-store.js';
import {validateLibrary} from '../src/replay-library.js';
const args=process.argv.slice(2),v=k=>args[args.indexOf(k)+1];
const currentYear=new Date().getFullYear();
const years=(args.includes('--years')?v('--years'):Array.from({length:currentYear-2022},(_,i)=>currentYear-i).join(',')).split(',').map(Number);
if(years.some(y=>!Number.isInteger(y)||y<2023||y>new Date().getFullYear()))throw Error('Invalid years');
const publish=args.includes('--publish'),limit=args.includes('--limit')?Number(v('--limit')):Infinity;
const dir=path.join(cacheDir,'replay-expansion');await fs.mkdir(dir,{recursive:true});
const progress={startedAt:new Date().toISOString(),years,completed:[],failed:[],unmatched:[],current:null};
const save=()=>fs.writeFile(path.join(dir,'progress.json'),JSON.stringify(progress,null,2));
const gh=(...a)=>execFileSync('gh',a,{stdio:['ignore','pipe','pipe'],encoding:'utf8'});
let library={version:1,schemaVersion:4,updatedAt:null,replays:[]};
if(publish){
 try{gh('release','view','replay-library-v1','--repo','terry0524/gridline');}catch{gh('release','create','replay-library-v1','--repo','terry0524/gridline','--title','Verified historical replay library','--notes','Normalized OpenF1 historical race data. Only validated sessions are listed. Existing data attribution and non-commercial/share-alike terms in NOTICE.md apply. No raw captures, tokens or audio/video.');}
 const remote=JSON.parse(gh('release','view','replay-library-v1','--repo','terry0524/gridline','--json','assets'));
 if(remote.assets.length){
  const dest=path.join(dir,'previous');await fs.mkdir(dest,{recursive:true});let loaded=false;
  for(let attempt=0;attempt<5;attempt++){try{gh('release','download','replay-library-v1','--repo','terry0524/gridline','--pattern','library-v1.json','--dir',dest,'--clobber');library=validateLibrary(JSON.parse(await fs.readFile(path.join(dest,'library-v1.json'))));loaded=true;break;}catch{await new Promise(r=>setTimeout(r,3000));}}
  if(!loaded)throw Error('Cannot safely resume: existing replay library index unavailable');
 }
}
let count=0;
for(const year of years){
 const [sessionEnv,results]=await Promise.all([getData('openf1','sessions',{year},historicalTTL),pagedResults(year,'results')]);
 const {candidates,unmatched}=batchCandidates(year,sessionEnv.data,results.races);progress.unmatched.push(...unmatched);
 if(args.includes('--include-sprints')){const sprintResults=await pagedResults(year,'sprint'),sprints=batchCandidates(year,sessionEnv.data,sprintResults.races,'sprint');candidates.push(...sprints.candidates);progress.unmatched.push(...sprints.unmatched);}
 console.log(`${year}: ${candidates.length} ended race candidates; ${unmatched.length} unavailable/ambiguous`);
 for(const context of candidates){
  if(count>=limit)break;const key=context.session.session_key;const existing=(await replayManifest()).replays.find(r=>r.sessionKey===key);
  if(library.replays.some(r=>r.sessionKey===key))continue;
  // Preserve the original three pinned regression snapshots unchanged.
  if(existing&&[9472,9523,9574].includes(key))continue;
  progress.current={year,round:context.meeting.round,key,name:context.meeting.name};await save();
  try{
   if(!existing){await startReplay(key,{context});let status,last;do{status=await replayStatus(key);const label=`${status.stage}: ${status.message}`;if(label!==last){console.log(year,key,label);last=label;}if(status.status==='loading')await new Promise(r=>setTimeout(r,1000));}while(status.status==='loading');if(status.status!=='ready')throw Error(status.message);}
   const record=(await replayManifest()).replays.find(r=>r.sessionKey===key);if(!record)throw Error('No validated replay cache');
   if(publish){
    const name=`${year}-${key}-v4.json.gz`,file=path.join(dir,name);await fs.copyFile(replayFile(year,key),file);
    gh('release','upload','replay-library-v1',file,'--repo','terry0524/gridline','--clobber');
    library.replays=library.replays.filter(r=>r.sessionKey!==key);library.replays.push(record);library.updatedAt=new Date().toISOString();
    validateLibrary(library);const index=path.join(dir,'library-v1.json');await fs.writeFile(index,JSON.stringify(library,null,2));gh('release','upload','replay-library-v1',index,'--repo','terry0524/gridline','--clobber');
   }
   progress.completed.push(record);console.log(`READY ${year} ${context.meeting.name}: ${record.validation}, ${record.locations} locations`);count++;
  }catch(e){progress.failed.push({...progress.current,error:e.message});console.error(`FAILED ${year} ${key}: ${e.message}`);}
  clearReplayMemory();global.gc?.();await save();
 }
 if(count>=limit)break;
}
progress.current=null;progress.endedAt=new Date().toISOString();await save();console.log(JSON.stringify({added:progress.completed.length,failed:progress.failed.length,unmatched:progress.unmatched.length}));
