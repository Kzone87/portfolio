import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const home = await readFile(new URL('../nexa-tech-service/index.html', import.meta.url), 'utf8');

test('NEXA TECH home keeps critical customer links usable without JavaScript', () => {
  const noscript = home.match(/<noscript>([\s\S]*?)<\/noscript>/i)?.[1] || '';
  assert.match(noscript, /JavaScript 비활성화 빠른 메뉴/);
  assert.match(noscript, /href="\.\.\/nexa-service-domain\/"[^>]*data-service-status>진행 조회<\/a>/);
  assert.match(noscript, /href="\.\/contact\.html">유지보수 상담<\/a>/);
  assert.match(noscript, /class="hero-actions"/);
});
