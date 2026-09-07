import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const pages = ['index.html','about.html','services.html','industries.html','cases.html','playbook.html','contact.html'];
const html = (await Promise.all(pages.map(page => load(`nexa-tech-service/${page}`)))).join('\n');

const body = html.replace(/<footer[\s\S]*?<\/footer>/gi, ' ');

test('customer copy uses plain service language instead of design-showcase jargon', () => {
  for (const forbidden of [
    'SERVICE BLUEPRINT','SERVICE MATURITY','TRUST CENTER','SERVICE TEAM','IMPLEMENTATION PROOF',
    'DESIGN DECISION','WHAT GOOD LOOKS LIKE','SERVICE SCENARIO','PORTFOLIO SCENARIO','ONE DOMAIN'
  ]) assert.ok(!body.includes(forbidden), `customer copy exposes ${forbidden}`);
});

test('customer copy is organized around needs, service and next actions', () => {
  for (const phrase of ['정기점검','고장 대응','설치·이전','유지보수 상담','현재 가장 불편한 점','서비스 진행 안내']) {
    assert.ok(html.includes(phrase), `missing customer phrase ${phrase}`);
  }
});
