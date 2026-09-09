import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCommercialStore, hasCommercialCapability } from '../mono-operations/server/commercial-store.mjs';
import { webhookSignature } from '../mono-operations/server/security.mjs';
import { backupDatabase, integrityCheck, restoreDatabase } from '../mono-operations/server/ops.mjs';

const secretKey=Buffer.alloc(32,11).toString('base64');
function tempDb(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mono-commercial-'));return {dir,dbPath:path.join(dir,'mono.sqlite')}}
function seedUsers(store){const boot=store.ensureBootstrapAdmin({email:'admin@example.com',name:'Admin',password:'Admin-Password-123!'});const admin=boot.user||store.db.prepare("SELECT id,email,name,role,active FROM users WHERE email='admin@example.com'").get();const operator=store.createUser({actorId:admin.id,email:'operator@example.com',name:'Operator',role:'OPERATOR',password:'Operator-Password-123!'});const reviewer=store.createUser({actorId:admin.id,email:'reviewer@example.com',name:'Reviewer',role:'REVIEWER',password:'Reviewer-Password-123!'});const manager=store.createUser({actorId:admin.id,email:'manager@example.com',name:'Manager',role:'MANAGER',password:'Manager-Password-123!'});return {admin,operator,reviewer,manager}}

test('commercial capability map keeps high-risk decisions server-side',()=>{
  assert.equal(hasCommercialCapability('OPERATOR','refunds.approve'),false);
  assert.equal(hasCommercialCapability('REVIEWER','documents.review'),true);
  assert.equal(hasCommercialCapability('MANAGER','integrations.retry'),true);
  assert.equal(hasCommercialCapability('ADMIN','knowledge.manage'),true);
});

test('auth persists sessions, validates CSRF, and rate limits repeated failures',()=>{
  const {dbPath}=tempDb();
  let store=createCommercialStore({dbPath,secretKey,loginMaxAttempts:3,loginWindowSeconds:60});
  const {admin}=seedUsers(store);
  const login=store.login({email:'admin@example.com',password:'Admin-Password-123!',ip:'127.0.0.1'});
  assert.equal(store.authenticate(login.token).user.id,admin.id);
  assert.doesNotThrow(()=>store.assertCsrf(store.authenticate(login.token).sessionHash,login.csrf));
  assert.throws(()=>store.assertCsrf(store.authenticate(login.token).sessionHash,'wrong'),e=>e.code==='CSRF_INVALID');
  store.close();
  store=createCommercialStore({dbPath,secretKey,loginMaxAttempts:3,loginWindowSeconds:60});
  assert.equal(store.authenticate(login.token).user.email,'admin@example.com');
  assert.throws(()=>store.login({email:'admin@example.com',password:'bad-password-xxxx',ip:'10.0.0.1'}),e=>e.code==='INVALID_CREDENTIALS');
  assert.throws(()=>store.login({email:'admin@example.com',password:'bad-password-xxxx',ip:'10.0.0.1'}),e=>e.code==='INVALID_CREDENTIALS');
  assert.throws(()=>store.login({email:'admin@example.com',password:'bad-password-xxxx',ip:'10.0.0.1'}),e=>e.code==='INVALID_CREDENTIALS');
  assert.throws(()=>store.login({email:'admin@example.com',password:'Admin-Password-123!',ip:'10.0.0.1'}),e=>e.code==='LOGIN_RATE_LIMITED');
  store.close();
});

test('MARKET enforces state/version and manager-only refund decision',()=>{
  const store=createCommercialStore({secretKey});
  try{
    const {operator,manager}=seedUsers(store);
    let order=store.createOrder(operator.id,{id:'ORD-TEST-1',customerName:'테스트 고객',totalCents:2500000});
    assert.equal(order.status,'NEW');
    order=store.transitionOrder(operator.id,order.id,'PICKING',order.version);
    assert.equal(order.status,'PICKING');
    assert.throws(()=>store.transitionOrder(operator.id,order.id,'DELIVERED',order.version),e=>e.code==='INVALID_ORDER_TRANSITION');
    const refund=store.createRefund(operator.id,order.id,{amountCents:500000,reason:'배송 전 고객 요청 환불'});
    assert.throws(()=>store.decideRefund(operator.id,refund.id,{decision:'APPROVED',note:'검토 완료',expectedVersion:refund.version}),e=>e.code==='FORBIDDEN');
    const approved=store.decideRefund(manager.id,refund.id,{decision:'APPROVED',note:'결제 내역 및 요청 사유 확인 완료',expectedVersion:refund.version});
    assert.equal(approved.status,'APPROVED');
    assert.match(approved.decision_note,/확인 완료/);
    assert.throws(()=>store.decideRefund(manager.id,refund.id,{decision:'REJECTED',note:'다시',expectedVersion:refund.version}),e=>e.code==='STALE_REFUND');
  }finally{store.close()}
});

test('OFFICE separates author/reviewer/archive and records optimistic versions',()=>{
  const store=createCommercialStore({secretKey});
  try{
    const {admin,operator,reviewer}=seedUsers(store);
    let doc=store.createDocument(operator.id,{title:'9월 공급사 인보이스',type:'INVOICE',sourceText:'Invoice No INV-1001 amount 120000'});
    doc=store.submitDocument(operator.id,doc.id,doc.version);
    assert.equal(doc.status,'SUBMITTED');
    assert.throws(()=>store.reviewDocument(operator.id,doc.id,{decision:'APPROVE',note:'검토 완료',expectedVersion:doc.version}),e=>e.code==='FORBIDDEN');
    doc=store.reviewDocument(reviewer.id,doc.id,{decision:'APPROVE',note:'원문과 입력값 대조 확인 완료',expectedVersion:doc.version});
    assert.equal(doc.status,'APPROVED');
    assert.throws(()=>store.archiveDocument(reviewer.id,doc.id,doc.version),e=>e.code==='FORBIDDEN');
    doc=store.archiveDocument(admin.id,doc.id,doc.version);
    assert.equal(doc.status,'ARCHIVED');
  }finally{store.close()}
});

test('SUPPORT applies role ACL to evidence and never auto-approves generated output',()=>{
  const store=createCommercialStore({secretKey});
  try{
    const {admin,operator,reviewer}=seedUsers(store);
    store.createKnowledgeDoc(admin.id,{title:'배송 지연 정책',body:'배송이 3영업일 이상 지연되면 고객에게 지연 사유와 예상 일정을 안내하고 환불은 별도 승인 절차를 따른다.',allowedRoles:['OPERATOR','REVIEWER','MANAGER','ADMIN']});
    store.createKnowledgeDoc(admin.id,{title:'관리자 전용 보안 정책',body:'관리자 전용 비공개 보안 절차 문서입니다.',allowedRoles:['ADMIN']});
    let task=store.createSupportTask(operator.id,{title:'배송 지연 고객 문의',content:'배송이 4일째 도착하지 않아 환불 가능 여부를 묻고 있습니다.'});
    const context=store.supportGenerationContext(operator.id,task.id,task.version);
    assert.ok(context.evidence.some(e=>e.title==='배송 지연 정책'));
    assert.ok(context.evidence.every(e=>e.title!=='관리자 전용 보안 정책'));
    const generated=store.recordSupportGeneration(operator.id,task.id,{expectedVersion:task.version,providerId:'test-provider',output:{answer:'배송 지연 상황을 확인했으며 환불 여부는 별도 승인 절차에 따라 검토하겠습니다.',category:'DELIVERY',risk:'MEDIUM',confidence:.9,recommendedAction:'배송 상태 확인'},evaluation:{requiresHumanReview:true},evidence:context.evidence});
    task=generated.task;
    assert.equal(task.status,'NEEDS_REVIEW');
    assert.throws(()=>store.reviewSupportTask(operator.id,task.id,{decision:'APPROVE',note:'확인 완료',expectedVersion:task.version}),e=>e.code==='FORBIDDEN');
    task=store.reviewSupportTask(reviewer.id,task.id,{decision:'APPROVE',note:'근거자료와 고객 안내 문구 확인 완료',expectedVersion:task.version}).task;
    assert.equal(task.status,'APPROVED');
  }finally{store.close()}
});

test('DATA HUB verifies HMAC, deduplicates events, persists retry queue and dead letters',()=>{
  let clock=1_800_000_000_000;
  const store=createCommercialStore({secretKey,now:()=>clock});
  try{
    const {manager}=seedUsers(store);
    store.createIntegrationConnection(manager.id,{id:'inbound',name:'Inbound Orders',kind:'INBOUND_WEBHOOK',secret:'inbound-secret-123456789'});
    store.createIntegrationConnection(manager.id,{id:'outbound',name:'ERP Target',kind:'OUTBOUND_HTTP',endpointUrl:'http://127.0.0.1:9999/events',secret:'outbound-secret-123456789'});
    store.createIntegrationJob(manager.id,{name:'Order Sync',sourceConnectionId:'inbound',targetConnectionId:'outbound',eventType:'order.updated',maxRetries:1});
    const body=Buffer.from(JSON.stringify({eventId:'evt-1',type:'order.updated',payload:{orderId:'ORD-1'}}));
    assert.throws(()=>store.ingestWebhook({connectionId:'inbound',rawBody:body,signature:'sha256=bad',input:JSON.parse(body)}),e=>e.code==='INVALID_WEBHOOK_SIGNATURE');
    const accepted=store.ingestWebhook({connectionId:'inbound',rawBody:body,signature:webhookSignature(body,'inbound-secret-123456789'),input:JSON.parse(body)});
    assert.equal(accepted.replayed,false);
    const replay=store.ingestWebhook({connectionId:'inbound',rawBody:body,signature:webhookSignature(body,'inbound-secret-123456789'),input:JSON.parse(body)});
    assert.equal(replay.replayed,true);
    const first=store.claimDueIntegrationRun();
    assert.equal(first.run.attempt,0);
    store.completeIntegrationRun({queueId:first.queue.id,success:false,detail:'HTTP 503'});
    clock+=1_100;
    const retry=store.claimDueIntegrationRun();
    assert.equal(retry.run.attempt,1);
    store.completeIntegrationRun({queueId:retry.queue.id,success:false,detail:'HTTP 503'});
    const dead=store.listDeadLetters(manager.id);
    assert.equal(dead.length,1);
    const manual=store.retryDeadLetter(manager.id,dead[0].id);
    assert.equal(manual.result,'QUEUED');
  }finally{store.close()}
});

test('file DB survives restart and backup/restore preserves commercial data',()=>{
  const {dir,dbPath}=tempDb(),backup=path.join(dir,'backup.sqlite'),restored=path.join(dir,'restored.sqlite');
  let store=createCommercialStore({dbPath,secretKey});
  const {operator}=seedUsers(store);
  const order=store.createOrder(operator.id,{id:'ORD-PERSIST',customerName:'영속 고객',totalCents:990000});
  store.close();
  assert.equal(integrityCheck(dbPath).ok,true);
  assert.equal(backupDatabase(dbPath,backup).ok,true);
  fs.copyFileSync(dbPath,restored);
  restoreDatabase(backup,restored);
  store=createCommercialStore({dbPath:restored,secretKey});
  try{assert.equal(store.getOrder(operator.id,order.id).customer_name,'영속 고객')}finally{store.close()}
});
