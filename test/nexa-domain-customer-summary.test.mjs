import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');

test('service flow summary tells customers what they provide and what NEXA does next', () => {
  assert.match(html, /사업장 · 장비 종류 · 증상 · 업무 영향/);
  assert.match(html, /지원 가능 여부 · 방문 일정 · 현장 작업 · 후속관리/);
});
