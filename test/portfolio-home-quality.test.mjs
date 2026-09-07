import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../home.css', import.meta.url), 'utf8');
const v3Css = await readFile(new URL('../home-v3.css', import.meta.url), 'utf8');

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
  assert.match(html, /<b>8<\/b> 직접 실행 가능한 제품 화면/);
});

test('portfolio groups work without repeating the same product navigation', () => {
  assert.match(html, /NEXA TECH SERVICE/);
  assert.match(html, /기업 홈페이지 보기/);
  assert.match(html, /현장운영 시스템 보기/);
  assert.match(html, /MONO OPERATIONS/);
  assert.match(html, /Excel 정리 작업실/);
  assert.match(html, /OPS KIT 실행/);
  assert.doesNotMatch(html, /운영 제품 바로가기/);
  assert.doesNotMatch(html, /60초 검토 순서/);
});

test('portfolio home has search metadata and keyboard navigation support', () => {
  assert.match(html, /property="og:type" content="website"/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /rel="canonical" href="https:\/\/kzone87\.github\.io\/portfolio\/"/);
  assert.match(html, /class="skip-link" href="#top">본문으로 바로가기/);
  assert.match(html, /a:focus-visible,button:focus-visible/);
});

test('portfolio keeps the hero compact and primary text comfortably readable', () => {
  assert.match(css, /\.hero-copy\{[^}]*font-size:1\.08rem/);
  assert.match(css, /\.case-link-grid a\{[^}]*min-height:42px/);
  assert.match(v3Css, /\.v3-hero\{[^}]*padding:58px 0 54px/);
  assert.match(v3Css, /\.v3-hero h1\{[^}]*4\.9rem/);
  assert.match(v3Css, /\.identity-card dd\{[^}]*font-size:\.88rem/);
  assert.match(v3Css, /\.compact-evidence-grid p\{[^}]*font-size:\.9rem/);
  assert.match(v3Css, /\.contact-grid a\{[^}]*min-height:46px/);
  assert.match(v3Css, /@media\(max-width:700px\)[\s\S]*\.site-header nav a\{font-size:\.82rem/);
});
