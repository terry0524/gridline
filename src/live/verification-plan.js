import {createHash} from 'node:crypto';

// Explicit UTC instants from the official event timetable; no local RRULE or cron.
export const verificationPlan={
 version:1,id:'mexico-2026',year:2026,meeting:'Mexico City Grand Prix',
 source:'https://www.formula1.com/en/racing/2026/mexico',
 meetingNames:['Mexico City Grand Prix','Mexican Grand Prix','Mexico Grand Prix'],
 observationMs:900000,offsetMs:120000,
 sessions:[
  {id:'fp1',type:'Practice 1',start:'2026-10-30T18:30:00Z',end:'2026-10-30T19:30:00Z'},
  {id:'fp2',type:'Practice 2',start:'2026-10-30T22:00:00Z',end:'2026-10-30T23:00:00Z'},
  {id:'fp3',type:'Practice 3',start:'2026-10-31T17:30:00Z',end:'2026-10-31T18:30:00Z'},
  {id:'qualifying',type:'Qualifying',start:'2026-10-31T21:00:00Z',end:'2026-10-31T22:00:00Z'},
  {id:'race',type:'Race',start:'2026-11-01T20:00:00Z',end:'2026-11-01T22:00:00Z'}
 ]
};
export function validatePlan(p){
 if(p?.version!==1||!/^[a-z0-9-]+$/.test(p.id)||!Number.isInteger(p.year)||!Array.isArray(p.meetingNames)||!p.meetingNames.length||!Array.isArray(p.sessions)||!p.sessions.length||p.observationMs<600000||p.observationMs>1800000||p.offsetMs<0||p.offsetMs>300000)throw Error('Invalid verification plan');
 const ids=new Set();for(const s of p.sessions){if(!/^[a-z0-9-]+$/.test(s.id)||ids.has(s.id)||typeof s.type!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(s.start)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(s.end)||!Number.isFinite(Date.parse(s.start))||!Number.isFinite(Date.parse(s.end))||Date.parse(s.end)-Date.parse(s.start)<p.offsetMs+p.observationMs)throw Error('Invalid verification session');ids.add(s.id);}
 return p;
}
validatePlan(verificationPlan);
export const planDigest=createHash('sha256').update(JSON.stringify(verificationPlan)).digest('hex');
export function scheduledSessions(plan=verificationPlan){return plan.sessions.map(s=>({...s,year:plan.year,meetingNames:plan.meetingNames,meetingLabel:`${plan.year} ${plan.meeting}`,scheduledAt:Date.parse(s.start)+plan.offsetMs}));}
export const koreanTime=at=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',dateStyle:'short',timeStyle:'short'}).format(new Date(at));
