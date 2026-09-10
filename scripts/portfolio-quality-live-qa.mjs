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
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 }
];

function attachGuards(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', request => errors.push(`requestfailed: ${request.url()} · ${request.failure()?.errorText || 'unknown'}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`); });
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  return errors;
}

async function goto(page, url) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      if (!response || response.status() >= 400) throw new Error(`HTTP ${response?.status() ?? 'none'} ${url}`);
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(attempt * 500);
    }
  }
  throw lastError;
}

async function waitForFrameText(frameLocator, phrases, label) {
  const body = frameLocator.locator('body');
  await body.waitFor({ state: 'attached', timeout: 20_000 });
  const deadline = Date.now() + 20_000;
  let lastText = '';
  while (Date.now() < deadline) {
    try { lastText = await body.innerText({ timeout: 2_000 }); } catch { lastText = ''; }
    if (phrases.every(phrase => lastText.includes(phrase))) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`${label}: iframe content did not become ready; expected ${phrases.join(' + ')}, got ${lastText.slice(0, 180)}`);
}

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body?.scrollWidth || 0
  }));
  if (dimensions.document > dimensions.viewport + 2 || dimensions.body > dimensions.viewport + 2) {
    throw new Error(`${label}: horizontal overflow ${JSON.stringify(dimensions)}`);
  }
}

async function verifySeo(page, label) {
  const data = await page.evaluate(() => {
    const node = document.getElementById('kzone87-structured-data');
    const graph = node ? JSON.parse(node.textContent || '{}')['@graph'] || [] : [];
    return {
      types: graph.map(item => item['@type']),
      canonical: document.querySelector('link[rel="canonical"]')?.href || '',
      robots: document.querySelector('meta[name="robots"]')?.content || '',
      ogSiteName: document.querySelector('meta[property="og:site_name"]')?.content || '',
      ogLocale: document.querySelector('meta[property="og:locale"]')?.content || '',
      twitterCard: document.querySelector('meta[name="twitter:card"]')?.content || '',
      relMe: document.querySelector('link[rel="me"]')?.href || ''
    };
  });
  for (const type of ['WebSite', 'ProfilePage', 'Person']) if (!data.types.includes(type)) throw new Error(`${label}: missing JSON-LD ${type}`);
  if (data.canonical !== 'https://kzone87.github.io/portfolio/') throw new Error(`${label}: canonical mismatch ${data.canonical}`);
  if (!data.robots.includes('index,follow')) throw new Error(`${label}: robots meta mismatch`);
  if (data.ogSiteName !== 'Kzone87 Portfolio' || data.ogLocale !== 'ko_KR') throw new Error(`${label}: Open Graph metadata mismatch`);
  if (data.twitterCard !== 'summary') throw new Error(`${label}: twitter card mismatch`);
  if (data.relMe !== 'https://github.com/Kzone87') throw new Error(`${label}: rel=me mismatch`);
}

async function verifyReviewMode(page, label) {
  const section = page.locator('[data-portfolio-experience="true"]');
  await section.waitFor({ state: 'visible', timeout: 15_000 });
  const tabs = section.locator('.portfolio-experience-tab');
  if (await tabs.count() !== 3) throw new Error(`${label}: review mode count mismatch`);
  const project = section.locator('[data-mode="project"]');
  const technical = section.locator('[data-mode="technical"]');
  await project.click();
  if (await project.getAttribute('aria-selected') !== 'true') throw new Error(`${label}: project mode did not select`);
  await project.press('ArrowRight');
  if (await technical.getAttribute('aria-selected') !== 'true') throw new Error(`${label}: keyboard mode navigation failed`);
}

async function verifyQualitySections(page, label) {
  await page.locator('html[data-quality-suite="ready"][data-seo-layer="ready"]').waitFor({ state: 'attached', timeout: 15_000 });
  const recruiter = page.locator('#recruiter-path');
  const proof = page.locator('#proof-center');
  const cases = page.locator('#case-studies');
  if (await recruiter.locator('.recruiter-path-card').count() !== 3) throw new Error(`${label}: recruiter path must contain 3 steps`);
  if (await proof.locator('.proof-product').count() !== 5) throw new Error(`${label}: proof center must contain 5 products`);
  for (let i = 0; i < 5; i += 1) {
    if (await proof.locator('.proof-product').nth(i).locator('.proof-chain a').count() !== 5) throw new Error(`${label}: proof chain ${i} is not five-stage`);
  }
  if (await cases.locator('.case-study-card').count() !== 3) throw new Error(`${label}: case study count mismatch`);
  const text = await cases.innerText();
  for (const phrase of ['PROBLEM', 'DESIGN DECISION', 'HARD EDGE', 'IMPLEMENTATION', 'VERIFICATION']) {
    if (!text.includes(phrase)) throw new Error(`${label}: case studies missing ${phrase}`);
  }
}

