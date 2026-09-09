import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const portfolioBase = 'https://kzone87.github.io/portfolio';
const excelBase = 'https://kzone87.github.io/customer-map-planner';
const output = 'portfolio-full-live-qa-artifacts';
const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('CHROME_PATH is required');

await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox']
});
const failures = [];

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 }
];

const surfaces = [
  {
    name: 'portfolio',
    url: `${portfolioBase}/`,
    required: ['KZONE87', 'NEXA SERVICE SUITE', 'MONO OPERATIONS', 'Excel 정리 작업실', 'OPS KIT', '프로젝트 의뢰서 작성']
  },
  {
    name: 'nexa-tech-service',
    url: `${portfolioBase}/nexa-tech-service/`,
    required: ['NEXA TECH SERVICE', '정기점검', '현장지원']
  },
  {
    name: 'nexa-customer-service',
    url: `${portfolioBase}/nexa-service-domain/`,
    required: ['서비스 요청 조회', '접수번호', '일회용 인증']
  },
  {
    name: 'nexa-service-operations',
    url: `${portfolioBase}/field-service-ops/`,
    required: ['NEXA SERVICE OPERATIONS', '배차']
  },
  {
    name: 'mono-operations',
    url: `${portfolioBase}/mono-operations/`,
    required: ['MONO OPERATIONS', '통합 업무함', 'MARKET', 'OFFICE', 'SUPPORT', 'DATA HUB']
  },
  {
    name: 'mono-market',
    url: `${portfolioBase}/commerce-ops-console/`,
    required: ['MONO MARKET', '주문 운영', '환불 검토']
  },
  {
    name: 'mono-office',
    url: `${portfolioBase}/document-intake-approval/`,
    required: ['MONO OFFICE', '문서 접수·검수', '검수 패널']
  },
  {
    name: 'mono-support',
    url: `${portfolioBase}/ai-workflow-review-desk/`,
    required: ['MONO SUPPORT', '고객 문의', '업무보조 제안']
  },
  {
    name: 'mono-data-hub',
    url: `${portfolioBase}/integration-control-center/`,
    required: ['MONO DATA HUB', '데이터 전달 작업', '장애 복구 절차']
  },
  {
    name: 'ops-kit',
    url: `${portfolioBase}/mini-labs/`,
    required: ['OPS KIT', '작은 반복업무를 바로 줄이는 도구', '게시 전 내용 검사', '문서 값 추출', '반복 입력작업']
  },
  {
    name: 'project-inquiry',
    url: `${portfolioBase}/project-inquiry/`,
    required: ['PROJECT INQUIRY', '어떤 업무를 바꿀지부터', '프로젝트 유형', '의뢰 내용 확인']
  },
  {
    name: 'excel-cleanup',
    url: `${excelBase}/`,
    required: ['Excel 정리 작업실', '한 파일 정리', '항목 이름 맞추기', '두 파일 비교', '여러 파일 정리']
  },
  {
    name: 'excel-mapping',
    url: `${excelBase}/mapping.html`,
    required: ['Excel 정리 작업실', '항목 이름 맞추기', '원본 파일 선택', '바뀐 항목 이름 확인']
  },
  {
    name: 'excel-compare',
    url: `${excelBase}/compare.html`,
    required: ['Excel 정리 작업실', '두 파일 비교', '예제 두 파일 비교', '바뀐 내용 찾기']
  },
  {
    name: 'excel-batch',
    url: `${excelBase}/batch.html`,
    required: ['Excel 정리 작업실', '여러 파일 정리', '선택한 파일 정리하기', '예제 3개 불러오기']
  }
];

function captureRuntimeErrors(page, errors) {
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', request => errors.push(`requestfailed: ${request.url()} · ${request.failure()?.errorText || 'unknown'}`));
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`);
  });
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
}

async function gotoWithRetry(page, url) {
  let last;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      if (!response || response.status() >= 400) throw new Error(`HTTP ${response?.status() ?? 'none'} ${url}`);
      return response;
    } catch (error) {
      last = error;
      await page.waitForTimeout(attempt * 1000);
    }
  }
  throw last;
}

async function assertNoHorizontalOverflow(page, label) {
  const size = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body?.scrollWidth || 0
  }));
  if (size.scrollWidth > size.clientWidth + 2 || size.bodyScrollWidth > size.clientWidth + 2) {
    throw new Error(`${label}: horizontal overflow ${JSON.stringify(size)}`);
  }
}

async function revealAll(page) {
  const items = page.locator('[data-reveal]');
  const count = await items.count();
  for (let i = 0; i < count; i += 1) {
    await items.nth(i).scrollIntoViewIfNeeded();
    await page.waitForTimeout(50);
  }
}

function absoluteHref(raw, pageUrl) {
  try {
    return new URL(raw, pageUrl).href;
  } catch {
    return null;
  }
}

async function assertMainHashLinks(page) {
  const rawHashes = await page.locator('a[href^="#"]').evaluateAll(nodes =>
    [...new Set(nodes.map(node => node.getAttribute('href')).filter(Boolean))]
  );
  for (const hash of rawHashes) {
    const id = decodeURIComponent(hash.slice(1));
    const target = id ? page.locator(`#${CSS.escape(id)}`) : page.locator('body');
    if (await target.count() !== 1) throw new Error(`portfolio hash target missing: ${hash}`);
    await page.locator(`a[href="${hash}"]`).first().click();
    await page.waitForTimeout(80);
    if (id && page.url().split('#')[1] !== encodeURIComponent(id) && !page.url().endsWith(`#${id}`)) {
      throw new Error(`portfolio hash navigation failed: ${hash} -> ${page.url()}`);
    }
    console.log(`PASS portfolio hash ${hash}`);
  }
}

