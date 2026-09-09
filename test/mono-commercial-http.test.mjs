import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCommercialRuntime } from '../mono-operations/server/commercial-app.mjs';
import { webhookSignature } from '../mono-operations/server/security.mjs';

const secretKey=Buffer.alloc(32,21).toString('base64');
function listen(server){return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const a=server.address();resolve(`http://127.0.0.1:${a.port}`)})})}
function closeServer(server){return new Promise(resolve=>server.close(()=>resolve()))}

function createStub(handler){return http.createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);handler(req,res,Buffer.concat(chunks))})}

class Client{
  constructor(origin){this.origin=origin;this.cookie='';this.csrf=''}
  async request(url,{method='GET',body,csrf=true,origin=true,headers={}}={}){const h={...headers};if(this.cookie)h.cookie=this.cookie;if(csrf&&this.csrf&&method!=='GET')h['x-csrf-token']=this.csrf;if(origin&&method!=='GET')h.origin=this.origin;if(body!==undefined){h['content-type']='application/json';body=JSON.stringify(body)}const r=await fetch(`${this.origin}${url}`,{method,headers:h,body});const setCookie=r.headers.get('set-cookie');if(setCookie)this.cookie=setCookie.split(';')[0];let payload={};try{payload=await r.json()}catch{}return {status:r.status,payload,headers:r.headers}}
  async login(email,password){const r=await this.request('/api/auth/login',{method:'POST',body:{email,password},csrf:false});if(r.status===200)this.csrf=r.payload.csrfToken;return r}
}

