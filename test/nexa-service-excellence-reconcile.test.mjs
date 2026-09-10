import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createInquiryStore} from '../nexa-tech-service/server/inquiry-store.mjs';
import {createServiceExcellenceStore} from '../nexa-service-excellence/server/store.mjs';
import {reconcileServiceExcellence} from '../nexa-service-excellence/server/reconciler.mjs';
import {dispatchNotificationBatch} from '../nexa-service-excellence/server/notification-worker.mjs';

const input={
  company:'서비스품질테스트',name:'고객담당자',phone:'010-5555-7777',email:'customer@example.com',
  industry:'생산·인쇄·제조',sites:'1개 사업장',assets:'1–5대',impact:'생산·영업 등 핵심 업무가 멈춤',
  service:'고장·장애 현장지원',engagement:'고장 날 때 현장지원',detail:'핵심 생산 장비가 멈춰 빠른 현장 확인이 필요한 상태입니다.',consent:true
};

test('reconciler rebuilds proactive service state and idempotent notifications from NEXA source of truth',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'nexa-service-reconcile-'));
  const inquiryDbPath=join(dir,'inquiries.sqlite'),serviceDbPath=join(dir,'service.sqlite');
  try{
    const inquiryStore=createInquiryStore(inquiryDbPath);
    const created=inquiryStore.create(input);
    const contacted=inquiryStore.transition(created.id,created.version,'CONTACTED','staff');
    inquiryStore.transition(created.id,contacted.version,'CLOSED','staff');
    inquiryStore.close();

    const serviceStore=createServiceExcellenceStore(serviceDbPath);
    try{
      const first=reconcileServiceExcellence({inquiryDbPath,serviceStore});
      assert.deepEqual(first,{scanned:1,created:1,responded:1,closed:1,enqueued:3});
      const second=reconcileServiceExcellence({inquiryDbPath,serviceStore});
      assert.deepEqual(second,{scanned:1,created:0,responded:0,closed:0,enqueued:0});
      const serviceCase=serviceStore.case(created.id);assert.ok(serviceCase.respondedAt);assert.ok(serviceCase.closedAt);assert.equal(serviceCase.tier,'CRITICAL');
      const pending=serviceStore.pendingNotifications(new Date(Date.now()+60_000));assert.equal(pending.length,3);assert.ok(pending.every(item=>item.channel==='EMAIL'));
      assert.ok(pending.every(item=>!JSON.stringify(item.payload).includes('customer@example.com')));
      const delivered=[];const dispatch=await dispatchNotificationBatch(serviceStore,async item=>delivered.push(item.eventType),{at:new Date(Date.now()+60_000)});
      assert.equal(dispatch.length,3);assert.deepEqual(delivered,['INTAKE_RECEIVED','RESPONSE_CONFIRMED','SERVICE_CLOSED_FEEDBACK']);
      assert.equal(serviceStore.summary().notifications.pending,0);
      const feedback=serviceStore.submitFeedback(created.id,{score:5,comment:'빠르게 정상화됐습니다.'});assert.equal(feedback.score,5);
    }finally{serviceStore.close()}
  }finally{rmSync(dir,{recursive:true,force:true})}
});
