import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('client-ready presentation exposes four truthful product lines and a delivery standard', async () => {
  const script = await load('commercial-portfolio.js');
  for (const phrase of [
    'NEXA SERVICE SUITE',
    'MONO OPERATIONS',
    'Excel Workbench',
    'OPS KIT',
    '실제 납품은 화면에서 끝나지 않습니다.',
    'Runbook · Backup/Restore · Acceptance',
    '실제 고객 실적이나 성과 수치를 꾸며서 사용하지 않고'
  ]) assert.match(script, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(script, /TypeScript · JavaScript · Node\.js · SQLite\/SQL · REST\/Webhook/);
  assert.doesNotMatch(script, /Java\/Spring/);
});

test('portfolio uses real deployed screens for NEXA MONO and Excel on supported viewports', async () => {
  const script = await load('commercial-portfolio.js');
  const css = await load('commercial-portfolio.css');
  assert.match(script, /iframe src="\.\/nexa-tech-service\/"/);
  assert.match(script, /iframe src="\.\/mono-operations\/"/);
  assert.match(script, /iframe src="https:\/\/kzone87\.github\.io\/customer-map-planner\/"/);
  assert.match(script, /ACTUAL LIVE SCREEN/);
  assert.match(css, /\.nexa-live-preview/);
  assert.match(css, /\.excel-live-preview/);
  assert.match(css, /@media\(max-width:760px\)[^{]*\{[\s\S]*\.nexa-live-preview,[\s\S]*\.excel-live-preview\{display:none\}/);
});

test('project inquiry can prepare a portable draft without pretending public Pages submits it', async () => {
  const html = await load('project-inquiry/index.html');
  const app = await load('project-inquiry/app.js');
  assert.match(html, /GitHub 계정 없이도/);
  assert.match(html, /id="download-project-inquiry"/);
  assert.match(html, /공개 페이지에서는 입력 내용을 서버로 전송하지 않습니다/);
  assert.match(app, /new Blob/);
  assert.match(app, /KZONE87-project-inquiry\.txt/);
  assert.match(app, /URL\.createObjectURL/);
  assert.match(app, /서버로 전송하지 않습니다/);
  assert.doesNotMatch(app, /localStorage|sessionStorage/);
});

test('README matches current OPS KIT and only advertises publicly demonstrated stack', async () => {
  const readme = await load('README.md');
  for (const phrase of ['Content Preflight','Data Extractor','Workflow Dry-Run','Security Check','Release Gate','SQLite / SQL','Browser QA']) {
    assert.match(readme, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(readme, /Java \/ Spring/);
  assert.match(readme, /프로젝트 의뢰서 준비/);
  assert.match(readme, /상담 초안 작성 · 복사 · TXT 다운로드/);
});
