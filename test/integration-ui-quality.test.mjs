import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../integration-control-center/index.html', import.meta.url), 'utf8');
const quality = await readFile(new URL('../integration-control-center/quality.css', import.meta.url), 'utf8');
const guard = await readFile(new URL('../integration-control-center/quality.js', import.meta.url), 'utf8');

test('integration workspace keeps data flow, saved jobs and recovery visible', () => {
  assert.match(html, /id="workflowPreview"/);
  assert.match(html, /id="connectionList"/);
  assert.match(html, /id="jobTable"/);
  assert.match(html, /문제 연결 확인/);
  assert.match(html, /연결 정상화/);
  assert.match(html, /실패 작업 재실행/);
});

test('failed connection remains previewable but unavailable for new jobs', () => {
  assert.match(html, /quality\.js/);
  assert.match(guard, /warehouse-demo/);
  assert.match(guard, /option\.disabled = true/);
  assert.match(guard, /MutationObserver/);
});

test('integration readability layer protects flow, table and recovery text', () => {
  assert.match(html, /styles\.css"><link rel="stylesheet" href="\.\/quality\.css"/);
  assert.match(quality, /\.flow-node strong\{font-size:14px!important/);
  assert.match(quality, /td\{font-size:13px!important/);
  assert.match(quality, /\.operator-guide p\{font-size:12px!important/);
});
