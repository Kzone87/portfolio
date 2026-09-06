import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const load=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [html,homeCss,work,readme,services,hub,serviceCss,feature,admin,excel,api,ai,commerce,field,document,webData,mini,kmong,soomgo,assets,sitemap,estimator]=await Promise.all([
  'index.html','home.css','work/index.html','README.md','SERVICES.md','services/index.html','services/service-page.css','services/feature-addition.html','services/admin-system.html','services/excel-automation.html','services/api-integration.html','services/ai-automation.html','services/commerce-ops.html','services/field-service.html','services/document-workflow.html','services/web-data-collection.html','mini-labs/index.html','sales/KMONG-LISTINGS.md','sales/SOOMGO-QUOTES.md','sales/PORTFOLIO-ASSETS.md','sitemap.xml','scope-estimator/index.html'
].map(load));

const versions=['Business Ops Dashboard · V8','Customer Data Workbench · V3','AI Workflow Review Desk · V2','Integration Control Center · V3','Commerce Ops Console · V1','Booking & Field Service Ops · V1','Document Intake & Approval · V1'];
const servicePaths=['feature-addition.html','excel-automation.html','admin-system.html','api-integration.html','document-workflow.html','ai-automation.html','commerce-ops.html','field-service.html','web-data-collection.html','maintenance.html'];
const details=[feature,admin,excel,api,ai,commerce,field,document,webData];

const productNames=[
  '기존 웹사이트에 필요한 기능 추가','엑셀·CSV 반복작업 자동화','고객·직원·업무 관리자페이지 제작','외부 API 데이터를 내 사이트에 자동 연동','PDF·이미지 문서 값을 추출해 Excel·DB로 정리','기존 서비스에 AI 요약·분류·초안 기능 추가','쇼핑몰 주문·배송·환불 관리자페이지 제작','예약·기사배정·현장업무 관리 시스템 제작','공개 웹데이터를 자동 수집해 Excel로 정리','기존 웹서비스 오류수정·기능개선·유지보수'
];

test('homepage sells concrete freelance deliverables instead of abstract development categories',()=>{
  assert.match(html,/필요한 기능을 말해주시면/);
  for(const phrase of productNames.slice(0,6)) assert.match(html,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(html,/판매 가능한 10개 상품 전체 보기/);
  assert.ok(html.includes('./work/'));
  for(const jargon of ['Dead Letter','Idempotency','WorkflowPreset','Local RAG','RBAC']) assert.ok(!html.includes(jargon),`homepage jargon returned: ${jargon}`);
  for(const clutter of ['PROJECT-BRIEF','견적 문의','49만원','149만원','299만원']) assert.ok(!html.includes(clutter),`homepage sales clutter returned: ${clutter}`);
  assert.match(html,/문의·견적·계약은 개발 수주 플랫폼에서 진행합니다/);
});

test('homepage design keeps restrained catalog hierarchy',()=>{
  for(const token of ['--accent:#4f46e5','border:1px solid var(--line)','case-flow','hero-proof','product-row','proof-card']) assert.ok(homeCss.includes(token),`missing design token/pattern: ${token}`);
  assert.doesNotMatch(homeCss,/box-shadow:0 20px 55px/);
});

test('full work page and README preserve all seven current flagship versions',()=>{for(const v of versions){const r=new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));assert.match(work,r);assert.match(readme,r);}});

test('service hub exposes ten purchasable tasks and evidence routes',()=>{
  for(const p of servicePaths)assert.ok(hub.includes(`./${p}`),`missing ${p}`);
  assert.ok(hub.includes('../mini-labs/'));
  for(const phrase of productNames)assert.match(hub,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const jargon of ['Idempotency','Dead Letter','Local RAG','RBAC','WorkflowPreset'])assert.ok(!hub.includes(jargon),`service hub jargon returned: ${jargon}`);
});

test('service details explain inputs and business outcomes before implementation details',()=>{
  assert.match(feature,/현재 화면과 원하는 결과/);
  assert.match(admin,/고객 등록부터 업무 배정과 승인까지/);
  assert.match(excel,/매번 파일을 열어 정리하던 일을/);
  assert.match(api,/한 프로그램의 정보를\s*<br>다른 프로그램으로 자동으로 옮깁니다/);
  assert.match(ai,/AI가 먼저 읽고 정리하고/);
  assert.match(commerce,/주문이 들어온 뒤의 운영을/);
  assert.match(field,/고객 예약부터 기사 배정과/);
  assert.match(document,/문서를 받은 뒤의 검토와 승인까지/);
  assert.match(webData,/수집할 페이지와 원하는 결과 열/);
  for(const page of details){assert.doesNotMatch(page,/PROJECT-BRIEF/);assert.doesNotMatch(page,/\d+만원/);}
});

