import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');

test('service flow copy is written as guidance for the maintenance customer', () => {
  for (const phrase of ['지금 불편한 점부터 알려주세요','아는 범위에서 알려주시면 됩니다','지원 가능 여부와 방문 일정, 준비사항을 안내합니다','각 단계에서 고객이 다음에 무엇을 해야 하는지','장비 모델을 몰라도']) {
    assert.ok(html.includes(phrase), `missing direct customer guidance: ${phrase}`);
  }
});
