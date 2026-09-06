import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../home.css', import.meta.url), 'utf8');

const demoTargets = [
  './nexa-tech-service/',
  './field-service-ops/',
  'https://kzone87.github.io/customer-map-planner/',
  './commerce-ops-console/',
  './document-intake-approval/',
  './ai-workflow-review-desk/',
  './integration-control-center/',
  './mini-labs/'
];

test('portfolio home exposes all eight runnable product surfaces', () => {
  for (const href of demoTargets) assert.match(html, new RegExp(`href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(html, /직접 실행 가능한 제품 화면<\/span><strong>8<\/strong>/);
  assert.match(html, /말보다 직접 써보세요/);
});

test('portfolio groups runnable work into credible delivery scopes', () => {
  assert.match(html, /NEXA TECH SERVICE/);
  assert.match(html, /기업 홈페이지 보기/);
  assert.match(html, /현장운영 시스템 보기/);
  assert.match(html, /MONO OPERATIONS/);
  assert.match(html, /MONO MARKET · 주문 운영/);
  assert.match(html, /MONO OFFICE · 문서 검수/);
  assert.match(html, /MONO SUPPORT · 상담 지원/);
  assert.match(html, /MONO DATA HUB · 데이터 연동/);
});

test('portfolio home has search metadata and keyboard navigation support', () => {
  assert.match(html, /property="og:type" content="website"/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /rel="canonical" href="https:\/\/kzone87\.github\.io\/portfolio\/"/);
  assert.match(html, /class="skip-link" href="#top">본문으로 바로가기/);
  assert.match(html, /a:focus-visible,button:focus-visible/);
});

test('portfolio primary text remains comfortably readable', () => {
  assert.match(css, /\.hero-copy\{[^}]*font-size:1\.08rem/);
  assert.match(css, /\.system-card p\{[^}]*font-size:\.9rem/);
  assert.match(css, /\.guide-grid p\{[^}]*font-size:\.88rem/);
  assert.match(css, /\.case-link-grid a\{[^}]*min-height:42px/);
});
