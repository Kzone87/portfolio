import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const services = await readFile(new URL('../SERVICES.md', import.meta.url), 'utf8');
const brief = await readFile(new URL('../PROJECT-BRIEF.md', import.meta.url), 'utf8');
const salesCss = await readFile(new URL('../sales.css', import.meta.url), 'utf8');
const integrationHtml = await readFile(new URL('../integration-control-center/index.html', import.meta.url), 'utf8');
const integrationJs = await readFile(new URL('../integration-control-center/app.js', import.meta.url), 'utf8');
const integrationReadme = await readFile(new URL('../integration-control-center/README.md', import.meta.url), 'utf8');
const integrationServer = await readFile(new URL('../integration-control-center/server/app.mjs', import.meta.url), 'utf8');

const requiredPublicLinks = [
  'https://github.com/Kzone87/user-directory-api',
  'https://github.com/Kzone87/customer-map-planner',
  'https://github.com/Kzone87/milkyway-bookstore-case-study'
];

test('portfolio exposes the public evidence projects', () => {
  for (const link of requiredPublicLinks) {
    assert.ok(html.includes(link), `missing project link: ${link}`);
    assert.ok(readme.includes(link), `README missing project link: ${link}`);
  }
  assert.match(html, /Integration Control Center · V2/);
  assert.match(readme, /Integration Control Center · V2/);
  assert.match(integrationHtml, /Integration Control Center · V2/);
});

test('portfolio positions the two flagship projects at their current versions', () => {
  assert.match(html, /Business Ops Dashboard · V6/);
  assert.match(html, /Customer Data Workbench · V2\.4/);
  assert.match(html, /RBAC/);
  assert.match(html, /Column Mapping/);
  assert.match(readme, /Priority \/ due-date planning/);
  assert.match(readme, /Column mapping \/ schema standardization/);
});

test('commercial packages expose consistent starting prices', () => {
  for (const price of ['49만원', '149만원', '299만원']) {
    assert.match(html, new RegExp(price));
    assert.match(readme, new RegExp(price));
    assert.match(services, new RegExp(price));
    assert.match(brief, new RegExp(price));
  }
  assert.match(html, /STANDARD/);
  assert.match(html, /DELUXE/);
  assert.match(html, /PREMIUM/);
  assert.match(salesCss, /package-grid/);
});

test('inquiry flow asks for the four minimum estimate inputs', () => {
  assert.match(html, /현재 방식/);
  assert.match(html, /불편한 점/);
  assert.match(html, /꼭 필요한 결과/);
  assert.match(html, /예산\/일정/);
  assert.match(brief, /가장 빠른 4문항/);
});

test('data workbench exposes the mapping workspace link', () => {
  assert.ok(html.includes('https://kzone87.github.io/customer-map-planner/mapping.html'));
  assert.ok(readme.includes('https://kzone87.github.io/customer-map-planner/mapping.html'));
});

test('integration case separates credential-free UI from the V2 server boundary', () => {
  assert.match(integrationHtml, /NO REAL CREDENTIALS/);
  assert.match(integrationReadme, /실제 API Key, 비공개 서비스, 고객 데이터는 사용하지 않습니다/);
  assert.match(integrationJs, /localStorage/);
  assert.match(integrationJs, /allowedPolicies/);
  assert.match(integrationServer, /Idempotency-Key|idempotency-key/);
  assert.match(integrationServer, /\/api\/jobs/);
  assert.doesNotMatch(integrationJs, /sk-[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(integrationJs, /AIza[0-9A-Za-z_-]{20,}/);
});

test('portfolio states public-only evidence policy', () => {
  assert.match(readme, /공개 가능한 저장소와 검증 가능한 기록만/);
  assert.match(html, /공개 가능한 저장소와 원본 Git 기록만/);
});

test('portfolio keeps stable project brief and services links', () => {
  assert.ok(html.includes('https://github.com/Kzone87/portfolio/blob/main/PROJECT-BRIEF.md'));
  assert.ok(html.includes('https://github.com/Kzone87/portfolio/blob/main/SERVICES.md'));
});
