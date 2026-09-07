import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');

test('customer-facing service flow explains urgent handling without invented SLA', () => {
  assert.match(html, /업무 중단처럼 영향이 큰 요청은 일반 요청과 구분해 먼저 확인합니다/);
  assert.doesNotMatch(html, /SLA|당일 보장|24시간 보장|\b\d+분 이내/);
});
