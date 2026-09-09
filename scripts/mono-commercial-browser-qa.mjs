import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { createCommercialRuntime } from '../mono-operations/server/commercial-app.mjs';
import { createCommercialStore } from '../mono-operations/server/commercial-store.mjs';
import { webhookSignature } from '../mono-operations/server/security.mjs';

const CHROME_PATH=process.env.CHROME_PATH;
if(!CHROME_PATH)throw new Error('CHROME_PATH_REQUIRED');
const artifacts=path.resolve('mono-commercial-live-qa-artifacts');fs.rmSync(artifacts,{recursive:true,force:true});fs.mkdirSync(artifacts,{recursive:true});
const secretKey=Buffer.alloc(32,31).toString('base64');
const passwords={admin:'Admin-Password-123!',operator:'Operator-Password-123!',reviewer:'Reviewer-Password-123!',manager:'Manager-Password-123!'};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mono-commercial-browser-')),dbPath=path.join(dir,'mono.sqlite');

function listen(server,port){return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve(`http://127.0.0.1:${server.address().port}`))})}
function closeServer(server){return new Promise(resolve=>server.close(()=>resolve()))}
function stub(handler){return http.createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);handler(req,res,Buffer.concat(chunks))})}
const provider=stub((req,res)=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({answer:'배송 지연 상태와 예상 일정을 안내하고 환불 요청은 별도 승인 절차로 전달합니다.',category:'DELIVERY',risk:'MEDIUM',confidence:.93,recommendedAction:'배송 상태 확인 후 고객 안내'})}}]}))});
const target=stub((req,res)=>{res.writeHead(204);res.end()});
await listen(provider,9898);await listen(target,9899);

const config={production:false,dbPath,secretKey,publicOrigin:'http://127.0.0.1:8796',providers:[{id:'qa-provider',baseUrl:'http://127.0.0.1:9898/v1',apiKey:'qa-server-only',model:'qa-model',timeoutMs:3000}],allowHosts:['127.0.0.1'],port:8796,bind:'127.0.0.1',trustProxy:false,sessionTtlSeconds:28800,integrationPollMs:500,bootstrapAdminEmail:'admin@example.com',bootstrapAdminName:'QA Admin',bootstrapAdminPassword:passwords.admin};
const runtime=createCommercialRuntime({config});
const adminId=runtime.store.db.prepare("SELECT id FROM users WHERE email='admin@example.com'").get().id;
const operator=runtime.store.createUser({actorId:adminId,email:'operator@example.com',name:'QA Operator',role:'OPERATOR',password:passwords.operator});
const reviewer=runtime.store.createUser({actorId:adminId,email:'reviewer@example.com',name:'QA Reviewer',role:'REVIEWER',password:passwords.reviewer});
runtime.store.createUser({actorId:adminId,email:'manager@example.com',name:'QA Manager',role:'MANAGER',password:passwords.manager});
runtime.store.createKnowledgeDoc(adminId,{title:'배송 지연 정책',body:'배송이 지연되면 현재 배송 상태와 예상 일정을 안내합니다. 환불은 별도 관리자 승인 절차를 따릅니다.',allowedRoles:['OPERATOR','REVIEWER','MANAGER','ADMIN']});
runtime.store.createIntegrationConnection(adminId,{id:'qa-in',name:'QA Webhook',kind:'INBOUND_WEBHOOK',secret:'qa-inbound-secret-123456789'});
runtime.store.createIntegrationConnection(adminId,{id:'qa-out',name:'QA Target',kind:'OUTBOUND_HTTP',endpointUrl:'http://127.0.0.1:9899/events',secret:'qa-outbound-secret-123456789'});
runtime.store.createIntegrationJob(adminId,{name:'QA Order Sync',sourceConnectionId:'qa-in',targetConnectionId:'qa-out',eventType:'order.updated',maxRetries:2});
await listen(runtime.server,8796);

