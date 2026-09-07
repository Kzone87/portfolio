import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const home = await load('index.html');
const homeCss = await load('home-domain.css');
const domain = await load('nexa-service-domain/index.html');
const domainCss = await load('nexa-service-domain/responsive-100.css');
const customer = await load('nexa-tech-service/index.html');
const customerResponsive = await load('nexa-tech-service/responsive-100.css');
const customerClarity = await load('nexa-tech-service/clarity.css');
const ops = await load('field-service-ops/index.html');
const opsCss = await load('field-service-ops/responsive-100.css');

function visible(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

test('each NEXA surface keeps its own role vocabulary', () => {
  const portfolioText = visible(home);
  const domainText = visible(domain);
  const customerText = visible(customer);
  const opsText = visible(ops);

  for (const phrase of ['ENGINEERING EVIDENCE','Field Ops Source','Domain Tests']) assert.ok(portfolioText.includes(phrase), `portfolio missing ${phrase}`);
  for (const phrase of ['상담이 끝난 뒤','고객에게는','상담 시작하기']) assert.ok(domainText.includes(phrase), `customer journey missing ${phrase}`);
  for (const phrase of ['기업용 출력·인쇄·사무장비 유지보수','정기점검','고장 대응','유지보수 상담']) assert.ok(customerText.includes(phrase), `customer site missing ${phrase}`);
  for (const phrase of ['배차 현황','배차 기준일','기사별 일정','방문 요청','작업 상태']) assert.ok(opsText.includes(phrase), `operations workspace missing ${phrase}`);

  assert.doesNotMatch(customerText, /ENGINEERING EVIDENCE|SLOT_CONFLICT|Server-side RBAC|Domain Tests/);
  assert.doesNotMatch(domainText, /REQUESTED|SCHEDULED|DISPATCHED|ON_SITE|STALE_JOB|SLOT_CONFLICT/);
  assert.doesNotMatch(opsText, /ENGINEERING EVIDENCE|포트폴리오|고객 서비스 화면/);
});

test('all four NEXA areas contain explicit flex-grid overflow safeguards', () => {
  for (const [name, css] of [['portfolio', homeCss], ['domain', domainCss], ['customer', customerResponsive], ['operations', opsCss]]) {
    assert.match(css, /min-width:0/, `${name} missing min-width safeguard`);
    assert.match(css, /overflow-wrap:anywhere/, `${name} missing text overflow safeguard`);
    assert.doesNotMatch(css, /overflow-x:hidden/, `${name} must not hide horizontal layout defects`);
  }
});

test('customer and operations products load their responsive hardening layer', () => {
  assert.match(domain, /responsive-100\.css/);
  assert.match(customerClarity, /@import url\("\.\/responsive-100\.css"\)/);
  assert.match(ops, /responsive-100\.css/);
});

test('narrow-screen rules cover phone widths and preserve intentional schedule scrolling', () => {
  assert.match(domainCss, /max-width:380px/);
  assert.match(customerResponsive, /max-width:380px/);
  assert.match(opsCss, /max-width:420px/);
  assert.match(opsCss, /schedule-head/);
  assert.doesNotMatch(opsCss, /agent-board\{[^}]*overflow:hidden/);
});
