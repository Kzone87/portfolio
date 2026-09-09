import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createDocument, extractMetadata, validateChecklist, DOCUMENT_STATUS } from '../document-intake-approval/engine.mjs';
import { createDocumentServer } from '../document-intake-approval/server/app.mjs';

async function withServer(run){const s=createDocumentServer();s.listen(0,'127.0.0.1');await once(s,'listening');const a=s.address(),base=`http://127.0.0.1:${a.port}`;try{await run(base);}finally{s.close();await once(s,'close');}}
async function request(base,path,o={}){const r=await fetch(`${base}${path}`,{...o,headers:{'content-type':'application/json',...(o.headers??{})}});return{response:r,body:await r.json()};}

test('deterministic extraction parses key value text and checklist finds required fields',()=>{
  const m=extractMetadata('INVOICE','documentNo: INV-1\nparty: Alpha Co\namount: 125,000');
  assert.deepEqual(m,{documentNo:'INV-1',party:'Alpha Co',amount:'125000'});
  const d=createDocument({type:'INVOICE',title:'Invoice sample',metadata:m},{id:1,createdAt:'2026-09-06T00:00:00Z'});
  assert.equal(validateChecklist(d).valid,true);
  assert.equal(d.status,DOCUMENT_STATUS.DRAFT);
});

test('HTTP checklist blocks incomplete submit then extraction makes it submittable',async()=>withServer(async base=>{
  const d=await request(base,'/api/documents/1');
  assert.equal(d.body.checklist.valid,false);
  const blocked=await request(base,'/api/documents/1/submit',{method:'POST',body:JSON.stringify({expectedVersion:1,actor:'submitter',role:'SUBMITTER'})});
  assert.equal(blocked.response.status,409);
  assert.equal(blocked.body.error.code,'CHECKLIST_INCOMPLETE');
  const extracted=await request(base,'/api/documents/1/extract',{method:'POST',body:JSON.stringify({expectedVersion:1,actor:'submitter',role:'SUBMITTER'})});
  assert.equal(extracted.body.metadata.amount,'125000');
  assert.equal(extracted.body.version,2);
  const submitted=await request(base,'/api/documents/1/submit',{method:'POST',body:JSON.stringify({expectedVersion:2,actor:'submitter',role:'SUBMITTER'})});
  assert.equal(submitted.body.status,'SUBMITTED');
  assert.equal(submitted.body.version,3);
}));

test('author mutations are SUBMITTER-only at the API boundary',async()=>withServer(async base=>{
  const createForbidden=await request(base,'/api/documents',{method:'POST',body:JSON.stringify({type:'INVOICE',title:'Reviewer should not create',role:'REVIEWER',actor:'qa'})});
  assert.equal(createForbidden.response.status,403);
  assert.equal(createForbidden.body.error.code,'AUTHOR_FORBIDDEN');
  const updateForbidden=await request(base,'/api/documents/1/update',{method:'POST',body:JSON.stringify({expectedVersion:1,metadata:{documentNo:'X'},role:'ADMIN',actor:'admin'})});
  assert.equal(updateForbidden.response.status,403);
  assert.equal(updateForbidden.body.error.code,'AUTHOR_FORBIDDEN');
  const created=await request(base,'/api/documents',{method:'POST',body:JSON.stringify({type:'INVOICE',title:'QA intake invoice',sourceText:'documentNo: QA-1',role:'SUBMITTER',actor:'submitter'})});
  assert.equal(created.response.status,201);
  assert.equal(created.body.status,'DRAFT');
  assert.equal(created.body.version,1);
}));

