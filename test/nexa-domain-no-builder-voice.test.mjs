import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');

test('service flow avoids builder voice', () => {
  assert.doesNotMatch(html, /만들었습니다|구성했습니다|나눴습니다|보여줍니다|직접 확인할 수 있습니다/);
});
