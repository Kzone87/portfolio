import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCoreStore, MonoError } from '../mono-operations/server/core-store.mjs';
import { createPersistentModules } from '../mono-operations/server/persistent-modules.mjs';

function tempDb(prefix='mono-'){const dir=mkdtempSync(join(tmpdir(),prefix));return{dir,path:join(dir,'mono.sqlite')};}

test('MONO core persists users, sessions boundary, capabilities and audit',()=>{
  const t=tempDb('mono-core-');
  try{
    let core=createCoreStore(t.path,{bootstrapAdmin:{id:'admin',username:'admin',name:'운영 관리자',team:'Ops',password:'StrongPassword!1'}});
    const login=core.login('admin','StrongPassword!1');
    assert.equal(login.principal.role,'ADMIN');
    assert.equal(core.can(login.principal,'market.refund.approve'),true);
    const operator=core.createUser({id:'operator',username:'operator',name:'운영 담당자',team:'Fulfillment',role:'OPERATOR',password:'StrongPassword!2'},'admin');
    assert.equal(core.can(operator,'market.fulfill'),true);
    assert.equal(core.can(operator,'market.refund.approve'),false);
    assert.throws(()=>core.requireCapability(operator,'market.refund.approve'),error=>error instanceof MonoError&&error.statusCode===403);
    core.audit({module:'MARKET',resourceType:'ORDER',resourceId:'1',actorId:'admin',actorName:'운영 관리자',action:'TEST_ACTION',detail:'persistent audit'});
    core.close();
    core=createCoreStore(t.path,{});
    assert.equal(core.login('operator','StrongPassword!2').principal.name,'운영 담당자');
    assert.ok(core.listAudits(50).some(row=>row.action==='TEST_ACTION'&&row.detail==='persistent audit'));
    core.close();
  }finally{rmSync(t.dir,{recursive:true,force:true});}
});

test('MONO module snapshots survive restart across MARKET, OFFICE, SUPPORT and DATA HUB',()=>{
  const t=tempDb('mono-modules-');
  try{
    let modules=createPersistentModules(t.path);
    const order=modules.market.getOrder(3);
    assert.equal(order.fulfillmentStatus,'PICKING');
    const shipped=modules.market.ship(3,{expectedVersion:order.version,trackingNo:'MONO-TRACK-1001',actor:'admin'});
    assert.equal(shipped.fulfillmentStatus,'SHIPPED');

    const doc=modules.office.getDocument(2);
    const approved=modules.office.review(2,{expectedVersion:doc.version,decision:'APPROVE',comment:'문서 내용과 필수 항목 대조 완료',reviewer:'admin',role:'ADMIN'});
    assert.equal(approved.status,'APPROVED');

    const generated=modules.support.generateTask(1,{});
    assert.ok(['GENERATED','NEEDS_REVIEW'].includes(generated.task.status));
    const reviewed=modules.support.reviewTask(1,{expectedVersion:generated.task.version,decision:'APPROVE',reviewer:'admin'});
    assert.equal(reviewed.task.status,'APPROVED');

    const event=modules.dataHub.receiveWebhook('orders-webhook-demo',{eventId:'persist-order-1001',type:'order.updated',payload:{simulateFailure:true}});
    assert.equal(event.status,'FAILED');
    const failedRun=modules.dataHub.listRuns(10).find(run=>run.id===event.runId);
    assert.equal(failedRun.result,'FAILED');
    modules.close();

    modules=createPersistentModules(t.path);
    assert.equal(modules.market.getOrder(3).trackingNo,'MONO-TRACK-1001');
    assert.equal(modules.office.getDocument(2).status,'APPROVED');
    assert.equal(modules.support.listTasks().find(task=>task.id===1).status,'APPROVED');
    assert.equal(modules.dataHub.receiveWebhook('orders-webhook-demo',{eventId:'persist-order-1001',type:'order.updated',payload:{simulateFailure:true}}).replayed,true);
    const retried=modules.dataHub.retryRun(event.runId);
    assert.equal(retried.result,'SUCCESS');
    modules.close();
  }finally{rmSync(t.dir,{recursive:true,force:true});}
});

