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

async function assertFrame(frameLocator, required, label) {
  const body = frameLocator.locator('body');
  await body.waitFor({ state:'visible', timeout:20_000 });
  const text = await body.innerText();
  for (const phrase of required) if (!text.includes(phrase)) throw new Error(`${label}: embedded live screen missing ${phrase}`);
}

async function verifyReviewExperience(page, label) {
  const section = page.locator('[data-portfolio-experience="true"]');
  await section.waitFor({ state:'visible', timeout:15_000 });
  const tabs = section.locator('.portfolio-experience-tab');
  if (await tabs.count() !== 3) throw new Error(`${label}: expected three review modes`);

  const hiring = section.locator('[data-mode="hiring"]');
  const project = section.locator('[data-mode="project"]');
  const technical = section.locator('[data-mode="technical"]');
  if (await hiring.getAttribute('aria-selected') !== 'true') throw new Error(`${label}: hiring review should be the default mode`);

  await project.click();
  if (await project.getAttribute('aria-selected') !== 'true') throw new Error(`${label}: project review selection failed`);
  const projectText = await section.innerText();
  for (const phrase of ['PROJECT REVIEW · PROBLEM FIRST', 'Booking CRM', '프로젝트 의뢰서']) {
    if (!projectText.includes(phrase)) throw new Error(`${label}: project mode missing ${phrase}`);
  }

  await project.press('ArrowRight');
  if (await technical.getAttribute('aria-selected') !== 'true') throw new Error(`${label}: keyboard tab navigation failed`);
  const technicalText = await section.innerText();
  for (const phrase of ['TECHNICAL REVIEW · EVIDENCE FIRST', 'Engineering Evidence', 'GitHub Repository']) {
    if (!technicalText.includes(phrase)) throw new Error(`${label}: technical mode missing ${phrase}`);
  }

  await page.reload({ waitUntil:'networkidle' });
  const restored = page.locator('[data-portfolio-experience="true"]');
  await restored.waitFor({ state:'visible', timeout:15_000 });
  if (await restored.locator('[data-mode="technical"]').getAttribute('aria-selected') !== 'true') {
    throw new Error(`${label}: session review mode was not restored after reload`);
  }
}

async function verifyQualitySections(page, label) {
  await page.locator('html[data-quality-suite="ready"]').waitFor({ state:'attached', timeout:15_000 });
  await page.locator('html[data-seo-layer="ready"]').waitFor({ state:'attached', timeout:15_000 });

  const recruiter = page.locator('#recruiter-path');
  const proof = page.locator('#proof-center');
  const cases = page.locator('#case-studies');
  await recruiter.waitFor({ state:'visible', timeout:15_000 });
  await proof.waitFor({ state:'attached', timeout:15_000 });
  await cases.waitFor({ state:'attached', timeout:15_000 });

  if (await recruiter.locator('.recruiter-path-card').count() !== 3) throw new Error(`${label}: recruiter path must have 3 steps`);
  if (await proof.locator('.proof-product').count() !== 5) throw new Error(`${label}: proof center must have 5 products`);
  for (let i=0; i<5; i+=1) {
    const linkCount = await proof.locator('.proof-product').nth(i).locator('.proof-chain a').count();
    if (linkCount !== 5) throw new Error(`${label}: proof product ${i} must expose five evidence stages, got ${linkCount}`);
  }
  if (await cases.locator('.case-study-card').count() !== 3) throw new Error(`${label}: expected three engineering case studies`);
  const caseText = await cases.innerText();
  for (const phrase of ['PROBLEM','DESIGN DECISION','HARD EDGE','IMPLEMENTATION','VERIFICATION']) {
    if (!caseText.includes(phrase)) throw new Error(`${label}: case study missing ${phrase}`);
  }
}