test('review requires reviewer role, current version, and auditable decision rationale',async()=>withServer(async base=>{
  const forbidden=await request(base,'/api/documents/2/review',{method:'POST',body:JSON.stringify({expectedVersion:2,decision:'APPROVE',comment:'검토 완료',reviewer:'user',role:'SUBMITTER'})});
  assert.equal(forbidden.response.status,403);
  assert.equal(forbidden.body.error.code,'REVIEW_FORBIDDEN');
  const stale=await request(base,'/api/documents/2/review',{method:'POST',body:JSON.stringify({expectedVersion:1,decision:'APPROVE',comment:'검토 완료',reviewer:'qa',role:'REVIEWER'})});
  assert.equal(stale.response.status,409);
  assert.equal(stale.body.error.code,'STALE_DOCUMENT');
  const noRationale=await request(base,'/api/documents/2/review',{method:'POST',body:JSON.stringify({expectedVersion:2,decision:'APPROVE',comment:'',reviewer:'qa',role:'REVIEWER'})});
  assert.equal(noRationale.response.status,409);
  assert.equal(noRationale.body.error.code,'INVALID_DOCUMENT_ACTION');
  const ok=await request(base,'/api/documents/2/review',{method:'POST',body:JSON.stringify({expectedVersion:2,decision:'APPROVE',comment:'필수값과 신청 정보를 확인했습니다.',reviewer:'qa',role:'REVIEWER'})});
  assert.equal(ok.response.status,200);
  assert.equal(ok.body.status,'APPROVED');
  assert.equal(ok.body.version,3);
}));

test('needs-changes requires rationale and supports author edit then resubmit',async()=>withServer(async base=>{
  const bad=await request(base,'/api/documents/2/review',{method:'POST',body:JSON.stringify({expectedVersion:2,decision:'NEEDS_CHANGES',comment:'',reviewer:'qa',role:'REVIEWER'})});
  assert.equal(bad.response.status,409);
  assert.equal(bad.body.error.code,'INVALID_DOCUMENT_ACTION');
  const needs=await request(base,'/api/documents/2/review',{method:'POST',body:JSON.stringify({expectedVersion:2,decision:'NEEDS_CHANGES',comment:'연락 이메일을 다시 확인해 주세요.',reviewer:'qa',role:'REVIEWER'})});
  assert.equal(needs.body.status,'NEEDS_CHANGES');
  const edit=await request(base,'/api/documents/2/update',{method:'POST',body:JSON.stringify({expectedVersion:3,metadata:{applicantName:'Beta Partner',email:'new@beta.example'},actor:'submitter',role:'SUBMITTER'})});
  assert.equal(edit.body.status,'NEEDS_CHANGES');
  assert.equal(edit.body.reviewComment,null);
  const submit=await request(base,'/api/documents/2/submit',{method:'POST',body:JSON.stringify({expectedVersion:4,actor:'submitter',role:'SUBMITTER'})});
  assert.equal(submit.body.status,'SUBMITTED');
  assert.equal(submit.body.version,5);
}));

test('archive is admin-only and approved document becomes terminal archive',async()=>withServer(async base=>{
  const forbidden=await request(base,'/api/documents/4/archive',{method:'POST',body:JSON.stringify({expectedVersion:3,role:'REVIEWER',actor:'qa'})});
  assert.equal(forbidden.response.status,403);
  assert.equal(forbidden.body.error.code,'ARCHIVE_FORBIDDEN');
  const archived=await request(base,'/api/documents/4/archive',{method:'POST',body:JSON.stringify({expectedVersion:3,role:'ADMIN',actor:'admin'})});
  assert.equal(archived.body.status,'ARCHIVED');
  assert.equal(archived.body.version,4);
  const again=await request(base,'/api/documents/4/archive',{method:'POST',body:JSON.stringify({expectedVersion:4,role:'ADMIN',actor:'admin'})});
  assert.equal(again.response.status,409);
}));

test('HTTP metrics filters and audit expose review queue pressure',async()=>withServer(async base=>{
  const health=await request(base,'/api/health');
  assert.equal(health.body.service,'document-intake-approval');
  const m=await request(base,'/api/metrics');
  assert.deepEqual(m.body,{draft:1,submitted:1,needsChanges:1,approved:1,rejected:0,archived:0});
  const submitted=await request(base,'/api/documents?status=SUBMITTED');
  assert.equal(submitted.body.items.length,1);
  const audits=await request(base,'/api/audits?documentId=3');
  assert.ok(audits.body.items.some(x=>x.action==='NEEDS_CHANGES'&&x.actor==='demo-reviewer'));
}));

test('invalid document payload is rejected without creating a record',async()=>withServer(async base=>{
  const r=await request(base,'/api/documents',{method:'POST',body:JSON.stringify({type:'UNKNOWN',title:'x',role:'SUBMITTER',actor:'submitter'})});
  assert.equal(r.response.status,400);
  assert.equal(r.body.error.code,'INVALID_DOCUMENT');
}));
