import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = String(process.env.CLIENT_READY_BASE || 'https://kzone87.github.io/portfolio').replace(/\/$/, '');
const chromePath = process.env.CHROME_PATH;
const output = 'portfolio-client-ready-live-qa-artifacts';
if (!chromePath) throw new Error('CHROME_PATH is required');
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
const failures = [];
const viewports = [
  { name:'desktop', width:1440, height:1000 },
  { name:'tablet', width:768, height:1024 },
  { name:'mobile', width:390, height:844 }
];

function captureErrors(page, errors) {
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', request => errors.push(`requestfailed: ${request.url()} · ${request.failure()?.errorText || 'unknown'}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`); });
  page.on('console', message => {
    if (message.type() === 'error') {
      const loc = message.location();
      errors.push(`console: ${message.text()}${loc?.url ? ` @ ${loc.url}:${loc.lineNumber ?? 0}` : ''}`);
    }
  });
}

async function goto(page, url) {
  let last;
  for (let attempt=1; attempt<=8; attempt+=1) {
    try {
      const response = await page.goto(url, { waitUntil:'networkidle', timeout:30_000 });
      if (!response || response.status() >= 400) throw new Error(`HTTP ${response?.status() ?? 'none'} ${url}`);
      return;
    } catch (error) {
      last = error;
      await page.waitForTimeout(attempt * 800);
    }
  }
  throw last;
}

async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    doc: document.documentElement.scrollWidth,
    body: document.body?.scrollWidth || 0
  }));
  if (size.doc > size.client + 2 || size.body > size.client + 2) throw new Error(`${label}: horizontal overflow ${JSON.stringify(size)}`);
}

async function reveal(page) {
  const items = page.locator('[data-reveal]');
  for (let i=0; i<await items.count(); i+=1) {
    await items.nth(i).scrollIntoViewIfNeeded();
    await page.waitForTimeout(35);
  }
}

async function assertFrame(frameLocator, required, label) {
  const body = frameLocator.locator('body');
  await body.waitFor({ state:'visible', timeout:20_000 });
  const text = await body.innerText();
  for (const phrase of required) if (!text.includes(phrase)) throw new Error(`${label}: embedded live screen missing ${phrase}`);
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport:{ width:viewport.width, height:viewport.height }, locale:'ko-KR', timezoneId:'Asia/Seoul', acceptDownloads:true });
  const page = await context.newPage();
  const errors = [];
  captureErrors(page, errors);
  try {
    await goto(page, `${base}/`);
    await page.locator('#delivery').waitFor({ state:'attached', timeout:15_000 });
    await page.locator('.booking-portfolio-showcase').waitFor({ state:'visible', timeout:15_000 });
    await page.locator('.mono-portfolio-featured').waitFor({ state:'visible', timeout:15_000 });
    await reveal(page);
    const bodyText = await page.locator('body').innerText();
    for (const phrase of [
      '05', 'PRODUCT LINES', 'NEXA SERVICE SUITE', 'BOOKING CRM', 'MONO OPERATIONS', 'Excel Workbench', 'OPS KIT',
      '실제 납품은 화면에서 끝나지 않습니다.', '프로젝트 의뢰서 →', 'OPS KIT 실제 도구 열기 →'
    ]) if (!bodyText.includes(phrase)) throw new Error(`portfolio/${viewport.name}: missing ${phrase}`);

    const count = (await page.locator('.studio-meta .live-mark strong').innerText()).trim();
    if (count !== '05') throw new Error(`portfolio/${viewport.name}: product line count must be 05, got ${count}`);

    const stack = await page.locator('.studio-stack').innerText();
    if (stack.includes('Spring') || !stack.includes('SQLite/SQL')) throw new Error(`portfolio/${viewport.name}: public stack is not evidence-aligned: ${stack}`);

    const deliveryLink = page.locator('.studio-header nav a[href="#delivery"]');
    if (await deliveryLink.count() !== 1) throw new Error(`portfolio/${viewport.name}: delivery nav missing`);
    await deliveryLink.click();
    if (!page.url().endsWith('#delivery')) throw new Error(`portfolio/${viewport.name}: delivery nav failed`);

    if (viewport.width > 760) {
      await assertFrame(page.frameLocator('.nexa-live-preview iframe'), ['NEXA TECH SERVICE'], `portfolio/${viewport.name}/NEXA`);
      await assertFrame(page.frameLocator('.booking-portfolio-preview iframe'), ['BOOKING CRM','고객 예약·문의'], `portfolio/${viewport.name}/BOOKING`);
      await assertFrame(page.frameLocator('.mono-live-preview iframe'), ['MONO OPERATIONS','통합 업무함'], `portfolio/${viewport.name}/MONO`);
      await assertFrame(page.frameLocator('.excel-live-preview iframe'), ['Excel 정리 작업실','한 파일 정리'], `portfolio/${viewport.name}/Excel`);
    } else {
      for (const selector of ['.nexa-live-preview','.booking-portfolio-preview','.mono-live-preview','.excel-live-preview']) {
        const display = await page.locator(selector).evaluate(el => getComputedStyle(el).display);
        if (display !== 'none') throw new Error(`portfolio/mobile: ${selector} should use compact no-iframe fallback`);
      }
    }

    await noOverflow(page, `portfolio/${viewport.name}`);
    await page.screenshot({ path:`${output}/portfolio-client-${viewport.name}.png`, fullPage:true });
    if (errors.length) throw new Error(`portfolio/${viewport.name}: ${errors.join(' | ')}`);
    console.log(`PASS client portfolio ${viewport.width}x${viewport.height} + five live product lines`);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
  }
}

