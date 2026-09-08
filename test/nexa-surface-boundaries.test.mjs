import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const customerPages = ['index.html','about.html','services.html','industries.html','cases.html','playbook.html','contact.html'];
const customers = await Promise.all(customerPages.map(page => load(`nexa-tech-service/${page}`)));
const portfolio = await load('index.html');
const portal = await load('nexa-service-domain/index.html');
const portalApp = await load('nexa-service-domain/app.js');
const ops = await load('field-service-ops/index.html');
const opsApp = await load('field-service-ops/app.js');

const stripFooter = html => html.replace(/<footer[\s\S]*?<\/footer>/i, '');

test('customer-facing NEXA contains customer actions, not portfolio narration', () => {
  const body = customers.map(stripFooter).join('\n');
  for (const phrase of ['서비스','이용 고객','이용 상황','상담']) assert.ok(body.includes(phrase));
  for (const forbidden of ['포트폴리오','프로젝트 설명','구현 근거','역할 분리','ONE DOMAIN','FIELD OPS','NEXA Service Operations']) {
    assert.ok(!body.includes(forbidden), `customer surface leaks ${forbidden}`);
  }
});

test('portfolio summary speaks in customer outcomes while routing to the NEXA bundle', () => {
  for (const phrase of ['NEXA SERVICE SUITE','고객 상담부터 현장 완료까지, 하나로 이어지는 서비스 운영 시스템','서비스 홈페이지 열기','고객 서비스 열기','운영 Workspace 열기']) assert.ok(portfolio.includes(phrase));
  for (const href of ['./nexa-tech-service/','./nexa-service-domain/','./field-service-ops/']) assert.ok(portfolio.includes(`href="${href}"`), `portfolio missing ${href}`);
  for (const forbidden of ['왜 두 화면인가','역할 분리','구현 근거','ONE DOMAIN · TWO SURFACES','01 · 고객 서비스 화면','02 · 직원 배차 화면']) assert.ok(!portfolio.includes(forbidden), `portfolio leaks design narration ${forbidden}`);
});

test('NEXA customer service is a request portal, not an explanatory case-study page', () => {
  for (const phrase of ['서비스 요청 조회','접수번호','상담 연락처','현재 진행상태','방문 정보','요청 처리 현황','방문 전 준비','최근 안내','작업 결과']) {
    assert.ok(portal.includes(phrase), `customer portal missing ${phrase}`);
  }
  assert.match(portal, /id="lookup-form"/);
  assert.match(portal, /id="request-view"/);
  assert.match(portalApp, /NEXA_CUSTOMER_PORTAL_ENDPOINT/);
  assert.match(portalApp, /\/api\/customer\/requests\/lookup/);
  assert.ok(portal.includes('../nexa-tech-service/contact.html'));
  for (const forbidden of ['왜 두 화면인가','역할 분리','구현 근거','직원용 현장 운영','../field-service-ops/','SLOT_CONFLICT','expectedVersion']) {
    assert.ok(!stripFooter(portal).includes(forbidden), `customer portal leaks internal narration ${forbidden}`);
  }
});

test('field operations is a signed-in operational workspace with no demo role switch', () => {
  for (const phrase of ['NEXA SERVICE OPERATIONS','서울 운영팀','김현수','운영 관리자','9월 7일 배차 현황','운영 기준일','기사별 일정','방문 요청','우선 확인할 항목','최근 변경 이력']) {
    assert.ok(ops.includes(phrase), `operations missing ${phrase}`);
  }
  assert.doesNotMatch(ops, /id="role"|현재 역할/);
  assert.match(opsApp, /CURRENT_USER/);
  assert.doesNotMatch(opsApp, /el\.role\.addEventListener/);
  for (const forbidden of ['포트폴리오','프로젝트 구조','고객용 홈페이지','이 시스템은']) assert.ok(!ops.includes(forbidden), `ops surface leaks ${forbidden}`);
});
