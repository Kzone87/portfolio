import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = String(process.env.ELITE_BASE || 'https://kzone87.github.io/portfolio').replace(/\/$/, '');
const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('CHROME_PATH is required');
const output = 'portfolio-elite-live-qa-artifacts';
await mkdir(output, { recursive:true });

const browser = await chromium.launch({ executablePath:chromePath, headless:true, args:['--no-sandbox'] });
const failures = [];
const viewports = [
  { name:'desktop', width:1440, height:1000 },
  { name:'tablet', width:768, height:1024 },
  { name:'mobile', width:390, height:844 }
];

async function goto(page) {
  let last;
  for (let attempt=1; attempt<=8; attempt+=1) {
    try {
      const response = await page.goto(`${base}/`, { waitUntil:'networkidle', timeout:30_000 });
      if (!response || response.status() >= 400) throw new Error(`HTTP ${response?.status() ?? 'none'}`);
      return;
    } catch (error) {
      last = error;
      await page.waitForTimeout(attempt * 700);
    }
  }
  throw last;
}

async function verify(viewport) {
  const context = await browser.newContext({ viewport:{ width:viewport.width, height:viewport.height }, locale:'ko-KR', timezoneId:'Asia/Seoul' });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`); });
  try {
    await goto(page);
    await page.locator('#recruiter-path').waitFor({ state:'attached', timeout:15_000 });
    await page.locator('#proof-center').waitFor({ state:'attached', timeout:15_000 });
    await page.locator('#case-studies').waitFor({ state:'attached', timeout:15_000 });
    await page.waitForFunction(() => window.KZONE_PERFORMANCE_GATE && window.KZONE_ACCESSIBILITY_GATE && window.KZONE_SEO_GATE && window.KZONE_VISUAL_POLISH, null, { timeout:15_000 });

    const body = await page.locator('body').innerText();
    for (const phrase of ['RECRUITER 90-SECOND FLOW','설명 대신 5단계 증거로 확인하세요.','EVIDENCE-DRIVEN CASE STUDIES','PROBLEM','HARD EDGE','VERIFICATION']) {
      if (!body.includes(phrase)) throw new Error(`${viewport.name}: missing ${phrase}`);
    }

    const recruiterSteps = page.locator('[data-recruiter-step]');
    if (await recruiterSteps.count() !== 3) throw new Error(`${viewport.name}: recruiter flow must have 3 steps`);
    const proofCards = page.locator('[data-proof-product]');
    if (await proofCards.count() !== 5) throw new Error(`${viewport.name}: proof center must have 5 products`);
    for (let i=0; i<5; i+=1) {
      const links = proofCards.nth(i).locator('.proof-center-chain a');
      if (await links.count() !== 5) throw new Error(`${viewport.name}: proof product ${i+1} must have 5 evidence links`);
    }

    const initialPerformance = await page.evaluate(() => window.KZONE_PERFORMANCE_GATE.inspect());
    if (initialPerformance.total !== 4) throw new Error(`${viewport.name}: expected 4 deferred preview frames, got ${JSON.stringify(initialPerformance)}`);
    if (viewport.width <= 760) {
      if (!initialPerformance.mobileSuppressed || initialPerformance.loaded !== 0) throw new Error(`${viewport.name}: mobile previews must remain network-suppressed ${JSON.stringify(initialPerformance)}`);
    } else {
      if (initialPerformance.loaded >= initialPerformance.total) throw new Error(`${viewport.name}: performance gate did not defer offscreen frames ${JSON.stringify(initialPerformance)}`);
      for (const selector of ['.nexa-live-preview iframe','.booking-portfolio-preview iframe','.mono-live-preview iframe','.excel-live-preview iframe']) {
        const frame = page.locator(selector);
        await frame.scrollIntoViewIfNeeded();
        await page.waitForFunction((sel) => document.querySelector(sel)?.dataset.previewLoaded === 'true', selector, { timeout:15_000 });
      }
      const loadedPerformance = await page.evaluate(() => window.KZONE_PERFORMANCE_GATE.inspect());
      if (loadedPerformance.loaded !== loadedPerformance.total) throw new Error(`${viewport.name}: visible previews did not load on demand ${JSON.stringify(loadedPerformance)}`);
    }

    const a11y = await page.evaluate(() => window.KZONE_ACCESSIBILITY_GATE.inspect());
    if (a11y.h1Count !== 1 || !a11y.skipLink || a11y.tabCount !== 3 || a11y.selectedTabCount !== 1 || a11y.unassociatedTabs !== 0 || a11y.tinyCriticalControls !== 0) {
      throw new Error(`${viewport.name}: accessibility gate failed ${JSON.stringify(a11y)}`);
    }

    const firstTab = page.locator('[role="tab"]').first();
    await firstTab.focus();
    const focusOutline = await firstTab.evaluate((el) => getComputedStyle(el).outlineStyle);
    if (focusOutline === 'none') throw new Error(`${viewport.name}: focus-visible outline missing`);

    const structured = await page.locator('#kzone87-structured-data').textContent();
    const data = JSON.parse(structured);
    const types = new Set(data['@graph'].map(item => item['@type']));
    for (const type of ['Person','ProfilePage','WebSite']) if (!types.has(type)) throw new Error(`${viewport.name}: structured data missing ${type}`);
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    if (!robots?.includes('index,follow')) throw new Error(`${viewport.name}: robots meta missing`);
    if ((await page.locator('meta[property="og:site_name"]').getAttribute('content')) !== 'Kzone87 Portfolio') throw new Error(`${viewport.name}: og:site_name missing`);

    // Motion is decoration, never a content-visibility dependency. Wait for the bounded
    // fallback and assert that no offscreen section remains transparent in a full-page view.
    await page.waitForTimeout(1300);
    const visual = await page.evaluate(() => {
      const hiddenReveal = [...document.querySelectorAll('[data-reveal]')]
        .filter((element) => getComputedStyle(element).opacity === '0').length;
      const proofGrid = document.querySelector('.proof-center-grid');
      const firstChain = document.querySelector('.proof-center-chain');
      const evidenceRail = document.querySelector('#evidence .proof-rail');
      const columnCount = (element) => {
        if (!element) return 0;
        const columns = getComputedStyle(element).gridTemplateColumns.trim();
        return columns ? columns.split(/\s+/).length : 0;
      };
      return {
        hiddenReveal,
        proofColumns:columnCount(proofGrid),
        chainColumns:columnCount(firstChain),
        evidenceRail:evidenceRail ? getComputedStyle(evidenceRail).display : '',
        gate:window.KZONE_VISUAL_POLISH.inspect()
      };
    });
    if (visual.hiddenReveal !== 0) throw new Error(`${viewport.name}: unrevealed content remains hidden ${JSON.stringify(visual)}`);
    if (visual.evidenceRail !== 'none') throw new Error(`${viewport.name}: duplicate legacy proof rail is visible ${JSON.stringify(visual)}`);
    if (viewport.width > 900 && visual.proofColumns !== 2) throw new Error(`${viewport.name}: desktop proof center must be compact 2-column ${JSON.stringify(visual)}`);
    if (viewport.width <= 900 && visual.proofColumns !== 1) throw new Error(`${viewport.name}: compact viewport proof center must be 1-column ${JSON.stringify(visual)}`);
    if (viewport.width <= 640 && visual.chainColumns !== 2) throw new Error(`${viewport.name}: mobile evidence chain must be compact 2-column ${JSON.stringify(visual)}`);
    if (!visual.gate.recruiterContained) throw new Error(`${viewport.name}: recruiter path must remain a contained review strip ${JSON.stringify(visual)}`);
    const proofStoryRatio = visual.gate.proofStoryParentWidth ? visual.gate.proofStoryWidth / visual.gate.proofStoryParentWidth : 0;
    if (proofStoryRatio < 0.97) throw new Error(`${viewport.name}: proof story leaves an unintended empty column ${JSON.stringify(visual)}`);

    const dimensions = await page.evaluate(() => ({ client:document.documentElement.clientWidth, scroll:document.documentElement.scrollWidth }));
    if (dimensions.scroll > dimensions.client + 2) throw new Error(`${viewport.name}: horizontal overflow ${JSON.stringify(dimensions)}`);

    await page.screenshot({ path:`${output}/elite-${viewport.name}.png`, fullPage:true });
    if (runtimeErrors.length) throw new Error(`${viewport.name}: ${runtimeErrors.join(' | ')}`);
    console.log(`PASS elite portfolio ${viewport.width}x${viewport.height} · performance + proof + recruiter + a11y + SEO + visual polish + case study`);
  } finally {
    await context.close();
  }
}

for (const viewport of viewports) {
  try { await verify(viewport); }
  catch (error) { failures.push(error instanceof Error ? error.message : String(error)); }
}

{
  const context = await browser.newContext({ viewport:{ width:1440, height:1000 }, reducedMotion:'reduce' });
  const page = await context.newPage();
  try {
    await goto(page);
    await page.waitForFunction(() => window.KZONE_ACCESSIBILITY_GATE, null, { timeout:15_000 });
    const motion = await page.locator('.portfolio-experience-tab').first().evaluate((el) => ({
      transition:getComputedStyle(el).transitionDuration,
      scroll:getComputedStyle(document.documentElement).scrollBehavior
    }));
    const durations = motion.transition.split(',').map(value => Number.parseFloat(value) || 0);
    if (Math.max(...durations) > 0.02 || motion.scroll === 'smooth') throw new Error(`reduced-motion gate failed ${JSON.stringify(motion)}`);
    console.log('PASS reduced-motion accessibility gate');
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
  }
}

await browser.close();
if (failures.length) {
  console.error('\nPORTFOLIO ELITE LIVE QA FAILURES');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('\nPORTFOLIO ELITE LIVE QA: PASS');