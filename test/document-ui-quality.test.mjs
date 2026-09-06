import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../document-intake-approval/index.html', import.meta.url), 'utf8');
const quality = await readFile(new URL('../document-intake-approval/quality.css', import.meta.url), 'utf8');

test('document review keeps the three-pane review workflow and accessible filters', () => {
  assert.match(html, /class="document-workspace"/);
  assert.match(html, /class="panel inbox-panel"/);
  assert.match(html, /class="panel preview-panel"/);
  assert.match(html, /class="panel review-panel"/);
  assert.match(html, /id="doc-preview"/);
  assert.match(html, /id="search" type="search" aria-label="문서 검색"/);
  assert.match(html, /id="status-filter" aria-label="문서 상태"/);
  assert.match(html, /id="comment"[^>]*aria-label="검수 의견"/);
});

test('document preview readability is protected by a final quality layer', () => {
  assert.match(html, /styles\.css"><link rel="stylesheet" href="\.\/quality\.css"/);
  assert.match(quality, /\.paper-source p\{font-size:13px!important/);
  assert.match(quality, /\.paper-meta strong\{font-size:13px!important/);
  assert.match(quality, /\.doc-card p\{font-size:13px!important/);
  assert.match(quality, /\.actions button,\.archive\{min-height:40px!important;font-size:13px!important/);
});
