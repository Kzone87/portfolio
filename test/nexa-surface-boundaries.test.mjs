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

test('portfolio summary speaks in customer outcomes while routing to the NEXA bundle', () => {
  for (const phrase of ['고객 상담부터 현장 배차까지 이어지는 유지보수 서비스','서비스 운영 흐름 보기','01 · 고객 서비스 화면','02 · 직원 배차 화면']) assert.ok(portfolio.includes(phrase));
  for (const forbidden of ['왜 두 화면인가','역할 분리','구현 근거','ONE DOMAIN · TWO SURFACES']) assert.ok(!portfolio.includes(forbidden), `portfolio leaks design narration ${forbidden}`);
});

test('NEXA service flow page explains the maintenance journey directly to customers', () => {
  for (const phrase of ['상담이 끝난 뒤','상담 준비 이후','진행 과정','운영 기준','상담 시작하기']) assert.ok(domain.includes(phrase));
  assert.ok(domain.includes('../nexa-tech-service/services.html'));
  assert.ok(domain.includes('../nexa-tech-service/contact.html'));
  for (const forbidden of ['왜 두 화면인가','역할 분리','구현 근거','직원용 현장 운영','../field-service-ops/']) assert.ok(!stripFooter(domain).includes(forbidden), `service flow leaks portfolio narration ${forbidden}`);
});

test('field operations is an operational workspace with no portfolio navigation', () => {
  for (const phrase of ['배차 현황','배차 기준일','기사별 일정','방문 요청','우선 확인할 항목','최근 변경 이력']) assert.ok(ops.includes(phrase));
  for (const forbidden of ['포트폴리오','프로젝트 구조','고객용 홈페이지','이 시스템은']) assert.ok(!ops.includes(forbidden), `ops surface leaks ${forbidden}`);
});
