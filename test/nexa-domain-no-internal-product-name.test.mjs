import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');
const body = html.replace(/<footer[\s\S]*?<\/footer>/i, '');

test('customer service flow does not expose internal product naming', () => {
  assert.doesNotMatch(body, /NEXA Service Operations|FIELD OPS|직원 전용/);
});
