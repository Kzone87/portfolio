import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const portfolio = await load('index.html');
const css = await load('home-domain.css');

const nexaStart = portfolio.indexOf('<article class="flagship nexa-showcase"');
const nexaEnd = portfolio.indexOf('<div class="featured-pair studio-pair">', nexaStart);
const nexa = portfolio.slice(nexaStart, nexaEnd);

test('portfolio presents NEXA as one suite with three role-specific product entry points', () => {
  assert.match(nexa, /NEXA SERVICE SUITE/);
  assert.match(nexa, /3 USER SURFACES/);
  for (const [href, label] of [
    ['./nexa-tech-service/', '서비스 홈페이지 열기'],
    ['./nexa-service-domain/', '고객 서비스 열기'],
    ['./field-service-ops/', '운영 Workspace 열기']
  ]) {
    assert.match(nexa, new RegExp(`href="${href.replace(/[./-]/g, '\\$&')}"[\\s\\S]*?${label}`));
  }
  for (const audience of ['신규 고객', '기존 고객', '직원']) assert.match(nexa, new RegExp(audience));
  assert.doesNotMatch(nexa, /01 · 고객 서비스 화면|02 · 직원 배차 화면|01–02/);
});

test('product links are visually primary and engineering evidence remains secondary but available', () => {
  const productLinksAt = nexa.indexOf('nexa-surface-links');
  const evidenceAt = nexa.indexOf('nexa-engineering-proof');
  assert.ok(productLinksAt > 0 && evidenceAt > productLinksAt, 'product links must appear before engineering evidence');
  for (const phrase of [
    'Inquiry → Field Job → Customer Portal',
    'SLOT_CONFLICT · expectedVersion · Server-side RBAC',
    'SQLite · Audit · E2E Tests · Node 24 CI',
    'Customer Source', 'Field Ops Source', 'E2E Tests', 'Domain Tests'
  ]) assert.match(nexa, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('NEXA card CSS protects hierarchy, hover affordance, mobile stacking, and long text', () => {
  assert.match(css, /\.nexa-surface-links\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.nexa-surface-link:hover\{/);
  assert.match(css, /\.nexa-surface-link:focus-visible\{/);
  assert.match(css, /overflow-wrap:anywhere/);
  assert.match(css, /@media\(max-width:760px\)\{[\s\S]*\.nexa-surface-links,.nexa-proof-grid\{grid-template-columns:1fr\}/);
  assert.match(css, /@media\(max-width:420px\)/);
});
