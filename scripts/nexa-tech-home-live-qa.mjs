import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const root = 'https://kzone87.github.io/portfolio';
const output = 'live-qa-artifacts';
const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('CHROME_PATH is required');
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
const failures = [];

async function goto(page, url) {
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

function collectErrors(page, errors) {
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`);
  });
  page.on('requestfailed', request => errors.push(`requestfailed: ${request.url()} · ${request.failure()?.errorText || 'unknown error'}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
}

async function assertNoOverflow(page, label) {
  const result = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    body: document.body?.scrollWidth || 0
  }));
  if (result.scroll > result.client + 2 || result.body > result.client + 2) throw new Error(`${label}: horizontal overflow ${JSON.stringify(result)}`);
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    javaScriptEnabled: false,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul'
  });
  const page = await context.newPage();
  const errors = [];
  collectErrors(page, errors);
  try {
    await goto(page, `${root}/nexa-tech-service/`);
    await page.locator('nav a[data-service-status]').waitFor({ state: 'attached', timeout: 10_000 });
    await page.locator('noscript a[data-service-status]').waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator('main .hero-actions a[data-service-status]').waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator('[data-commercial-scope-static]').waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator('.console-consult-link').waitFor({ state: 'visible', timeout: 10_000 });
    const text = await page.locator('body').innerText();
    for (const required of ['진행 조회','접수 진행 확인','이용·계약 기준','계약 전 확인']) {
      if (!text.includes(required)) throw new Error(`no-js/${viewport.name}: missing ${required}`);
    }
    await assertNoOverflow(page, `tech-home/no-js/${viewport.name}`);
    await page.screenshot({ path: `${output}/tech-home-no-js-${viewport.name}.png`, fullPage: true });
    if (errors.length) throw new Error(`no-js/${viewport.name}: ${errors.join(' | ')}`);
    console.log(`PASS NEXA TECH home no-JS ${viewport.width}x${viewport.height}`);
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
  collectErrors(page, errors);
  try {
    await goto(page, `${root}/nexa-tech-service/`);
    await page.locator('.console-consult-link').click();
    await page.waitForURL(/\/nexa-tech-service\/contact\.html(?:$|[?#])/, { timeout: 10_000 });
    await page.goBack({ waitUntil: 'networkidle' });

    const faq = page.locator('.faq-button').first();
    await faq.click();
    if (await faq.getAttribute('aria-expanded') !== 'true') throw new Error('home FAQ did not expose expanded state');
    const controlled = await faq.getAttribute('aria-controls');
    if (!controlled) throw new Error('home FAQ aria-controls missing');
    if (await page.locator(`#${controlled}`).getAttribute('aria-hidden') !== 'false') throw new Error('home FAQ answer did not expose visible state');

    const statusLink = page.locator('nav a[data-service-status]').first();
    await statusLink.click();
    await page.waitForURL(/\/nexa-service-domain\/(?:$|[?#])/, { timeout: 10_000 });
    await page.screenshot({ path: `${output}/tech-home-customer-journey.png`, fullPage: true });
    if (errors.length) throw new Error(`home interaction: ${errors.join(' | ')}`);
    console.log('PASS NEXA TECH home consultation/FAQ/status interactions');
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
  }
}

await browser.close();
if (failures.length) {
  console.error('\nNEXA TECH HOME LIVE QA FAILURES');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('\nNEXA TECH HOME LIVE QA: PASS');
