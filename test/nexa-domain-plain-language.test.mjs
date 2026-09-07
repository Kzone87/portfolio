import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');

test('NEXA service flow stays in plain maintenance language', () => {
  for (const forbidden of ['architecture','surface','case study','workflow domain','role separation','implementation']) assert.doesNotMatch(html, new RegExp(forbidden, 'i'));
});
