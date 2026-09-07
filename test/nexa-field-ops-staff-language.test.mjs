import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ops = await readFile(new URL('../field-service-ops/index.html', import.meta.url), 'utf8');

test('NEXA field operations speaks to staff doing dispatch work', () => {
  for (const phrase of ['직원 전용 · 배차 / 현장 운영','오늘의 배차 현황','긴급 요청과 미배정 작업을 먼저 확인하세요','기사별 일정','방문 요청','작업 상태','담당 기사와 방문 시간']) {
    assert.ok(ops.includes(phrase), `missing staff-facing language: ${phrase}`);
  }
  for (const forbidden of ['포트폴리오','프로젝트 설명','고객용 홈페이지 보기','왜 두 화면인가','구현 근거']) {
    assert.ok(!ops.includes(forbidden), `staff workspace leaks explanatory copy: ${forbidden}`);
  }
});
