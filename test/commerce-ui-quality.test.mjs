import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('commerce workspace presents readable operational order data', async () => {
  const html = await load('commerce-ops-console/index.html');
  const css = await load('commerce-ops-console/styles.css');

  assert.match(html, /MONO MARKET/);
  assert.match(html, /운영 기준일/);
  assert.doesNotMatch(html, /샘플 쇼핑몰|시연 주문 업무|체험 방법|시연 기준일|오늘의 주문 업무|오늘 업무/);
  assert.match(html, /id="search" type="search" aria-label="주문 검색"/);
  assert.match(html, /id="ops-filter" aria-label="처리상태"/);
  assert.match(html, /id="fulfillment-filter" aria-label="배송상태"/);

  assert.match(css, /\.order-main strong\{font-size:13px/);
  assert.match(css, /\.order-main span\{[^}]*font-size:12px/);
  assert.match(css, /\.order-amount strong\{[^}]*font-size:13px/);
  assert.match(css, /\.customer-line strong\{[^}]*font-size:13px/);
  assert.match(css, /\.timeline-item strong\{font-size:12px/);
  assert.match(css, /\.timeline-item span\{[^}]*font-size:11px/);
  assert.match(css, /\.side-nav nav a\{[^}]*font-size:13px/);
});
