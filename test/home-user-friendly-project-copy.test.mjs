import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('project titles explain the customer outcome before the implementation detail', () => {
  assert.match(html, /<b>NEXA TECH SERVICE<\/b><em>고객용 \+ 직원용<\/em>[\s\S]*<h3>고객 상담부터 현장 배차까지 이어지는 유지보수 서비스<\/h3>/);
  assert.match(html, /<b>MONO OPERATIONS<\/b>[\s\S]*<h3>회사 운영 업무 시스템<\/h3>/);
  assert.match(html, /<b>Excel Workbench<\/b>[\s\S]*<h3>엑셀 데이터 정리·비교<\/h3>/);
  assert.match(html, /08 · OPS KIT<\/span><h2>반복 업무 자동화 도구<\/h2>/);
});

test('all eight products keep a consistent visible sequence while NEXA exposes the customer flow and both product surfaces', () => {
  assert.match(html, /서비스 운영 흐름 보기/);
  assert.match(html, /01 · 고객 서비스 화면/);
  assert.match(html, /02 · 직원 배차 화면/);
  assert.match(html, /<span>03<\/span><strong>주문·배송 운영 관리<\/strong><small>MONO MARKET<\/small>/);
  assert.match(html, /<span>04<\/span><strong>문서 접수·검수 시스템<\/strong><small>MONO OFFICE<\/small>/);
  assert.match(html, /<span>05<\/span><strong>고객 문의 AI 업무지원<\/strong><small>MONO SUPPORT<\/small>/);
  assert.match(html, /<span>06<\/span><strong>데이터 연동·자동화 관리<\/strong><small>MONO DATA HUB<\/small>/);
  assert.match(html, /<div class="project-kicker"><span>07<\/span><b>Excel Workbench<\/b><\/div>/);
  assert.match(html, /08 · OPS KIT/);
});

test('NEXA portfolio copy speaks in customer and operating outcomes rather than design narration', () => {
  for (const phrase of ['고객은 필요한 서비스를 확인하고 현재 문제를 상담합니다','문의가 끊기지 않게','현장 운영을 한눈에','완료 이후까지','고객 상담 → 방문 요청 → 기사 배정 → 현장 처리 → 작업 결과·후속관리']) assert.match(html, new RegExp(phrase));
  assert.doesNotMatch(html, /왜 두 화면인가|역할 분리|구현 근거|ONE DOMAIN · TWO SURFACES/);
  assert.match(html, /주문 처리부터 문서 검수, 고객 상담, 데이터 연동까지/);
  assert.match(html, /복잡한 Excel·CSV 파일을 브라우저에서 바로 정리하고 비교하는 데이터 작업 도구/);
  assert.match(html, /매번 사람이 확인하거나 반복 입력하던 작은 업무를 빠르게 처리하는 도구 모음/);
});