async function verifyAccessibility(page, viewport, label) {
  const expectedOffset = viewport.width <= 760 ? '76px' : '92px';
  const offsets = await page.evaluate(() => ({
    padding: getComputedStyle(document.documentElement).scrollPaddingTop,
    margin: getComputedStyle(document.getElementById('proof-center')).scrollMarginTop
  }));
  if (offsets.padding !== expectedOffset || offsets.margin !== expectedOffset) throw new Error(`${label}: focus/anchor offset mismatch ${JSON.stringify(offsets)}`);

  for (const selector of ['.studio-header nav a', '.portfolio-experience-tab', '.recruiter-path-card', '.proof-chain a', '.case-study-card>a']) {
    const target = page.locator(selector).first();
    await target.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
    const box = await target.boundingBox();
    if (!box || box.width < 24 || box.height < 24) throw new Error(`${label}: target below 24x24 minimum ${selector} ${box ? `${box.width}x${box.height}` : 'no-box'}`);
  }

  const focusTarget = page.locator('.portfolio-experience-tab').first();
  await focusTarget.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await focusTarget.focus();
  const focus = await focusTarget.evaluate(el => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const header = document.querySelector('.site-header')?.getBoundingClientRect();
    return { outline: parseFloat(style.outlineWidth), style: style.outlineStyle, top: rect.top, bottom: rect.bottom, headerBottom: header?.bottom || 0, height: innerHeight };
  });
  if (focus.style === 'none' || focus.outline < 3) throw new Error(`${label}: visible focus indicator missing`);
  if (focus.top < focus.headerBottom - 1 || focus.bottom > focus.height + 1) throw new Error(`${label}: focused control is obscured ${JSON.stringify(focus)}`);
}

async function verifyDeferredPreviews(page, viewport, label) {
  const frames = page.locator('iframe[data-src]');
  await page.waitForTimeout(200);
  if (await frames.count() !== 4) throw new Error(`${label}: expected 4 deferred preview frames`);
  if (await page.locator('iframe[data-preview-loaded="true"]').count() !== 0) throw new Error(`${label}: preview iframe loaded before approach`);

  const previews = [
    ['.nexa-live-preview', ['NEXA TECH SERVICE'], 'NEXA'],
    ['.booking-portfolio-preview', ['BOOKING CRM', '고객 예약·문의'], 'BOOKING'],
    ['.mono-live-preview', ['MONO OPERATIONS', '통합 업무함'], 'MONO'],
    ['.excel-live-preview', ['Excel 정리 작업실', '한 파일 정리'], 'EXCEL']
  ];

  if (viewport.width <= 760) {
    for (const [selector] of previews) {
      const display = await page.locator(selector).evaluate(el => getComputedStyle(el).display);
      if (display !== 'none') throw new Error(`${label}: mobile preview ${selector} must be hidden`);
    }
    if (await page.locator('iframe[src]').count()) throw new Error(`${label}: mobile preview iframe must never load`);
    return;
  }

  for (const [selector, phrases, name] of previews) {
    const preview = page.locator(selector);
    await preview.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
    const iframe = preview.locator('iframe');
    await page.waitForFunction(el => el?.dataset.previewLoaded === 'true' && Boolean(el.getAttribute('src')), await iframe.elementHandle(), { timeout: 15_000 });
    await waitForFrameText(page.frameLocator(`${selector} iframe`), phrases, `${label}/${name}`);
  }
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  const errors = attachGuards(page);
  try {
    await goto(page, `${base}/`);
    await page.locator('.booking-portfolio-showcase').waitFor({ state: 'visible', timeout: 15_000 });
    await verifyQualitySections(page, `portfolio/${viewport.name}/sections`);
    await verifySeo(page, `portfolio/${viewport.name}/seo`);
    await verifyDeferredPreviews(page, viewport, `portfolio/${viewport.name}/performance`);
    await verifyReviewMode(page, `portfolio/${viewport.name}/review`);
    await verifyAccessibility(page, viewport, `portfolio/${viewport.name}/accessibility`);
    await assertNoOverflow(page, `portfolio/${viewport.name}`);
    await page.screenshot({ path: `${output}/portfolio-quality-${viewport.name}.png`, fullPage: true });
    if (errors.length) throw new Error(errors.join(' | '));
    console.log(`PASS portfolio quality ${viewport.width}x${viewport.height}`);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
  }
}

await browser.close();
if (failures.length) {
  console.error('\nPORTFOLIO QUALITY LIVE QA FAILURES');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('\nPORTFOLIO QUALITY LIVE QA: PASS');
