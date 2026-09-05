import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const serviceHub = await readFile(new URL('../services/index.html', import.meta.url), 'utf8');
const sitemap = await readFile(new URL('../sitemap.xml', import.meta.url), 'utf8');
const robots = await readFile(new URL('../robots.txt', import.meta.url), 'utf8');
const quote = await readFile(new URL('../sales/QUOTE-TEMPLATE.md', import.meta.url), 'utf8');

const publicPages = [
  'https://kzone87.github.io/portfolio/',
  'https://kzone87.github.io/portfolio/services/',
  'https://kzone87.github.io/portfolio/services/admin-system.html',
  'https://kzone87.github.io/portfolio/services/excel-automation.html',
  'https://kzone87.github.io/portfolio/services/api-integration.html',
  'https://kzone87.github.io/portfolio/services/maintenance.html',
  'https://kzone87.github.io/portfolio/scope-estimator/'
];

test('service hub exposes all commercial service paths', () => {
  for (const path of [
    './admin-system.html',
    './excel-automation.html',
    './api-integration.html',
    './maintenance.html',
    '../scope-estimator/'
  ]) {
    assert.ok(serviceHub.includes(path), `missing service hub path: ${path}`);
  }
  assert.match(serviceHub, /49만원/);
  assert.match(serviceHub, /149만원/);
  assert.match(serviceHub, /299만원/);
  assert.match(serviceHub, /월 15만원/);
});

test('sitemap contains every commercial discovery URL', () => {
  for (const page of publicPages) {
    assert.ok(sitemap.includes(page), `missing sitemap URL: ${page}`);
  }
});

test('robots allows crawling and advertises the sitemap', () => {
  assert.match(robots, /User-agent:\s*\*/);
  assert.match(robots, /Allow:\s*\//);
  assert.match(robots, /Sitemap:\s*https:\/\/kzone87\.github\.io\/portfolio\/sitemap\.xml/);
});

test('quote template fixes scope before price and separates recurring support', () => {
  assert.match(quote, /완료 기준/);
  assert.match(quote, /포함 범위/);
  assert.match(quote, /제외 범위/);
  assert.match(quote, /기능 추가/);
  assert.match(quote, /외부 비용/);
  assert.match(quote, /유지보수|운영지원/);
  assert.match(quote, /금액/);
  assert.match(quote, /일정/);
});

test('discovery assets contain no common credential patterns', () => {
  const content = [serviceHub, sitemap, robots, quote].join('\n');
  assert.doesNotMatch(content, /sk-[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(content, /AIza[0-9A-Za-z_-]{20,}/);
});
