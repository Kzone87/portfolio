import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');

test('NEXA service flow contains no meta portfolio copy', () => {
  for (const forbidden of ['포트폴리오','프로젝트','설계','구현','역할 분리']) assert.ok(!html.includes(forbidden), `meta copy returned: ${forbidden}`);
});
