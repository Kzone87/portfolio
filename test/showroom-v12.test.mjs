import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const home = await load('index.html');
const sitemap = await load('sitemap.xml');
const customerUi = await load('customer-ui.js');
const packageJson = JSON.parse(await load('package.json'));

const demos = [
  { route: 'commerce-ops-console/', html: 'commerce-ops-console/index.html', app: 'commerce-ops-console/app.js', controls: ['search','request-refund'], results: ['order-list','status-message','audit-list'] },
  { route: 'field-service-ops/', html: 'field-service-ops/index.html', app: 'field-service-ops/app.js', controls: ['search','schedule'], results: ['job-list','message','audit-list'] },
  { route: 'document-intake-approval/', html: 'document-intake-approval/index.html', app: 'document-intake-approval/app.js', controls: ['search','save','extract','submit'], results: ['doc-list','message','audit-list'] },
  { route: 'ai-workflow-review-desk/', html: 'ai-workflow-review-desk/index.html', app: 'ai-workflow-review-desk/app.js', controls: ['task-form','generate-selected','approve','reject'], results: ['task-list','evidence-list','review-history'] },
  { route: 'integration-control-center/', html: 'integration-control-center/index.html', app: 'integration-control-center/app.js', controls: ['jobForm','resetDemo','clearHistory'], results: ['jobTable','historyList','formStatus'] },
  { route: 'mini-labs/', html: 'mini-labs/index.html', app: 'mini-labs/app.js', controls: ['cms-run','extract-run','automation-run'], results: ['cms-output','extract-output','automation-output'] }
];
const corporatePages = ['nexa-tech-service/','nexa-tech-service/about.html','nexa-tech-service/services.html','nexa-tech-service/cases.html','nexa-tech-service/contact.html'];

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ');
}

test('homepage is a direct interactive showroom, not a sales or case catalog', () => {
  assert.match(home, /말보다 직접/);
  assert.match(home, /직접 실행 가능한 데모/);
  assert.ok(home.includes('./nexa-tech-service/'), 'missing corporate website demo');
  for (const demo of demos) assert.ok(home.includes(`./${demo.route}`), `missing direct demo link: ${demo.route}`);
  assert.ok(home.includes('https://kzone87.github.io/customer-map-planner/'));
  for (const removed of ['./services/', './work/', './scope-estimator/', 'Business Ops', '견적 문의', 'GitHub', 'CI로 검증']) {
    assert.ok(!home.includes(removed), `non-runnable or developer-facing homepage content returned: ${removed}`);
  }
});

test('sitemap publishes all runnable portfolio and corporate pages', () => {
  const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.length, 12);
  assert.equal(locs[0], 'https://kzone87.github.io/portfolio/');
  for (const demo of demos) assert.ok(locs.includes(`https://kzone87.github.io/portfolio/${demo.route}`), `missing runnable sitemap route: ${demo.route}`);
  for (const page of corporatePages) assert.ok(locs.includes(`https://kzone87.github.io/portfolio/${page}`), `missing corporate sitemap route: ${page}`);
  for (const removed of ['/services/', '/work/', '/scope-estimator/']) assert.ok(!sitemap.includes(removed));
});

test('every internal showroom page exposes real controls and visible results', async () => {
  for (const demo of demos) {
    const html = await load(demo.html);
    const app = await load(demo.app);
    for (const id of demo.controls) {
      assert.ok(html.includes(`id="${id}"`), `${demo.route} missing control ${id}`);
      assert.ok(app.includes(id), `${demo.route} control ${id} is not wired in app`);
    }
    for (const id of demo.results) assert.ok(html.includes(`id="${id}"`), `${demo.route} missing result area ${id}`);
    assert.match(html, /<a href="\.\.\/">← (?:체험센터|포트폴리오)<\/a>/);
    assert.doesNotMatch(html, /services\//);
  }
});

test('corporate website has complete navigation, responsive controls and a working inquiry surface', async () => {
  const pages = {
    home: await load('nexa-tech-service/index.html'),
    about: await load('nexa-tech-service/about.html'),
    services: await load('nexa-tech-service/services.html'),
    cases: await load('nexa-tech-service/cases.html'),
    contact: await load('nexa-tech-service/contact.html')
  };
  const app = await load('nexa-tech-service/app.js');
  for (const html of Object.values(pages)) {
    for (const href of ['./','./about.html','./services.html','./cases.html','./contact.html']) assert.ok(html.includes(`href="${href}"`), `corporate page missing nav ${href}`);
    assert.match(html, /<meta name="viewport"/);
    assert.match(html, /menu-button/);
    assert.match(html, /포트폴리오 시연을 위해 구성한 가상 기업/);
  }
  assert.match(pages.home, /faq-button/);
  assert.match(pages.contact, /id="contact-form"/);
  assert.match(pages.contact, /id="form-message"/);
  assert.match(app, /contact-form/);
  assert.match(app, /menu-button/);
  assert.match(app, /faq-button/);
});

test('customer-visible demo text excludes developer implementation jargon', async () => {
  const forbidden = [
    /\bRBAC\b/i, /Idempotency/i, /Dead Letter/i, /WorkflowPreset/i, /Local RAG/i,
    /\bProvider\b/i, /\bPrompt\b/i, /\bEvidence\b/i, /\bVERSION\b/i,
    /\bCRUD\b/i, /State Machine/i, /\bAudit\b/i, /\bWebhook\b/i,
    /REST API/i, /\bJSON\b/i, /Runbook/i, /\bschema\b/i, /\bvalidation\b/i,
    /deterministic/i, /DEMO INFO/i
  ];
  for (const demo of demos) {
    const text = visibleText(await load(demo.html));
    for (const pattern of forbidden) assert.doesNotMatch(text, pattern, `${demo.route} exposes ${pattern}`);
  }
});

test('customer label dictionary covers the internal states that appear in demos', () => {
  for (const label of ['처리 보류','상품 준비 중','관리자 확인 필요','출동 중','현장 작업 중','수정 요청','담당자 확인 필요','검수 담당자']) {
    assert.match(customerUi, new RegExp(label));
  }
});

test('showroom checks all live public scripts', () => {
  assert.equal(packageJson.version, '12.0.0');
  assert.ok(!packageJson.scripts.test.includes('scope-estimator'));
  for (const script of ['customer-ui.js','nexa-tech-service/app.js','commerce-ops-console/app.js','field-service-ops/app.js','document-intake-approval/app.js','ai-workflow-review-desk/app.js','integration-control-center/app.js','mini-labs/app.js']) {
    assert.ok(packageJson.scripts.test.includes(script), `missing syntax check: ${script}`);
  }
});

test('public showroom assets contain no common credential patterns', async () => {
  const content = [home, sitemap, customerUi, await load('nexa-tech-service/app.js')];
  for (const page of ['index.html','about.html','services.html','cases.html','contact.html']) content.push(await load(`nexa-tech-service/${page}`));
  for (const demo of demos) content.push(await load(demo.html), await load(demo.app));
  const all = content.join('\n');
  assert.doesNotMatch(all, /sk-[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(all, /AIza[0-9A-Za-z_-]{20,}/);
});
