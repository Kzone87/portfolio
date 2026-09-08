import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const pages = ['index.html','about.html','services.html','industries.html','cases.html','playbook.html','contact.html'];
const htmlByPage = Object.fromEntries(await Promise.all(pages.map(async page => [page, await load(`nexa-tech-service/${page}`)])));
const app = await load('nexa-tech-service/app.js');
const css = await load('nexa-tech-service/styles-100.css');
const clarity = await load('nexa-tech-service/clarity.css');
const portfolioHome = await load('index.html');
const fieldOps = await load('field-service-ops/index.html');
const fieldOpsApp = await load('field-service-ops/app.js');
const portal = await load('nexa-service-domain/index.html');
const portalCss = await load('nexa-service-domain/styles.css');
const portalApp = await load('nexa-service-domain/app.js');

function visibleText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

function bodyWithoutFooter(html) {
  return visibleText(html.replace(/<footer[\s\S]*?<\/footer>/i, ' '));
}

test('NEXA publishes seven complete customer-facing pages with one customer navigation model', async () => {
  for (const page of pages) {
    await access(new URL(`../nexa-tech-service/${page}`, import.meta.url));
    const html = htmlByPage[page];
    assert.match(html, /NEXA TECH/);
    assert.match(html, /기업용 출력·사무장비 유지보수 · 현장지원/);
    assert.match(html, /<meta name="description"/);
    assert.match(html, /rel="canonical"/);
    assert.match(html, /<meta property="og:title"/);
    assert.match(html, /class="skip-link"/);
    assert.match(html, /포트폴리오 시연을 위해 구성한 가상 브랜드/);
    for (const href of ['./about.html','./services.html','./industries.html','./cases.html','./contact.html']) assert.ok(html.includes(`href="${href}"`), `${page} missing ${href}`);
    for (const label of ['회사소개','서비스','이용 고객','이용 상황','상담']) assert.ok(visibleText(html).includes(label), `${page} missing nav label ${label}`);
  }
});

