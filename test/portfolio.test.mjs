import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const integrationHtml = await readFile(new URL('../integration-control-center/index.html', import.meta.url), 'utf8');
const integrationJs = await readFile(new URL('../integration-control-center/app.js', import.meta.url), 'utf8');
const integrationReadme = await readFile(new URL('../integration-control-center/README.md', import.meta.url), 'utf8');

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
  assert.match(html, /Integration Control Center · V1 Lab/);
  assert.match(readme, /Integration Control Center · V1 Lab/);
});

test('portfolio positions the two flagship projects at their current versions', () => {
  assert.match(html, /Business Ops Dashboard · V6/);
  assert.match(html, /Customer Data Workbench · V2\.4/);
  assert.match(html, /RBAC/);
  assert.match(html, /Column Mapping/);
  assert.match(readme, /Priority \/ due-date planning/);
  assert.match(readme, /Column mapping \/ schema standardization/);
});

test('data workbench exposes the mapping workspace link', () => {
  assert.ok(html.includes('https://kzone87.github.io/customer-map-planner/mapping.html'));
  assert.ok(readme.includes('https://kzone87.github.io/customer-map-planner/mapping.html'));
});

test('integration lab is explicit about being credential-free simulation', () => {
  assert.match(integrationHtml, /NO REAL CREDENTIALS/);
  assert.match(integrationReadme, /실제 API Key나 외부 서비스에 연결하지 않습니다/);
  assert.match(integrationJs, /localStorage/);
  assert.match(integrationJs, /allowedPolicies/);
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
