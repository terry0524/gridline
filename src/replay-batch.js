import {normalizeResults} from './season-model.js';
export function batchCandidates(year,sessions,races,kind='race'){
 const sessionName=kind==='sprint'?'Sprint':'Race';
 const meetings=normalizeResults(races,kind);const candidates=[],unmatched=[];
 for(const meeting of meetings){
  if(!meeting.results.length||!meeting.start||meeting.start>Date.now())continue;
  const matches=sessions.filter(s=>s.session_name===sessionName&&s.year===year&&Date.parse(s.date_end)<Date.now()-1800000&&Math.abs(Date.parse(s.date_start)-meeting.start)<2*86400000);
  if(matches.length!==1){unmatched.push({season:year,round:meeting.round,grandPrix:meeting.name,reason:matches.length?'Ambiguous session':'No ended OpenF1 Race session'});continue;}
  const winner=meeting.results.find(r=>r.position===1),fast=meeting.results.find(r=>r.fastest?.rank===1),parts=fast?.fastest.time?.split(':');
  candidates.push({session:matches[0],meeting,official:{source:`https://api.jolpi.ca/ergast/f1/${year}/${meeting.round}/${kind==='sprint'?'sprint':'results'}.json`,drivers:meeting.results.length,laps:winner?.laps,fastest:parts?{driver:fast.driver.abbreviation,seconds:Number(parts[0])*60+Number(parts[1]),lap:fast.fastest.lap}:null}});
 }
 return{candidates:candidates.sort((a,b)=>b.meeting.round-a.meeting.round),unmatched};
}
