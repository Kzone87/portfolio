import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const home = await load('index.html');
const domain = await load('nexa-service-domain/index.html');
const ops = await load('field-service-ops/index.html');

const visibleText = html => html
  .replace(/<head[\s\S]*?<\/head>/i, ' ')
  .replace(/<footer[\s\S]*?<\/footer>/i, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ');

test('each NEXA surface addresses its actual audience', () => {
  assert.match(home, /고객 상담부터 현장 배차까지 이어지는 유지보수 서비스/);
  assert.match(domain, /장비 모델이나 오류코드를 정확히 몰라도 괜찮습니다/);
  assert.match(ops, /긴급 요청과 미배정 작업을 먼저 확인하세요/);

  assert.doesNotMatch(visibleText(domain), /왜 두 화면인가|역할 분리|구현 근거|KZONE87|Portfolio/i);
  assert.doesNotMatch(visibleText(ops), /포트폴리오|프로젝트 설명|고객용 홈페이지 보기/);
});