async function verifySeo(page, label) {
  const result = await page.evaluate(() => {
    const json = document.getElementById('kzone87-structured-data')?.textContent || '';
    const parsed = JSON.parse(json);
    return {
      types: parsed['@graph'].map(item => item['@type']),
      canonical: document.querySelector('link[rel="canonical"]')?.href || '',
      robots: document.querySelector('meta[name="robots"]')?.content || '',
      ogSiteName: document.querySelector('meta[property="og:site_name"]')?.content || '',
      ogLocale: document.querySelector('meta[property="og:locale"]')?.content || '',
      twitterCard: document.querySelector('meta[name="twitter:card"]')?.content || '',
      relMe: document.querySelector('link[rel="me"]')?.href || ''
    };
  });
  for (const type of ['WebSite','ProfilePage','Person']) if (!result.types.includes(type)) throw new Error(`${label}: structured data missing ${type}`);
  if (result.canonical !== 'https://kzone87.github.io/portfolio/') throw new Error(`${label}: canonical mismatch ${result.canonical}`);
  if (!result.robots.includes('index,follow')) throw new Error(`${label}: robots meta missing index/follow`);
  if (result.ogSiteName !== 'Kzone87 Portfolio' || result.ogLocale !== 'ko_KR') throw new Error(`${label}: OG metadata incomplete`);
  if (result.twitterCard !== 'summary') throw new Error(`${label}: twitter card missing`);
  if (result.relMe !== 'https://github.com/Kzone87') throw new Error(`${label}: rel=me identity link mismatch`);
}

async function verifyAccessibilityGate(page, viewport, label) {
  const expectedOffset = viewport.width <= 760 ? '76px' : '92px';
  const offsets = await page.evaluate(() => ({
    scrollPaddingTop: getComputedStyle(document.documentElement).scrollPaddingTop,
    proofMargin: getComputedStyle(document.getElementById('proof-center')).scrollMarginTop
  }));
  if (offsets.scrollPaddingTop !== expectedOffset || offsets.proofMargin !== expectedOffset) {
    throw new Error(`${label}: fixed-header focus/anchor offset mismatch ${JSON.stringify(offsets)}`);
  }

  const representative = [
    '.studio-header nav a',
    '.portfolio-experience-tab',
    '.recruiter-path-card',
    '.proof-chain a',
    '.case-study-card>a'
  ];
  for (const selector of representative) {
    const target = page.locator(selector).first();
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error(`${label}: no box for ${selector}`);
    if (box.width < 24 || box.height < 24) throw new Error(`${label}: target below WCAG 2.2 minimum ${selector} ${box.width}x${box.height}`);
  }

  const focusTarget = page.locator('.portfolio-experience-tab').first();
  await focusTarget.scrollIntoViewIfNeeded();
  await focusTarget.focus();
  const focus = await focusTarget.evaluate((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const header = document.querySelector('.site-header')?.getBoundingClientRect();
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth),
      top: rect.top,
      bottom: rect.bottom,
      headerBottom: header?.bottom || 0,
      viewportHeight: innerHeight
    };
  });
  if (focus.outlineStyle === 'none' || focus.outlineWidth < 3) throw new Error(`${label}: focus indicator is not sufficiently visible ${JSON.stringify(focus)}`);
  if (focus.top < focus.headerBottom - 1 || focus.bottom > focus.viewportHeight + 1) throw new Error(`${label}: focused control obscured ${JSON.stringify(focus)}`);
}