test('MONO delivery API enforces login/CSRF/RBAC and executes cross-module order flow',async()=>{
  const t=tempDb('mono-http-');
  process.env.MONO_DB_PATH=t.path;
  process.env.NODE_ENV='test';
  const mod=await import(`../mono-operations/server/delivery-app.mjs?mono=${Date.now()}`);
  const server=mod.createMonoDeliveryServer();
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',error=>error?reject(error):resolve()));
  const base=`http://127.0.0.1:${server.address().port}`;
  let cookie='';let csrf='';
  async function request(path,{method='GET',json,auth=true,csrfHeader=true}={}){
    const headers={};if(json!==undefined)headers['content-type']='application/json';if(auth&&cookie)headers.cookie=cookie;if(csrfHeader&&csrf)headers['x-csrf-token']=csrf;
    const response=await fetch(`${base}${path}`,{method,headers,body:json===undefined?undefined:JSON.stringify(json)});const text=await response.text();return{response,body:text?JSON.parse(text):null};
  }
  try{
    assert.equal((await request('/api/inbox',{auth:false})).response.status,401);
    const login=await request('/api/auth/login',{method:'POST',json:{username:'mono-admin',password:'MonoDemo!2026'},auth:false,csrfHeader:false});
    assert.equal(login.response.status,200);cookie=login.response.headers.get('set-cookie').split(';')[0];csrf=login.body.csrfToken;assert.equal(login.body.principal.role,'ADMIN');
    assert.equal((await request('/api/overview')).response.status,200);

    const noCsrf=await request('/api/data-hub/webhooks/orders-webhook-demo',{method:'POST',json:{eventId:'http-order-1001',type:'order.updated',payload:{orderNo:'ORD-HTTP-1001',customerName:'HTTP 고객',email:'http@example.com',total:55000,itemCount:2}},csrfHeader:false});
    assert.equal(noCsrf.response.status,403);
    const webhook=await request('/api/data-hub/webhooks/orders-webhook-demo',{method:'POST',json:{eventId:'http-order-1001',type:'order.updated',payload:{orderNo:'ORD-HTTP-1001',customerName:'HTTP 고객',email:'http@example.com',total:55000,itemCount:2}}});
    assert.equal(webhook.response.status,201);assert.equal(webhook.body.order.orderNo,'ORD-HTTP-1001');assert.equal(webhook.body.order.fulfillmentStatus,'UNFULFILLED');
    const replay=await request('/api/data-hub/webhooks/orders-webhook-demo',{method:'POST',json:{eventId:'http-order-1001',type:'order.updated',payload:{orderNo:'ORD-HTTP-1001',customerName:'HTTP 고객',email:'http@example.com',total:55000,itemCount:2}}});
    assert.equal(replay.response.status,200);assert.equal(replay.body.replayed,true);

    const orderId=webhook.body.order.id;
    const picked=await request(`/api/market/orders/${orderId}/pick`,{method:'POST',json:{expectedVersion:webhook.body.order.version}});assert.equal(picked.body.fulfillmentStatus,'PICKING');
    const shipped=await request(`/api/market/orders/${orderId}/ship`,{method:'POST',json:{expectedVersion:picked.body.version,trackingNo:'MONO-HTTP-TRK'}});assert.equal(shipped.body.fulfillmentStatus,'SHIPPED');
    const delivered=await request(`/api/market/orders/${orderId}/deliver`,{method:'POST',json:{expectedVersion:shipped.body.version}});assert.equal(delivered.body.fulfillmentStatus,'DELIVERED');

    const supportTasks=await request('/api/support/tasks');const task=supportTasks.body.items.find(item=>item.status==='PENDING');
    const generated=await request(`/api/support/tasks/${task.id}/generate`,{method:'POST',json:{}});assert.ok(['GENERATED','NEEDS_REVIEW'].includes(generated.body.task.status));
    const approved=await request(`/api/support/tasks/${task.id}/review`,{method:'POST',json:{expectedVersion:generated.body.task.version,decision:'APPROVE'}});assert.equal(approved.body.task.status,'APPROVED');

    const docs=await request('/api/office/documents?status=SUBMITTED');const document=docs.body.items[0];
    const docApproved=await request(`/api/office/documents/${document.id}/review`,{method:'POST',json:{expectedVersion:document.version,decision:'APPROVE',comment:'문서번호와 거래처 필수 항목 확인 완료'}});assert.equal(docApproved.body.status,'APPROVED');

    const refundList=await request('/api/market/refunds?status=REQUESTED');const refund=refundList.body.items[0];
    const refundOrder=(await request('/api/market/orders')).body.items.find(item=>item.id===refund.orderId);
    const refundApproved=await request(`/api/market/refunds/${refund.id}/decision`,{method:'POST',json:{expectedVersion:refundOrder.version,decision:'APPROVE',decisionNote:'파손 증빙 및 결제 내역 확인 완료'}});assert.equal(refundApproved.body.refund.status,'APPROVED');

    const audits=await request('/api/audits?limit=100');assert.equal(audits.response.status,200);for(const moduleName of ['DATA HUB','MARKET','SUPPORT','OFFICE'])assert.ok(audits.body.items.some(item=>item.module===moduleName),`missing ${moduleName} audit`);
  }finally{
    await new Promise(resolve=>server.close(resolve));mod.closeMonoDelivery();delete process.env.MONO_DB_PATH;delete process.env.NODE_ENV;rmSync(t.dir,{recursive:true,force:true});
  }
});
