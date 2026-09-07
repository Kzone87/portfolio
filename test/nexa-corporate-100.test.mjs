import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const pages = ['index.html','about.html','services.html','industries.html','cases.html','contact.html'];
const htmlByPage = Object.fromEntries(await Promise.all(pages.map(async page => [page, await load(`nexa-tech-service/${page}`)])));
const app = await load('nexa-tech-service/app.js');
const css = await load('nexa-tech-service/styles-100.css');

function visibleText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

test('NEXA publishes six complete customer-facing corporate pages', async () => {
  for (const page of pages) {
    await access(new URL(`../nexa-tech-service/${page}`, import.meta.url));
    const html = htmlByPage[page];
    assert.match(html, /NEXA TECH/);
    assert.match(html, /styles-100\.css/);
    assert.match(html, /<meta name="description"/);
    assert.match(html, /rel="canonical"/);
    assert.match(html, /<meta property="og:title"/);
    assert.match(html, /<meta property="og:url"/);
    assert.match(html, /class="skip-link"/);
    assert.match(html, /포트폴리오 시연을 위해 구성한 가상 기업/);
    for (const href of ['./about.html','./services.html','./industries.html','./cases.html','./contact.html']) {
      assert.ok(html.includes(`href="${href}"`), `${page} missing ${href}`);
    }
  }
});

test('homepage sells operational outcomes to diverse B2B buyers without fake proof', () => {
  const html = htmlByPage['index.html'];
  for (const phrase of [
    '멈추기 전의 운영',
    '생산·인쇄·제조 현장',
    '유통·프랜차이즈·다지점',
    '기업·교육·공공 사무환경',
    '장비 공급사·서비스 파트너',
    '예방 유지보수',
    '장애·긴급 지원',
    '설치·이전·변경',
    '다사업장 운영',
    '장비 수명주기 관리',
    'SERVICE LEVELS',
    'TRUST & GOVERNANCE'
  ]) assert.match(html, new RegExp(phrase));
  assert.doesNotMatch(html, /\b\d+(?:\.\d+)?%\b|고객사 로고|공식 파트너|인증 보유/);
});

test('services explain fit, scope, priority and deliverables instead of vague feature cards', () => {
  const html = htmlByPage['services.html'];
  for (const id of ['maintenance','support','install','multisite','lifecycle']) assert.match(html, new RegExp(`id="${id}"`));
  for (const phrase of ['이런 환경에 적합합니다','관리 범위','PRIORITY MODEL','ENGAGEMENT MODEL','DELIVERABLES','업무 영향']) assert.match(html, new RegExp(phrase));
  assert.doesNotMatch(html, /\b[1248]\s*시간\b|당일 방문 보장|24\/7 보장|SLA\s*\d+/i);
});

test('industry page gives multiple buyer segments a recognizable entry point', () => {
  const html = htmlByPage['industries.html'];
  for (const phrase of [
    '생산·인쇄·제조 현장',
    '유통·프랜차이즈·다지점',
    '기업·교육·공공 사무환경',
    '장비 공급사·서비스 파트너',
    '물류·운영 거점',
    '성장 중인 중소·중견기업',
    '주요 고민',
    '추천 구조',
    '확인 지표'
  ]) assert.match(html, new RegExp(phrase));
});

test('case library is explicitly fictional and uses challenge-approach-outcome reasoning', () => {
  const html = htmlByPage['cases.html'];
  assert.match(html, /실제 고객, 계약, 성과 수치를 의미하지 않/);
  assert.match(html, /PORTFOLIO SCENARIO/);
  assert.match(html, /CHALLENGE/);
  assert.match(html, /APPROACH/);
  assert.match(html, /OPERATIONAL EFFECT/);
  assert.match(html, /data-case-filter="all"/);
  assert.match(html, /data-case="production"/);
  assert.doesNotMatch(html, /긴급출동 -31%|반복장애 -42%|초기 가동 100%|확인시간 -37%|실제 고객사/);
});

test('company trust page is credible without inventing certification or authorization', () => {
  const html = htmlByPage['about.html'];
  for (const phrase of ['QUALITY','SAFETY','INFORMATION','BOUNDARY','SERVICE RESPONSIBILITY','지원 가능 범위']) assert.match(html, new RegExp(phrase));
  assert.match(html, /공식 인증·보험·제조사 권한/);
  assert.doesNotMatch(html, /ISO\s*\d+\s*인증|공식 인증 보유|제조사 공인|보험 가입 완료/);
});

test('contact is a qualification flow and never pretends to send data', () => {
  const html = htmlByPage['contact.html'];
  for (const name of ['company','name','phone','email','industry','sites','assets','impact','service','engagement','detail','consent']) {
    assert.match(html, new RegExp(`name="${name}"`));
  }
  assert.match(html, /상담 요청서 만들기/);
  assert.match(html, /실제 서버나 회사로 전송되지/);
  assert.match(html, /id="form-summary"/);
  assert.match(app, /navigator\.clipboard/);
  assert.match(app, /상담 요청서 미리보기/);
  assert.match(app, /aria-invalid/);
  assert.doesNotMatch(app, /문의가 정상적으로 접수되었습니다|실제 전송 완료|전송되었습니다/);
});

test('interaction and responsive layer preserve accessibility and progressive enhancement', () => {
  assert.match(css, /focus-visible/);
  assert.match(css, /\.skip-link:focus/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\.case-filter button\{[^}]*min-height:40px/);
  assert.match(app, /prefers-reduced-motion: reduce/);
  assert.match(app, /IntersectionObserver/);
  assert.match(app, /event\.key === 'Escape'/);
});

test('all NEXA public copy avoids fabricated commercial proof', () => {
  const text = pages.map(page => visibleText(htmlByPage[page])).join(' ');
  for (const pattern of [
    /긴급출동\s*-\d+%/,
    /반복장애\s*-\d+%/,
    /초기 가동\s*100%/,
    /확인시간\s*-\d+%/,
    /고객 만족도\s*\d+%/,
    /SLA\s*99\.\d+%/,
    /공식 고객사/,
    /실제 고객 실적/,
    /24시간 출동 보장/
  ]) assert.doesNotMatch(text, pattern);
});