async function verifyPerformanceGate(page, viewport, previewRequests, label) {
  const frames = page.locator('iframe[data-src]');
  await page.waitForTimeout(250);
  const count = await frames.count();
  if (count !== 4) throw new Error(`${label}: expected four deferred live previews, got ${count}`);
  const eagerLoaded = await page.locator('iframe[data-preview-loaded="true"]').count();
  if (eagerLoaded !== 0) throw new Error(`${label}: ${eagerLoaded} live previews loaded before user approached them`);
  if (previewRequests.length !== 0) throw new Error(`${label}: live preview network request started eagerly: ${previewRequests.join(' | ')}`);

  const previews = [
    ['.nexa-live-preview', ['NEXA TECH SERVICE'], 'NEXA'],
    ['.booking-portfolio-preview', ['BOOKING CRM','고객 예약·문의'], 'BOOKING'],
    ['.mono-live-preview', ['MONO OPERATIONS','통합 업무함'], 'MONO'],
    ['.excel-live-preview', ['Excel 정리 작업실','한 파일 정리'], 'Excel']
  ];

  if (viewport.width <= 760) {
    for (const [selector] of previews) {
      const display = await page.locator(selector).evaluate(el => getComputedStyle(el).display);
      if (display !== 'none') throw new Error(`${label}: ${selector} should use compact mobile fallback`);
    }
    if (await page.locator('iframe[data-preview-loaded="true"]').count() !== 0) throw new Error(`${label}: mobile must not load preview iframes`);
    return;
  }

  for (const [selector, required, name] of previews) {
    const preview = page.locator(selector);
    await preview.scrollIntoViewIfNeeded();
    const iframe = preview.locator('iframe');
    await iframe.waitFor({ state:'attached', timeout:10_000 });
    await page.waitForFunction((el) => el.getAttribute('src') && el.dataset.previewLoaded === 'true', await iframe.elementHandle(), { timeout:15_000 });
    await assertFrame(page.frameLocator(`${selector} iframe`), required, `${label}/${name}`);
  }
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport:{ width:viewport.width, height:viewport.height }, locale:'ko-KR', timezoneId:'Asia/Seoul', acceptDownloads:true });
  const page = await context.newPage();
  const errors = [];
  const previewRequests = [];
  captureErrors(page, errors);
  page.on('request', request => {
    const url = request.url();
    const isPreview = url.includes('/portfolio/nexa-tech-service/') || url.includes('/portfolio/booking-crm/') || url.includes('/portfolio/mono-operations/') || url.includes('kzone87.github.io/customer-map-planner/');
    if (isPreview && request.resourceType() === 'document') previewRequests.push(url);
  });
  try {
    await goto(page, `${base}/`);
    await page.locator('#delivery').waitFor({ state:'attached', timeout:15_000 });
    await page.locator('.booking-portfolio-showcase').waitFor({ state:'visible', timeout:15_000 });
    await page.locator('.mono-portfolio-featured').waitFor({ state:'visible', timeout:15_000 });
    await page.locator('[data-portfolio-experience="true"]').waitFor({ state:'visible', timeout:15_000 });
    await verifyQualitySections(page, `portfolio/${viewport.name}/quality`);
    await verifySeo(page, `portfolio/${viewport.name}/seo`);
    await verifyPerformanceGate(page, viewport, previewRequests, `portfolio/${viewport.name}/performance`);

    const bodyText = await page.locator('body').innerText();
    for (const phrase of [
      '05', 'PRODUCT LINES', 'NEXA SERVICE SUITE', 'BOOKING CRM', 'MONO OPERATIONS', 'Excel Workbench', 'OPS KIT',
      '실제 납품은 화면에서 끝나지 않습니다.', '프로젝트 의뢰서 →', 'OPS KIT 실제 도구 열기 →',
      '무엇을 확인하러 오셨나요?', '채용 검토', '프로젝트 의뢰', '기술 검토',
      'RECRUITER · 90 SECOND REVIEW', 'PROOF CENTER · FIVE-STEP TRACE', 'ENGINEERING CASE STUDIES'
    ]) if (!bodyText.includes(phrase)) throw new Error(`portfolio/${viewport.name}: missing ${phrase}`);

    const count = (await page.locator('.studio-meta .live-mark strong').innerText()).trim();
    if (count !== '05') throw new Error(`portfolio/${viewport.name}: product line count must be 05, got ${count}`);

    const stack = await page.locator('.studio-stack').innerText();
    if (stack.includes('Spring') || !stack.includes('SQLite/SQL')) throw new Error(`portfolio/${viewport.name}: public stack is not evidence-aligned: ${stack}`);

    await verifyReviewExperience(page, `portfolio/${viewport.name}/review-experience`);
    await verifyAccessibilityGate(page, viewport, `portfolio/${viewport.name}/accessibility`);

    const deliveryLink = page.locator('.studio-header nav a[href="#delivery"]');
    if (await deliveryLink.count() !== 1) throw new Error(`portfolio/${viewport.name}: delivery nav missing`);
    await deliveryLink.click();
    if (!page.url().endsWith('#delivery')) throw new Error(`portfolio/${viewport.name}: delivery nav failed`);

    await noOverflow(page, `portfolio/${viewport.name}`);
    await page.screenshot({ path:`${output}/portfolio-client-${viewport.name}.png`, fullPage:true });
    if (errors.length) throw new Error(`portfolio/${viewport.name}: ${errors.join(' | ')}`);
    console.log(`PASS client portfolio ${viewport.width}x${viewport.height} + performance/proof/recruiter/accessibility/SEO/case-study gates`);
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
