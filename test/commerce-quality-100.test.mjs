import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const html = await load('commerce-ops-console/index.html');
const app = await load('commerce-ops-console/app.js');
const engine = await load('commerce-ops-console/engine.mjs');
const css = await load('commerce-ops-console/styles.css');
const liveQa = await load('scripts/commerce-live-page-qa.mjs');
const workflow = await load('.github/workflows/commerce-live-pages-qa.yml');

test('commerce console behaves like an internal operations product, not a portfolio landing page', () => {
  assert.match(html, /주문 운영/);
  assert.match(html, /지금 먼저 확인할 업무/);
  assert.match(html, /운영 스냅샷/);
  assert.match(html, /id="payment-filter" aria-label="결제상태"/);
  assert.match(html, /id="reset-filters"/);
  assert.match(html, /class="mobile-nav"/);
  assert.match(html, /관리자 권한과 결정 메모/);
  assert.match(html, /rel="canonical" href="https:\/\/kzone87\.github\.io\/portfolio\/commerce-ops-console\/"/);
  assert.doesNotMatch(html, /← 프로젝트|포트폴리오|체험 방법|시연 주문 업무/);
});

test('commerce UI exposes operational queue filtering and auditable sensitive actions', () => {
  assert.match(app, /paymentStatus:el\.paymentFilter\.value/);
  assert.match(app, /data-quick-filter/);
  assert.match(app, /state\.queueMode==='unfulfilled'/);
  assert.match(app, /decisionText\.length<4/);
  assert.match(app, /decisionNote:decisionText/);
  assert.match(app, /b\.dataset\.action=action/);
  assert.match(app, /el\.orderVersion\.textContent=`v\$\{order\.version\}`/);
  assert.match(engine, /decisionNote\.length < 4 \|\| decisionNote\.length > 500/);
});

test('commerce responsive layer keeps mobile navigation and narrow layouts first-class', () => {
  assert.match(css, /\.mobile-nav\{display:none\}/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]*\.mobile-nav\{position:sticky/);
  assert.match(css, /@media\(max-width:480px\)/);
  assert.match(css, /\.decision-note/);
  assert.match(css, /\.priority-actions/);
});

test('commerce production QA waits for same-SHA Pages and verifies real workflow in three viewports', () => {
  for (const width of ['1440', '768', '390']) assert.match(liveQa, new RegExp(`width: ${width}`));
  assert.match(liveQa, /START_PICKING/);
  assert.match(liveQa, /SHIP/);
  assert.match(liveQa, /DELIVER/);
  assert.match(liveQa, /decision-note/);
  assert.ok(liveQa.includes('[data-decision="APPROVE"]'));
  assert.ok(liveQa.includes('.order-card[data-order-id="1"]'));
  assert.ok(liveQa.includes('.order-card[data-order-id="4"]'));
  assert.doesNotMatch(liveQa, /page\.locator\('\[data-order-id="1"\]'\)\.click/);
  assert.match(liveQa, /'환불 승인', '관리자', '파손 증빙 및 결제 내역 확인 완료'/);
  assert.doesNotMatch(liveQa, /auditText\.includes\('demo-admin'\)/);
  assert.match(liveQa, /STAFF block -> ADMIN refund approval -> audit/);
  assert.match(liveQa, /COMMERCE LIVE PAGES QA: PASS/);
  assert.match(workflow, /Wait for same-SHA GitHub Pages deployment/);
  assert.match(workflow, /head_sha=\$\{GITHUB_SHA\}/);
  assert.match(workflow, /Verify commerce GitHub Pages in real browser/);
});
