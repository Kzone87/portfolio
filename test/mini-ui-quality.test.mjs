import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../mini-labs/index.html', import.meta.url), 'utf8');
const quality = await readFile(new URL('../mini-labs/quality.css', import.meta.url), 'utf8');

test('mini tools remain a three-tool executable gallery', () => {
  assert.match(html, /data-tab="cms"/);
  assert.match(html, /data-tab="extract"/);
  assert.match(html, /data-tab="automation"/);
  assert.match(html, /id="cms-run"/);
  assert.match(html, /id="extract-run"/);
  assert.match(html, /id="automation-run"/);
});

test('mini tools readability layer protects card, form and result text', () => {
  assert.match(html, /styles\.css"><link rel="stylesheet" href="\.\/quality\.css"/);
  assert.match(quality, /\.tool-card strong\{font-size:14px!important/);
  assert.match(quality, /\.lab-form input,\.lab-form textarea,\.lab-form select\{font-size:13px!important/);
  assert.match(quality, /\.result-panel>p\{font-size:13px!important/);
  assert.match(quality, /\.lab-form button\{min-height:40px!important;font-size:13px!important/);
});
