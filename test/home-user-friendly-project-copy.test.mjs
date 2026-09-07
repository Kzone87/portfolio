import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('project titles explain the job before the brand', () => {
  assert.match(html, /<b>NEXA SERVICE DOMAIN<\/b><em>ONE DOMAIN · TWO SURFACES<\/em>[\s\S]*<h3>고객용 기업 홈페이지 \+ 내부 현장 운영<\/h3>/);
  assert.match(html, /<b>MONO OPERATIONS<\/b>[\s\S]*<h3>회사 운영 업무 시스템<\/h3>/);
  assert.match(html, /<b>Excel Workbench<\/b>[\s\S]*<h3>엑셀 데이터 정리·비교<\/h3>/);
  assert.match(html, /08 · OPS KIT<\/span><h2>반복 업무 자동화 도구<\/h2>/);
});

test('all eight products keep a consistent visible sequence while NEXA has a domain case study', () => {
  assert.match(html, /NEXA 도메인 설계 보기/);
  assert.match(html, /01 · 고객용 기업 홈페이지/);
  assert.match(html, /02 · 내부 현장 운영 시스템/);
  assert.match(html, /<span>03<\/span><strong>주문·배송 운영 관리<\/strong><small>MONO MARKET<\/small>/);
  assert.match(html, /<span>04<\/span><strong>문서 접수·검수 시스템<\/strong><small>MONO OFFICE<\/small>/);
  assert.match(html, /<span>05<\/span><strong>고객 문의 AI 업무지원<\/strong><small>MONO SUPPORT<\/small>/);
  assert.match(html, /<span>06<\/span><strong>데이터 연동·자동화 관리<\/strong><small>MONO DATA HUB<\/small>/);
  assert.match(html, /<div class="project-kicker"><span>07<\/span><b>Excel Workbench<\/b><\/div>/);
  assert.match(html, /08 · OPS KIT/);
});

test('descriptions use plain business language and explain role separation', () => {
  assert.match(html, /고객이 보는 공개 홈페이지/);
  assert.match(html, /직원이 쓰는 내부 배차·현장 운영 시스템/);
  assert.match(html, /서비스 탐색 → 상담 → 방문 요청 → 배차 → 현장 작업 → 완료·후속관리/);
  assert.match(html, /주문 처리부터 문서 검수, 고객 상담, 데이터 연동까지/);
  assert.match(html, /복잡한 Excel·CSV 파일을 브라우저에서 바로 정리하고 비교하는 데이터 작업 도구/);
  assert.match(html, /매번 사람이 확인하거나 반복 입력하던 작은 업무를 빠르게 처리하는 도구 모음/);
});
