import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright-core';

const baseUrl = process.env.OPS_KIT_BASE || 'https://kzone87.github.io/portfolio/mini-labs/';
const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('CHROME_PATH is required');

const artifactDir = path.resolve('ops-kit-live-qa-artifacts');
await mkdir(artifactDir, { recursive: true });

const expectedOrigin = new URL(baseUrl).origin;
const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], badResponses: [], externalRequests: [] };

function attachDiagnostics(page) {
  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => diagnostics.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => diagnostics.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));
  page.on('response', (response) => {
    if (response.status() >= 400) diagnostics.badResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    try {
      const origin = new URL(url).origin;
      if (origin !== expectedOrigin) diagnostics.externalRequests.push(url);
    } catch {
      diagnostics.externalRequests.push(url);
    }
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    root: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));
  assert(overflow.body <= 1 && overflow.root <= 1, `${label}: horizontal overflow ${JSON.stringify(overflow)}`);
}

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage();
  attachDiagnostics(page);

  for (const viewport of [
    { width: 1440, height: 1000, name: '1440x1000' },
    { width: 768, height: 1024, name: '768x1024' },
    { width: 390, height: 844, name: '390x844' }
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByText('OPS KIT', { exact: true }).first().waitFor();
    await page.getByRole('tab', { name: /Content Preflight/ }).waitFor();
    await page.getByRole('tab', { name: /Release Gate/ }).waitFor();
    await assertNoOverflow(page, viewport.name);
    await page.screenshot({ path: path.join(artifactDir, `ops-kit-${viewport.name}.png`), fullPage: true });
    console.log(`PASS OPS KIT render ${viewport.name}`);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  // 1. Content Preflight — explicit failure then pass + evidence download.
  await page.locator('#content-title').fill('x');
  await page.locator('#content-body').fill('short');
  await page.locator('#content-run').click();
  await page.locator('#content-output').getByText('게시 전에 확인이 필요합니다.', { exact: true }).waitFor();
  await page.locator('#content-title').fill('Production Notice');
  await page.locator('#content-body').fill('This production notice contains enough content for a clean preflight verification without placeholders.');
  await page.locator('#content-run').click();
  await page.locator('#content-output').getByText('게시 전 검사를 통과했습니다.', { exact: true }).waitFor();
  const contentDownload = page.waitForEvent('download');
  await page.locator('#content-output').getByRole('button', { name: '증빙 JSON' }).click();
  await contentDownload;
  await page.screenshot({ path: path.join(artifactDir, 'ops-kit-content-pass.png'), fullPage: true });
  console.log('PASS Content Preflight invalid -> valid -> evidence download');

  // 2. Data Extractor — quoted comma / escaped quote + data download.
  await page.getByRole('tab', { name: /Data Extractor/ }).click();
  await page.locator('#kv-source').fill('Invoice: INV-100\nCustomer: Mono Works\nAmount: 180000');
  await page.locator('#csv-source').fill('id,name,note\n1,"Mono, Inc","He said ""ready"""\n2,Light Works,queued');
  await page.locator('#extract-run').click();
  await page.locator('#extract-output').getByText('구조화가 완료되었습니다.', { exact: true }).waitFor();
  await page.locator('#extract-output').getByText('2행', { exact: true }).waitFor();
  const dataDownload = page.waitForEvent('download');
  await page.locator('#extract-output').getByRole('button', { name: '추출 결과 JSON' }).click();
  await dataDownload;
  await page.screenshot({ path: path.join(artifactDir, 'ops-kit-extractor-pass.png'), fullPage: true });
  console.log('PASS Data Extractor quoted CSV -> JSON download');

  // 3. Workflow Dry-Run — simulated failure then complete pass.
  await page.getByRole('tab', { name: /Workflow Dry-Run/ }).click();
  await page.locator('#fail-step').fill('submit');
  await page.locator('#workflow-run').click();
  await page.locator('#workflow-output').getByText('실패 지점을 확인했습니다.', { exact: true }).waitFor();
  await page.locator('#fail-step').fill('');
  await page.locator('#workflow-run').click();
  await page.locator('#workflow-output').getByText('Dry-run을 끝까지 통과했습니다.', { exact: true }).waitFor();
  await page.locator('#workflow-output').getByText(/실제 웹사이트에는 접속하지 않았습니다/).waitFor();
  await page.screenshot({ path: path.join(artifactDir, 'ops-kit-workflow-pass.png'), fullPage: true });
  console.log('PASS Workflow Dry-Run failure -> recovery without navigation');

  // 4. Security Check — unsafe inputs blocked then safe inputs pass.
  await page.getByRole('tab', { name: /Security Check/ }).click();
  await page.locator('#security-origin').fill('https://evil.example.net');
  await page.locator('#security-redirect').fill('https://evil.example.net/phish');
  await page.locator('#security-cell').fill('=2+2');
  await page.locator('#security-secret').fill('123');
  await page.locator('#security-run').click();
  await page.locator('#security-output').getByText('보완할 항목이 있습니다.', { exact: true }).waitFor();
  await page.locator('#security-output').getByText("'=2+2", { exact: true }).waitFor();
  await page.locator('#security-origin').fill('https://example.com');
  await page.locator('#security-redirect').fill('/dashboard');
  await page.locator('#security-cell').fill('safe-value');
  await page.locator('#security-secret').fill('safe-demo-secret');
  await page.locator('#security-run').click();
  await page.locator('#security-output').getByText('보안 점검을 통과했습니다.', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(artifactDir, 'ops-kit-security-pass.png'), fullPage: true });
  console.log('PASS Security Check unsafe -> safe');

  // 5. Release Gate — required failure blocks release then all required pass.
  await page.getByRole('tab', { name: /Release Gate/ }).click();
  await page.locator('#release-form input[name="secretScan"]').uncheck();
  await page.locator('#release-run').click();
  await page.locator('#release-output').getByText('NO-GO · 배포를 중단합니다.', { exact: true }).waitFor();
  await page.locator('#release-form input[name="secretScan"]').check();
  await page.locator('#release-run').click();
  await page.locator('#release-output').getByText('GO · 배포 필수 조건 통과', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(artifactDir, 'ops-kit-release-pass.png'), fullPage: true });
  console.log('PASS Release Gate NO-GO -> GO');

  await assertNoOverflow(page, 'final workflow');

  const allDiagnostics = Object.entries(diagnostics).filter(([, items]) => items.length);
  assert(allDiagnostics.length === 0, `runtime diagnostics failed: ${JSON.stringify(diagnostics, null, 2)}`);
  console.log('OPS KIT LIVE PAGES QA: PASS');
} finally {
  await browser.close();
}
