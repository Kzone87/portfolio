import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const alignment = await readFile(path.join(root, 'home-alignment.css'), 'utf8');

const internalProjects = [
  'nexa-tech-service',
  'field-service-ops',
  'commerce-ops-console',
  'document-intake-approval',
  'ai-workflow-review-desk',
  'integration-control-center',
  'mini-labs'
];

test('every portfolio-local project link resolves to a deployed index entry', async () => {
  for (const route of internalProjects) {
    assert.ok(html.includes(`href="./${route}/"`), `home is missing ./${route}/`);
    await access(path.join(root, route, 'index.html'));
  }
});

test('external product and GitHub destinations are canonical and explicit', () => {
  assert.match(html, /href="https:\/\/kzone87\.github\.io\/customer-map-planner\/"/);
  assert.match(html, /href="https:\/\/github\.com\/Kzone87"/);
  assert.match(html, /href="https:\/\/github\.com\/Kzone87\/portfolio"/);
});

test('contact URLs point to issue forms that exist in this repository', async () => {
  assert.match(html, /template=hiring\.yml/);
  assert.match(html, /template=project-inquiry\.yml/);
  await access(path.join(root, '.github', 'ISSUE_TEMPLATE', 'hiring.yml'));
  await access(path.join(root, '.github', 'ISSUE_TEMPLATE', 'project-inquiry.yml'));
});

test('final alignment layer is loaded after other home styles', () => {
  const polish = html.indexOf('home-polish.css');
  const alignmentIndex = html.indexOf('home-alignment.css');
  assert.ok(polish >= 0 && alignmentIndex > polish);
  assert.match(alignment, /\.nexa-showcase \.case-links\{[\s\S]*margin-top:22px/);
  assert.match(alignment, /\.proof-story>div:last-child\{padding-top:34px/);
  assert.match(alignment, /\.contact-note\{/);
});

test('contact warning follows the actionable contact rows instead of interrupting the CTA', () => {
  const rows = html.indexOf('class="contact-grid contact-rows"');
  const warning = html.indexOf('class="contact-note"');
  assert.ok(rows >= 0 && warning > rows);
  assert.match(html, /코드보다 먼저,<br>업무 흐름을 봅니다\./);
});
