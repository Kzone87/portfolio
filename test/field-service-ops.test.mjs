import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { overlaps, validateSlot, createJob, JOB_STATUS, computeMetrics } from '../field-service-ops/engine.mjs';
import { createFieldServiceServer } from '../field-service-ops/server/app.mjs';

async function withServer(run){const server=createFieldServiceServer();server.listen(0,'127.0.0.1');await once(server,'listening');const a=server.address();const base=`http://127.0.0.1:${a.port}`;try{await run(base);}finally{server.close();await once(server,'close');}}
async function request(base,path,options={}){const r=await fetch(`${base}${path}`,{...options,headers:{'content-type':'application/json',...(options.headers??{})}});return{response:r,body:await r.json()};}

test('slot validation and overlap use half-open interval semantics',()=>{
 const slot=validateSlot('2026-09-07T09:00:00+09:00','2026-09-07T10:00:00+09:00');
 assert.equal(slot.startAt,'2026-09-07T00:00:00.000Z');
 assert.equal(overlaps('2026-09-07T00:00:00Z','2026-09-07T01:00:00Z','2026-09-07T00:30:00Z','2026-09-07T01:30:00Z'),true);
 assert.equal(overlaps('2026-09-07T00:00:00Z','2026-09-07T01:00:00Z','2026-09-07T01:00:00Z','2026-09-07T02:00:00Z'),false);
});

test('new jobs start requested and metrics separate field states',()=>{
 const job=createJob({customerName:'Example Co',address:'100 Example Street',summary:'Generic field inspection',priority:'URGENT'},{id:10,createdAt:'2026-09-06T00:00:00Z'});
 assert.equal(job.status,JOB_STATUS.REQUESTED);assert.equal(job.agentId,null);assert.equal(job.version,1);
 assert.deepEqual(computeMetrics([job,{...job,id:11,status:'SCHEDULED',priority:'NORMAL'},{...job,id:12,status:'COMPLETED'}]),{active:2,scheduled:1,dispatched:0,onSite:0,urgent:1,completed:1});
});

test('HTTP API exposes agents, queue and operational metrics',async()=>withServer(async base=>{
 const health=await request(base,'/api/health');assert.equal(health.response.status,200);assert.equal(health.body.service,'field-service-ops');
 const agents=await request(base,'/api/agents');assert.equal(agents.body.items.length,3);
 const metrics=await request(base,'/api/metrics');assert.equal(metrics.body.scheduled,1);assert.equal(metrics.body.dispatched,1);assert.equal(metrics.body.onSite,1);assert.equal(metrics.body.urgent,1);
 const requested=await request(base,'/api/jobs?status=REQUESTED');assert.equal(requested.body.items.length,1);assert.equal(requested.body.items[0].customerName,'Gamma Studio');
}));

test('normal schedule conflict is rejected and leaves job unchanged',async()=>withServer(async base=>{
 const conflict=await request(base,'/api/jobs/3/schedule',{method:'POST',body:JSON.stringify({expectedVersion:1,agentId:1,startAt:'2026-09-07T00:30:00Z',endAt:'2026-09-07T01:30:00Z',actor:'dispatcher',role:'STAFF'})});
 assert.equal(conflict.response.status,409);assert.equal(conflict.body.error.code,'SLOT_CONFLICT');
 const job=await request(base,'/api/jobs/3');assert.equal(job.body.status,'REQUESTED');assert.equal(job.body.version,1);
}));

