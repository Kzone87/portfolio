import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createInquiryStore } from '../nexa-tech-service/server/inquiry-store.mjs';
import { createInquiryServer, createFieldOpsClient } from '../nexa-tech-service/server/app.mjs';
import { createStore } from '../field-service-ops/server/store.mjs';
import { createFieldServiceServer } from '../field-service-ops/server/app.mjs';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const ADMIN_TOKEN = 'realism-admin-token-123456789';
const FIELD_TOKEN = 'realism-field-token-123456789';
const adminAuth = { authorization: `Bearer ${ADMIN_TOKEN}` };
const fieldAuth = { authorization: `Bearer ${FIELD_TOKEN}` };

const inquiryPayload = (overrides = {}) => ({
  company: '리얼서비스 고객사',
  name: '박담당',
  phone: '010-9876-4821',
  email: 'private-contact@example.com',
  industry: '생산·인쇄·제조',
  sites: '1개 사업장',
  assets: '1–5대',
  impact: '처리량·품질에 큰 영향이 생김',
  service: '고장·장애 현장지원',
  engagement: '고장 날 때 현장지원',
  detail: '출력 품질이 불안정해 현장 점검과 방문 지원이 필요합니다.',
  consent: true,
  ...overrides
});

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server) {
  server.close();
  await once(server, 'close');
}

async function request(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  return { response, body: await response.json() };
}

test('three NEXA product surfaces look like front door, customer portal and signed-in staff workspace', async () => {
  const corporate = await load('nexa-tech-service/index.html');
  const corporateApp = await load('nexa-tech-service/app.js');
  const portal = await load('nexa-service-domain/index.html');
  const portalApp = await load('nexa-service-domain/app.js');
  const ops = await load('field-service-ops/index.html');
  const opsApp = await load('field-service-ops/app.js');

  assert.match(corporate, /기업용 출력·인쇄장비/);
  assert.match(corporateApp, /진행 조회/);
  assert.match(corporateApp, /접수 진행 확인/);
  assert.match(corporateApp, /이 요청 진행 조회하기/);

  for (const phrase of ['서비스 요청 조회','접수번호','연락처 뒤 4자리','현재 진행상태','방문 정보','요청 처리 현황','최근 안내','작업 결과']) assert.match(portal, new RegExp(phrase));
  assert.match(portalApp, /NEXA_CUSTOMER_PORTAL_ENDPOINT/);
  assert.match(portalApp, /\/api\/customer\/requests\/lookup/);

  for (const phrase of ['NEXA SERVICE OPERATIONS','서울 운영팀','김현수','운영 관리자','9월 7일 배차 현황','기사별 일정','방문 요청']) assert.match(ops, new RegExp(phrase));
  assert.doesNotMatch(ops, /id="role"|현재 역할/);
  assert.match(opsApp, /CURRENT_USER/);
  assert.doesNotMatch(opsApp, /el\.role\.addEventListener/);
});

test('customer request lookup verifies phone suffix and never returns private contact fields', async () => {
  const store = createInquiryStore();
  const server = createInquiryServer(store, { rateMax: 20, rateWindowMs: 60_000 });
  const base = await listen(server);
  try {
    const created = await request(base, '/api/inquiries', { method: 'POST', body: JSON.stringify(inquiryPayload()) });
    assert.equal(created.response.status, 201);

    const correct = await request(base, '/api/customer/requests/lookup', {
      method: 'POST', body: JSON.stringify({ id: created.body.id, phoneLast4: '4821' })
    });
    assert.equal(correct.response.status, 200);
    assert.equal(correct.body.id, created.body.id);
    assert.equal(correct.body.company, '리얼서비스 고객사');
    for (const privateKey of ['phone','email','name','detail','engagement','assets','sites']) assert.equal(Object.hasOwn(correct.body, privateKey), false, `customer response leaks ${privateKey}`);

    const wrongSuffix = await request(base, '/api/customer/requests/lookup', {
      method: 'POST', body: JSON.stringify({ id: created.body.id, phoneLast4: '0000' })
    });
    const unknown = await request(base, '/api/customer/requests/lookup', {
      method: 'POST', body: JSON.stringify({ id: 'NX-NOTFOUND123', phoneLast4: '4821' })
    });
    assert.equal(wrongSuffix.response.status, 404);
    assert.equal(unknown.response.status, 404);
    assert.equal(wrongSuffix.body.error.code, 'CUSTOMER_REQUEST_NOT_FOUND');
    assert.equal(unknown.body.error.code, 'CUSTOMER_REQUEST_NOT_FOUND');
    assert.equal(wrongSuffix.body.error.message, unknown.body.error.message);
  } finally {
    await closeServer(server);
    store.close();
  }
});

