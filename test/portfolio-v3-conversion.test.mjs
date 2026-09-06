import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('portfolio answers who, what, evidence and contact within the primary page', async () => {
  const html = await load('index.html');
  for (const phrase of [
    'Full-stack Web Developer',
    '무엇을 만들 수 있는가',
    '납품 단위로 보기',
    '무엇으로 증명하는가',
    '채용·협업·프로젝트 문의',
    '60초 검토 순서'
  ]) assert.match(html, new RegExp(phrase));
  assert.match(html, /home-v3\.css/);
});

test('portfolio keeps all eight runnable product surfaces', async () => {
  const html = await load('index.html');
  const links = [
    './nexa-tech-service/',
    './field-service-ops/',
    './commerce-ops-console/',
    './document-intake-approval/',
    './ai-workflow-review-desk/',
    './integration-control-center/',
    './mini-labs/',
    'https://kzone87.github.io/customer-map-planner/'
  ];
  for (const href of links) assert.ok(html.includes(`href="${href}"`), `missing ${href}`);
});

test('contact calls to action route to real public inquiry forms without invented email', async () => {
  const html = await load('index.html');
  const hiring = await load('.github/ISSUE_TEMPLATE/hiring.yml');
  const project = await load('.github/ISSUE_TEMPLATE/project-inquiry.yml');
  assert.match(html, /issues\/new\?template=hiring\.yml/);
  assert.match(html, /issues\/new\?template=project-inquiry\.yml/);
  assert.doesNotMatch(html, /mailto:/);
  assert.match(hiring, /민감한 개인정보/);
  assert.match(project, /민감한 정보/);
});

test('NEXA keeps the fictional boundary without presenting invented KPI achievements', async () => {
  const html = await load('nexa-tech-service/index.html');
  assert.match(html, /포트폴리오 시연을 위해 구성한 가상 기업/);
  assert.doesNotMatch(html, /98\.7%|-31%|96%|평균 1차 응답/);
  assert.match(html, /영향도 우선순위/);
  assert.match(html, /MULTI-SITE RETAIL · PORTFOLIO CASE/);
});

test('repository readme matches the current portfolio identity and contact paths', async () => {
  const readme = await load('README.md');
  assert.match(readme, /Kzone87 · Full-stack Web Developer/);
  assert.match(readme, /NEXA TECH SERVICE/);
  assert.match(readme, /MONO OPERATIONS/);
  assert.match(readme, /Excel 정리 작업실/);
  assert.match(readme, /template=hiring\.yml/);
  assert.doesNotMatch(readme, /49만원|149만원|299만원|499만원|scope-estimator|\/services\//);
});
