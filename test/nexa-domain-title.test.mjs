import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');

test('NEXA domain page is titled as a service guide, not a case study', () => {
  assert.match(html, /<title>NEXA 서비스 운영 안내 \| NEXA TECH SERVICE<\/title>/);
  assert.doesNotMatch(html, /Case Study|Kzone87 Portfolio/);
});
