import { ACTIVE_SLOT_STATUSES, JOB_STATUS, PRIORITY, assertExpectedVersion, arriveOnSite, cancelJob, completeJob, computeMetrics, createJob, dispatchJob, markNoShow, overlaps, scheduleJob, snapshotJob } from '../engine.mjs';

export class DomainError extends Error{constructor(statusCode,code,message){super(message);this.name='DomainError';this.statusCode=statusCode;this.code=code;}}
const clone=v=>structuredClone(v); const nowIso=()=>new Date().toISOString();
function mapError(error){const m=error instanceof Error?error.message:String(error);if(m.startsWith('STALE_JOB_VERSION:'))return new DomainError(409,'STALE_JOB',m);if(/expectedVersion/.test(m))return new DomainError(400,'EXPECTED_VERSION_REQUIRED',m);return new DomainError(409,'INVALID_JOB_ACTION',m);}

export function createStore(){
 const seeded='2026-09-06T00:00:00.000Z';
 const state={jobSeq:5,auditSeq:8,agents:[
  {id:1,name:'Agent A',region:'Central',active:true},{id:2,name:'Agent B',region:'East',active:true},{id:3,name:'Agent C',region:'West',active:true}
 ],jobs:[
  {id:1,customerName:'Alpha Office',address:'10 Central Ave',summary:'Routine equipment inspection',priority:PRIORITY.NORMAL,status:JOB_STATUS.SCHEDULED,agentId:1,startAt:'2026-09-07T00:00:00.000Z',endAt:'2026-09-07T01:00:00.000Z',version:2,overrideReason:null,createdAt:seeded,updatedAt:seeded},
  {id:2,customerName:'Beta Lab',address:'25 East Street',summary:'Urgent service interruption check',priority:PRIORITY.URGENT,status:JOB_STATUS.DISPATCHED,agentId:2,startAt:'2026-09-07T01:00:00.000Z',endAt:'2026-09-07T03:00:00.000Z',version:3,overrideReason:null,createdAt:seeded,updatedAt:seeded},
  {id:3,customerName:'Gamma Studio',address:'31 West Road',summary:'Installation follow-up visit',priority:PRIORITY.NORMAL,status:JOB_STATUS.REQUESTED,agentId:null,startAt:null,endAt:null,version:1,overrideReason:null,createdAt:seeded,updatedAt:seeded},
  {id:4,customerName:'Delta Retail',address:'44 Market Lane',summary:'Final commissioning verification',priority:PRIORITY.NORMAL,status:JOB_STATUS.ON_SITE,agentId:3,startAt:'2026-09-07T02:00:00.000Z',endAt:'2026-09-07T04:00:00.000Z',version:4,overrideReason:null,createdAt:seeded,updatedAt:seeded}
 ],audits:[
  {id:1,jobId:1,actor:'dispatcher',action:'SCHEDULE',detail:'Agent A',jobVersion:2,createdAt:seeded},
  {id:2,jobId:2,actor:'dispatcher',action:'SCHEDULE',detail:'Agent B',jobVersion:2,createdAt:seeded},
  {id:3,jobId:2,actor:'dispatcher',action:'DISPATCH',detail:'',jobVersion:3,createdAt:seeded},
  {id:4,jobId:4,actor:'dispatcher',action:'SCHEDULE',detail:'Agent C',jobVersion:2,createdAt:seeded},
  {id:5,jobId:4,actor:'dispatcher',action:'DISPATCH',detail:'',jobVersion:3,createdAt:seeded},
  {id:6,jobId:4,actor:'field-agent',action:'ON_SITE',detail:'',jobVersion:4,createdAt:seeded},
  {id:7,jobId:3,actor:'system',action:'CREATE',detail:'unassigned request',jobVersion:1,createdAt:seeded}
 ]};
 const findJob=id=>state.jobs.find(j=>j.id===Number(id));
 const requireJob=id=>{const job=findJob(id);if(!job)throw new DomainError(404,'JOB_NOT_FOUND','job not found');return job;};
 const requireAgent=id=>{const a=state.agents.find(x=>x.id===Number(id)&&x.active);if(!a)throw new DomainError(404,'AGENT_NOT_FOUND','active field agent not found');return a;};
 const audit=(job,action,actor,detail='')=>state.audits.push({id:state.auditSeq++,jobId:job.id,actor:String(actor||'ops-user').slice(0,80),action,detail:String(detail||'').slice(0,300),jobVersion:job.version,createdAt:nowIso()});
 const replace=next=>{state.jobs[state.jobs.findIndex(j=>j.id===next.id)]=next;return next;};
 function assertVersion(job,v){try{assertExpectedVersion(job,v);}catch(e){throw mapError(e);}}
 function conflicts(jobId,agentId,startAt,endAt){return state.jobs.filter(j=>j.id!==Number(jobId)&&j.agentId===Number(agentId)&&ACTIVE_SLOT_STATUSES.includes(j.status)&&overlaps(startAt,endAt,j.startAt,j.endAt));}
 function plan(id,input={},action='SCHEDULE'){
  const job=requireJob(id);assertVersion(job,input.expectedVersion);const agent=requireAgent(input.agentId);let next;
  try{next=scheduleJob(clone(job),input,nowIso());}catch(e){throw mapError(e);}
  const hit=conflicts(job.id,agent.id,next.startAt,next.endAt);
  if(hit.length){
   const role=String(input.role||'STAFF').toUpperCase();const reason=String(input.overrideReason||'').trim();
   if(job.priority!==PRIORITY.URGENT||role!=='ADMIN'||reason.length<5) throw new DomainError(409,'SLOT_CONFLICT',`agent already has ${hit.length} overlapping active job(s)`);
   next.overrideReason=reason.slice(0,200);
   audit(next,'SCHEDULE_OVERRIDE',input.actor||'demo-admin',`conflict with ${hit.map(x=>`#${x.id}`).join(', ')} · ${next.overrideReason}`);
  }
  replace(next);audit(next,action,input.actor,`${agent.name} · ${next.startAt} → ${next.endAt}`);return snapshotJob(next);
 }
 function mutate(id,input,action,fn){const job=requireJob(id);assertVersion(job,input?.expectedVersion);let next;try{next=fn(clone(job),nowIso());}catch(e){throw mapError(e);}replace(next);audit(next,action,input?.actor);return snapshotJob(next);}
 return {
  listAgents(){return state.agents.map(clone);},
  listJobs(filters={}){const q=String(filters.query||'').trim().toLowerCase(),status=String(filters.status||''),priority=String(filters.priority||''),agentId=filters.agentId?Number(filters.agentId):null;return state.jobs.filter(j=>!q||[j.customerName,j.address,j.summary].some(v=>v.toLowerCase().includes(q))).filter(j=>!status||j.status===status).filter(j=>!priority||j.priority===priority).filter(j=>!agentId||j.agentId===agentId).map(snapshotJob);},
  getJob(id){return snapshotJob(requireJob(id));},
  listAudits(jobId=null){return state.audits.filter(a=>jobId===null||a.jobId===Number(jobId)).map(clone).reverse();},
  metrics(){return computeMetrics(state.jobs);},
  createJob(input,actor='ops-user'){let job;try{job=createJob(input,{id:state.jobSeq++,createdAt:nowIso()});}catch(e){throw new DomainError(400,'INVALID_JOB',e instanceof Error?e.message:'invalid job');}state.jobs.push(job);audit(job,'CREATE',actor,job.summary);return snapshotJob(job);},
  schedule(id,input){return plan(id,input,'SCHEDULE');},
  reschedule(id,input){return plan(id,input,'RESCHEDULE');},
  reassign(id,input){return plan(id,input,'REASSIGN');},
  dispatch(id,input={}){return mutate(id,input,'DISPATCH',dispatchJob);},
  onSite(id,input={}){return mutate(id,input,'ON_SITE',arriveOnSite);},
  complete(id,input={}){return mutate(id,input,'COMPLETE',completeJob);},
  cancel(id,input={}){return mutate(id,input,'CANCEL',cancelJob);},
  noShow(id,input={}){return mutate(id,input,'NO_SHOW',markNoShow);}
 };
}
