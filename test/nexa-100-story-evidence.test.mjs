import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const portfolio = await load('index.html');
const portfolioCss = await load('home-domain.css');
const journey = await load('nexa-service-domain/index.html');
const playbook = await load('nexa-tech-service/playbook.html');
const customerPages = await Promise.all(['index.html','about.html','services.html','industries.html','cases.html','playbook.html','contact.html'].map(page => load(`nexa-tech-service/${page}`)));
const staff = await load('field-service-ops/index.html');

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
  assert.match(portfolioCss, /@media\(max-width:700px\)/);
});

test('service domain is a customer journey while playbook remains the detailed service procedure', () => {
  for (const phrase of ['상담이 끝난 뒤','내 요청은 어디까지','상담 완료','지원 확인','방문 확정','방문·작업','결과 안내','후속관리','고객이 보게 되는 진행상황']) {
    assert.ok(journey.includes(phrase), `journey missing ${phrase}`);
  }
  for (const phrase of ['1. 고장 접수','2. 방문 전 안내','3. 현장 작업','4. 작업 결과 안내','5. 후속 작업']) {
    assert.ok(playbook.includes(phrase), `playbook lost detailed procedure ${phrase}`);
  }
  assert.match(journey, /href="\.\.\/nexa-tech-service\/playbook\.html"/);
  assert.match(journey, /현장 서비스 절차 자세히 보기/);
  assert.ok(!journey.includes('1. 고장 접수'), 'journey must not duplicate the detailed playbook structure');
  assert.ok(!journey.includes('2. 방문 전 안내'), 'journey must not duplicate the detailed playbook structure');
});

test('journey page speaks only to the customer and does not reveal the staff implementation', () => {
  const body = withoutFooter(journey);
  for (const forbidden of ['KZONE87','Portfolio','FIELD OPS','NEXA SERVICE OPERATIONS','../field-service-ops/','REQUESTED','SCHEDULED','DISPATCHED','ON_SITE','SLOT_CONFLICT','expectedVersion']) {
    assert.ok(!body.includes(forbidden), `journey leaks internal or portfolio language: ${forbidden}`);
  }
  assert.match(body, /내부 처리 용어를 외울 필요는 없습니다/);
});

test('customer and staff product surfaces keep their strict audience boundary after portfolio evidence is added', () => {
  const customer = customerPages.map(withoutFooter).join('\n');
  for (const forbidden of ['ENGINEERING EVIDENCE','Server-side RBAC','SLOT_CONFLICT','expectedVersion','Field Ops Source','NEXA SERVICE OPERATIONS']) {
    assert.ok(!customer.includes(forbidden), `customer product leaks portfolio engineering evidence: ${forbidden}`);
  }
  for (const forbidden of ['ENGINEERING EVIDENCE','Field Ops Source','포트폴리오','프로젝트 설명']) {
    assert.ok(!staff.includes(forbidden), `staff workspace leaks portfolio narration: ${forbidden}`);
  }
});
