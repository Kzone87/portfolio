import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const domain = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');
const body = domain.replace(/<footer[\s\S]*?<\/footer>/i, '');

test('domain copy never explains how the portfolio was designed', () => {
  for (const pattern of [
    /설계했습니다/,
    /구현했습니다/,
    /두 화면/,
    /사용자 역할/,
    /프로젝트/,
    /포트폴리오/,
    /case study/i
  ]) assert.doesNotMatch(body, pattern);
});
