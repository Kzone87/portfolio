import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

const requiredPublicLinks = [
  'https://github.com/Kzone87/user-directory-api',
  'https://github.com/Kzone87/customer-map-planner',
  'https://github.com/Kzone87/milkyway-bookstore-case-study'
];

test('portfolio exposes the three public evidence projects', () => {
  for (const link of requiredPublicLinks) {
    assert.ok(html.includes(link), `missing project link: ${link}`);
    assert.ok(readme.includes(link), `README missing project link: ${link}`);
  }
});

test('portfolio positions the two flagship projects by business outcome', () => {
  assert.match(html, /Business Ops Dashboard · V2/);
  assert.match(html, /Customer Data Workbench · V2/);
  assert.match(html, /업무용 웹 시스템/);
  assert.match(html, /Excel · CSV 자동화/);
});

test('portfolio states public-only evidence policy', () => {
  assert.match(readme, /공개 가능한 저장소와 검증 가능한 기록만/);
  assert.match(html, /공개 가능한 저장소와 원본 Git 기록만/);
});

test('portfolio keeps stable project brief and services links', () => {
  assert.ok(html.includes('https://github.com/Kzone87/portfolio/blob/main/PROJECT-BRIEF.md'));
  assert.ok(html.includes('https://github.com/Kzone87/portfolio/blob/main/SERVICES.md'));
});
