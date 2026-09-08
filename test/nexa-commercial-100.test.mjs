import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createProjectInquiryStore, createProjectInquiryServer, runtimeProjectInquiryOptions } from '../portfolio-inquiry/server.mjs';
import { createInquiryStore } from '../nexa-tech-service/server/inquiry-store.mjs';
import { createCustomerAccessStore } from '../nexa-tech-service/server/customer-access-store.mjs';
import { createCustomerAccessServer, runtimeCustomerAccessOptions } from '../nexa-tech-service/server/customer-access-server.mjs';
import { createInquiryServer, runtimeInquiryOptions } from '../nexa-tech-service/server/app.mjs';
import { createStore } from '../field-service-ops/server/store.mjs';
import { createAuthStore } from '../field-service-ops/server/auth-store.mjs';
import { createFieldServiceServer } from '../field-service-ops/server/app.mjs';

const PROJECT_ORIGIN='https://portfolio.example';
const CUSTOMER_ORIGIN='https://service.example';
const OPS_ORIGIN='https://ops.example';
const adminToken='commercial-admin-token-000000';
const staffPassword='commercial-field-staff-123';
const load=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

async function listen(server){server.listen(0,'127.0.0.1');await once(server,'listening');return `http://127.0.0.1:${server.address().port}`}
async function stop(server){if(!server.listening)return;server.close();await once(server,'close')}
async function json(root,path,{method='GET',origin='',cookie='',csrf='',authorization='',body}={}){
  const response=await fetch(`${root}${path}`,{method,headers:{accept:'application/json',...(origin?{origin}:{}),...(cookie?{cookie}:{}),...(csrf?{'x-csrf-token':csrf}:{}),...(authorization?{authorization}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  return {response,body:await response.json().catch(()=>({}))};
}
const inquiryPayload=(company='상용검수상사')=>({company,name:'고객담당자',phone:'010-2468-1357',email:'customer@example.com',industry:'기업·교육·공공 사무환경',sites:'1개 사업장',assets:'1–5대',impact:'처리량·품질에 큰 영향이 생김',service:'고장·장애 현장지원',engagement:'고장 날 때 현장지원',detail:'출력 품질이 불안정해서 현장 방문 점검이 필요합니다.',consent:true});

async function login(root,username,password){
  const result=await json(root,'/api/auth/login',{method:'POST',origin:OPS_ORIGIN,body:{username,password}});
  const cookie=String(result.response.headers.get('set-cookie')||'').split(';')[0];
  return {...result,cookie,csrf:result.body.csrfToken};
}

test('commercial portfolio has a private-inquiry capable sales path and delivery process without invented contact data',async()=>{
  const [home,brief,app,css]=await Promise.all([load('index.html'),load('project-inquiry/index.html'),load('project-inquiry/app.js'),load('commercial-portfolio.css')]);
  assert.match(home,/project-inquiry\//);
  for(const copy of ['요구사항','범위·견적','개발·검수','배포·인수인계'])assert.match(home,new RegExp(copy));
  assert.match(brief,/회사·조직명/);assert.match(brief,/회신 이메일/);assert.match(brief,/현재 업무/);
  assert.match(app,/KZONE_PROJECT_INQUIRY_ENDPOINT/);assert.match(app,/서버로 전송하지 않습니다|전송되지 않습니다/);
  assert.match(css,/project-inquiry|delivery/i);
  assert.doesNotMatch(home,/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  assert.match(css,/@media\(min-width:1101px\)\{\.contact-shell\{display:grid/);
});

test('private project inquiry API persists low-risk briefs, rate limits, checks origin and protects admin workflow',async()=>{
  const store=createProjectInquiryStore();
  const server=createProjectInquiryServer(store,{allowedOrigins:[PROJECT_ORIGIN],admins:[{id:'owner',token:adminToken}],rateMax:2,rateWindowMs:60_000});
  const root=await listen(server);
  try{
    const payload={company:'의뢰기업',name:'담당자',email:'buyer@example.com',projectType:'관리자·사내 업무 시스템',budgetRange:'범위 협의',desiredStart:'협의 가능',detail:'여러 지점의 수기 업무를 하나의 운영 시스템으로 바꾸고 싶습니다.',consent:true};
    const created=await json(root,'/api/project-inquiries',{method:'POST',origin:PROJECT_ORIGIN,body:payload});
    assert.equal(created.response.status,201);assert.match(created.body.id,/^KZ-/);assert.equal(created.body.status,'NEW');
    const badOrigin=await json(root,'/api/project-inquiries',{method:'POST',origin:'https://attacker.example',body:payload});
    assert.equal(badOrigin.response.status,403);
    const noAdmin=await json(root,'/api/admin/project-inquiries',{origin:PROJECT_ORIGIN});assert.equal(noAdmin.response.status,401);
    const list=await json(root,'/api/admin/project-inquiries',{origin:PROJECT_ORIGIN,authorization:`Bearer ${adminToken}`});assert.equal(list.response.status,200);assert.equal(list.body.items.length,1);assert.equal(list.body.items[0].email,'buyer@example.com');
    const contacted=await json(root,`/api/admin/project-inquiries/${created.body.id}/status`,{method:'POST',origin:PROJECT_ORIGIN,authorization:`Bearer ${adminToken}`,body:{status:'CONTACTED'}});assert.equal(contacted.response.status,200);assert.equal(contacted.body.status,'CONTACTED');
    const second=await json(root,'/api/project-inquiries',{method:'POST',origin:PROJECT_ORIGIN,body:{...payload,email:'buyer2@example.com'}});assert.equal(second.response.status,201);
    const limited=await json(root,'/api/project-inquiries',{method:'POST',origin:PROJECT_ORIGIN,body:{...payload,email:'buyer3@example.com'}});assert.equal(limited.response.status,429);
  }finally{await stop(server);store.close()}
});

test('commercial runtime configs fail closed in production',()=>{
  assert.throws(()=>runtimeProjectInquiryOptions({NODE_ENV:'production'}),/ALLOWED_ORIGINS|ADMINS_JSON/);
  assert.throws(()=>runtimeCustomerAccessOptions({NODE_ENV:'production',NEXA_CUSTOMER_ALLOWED_ORIGINS:'https://service.example'}),/OTP_WEBHOOK_URL/);
  const customer=runtimeCustomerAccessOptions({NODE_ENV:'production',NEXA_CUSTOMER_ALLOWED_ORIGINS:'https://service.example',NEXA_CUSTOMER_OTP_WEBHOOK_URL:'https://otp.example/send'});
  assert.equal(customer.secureCookies,true);assert.deepEqual(customer.allowedOrigins,['https://service.example']);
});



test('production inquiry API disables legacy phone-based customer access by default',async()=>{
  const options=runtimeInquiryOptions({NODE_ENV:'production',NEXA_INQUIRY_ALLOWED_ORIGINS:CUSTOMER_ORIGIN,NEXA_INQUIRY_ADMINS_JSON:JSON.stringify([{id:'admin',token:'production-admin-token-000000'}])});
  assert.equal(options.allowLegacyCustomerAccess,false);
  const store=createInquiryStore();const created=store.create(inquiryPayload('레거시차단상사'));
  const server=createInquiryServer(store,{...options,admins:[{id:'admin',token:'production-admin-token-000000'}]});const root=await listen(server);
  try{
    const lookup=await json(root,'/api/customer/requests/lookup',{method:'POST',origin:CUSTOMER_ORIGIN,body:{id:created.id,phone:'010-2468-1357'}});
    assert.equal(lookup.response.status,404);assert.equal(lookup.body.error.code,'NOT_FOUND');
    const action=await json(root,'/api/customer/requests/action',{method:'POST',origin:CUSTOMER_ORIGIN,body:{id:created.id,phone:'010-2468-1357',type:'MESSAGE',note:'우회 요청'}});
    assert.equal(action.response.status,404);assert.equal(store.get(created.id).customerActions.length,0);
  }finally{await stop(server);store.close()}
});
test('customer secure access is enumeration-resistant, one-time, session-based and CSRF-protected',async()=>{
  const inquiryStore=createInquiryStore();
  const created=inquiryStore.create(inquiryPayload());
  const contacted=inquiryStore.transition(created.id,1,'CONTACTED','staff');
  const prepared=inquiryStore.prepareVisitRequest(created.id,contacted.version,{address:'서울 중구 세종대로 10',summary:'출력 품질 점검',priority:'NORMAL'},'staff');
  inquiryStore.completeVisitRequest(created.id,41,'staff');
  const accessStore=createCustomerAccessStore();
  const delivered=[];
  const fieldOpsClient={async getVisitRequest(){return {id:41,status:'COMPLETED',priority:'NORMAL',startAt:'2026-09-10T05:00:00.000Z',endAt:'2026-09-10T06:00:00.000Z',address:'서울 중구 세종대로 10',summary:'출력 품질 점검',agentAssigned:true,updates:[{action:'COMPLETE',createdAt:'2026-09-10T06:00:00.000Z'}],fieldReport:{checks:{customer:true,access:true,result:true},note:'급지와 출력 품질을 점검하고 테스트 출력으로 정상 상태를 확인했습니다.',photo:null,updatedAt:'2026-09-10T05:58:00.000Z'}}}};
  const server=createCustomerAccessServer({inquiryStore,accessStore,fieldOpsClient,allowedOrigins:[CUSTOMER_ORIGIN],secureCookies:true,rateMax:5,sendOtp:async payload=>delivered.push(payload)});
  const root=await listen(server);
  try{
    const unknown=await json(root,'/api/customer/access/challenge',{method:'POST',origin:CUSTOMER_ORIGIN,body:{id:'NX-UNKNOWN999',channel:'sms'}});
    assert.equal(unknown.response.status,202);assert.equal(delivered.length,0);assert.ok(unknown.body.challengeId);
    const challenge=await json(root,'/api/customer/access/challenge',{method:'POST',origin:CUSTOMER_ORIGIN,body:{id:created.id,channel:'sms'}});
    assert.equal(challenge.response.status,202);assert.equal(delivered.length,1);assert.equal(delivered[0].requestId,created.id);assert.match(delivered[0].code,/^\d{6}$/);
    const wrong=await json(root,'/api/customer/access/verify',{method:'POST',origin:CUSTOMER_ORIGIN,body:{challengeId:challenge.body.challengeId,code:'000000'}});assert.equal(wrong.response.status,401);
    const verified=await json(root,'/api/customer/access/verify',{method:'POST',origin:CUSTOMER_ORIGIN,body:{challengeId:challenge.body.challengeId,code:delivered[0].code}});assert.equal(verified.response.status,200);assert.ok(verified.body.csrfToken);
    const cookieHeader=verified.response.headers.get('set-cookie')||'';assert.match(cookieHeader,/nexa_customer_session=/);assert.match(cookieHeader,/HttpOnly/i);assert.match(cookieHeader,/SameSite=Lax/i);assert.match(cookieHeader,/Secure/i);
    const cookie=cookieHeader.split(';')[0];
    const replay=await json(root,'/api/customer/access/verify',{method:'POST',origin:CUSTOMER_ORIGIN,body:{challengeId:challenge.body.challengeId,code:delivered[0].code}});assert.equal(replay.response.status,401);
    const report=await json(root,`/api/customer/access/report?requestId=${created.id}`,{origin:CUSTOMER_ORIGIN,cookie});assert.equal(report.response.status,200);assert.match(report.body.fieldReport.note,/테스트 출력/);assert.equal(report.body.fieldReport.checks.result,true);
    const noCsrf=await json(root,'/api/customer/access/action',{method:'POST',origin:CUSTOMER_ORIGIN,cookie,body:{type:'MESSAGE',note:'재방문이 필요한지 확인 부탁드립니다.'}});assert.equal(noCsrf.response.status,403);
    const secureUi=await load('nexa-service-domain/secure-access.js');const secureCss=await load('nexa-service-domain/secure-access.css');assert.match(secureUi,/timeZone:'Asia\/Seoul'/);assert.match(secureCss,/request-view\[hidden\].*display:none!important/s);
    const action=await json(root,'/api/customer/access/action',{method:'POST',origin:CUSTOMER_ORIGIN,cookie,csrf:verified.body.csrfToken,body:{type:'MESSAGE',note:'[재방문 요청] 같은 증상이 다시 발생했습니다.'}});assert.equal(action.response.status,201);assert.equal(action.body.action.state,'OPEN');
  }finally{await stop(server);accessStore.close();inquiryStore.close()}
});

test('customer challenge has client-wide throttling even when request ids are varied',async()=>{
  const inquiryStore=createInquiryStore();const accessStore=createCustomerAccessStore();
  const server=createCustomerAccessServer({inquiryStore,accessStore,allowedOrigins:[CUSTOMER_ORIGIN],rateMax:2,rateWindowMs:60_000,sendOtp:async()=>{}});const root=await listen(server);
  try{
    for(const id of ['NX-FAKE000001','NX-FAKE000002']){const result=await json(root,'/api/customer/access/challenge',{method:'POST',origin:CUSTOMER_ORIGIN,body:{id,channel:'sms'}});assert.equal(result.response.status,202)}
    const limited=await json(root,'/api/customer/access/challenge',{method:'POST',origin:CUSTOMER_ORIGIN,body:{id:'NX-FAKE000003',channel:'email'}});assert.equal(limited.response.status,429);
  }finally{await stop(server);accessStore.close();inquiryStore.close()}
});

test('field employee identity is explicitly linked to an agent and cannot operate another agent job',async()=>{
  const store=createStore();
  const authStore=createAuthStore(':memory:',{bootstrapAdmin:{id:'admin',username:'admin',name:'운영관리자',team:'서울 운영팀',password:'commercial-admin-123'}});
  authStore.createUser({id:'field-1',username:'field1',name:'현장기사1',team:'서울 운영팀',agentId:1,role:'STAFF',password:staffPassword},'admin');
  const server=createFieldServiceServer(store,{requireAuth:true,authStore,allowedOrigins:[OPS_ORIGIN]});const root=await listen(server);
  try{
    const session=await login(root,'field1',staffPassword);assert.equal(session.response.status,200);assert.equal(session.body.principal.agentId,1);
    const me=await json(root,'/api/me',{origin:OPS_ORIGIN,cookie:session.cookie});assert.equal(me.body.agentId,1);
    const dispatch=await json(root,'/api/jobs/1/dispatch',{method:'POST',origin:OPS_ORIGIN,cookie:session.cookie,csrf:session.csrf,body:{expectedVersion:2}});assert.equal(dispatch.response.status,200);
    const onsite=await json(root,'/api/jobs/1/on-site',{method:'POST',origin:OPS_ORIGIN,cookie:session.cookie,csrf:session.csrf,body:{expectedVersion:dispatch.body.version}});assert.equal(onsite.response.status,200);
    const premature=await json(root,'/api/jobs/1/complete',{method:'POST',origin:OPS_ORIGIN,cookie:session.cookie,csrf:session.csrf,body:{expectedVersion:onsite.body.version}});assert.equal(premature.response.status,409);assert.equal(premature.body.error.code,'FIELD_REPORT_REQUIRED');
    const other=await json(root,'/api/jobs/2/report',{method:'POST',origin:OPS_ORIGIN,cookie:session.cookie,csrf:session.csrf,body:{checks:{customer:true,access:true,result:true},note:'다른 기사 작업'}});assert.equal(other.response.status,403);assert.equal(other.body.error.code,'FIELD_JOB_NOT_ASSIGNED');
    const report=await json(root,'/api/jobs/1/report',{method:'POST',origin:OPS_ORIGIN,cookie:session.cookie,csrf:session.csrf,body:{checks:{customer:true,access:true,result:true},note:'고객 요청과 현장 환경을 확인하고 테스트 출력으로 정상 상태를 확인했습니다.'}});assert.equal(report.response.status,200);assert.equal(report.body.updatedBy,'field-1');
    const done=await json(root,'/api/jobs/1/complete',{method:'POST',origin:OPS_ORIGIN,cookie:session.cookie,csrf:session.csrf,body:{expectedVersion:onsite.body.version}});assert.equal(done.response.status,200);assert.equal(done.body.status,'COMPLETED');
  }finally{await stop(server);authStore.close()}
});

test('commercial operations UI uses real scheduling contracts and never renders synthetic map pins',async()=>{
  const [html,bootstrap,workspace,css,team]=await Promise.all([load('field-service-ops/index.html'),load('field-service-ops/app.js'),load('field-service-ops/commercial-workspace.mjs'),load('field-service-ops/commercial-workspace.css'),load('field-service-ops/team-admin.mjs')]);
  assert.match(bootstrap,/import\('\.\/commercial-workspace\.mjs'\)/);
  for(const label of ['일간','주간','주소·지도','기사 현장'])assert.match(workspace,new RegExp(label));
  assert.match(workspace,/draggable/);assert.match(workspace,/dataTransfer/);assert.match(workspace,/08:00–18:00/);assert.match(workspace,/map\.naver\.com/);
  assert.doesNotMatch(workspace,/pinPos|map-pin|synthetic|가짜 좌표/);assert.doesNotMatch(css,/map-pin|map-canvas/);
  assert.match(workspace,/principal\.agentId/);assert.match(team,/agentId/);assert.match(html,/team-agent/);assert.match(html,/new-user-agent/);
  assert.match(workspace,/field-report/);assert.match(workspace,/photo/);
});

test('NEXA commercial service pages state support and contract boundaries without fabricated SLA claims',async()=>{
  const [home,services,contact,playbook]=await Promise.all([load('nexa-tech-service/index.html'),load('nexa-tech-service/services.html'),load('nexa-tech-service/contact.html'),load('nexa-tech-service/playbook.html')]);
  const all=[home,services,contact,playbook].join('\n');
  for(const copy of ['정기','현장지원','설치·이전','지원 가능','부품','제조사 정책','작업 결과'])assert.match(all,new RegExp(copy));
  assert.doesNotMatch(all,/99\.9%|24\/7|30분 이내|1시간 이내|SLA 보장|전국 당일/);
  const scope=await load('nexa-tech-service/commercial-scope.js');assert.doesNotMatch(scope,/공개 시연|포트폴리오/);assert.match(scope,/page==='other'\)return/);
});
