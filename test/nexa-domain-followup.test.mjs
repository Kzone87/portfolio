import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');

test('NEXA service flow tells customers what happens after the visit', () => {
  for (const phrase of ['작업 결과','정상 작동 여부','부품·재방문·다음 점검','완료 이후 필요한 일']) assert.ok(html.includes(phrase));
});
