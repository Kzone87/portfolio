import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');

test('service flow header carries the NEXA customer brand', () => {
  assert.match(html, /<a class="portfolio-brand" href="\.\.\/nexa-tech-service\/">NEXA TECH SERVICE<\/a>/);
  assert.doesNotMatch(html, />KZONE87<\/a>/);
});
