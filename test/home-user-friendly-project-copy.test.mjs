import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('project titles explain the job before the brand', () => {
  assert.match(html, /<b>NEXA TECH SERVICE<\/b><em>기업 웹 \+ 현장 운영<\/em>[\s\S]*<h3>기업 홈페이지 \+ 현장 운영<\/h3>/);
  assert.match(html, /<b>MONO OPERATIONS<\/b>[\s\S]*<h3>회사 운영 업무 시스템<\/h3>/);
  assert.match(html, /<b>Excel Workbench<\/b>[\s\S]*<h3>엑셀 데이터 정리·비교<\/h3>/);
  assert.match(html, /08 · OPS KIT<\/span><h2>반복 업무 자동화 도구<\/h2>/);
});

test('all eight projects use a consistent visible sequence', () => {
  assert.match(html, /01 · 기업 홈페이지 보기/);
  assert.match(html, /02 · 기사 배차·현장 관리 보기/);
  assert.match(html, /<span>03<\/span><strong>주문·배송 운영 관리<\/strong><small>MONO MARKET<\/small>/);
  assert.match(html, /<span>04<\/span><strong>문서 접수·검수 시스템<\/strong><small>MONO OFFICE<\/small>/);
  assert.match(html, /<span>05<\/span><strong>고객 문의 AI 업무지원<\/strong><small>MONO SUPPORT<\/small>/);
  assert.match(html, /<span>06<\/span><strong>데이터 연동·자동화 관리<\/strong><small>MONO DATA HUB<\/small>/);
  assert.match(html, /<div class="project-kicker"><span>07<\/span><b>Excel Workbench<\/b><\/div>/);
  assert.match(html, /08 · OPS KIT/);
});

test('descriptions use plain business language', () => {
  assert.match(html, /고객이 보는 기업 홈페이지부터 기사가 사용하는 배차·현장 관리 화면까지/);
  assert.match(html, /주문 처리부터 문서 검수, 고객 상담, 데이터 연동까지/);
  assert.match(html, /복잡한 Excel·CSV 파일을 브라우저에서 바로 정리하고 비교하는 데이터 작업 도구/);
  assert.match(html, /매번 사람이 확인하거나 반복 입력하던 작은 업무를 빠르게 처리하는 도구 모음/);
});