test('customer portal reflects a real Field Ops schedule after consultation handoff', async () => {
  const fieldStore = createStore();
  const fieldServer = createFieldServiceServer(fieldStore, {
    requireAuth: true,
    principals: [{ token: FIELD_TOKEN, id: 'nexa-inquiry-service', role: 'STAFF' }],
    allowedOrigins: ['https://ops.example']
  });
  const fieldBase = await listen(fieldServer);

  const inquiryStore = createInquiryStore();
  const inquiryServer = createInquiryServer(inquiryStore, {
    admins: [{ token: ADMIN_TOKEN, id: 'service-coordinator' }],
    requireAdminConfig: true,
    rateMax: 20,
    rateWindowMs: 60_000,
    fieldOpsClient: createFieldOpsClient({ baseUrl: fieldBase, token: FIELD_TOKEN })
  });
  const inquiryBase = await listen(inquiryServer);

  try {
    const created = await request(inquiryBase, '/api/inquiries', { method: 'POST', body: JSON.stringify(inquiryPayload()) });
    const id = created.body.id;
    const contacted = await request(inquiryBase, `/api/admin/inquiries/${id}/contacted`, {
      method: 'POST', headers: adminAuth, body: JSON.stringify({ expectedVersion: 1 })
    });
    assert.equal(contacted.response.status, 200);

    const handoff = await request(inquiryBase, `/api/admin/inquiries/${id}/visit-request`, {
      method: 'POST', headers: adminAuth,
      body: JSON.stringify({ expectedVersion: 2, address: '서울 중구 세종대로 10', summary: '디지털 인쇄장비 출력 품질 점검', priority: 'NORMAL' })
    });
    assert.equal(handoff.response.status, 201);
    const jobId = handoff.body.fieldJob.id;

    const scheduled = await request(fieldBase, `/api/jobs/${jobId}/schedule`, {
      method: 'POST', headers: fieldAuth,
      body: JSON.stringify({ expectedVersion: 1, agentId: 1, startAt: '2026-09-09T05:00:00.000Z', endAt: '2026-09-09T06:00:00.000Z' })
    });
    assert.equal(scheduled.response.status, 200);
    assert.equal(scheduled.body.status, 'SCHEDULED');

    const customerView = await request(inquiryBase, '/api/customer/requests/lookup', {
      method: 'POST', body: JSON.stringify({ id, phoneLast4: '4821' })
    });
    assert.equal(customerView.response.status, 200);
    assert.equal(customerView.body.visit.status, 'SCHEDULED');
    assert.equal(customerView.body.visit.address, '서울 중구 세종대로 10');
    assert.equal(customerView.body.visit.summary, '디지털 인쇄장비 출력 품질 점검');
    assert.equal(customerView.body.visit.agentAssigned, true);
    assert.ok(customerView.body.updates.some(item => item.title === '방문 일정 확정'));
    assert.equal(Object.hasOwn(customerView.body, 'phone'), false);
  } finally {
    await closeServer(inquiryServer);
    inquiryStore.close();
    await closeServer(fieldServer);
  }
});