async function auditMainHttpLinks(page, context) {
  const anchors = await page.locator('a[href]').evaluateAll(nodes => nodes.map(node => ({
    href: node.getAttribute('href'),
    text: (node.textContent || '').replace(/\s+/g, ' ').trim()
  })));
  const unique = new Map();
  for (const anchor of anchors) {
    if (!anchor.href || anchor.href.startsWith('#') || anchor.href.startsWith('javascript:') || anchor.href.startsWith('mailto:')) continue;
    const url = absoluteHref(anchor.href, page.url());
    if (!url) continue;
    if (!unique.has(url)) unique.set(url, anchor.text || anchor.href);
  }
  if (unique.size < 18) throw new Error(`portfolio link audit expected at least 18 unique HTTP links, got ${unique.size}`);

  for (const [url, label] of unique) {
    const response = await context.request.get(url, {
      failOnStatusCode: false,
      timeout: 30_000,
      maxRedirects: 10,
      headers: { 'user-agent': 'KZONE87-Portfolio-Live-QA/1.0' }
    });
    const status = response.status();
    if (status >= 400) throw new Error(`portfolio link broken ${status}: ${label} -> ${url}`);
    console.log(`PASS portfolio link ${status} ${label} -> ${url}`);
  }
  return unique.size;
}

for (const surface of surfaces) {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul'
    });
    const page = await context.newPage();
    const runtimeErrors = [];
    captureRuntimeErrors(page, runtimeErrors);
    try {
      await gotoWithRetry(page, surface.url);
      if (surface.name === 'portfolio') {
        await page.locator('.mono-portfolio-featured').waitFor({ state: 'visible', timeout: 15_000 });
        await revealAll(page);
        const frame = page.frameLocator('.mono-live-preview iframe');
        await frame.locator('body').waitFor({ state: 'visible', timeout: 15_000 });
        const frameText = await frame.locator('body').innerText();
        if (!frameText.includes('MONO OPERATIONS') || !frameText.includes('통합 업무함')) {
          throw new Error(`portfolio/${viewport.name}: MONO embedded live screen failed`);
        }
      }
      const body = await page.locator('body').innerText();
      for (const required of surface.required) {
        if (!body.includes(required)) throw new Error(`${surface.name}/${viewport.name}: missing ${required}`);
      }
      await assertNoHorizontalOverflow(page, `${surface.name}/${viewport.name}`);
      await page.screenshot({ path: `${output}/${surface.name}-${viewport.name}.png`, fullPage: true });
      if (runtimeErrors.length) throw new Error(`${surface.name}/${viewport.name}: ${runtimeErrors.join(' | ')}`);
      console.log(`PASS render ${surface.name} ${viewport.width}x${viewport.height}`);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    } finally {
      await context.close();
    }
  }
}

{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul'
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  captureRuntimeErrors(page, runtimeErrors);
  try {
    await gotoWithRetry(page, `${portfolioBase}/`);
    await page.locator('.mono-portfolio-featured').waitFor({ state: 'visible', timeout: 15_000 });
    await revealAll(page);
    await assertMainHashLinks(page);
    const linkCount = await auditMainHttpLinks(page, context);
    await page.screenshot({ path: `${output}/portfolio-link-audit.png`, fullPage: true });
    if (runtimeErrors.length) throw new Error(`portfolio link audit runtime: ${runtimeErrors.join(' | ')}`);
    console.log(`PASS portfolio full link audit ${linkCount} unique HTTP destinations`);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
  }
}