const browser=await chromium.launch({executablePath:CHROME_PATH,headless:true,args:['--no-sandbox']});
const failures=[];
function attachGuards(page,label){page.on('pageerror',e=>failures.push(`${label} pageerror ${e.message}`));page.on('console',msg=>{if(msg.type()==='error')failures.push(`${label} console ${msg.text()}`)});page.on('requestfailed',req=>failures.push(`${label} requestfailed ${req.url()} ${req.failure()?.errorText||''}`));page.on('response',res=>{if(res.status()>=400)failures.push(`${label} HTTP ${res.status()} ${res.url()}`)})}
async function noOverflow(page,label){const x=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));if(x.sw>x.cw+1)failures.push(`${label} horizontal overflow ${x.sw}>${x.cw}`)}
async function login(page,email,password){await page.locator('#login-email').fill(email);await page.locator('#login-password').fill(password);await Promise.all([page.locator('#login-form button[type="submit"]').click(),page.locator('#app-shell').waitFor({state:'visible'})]);}
async function logout(page){await page.locator('#logout-btn').click();await page.locator('#login-screen').waitFor({state:'visible'});}

for(const [name,viewport] of Object.entries({desktop:{width:1440,height:1000},tablet:{width:768,height:1024},mobile:{width:390,height:844}})){
  const context=await browser.newContext({viewportSize:viewport});const page=await context.newPage();attachGuards(page,`render/${name}`);
  await page.goto('http://127.0.0.1:8796/',{waitUntil:'networkidle'});await page.getByRole('heading',{name:'업무 운영 Workspace'}).waitFor();await login(page,'admin@example.com',passwords.admin);await page.getByText('통합 업무함',{exact:true}).first().waitFor();assert.equal(await page.getByText('MONO OPERATIONS',{exact:true}).count()>0,true);await noOverflow(page,`render/${name}`);await page.screenshot({path:path.join(artifacts,`commercial-${name}.png`),fullPage:true});console.log(`PASS MONO commercial render ${viewport.width}x${viewport.height}`);await context.close();
}

const context=await browser.newContext({viewportSize:{width:1440,height:1000}});const page=await context.newPage();attachGuards(page,'workflow');
await page.goto('http://127.0.0.1:8796/',{waitUntil:'networkidle'});await login(page,'operator@example.com',passwords.operator);
await page.locator('button[data-view="market"]').click();await page.locator('[data-panel="market"]').waitFor({state:'visible'});await page.locator('#order-form input[name="customerName"]').fill('QA 실제고객');await page.locator('#order-form input[name="amount"]').fill('125000');const orderResponsePromise=page.waitForResponse(res=>res.url().endsWith('/api/orders')&&res.request().method()==='POST');await page.locator('#order-form button').click();const orderResponse=await orderResponsePromise;let orderResponseBody={};try{orderResponseBody=await orderResponse.json()}catch{}assert.equal(orderResponse.status(),201,`order POST failed: ${orderResponse.status()} ${JSON.stringify(orderResponseBody)} form=${await page.locator('[data-message="order"]').textContent()}`);await page.getByText('QA 실제고객').waitFor({state:'visible',timeout:5000});for(const status of ['PICKING','SHIPPED','DELIVERED']){const statusResponsePromise=page.waitForResponse(res=>res.url().includes('/api/orders/')&&res.url().endsWith('/status')&&res.request().method()==='POST');await page.locator(`[data-status="${status}"]`).click();const statusResponse=await statusResponsePromise;assert.equal(statusResponse.status(),200,`order status ${status} failed with ${statusResponse.status()}`);await page.getByText(new RegExp(status)).waitFor()}console.log('PASS MARKET create -> PICKING -> SHIPPED -> DELIVERED');

