import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateScope } from '../scope-estimator/engine.mjs';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const services = await readFile(new URL('../SERVICES.md', import.meta.url), 'utf8');
const serviceHub = await readFile(new URL('../services/index.html', import.meta.url), 'utf8');
const aiService = await readFile(new URL('../services/ai-automation.html', import.meta.url), 'utf8');
const aiLab = await readFile(new URL('../ai-workflow-review-desk/index.html', import.meta.url), 'utf8');
const aiSales = await readFile(new URL('../sales/AI-WORKFLOW-SALES.md', import.meta.url), 'utf8');
const salesIndex = await readFile(new URL('../sales/README.md', import.meta.url), 'utf8');
const estimator = await readFile(new URL('../scope-estimator/index.html', import.meta.url), 'utf8');
const sitemap = await readFile(new URL('../sitemap.xml', import.meta.url), 'utf8');

test('AI workflow is a first-class public case and service', () => {
  assert.match(html, /AI Workflow Review Desk · V1/);
  assert.ok(html.includes('./services/ai-automation.html'));
  assert.ok(html.includes('./ai-workflow-review-desk/'));
  assert.match(readme, /AI Workflow Review Desk · V1/);
  assert.match(services, /AI Workflow · 업무자동화/);
  assert.ok(serviceHub.includes('./ai-automation.html'));
});

test('AI commercial page exposes transparent price tiers and human review boundary', () => {
  for (const price of ['149만원', '299만원', '499만원']) assert.match(aiService, new RegExp(price));
  assert.match(aiService, /Structured Output/);
  assert.match(aiService, /Human review|Human Approve|HUMAN REVIEW/i);
  assert.match(aiService, /Provider Adapter|Provider adapter/i);
  assert.match(aiService, /실제 API Key는 browser 공개 코드에 넣지 않고 서버 secret/);
  assert.ok(aiService.includes('../ai-workflow-review-desk/'));
});

test('AI marketplace sales kit covers Kmong, Soomgo and media assets', () => {
  assert.match(aiSales, /크몽 상품 등록 원고/);
  assert.match(aiSales, /숨고 견적 응답 템플릿/);
  assert.match(aiSales, /60초 영상 구성/);
  for (const price of ['149만원', '299만원', '499만원']) assert.match(aiSales, new RegExp(price));
  assert.match(aiSales, /Human Review/);
  assert.match(aiSales, /Structured Output/);
  assert.match(salesIndex, /AI-WORKFLOW-SALES\.md/);
});

test('scope estimator includes AI workflow and produces a sensible guide', () => {
  assert.match(estimator, /option value="ai"/);
  const basic = evaluateScope({
    projectType: 'ai',
    existing: 'new',
    roles: 'single',
    data: 'simple',
    integrations: 'none',
    operation: 'basic',
    schedule: 'normal'
  });
  assert.equal(basic.projectLabel, 'AI Workflow / 업무자동화');
  assert.equal(basic.packageName, 'DELUXE');
  assert.match(basic.firstPhase, /Structured Output/);

  const advanced = evaluateScope({
    projectType: 'ai',
    existing: 'existing',
    roles: 'multi',
    data: 'relational',
    integrations: 'multiple',
    operation: 'advanced',
    schedule: 'normal'
  });
  assert.ok(['PREMIUM', 'CUSTOM'].includes(advanced.packageName));
  assert.ok(advanced.reasons.some((reason) => /AI|Provider|Evaluation|Audit|Fallback/i.test(reason)));
});

test('AI pages are discoverable through sitemap', () => {
  assert.match(sitemap, /https:\/\/kzone87\.github\.io\/portfolio\/services\/ai-automation\.html/);
  assert.match(sitemap, /https:\/\/kzone87\.github\.io\/portfolio\/ai-workflow-review-desk\//);
});

test('public AI commercial assets contain no common credential patterns', () => {
  const content = [html, readme, services, serviceHub, aiService, aiLab, aiSales, estimator, sitemap].join('\n');
  assert.doesNotMatch(content, /sk-[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(content, /AIza[0-9A-Za-z_-]{20,}/);
  assert.match(aiLab, /NO API KEY/);
});