test('commercial HTTP runtime serves real workspace and enforces auth/CSRF/RBAC/provider/webhook boundaries',async()=>{
  let providerAuth='';
  const provider=createStub((req,res)=>{providerAuth=String(req.headers.authorization||'');res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({answer:'배송 지연 상태를 확인하고 예상 일정을 안내한 뒤 환불은 승인 절차에 따라 검토합니다.',category:'DELIVERY',risk:'MEDIUM',confidence:.92,recommendedAction:'배송 상태 확인'})}}]}))});
  const providerOrigin=await listen(provider);
  let outboundCount=0,outboundSignature='';
  const target=createStub((req,res)=>{outboundCount+=1;outboundSignature=String(req.headers['x-mono-signature']||'');res.writeHead(204);res.end()});
  const targetOrigin=await listen(target);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mono-http-')),dbPath=path.join(dir,'mono.sqlite');
  const config={production:false,dbPath,secretKey,publicOrigin:'http://127.0.0.1:8796',providers:[{id:'stub',baseUrl:`${providerOrigin}/v1`,apiKey:'server-only-ai-key',model:'stub-model',timeoutMs:3000}],allowHosts:['127.0.0.1'],port:0,bind:'127.0.0.1',trustProxy:false,sessionTtlSeconds:28800,integrationPollMs:1000,bootstrapAdminEmail:'admin@example.com',bootstrapAdminName:'Admin',bootstrapAdminPassword:'Admin-Password-123!'};
  const runtime=createCommercialRuntime({config});
  const origin=await listen(runtime.server);config.publicOrigin=origin;
  try{
    const publicPage=await fetch(`${origin}/`);assert.equal(publicPage.status,200);assert.match(await publicPage.text(),/MONO OPERATIONS/);assert.match(publicPage.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    const anonymous=await fetch(`${origin}/api/orders`);assert.equal(anonymous.status,401);

    const admin=new Client(origin);let r=await admin.login('admin@example.com','Admin-Password-123!');assert.equal(r.status,200);assert.equal(r.payload.user.role,'ADMIN');assert.match(r.headers.get('set-cookie'),/HttpOnly/);
    r=await admin.request('/api/orders',{method:'POST',body:{customerName:'HTTP 고객',totalCents:1200000},csrf:false});assert.equal(r.status,403);assert.equal(r.payload.error,'CSRF_INVALID');
    r=await admin.request('/api/admin/users',{method:'POST',body:{email:'operator@example.com',name:'Operator',role:'OPERATOR',password:'Operator-Password-123!'}});assert.equal(r.status,201);
    r=await admin.request('/api/admin/users',{method:'POST',body:{email:'manager@example.com',name:'Manager',role:'MANAGER',password:'Manager-Password-123!'}});assert.equal(r.status,201);
    r=await admin.request('/api/admin/users',{method:'POST',body:{email:'reviewer@example.com',name:'Reviewer',role:'REVIEWER',password:'Reviewer-Password-123!'}});assert.equal(r.status,201);

    const operator=new Client(origin);r=await operator.login('operator@example.com','Operator-Password-123!');assert.equal(r.status,200);
    r=await operator.request('/api/orders',{method:'POST',body:{id:'HTTP-ORD-1',customerName:'HTTP 고객',totalCents:1200000}});assert.equal(r.status,201);const order=r.payload.order;
    r=await operator.request(`/api/orders/${order.id}/refunds`,{method:'POST',body:{amountCents:300000,reason:'고객 요청 환불 검토'}});assert.equal(r.status,201);const refund=r.payload.refund;
    r=await operator.request(`/api/refunds/${refund.id}/decision`,{method:'POST',body:{decision:'APPROVED',note:'결제 내역 확인 완료',expectedVersion:refund.version}});assert.equal(r.status,403);assert.equal(r.payload.error,'FORBIDDEN');
    const manager=new Client(origin);await manager.login('manager@example.com','Manager-Password-123!');r=await manager.request(`/api/refunds/${refund.id}/decision`,{method:'POST',body:{decision:'APPROVED',note:'결제 내역과 요청 사유 확인 완료',expectedVersion:refund.version}});assert.equal(r.status,200);assert.equal(r.payload.refund.status,'APPROVED');

    r=await admin.request('/api/support/knowledge',{method:'POST',body:{title:'배송 지연 정책',body:'배송 지연 시 현재 배송 상태와 예상 일정을 안내하고 환불은 별도 승인 절차를 따른다.',allowedRoles:['OPERATOR','REVIEWER','MANAGER','ADMIN']}});assert.equal(r.status,201);
    r=await operator.request('/api/support/tasks',{method:'POST',body:{title:'배송 지연 문의',content:'배송이 늦어 환불 가능한지 고객이 문의했습니다.'}});assert.equal(r.status,201);let task=r.payload.task;
    r=await operator.request(`/api/support/tasks/${task.id}/generate`,{method:'POST',body:{expectedVersion:task.version}});assert.equal(r.status,200);task=r.payload.task;assert.equal(task.status,'NEEDS_REVIEW');assert.equal(providerAuth,'Bearer server-only-ai-key');
    const reviewer=new Client(origin);await reviewer.login('reviewer@example.com','Reviewer-Password-123!');r=await reviewer.request(`/api/support/tasks/${task.id}/review`,{method:'POST',body:{decision:'APPROVE',note:'근거자료와 답변 문구 확인 완료',expectedVersion:task.version}});assert.equal(r.status,200);assert.equal(r.payload.task.status,'APPROVED');

    r=await admin.request('/api/integrations/connections',{method:'POST',body:{id:'webhook-in',name:'Order Webhook',kind:'INBOUND_WEBHOOK',secret:'incoming-secret-123456789'}});assert.equal(r.status,201);
    r=await admin.request('/api/integrations/connections',{method:'POST',body:{id:'erp-out',name:'ERP Out',kind:'OUTBOUND_HTTP',endpointUrl:`${targetOrigin}/events`,secret:'outgoing-secret-123456789'}});assert.equal(r.status,201);
    r=await admin.request('/api/integrations/jobs',{method:'POST',body:{name:'Order Event Sync',sourceConnectionId:'webhook-in',targetConnectionId:'erp-out',eventType:'order.updated',maxRetries:2}});assert.equal(r.status,201);
    const webhookBody=JSON.stringify({eventId:'http-event-1',type:'order.updated',payload:{orderId:'HTTP-ORD-1'}}),sig=webhookSignature(Buffer.from(webhookBody),'incoming-secret-123456789');
    let hook=await fetch(`${origin}/api/webhooks/webhook-in`,{method:'POST',headers:{'content-type':'application/json','x-mono-signature':sig},body:webhookBody});assert.equal(hook.status,202);
    await runtime.workerTick();assert.equal(outboundCount,1);assert.match(outboundSignature,/^sha256=[0-9a-f]{64}$/);
    hook=await fetch(`${origin}/api/webhooks/webhook-in`,{method:'POST',headers:{'content-type':'application/json','x-mono-signature':sig},body:webhookBody});assert.equal(hook.status,200);assert.equal((await hook.json()).event.replayed,true);
    r=await admin.request('/api/integrations/runs');assert.equal(r.status,200);assert.ok(r.payload.items.some(x=>x.result==='SUCCESS'));
    r=await admin.request('/api/audit?limit=200');assert.equal(r.status,200);assert.ok(r.payload.items.some(x=>x.action==='REFUND_DECISION'));assert.ok(r.payload.items.some(x=>x.action==='HUMAN_REVIEW'));
  }finally{
    await runtime.close();await closeServer(provider);await closeServer(target);
  }
});
