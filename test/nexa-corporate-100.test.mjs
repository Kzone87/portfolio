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

function visibleText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

function bodyWithoutFooter(html) {
  return visibleText(html.replace(/<footer[\s\S]*?<\/footer>/i, ' '));
}

test('NEXA publishes seven complete customer-facing corporate pages with one plain identity', async () => {
  for (const page of pages) {
    await access(new URL(`../nexa-tech-service/${page}`, import.meta.url));
    const html = htmlByPage[page];
    assert.match(html, /NEXA TECH/);
    assert.match(html, /styles-100\.css/);
    assert.match(html, /clarity\.css/);
    assert.match(html, /기업용 출력·사무장비 유지보수 · 현장지원/);
    assert.match(html, /<meta name="description"/);
    assert.match(html, /rel="canonical"/);
    assert.match(html, /<meta property="og:title"/);
    assert.match(html, /<meta property="og:url"/);
    assert.match(html, /class="skip-link"/);
    assert.match(html, /포트폴리오 시연을 위해 구성한 가상 브랜드/);
    for (const href of ['./about.html','./services.html','./industries.html','./cases.html','./contact.html']) assert.ok(html.includes(`href="${href}"`), `${page} missing ${href}`);
  }
});

test('customer-facing NEXA body does not narrate itself as a portfolio project', () => {
  for (const [page, html] of Object.entries(htmlByPage)) {
    const body = bodyWithoutFooter(html);
    assert.doesNotMatch(body, /포트폴리오|다음 프로젝트|가상 시나리오|가짜 실적|실제 고객 실적을 가장|실적을 꾸미는 대신/, `${page} contains portfolio narration`);
    assert.doesNotMatch(html, /\.\.\/field-service-ops\//, `${page} must not expose internal workspace link`);
  }
});

test('homepage explains the actual service before operating philosophy', () => {
  const html = htmlByPage['index.html'];
  const heroEnd = html.indexOf('</section>');
  const hero = visibleText(html.slice(0, heroEnd));
  for (const phrase of ['기업용 출력·인쇄·사무장비 유지보수','복합기, 프린터, 디지털 인쇄장비','정기점검','장애 대응','설치·이전']) assert.match(hero, new RegExp(phrase));
  assert.ok(hero.indexOf('기업용 출력·인쇄·사무장비') < hero.indexOf('멈추기 전의 운영'), 'plain service definition must precede philosophy');
  for (const phrase of ['제공 서비스','주요 고객','서비스 관리 기준','서비스 진행 과정','서비스 품질 관리','서비스 적용 예시','서비스 운영 원칙']) assert.match(html, new RegExp(phrase));
  assert.doesNotMatch(html, /\b\d+(?:\.\d+)?%\b|고객사 로고|공식 파트너|인증 보유/);
});

test('homepage answers equipment service customer and process in ordinary Korean', () => {
  const html = htmlByPage['index.html'];
  for (const phrase of ['지원 장비','복합기 · 프린터 · 디지털 인쇄장비','주요 서비스','점검 · 고장대응 · 설치·이전','단일 사업장 · 여러 지점','요청 접수','긴급도 판단','기사 배정','현장 작업','정상 확인','후속관리']) assert.match(html, new RegExp(phrase));
  assert.doesNotMatch(html, /<h1>[^<]*(?:Field Service|Lifecycle|Incident|Multi-site)/i);
});

test('services explain fit scope priority and deliverables in customer language', () => {
  const html = htmlByPage['services.html'];
  for (const id of ['maintenance','support','install','multisite','lifecycle']) assert.match(html, new RegExp(`id="${id}"`));
  for (const phrase of ['정기점검·예방관리','고장·장애 현장지원','신규 설치·장비 이전','다사업장 장비관리','장비 이력·교체 검토','이런 환경에 적합합니다','관리 범위','PRIORITY MODEL','ENGAGEMENT MODEL','DELIVERABLES','업무 영향']) assert.match(html, new RegExp(phrase));
  assert.doesNotMatch(html, /\b[1248]\s*시간\b|당일 방문 보장|24\/7 보장|SLA\s*\d+/i);
});

test('industry page gives multiple buyer segments a recognizable entry point', () => {
  const html = htmlByPage['industries.html'];
  for (const phrase of ['생산·인쇄·제조 현장','유통·프랜차이즈·다지점','기업·교육·공공 사무환경','장비 공급사·서비스 파트너','물류·운영 거점','성장 중인 중소·중견기업','주요 고민','추천 구조','확인 지표','장비가 멈추면']) assert.match(html, new RegExp(phrase));
});

test('application examples read like customer situations without pretending to be customer proof', () => {
  const html = htmlByPage['cases.html'];
  for (const phrase of ['서비스 적용 예시','SERVICE SCENARIO','문제','서비스 방식','관리 결과','지점마다 따로 들어오는 장비 요청','비슷한 고장이 계속 반복','이전 당일','담당자가 바뀔 때마다']) assert.match(html, new RegExp(phrase));
  assert.match(html, /data-case-filter="all"/);
  assert.match(html, /data-case="production"/);
  assert.doesNotMatch(html, /PORTFOLIO SCENARIO|실제 고객사|긴급출동 -31%|반복장애 -42%|초기 가동 100%|확인시간 -37%/);
});

test('company page reads like a service company rather than a design case study', () => {
  const html = htmlByPage['about.html'];
  for (const phrase of ['기업용 장비를','복합기, 프린터, 디지털 인쇄장비','QUALITY','SAFETY','INFORMATION','BOUNDARY','SERVICE RESPONSIBILITY','지원 범위']) assert.match(html, new RegExp(phrase));
  assert.doesNotMatch(bodyWithoutFooter(html), /가짜 직원|공식 인증·보험·제조사 권한|포트폴리오/);
  assert.doesNotMatch(html, /ISO\s*\d+\s*인증|공식 인증 보유|제조사 공인|보험 가입 완료/);
});

test('contact behaves like a real consultation flow while preserving demo honesty', () => {
  const html = htmlByPage['contact.html'];
  for (const name of ['company','name','phone','email','industry','sites','assets','impact','service','engagement','detail','consent']) assert.match(html, new RegExp(`name="${name}"`));
  assert.match(html, /장비 모델을 정확히 몰라도/);
  assert.match(html, /현재 가장 불편한 점/);
  assert.match(html, /상담 내용 확인/);
  assert.match(html, /현재 데모 환경에서는 입력 내용이 외부 서버로 전송되지 않습니다/);
  assert.match(html, /id="form-summary"/);
  assert.match(app, /navigator\.clipboard/);
  assert.match(app, /\[NEXA TECH SERVICE 유지보수 상담\]/);
  assert.match(app, /aria-invalid/);
  assert.doesNotMatch(app, /포트폴리오 데모|문의가 정상적으로 접수되었습니다|실제 전송 완료|전송되었습니다/);
});

test('clarity layer remains responsive and uses Korean-first hierarchy', () => {
  assert.match(clarity, /\.hero-clarity h1/);
  assert.match(clarity, /\.quick-answer/);
  assert.match(clarity, /\.plain-service-grid/);
  assert.match(clarity, /\.plain-flow/);
  assert.match(clarity, /word-break:keep-all/);
  assert.match(clarity, /@media\(max-width:700px\)/);
});

test('interaction and responsive layer preserve accessibility and progressive enhancement', () => {
  assert.match(css, /focus-visible/);
  assert.match(css, /\.skip-link:focus/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\.case-filter button\{[^}]*min-height:40px/);
  assert.match(css, /\.quality-grid\.light-quality h3\{color:#163d60\}/);
  assert.match(app, /prefers-reduced-motion: reduce/);
  assert.match(app, /IntersectionObserver/);
  assert.match(app, /event\.key === 'Escape'/);
});

test('service management page proves operational competence without exposing the internal app', () => {
  const html = htmlByPage['playbook.html'];
  for (const phrase of ['SERVICE MANAGEMENT','SERVICE INTAKE','PREVENTIVE CHECK','FIELD REPORT','FOLLOW-UP','SERVICE PERFORMANCE','SERVICE MATURITY','고장 접수표','예방점검','현장 작업보고서']) assert.match(html, new RegExp(phrase));
  assert.doesNotMatch(html, /NEXA FIELD OPS|\.\.\/field-service-ops\//);
  assert.doesNotMatch(html, /고객 만족도\s*\d+%|평균 복구시간\s*\d+|실제 고객사/);
});

test('trust center exposes concrete operating checks without fake people or credentials', () => {
  const html = htmlByPage['about.html'];
  for (const phrase of ['TRUST CENTER','SERVICE QUALITY','FIELD SAFETY','INFORMATION HANDLING','CONTRACT BOUNDARY','SERVICE TEAM','Service Coordinator','Technical Escalation','Operations Manager']) assert.match(html, new RegExp(phrase));
  assert.doesNotMatch(html, /대표이사|CEO|공인 엔지니어|ISO\s*\d+/i);
});

test('portfolio explains the two-surface domain while each product stays in role', () => {
  assert.match(portfolioHome, /고객이 보는 기업 홈페이지부터 기사가 사용하는 배차·현장 관리 화면까지/);
  assert.match(portfolioHome, /href="\.\/nexa-tech-service\/"/);
  assert.match(portfolioHome, /href="\.\/field-service-ops\/"/);
  assert.match(fieldOps, /Service Operations · 내부 현장 운영/);
  assert.match(fieldOps, /배차 현황/);
  assert.doesNotMatch(fieldOps, /← 프로젝트|포트폴리오/);
});

test('all NEXA copy avoids fabricated commercial proof while keeping only a footer boundary notice', () => {
  const bodyText = pages.map(page => bodyWithoutFooter(htmlByPage[page])).join(' ');
  assert.doesNotMatch(bodyText, /포트폴리오|실제 고객 실적|공식 고객사|24시간 출동 보장/);
  const allText = pages.map(page => visibleText(htmlByPage[page])).join(' ');
  assert.match(allText, /포트폴리오 시연을 위해 구성한 가상 브랜드/);
  for (const pattern of [/긴급출동\s*-\d+%/,/반복장애\s*-\d+%/,/초기 가동\s*100%/,/확인시간\s*-\d+%/,/고객 만족도\s*\d+%/,/SLA\s*99\.\d+%/,/공식 고객사/,/24시간 출동 보장/]) assert.doesNotMatch(allText, pattern);
});