await page.locator('button[data-view="office"]').click();await page.locator('#document-form input[name="title"]').fill('QA 공급사 인보이스');await page.locator('#document-form textarea[name="sourceText"]').fill('Invoice QA-1001 amount 125000');await page.locator('#document-form button').click();await page.getByText('QA 공급사 인보이스').waitFor();await page.locator('[data-doc-submit]').click();await page.getByText(/SUBMITTED/).waitFor();await logout(page);await login(page,'reviewer@example.com',passwords.reviewer);await page.locator('button[data-view="office"]').click();page.once('dialog',d=>d.accept('원문과 금액 대조 확인 완료'));await page.locator('[data-doc-review]').click();await page.getByText(/APPROVED/).waitFor();await logout(page);await login(page,'admin@example.com',passwords.admin);await page.locator('button[data-view="office"]').click();await page.locator('[data-doc-archive]').click();await page.getByText(/ARCHIVED/).waitFor();console.log('PASS OFFICE author -> submit -> reviewer approve -> admin archive');

await logout(page);await login(page,'operator@example.com',passwords.operator);await page.locator('button[data-view="support"]').click();await page.locator('#support-form input[name="title"]').fill('QA 배송지연 문의');await page.locator('#support-form textarea[name="content"]').fill('배송이 늦어 환불 가능한지 고객이 문의했습니다.');await page.locator('#support-form button').click();await page.getByText('QA 배송지연 문의').waitFor();await page.locator('[data-generate]').click();await page.getByText(/NEEDS_REVIEW/).waitFor();await logout(page);await login(page,'reviewer@example.com',passwords.reviewer);await page.locator('button[data-view="support"]').click();page.once('dialog',d=>d.accept('정책 근거와 고객 안내 문구 확인 완료'));await page.locator('[data-support-approve]').click();await page.getByText(/APPROVED/).waitFor();console.log('PASS SUPPORT authorized evidence -> real provider boundary -> human review');

const webhookBody=JSON.stringify({eventId:'qa-live-event-1',type:'order.updated',payload:{orderId:'QA-ORDER'}});const hook=await fetch('http://127.0.0.1:8796/api/webhooks/qa-in',{method:'POST',headers:{'content-type':'application/json','x-mono-signature':webhookSignature(Buffer.from(webhookBody),'qa-inbound-secret-123456789')},body:webhookBody});assert.equal(hook.status,202);await runtime.workerTick();await logout(page);await login(page,'admin@example.com',passwords.admin);await page.locator('button[data-view="datahub"]').click();await page.getByText(/SUCCESS/).waitFor();console.log('PASS DATA HUB signed webhook -> persistent queue -> outbound success');

await page.locator('button[data-view="audit"]').click();await page.getByText(/HUMAN_REVIEW/).waitFor();await page.getByText(/DOCUMENT_REVIEW/).waitFor();await noOverflow(page,'workflow');await page.screenshot({path:path.join(artifacts,'commercial-workflow.png'),fullPage:true});console.log('PASS commercial audit visibility');
await context.close();await browser.close();

const persistedOrder=runtime.store.db.prepare("SELECT id FROM orders WHERE customer_name='QA 실제고객'").get();const persistedDoc=runtime.store.db.prepare("SELECT id,status FROM documents WHERE title='QA 공급사 인보이스'").get();const persistedSupport=runtime.store.db.prepare("SELECT id,status FROM support_tasks WHERE title='QA 배송지연 문의'").get();assert.ok(persistedOrder);assert.equal(persistedDoc.status,'ARCHIVED');assert.equal(persistedSupport.status,'APPROVED');
await runtime.close();
const reopened=createCommercialStore({dbPath,secretKey});try{assert.ok(reopened.db.prepare("SELECT id FROM orders WHERE customer_name='QA 실제고객'").get());assert.equal(reopened.db.prepare("SELECT status FROM documents WHERE title='QA 공급사 인보이스'").get().status,'ARCHIVED');assert.equal(reopened.db.prepare("SELECT status FROM support_tasks WHERE title='QA 배송지연 문의'").get().status,'APPROVED');console.log('PASS restart persistence')}finally{reopened.close()}
await closeServer(provider);await closeServer(target);
if(failures.length){console.error('\nMONO COMMERCIAL QA FAILURES');for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1}else console.log('\nMONO COMMERCIAL RUNTIME BROWSER QA: PASS');