{
  const context = await browser.newContext({ viewport:{ width:1440, height:1000 }, locale:'ko-KR', timezoneId:'Asia/Seoul', acceptDownloads:true });
  const page = await context.newPage();
  const errors = [];
  captureErrors(page, errors);
  try {
    await goto(page, `${base}/project-inquiry/`);
    const mode = await page.locator('.inquiry-mode').innerText();
    if (!mode.includes('PUBLIC MODE') || !mode.includes('서버로 전송하지 않습니다')) throw new Error('project inquiry public boundary is unclear');
    if (!(await page.locator('#copy-project-inquiry').isDisabled()) || !(await page.locator('#download-project-inquiry').isDisabled())) throw new Error('portable actions must stay disabled before valid summary');

    await page.locator('#project-inquiry-form button[type="submit"]').click();
    if (!(await page.locator('#project-inquiry-message').innerText()).includes('필수 항목과 동의 여부')) throw new Error('project inquiry invalid-submit validation failed');

    await page.locator('input[name="company"]').fill('KZONE QA');
    await page.locator('input[name="name"]').fill('테스트 담당자');
    await page.locator('input[name="email"]').fill('qa@example.com');
    await page.locator('select[name="projectType"]').selectOption({ label:'업무 운영 시스템' });
    await page.locator('textarea[name="detail"]').fill('고객 요청 접수부터 담당자 배정, 처리, 완료까지 하나의 업무 흐름으로 관리하고 싶습니다.');
    await page.locator('input[name="consent"]').check();
    await page.locator('#project-inquiry-form button[type="submit"]').click();
    await page.locator('#project-inquiry-summary').waitFor({ state:'visible', timeout:10_000 });
    const summary = await page.locator('#project-inquiry-summary').innerText();
    if (!summary.includes('KZONE QA') || !summary.includes('업무 운영 시스템')) throw new Error('project inquiry summary did not preserve entered scope');
    const status = await page.locator('#project-inquiry-message').innerText();
    if (!status.includes('서버로 전송하지 않습니다')) throw new Error('project inquiry public no-send boundary missing after submit');
    if (await page.locator('#copy-project-inquiry').isDisabled() || await page.locator('#download-project-inquiry').isDisabled()) throw new Error('portable actions did not enable after summary');

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download-project-inquiry').click();
    const download = await downloadPromise;
    if (download.suggestedFilename() !== 'KZONE87-project-inquiry.txt') throw new Error(`unexpected inquiry filename ${download.suggestedFilename()}`);
    await noOverflow(page, 'project-inquiry/client-ready');
    await page.screenshot({ path:`${output}/project-inquiry-portable-draft.png`, fullPage:true });
    if (errors.length) throw new Error(`project-inquiry/client-ready: ${errors.join(' | ')}`);
    console.log('PASS project inquiry validation -> summary -> portable TXT download -> public no-send boundary');
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
  }
}

await browser.close();
if (failures.length) {
  console.error('\nCLIENT READY LIVE QA FAILURES');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('\nPORTFOLIO CLIENT READY LIVE QA: PASS');
