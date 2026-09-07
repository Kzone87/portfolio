import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const customerPages = ['index.html','about.html','services.html','industries.html','cases.html','playbook.html','contact.html'];
const customers = await Promise.all(customerPages.map(page => load(`nexa-tech-service/${page}`)));
const portfolio = await load('index.html');
const domain = await load('nexa-service-domain/index.html');
const ops = await load('field-service-ops/index.html');

const stripFooter = html => html.replace(/<footer[\s\S]*?<\/footer>/i, '');

test('customer-facing NEXA contains customer actions, not portfolio narration', () => {
  const body = customers.map(stripFooter).join('\n');
  for (const phrase of ['서비스','이용 고객','이용 상황','상담']) assert.ok(body.includes(phrase));
  for (const forbidden of ['포트폴리오','프로젝트 설명','구현 근거','역할 분리','ONE DOMAIN','FIELD OPS','NEXA Service Operations']) {
    assert.ok(!body.includes(forbidden), `customer surface leaks ${forbidden}`);
  }
});

test('portfolio summary stays concise while routing to the NEXA bundle', () => {
  for (const phrase of ['기업 홈페이지 + 기사 배차·현장 관리','프로젝트 구조 보기','01 · 고객용 기업 홈페이지','02 · 기사 배차·현장 관리']) assert.ok(portfolio.includes(phrase));
  assert.ok(!portfolio.includes('ONE DOMAIN · TWO SURFACES'));
});

test('domain page owns architecture explanation instead of product surfaces', () => {
  for (const phrase of ['한 기술서비스 업무를','왜 두 화면인가','하나의 업무 흐름','구현 근거']) assert.ok(domain.includes(phrase));
  assert.ok(domain.includes('../nexa-tech-service/'));
  assert.ok(domain.includes('../field-service-ops/'));
});

test('field operations is an operational workspace with no portfolio navigation', () => {
  for (const phrase of ['오늘의 배차 현황','기사별 일정','방문 요청','오늘 확인할 항목','최근 변경 이력']) assert.ok(ops.includes(phrase));
  for (const forbidden of ['포트폴리오','프로젝트 구조','고객용 홈페이지','이 시스템은']) assert.ok(!ops.includes(forbidden), `ops surface leaks ${forbidden}`);
});
