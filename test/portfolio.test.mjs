import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const load=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [html,work,readme,services,hub,admin,excel,api,ai,commerce,field,document,mini,kmong,soomgo,assets,sitemap,estimator]=await Promise.all([
  'index.html','work/index.html','README.md','SERVICES.md','services/index.html','services/admin-system.html','services/excel-automation.html','services/api-integration.html','services/ai-automation.html','services/commerce-ops.html','services/field-service.html','services/document-workflow.html','mini-labs/index.html','sales/KMONG-LISTINGS.md','sales/SOOMGO-QUOTES.md','sales/PORTFOLIO-ASSETS.md','sitemap.xml','scope-estimator/index.html'
].map(load));

const versions=[
  'Business Ops Dashboard · V8','Customer Data Workbench · V3','AI Workflow Review Desk · V2','Integration Control Center · V3','Commerce Ops Console · V1','Booking & Field Service Ops · V1','Document Intake & Approval · V1'
];
const servicePaths=['admin-system.html','excel-automation.html','api-integration.html','ai-automation.html','commerce-ops.html','field-service.html','document-workflow.html'];

test('homepage stays focused on one promise and three service pillars',()=>{
  assert.match(html,/회사 업무를\s*<br>더 간단하게 만듭니다/);
  for(const pillar of ['업무관리 시스템','데이터 자동화','AI · 시스템 연동']) assert.match(html,new RegExp(pillar));
  assert.match(html,/대표 사례는 세 개만/);
  assert.ok(html.includes('./work/'));
  for(const clutter of ['7 Flagships','ENGINEERING MINI LABS','Dead Letter','Idempotency','WorkflowPreset']) assert.ok(!html.includes(clutter),`homepage clutter returned: ${clutter}`);
});

test('full work page and README preserve all seven current flagship versions',()=>{for(const v of versions){assert.match(work,new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.match(readme,new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));}});

test('commercial service hub exposes all seven service paths and Mini Labs',()=>{for(const p of servicePaths)assert.ok(hub.includes(`./${p}`),`missing ${p}`);assert.ok(hub.includes('../mini-labs/'));assert.match(hub,/Business Ops Dashboard V8/);assert.match(hub,/Customer Data Workbench V3/);assert.match(hub,/Integration Control Center V3/);assert.match(hub,/AI Workflow Review Desk V2/);});

test('service pages point to their current public evidence',()=>{assert.match(admin,/Business Ops Dashboard · V8/);assert.match(admin,/Approval/);assert.match(admin,/Reporting/);assert.match(excel,/Customer Data Workbench · V3/);assert.match(excel,/Batch\/Migration/);assert.match(api,/Integration Control Center · V3/);assert.match(api,/Dead Letter/);assert.match(ai,/AI Workflow Review Desk · V2/);assert.match(ai,/Evidence|Local RAG/);assert.match(commerce,/Commerce Ops Console · V1/);assert.match(field,/Booking & Field Service Ops · V1/);assert.match(document,/Document Intake & Approval · V1/);});

test('customer-facing assets do not advertise superseded flagship versions',()=>{const current=[html,work,readme,services,hub,admin,excel,api,ai,kmong,soomgo,assets].join('\n');for(const stale of ['Business Ops Dashboard · V6','Business Ops Dashboard V6','Customer Data Workbench · V2.4','Customer Data Workbench V2.4','Integration Control Center · V2','Integration Control Center V2','AI Workflow Review Desk · V1','AI Workflow Review Desk V1'])assert.ok(!current.includes(stale),`stale public label: ${stale}`);});

test('homepage pricing is intentionally minimal while sales assets keep full anchors',()=>{for(const price of ['49만원','149만원','299만원'])assert.match(html,new RegExp(price));assert.doesNotMatch(html,/499만원/);for(const price of ['49만원','149만원','299만원','499만원']){assert.match(services,new RegExp(price));assert.match(kmong,new RegExp(price));}for(const monthly of ['15만원','30만원','50만원'])assert.match(services,new RegExp(monthly));});

test('scope estimator exposes all commercial project categories and no-storage boundary',()=>{for(const value of ['feature','excel','admin','ai','integration','commerce','field','document'])assert.match(estimator,new RegExp(`value="${value}"`));assert.match(estimator,/서버로 전송하거나 저장하지 않습니다/);});

test('sales assets cover the seven flagship categories',()=>{for(const phrase of ['관리자페이지','Excel / CSV','REST API','AI Workflow','쇼핑몰','예약','문서접수']){assert.match(kmong,new RegExp(phrase));assert.match(soomgo,new RegExp(phrase));}for(const version of ['Business Ops Dashboard V8','Customer Data Workbench V3','AI Workflow Review Desk V2','Integration Control Center V3','Commerce Ops Console V1','Booking & Field Service Ops V1','Document Intake & Approval V1'])assert.match(assets,new RegExp(version));});

test('sitemap publishes work index, commercial pages and live routes',()=>{assert.ok(sitemap.includes('https://kzone87.github.io/portfolio/work/'));for(const p of servicePaths)assert.match(sitemap,new RegExp(`services/${p.replace('.','\\.')}`));for(const route of ['ai-workflow-review-desk/','integration-control-center/','commerce-ops-console/','field-service-ops/','document-intake-approval/','mini-labs/'])assert.ok(sitemap.includes(`https://kzone87.github.io/portfolio/${route}`));});

test('Engineering Mini Labs remains executable public evidence off the homepage',()=>{assert.match(mini,/ENGINEERING MINI LABS · V1/);for(const label of ['CMS LAB','EXTRACTION LAB','BROWSER AUTOMATION LAB','SECURITY LAB','QA \/ DEPLOYMENT LAB'])assert.match(mini,new RegExp(label));assert.match(mini,/NO CREDENTIALS/);assert.ok(!html.includes('ENGINEERING MINI LABS'));});

test('public commercial assets contain no common credential patterns',()=>{const all=[html,work,readme,services,hub,admin,excel,api,ai,commerce,field,document,mini,kmong,soomgo,assets,estimator].join('\n');assert.doesNotMatch(all,/sk-[A-Za-z0-9_-]{20,}/);assert.doesNotMatch(all,/AIza[0-9A-Za-z_-]{20,}/);});

test('portfolio keeps public-only evidence and stable inquiry path',()=>{assert.match(readme,/공개 가능한 저장소와 검증 가능한 공개 기록만/);assert.match(work,/공개 코드 또는 공개 Live Lab과 가상 데이터만 사용/);assert.ok(html.includes('https://github.com/Kzone87/portfolio/blob/main/PROJECT-BRIEF.md'));});
