import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');

test('customer service flow follows a clear service path', () => {
  const order = ['서비스 확인','상담 정보','방문 안내','현장 점검','작업 결과','후속관리'].map(text => html.indexOf(text));
  assert.ok(order.every(index => index >= 0));
  assert.deepEqual([...order].sort((a,b) => a-b), order);
});
