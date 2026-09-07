import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');

test('service flow uses direct customer address instead of portfolio self-description', () => {
  for (const phrase of ['알려주시면','알려주세요','확인합니다','안내합니다']) assert.ok(html.includes(phrase), `missing direct address: ${phrase}`);
  for (const phrase of ['설계했습니다','구현했습니다','나눴습니다']) assert.ok(!html.includes(phrase), `self-description returned: ${phrase}`);
});
