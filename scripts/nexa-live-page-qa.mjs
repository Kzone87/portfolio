import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const root = 'https://kzone87.github.io/portfolio';
const output = 'live-qa-artifacts';
const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('CHROME_PATH is required');
await mkdir(output, { recursive: true });

const surfaces = [
  { key: 'portfolio', url: `${root}/`, required: ['요구사항', '범위·견적', '개발·검수', '배포·인수인계'], selector: 'a[href*="project-inquiry"]' },
  { key: 'tech-service', url: `${root}/nexa-tech-service/`, required: ['NEXA TECH SERVICE', '정기점검', '현장지원'], selector: 'a[href="./contact.html"]' },
  { key: 'customer-service', url: `${root}/nexa-service-domain/`, required: ['서비스 요청 조회', '접수번호', '일회용 인증', '접수번호만으로 상세정보를 열지 않습니다.'], selector: '#lookup-form' },
  { key: 'service-operations', url: `${root}/field-service-ops/`, required: ['NEXA SERVICE OPERATIONS', '배차'], selector: '#dispatch-workspace' }
];
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 }
];

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
const failures = [];

async function gotoWithRetry(page, url) {
  let last;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      if (!response || response.status() >= 400) throw new Error(`HTTP ${response?.status() ?? 'no-response'} ${url}`);
      return response;
    } catch (error) {
      last = error;
      await page.waitForTimeout(attempt * 1500);
    }
  }
  throw last;
}

function captureRuntimeErrors(page, runtimeErrors) {
  page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('response', response => {
    if (response.status() >= 400) runtimeErrors.push(`http ${response.status()}: ${response.url()}`);
  });
  page.on('requestfailed', request => runtimeErrors.push(`requestfailed: ${request.url()} · ${request.failure()?.errorText || 'unknown error'}`));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const location = message.location();
    const suffix = location?.url ? ` @ ${location.url}:${location.lineNumber ?? 0}:${location.columnNumber ?? 0}` : '';
    runtimeErrors.push(`console: ${message.text()}${suffix}`);
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body?.scrollWidth || 0
  }));
  if (sizes.scrollWidth > sizes.clientWidth + 2 || sizes.bodyScrollWidth > sizes.clientWidth + 2) {
    throw new Error(`${label}: horizontal overflow ${JSON.stringify(sizes)}`);
  }
}

for (const surface of surfaces) {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    const page = await context.newPage();
    const runtimeErrors = [];
    captureRuntimeErrors(page, runtimeErrors);
    try {
      await gotoWithRetry(page, surface.url);
      await page.locator(surface.selector).first().waitFor({ state: 'attached', timeout: 15_000 });
      if (surface.key === 'customer-service') {
        await page.locator('.portal-journey').waitFor({ state: 'visible', timeout: 15_000 });
        await page.locator('.portal-assurance').waitFor({ state: 'visible', timeout: 15_000 });
      }
      const text = await page.locator('body').innerText();
      for (const required of surface.required) if (!text.includes(required)) throw new Error(`${surface.key}/${viewport.name}: missing copy ${required}`);
      await assertNoHorizontalOverflow(page, `${surface.key}/${viewport.name}`);
      await page.screenshot({ path: `${output}/${surface.key}-${viewport.name}.png`, fullPage: true });
      if (runtimeErrors.length) throw new Error(`${surface.key}/${viewport.name}: ${runtimeErrors.join(' | ')}`);
      console.log(`PASS render ${surface.key} ${viewport.width}x${viewport.height}`);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    } finally {
      await context.close();
    }
  }
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  const runtimeErrors = [];
  captureRuntimeErrors(page, runtimeErrors);
  try {
    await gotoWithRetry(page, `${root}/nexa-service-domain/`);
    await page.locator('#secure-send').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#request-id').fill('NX-260907-0142');
    await page.locator('#secure-send').click();
    await page.locator('#lookup-message').filter({ hasText: '246810' }).waitFor({ timeout: 10_000 });
    await page.locator('#secure-code').fill('246810');
    await page.locator('#secure-verify').click();
    await page.locator('#request-view').waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator('.secure-history').waitFor({ state: 'attached', timeout: 10_000 });
    const text = await page.locator('body').innerText();
    if (!text.includes('작업 보고서')) throw new Error('customer demo: work report missing after OTP verification');
    await assertNoHorizontalOverflow(page, 'customer-service/otp-verified');
    await page.screenshot({ path: `${output}/customer-service-otp-verified.png`, fullPage: true });
    if (runtimeErrors.length) throw new Error(`customer interaction: ${runtimeErrors.join(' | ')}`);
    console.log('PASS interaction customer OTP -> request -> report');
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
  }
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  const runtimeErrors = [];
  captureRuntimeErrors(page, runtimeErrors);
  try {
    await gotoWithRetry(page, `${root}/field-service-ops/`);
    await page.locator('.commercial-workspace-toolbar').waitFor({ state: 'visible', timeout: 20_000 });
    for (const [view, copy] of [['week','주간 기사 일정'], ['map','현장 주소·지도'], ['field','기사 현장']]) {
      await page.locator(`button[data-view="${view}"]`).click();
      await page.getByText(copy, { exact: false }).first().waitFor({ state: 'visible', timeout: 10_000 });
      await assertNoHorizontalOverflow(page, `operations/${view}`);
      await page.screenshot({ path: `${output}/operations-${view}.png`, fullPage: true });
    }
    if (runtimeErrors.length) throw new Error(`operations interaction: ${runtimeErrors.join(' | ')}`);
    console.log('PASS interaction operations day/week/map/field');
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
  }
}

await browser.close();
if (failures.length) {
  console.error('\nLIVE QA FAILURES');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('\nNEXA LIVE PAGES QA: PASS');
