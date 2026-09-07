import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const home = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('portfolio NEXA story leads with customer and operating outcomes', () => {
  for (const phrase of [
    '고객 상담부터 현장 배차까지 이어지는 유지보수 서비스',
    '문의가 끊기지 않게',
    '현장 운영을 한눈에',
    '완료 이후까지',
    '서비스 운영 흐름 보기',
    '01 · 고객 서비스 화면',
    '02 · 직원 배차 화면'
  ]) assert.ok(home.includes(phrase), `missing customer outcome copy: ${phrase}`);

  for (const forbidden of ['왜 두 화면인가','역할 분리','구현 근거','ONE DOMAIN · TWO SURFACES']) {
    assert.ok(!home.includes(forbidden), `portfolio NEXA copy still narrates design: ${forbidden}`);
  }
});
