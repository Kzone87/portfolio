import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const home = await load('index.html');
const portal = await load('nexa-service-domain/index.html');
const customerApp = await load('nexa-tech-service/app.js');
const ops = await load('field-service-ops/index.html');

const visibleText = html => html
  .replace(/<head[\s\S]*?<\/head>/i, ' ')
  .replace(/<footer[\s\S]*?<\/footer>/i, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ');

test('each NEXA surface addresses the person who would actually use it', () => {
  assert.match(home, /고객 상담부터 현장 완료까지, 하나로 이어지는 서비스 운영 시스템/);
  assert.match(home, /NEXA SERVICE SUITE/);
  assert.match(portal, /등록 연락처 또는 이메일로 받은 일회용 인증번호/);
  assert.match(portal, /접수번호만으로 공개하지 않습니다/);
  assert.match(portal, /현재 진행상태/);
  assert.match(customerApp, /진행 조회/);
  assert.match(ops, /긴급 요청과 미배정 작업을 먼저 확인하세요/);
  assert.match(ops, /서울 운영팀/);
  assert.match(ops, /김현수/);

  assert.doesNotMatch(visibleText(portal), /왜 두 화면인가|역할 분리|구현 근거|KZONE87|Portfolio|FIELD OPS/i);
  assert.doesNotMatch(visibleText(ops), /포트폴리오|프로젝트 설명|고객용 홈페이지 보기/);
  assert.doesNotMatch(ops, /현재 역할|id="role"/);
});