{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul'
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  captureRuntimeErrors(page, runtimeErrors);
  try {
    await gotoWithRetry(page, `${portfolioBase}/mini-labs/`);
    await page.locator('[data-tab="extract"]').click();
    if ((await page.locator('#current-tool-name').innerText()).trim() !== '문서 값 추출') throw new Error('OPS KIT extract tab did not activate');
    await page.locator('#extract-run').click();
    if (!(await page.locator('#extract-output').innerText()).includes('값을 정리했습니다.')) throw new Error('OPS KIT extract action failed');

    await page.locator('[data-tab="automation"]').click();
    await page.locator('#fail-step').selectOption('submit');
    await page.locator('#automation-run').click();
    if (!(await page.locator('#automation-output').innerText()).includes('중간 단계에서 멈췄습니다.')) throw new Error('OPS KIT failure simulation failed');
    await page.locator('#fail-step').selectOption('');
    await page.locator('#automation-run').click();
    if (!(await page.locator('#automation-output').innerText()).includes('반복작업을 끝까지 완료했습니다.')) throw new Error('OPS KIT success simulation failed');
    await assertNoHorizontalOverflow(page, 'ops-kit/interaction');
    await page.screenshot({ path: `${output}/ops-kit-interaction.png`, fullPage: true });
    if (runtimeErrors.length) throw new Error(`OPS KIT interaction runtime: ${runtimeErrors.join(' | ')}`);
    console.log('PASS OPS KIT tab -> extract -> failure simulation -> success simulation');
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
  }
}

{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul'
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  captureRuntimeErrors(page, runtimeErrors);
  try {
    await gotoWithRetry(page, `${portfolioBase}/project-inquiry/`);
    await page.locator('#project-inquiry-form button[type="submit"]').click();
    if (!(await page.locator('#project-inquiry-message').innerText()).includes('필수 항목과 동의 여부')) {
      throw new Error('project inquiry invalid-submit validation failed');
    }

    await page.locator('input[name="company"]').fill('KZONE QA');
    await page.locator('input[name="name"]').fill('테스트 담당자');
    await page.locator('input[name="email"]').fill('qa@example.com');
    await page.locator('select[name="projectType"]').selectOption({ label: '업무 운영 시스템' });
    await page.locator('textarea[name="detail"]').fill('접수부터 승인과 완료까지 하나의 업무 흐름으로 관리하고 싶습니다.');
    await page.locator('input[name="consent"]').check();
    await page.locator('#project-inquiry-form button[type="submit"]').click();
    await page.locator('#project-inquiry-summary').waitFor({ state: 'visible', timeout: 10_000 });
    const summary = await page.locator('#project-inquiry-summary').innerText();
    if (!summary.includes('KZONE QA') || !summary.includes('업무 운영 시스템')) throw new Error('project inquiry summary missing submitted values');
    const message = await page.locator('#project-inquiry-message').innerText();
    if (!message.includes('서버로 전송하지 않습니다')) throw new Error('project inquiry public-demo boundary missing');
    await assertNoHorizontalOverflow(page, 'project-inquiry/interaction');
    await page.screenshot({ path: `${output}/project-inquiry-interaction.png`, fullPage: true });
    if (runtimeErrors.length) throw new Error(`project inquiry interaction runtime: ${runtimeErrors.join(' | ')}`);
    console.log('PASS project inquiry validation -> form summary -> public-demo no-send boundary');
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
  }
}

{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul'
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  captureRuntimeErrors(page, runtimeErrors);
  try {
    await gotoWithRetry(page, `${excelBase}/`);
    const tabHrefs = await page.locator('.workspace-tabs a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
    const expectedTabs = ['./', './mapping.html', './compare.html', './batch.html'];
    if (JSON.stringify(tabHrefs) !== JSON.stringify(expectedTabs)) throw new Error(`Excel workspace tab links incorrect: ${JSON.stringify(tabHrefs)}`);
    await page.locator('#sampleButton').click();
    await page.waitForFunction(() => Number(document.querySelector('#rowCount')?.textContent || 0) > 0, null, { timeout: 15_000 });
    await page.locator('#dedupeButton').click();
    await assertNoHorizontalOverflow(page, 'excel-cleanup/interaction');
    await page.screenshot({ path: `${output}/excel-cleanup-interaction.png`, fullPage: true });

    await gotoWithRetry(page, `${excelBase}/compare.html`);
    await page.locator('#compare-sample').click();
    await page.locator('#result-section').waitFor({ state: 'visible', timeout: 15_000 });
    const resultText = await page.locator('#result-section').innerText();
    if (!resultText.includes('새로 추가') || !resultText.includes('값 변경')) throw new Error('Excel compare sample did not produce results');
    await assertNoHorizontalOverflow(page, 'excel-compare/interaction');
    await page.screenshot({ path: `${output}/excel-compare-interaction.png`, fullPage: true });
    if (runtimeErrors.length) throw new Error(`Excel interaction runtime: ${runtimeErrors.join(' | ')}`);
    console.log('PASS Excel tabs -> sample cleanup -> dedupe -> sample compare results');
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
  }
}

await browser.close();

if (failures.length) {
  console.error('\nPORTFOLIO FULL LIVE QA FAILURES');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('\nPORTFOLIO FULL LIVE QA: PASS');
