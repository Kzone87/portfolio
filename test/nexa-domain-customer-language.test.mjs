import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const domain = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');
const body = domain.replace(/<footer[\s\S]*?<\/footer>/i, '');

test('NEXA domain page speaks to a maintenance customer, not to the portfolio owner', () => {
  for (const phrase of [
    '장비 모델이나 오류코드를 정확히 몰라도 괜찮습니다',
    '상담에 필요한 정보',
    '방문이 필요하다면',
    '접수한 내용이',
    '방문 시간 확인',
    '긴급 요청 확인',
    '상담 시작하기'
  ]) assert.ok(body.includes(phrase), `missing customer explanation: ${phrase}`);

  for (const forbidden of [
    '왜 두 화면인가',
    '역할 분리',
    '구현 근거',
    '프로젝트 구성',
    '실제 업무처럼 처리할 수 있게 구현했습니다',
    '같은 업무를 서로 다른 사용자에게 맞춰 분리했습니다',
    'KZONE87',
    'Portfolio Home',
    '../field-service-ops/'
  ]) assert.ok(!body.includes(forbidden), `domain page still explains the build instead of the service: ${forbidden}`);
});
