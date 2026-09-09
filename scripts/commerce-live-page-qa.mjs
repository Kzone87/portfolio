import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const url = 'https://kzone87.github.io/portfolio/commerce-ops-console/';
const output = 'commerce-live-qa-artifacts';
const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('CHROME_PATH is required');
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
const failures = [];
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 }
];

async function gotoWithRetry(page) {
  let last;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      if (!response || response.status() >= 400) throw new Error(`HTTP ${response?.status() ?? 'no-response'} ${url}`);
      return;
    } catch (error) {
      last = error;
      await page.waitForTimeout(attempt * 1200);
    }
  }
  throw last;
}

function collectRuntimeErrors(page, errors) {
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`);
  });
  page.on('requestfailed', request => errors.push(`requestfailed: ${request.url()} · ${request.failure()?.errorText || 'unknown error'}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const sizes = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body?.scrollWidth || 0
  }));
  if (sizes.scrollWidth > sizes.clientWidth + 2 || sizes.bodyScrollWidth > sizes.clientWidth + 2) {
    throw new Error(`${label}: horizontal overflow ${JSON.stringify(sizes)}`);
  }
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  const errors = [];
  collectRuntimeErrors(page, errors);
  try {
    await gotoWithRetry(page);
    await page.locator('#order-list .order-card').first().waitFor({ state: 'visible', timeout: 15_000 });
    const body = await page.locator('body').innerText();
    for (const required of ['주문 운영', '지금 먼저 확인할 업무', '보류 확인', '환불 검토 대기', '결정 메모']) {
      if (!body.includes(required)) throw new Error(`${viewport.name}: missing copy ${required}`);
    }
    if (viewport.name === 'mobile') await page.locator('.mobile-nav').waitFor({ state: 'visible', timeout: 10_000 });
    await assertNoHorizontalOverflow(page, `commerce/${viewport.name}`);
    await page.screenshot({ path: `${output}/commerce-${viewport.name}.png`, fullPage: true });
    if (errors.length) throw new Error(`${viewport.name}: ${errors.join(' | ')}`);
    console.log(`PASS commerce render ${viewport.width}x${viewport.height}`);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
  }
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  const errors = [];
  collectRuntimeErrors(page, errors);
  try {
    await gotoWithRetry(page);

    await page.locator('#search').fill('Beta Studio');
    await page.locator('#visible-order-count').filter({ hasText: '1건' }).waitFor({ timeout: 10_000 });
    await page.locator('[data-order-id="2"]').waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator('#reset-filters').click();
    await page.locator('#visible-order-count').filter({ hasText: '4건' }).waitFor({ timeout: 10_000 });

    await page.locator('[data-quick-filter="hold"]').click();
    await page.locator('#visible-order-count').filter({ hasText: '1건' }).waitFor({ timeout: 10_000 });
    await page.locator('[data-order-id="2"]').waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator('#reset-filters').click();

    await page.locator('[data-order-id="1"]').click();
    await page.locator('[data-action="START_PICKING"][data-order-id="1"]').click();
    await page.locator('#fulfillment-status').filter({ hasText: '상품 준비 중' }).waitFor({ timeout: 10_000 });
    if ((await page.locator('#order-version').innerText()).trim() !== 'v2') throw new Error('order version did not advance to v2 after picking');

    await page.locator('#tracking').fill('QA-260909-001');
    await page.locator('[data-action="SHIP"][data-order-id="1"]').click();
    await page.locator('#fulfillment-status').filter({ hasText: '배송 중' }).waitFor({ timeout: 10_000 });
    await page.locator('[data-action="DELIVER"][data-order-id="1"]').click();
    await page.locator('#fulfillment-status').filter({ hasText: '배송 완료' }).waitFor({ timeout: 10_000 });
    if ((await page.locator('#order-version').innerText()).trim() !== 'v4') throw new Error('order version did not advance to v4 after fulfillment flow');

    const refundCard = page.locator('.refund-card[data-refund-id="1"]');
    await refundCard.waitFor({ state: 'visible', timeout: 10_000 });
    if (!(await refundCard.locator('.decision-note').isDisabled())) throw new Error('STAFF decision note must be disabled for sensitive refund');
    if (!(await refundCard.locator('[data-decision="APPROVE"]').isDisabled())) throw new Error('STAFF approve must be disabled for sensitive refund');

    await page.locator('#role').selectOption('ADMIN');
    const adminCard = page.locator('.refund-card[data-refund-id="1"]');
    await adminCard.locator('.decision-note').fill('파손 증빙 및 결제 내역 확인 완료');
    await adminCard.locator('[data-decision="APPROVE"]').click();
    await page.locator('#status-message').filter({ hasText: '환불을 승인했습니다.' }).waitFor({ timeout: 10_000 });
    await page.locator('#refund-list').filter({ hasText: '대기 중인 환불 검토가 없습니다.' }).waitFor({ timeout: 10_000 });
    if ((await page.locator('#m-refund').innerText()).trim() !== '0') throw new Error('pending refund metric did not drop to zero');

    await page.locator('#search').fill('ORD-260904');
    await page.locator('[data-order-id="4"]').click();
    await page.locator('#payment-status').filter({ hasText: '부분 환불' }).waitFor({ timeout: 10_000 });
    const auditText = await page.locator('#audit-list').innerText();
    if (!auditText.includes('환불 승인') || !auditText.includes('demo-admin')) throw new Error('refund approval audit entry missing');

    await assertNoHorizontalOverflow(page, 'commerce/interaction');
    await page.screenshot({ path: `${output}/commerce-interaction-final.png`, fullPage: true });
    if (errors.length) throw new Error(`interaction: ${errors.join(' | ')}`);
    console.log('PASS commerce search/filter -> fulfillment -> ADMIN refund approval -> audit');
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
  }
}

await browser.close();
if (failures.length) {
  console.error('\nCOMMERCE LIVE QA FAILURES');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('\nCOMMERCE LIVE PAGES QA: PASS');
