import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');

test('NEXA service flow navigation is customer-oriented', () => {
  for (const label of ['상담 준비','진행 과정','운영 기준','상담']) assert.ok(html.includes(`>${label}<`), `missing service nav ${label}`);
  for (const forbidden of ['왜 나눴는가','업무 흐름','구현 근거','포트폴리오']) assert.ok(!html.includes(`>${forbidden}<`), `old portfolio nav returned: ${forbidden}`);
});
