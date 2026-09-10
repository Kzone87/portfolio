import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {serviceTargetForInquiry,serviceCaseState,validateFeedback,notificationRetryAt} from '../nexa-service-excellence/engine.mjs';
import {createServiceExcellenceStore} from '../nexa-service-excellence/server/store.mjs';
import {dispatchNotificationBatch} from '../nexa-service-excellence/server/notification-worker.mjs';

const createdAt='2026-09-10T00:00:00.000Z';
const inquiry=(impact='생산·영업 등 핵심 업무가 멈춤')=>({id:'NX-SERVICE001',impact,createdAt});

test('service excellence maps impact to configurable response targets and exposes risk before breach',()=>{
  const target=serviceTargetForInquiry(inquiry());
  assert.equal(target.tier,'CRITICAL');
  assert.equal(target.responseTargetMinutes,30);
  assert.equal(target.responseDueAt,'2026-09-10T00:30:00.000Z');
  assert.equal(serviceCaseState({...target,requestId:'NX-SERVICE001',respondedAt:null,closedAt:null},'2026-09-10T00:10:00.000Z'),'ON_TRACK');
  assert.equal(serviceCaseState({...target,requestId:'NX-SERVICE001',respondedAt:null,closedAt:null},'2026-09-10T00:25:00.000Z'),'AT_RISK');
  assert.equal(serviceCaseState({...target,requestId:'NX-SERVICE001',respondedAt:null,closedAt:null},'2026-09-10T00:31:00.000Z'),'OVERDUE');
});

test('feedback and notification retry contracts reject invalid data and use bounded backoff',()=>{
  assert.deepEqual(validateFeedback({score:5,comment:'빠른 대응 감사합니다.'}),{score:5,comment:'빠른 대응 감사합니다.'});
  assert.throws(()=>validateFeedback({score:6}),/만족도 점수/);
  assert.equal(notificationRetryAt(1,createdAt),'2026-09-10T00:01:00.000Z');
  assert.equal(notificationRetryAt(4,createdAt),'2026-09-10T00:08:00.000Z');
});

test('durable service case tracks response SLA, deduplicates outbox and accepts CSAT only after close',()=>{
  const store=createServiceExcellenceStore();
  try{
    const serviceCase=store.ensureCase(inquiry());assert.equal(serviceCase.tier,'CRITICAL');
    const duplicate=store.ensureCase({...inquiry(),impact:'고장이 아니라 정기점검·설치 작업'});assert.equal(duplicate.tier,'CRITICAL');
    const first=store.enqueueNotification({requestId:serviceCase.requestId,eventType:'INTAKE_RECEIVED',channel:'SMS',destination:'01012345678',payload:{requestId:serviceCase.requestId},dedupeKey:`${serviceCase.requestId}:INTAKE`,createdAt});
    const replay=store.enqueueNotification({requestId:serviceCase.requestId,eventType:'INTAKE_RECEIVED',channel:'SMS',destination:'01012345678',payload:{requestId:serviceCase.requestId},dedupeKey:`${serviceCase.requestId}:INTAKE`,createdAt});
    assert.equal(replay.id,first.id);assert.equal(store.pendingNotifications(createdAt).length,1);
    const responded=store.markResponded(serviceCase.requestId,'2026-09-10T00:20:00.000Z');assert.equal(serviceCaseState(responded,'2026-09-10T00:40:00.000Z'),'MET');
    assert.throws(()=>store.submitFeedback(serviceCase.requestId,{score:5}),/서비스 완료 후/);
    store.markClosed(serviceCase.requestId,'2026-09-10T02:00:00.000Z');
    const feedback=store.submitFeedback(serviceCase.requestId,{score:5,comment:'좋았습니다.'},'2026-09-10T02:05:00.000Z');assert.equal(feedback.score,5);
    assert.throws(()=>store.submitFeedback(serviceCase.requestId,{score:4}),/이미 만족도/);
    const summary=store.summary('2026-09-10T03:00:00.000Z');assert.equal(summary.totalCases,1);assert.equal(summary.states.MET,1);assert.equal(summary.averageResponseMinutes,20);assert.equal(summary.csat.average,5);
  }finally{store.close()}
});

test('notification dispatcher records success, retry and dead-letter state without losing events',async()=>{
  const store=createServiceExcellenceStore();
  try{
    store.ensureCase(inquiry('처리량·품질에 큰 영향이 생김'));
    const good=store.enqueueNotification({requestId:'NX-SERVICE001',eventType:'GOOD',channel:'EMAIL',destination:'customer@example.com',dedupeKey:'good',createdAt});
    const bad=store.enqueueNotification({requestId:'NX-SERVICE001',eventType:'BAD',channel:'EMAIL',destination:'customer@example.com',dedupeKey:'bad',createdAt});
    const result=await dispatchNotificationBatch(store,async item=>{if(item.id===bad.id)throw new Error('provider down')},{at:new Date(createdAt),maxAttempts:2});
    assert.deepEqual(result.map(row=>row.status),['SENT','RETRY']);
    const retry=store.markNotificationFailed(bad.id,new Error('provider still down'),'2026-09-10T00:02:00.000Z',2);assert.equal(retry.status,'DEAD');assert.equal(retry.attempts,2);
    const summary=store.summary('2026-09-10T00:03:00.000Z');assert.equal(summary.notifications.dead,1);assert.equal(summary.notifications.pending,0);
  }finally{store.close()}
});

test('service excellence state survives restart on persistent SQLite storage',()=>{
  const dir=mkdtempSync(join(tmpdir(),'nexa-excellence-')),dbPath=join(dir,'excellence.sqlite');
  try{
    const first=createServiceExcellenceStore(dbPath);first.ensureCase(inquiry());first.markResponded('NX-SERVICE001','2026-09-10T00:15:00.000Z');first.markClosed('NX-SERVICE001','2026-09-10T01:00:00.000Z');first.submitFeedback('NX-SERVICE001',{score:4,comment:'재방문 없이 해결'},'2026-09-10T01:10:00.000Z');first.close();
    const second=createServiceExcellenceStore(dbPath);try{assert.equal(second.case('NX-SERVICE001').respondedAt,'2026-09-10T00:15:00.000Z');assert.equal(second.feedback('NX-SERVICE001').score,4);assert.equal(second.health().quick_check,'ok')}finally{second.close()}
  }finally{rmSync(dir,{recursive:true,force:true})}
});
