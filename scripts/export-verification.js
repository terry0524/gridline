import fs from 'node:fs/promises';
import {verificationPlan,planDigest,koreanTime} from '../src/live/verification-plan.js';
const now=Date.now(),first=Date.parse(verificationPlan.sessions[0].start),last=Date.parse(verificationPlan.sessions.at(-1).end);
if(now<first-7*86400000||now>last+7*86400000){console.log('Outside this one-off evidence export period; no request made.');process.exit(0);}
const response=await fetch('https://gridline-indol.vercel.app/api/live/verification',{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Verification evidence API HTTP '+response.status);
const data=await response.json();if(data.planDigest!==planDigest||!data.snapshot)throw Error('No matching resident checkpoint; this is not a successful capture');
const dir='.cache/verification-export';await fs.mkdir(dir,{recursive:true});await fs.writeFile(dir+'/'+verificationPlan.id+'.json',JSON.stringify(data,null,2));
const rows=verificationPlan.sessions.map(s=>{const t=data.snapshot.tasks[s.id];return`| ${s.type} | ${koreanTime(s.start)} | ${t?.status??'NO CHECKPOINT'} | ${t?.result?.result??'Pending'} | ${t?.delayMs??'—'} |`;});
const markdown=`# ${verificationPlan.year} ${verificationPlan.meeting} verification\n\nResident scheduler: ${data.schedulerHealth}. GitHub exports evidence only; it does not trigger observation.\n\n| Session | Start KST | Scheduler status | Actual result | Start delay ms |\n| --- | --- | --- | --- | ---: |\n${rows.join('\n')}\n\nTransport drills do not verify active Live. Source capability absence is limited to each observed window. Runtime cache is ephemeral; this exported artifact preserves the returned checkpoint.\n`;
await fs.writeFile(dir+'/'+verificationPlan.id+'.md',markdown);if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,markdown);console.log(markdown);
if(data.schedulerHealth==='STALE')process.exitCode=2;
