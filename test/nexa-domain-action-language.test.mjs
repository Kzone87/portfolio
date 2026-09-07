import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');

test('NEXA service flow CTAs are actions a customer can take', () => {
  for (const label of ['서비스 확인하기','유지보수 상담하기','상담 내용 정리하기','서비스 진행 자세히 보기','상담 시작하기']) assert.ok(html.includes(label));
});
