import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');

test('NEXA service flow answers customer intent', () => {
  for (const phrase of ['서비스 확인하기','상담에 필요한 정보','방문이 필요하다면','진행 과정','운영 기준','상담 시작하기']) assert.ok(html.includes(phrase));
});