test('urgent job can override a slot conflict only with ADMIN and reason',async()=>withServer(async base=>{
 const created=await request(base,'/api/jobs',{method:'POST',body:JSON.stringify({customerName:'Urgent Client',address:'77 Emergency Avenue',summary:'Urgent field response required',priority:'URGENT',actor:'dispatcher'})});
 assert.equal(created.response.status,201);
 const id=created.body.id;
 const staff=await request(base,`/api/jobs/${id}/schedule`,{method:'POST',body:JSON.stringify({expectedVersion:1,agentId:1,startAt:'2026-09-07T00:30:00Z',endAt:'2026-09-07T01:30:00Z',role:'STAFF',actor:'dispatcher',overrideReason:'emergency'})});
 assert.equal(staff.response.status,409);assert.equal(staff.body.error.code,'SLOT_CONFLICT');
 const admin=await request(base,`/api/jobs/${id}/schedule`,{method:'POST',body:JSON.stringify({expectedVersion:1,agentId:1,startAt:'2026-09-07T00:30:00Z',endAt:'2026-09-07T01:30:00Z',role:'ADMIN',actor:'ops-admin',overrideReason:'Critical customer outage'})});
 assert.equal(admin.response.status,200);assert.equal(admin.body.status,'SCHEDULED');assert.equal(admin.body.overrideReason,'Critical customer outage');assert.equal(admin.body.version,2);
 const audits=await request(base,`/api/audits?jobId=${id}`);assert.ok(audits.body.items.some(x=>x.action==='SCHEDULE_OVERRIDE'&&x.actor==='ops-admin'));
}));

test('schedule to complete lifecycle enforces current version and audit',async()=>withServer(async base=>{
 const scheduled=await request(base,'/api/jobs/3/schedule',{method:'POST',body:JSON.stringify({expectedVersion:1,agentId:1,startAt:'2026-09-07T01:00:00Z',endAt:'2026-09-07T02:00:00Z',actor:'dispatcher',role:'STAFF'})});
 assert.equal(scheduled.response.status,200);assert.equal(scheduled.body.version,2);
 const stale=await request(base,'/api/jobs/3/dispatch',{method:'POST',body:JSON.stringify({expectedVersion:1,actor:'dispatcher'})});assert.equal(stale.response.status,409);assert.equal(stale.body.error.code,'STALE_JOB');
 const dispatched=await request(base,'/api/jobs/3/dispatch',{method:'POST',body:JSON.stringify({expectedVersion:2,actor:'dispatcher'})});assert.equal(dispatched.body.status,'DISPATCHED');
 const onsite=await request(base,'/api/jobs/3/on-site',{method:'POST',body:JSON.stringify({expectedVersion:3,actor:'agent-a'})});assert.equal(onsite.body.status,'ON_SITE');
 const done=await request(base,'/api/jobs/3/complete',{method:'POST',body:JSON.stringify({expectedVersion:4,actor:'agent-a'})});assert.equal(done.body.status,'COMPLETED');assert.equal(done.body.version,5);
 const audits=await request(base,'/api/audits?jobId=3');assert.ok(audits.body.items.some(x=>x.action==='COMPLETE'&&x.actor==='agent-a'));
}));

test('reassign detects conflict and terminal jobs reject further actions',async()=>withServer(async base=>{
 const conflict=await request(base,'/api/jobs/1/reassign',{method:'POST',body:JSON.stringify({expectedVersion:2,agentId:2,startAt:'2026-09-07T01:30:00Z',endAt:'2026-09-07T02:30:00Z',actor:'dispatcher',role:'STAFF'})});assert.equal(conflict.response.status,409);assert.equal(conflict.body.error.code,'SLOT_CONFLICT');
 const cancelled=await request(base,'/api/jobs/3/cancel',{method:'POST',body:JSON.stringify({expectedVersion:1,actor:'dispatcher'})});assert.equal(cancelled.body.status,'CANCELLED');
 const again=await request(base,'/api/jobs/3/schedule',{method:'POST',body:JSON.stringify({expectedVersion:2,agentId:1,startAt:'2026-09-08T00:00:00Z',endAt:'2026-09-08T01:00:00Z',actor:'dispatcher'})});assert.equal(again.response.status,409);assert.equal(again.body.error.code,'INVALID_JOB_ACTION');
}));
