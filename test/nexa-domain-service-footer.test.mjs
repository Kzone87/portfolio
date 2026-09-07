import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');

test('service flow footer returns customers to NEXA service home', () => {
  assert.match(html, /© 2026 NEXA TECH SERVICE · 공개 시연용 가상 브랜드/);
  assert.match(html, /href="\.\.\/nexa-tech-service\/">서비스 홈 ↑<\/a>/);
});
