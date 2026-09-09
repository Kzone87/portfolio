import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../mini-labs/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../mini-labs/styles.css', import.meta.url), 'utf8');
const quality = await readFile(new URL('../mini-labs/quality.css', import.meta.url), 'utf8');
const app = await readFile(new URL('../mini-labs/app.js', import.meta.url), 'utf8');

test('OPS KIT exposes five real local-first utilities', () => {
  const tools = [
    { tab: 'content', panel: 'content', run: 'content-run', output: 'content-output' },
    { tab: 'extract', panel: 'extract', run: 'extract-run', output: 'extract-output' },
    { tab: 'automation', panel: 'workflow', run: 'automation-run', output: 'automation-output' },
    { tab: 'security', panel: 'security', run: 'security-run', output: 'security-output' },
    { tab: 'release', panel: 'release', run: 'release-run', output: 'release-output' }
  ];
  for (const tool of tools) {
    assert.match(html, new RegExp(`data-tab="${tool.tab}"`));
    assert.match(html, new RegExp(`id="${tool.panel}"`));
    assert.match(html, new RegExp(`id="${tool.run}"`));
    assert.match(html, new RegExp(`id="${tool.output}"`));
  }
  assert.match(html, /Content Preflight/);
  assert.match(html, /Data Extractor/);
  assert.match(html, /Workflow Dry-Run/);
  assert.match(html, /Security Check/);
  assert.match(html, /Release Gate/);
});

test('OPS KIT states its service boundary and blocks browser network connections', () => {
  assert.match(html, /서버 전송 없음/);
  assert.match(html, /외부 사이트 자동조작 없이/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /자동 저장하지 않습니다/);
  assert.doesNotMatch(app, /\bfetch\s*\(/);
  assert.doesNotMatch(app, /XMLHttpRequest/);
  assert.doesNotMatch(app, /innerHTML\s*=/);
});

test('OPS KIT responsive layer supports desktop, tablet and mobile without overflow masking', () => {
  assert.match(css, /@media\(max-width:1120px\)/);
  assert.match(css, /@media\(max-width:780px\)/);
  assert.match(css, /@media\(max-width:520px\)/);
  assert.match(css, /min-width:0/);
  assert.doesNotMatch(css, /overflow-x\s*:\s*hidden/);
});

test('OPS KIT accessibility layer preserves focus, readable mobile inputs and reduced motion', () => {
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-selected="true"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /diagnostic-options/);
  assert.match(html, /<select id="fail-step">/);
  assert.match(quality, /focus-visible/);
  assert.match(quality, /prefers-reduced-motion/);
  assert.match(quality, /font-size:16px!important/);
});

test('OPS KIT exposes evidence and explicit result-download behavior', () => {
  assert.match(app, /증빙 JSON/);
  assert.match(app, /추출 결과 JSON/);
  assert.match(app, /createEvidence/);
  assert.match(app, /downloadText/);
  assert.match(app, /syncFailStepOptions/);
});
