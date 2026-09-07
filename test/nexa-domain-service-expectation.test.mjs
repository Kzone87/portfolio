import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');

test('NEXA customer knows what to expect before and after a visit', () => {
  for (const phrase of ['방문 일정과 준비사항','현장 점검','작업 결과','후속관리']) assert.ok(html.includes(phrase));
});
