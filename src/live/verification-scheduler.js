import {scheduledSessions,validatePlan} from './verification-plan.js';
import {createHash} from 'node:crypto';

// The resident process checks its own clock. Network jobs never trigger a start.
export class VerificationScheduler{
 constructor({plan,workerId,run,now=Date.now,saved=null,drillDelayMs=60000}){
  validatePlan(plan);Object.assign(this,{plan,workerId,run,now});this.planDigest=createHash('sha256').update(JSON.stringify(plan)).digest('hex');this.bootedAt=now();this.revision=0;this.closed=false;this.active=null;this.controller=null;
  this.tasks=Object.fromEntries(scheduledSessions(plan).map(s=>[s.id,{expected:s,scheduledAt:s.scheduledAt,status:'SCHEDULED',attempts:[]} ]));
  for(const [id,prior]of Object.entries(saved?.planId===plan.id&&saved.planDigest===this.planDigest?saved.tasks??{}:{})){
   if(!this.tasks[id])continue;
   if(['COMPLETE','MISSED'].includes(prior.status))this.tasks[id]={...prior,expected:this.tasks[id].expected,scheduledAt:this.tasks[id].scheduledAt};
   else if(prior.status==='RUNNING')this.tasks[id].attempts=[...(prior.attempts??[]),{result:'INTERRUPTED',reason:'Resident process restarted; previous observation is not claimed continuous'}];
  }
  this.tasks.drill={expected:{id:'drill',type:'Transport drill',year:plan.year,meetingNames:plan.meetingNames,meetingLabel:`${plan.year} ${plan.meeting} · TRANSPORT DRILL`,start:new Date(this.bootedAt+drillDelayMs).toISOString(),end:new Date(this.bootedAt+drillDelayMs+60000).toISOString()},scheduledAt:this.bootedAt+drillDelayMs,status:'SCHEDULED',attempts:[],drill:true};
 }
 snapshot(){return{version:1,planId:this.plan.id,planDigest:this.planDigest,workerId:this.workerId,bootedAt:this.bootedAt,heartbeatAt:this.now(),clock:'UTC epoch milliseconds',revision:this.revision,tasks:structuredClone(this.tasks)};}
 tick(){
  if(this.closed||this.active)return;
  const now=this.now();
  for(const task of Object.values(this.tasks)){
   if(task.status!=='SCHEDULED'||now<Math.max(task.scheduledAt,task.retryAt??0))continue;
   if(now>Date.parse(task.expected.end)-(task.drill?20000:600000)){
    task.status='MISSED';task.result={result:'NOT_VERIFIED',reason:'Resident process was unavailable for the observation window',checkedAt:new Date(now).toISOString()};this.revision++;continue;
   }
   task.status='RUNNING';task.actualStartedAt??=now;task.delayMs??=now-task.scheduledAt;task.latestStartedAt=now;this.revision++;
   this.controller=new AbortController();
   const work=Promise.resolve().then(()=>this.run(task.expected,{smoke:!!task.drill,signal:this.controller.signal,onProgress:progress=>{task.progress=progress;this.revision++;}})).then(result=>{
    const {evidence,...summary}=result;task.attempts.push(summary);task.result=result;task.status='COMPLETE';
    if(!task.drill&&result.result!=='LIVE_TIMING_VERIFIED'&&task.attempts.length<2&&this.now()+60000+this.plan.observationMs<=Date.parse(task.expected.end)){task.status='SCHEDULED';task.retryAt=this.now()+60000;}
    delete task.progress;this.revision++;
   }).catch(error=>{task.result={result:'NOT_VERIFIED',reason:'Observation task failed',errorType:error.name,checkedAt:new Date(this.now()).toISOString()};task.attempts.push(task.result);task.status='COMPLETE';this.revision++;}).finally(()=>{this.active=null;this.controller=null;});
   this.active=work;return;
  }
 }
 async close(){this.closed=true;this.controller?.abort();await this.active;}
}
