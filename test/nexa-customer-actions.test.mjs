import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createInquiryStore, InquiryError } from '../nexa-tech-service/server/inquiry-store.mjs';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function createInquiry(store) {
  return store.create({
    company: '고객요청테스트상사',
    name: '김고객',
    phone: '010-5555-7788',
    email: 'customer@example.com',
    industry: '기업·교육·공공 사무환경',
    sites: '1개 사업장',
    assets: '1–5대',
    impact: '대체 장비가 있어 일정 조율 가능',
    service: '고장·장애 현장지원',
    engagement: '고장 날 때 현장지원',
    detail: '출력 품질 점검을 위해 현장 방문이 필요한 상담 요청입니다.',
    consent: true
  });
}

test('customer action store blocks invalid timing, duplicate requests, and close while work is pending', () => {
  const store = createInquiryStore();
  try {
    const created = createInquiry(store);
    assert.throws(() => store.createCustomerAction(created.id, {
      type: 'RESCHEDULE', preferredAt: '2026-09-10T15:00', note: '일정 변경 요청입니다.'
    }), error => error instanceof InquiryError && error.code === 'VISIT_NOT_READY');

    const contacted = store.transition(created.id, 1, 'CONTACTED', 'staff-fixture');
    const prepared = store.prepareVisitRequest(created.id, contacted.version, {
      address: '서울 중구 세종대로 30', summary: '출력 품질 현장 점검', priority: 'NORMAL'
    }, 'staff-fixture');
    store.completeVisitRequest(created.id, 77, 'staff-fixture');

    const reschedule = store.createCustomerAction(created.id, {
      type: 'RESCHEDULE', preferredAt: '2026-09-10T15:00', note: '오후 3시 이후 방문을 희망합니다.'
    });
    assert.equal(reschedule.state, 'OPEN');
    assert.throws(() => store.createCustomerAction(created.id, {
      type: 'RESCHEDULE', preferredAt: '2026-09-11T15:00', note: '같은 유형의 요청을 다시 보냅니다.'
    }), error => error instanceof InquiryError && error.code === 'CUSTOMER_ACTION_ALREADY_OPEN');
    assert.throws(() => store.transition(created.id, store.get(created.id).version, 'CLOSED', 'staff-fixture'), error => error instanceof InquiryError && error.code === 'CUSTOMER_ACTION_PENDING');

    const resolved = store.resolveCustomerAction(created.id, reschedule.id, 'RESOLVED', '9월 10일 오후 방문으로 조정했습니다.', 'staff-fixture');
    assert.equal(resolved.state, 'RESOLVED');
    assert.equal(resolved.resolvedBy, 'staff-fixture');
    const audits = store.audits(created.id);
    assert.ok(audits.some(item => item.action === 'CUSTOMER_RESCHEDULE_REQUESTED' && item.actor === 'customer'));
    assert.ok(audits.some(item => item.action === 'CUSTOMER_ACTION_RESOLVED' && item.actor === 'staff-fixture'));

    const message = store.createCustomerAction(created.id, { type: 'MESSAGE', note: '추가 증상을 알려드립니다.' });
    store.resolveCustomerAction(created.id, message.id, 'RESOLVED', '기사에게 추가 내용을 전달했습니다.', 'staff-fixture');
    const closed = store.transition(created.id, store.get(created.id).version, 'CLOSED', 'staff-fixture');
    assert.equal(closed.status, 'CLOSED');
    assert.throws(() => store.createCustomerAction(created.id, { type: 'MESSAGE', note: '종료 후 문의입니다.' }), error => error instanceof InquiryError && error.code === 'CUSTOMER_REQUEST_CLOSED');
    assert.equal(prepared.handoff.state, 'PENDING');
  } finally {
    store.close();
  }
});

test('customer and staff UIs expose a request queue without letting customers mutate field jobs', async () => {
  const [portal, portalApp, portalCss, ops, desk, remote, server] = await Promise.all([
    load('nexa-service-domain/index.html'), load('nexa-service-domain/app.js'), load('nexa-service-domain/portal-actions.css'),
    load('field-service-ops/index.html'), load('field-service-ops/inquiry-desk.mjs'), load('field-service-ops/remote-app.mjs'), load('field-service-ops/server/app.mjs')
  ]);
  for (const phrase of ['일정 변경 요청','방문 취소 요청','추가 문의','내가 남긴 요청']) assert.match(portal, new RegExp(phrase));
  assert.match(portalApp, /\/api\/customer\/requests\/action/);
  assert.doesNotMatch(portalApp, /\/api\/jobs\//);
  assert.match(portalCss, /overflow-wrap:anywhere/);
  assert.match(ops, /id="inquiry-customer-actions"/);
  assert.match(desk, /resolveCustomerAction/);
  assert.match(desk, /처리 완료/);
  assert.match(remote, /customer-actions\/\$\{Number\(actionId\)\}\/decision/);
  assert.match(server, /customerActionDecisionRoute/);
  assert.match(server, /identity\.principal\.id/);
  assert.match(server, /\/api\/ready/);
});
