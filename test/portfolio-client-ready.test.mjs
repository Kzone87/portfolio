import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('client-ready presentation exposes five truthful product lines and a delivery standard', async () => {
  const script = await load('commercial-portfolio.js');
  const booking = await load('booking-portfolio.js');
  const combined = `${script}\n${booking}`;
  for (const phrase of [
    'NEXA SERVICE SUITE',
    'BOOKING CRM',
    'MONO OPERATIONS',
    'Excel Workbench',
    'OPS KIT',
    '실제 납품은 화면에서 끝나지 않습니다.',
    'Runbook · Backup/Restore · Acceptance',
    '실제 고객 실적이나 성과 수치를 꾸며서 사용하지 않고'
  ]) assert.match(combined, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(script, /TypeScript · JavaScript · Node\.js · SQLite\/SQL · REST\/Webhook/);
  assert.match(booking, /productLines:\['NEXA SERVICE SUITE','BOOKING CRM','MONO OPERATIONS','Excel Workbench','OPS KIT'\]/);
  assert.match(booking, /<strong>05<\/strong><span>PRODUCT LINES/);
  assert.doesNotMatch(combined, /Java\/Spring/);
});

test('portfolio preserves real deployed screens behind the performance gate on supported viewports', async () => {
  const script = await load('commercial-portfolio.js');
  const booking = await load('booking-portfolio.js');
  const performance = await load('portfolio-performance.js');
  const css = await load('commercial-portfolio.css');
  assert.match(script, /previewFrame\('\.\/nexa-tech-service\/'/);
  assert.match(booking, /data-preview-src="\.\/booking-crm\/"/);
  assert.match(script, /previewFrame\('\.\/mono-operations\/'/);
  assert.match(script, /previewFrame\('https:\/\/kzone87\.github\.io\/customer-map-planner\/'/);
  assert.doesNotMatch(`${script}\n${booking}`, /<iframe src=/);
  assert.match(`${script}\n${booking}`, /ACTUAL LIVE SCREEN/);
  assert.match(performance, /IntersectionObserver/);
  assert.match(performance, /mobileSuppressed/);
  assert.match(css, /\.nexa-live-preview/);
  assert.match(css, /\.excel-live-preview/);
  assert.match(booking, /@media\(max-width:760px\)/);
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

test('README matches five product lines, current OPS KIT and only demonstrated stack', async () => {
  const readme = await load('README.md');
  for (const phrase of ['Five public product lines','BOOKING CRM','Content Preflight','Data Extractor','Workflow Dry-Run','Security Check','Release Gate','SQLite / SQL','Browser QA']) {
    assert.match(readme, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(readme, /Java \/ Spring/);
  assert.match(readme, /프로젝트 의뢰서 준비/);
  assert.match(readme, /상담 초안 작성 · 복사 · TXT 다운로드/);
});
