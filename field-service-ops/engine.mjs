export const JOB_STATUS = Object.freeze({ REQUESTED:'REQUESTED', SCHEDULED:'SCHEDULED', DISPATCHED:'DISPATCHED', ON_SITE:'ON_SITE', COMPLETED:'COMPLETED', CANCELLED:'CANCELLED', NO_SHOW:'NO_SHOW' });
export const PRIORITY = Object.freeze({ NORMAL:'NORMAL', URGENT:'URGENT' });
export const ACTIVE_SLOT_STATUSES = Object.freeze([JOB_STATUS.SCHEDULED, JOB_STATUS.DISPATCHED, JOB_STATUS.ON_SITE]);

const txt=v=>String(v??'').trim();
const num=v=>Number(v);
const clone=v=>structuredClone(v);

export function validateJobInput(input){
  const customerName=txt(input?.customerName), address=txt(input?.address), summary=txt(input?.summary);
  const priority=txt(input?.priority||'NORMAL').toUpperCase();
  if(customerName.length<2||customerName.length>80) throw new Error('customerName must be 2-80 characters');
  if(address.length<5||address.length>180) throw new Error('address must be 5-180 characters');
  if(summary.length<5||summary.length>300) throw new Error('summary must be 5-300 characters');
  if(!Object.values(PRIORITY).includes(priority)) throw new Error('unsupported priority');
  return {customerName,address,summary,priority};
}

export function validateSlot(startAt,endAt){
  const start=new Date(startAt), end=new Date(endAt);
  if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())) throw new Error('startAt and endAt must be valid ISO dates');
  const duration=end-start;
  if(duration<=0||duration>8*60*60*1000) throw new Error('service slot must be greater than 0 and at most 8 hours');
  return {startAt:start.toISOString(),endAt:end.toISOString()};
}

export function overlaps(aStart,aEnd,bStart,bEnd){ return new Date(aStart)<new Date(bEnd)&&new Date(bStart)<new Date(aEnd); }
export function assertExpectedVersion(job,expectedVersion){ const n=num(expectedVersion); if(!Number.isInteger(n)||n<1) throw new Error('expectedVersion must be a positive integer'); if(job.version!==n) throw new Error(`STALE_JOB_VERSION:${n}:${job.version}`); }

export function createJob(input,meta={}){
  const normalized=validateJobInput(input);
  return {id:Number(meta.id),...normalized,status:JOB_STATUS.REQUESTED,agentId:null,startAt:null,endAt:null,version:1,overrideReason:null,createdAt:txt(meta.createdAt),updatedAt:txt(meta.createdAt)};
}

function changed(job,patch,timestamp=''){ return {...job,...patch,version:job.version+1,updatedAt:timestamp||job.updatedAt}; }

export function scheduleJob(job,input,timestamp=''){
  if(![JOB_STATUS.REQUESTED,JOB_STATUS.SCHEDULED].includes(job.status)) throw new Error('job cannot be scheduled from current state');
  const agentId=Number(input?.agentId); if(!Number.isInteger(agentId)||agentId<1) throw new Error('agentId must be a positive integer');
  const slot=validateSlot(input?.startAt,input?.endAt);
  return changed(job,{status:JOB_STATUS.SCHEDULED,agentId,...slot,overrideReason:input?.overrideReason?txt(input.overrideReason).slice(0,200):null},timestamp);
}

export function dispatchJob(job,timestamp=''){ if(job.status!==JOB_STATUS.SCHEDULED) throw new Error('only scheduled jobs can be dispatched'); return changed(job,{status:JOB_STATUS.DISPATCHED},timestamp); }
export function arriveOnSite(job,timestamp=''){ if(job.status!==JOB_STATUS.DISPATCHED) throw new Error('only dispatched jobs can become on-site'); return changed(job,{status:JOB_STATUS.ON_SITE},timestamp); }
export function completeJob(job,timestamp=''){ if(job.status!==JOB_STATUS.ON_SITE) throw new Error('only on-site jobs can be completed'); return changed(job,{status:JOB_STATUS.COMPLETED},timestamp); }
export function cancelJob(job,timestamp=''){ if([JOB_STATUS.COMPLETED,JOB_STATUS.CANCELLED,JOB_STATUS.NO_SHOW].includes(job.status)) throw new Error('terminal jobs cannot be cancelled'); return changed(job,{status:JOB_STATUS.CANCELLED},timestamp); }
export function markNoShow(job,timestamp=''){ if(![JOB_STATUS.SCHEDULED,JOB_STATUS.DISPATCHED].includes(job.status)) throw new Error('only scheduled or dispatched jobs can be no-show'); return changed(job,{status:JOB_STATUS.NO_SHOW},timestamp); }

export function allowedActions(job){
  if(job.status===JOB_STATUS.REQUESTED) return ['SCHEDULE','CANCEL'];
  if(job.status===JOB_STATUS.SCHEDULED) return ['RESCHEDULE','REASSIGN','DISPATCH','NO_SHOW','CANCEL'];
  if(job.status===JOB_STATUS.DISPATCHED) return ['ON_SITE','NO_SHOW','CANCEL'];
  if(job.status===JOB_STATUS.ON_SITE) return ['COMPLETE','CANCEL'];
  return [];
}

export function computeMetrics(jobs){
  const active=jobs.filter(j=>![JOB_STATUS.COMPLETED,JOB_STATUS.CANCELLED,JOB_STATUS.NO_SHOW].includes(j.status)).length;
  const scheduled=jobs.filter(j=>j.status===JOB_STATUS.SCHEDULED).length;
  const dispatched=jobs.filter(j=>j.status===JOB_STATUS.DISPATCHED).length;
  const onSite=jobs.filter(j=>j.status===JOB_STATUS.ON_SITE).length;
  const urgent=jobs.filter(j=>j.priority===PRIORITY.URGENT&&![JOB_STATUS.COMPLETED,JOB_STATUS.CANCELLED].includes(j.status)).length;
  const completed=jobs.filter(j=>j.status===JOB_STATUS.COMPLETED).length;
  return {active,scheduled,dispatched,onSite,urgent,completed};
}

export function snapshotJob(job){ return clone({...job,allowedActions:allowedActions(job)}); }
