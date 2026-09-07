import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const home = await load('index.html');
const homeCss = await load('home-domain.css');
const portal = await load('nexa-service-domain/index.html');
const portalCss = await load('nexa-service-domain/styles.css');
const customer = await load('nexa-tech-service/index.html');
const customerResponsive = await load('nexa-tech-service/responsive-100.css');
const customerClarity = await load('nexa-tech-service/clarity.css');
const ops = await load('field-service-ops/index.html');
const opsCss = await load('field-service-ops/responsive-100.css');

function visible(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

test('each NEXA surface keeps its real-user vocabulary', () => {
  const portfolioText = visible(home);
  const portalText = visible(portal);
  const customerText = visible(customer);
  const opsText = visible(ops);

  for (const phrase of ['ENGINEERING EVIDENCE','Field Ops Source','Domain Tests']) assert.ok(portfolioText.includes(phrase), `portfolio missing ${phrase}`);
  for (const phrase of ['서비스 요청 조회','접수번호','현재 진행상태','방문 정보','요청 처리 현황']) assert.ok(portalText.includes(phrase), `customer portal missing ${phrase}`);
  for (const phrase of ['기업용 출력·인쇄·사무장비 유지보수','정기점검','고장 대응','유지보수 상담']) assert.ok(customerText.includes(phrase), `customer site missing ${phrase}`);
  for (const phrase of ['9월 7일 배차 현황','운영 기준일','서울 운영팀','김현수','기사별 일정','방문 요청','작업 상태']) assert.ok(opsText.includes(phrase), `operations workspace missing ${phrase}`);

  assert.doesNotMatch(customerText, /ENGINEERING EVIDENCE|SLOT_CONFLICT|Server-side RBAC|Domain Tests/);
  assert.doesNotMatch(portalText, /REQUESTED|SCHEDULED|DISPATCHED|ON_SITE|STALE_JOB|SLOT_CONFLICT|expectedVersion/);
  assert.doesNotMatch(opsText, /ENGINEERING EVIDENCE|포트폴리오|고객 서비스 화면/);
});

test('all four NEXA areas contain explicit flex-grid overflow safeguards', () => {
  for (const [name, css] of [['portfolio', homeCss], ['portal', portalCss], ['customer', customerResponsive], ['operations', opsCss]]) {
    assert.match(css, /min-width:0/, `${name} missing min-width safeguard`);
    assert.match(css, /overflow-wrap:anywhere/, `${name} missing text overflow safeguard`);
    assert.doesNotMatch(css, /overflow-x:hidden/, `${name} must not hide horizontal layout defects`);
  }
});

test('customer products and operations include narrow-screen product layouts', () => {
  assert.match(portalCss, /@media\(max-width:680px\)/);
  assert.match(portalCss, /@media\(max-width:420px\)/);
  assert.match(customerClarity, /@import url\("\.\/responsive-100\.css"\)/);
  assert.match(customerResponsive, /max-width:380px/);
  assert.match(ops, /responsive-100\.css/);
  assert.match(opsCss, /max-width:420px/);
  assert.match(opsCss, /signed-user/);
});

test('operations preserves intentional schedule scrolling instead of hiding overflow defects', () => {
  assert.match(opsCss, /schedule-head/);
  assert.doesNotMatch(opsCss, /agent-board\{[^}]*overflow:hidden/);
});
