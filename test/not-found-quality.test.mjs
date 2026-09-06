import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../404.html', import.meta.url), 'utf8');

test('portfolio provides a useful branded not-found page', () => {
  assert.match(html, /404 · KZONE87/);
  assert.match(html, /요청한 페이지를/);
  assert.match(html, /href="\/portfolio\/"/);
  assert.match(html, /href="\/portfolio\/#featured"/);
  assert.match(html, /name="robots" content="noindex"/);
});
