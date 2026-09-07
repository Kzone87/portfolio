import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');

test('customer service flow has no portfolio home navigation', () => {
  assert.ok(!html.includes('href="../">포트폴리오'));
  assert.ok(!html.includes('Portfolio Home'));
});
