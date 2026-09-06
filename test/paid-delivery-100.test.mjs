import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const productPages = [
  'commerce-ops-console/index.html',
  'field-service-ops/index.html',
  'document-intake-approval/index.html',
  'ai-workflow-review-desk/index.html',
  'integration-control-center/index.html',
  'mini-labs/index.html'
];

function visibleText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

test('internal products present a client-grade identity instead of sample/demo chrome', async () => {
  const expectedBrands = ['MONO MARKET','NEXA TECH SERVICE','MONO OFFICE','MONO SUPPORT','MONO DATA HUB','OPS KIT'];
  for (let i = 0; i < productPages.length; i += 1) {
    const html = await load(productPages[i]);
    const text = visibleText(html);
    assert.match(text, new RegExp(expectedBrands[i]));
    assert.doesNotMatch(text, /샘플 쇼핑몰|샘플 출장서비스|샘플 사무팀|샘플 고객지원팀|샘플 운영팀|시연 기준일|체험 방법|가상 데이터 초기화/);
    assert.doesNotMatch(html, /Kzone87 Demo/);
  }
});

test('portfolio home communicates delivery scope while keeping every product directly runnable', async () => {
  const html = await load('index.html');
  assert.match(html, /납품 단위로 보기/);
  assert.match(html, /NEXA TECH SERVICE/);
  assert.match(html, /MONO OPERATIONS/);
  for (const href of ['./nexa-tech-service/','./field-service-ops/','./commerce-ops-console/','./document-intake-approval/','./ai-workflow-review-desk/','./integration-control-center/','./mini-labs/','https://kzone87.github.io/customer-map-planner/']) {
    assert.ok(html.includes(`href="${href}"`), `missing direct product link ${href}`);
  }
});

test('destructive integration controls have an explicit confirmation layer', async () => {
  const quality = await load('integration-control-center/quality.js');
  assert.match(quality, /window\.confirm/);
  assert.match(quality, /resetDemo/);
  assert.match(quality, /clearHistory/);
});
