import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');

test('customer service flow never exposes the internal staff workspace', () => {
  assert.ok(!html.includes('../field-service-ops/'));
  assert.ok(!html.includes('직원용 현장 운영'));
  assert.ok(!html.includes('NEXA Service Operations'));
});