test('service pages preserve technical public evidence after plain-language explanation',()=>{
  assert.match(admin,/Business Ops Dashboard · V8/);assert.match(admin,/Approval Workflow/);
  assert.match(excel,/Customer Data Workbench · V3/);assert.match(excel,/Batch\/Migration/);
  assert.match(api,/Integration Control Center · V3/);assert.match(api,/Dead Letter/);
  assert.match(ai,/AI Workflow Review Desk · V2/);assert.match(ai,/Local Knowledge Retrieval/);
  assert.match(commerce,/Commerce Ops Console · V1/);assert.match(field,/Booking & Field Service Ops · V1/);assert.match(document,/Document Intake & Approval · V1/);
  assert.match(webData,/Extraction \/ Browser Automation Mini Labs/);
});

test('service UI remains proof-focused instead of its own quote funnel',()=>{
  assert.match(serviceCss,/\.price-chip,#price,\.price-grid,\.cta/);
  assert.match(serviceCss,/display:none!important/);
  assert.match(hub,/문의·견적·계약은 개발 수주 플랫폼에서 진행합니다/);
});

test('customer-facing assets do not advertise superseded flagship versions',()=>{const current=[html,work,readme,services,hub,admin,excel,api,ai,kmong,soomgo,assets].join('\n');for(const stale of ['Business Ops Dashboard · V6','Business Ops Dashboard V6','Customer Data Workbench · V2.4','Customer Data Workbench V2.4','Integration Control Center · V2','Integration Control Center V2','AI Workflow Review Desk · V1','AI Workflow Review Desk V1'])assert.ok(!current.includes(stale),`stale public label: ${stale}`);});

test('sales assets keep platform pricing while homepage stays price-free',()=>{assert.doesNotMatch(html,/\d+만원/);for(const price of ['49만원','149만원','299만원','499만원']){assert.match(services,new RegExp(price));assert.match(kmong,new RegExp(price));}for(const monthly of ['15만원','30만원','50만원'])assert.match(services,new RegExp(monthly));});

test('scope estimator remains optional and keeps no-storage boundary',()=>{for(const value of ['feature','excel','admin','ai','integration','commerce','field','document'])assert.match(estimator,new RegExp(`value="${value}"`));assert.match(estimator,/서버로 전송하거나 저장하지 않습니다/);assert.ok(!html.includes('./scope-estimator/'));});

test('sales assets cover the established flagship categories',()=>{for(const phrase of ['관리자페이지','Excel / CSV','REST API','AI Workflow','쇼핑몰','예약','문서접수']){assert.match(kmong,new RegExp(phrase));assert.match(soomgo,new RegExp(phrase));}for(const version of ['Business Ops Dashboard V8','Customer Data Workbench V3','AI Workflow Review Desk V2','Integration Control Center V3','Commerce Ops Console V1','Booking & Field Service Ops V1','Document Intake & Approval V1'])assert.match(assets,new RegExp(version));});

test('sitemap publishes product pages, work index and live demos',()=>{assert.ok(sitemap.includes('https://kzone87.github.io/portfolio/work/'));for(const p of servicePaths)assert.match(sitemap,new RegExp(`services/${p.replace('.','\\.')}`));for(const route of ['ai-workflow-review-desk/','integration-control-center/','commerce-ops-console/','field-service-ops/','document-intake-approval/','mini-labs/'])assert.ok(sitemap.includes(`https://kzone87.github.io/portfolio/${route}`));});

test('Engineering Mini Labs remains executable evidence but is not homepage clutter',()=>{assert.match(mini,/ENGINEERING MINI LABS · V1/);for(const label of ['게시물 등록','데이터 추출','반복 웹작업','입력 방어','배포 점검'])assert.match(mini,new RegExp(label));assert.match(mini,/NO CREDENTIALS/);assert.ok(!html.includes('ENGINEERING MINI LABS'));});

test('public portfolio assets contain no common credential patterns',()=>{const all=[html,work,readme,services,hub,...details,mini,kmong,soomgo,assets,estimator].join('\n');assert.doesNotMatch(all,/sk-[A-Za-z0-9_-]{20,}/);assert.doesNotMatch(all,/AIza[0-9A-Za-z_-]{20,}/);});

test('portfolio keeps public-only evidence and leaves sales conversion to platforms',()=>{assert.match(readme,/공개 가능한 저장소와 검증 가능한 공개 기록만/);assert.match(work,/공개 코드 또는 공개 Live Lab과 가상 데이터만 사용/);assert.doesNotMatch(html,/PROJECT-BRIEF/);assert.doesNotMatch(html,/견적문의/);assert.match(html,/개발 수주 플랫폼/);});
