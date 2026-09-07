import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const home = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('portfolio NEXA card avoids meta explanation copy', () => {
  for (const forbidden of ['프로젝트 구조 보기','왜 두 화면인가','역할 분리','구현 근거','같은 업무를 서로 다른 사용자에게 맞춰 분리했습니다']) {
    assert.ok(!home.includes(forbidden), `portfolio NEXA card still explains the design: ${forbidden}`);
  }
});
