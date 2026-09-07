import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const portfolio = await load('index.html');
const portfolioCss = await load('home-domain.css');
const portal = await load('nexa-service-domain/index.html');
const portalApp = await load('nexa-service-domain/app.js');
const playbook = await load('nexa-tech-service/playbook.html');
const customerPages = await Promise.all(['index.html','about.html','services.html','industries.html','cases.html','playbook.html','contact.html'].map(page => load(`nexa-tech-service/${page}`)));
const customerApp = await load('nexa-tech-service/app.js');
const staff = await load('field-service-ops/index.html');
const staffApp = await load('field-service-ops/app.js');

const withoutFooter = html => html.replace(/<footer[\s\S]*?<\/footer>/i, '');

test('portfolio NEXA card exposes operational engineering evidence without reverting to architecture narration', () => {
  for (const phrase of [
    'ENGINEERING EVIDENCE',
    '일정 충돌 차단 · stale update 방어',
    'SLOT_CONFLICT · expectedVersion',
    'Server-side RBAC · Audit · SQLite',
    'REST API · Domain Tests · Node 24 CI',
    'Field Ops Source',
    'Domain Tests'
  ]) assert.ok(portfolio.includes(phrase), `portfolio missing engineering evidence: ${phrase}`);
  assert.match(portfolio, /href="https:\/\/github\.com\/Kzone87\/portfolio\/tree\/main\/field-service-ops"/);
  assert.match(portfolio, /href="https:\/\/github\.com\/Kzone87\/portfolio\/blob\/main\/test\/field-service-ops\.test\.mjs"/);
  assert.doesNotMatch(portfolio, /왜 두 화면인가|역할 분리|구현 근거|ONE DOMAIN · TWO SURFACES/);
  assert.match(portfolioCss, /\.nexa-engineering-proof/);
  assert.match(portfolioCss, /\.nexa-proof-grid/);
});

test('service domain is an actual customer request portal while playbook remains the service procedure', () => {
  for (const phrase of ['서비스 요청 조회','접수번호','연락처 뒤 4자리','현재 진행상태','방문 정보','요청 처리 현황','방문 전 준비','최근 안내','작업 결과']) {
    assert.ok(portal.includes(phrase), `portal missing ${phrase}`);
  }
  for (const phrase of ['1. 고장 접수','2. 방문 전 안내','3. 현장 작업','4. 작업 결과 안내','5. 후속 작업']) {
    assert.ok(playbook.includes(phrase), `playbook lost detailed procedure ${phrase}`);
  }
  assert.match(portalApp, /\/api\/customer\/requests\/lookup/);
  assert.match(portalApp, /NEXA_CUSTOMER_PORTAL_ENDPOINT/);
  assert.ok(!portal.includes('1. 고장 접수'), 'portal must not duplicate the detailed playbook structure');
});

test('customer portal exposes customer state, never internal implementation state', () => {
  const body = withoutFooter(portal);
  for (const forbidden of ['KZONE87','Portfolio','FIELD OPS','NEXA SERVICE OPERATIONS','../field-service-ops/','REQUESTED','SCHEDULED','DISPATCHED','ON_SITE','SLOT_CONFLICT','expectedVersion']) {
    assert.ok(!body.includes(forbidden), `portal leaks internal or portfolio language: ${forbidden}`);
  }
  for (const phrase of ['상담 접수','지원 확인','방문 확정','방문·작업','결과 안내','후속관리']) assert.match(body, new RegExp(phrase));
});

test('customer website routes existing customers to the portal without exposing staff operations', () => {
  const customer = customerPages.map(withoutFooter).join('\n');
  assert.match(customerApp, /진행 조회/);
  assert.match(customerApp, /접수 진행 확인/);
  assert.match(customerApp, /이 요청 진행 조회하기/);
  assert.match(customerApp, /nexa-service-domain/);
  for (const forbidden of ['ENGINEERING EVIDENCE','Server-side RBAC','SLOT_CONFLICT','expectedVersion','Field Ops Source','NEXA SERVICE OPERATIONS']) {
    assert.ok(!customer.includes(forbidden), `customer product leaks portfolio engineering evidence: ${forbidden}`);
  }
});

test('staff workspace looks like a signed-in product, not a role-switching demo', () => {
  for (const phrase of ['서울 운영팀','김현수','운영 관리자']) assert.match(staff, new RegExp(phrase));
  assert.doesNotMatch(staff, /id="role"|현재 역할/);
  assert.match(staffApp, /CURRENT_USER/);
  assert.doesNotMatch(staffApp, /el\.role\.addEventListener/);
  for (const forbidden of ['ENGINEERING EVIDENCE','Field Ops Source','포트폴리오','프로젝트 설명']) {
    assert.ok(!staff.includes(forbidden), `staff workspace leaks portfolio narration: ${forbidden}`);
  }
});
