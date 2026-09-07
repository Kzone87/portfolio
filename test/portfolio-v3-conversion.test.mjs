import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('portfolio answers who, work, capability, proof and contact without instructional duplication', async () => {
  const html = await load('index.html');
  for (const phrase of [
    'Full-stack Web Developer',
    '대표 작업',
    '맡길 수 있는 일',
    '정상 흐름뿐 아니라',
    '같이 일하고 싶다면'
  ]) assert.match(html, new RegExp(phrase));
  assert.doesNotMatch(html, /60초 검토 순서/);
  assert.doesNotMatch(html, /운영 제품 바로가기/);
  assert.match(html, /home-v3\.css/);
  assert.match(html, /home-motion\.js/);
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

test('NEXA keeps the fictional boundary without narrating the customer site as a portfolio case', async () => {
  const home = await load('nexa-tech-service/index.html');
  const cases = await load('nexa-tech-service/cases.html');
  const all = `${home}\n${cases}`;
  assert.match(all, /포트폴리오 시연을 위해 구성한 가상 브랜드/);
  assert.match(home, /긴급도 판단/);
  assert.match(home, /업무 영향/);
  assert.match(cases, /SERVICE SCENARIO/);
  assert.doesNotMatch(home.replace(/<footer[\s\S]*?<\/footer>/i, ''), /포트폴리오|다음 프로젝트/);
  assert.doesNotMatch(cases.replace(/<footer[\s\S]*?<\/footer>/i, ''), /PORTFOLIO SCENARIO|실제 고객, 계약, 성과 수치를 의미하지 않/);
  assert.doesNotMatch(all, /98\.7%|-31%|-42%|96%|초기 가동 100%|확인시간 -37%|평균 1차 응답/);
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