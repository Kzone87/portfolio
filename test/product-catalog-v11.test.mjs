import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const home = await read('index.html');
const catalog = await read('services/index.html');
const productUi = await read('product-ui.css');
const sitemap = await read('sitemap.xml');
const commerce = await read('commerce-ops-console/index.html');
const field = await read('field-service-ops/index.html');
const docs = await read('document-intake-approval/index.html');
const ai = await read('ai-workflow-review-desk/index.html');
const integration = await read('integration-control-center/index.html');

const products = [
  '기존 웹사이트에 필요한 기능 추가',
  '엑셀·CSV 반복작업 자동화',
  '고객·직원·업무 관리자페이지 제작',
  '외부 API 데이터를 내 사이트에 자동 연동',
  'PDF·이미지 문서 값을 추출해 Excel·DB로 정리',
  '기존 서비스에 AI 요약·분류·초안 기능 추가',
  '쇼핑몰 주문·배송·환불 관리자페이지 제작',
  '예약·기사배정·현장업무 관리 시스템 제작',
  '공개 웹데이터를 자동 수집해 Excel로 정리',
  '기존 웹서비스 오류수정·기능개선·유지보수'
];

test('service catalog exposes ten concrete freelance products', () => {
  for (const product of products) assert.match(catalog, new RegExp(product.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.ok(home.includes('./services/feature-addition.html'));
  assert.ok(home.includes('./services/document-workflow.html'));
  assert.ok(home.includes('./services/ai-automation.html'));
});

test('new product pages are discoverable', () => {
  assert.match(sitemap, /services\/feature-addition\.html/);
  assert.match(sitemap, /services\/web-data-collection\.html/);
});

test('shared demo UI behaves like an operations product instead of a marketing page', () => {
  assert.match(productUi, /\.architecture\{display:none!important\}/);
  assert.match(productUi, /\.workspace\{grid-template-columns:minmax\(300px,360px\)/);
  assert.match(productUi, /\.table-wrap\{overflow:auto/);
  assert.match(productUi, /\.hero h1\{[^}]*font-size:clamp\(22px,2\.5vw,34px\)/s);
});

test('flagship demos use concrete operational labels', () => {
  assert.match(commerce, /주문 운영센터/);
  assert.match(commerce, /환불 승인 대기/);
  assert.match(field, /현장 배차센터/);
  assert.match(field, /기사별 현재 일정/);
  assert.match(docs, /문서 검수실/);
  assert.match(docs, /현재 검수 대기/);
  assert.match(ai, /AI 검토 데스크/);
  assert.match(ai, /문의·문서 대기열/);
  assert.match(integration, /연동 작업 운영센터/);
  assert.match(integration, /동기화 작업 목록/);
});

test('portfolio remains proof-only and does not add a local quote funnel', () => {
  const content = [home, catalog].join('\n');
  assert.doesNotMatch(content, /name="email"|name="phone"|문의 보내기|결제하기/);
  assert.match(content, /문의·견적·계약은 개발 수주 플랫폼에서 진행/);
});