test('customer-facing NEXA never narrates itself as a portfolio or exposes the staff workspace', () => {
  const forbidden = /포트폴리오|다음 프로젝트|가상 시나리오|가짜 실적|실제 고객 실적을 가장|실적을 꾸미는 대신|SERVICE BLUEPRINT|SERVICE MATURITY|TRUST CENTER|SERVICE TEAM|IMPLEMENTATION PROOF|DESIGN DECISION/i;
  for (const [page, html] of Object.entries(htmlByPage)) {
    const body = bodyWithoutFooter(html);
    assert.doesNotMatch(body, forbidden, `${page} contains portfolio or design narration`);
    assert.doesNotMatch(html, /\.\.\/field-service-ops\//, `${page} must not expose internal workspace link`);
  }
});

test('homepage behaves like a real maintenance company website and routes existing customers to service status', () => {
  const html = htmlByPage['index.html'];
  const hero = visibleText(html.slice(0, html.indexOf('</section>')));
  for (const phrase of ['기업용 출력·인쇄·사무장비 유지보수','복합기, 프린터, 디지털 인쇄장비','정기점검','고장 대응','설치·이전']) assert.match(hero, new RegExp(phrase));
  for (const phrase of ['서비스','이런 고객이 이용합니다','서비스는 이렇게 진행됩니다','이런 상황이 있나요','안심하고 맡길 수 있도록','자주 묻는 질문','유지보수 상담']) assert.ok(html.includes(phrase), `homepage missing ${phrase}`);
  assert.match(app, /진행 조회/);
  assert.match(app, /접수 진행 확인/);
  assert.match(app, /nexa-service-domain/);
  assert.doesNotMatch(bodyWithoutFooter(html), /SERVICE MANAGEMENT|PERFORMANCE|TRUST & GOVERNANCE|APPLICATION EXAMPLES|FIELD SERVICE/i);
  assert.doesNotMatch(html, /\b\d+(?:\.\d+)?%\b|고객사 로고|공식 파트너|인증 보유/);
});

test('services page answers when customers need help and what they receive', () => {
  const html = htmlByPage['services.html'];
  for (const id of ['maintenance','support','install','multisite','lifecycle']) assert.match(html, new RegExp(`id="${id}"`));
  for (const phrase of ['고장 전에 상태를 확인하고 싶을 때','장비가 멈추거나 이상 증상이 생겼을 때','신규 장비를 설치하거나 장소를 옮길 때','지점마다 장비 요청 방식이 달라 관리가 어려울 때','계속 수리할지 교체를 검토할지','고장이 여러 건이면','이용 방법','작업 후 안내']) assert.ok(html.includes(phrase), `services missing ${phrase}`);
  assert.doesNotMatch(bodyWithoutFooter(html), /PRIORITY MODEL|ENGAGEMENT MODEL|DELIVERABLES|INCIDENT|MULTI-SITE|LIFECYCLE/i);
  assert.doesNotMatch(html, /\b[1248]\s*시간\b|당일 방문 보장|24\/7 보장|SLA\s*\d+/i);
});

test('customer page lets buyers recognize themselves by operational pain', () => {
  const html = htmlByPage['industries.html'];
  for (const phrase of ['장비가 멈추면','이런 문제가 반복되고 있나요','생산·인쇄 현장','기업·교육·공공 사무환경','유통·프랜차이즈·다지점','장비 공급사·서비스 파트너','물류·운영 거점','성장 중인 중소·중견기업','자주 생기는 문제','어떤 서비스를 선택할까요']) assert.ok(html.includes(phrase), `industries missing ${phrase}`);
  assert.doesNotMatch(bodyWithoutFooter(html), /추천 구조|확인 지표|CUSTOMER FIT|WHAT TO MANAGE/i);
});

test('situations page reads like relatable customer problems rather than showcase scenarios', () => {
  const html = htmlByPage['cases.html'];
  for (const phrase of ['이용 상황','지금 겪는 문제와','지점마다 장비 고장 요청이 따로 들어옵니다','비슷한 고장이 계속 반복됩니다','설치가 지연됩니다','담당자가 바뀔 때마다','서비스를 받고 나면']) assert.ok(html.includes(phrase), `cases missing ${phrase}`);
  assert.match(html, /data-case-filter="all"/);
  assert.match(html, /data-case="production"/);
  assert.doesNotMatch(bodyWithoutFooter(html), /SERVICE SCENARIO|SERVICE BLUEPRINT|WHAT GOOD LOOKS LIKE|PORTFOLIO SCENARIO/i);
  assert.doesNotMatch(html, /실제 고객사|긴급출동 -31%|반복장애 -42%|초기 가동 100%|확인시간 -37%/);
});

test('company page sells the service company rather than explaining its design', () => {
  const html = htmlByPage['about.html'];
  for (const phrase of ['NEXA가 하는 일','지원 장비','서비스 약속','서비스 이용 전 확인','작업 후 안내','복합기·프린터','디지털 인쇄·고용량 출력장비']) assert.ok(html.includes(phrase), `about missing ${phrase}`);
  assert.doesNotMatch(bodyWithoutFooter(html), /OPERATING MODEL|SERVICE TEAM|TRUST CENTER|SERVICE RESPONSIBILITY|QUALITY|SAFETY|INFORMATION|BOUNDARY/);
  assert.doesNotMatch(html, /ISO\s*\d+\s*인증|공식 인증 보유|제조사 공인|보험 가입 완료/);
});

test('service guide explains what customers experience from intake to follow-up', () => {
  const html = htmlByPage['playbook.html'];
  for (const phrase of ['서비스 진행 안내','1. 고장 접수','2. 방문 전 안내','3. 현장 작업','4. 작업 결과 안내','5. 후속 작업','정기점검을 이용한다면']) assert.ok(html.includes(phrase), `playbook missing ${phrase}`);
  assert.doesNotMatch(bodyWithoutFooter(html), /SERVICE MANAGEMENT|SERVICE INTAKE|PREVENTIVE CHECK|FIELD REPORT|FOLLOW-UP|SERVICE PERFORMANCE|SERVICE MATURITY/i);
  assert.doesNotMatch(html, /NEXA FIELD OPS|\.\.\/field-service-ops\//);
});

test('contact behaves like a customer worksheet without pretending to submit online', () => {
  const html = htmlByPage['contact.html'];
  for (const name of ['company','name','phone','email','industry','sites','assets','impact','service','engagement','detail','consent']) assert.match(html, new RegExp(`name="${name}"`));
  for (const phrase of ['장비 모델을 몰라도 괜찮습니다','현재 가장 불편한 점','상담 내용 확인하기','서버로 전송하지 않습니다','상담 내용 확인']) assert.ok(html.includes(phrase), `contact missing ${phrase}`);
  assert.match(app, /navigator\.clipboard/);
  assert.match(app, /\[NEXA TECH SERVICE 유지보수 상담\]/);
  assert.match(app, /상담 내용을 정리했습니다/);
  assert.match(app, /aria-invalid/);
  assert.match(app, /이 요청 진행 조회하기/);
  assert.doesNotMatch(app, /현재 데모 환경|포트폴리오 데모|문의가 정상적으로 접수되었습니다|실제 전송 완료/);
});

test('portfolio main explains NEXA in customer outcomes and routes to all product surfaces', () => {
  for (const phrase of ['고객 상담부터 현장 배차까지 이어지는 유지보수 서비스','문의가 끊기지 않게','현장 운영을 한눈에','완료 이후까지','서비스 운영 흐름 보기','01 · 고객 서비스 화면','02 · 직원 배차 화면']) assert.ok(portfolioHome.includes(phrase), `portfolio missing ${phrase}`);
  assert.match(portfolioHome, /href="\.\/nexa-service-domain\/"/);
  assert.match(portfolioHome, /href="\.\/nexa-tech-service\/"/);
  assert.match(portfolioHome, /href="\.\/field-service-ops\/"/);
  assert.doesNotMatch(portfolioHome, /왜 두 화면인가|역할 분리|구현 근거|ONE DOMAIN · TWO SURFACES/);
});

test('NEXA customer service is a functional request portal rather than portfolio explanation', () => {
  for (const phrase of ['서비스 요청 조회','접수번호','상담 연락처','현재 진행상태','방문 정보','요청 처리 현황','방문 전 준비','최근 안내','작업 결과']) assert.ok(portal.includes(phrase), `portal missing ${phrase}`);
  assert.match(portal, /id="lookup-form"/);
  assert.match(portal, /id="request-view"/);
  assert.match(portalApp, /NEXA_CUSTOMER_PORTAL_ENDPOINT/);
  assert.match(portalApp, /\/api\/customer\/requests\/lookup/);
  assert.doesNotMatch(bodyWithoutFooter(portal), /KZONE87|Portfolio|왜 두 화면인가|역할 분리|구현 근거|직원용 현장 운영|\.\.\/field-service-ops\//i);
  assert.match(portalCss, /\.lookup-card/);
  assert.match(portalCss, /\.timeline/);
  assert.match(portalCss, /@media\(max-width:420px\)/);
});

test('field operations is a signed-in staff workspace, not a tutorial or role-switching demo', () => {
  for (const phrase of ['NEXA SERVICE OPERATIONS','직원 전용 · 상담 / 배차 / 현장 운영','상담 접수함','9월 7일 배차 현황','운영 기준일','서울 운영팀','김현수','운영 관리자','기사별 일정','방문 요청','우선 확인할 항목','최근 변경 이력','작업 상태']) assert.ok(fieldOps.includes(phrase), `field ops missing ${phrase}`);
  assert.doesNotMatch(fieldOps, /← 프로젝트|포트폴리오|고객용 홈페이지 보기|프로젝트 설명|이 시스템은|id="role"|현재 역할/);
  assert.match(fieldOpsApp, /NEXA_OPS_CONFIG/);
  assert.match(fieldOpsApp, /demo-delivery-app\.mjs/);
  assert.doesNotMatch(fieldOpsApp, /el\.role\.addEventListener/);
});

test('all NEXA surfaces avoid fabricated commercial proof', () => {
  const allCustomerText = pages.map(page => visibleText(htmlByPage[page])).join(' ');
  assert.match(allCustomerText, /포트폴리오 시연을 위해 구성한 가상 브랜드/);
  for (const pattern of [/긴급출동\s*-\d+%/,/반복장애\s*-\d+%/,/초기 가동\s*100%/,/확인시간\s*-\d+%/,/고객 만족도\s*\d+%/,/SLA\s*99\.\d+%/,/공식 고객사/,/24시간 출동 보장/]) assert.doesNotMatch(allCustomerText, pattern);
});

test('responsive and accessibility foundations stay intact', () => {
  assert.match(clarity, /word-break:keep-all/);
  assert.match(clarity, /responsive-100\.css/);
  assert.match(clarity, /@media\(max-width:700px\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(app, /prefers-reduced-motion: reduce/);
  assert.match(app, /IntersectionObserver/);
  assert.match(app, /event\.key === 'Escape'/);
  assert.match(portalCss, /focus-visible/);
});
