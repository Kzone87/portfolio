import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateScope } from '../scope-estimator/engine.mjs';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const work = await readFile(new URL('../work/index.html', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const services = await readFile(new URL('../SERVICES.md', import.meta.url), 'utf8');
const serviceHub = await readFile(new URL('../services/index.html', import.meta.url), 'utf8');
const aiService = await readFile(new URL('../services/ai-automation.html', import.meta.url), 'utf8');
const aiLab = await readFile(new URL('../ai-workflow-review-desk/index.html', import.meta.url), 'utf8');
const aiReadme = await readFile(new URL('../ai-workflow-review-desk/README.md', import.meta.url), 'utf8');
const aiSales = await readFile(new URL('../sales/AI-WORKFLOW-SALES.md', import.meta.url), 'utf8');
const salesIndex = await readFile(new URL('../sales/README.md', import.meta.url), 'utf8');
const estimator = await readFile(new URL('../scope-estimator/index.html', import.meta.url), 'utf8');
const sitemap = await readFile(new URL('../sitemap.xml', import.meta.url), 'utf8');

test('AI workflow remains a first-class public case while homepage uses a concrete product name', () => {
  assert.match(work, /AI Workflow Review Desk · V2/);
  assert.ok(work.includes('../services/ai-automation.html'));
  assert.match(html, /기존 서비스에 AI 요약·분류·초안 기능 추가/);
  assert.ok(html.includes('./services/ai-automation.html'));
  assert.match(readme, /AI Workflow Review Desk/);
  assert.match(aiLab, /AI Workflow Review Desk V2/);
  assert.match(aiReadme, /AI Workflow Review Desk · V2/);
  assert.match(services, /AI Workflow · Local RAG/);
  assert.ok(serviceHub.includes('./ai-automation.html'));
  assert.doesNotMatch(serviceHub, /Evidence Retrieval|Structured Output/);
});

test('public AI service explains the work first and preserves technical evidence later', () => {
  assert.match(aiService, /AI가 먼저 읽고 정리하고/);
  assert.match(aiService, /문의 자동 분류/);
  assert.match(aiService, /요약·초안 생성/);
  assert.match(aiService, /사람 최종 검토/);
  assert.doesNotMatch(aiService, /\d+만원/);
  assert.doesNotMatch(aiService, /PROJECT-BRIEF/);
  assert.match(aiService, /AI Workflow Review Desk · V2/);
  assert.match(aiService, /Local Knowledge Retrieval/);
  assert.match(aiService, /Evidence Snapshot/);
  assert.match(aiService, /Structured Output Validation/);
  assert.match(aiService, /Human Review/);
  assert.ok(aiService.includes('../ai-workflow-review-desk/'));
});

test('AI marketplace sales kit keeps pricing and technical sales evidence', () => {
  assert.match(aiSales, /AI Workflow Review Desk V2/);
  assert.match(aiSales, /크몽 상품 등록 원고/);
  assert.match(aiSales, /숨고 견적 응답 템플릿/);
  assert.match(aiSales, /60초 영상 구성/);
  for (const price of ['149만원', '299만원', '499만원']) assert.match(aiSales, new RegExp(price));
  assert.match(aiSales, /Local Knowledge Retrieval/);
  assert.match(aiSales, /Evidence Audit/);
  assert.match(aiSales, /Human Review/);
  assert.match(aiSales, /Structured Output/);
  assert.match(salesIndex, /AI-WORKFLOW-SALES\.md/);
});

test('scope estimator includes AI workflow and produces a sensible guide', () => {
  assert.match(estimator, /option value="ai"/);
  const basic = evaluateScope({ projectType: 'ai', existing: 'new', roles: 'single', data: 'simple', integrations: 'none', operation: 'basic', schedule: 'normal' });
  assert.equal(basic.projectLabel, 'AI Workflow / Local RAG');
  assert.equal(basic.packageName, 'DELUXE');
  assert.match(basic.firstPhase, /Structured Output/);
  const advanced = evaluateScope({ projectType: 'ai', existing: 'existing', roles: 'multi', data: 'relational', integrations: 'multiple', operation: 'advanced', schedule: 'normal' });
  assert.ok(['PREMIUM', 'CUSTOM'].includes(advanced.packageName));
  assert.ok(advanced.reasons.some((reason) => /AI|Provider|Evaluation|Audit|Fallback/i.test(reason)));
});

test('AI pages are discoverable through sitemap', () => {
  assert.match(sitemap, /https:\/\/kzone87\.github\.io\/portfolio\/services\/ai-automation\.html/);
  assert.match(sitemap, /https:\/\/kzone87\.github\.io\/portfolio\/ai-workflow-review-desk\//);
});

test('public AI assets contain no common credential patterns', () => {
  const content = [html, work, readme, services, serviceHub, aiService, aiLab, aiReadme, aiSales, estimator, sitemap].join('\n');
  assert.doesNotMatch(content, /sk-[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(content, /AIza[0-9A-Za-z_-]{20,}/);
  assert.match(aiLab, /NO API KEY/);
});
