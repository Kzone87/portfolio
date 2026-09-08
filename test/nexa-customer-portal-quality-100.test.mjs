import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const html = await load('nexa-service-domain/index.html');
const responsive = await load('nexa-service-domain/responsive-100.css');
const secure = await load('nexa-service-domain/secure-access.js');

test('customer portal explains the real secure journey before lookup', () => {
  for (const copy of [
    '접수번호 확인부터 작업 결과까지',
    '일회용 인증',
    '진행·결과 확인',
    '접수번호만으로 상세정보를 열지 않습니다.',
    '일정 변경, 방문 취소, 추가 문의, 재방문 요청'
  ]) assert.match(html, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  assert.match(html, /aria-describedby="lookup-help lookup-security"/);
  assert.match(html, /<noscript>[\s\S]*요청 조회에는 JavaScript가 필요합니다\./);
});

test('customer portal loads final responsive hardening after feature styles', () => {
  const base = html.indexOf('./styles.css');
  const actions = html.indexOf('./portal-actions.css');
  const secureCss = html.indexOf('./secure-access.css');
  const finalCss = html.indexOf('./responsive-100.css');
  assert.ok(base >= 0 && actions > base && secureCss > actions && finalCss > secureCss);

  assert.match(responsive, /\.portal-journey/);
  assert.match(responsive, /\.portal-assurance/);
  assert.match(responsive, /\.lookup-form>label:first-of-type\{grid-column:1\/-1/);
  assert.match(responsive, /@media\(max-width:420px\)/);
  assert.doesNotMatch(responsive, /\.hero-layout|\.surface-grid|\.final-box/);
});

test('customer portal retains OTP verification and protected detail rendering', () => {
  for (const contract of [
    "sendButton.id='secure-send'",
    "codeInput.id='secure-code'",
    "verifyButton.id='secure-verify'",
    "window.NEXA_PORTAL_RENDER(data)",
    "history.replaceState(null,'',`${location.pathname}?request=${encodeURIComponent(data.id)}`)"
  ]) assert.ok(secure.includes(contract), `missing secure portal contract: ${contract}`);

  assert.match(html, /id="request-view"[^>]*hidden/);
  assert.match(html, /id="lookup-message"[^>]*role="status"[^>]*aria-live="polite"/);
});
